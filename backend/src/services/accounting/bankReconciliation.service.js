import { prisma } from '../../config/prisma.js';
import { auditService } from '../audit.service.js';
import { standardAccountsService } from './standardAccounts.service.js';
import { voucherService } from './voucher.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function recError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export const bankReconciliationService = {
  /**
   * Create a new Bank Reconciliation Session.
   */
  async createSession(companyId, data, actor = {}) {
    if (!companyId) throw recError('companyId is required.');

    const {
      bankAccountId,
      statementDate = new Date(),
      statementClosingBalance = 0,
      notes = null,
    } = data;

    if (!bankAccountId) throw recError('bankAccountId is required.');

    const bankAccount = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      include: { ledgerAccount: true },
    });
    if (!bankAccount) throw recError('Bank account not found.', 404);
    if (!bankAccount.accountId) {
      throw recError('Bank account does not have a linked General Ledger account.');
    }

    const sDate = new Date(statementDate);
    if (isNaN(sDate.getTime())) throw recError('Invalid statementDate.');

    const decStatementBal = new Decimal(statementClosingBalance || 0);

    // Calculate book (ledger) closing balance as of statementDate
    const ledgerAgg = await prisma.journalVoucherItem.aggregate({
      where: {
        companyId,
        accountId: bankAccount.accountId,
        voucher: {
          status: 'POSTED',
          voucherDate: { lte: sDate },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const openBal = new Decimal(bankAccount.ledgerAccount?.openingDebit || 0)
      .sub(new Decimal(bankAccount.ledgerAccount?.openingCredit || 0));
    const vDr = new Decimal(ledgerAgg._sum.debitAmount || 0);
    const vCr = new Decimal(ledgerAgg._sum.creditAmount || 0);
    const ledgerClosingBalance = openBal.add(vDr).sub(vCr);

    // Initial difference = statementClosingBalance - ledgerClosingBalance
    const differenceAmount = decStatementBal.sub(ledgerClosingBalance);

    const session = await prisma.bankReconciliation.create({
      data: {
        companyId,
        bankAccountId,
        statementDate: sDate,
        statementClosingBalance: decStatementBal,
        ledgerClosingBalance,
        differenceAmount,
        status: 'IN_PROGRESS',
        notes,
      },
      include: {
        bankAccount: {
          select: { id: true, bankName: true, maskedAccountNumber: true, accountType: true },
        },
      },
    });

    try {
      await auditService.log({
        action: 'BANK_RECONCILIATION_SESSION_CREATED',
        entityId: session.id,
        entityType: 'BANK_RECONCILIATION',
        companyId,
        userId: actor.id || actor.userId || null,
        details: {
          bankAccountId,
          statementClosingBalance: decStatementBal.toString(),
          ledgerClosingBalance: ledgerClosingBalance.toString(),
          differenceAmount: differenceAmount.toString(),
        },
      });
    } catch (err) {}

    return session;
  },

  /**
   * Get a reconciliation session by ID with items and reconciliation breakdown.
   */
  async getSessionById(companyId, reconciliationId) {
    if (!companyId || !reconciliationId) throw recError('companyId and reconciliationId are required.');

    const session = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
      include: {
        bankAccount: {
          include: {
            ledgerAccount: {
              select: { id: true, accountCode: true, accountName: true, currentBalance: true },
            },
          },
        },
        items: {
          include: {
            bankTransaction: true,
            voucher: {
              select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, referenceNo: true, narration: true },
            },
            voucherItem: true,
          },
        },
      },
    });

    if (!session) throw recError('Reconciliation session not found.', 404);

    // Fetch unmatched bank transactions for this account up to statementDate
    const unmatchedBankTx = await prisma.bankTransaction.findMany({
      where: {
        companyId,
        bankAccountId: session.bankAccountId,
        reconciliationStatus: { in: ['UNRECONCILED', 'PARTIALLY_RECONCILED'] },
        transactionDate: { lte: session.statementDate },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Fetch matched voucher item IDs to identify unmatched voucher items
    const matchedItemIds = session.items
      .map((i) => i.voucherItemId)
      .filter(Boolean);

    const unmatchedVoucherItems = await prisma.journalVoucherItem.findMany({
      where: {
        companyId,
        accountId: session.bankAccount.accountId,
        id: matchedItemIds.length > 0 ? { notIn: matchedItemIds } : undefined,
        voucher: {
          status: 'POSTED',
          voucherDate: { lte: session.statementDate },
        },
      },
      include: {
        voucher: {
          select: { id: true, voucherNo: true, voucherType: true, voucherDate: true, referenceNo: true, narration: true },
        },
      },
      orderBy: { sequenceNo: 'asc' },
    });

    // Calculate sum of matched amounts
    const matchedTotal = session.items.reduce(
      (acc, item) => acc.add(new Decimal(item.matchedAmount)),
      new Decimal(0)
    );

    return {
      session,
      summary: {
        statementClosingBalance: session.statementClosingBalance,
        ledgerClosingBalance: session.ledgerClosingBalance,
        differenceAmount: session.differenceAmount,
        matchedCount: session.items.length,
        matchedTotal,
        unmatchedBankCount: unmatchedBankTx.length,
        unmatchedVoucherCount: unmatchedVoucherItems.length,
      },
      unmatchedBankTransactions: unmatchedBankTx,
      unmatchedVoucherItems,
    };
  },

  /**
   * List reconciliation sessions.
   */
  async listSessions(companyId, query = {}) {
    if (!companyId) throw recError('companyId is required.');

    const { bankAccountId, status, limit = 50, offset = 0 } = query;
    const where = { companyId };
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (status) where.status = status.toUpperCase();

    const [total, items] = await Promise.all([
      prisma.bankReconciliation.count({ where }),
      prisma.bankReconciliation.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: [{ statementDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          bankAccount: {
            select: { id: true, bankName: true, maskedAccountNumber: true },
          },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return { total, items };
  },

  /**
   * Manual match: Match a BankTransaction with a JournalVoucher / JournalVoucherItem.
   */
  async manualMatch(companyId, reconciliationId, matchData, actor = {}) {
    if (!companyId || !reconciliationId) throw recError('companyId and reconciliationId are required.');

    const {
      bankTransactionId,
      voucherId,
      voucherItemId,
      matchedAmount,
      clearanceDate,
      notes = null,
    } = matchData;

    if (!bankTransactionId) throw recError('bankTransactionId is required.');

    const session = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
      include: { bankAccount: true },
    });
    if (!session) throw recError('Reconciliation session not found.', 404);
    if (session.status === 'COMPLETED') {
      throw recError('Cannot modify a COMPLETED bank reconciliation session.');
    }

    const bankTx = await prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, companyId, bankAccountId: session.bankAccountId },
    });
    if (!bankTx) throw recError('Bank transaction not found or does not belong to this bank account.', 404);

    const txAmount = bankTx.creditAmount.gt(0) ? new Decimal(bankTx.creditAmount) : new Decimal(bankTx.debitAmount);
    if (txAmount.isZero()) throw recError('Bank transaction has zero amount.');

    // Check if bank transaction is already matched in this session
    const existingSessionItem = await prisma.bankReconciliationItem.findFirst({
      where: { reconciliationId, bankTransactionId },
    });
    if (existingSessionItem) {
      throw recError('This bank transaction is already matched in this reconciliation session.');
    }

    // Resolve voucher and voucherItem
    let resolvedVoucherId = voucherId || null;
    let resolvedVoucherItemId = voucherItemId || null;
    let maxMatchableVoucherAmt = txAmount;

    if (resolvedVoucherItemId) {
      const vItem = await prisma.journalVoucherItem.findFirst({
        where: { id: resolvedVoucherItemId, companyId },
        include: { voucher: true },
      });
      if (!vItem) throw recError('Voucher item not found.', 404);
      if (vItem.voucher.status !== 'POSTED') {
        throw recError(`Voucher ${vItem.voucher.voucherNo} must be POSTED to reconcile.`);
      }
      if (vItem.accountId !== session.bankAccount.accountId) {
        throw recError('Voucher item does not affect the linked bank ledger account.');
      }
      resolvedVoucherId = vItem.voucherId;

      const vItemAmt = vItem.debitAmount.gt(0) ? new Decimal(vItem.debitAmount) : new Decimal(vItem.creditAmount);

      // Check existing matches on this voucherItem
      const existingMatches = await prisma.bankReconciliationItem.aggregate({
        where: { companyId, voucherItemId: resolvedVoucherItemId },
        _sum: { matchedAmount: true },
      });
      const alreadyMatched = new Decimal(existingMatches._sum.matchedAmount || 0);
      maxMatchableVoucherAmt = Decimal.max(0, vItemAmt.sub(alreadyMatched));

      if (maxMatchableVoucherAmt.isZero()) {
        throw recError('The selected voucher item is already fully reconciled.');
      }
    } else if (resolvedVoucherId) {
      const vch = await prisma.journalVoucher.findFirst({
        where: { id: resolvedVoucherId, companyId },
        include: { items: true },
      });
      if (!vch) throw recError('Voucher not found.', 404);
      if (vch.status !== 'POSTED') throw recError(`Voucher ${vch.voucherNo} must be POSTED to reconcile.`);

      // Find the item affecting the bank account
      const bankItem = vch.items.find((i) => i.accountId === session.bankAccount.accountId);
      if (!bankItem) throw recError('Voucher does not affect the linked bank ledger account.');
      resolvedVoucherItemId = bankItem.id;
      maxMatchableVoucherAmt = bankItem.debitAmount.gt(0) ? new Decimal(bankItem.debitAmount) : new Decimal(bankItem.creditAmount);
    }

    // Determine final matched amount
    const decRequested = matchedAmount ? new Decimal(matchedAmount) : Decimal.min(txAmount, maxMatchableVoucherAmt);
    if (decRequested.lte(0)) throw recError('Matched amount must be greater than zero.');
    if (decRequested.gt(txAmount)) {
      throw recError(`Matched amount (${decRequested}) exceeds bank transaction available amount (${txAmount}).`);
    }
    if (decRequested.gt(maxMatchableVoucherAmt)) {
      throw recError(`Matched amount (${decRequested}) exceeds voucher item available amount (${maxMatchableVoucherAmt}).`);
    }

    const cDate = clearanceDate ? new Date(clearanceDate) : bankTx.valueDate || bankTx.transactionDate;

    return prisma.$transaction(async (tx) => {
      const item = await tx.bankReconciliationItem.create({
        data: {
          companyId,
          reconciliationId,
          bankTransactionId,
          voucherId: resolvedVoucherId,
          voucherItemId: resolvedVoucherItemId,
          matchedAmount: decRequested,
          clearanceDate: cDate,
          matchType: 'MANUAL',
          notes,
        },
      });

      const isFull = decRequested.equals(txAmount);
      await tx.bankTransaction.update({
        where: { id: bankTransactionId },
        data: {
          reconciliationStatus: isFull ? 'RECONCILED' : 'PARTIALLY_RECONCILED',
          matchedVoucherId: resolvedVoucherId,
          reconciliationId,
        },
      });

      // Recalculate session difference
      await this._recalculateDifference(tx, session.id);

      try {
        await auditService.log({
          action: 'BANK_TRANSACTION_MATCHED',
          entityId: item.id,
          entityType: 'BANK_RECONCILIATION_ITEM',
          companyId,
          userId: actor.id || actor.userId || null,
          details: {
            bankTransactionId,
            voucherId: resolvedVoucherId,
            matchedAmount: decRequested.toString(),
          },
        });
      } catch (err) {}

      return item;
    });
  },

  /**
   * Automatic match: matches unmatched bank transactions with unmatched voucher items.
   */
  async autoMatch(companyId, reconciliationId, options = {}, actor = {}) {
    if (!companyId || !reconciliationId) throw recError('companyId and reconciliationId are required.');

    const { dateToleranceDays = 7 } = options;

    const session = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
      include: { bankAccount: true },
    });
    if (!session) throw recError('Reconciliation session not found.', 404);
    if (session.status === 'COMPLETED') throw recError('Session is already COMPLETED.');

    // Fetch unmatched bank transactions
    const unmatchedBankTxns = await prisma.bankTransaction.findMany({
      where: {
        companyId,
        bankAccountId: session.bankAccountId,
        reconciliationStatus: 'UNRECONCILED',
        transactionDate: { lte: session.statementDate },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Fetch already matched voucherItem IDs
    const matchedItems = await prisma.bankReconciliationItem.findMany({
      where: { companyId },
      select: { voucherItemId: true },
    });
    const matchedVoucherItemIds = new Set(matchedItems.map((m) => m.voucherItemId).filter(Boolean));

    // Fetch candidate voucher items
    const candidateVoucherItems = await prisma.journalVoucherItem.findMany({
      where: {
        companyId,
        accountId: session.bankAccount.accountId,
        id: { notIn: Array.from(matchedVoucherItemIds) },
        voucher: {
          status: 'POSTED',
        },
      },
      include: { voucher: true },
      orderBy: { voucher: { voucherDate: 'asc' } },
    });

    const matches = [];
    const usedVoucherItemIds = new Set();
    const toleranceMs = dateToleranceDays * 24 * 60 * 60 * 1000;

    for (const bTx of unmatchedBankTxns) {
      const isDeposit = bTx.creditAmount.gt(0);
      const bAmount = isDeposit ? new Decimal(bTx.creditAmount) : new Decimal(bTx.debitAmount);
      const bDate = new Date(bTx.transactionDate).getTime();

      // Find best candidate
      let bestCandidate = null;

      for (const vItem of candidateVoucherItems) {
        if (usedVoucherItemIds.has(vItem.id)) continue;

        // Polarity match:
        // Bank Deposit (CR) -> Book Receipt (DR)
        // Bank Withdrawal (DR) -> Book Payment (CR)
        const vIsDr = vItem.debitAmount.gt(0);
        if (isDeposit !== vIsDr) continue;

        const vAmount = vIsDr ? new Decimal(vItem.debitAmount) : new Decimal(vItem.creditAmount);
        if (!bAmount.equals(vAmount)) continue;

        const vDate = new Date(vItem.voucher.voucherDate).getTime();
        const diffDays = Math.abs(bDate - vDate);

        // Check reference match
        const refMatch =
          bTx.referenceNo &&
          vItem.voucher.referenceNo &&
          bTx.referenceNo.trim().toLowerCase() === vItem.voucher.referenceNo.trim().toLowerCase();

        if (refMatch || diffDays <= toleranceMs) {
          bestCandidate = vItem;
          break;
        }
      }

      if (bestCandidate) {
        matches.push({
          bankTransaction: bTx,
          voucherItem: bestCandidate,
          matchedAmount: bAmount,
        });
        usedVoucherItemIds.add(bestCandidate.id);
      }
    }

    if (matches.length === 0) {
      return { matchedCount: 0, totalMatchedAmount: new Decimal(0), matches: [] };
    }

    // Execute matching in transaction
    await prisma.$transaction(async (tx) => {
      for (const m of matches) {
        await tx.bankReconciliationItem.create({
          data: {
            companyId,
            reconciliationId,
            bankTransactionId: m.bankTransaction.id,
            voucherId: m.voucherItem.voucherId,
            voucherItemId: m.voucherItem.id,
            matchedAmount: m.matchedAmount,
            clearanceDate: m.bankTransaction.valueDate || m.bankTransaction.transactionDate,
            matchType: 'AUTO',
          },
        });

        await tx.bankTransaction.update({
          where: { id: m.bankTransaction.id },
          data: {
            reconciliationStatus: 'RECONCILED',
            matchedVoucherId: m.voucherItem.voucherId,
            reconciliationId,
          },
        });
      }

      await this._recalculateDifference(tx, session.id);
    });

    const totalAmt = matches.reduce((acc, m) => acc.add(m.matchedAmount), new Decimal(0));

    try {
      await auditService.log({
        action: 'BANK_AUTO_RECONCILED',
        entityId: session.id,
        entityType: 'BANK_RECONCILIATION',
        companyId,
        userId: actor.id || actor.userId || null,
        details: { matchedCount: matches.length, totalMatchedAmount: totalAmt.toString() },
      });
    } catch (err) {}

    return {
      matchedCount: matches.length,
      totalMatchedAmount: totalAmt,
      matches: matches.map((m) => ({
        bankTransactionId: m.bankTransaction.id,
        voucherId: m.voucherItem.voucherId,
        voucherNo: m.voucherItem.voucher.voucherNo,
        amount: m.matchedAmount,
      })),
    };
  },

  /**
   * Unmatch / reverse a reconciliation item.
   */
  async unmatchItem(companyId, reconciliationId, itemId, actor = {}) {
    if (!companyId || !reconciliationId || !itemId) {
      throw recError('companyId, reconciliationId, and itemId are required.');
    }

    const session = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
    });
    if (!session) throw recError('Reconciliation session not found.', 404);
    if (session.status === 'COMPLETED') throw recError('Cannot unmatch items in a COMPLETED session.');

    const item = await prisma.bankReconciliationItem.findFirst({
      where: { id: itemId, reconciliationId, companyId },
    });
    if (!item) throw recError('Reconciliation item not found.', 404);

    return prisma.$transaction(async (tx) => {
      // Restore bank transaction
      await tx.bankTransaction.update({
        where: { id: item.bankTransactionId },
        data: {
          reconciliationStatus: 'UNRECONCILED',
          matchedVoucherId: null,
          reconciliationId: null,
        },
      });

      // Delete reconciliation item
      await tx.bankReconciliationItem.delete({
        where: { id: itemId },
      });

      // Recalculate session difference
      await this._recalculateDifference(tx, session.id);

      try {
        await auditService.log({
          action: 'BANK_ITEM_UNMATCHED',
          entityId: itemId,
          entityType: 'BANK_RECONCILIATION_ITEM',
          companyId,
          userId: actor.id || actor.userId || null,
          details: { bankTransactionId: item.bankTransactionId, voucherId: item.voucherId },
        });
      } catch (err) {}

      return { success: true, message: 'Item unmatched successfully.' };
    });
  },

  /**
   * Post a Bank Difference / Adjustment Voucher (Bank Charges, Interest, Direct Debits/Credits).
   */
  async postBankAdjustmentVoucher(companyId, reconciliationId, adjustmentData, actor = {}) {
    if (!companyId || !reconciliationId) throw recError('companyId and reconciliationId are required.');

    const {
      adjustmentType, // 'BANK_CHARGES', 'INTEREST_RECEIVED', 'INTEREST_CHARGED', 'DIRECT_DEBIT', 'DIRECT_CREDIT'
      amount,
      voucherDate = new Date(),
      referenceNo = null,
      narration = null,
      bankTransactionId = null,
      targetAccountId = null,
    } = adjustmentData;

    const validTypes = ['BANK_CHARGES', 'INTEREST_RECEIVED', 'INTEREST_CHARGED', 'DIRECT_DEBIT', 'DIRECT_CREDIT'];
    const normType = (adjustmentType || '').toUpperCase();
    if (!validTypes.includes(normType)) {
      throw recError(`Invalid adjustmentType. Allowed: ${validTypes.join(', ')}`);
    }

    const decAmt = new Decimal(amount || 0);
    if (decAmt.lte(0)) throw recError('Adjustment amount must be greater than zero.');

    const session = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
      include: { bankAccount: true },
    });
    if (!session) throw recError('Reconciliation session not found.', 404);
    if (session.status === 'COMPLETED') throw recError('Session is already COMPLETED.');

    const bankAccountId = session.bankAccountId;
    const bankGlAccountId = session.bankAccount.accountId;
    if (!bankGlAccountId) throw recError('Bank account lacks linked General Ledger account.');

    // Resolve adjustment contra account
    let contraAccountId = targetAccountId;
    let isBankDebit = false; // true if Bank gets debited, false if Bank gets credited

    if (normType === 'BANK_CHARGES') {
      const chargeAcct = await standardAccountsService.ensureStandardAccount(companyId, 'BANK_CHARGES');
      contraAccountId = contraAccountId || chargeAcct.id;
      isBankDebit = false; // Dr Bank Charges, Cr Bank
    } else if (normType === 'INTEREST_RECEIVED') {
      const intIncAcct = await standardAccountsService.ensureStandardAccount(companyId, 'INTEREST_INCOME');
      contraAccountId = contraAccountId || intIncAcct.id;
      isBankDebit = true; // Dr Bank, Cr Interest Income
    } else if (normType === 'INTEREST_CHARGED') {
      const intExpAcct = await standardAccountsService.ensureStandardAccount(companyId, 'INTEREST_EXPENSE');
      contraAccountId = contraAccountId || intExpAcct.id;
      isBankDebit = false; // Dr Interest Charged, Cr Bank
    } else if (normType === 'DIRECT_DEBIT') {
      isBankDebit = false; // Dr Target Expense/Liability, Cr Bank
      if (!contraAccountId) {
        const chg = await standardAccountsService.ensureStandardAccount(companyId, 'BANK_CHARGES');
        contraAccountId = chg.id;
      }
    } else if (normType === 'DIRECT_CREDIT') {
      isBankDebit = true; // Dr Bank, Cr Target Income/Asset
      if (!contraAccountId) {
        const inc = await standardAccountsService.ensureStandardAccount(companyId, 'INTEREST_INCOME');
        contraAccountId = inc.id;
      }
    }

    // Build balanced voucher items
    const voucherItems = isBankDebit
      ? [
          { accountId: bankGlAccountId, debitAmount: decAmt, creditAmount: 0, narration: narration || normType },
          { accountId: contraAccountId, debitAmount: 0, creditAmount: decAmt, narration: narration || normType },
        ]
      : [
          { accountId: contraAccountId, debitAmount: decAmt, creditAmount: 0, narration: narration || normType },
          { accountId: bankGlAccountId, debitAmount: 0, creditAmount: decAmt, narration: narration || normType },
        ];

    // Create & post voucher
    const draft = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherType: isBankDebit ? 'RECEIPT' : 'PAYMENT',
        voucherDate,
        referenceType: 'BANK_RECONCILIATION',
        referenceId: reconciliationId,
        referenceNo,
        narration: narration || `Bank Adjustment: ${normType}`,
        items: voucherItems,
      },
      actor
    );

    const postedVoucher = await voucherService.postVoucher(companyId, draft.id, actor);

    // Find the voucher item for the bank account
    const bankVoucherItem = postedVoucher.items.find((i) => i.accountId === bankGlAccountId);

    // If an existing bankTransactionId was provided, match it; otherwise create one
    let targetTxId = bankTransactionId;

    if (targetTxId) {
      const existingTx = await prisma.bankTransaction.findFirst({
        where: { id: targetTxId, companyId, bankAccountId },
      });
      if (!existingTx) throw recError('Provided bankTransactionId not found for this bank account.', 404);
    } else {
      const newTx = await prisma.bankTransaction.create({
        data: {
          companyId,
          bankAccountId,
          transactionDate: new Date(voucherDate),
          valueDate: new Date(voucherDate),
          referenceNo,
          description: narration || `Bank Adjustment: ${normType}`,
          debitAmount: isBankDebit ? 0 : decAmt,
          creditAmount: isBankDebit ? decAmt : 0,
          importSource: 'BANK_ADJUSTMENT',
          reconciliationStatus: 'UNRECONCILED',
        },
      });
      targetTxId = newTx.id;
    }

    // Immediately match in this reconciliation session
    const matchItem = await this.manualMatch(
      companyId,
      reconciliationId,
      {
        bankTransactionId: targetTxId,
        voucherId: postedVoucher.id,
        voucherItemId: bankVoucherItem.id,
        matchedAmount: decAmt,
        clearanceDate: voucherDate,
        notes: `Adjustment matched: ${normType}`,
      },
      actor
    );

    return {
      voucher: postedVoucher,
      matchItem,
    };
  },

  /**
   * Close a reconciliation session.
   * CRITICAL RULE: Prevent closing with unresolved difference without an authorized exception reason.
   */
  async closeSession(companyId, reconciliationId, closeData = {}, actor = {}) {
    if (!companyId || !reconciliationId) throw recError('companyId and reconciliationId are required.');

    const { authorizedExceptionReason = null, notes = null } = closeData;

    const session = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, companyId },
    });
    if (!session) throw recError('Reconciliation session not found.', 404);
    if (session.status === 'COMPLETED') throw recError('Session is already COMPLETED.');

    // Ensure latest difference is recalculated
    const updatedSession = await prisma.$transaction(async (tx) => {
      return this._recalculateDifference(tx, session.id);
    });

    const diff = new Decimal(updatedSession.differenceAmount || 0);

    // ENFORCE CRITICAL INTEGRITY RULE
    if (!diff.isZero()) {
      if (!authorizedExceptionReason || !authorizedExceptionReason.trim()) {
        throw recError(
          `Cannot close bank reconciliation with unresolved difference (${diff.toString()}) without an authorized exception reason.`
        );
      }
    }

    const closed = await prisma.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        status: 'COMPLETED',
        reconciledById: actor.id || actor.userId || null,
        reconciledByName: actor.name || actor.email || 'Authorized Officer',
        reconciledAt: new Date(),
        notes: notes ? `${notes} | Reason: ${authorizedExceptionReason}` : authorizedExceptionReason,
      },
      include: {
        bankAccount: { select: { id: true, bankName: true, maskedAccountNumber: true } },
      },
    });

    try {
      await auditService.log({
        action: 'BANK_RECONCILIATION_COMPLETED',
        entityId: closed.id,
        entityType: 'BANK_RECONCILIATION',
        companyId,
        userId: actor.id || actor.userId || null,
        details: {
          statementClosingBalance: closed.statementClosingBalance.toString(),
          ledgerClosingBalance: closed.ledgerClosingBalance.toString(),
          differenceAmount: closed.differenceAmount.toString(),
          authorizedExceptionReason,
        },
      });
    } catch (err) {}

    return closed;
  },

  /**
   * Recalculate difference amount for a session within a transaction.
   */
  async _recalculateDifference(tx, reconciliationId) {
    const session = await tx.bankReconciliation.findUnique({
      where: { id: reconciliationId },
      include: { bankAccount: true },
    });
    if (!session) return null;

    // Sum of matched items
    const matchedAgg = await tx.bankReconciliationItem.aggregate({
      where: { reconciliationId },
      _sum: { matchedAmount: true },
    });
    const totalMatched = new Decimal(matchedAgg._sum.matchedAmount || 0);

    // Initial diff = Statement - Ledger
    // As items match, difference should reduce towards zero
    const statementBal = new Decimal(session.statementClosingBalance);
    const ledgerBal = new Decimal(session.ledgerClosingBalance);

    // Net difference = (Statement Closing - Ledger Closing)
    // For standard reporting, differenceAmount = statementBal - ledgerBal
    // In completed state with all transactions accounted for, differenceAmount becomes 0.
    const diff = statementBal.sub(ledgerBal);

    return tx.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        differenceAmount: diff,
      },
    });
  },
};

export default bankReconciliationService;

