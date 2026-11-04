import { prisma } from '../../config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function reportError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const bankReportService = {
  /**
   * Bank Book: Detailed ledger statement for a bank account with running balance.
   */
  async getBankBook(companyId, bankAccountId, query = {}) {
    if (!companyId || !bankAccountId) throw reportError('companyId and bankAccountId are required.');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      include: { ledgerAccount: true },
    });
    if (!bankAccount) throw reportError('Bank account not found.', 404);
    if (!bankAccount.accountId) throw reportError('Bank account does not have a linked General Ledger account.');

    const { fromDate, toDate } = query;
    const fDate = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const tDate = toDate ? new Date(toDate) : new Date();

    // 1. Calculate opening balance as of fDate
    const ledger = bankAccount.ledgerAccount;
    const initialOpening = new Decimal(ledger.openingDebit || 0).sub(new Decimal(ledger.openingCredit || 0));

    const priorAgg = await prisma.journalVoucherItem.aggregate({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        voucher: {
          status: 'POSTED',
          voucherDate: { lt: fDate },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const priorDr = new Decimal(priorAgg._sum.debitAmount || 0);
    const priorCr = new Decimal(priorAgg._sum.creditAmount || 0);
    const openingBalance = initialOpening.add(priorDr).sub(priorCr);

    // 2. Query transactions between fDate and tDate
    const items = await prisma.journalVoucherItem.findMany({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        voucher: {
          status: 'POSTED',
          voucherDate: { gte: fDate, lte: tDate },
        },
      },
      orderBy: [{ voucher: { voucherDate: 'asc' } }, { sequenceNo: 'asc' }],
      include: {
        voucher: {
          include: {
            items: {
              where: { accountId: { not: bankAccount.accountId } },
              include: { account: { select: { accountName: true, accountCode: true } } },
            },
          },
        },
      },
    });

    // 3. Compute running balances
    let running = openingBalance;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    const statementRows = items.map((item) => {
      const dr = new Decimal(item.debitAmount);
      const cr = new Decimal(item.creditAmount);
      totalDebit = totalDebit.add(dr);
      totalCredit = totalCredit.add(cr);
      running = running.add(dr).sub(cr);

      const contraAccounts = item.voucher.items.map((ci) => ci.account.accountName).join(', ');

      return {
        voucherItemId: item.id,
        voucherId: item.voucherId,
        voucherNo: item.voucher.voucherNo,
        voucherType: item.voucher.voucherType,
        voucherDate: item.voucher.voucherDate,
        referenceNo: item.voucher.referenceNo,
        contraLedger: contraAccounts || 'Sundry Accounts',
        narration: item.narration || item.voucher.narration,
        debitAmount: dr,
        creditAmount: cr,
        runningBalance: running,
      };
    });

    return {
      bankAccountId,
      bankName: bankAccount.bankName,
      maskedAccountNumber: bankAccount.maskedAccountNumber,
      ledgerAccountCode: ledger.accountCode,
      ledgerAccountName: ledger.accountName,
      fromDate: fDate,
      toDate: tDate,
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance: running,
      transactions: statementRows,
    };
  },

  /**
   * Bank Reconciliation Statement (BRS) as of a given date.
   */
  async getBankReconciliationStatement(companyId, bankAccountId, query = {}) {
    if (!companyId || !bankAccountId) throw reportError('companyId and bankAccountId are required.');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      include: { ledgerAccount: true },
    });
    if (!bankAccount) throw reportError('Bank account not found.', 404);

    const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();

    // 1. Balance as per Bank Statement
    const latestTx = await prisma.bankTransaction.findFirst({
      where: {
        companyId,
        bankAccountId,
        transactionDate: { lte: asOfDate },
        runningBalance: { not: null },
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    });

    let statementBalance = new Decimal(bankAccount.currentBalance || 0);
    if (latestTx && latestTx.runningBalance !== null) {
      statementBalance = new Decimal(latestTx.runningBalance);
    }

    // 2. Balance as per Books (Ledger)
    const ledgerAgg = await prisma.journalVoucherItem.aggregate({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        voucher: {
          status: 'POSTED',
          voucherDate: { lte: asOfDate },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const openBal = new Decimal(bankAccount.ledgerAccount?.openingDebit || 0).sub(
      new Decimal(bankAccount.ledgerAccount?.openingCredit || 0)
    );
    const ledgerBalance = openBal
      .add(new Decimal(ledgerAgg._sum.debitAmount || 0))
      .sub(new Decimal(ledgerAgg._sum.creditAmount || 0));

    // 3. Unreconciled book debits (Cheques/Receipts recorded in books but not yet credited in bank)
    const matchedVoucherItemIds = await prisma.bankReconciliationItem.findMany({
      where: { companyId, clearanceDate: { lte: asOfDate } },
      select: { voucherItemId: true },
    });
    const matchedIds = matchedVoucherItemIds.map((m) => m.voucherItemId).filter(Boolean);

    const uncreditedDeposits = await prisma.journalVoucherItem.findMany({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        debitAmount: { gt: 0 },
        id: matchedIds.length > 0 ? { notIn: matchedIds } : undefined,
        voucher: { status: 'POSTED', voucherDate: { lte: asOfDate } },
      },
      include: { voucher: true },
    });

    // 4. Unreconciled book credits (Cheques issued in books but not yet debited in bank)
    const unpresentedCheques = await prisma.journalVoucherItem.findMany({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        creditAmount: { gt: 0 },
        id: matchedIds.length > 0 ? { notIn: matchedIds } : undefined,
        voucher: { status: 'POSTED', voucherDate: { lte: asOfDate } },
      },
      include: { voucher: true },
    });

    const totalUncredited = uncreditedDeposits.reduce((acc, d) => acc.add(new Decimal(d.debitAmount)), new Decimal(0));
    const totalUnpresented = unpresentedCheques.reduce((acc, c) => acc.add(new Decimal(c.creditAmount)), new Decimal(0));

    // Adjusted book balance = Ledger Balance + Unpresented Cheques - Uncredited Deposits
    const adjustedBookBalance = ledgerBalance.add(totalUnpresented).sub(totalUncredited);
    const netDifference = statementBalance.sub(adjustedBookBalance);

    return {
      bankAccountId,
      bankName: bankAccount.bankName,
      maskedAccountNumber: bankAccount.maskedAccountNumber,
      asOfDate,
      balanceAsPerBooks: ledgerBalance,
      addItems: {
        title: 'Amounts not yet debited by bank (Unpresented cheques)',
        count: unpresentedCheques.length,
        total: totalUnpresented,
        items: unpresentedCheques.map((c) => ({
          voucherNo: c.voucher.voucherNo,
          date: c.voucher.voucherDate,
          amount: c.creditAmount,
          narration: c.narration || c.voucher.narration,
        })),
      },
      lessItems: {
        title: 'Amounts not yet credited by bank (Uncredited deposits)',
        count: uncreditedDeposits.length,
        total: totalUncredited,
        items: uncreditedDeposits.map((d) => ({
          voucherNo: d.voucher.voucherNo,
          date: d.voucher.voucherDate,
          amount: d.debitAmount,
          narration: d.narration || d.voucher.narration,
        })),
      },
      adjustedBookBalance,
      balanceAsPerStatement: statementBalance,
      reconciliationDifference: netDifference,
    };
  },

  /**
   * Get unreconciled transactions summary (both bank statement & book vouchers).
   */
  async getUnreconciledTransactions(companyId, bankAccountId) {
    if (!companyId || !bankAccountId) throw reportError('companyId and bankAccountId are required.');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
    });
    if (!bankAccount) throw reportError('Bank account not found.', 404);

    const [unreconciledBankTxns, matchedItems] = await Promise.all([
      prisma.bankTransaction.findMany({
        where: {
          companyId,
          bankAccountId,
          reconciliationStatus: { in: ['UNRECONCILED', 'PARTIALLY_RECONCILED'] },
        },
        orderBy: { transactionDate: 'desc' },
      }),
      prisma.bankReconciliationItem.findMany({
        where: { companyId },
        select: { voucherItemId: true },
      }),
    ]);

    const matchedIds = matchedItems.map((m) => m.voucherItemId).filter(Boolean);

    const unreconciledBookItems = await prisma.journalVoucherItem.findMany({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        id: matchedIds.length > 0 ? { notIn: matchedIds } : undefined,
        voucher: { status: 'POSTED' },
      },
      orderBy: { voucher: { voucherDate: 'desc' } },
      include: {
        voucher: {
          select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, referenceNo: true, narration: true },
        },
      },
    });

    return {
      bankAccountId,
      bankName: bankAccount.bankName,
      statementUnreconciled: {
        count: unreconciledBankTxns.length,
        items: unreconciledBankTxns,
      },
      booksUnreconciled: {
        count: unreconciledBookItems.length,
        items: unreconciledBookItems,
      },
    };
  },

  /**
   * Summary of Bank Charges and Interest.
   */
  async getBankChargesAndInterestSummary(companyId, bankAccountId, query = {}) {
    if (!companyId || !bankAccountId) throw reportError('companyId and bankAccountId are required.');

    const { fromDate, toDate } = query;
    const where = {
      companyId,
      referenceType: 'BANK_RECONCILIATION',
      status: 'POSTED',
    };

    if (fromDate || toDate) {
      where.voucherDate = {};
      if (fromDate) where.voucherDate.gte = new Date(fromDate);
      if (toDate) where.voucherDate.lte = new Date(toDate);
    }

    const vouchers = await prisma.journalVoucher.findMany({
      where,
      include: { items: { include: { account: true } } },
    });

    let totalBankCharges = new Decimal(0);
    let totalInterestReceived = new Decimal(0);
    let totalInterestCharged = new Decimal(0);

    for (const vch of vouchers) {
      for (const item of vch.items) {
        if (item.account.controlType === 'BANK_CHARGES' && item.debitAmount.gt(0)) {
          totalBankCharges = totalBankCharges.add(new Decimal(item.debitAmount));
        } else if (item.account.controlType === 'INTEREST_INCOME' && item.creditAmount.gt(0)) {
          totalInterestReceived = totalInterestReceived.add(new Decimal(item.creditAmount));
        } else if (item.account.controlType === 'INTEREST_EXPENSE' && item.debitAmount.gt(0)) {
          totalInterestCharged = totalInterestCharged.add(new Decimal(item.debitAmount));
        }
      }
    }

    return {
      bankAccountId,
      fromDate: fromDate || null,
      toDate: toDate || null,
      totalBankCharges,
      totalInterestReceived,
      totalInterestCharged,
      voucherCount: vouchers.length,
    };
  },
};

export default bankReportService;
