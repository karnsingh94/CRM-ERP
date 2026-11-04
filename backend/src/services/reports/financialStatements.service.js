import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

function financialError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export const financialStatementsService = {
  // =========================================================================
  // 1. GENERAL LEDGER STATEMENT
  // =========================================================================
  /**
   * Chronological statement of an account with running balance and opening balance.
   */
  async getGeneralLedger(companyId, accountId, query = {}) {
    if (!companyId || !accountId) {
      throw financialError('companyId and accountId are required.');
    }

    const account = await prisma.accountMaster.findFirst({
      where: { id: accountId, companyId },
      include: { group: true },
    });
    if (!account) {
      throw financialError(`Ledger account not found with id ${accountId}.`, 404);
    }

    const { fromDate, toDate, page = 1, limit = 100 } = query;
    const fDate = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const tDate = toDate ? new Date(toDate) : new Date();

    // 1. Calculate opening balance as of fromDate:
    // Initial opening from AccountMaster + net change from POSTED vouchers prior to fromDate
    const initialOpeningDr = new Decimal(account.openingDebit || 0);
    const initialOpeningCr = new Decimal(account.openingCredit || 0);
    let initialNet = account.normalBalance === 'DEBIT'
      ? initialOpeningDr.sub(initialOpeningCr)
      : initialOpeningCr.sub(initialOpeningDr);

    const priorAgg = await prisma.journalVoucherItem.aggregate({
      where: {
        companyId,
        accountId,
        voucher: {
          status: { in: ['POSTED', 'REVERSED'] },
          voucherDate: { lt: fDate },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const priorDr = new Decimal(priorAgg._sum.debitAmount || 0);
    const priorCr = new Decimal(priorAgg._sum.creditAmount || 0);
    const priorNet = account.normalBalance === 'DEBIT'
      ? priorDr.sub(priorCr)
      : priorCr.sub(priorDr);

    const openingBalance = initialNet.add(priorNet);

    // 2. Fetch posted lines between fromDate and toDate
    const take = Math.min(Math.max(1, Number(limit) || 100), 500);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const [totalCount, items] = await Promise.all([
      prisma.journalVoucherItem.count({
        where: {
          companyId,
          accountId,
          voucher: {
            status: { in: ['POSTED', 'REVERSED'] },
            voucherDate: { gte: fDate, lte: tDate },
          },
        },
      }),
      prisma.journalVoucherItem.findMany({
        where: {
          companyId,
          accountId,
          voucher: {
            status: { in: ['POSTED', 'REVERSED'] },
            voucherDate: { gte: fDate, lte: tDate },
          },
        },
        orderBy: [
          { voucher: { voucherDate: 'asc' } },
          { sequenceNo: 'asc' },
          { id: 'asc' },
        ],
        skip,
        take,
        include: {
          voucher: {
            select: {
              id: true,
              voucherNo: true,
              voucherDate: true,
              voucherType: true,
              narration: true,
              referenceNo: true,
            },
          },
        },
      }),
    ]);

    // 3. Compute running balance and period totals
    let running = openingBalance;
    const lines = items.map((item) => {
      const dr = new Decimal(item.debitAmount);
      const cr = new Decimal(item.creditAmount);
      const change = account.normalBalance === 'DEBIT' ? dr.sub(cr) : cr.sub(dr);
      running = running.add(change);

      return {
        id: item.id,
        voucherId: item.voucherId,
        voucherNo: item.voucher.voucherNo,
        voucherDate: item.voucher.voucherDate,
        voucherType: item.voucher.voucherType,
        referenceNo: item.voucher.referenceNo,
        narration: item.narration || item.voucher.narration,
        debit: Number(dr),
        credit: Number(cr),
        runningBalance: Number(running),
      };
    });

    // 4. Period total aggregates
    const periodAgg = await prisma.journalVoucherItem.aggregate({
      where: {
        companyId,
        accountId,
        voucher: {
          status: { in: ['POSTED', 'REVERSED'] },
          voucherDate: { gte: fDate, lte: tDate },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const totalPeriodDr = new Decimal(periodAgg._sum.debitAmount || 0);
    const totalPeriodCr = new Decimal(periodAgg._sum.creditAmount || 0);
    const periodNet = account.normalBalance === 'DEBIT'
      ? totalPeriodDr.sub(totalPeriodCr)
      : totalPeriodCr.sub(totalPeriodDr);
    const closingBalance = openingBalance.add(periodNet);

    return {
      companyId,
      account: {
        id: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        normalBalance: account.normalBalance,
        groupName: account.group.groupName,
        category: account.group.category,
      },
      period: { fromDate: fDate, toDate: tDate },
      openingBalance: Number(openingBalance),
      totalDebit: Number(totalPeriodDr),
      totalCredit: Number(totalPeriodCr),
      closingBalance: Number(closingBalance),
      pagination: {
        page: Number(page),
        limit: take,
        totalCount,
        totalPages: Math.ceil(totalCount / take),
      },
      lines,
    };
  },

  // =========================================================================
  // 2. TRIAL BALANCE
  // =========================================================================
  /**
   * Trial Balance: Summary of opening, period movements, and closing balances for all accounts.
   * Total Debit must strictly equal Total Credit.
   */
  async getTrialBalance(companyId, query = {}) {
    if (!companyId) throw financialError('companyId is required.');

    const { fromDate, toDate, asOfDate } = query;
    const fDate = fromDate ? new Date(fromDate) : null;
    const tDate = toDate ? new Date(toDate) : (asOfDate ? new Date(asOfDate) : new Date());

    // 1. Fetch all active accounts with their group
    const accounts = await prisma.accountMaster.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { group: true },
      orderBy: [{ accountCode: 'asc' }],
    });

    // 2. Query aggregated period debits & credits by accountId
    const voucherFilter = {
      status: { in: ['POSTED', 'REVERSED'] },
      voucherDate: { lte: tDate },
    };
    if (fDate) {
      voucherFilter.voucherDate.gte = fDate;
    }

    const periodAgg = await prisma.journalVoucherItem.groupBy({
      by: ['accountId'],
      where: {
        companyId,
        voucher: voucherFilter,
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const periodMap = new Map();
    for (const row of periodAgg) {
      periodMap.set(row.accountId, {
        debit: new Decimal(row._sum.debitAmount || 0),
        credit: new Decimal(row._sum.creditAmount || 0),
      });
    }

    // 3. If fromDate is supplied, query prior transactions for opening balance
    let priorMap = new Map();
    if (fDate) {
      const priorAgg = await prisma.journalVoucherItem.groupBy({
        by: ['accountId'],
        where: {
          companyId,
          voucher: {
            status: { in: ['POSTED', 'REVERSED'] },
            voucherDate: { lt: fDate },
          },
        },
        _sum: { debitAmount: true, creditAmount: true },
      });
      for (const row of priorAgg) {
        priorMap.set(row.accountId, {
          debit: new Decimal(row._sum.debitAmount || 0),
          credit: new Decimal(row._sum.creditAmount || 0),
        });
      }
    }

    let grandTotalOpeningDr = new Decimal(0);
    let grandTotalOpeningCr = new Decimal(0);
    let grandTotalPeriodDr = new Decimal(0);
    let grandTotalPeriodCr = new Decimal(0);
    let grandTotalClosingDr = new Decimal(0);
    let grandTotalClosingCr = new Decimal(0);

    const rows = [];

    for (const acc of accounts) {
      const initialDr = new Decimal(acc.openingDebit || 0);
      const initialCr = new Decimal(acc.openingCredit || 0);

      // Prior movements if fromDate exists
      const prior = priorMap.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) };
      const openingNetDr = initialDr.add(prior.debit);
      const openingNetCr = initialCr.add(prior.credit);

      let openingBalanceDr = new Decimal(0);
      let openingBalanceCr = new Decimal(0);
      if (openingNetDr.gte(openingNetCr)) {
        openingBalanceDr = openingNetDr.sub(openingNetCr);
      } else {
        openingBalanceCr = openingNetCr.sub(openingNetDr);
      }

      // Period movements
      const period = periodMap.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) };
      const periodDr = period.debit;
      const periodCr = period.credit;

      // Closing balances
      const totalDr = openingBalanceDr.add(periodDr);
      const totalCr = openingBalanceCr.add(periodCr);

      let closingDr = new Decimal(0);
      let closingCr = new Decimal(0);
      if (totalDr.gte(totalCr)) {
        closingDr = totalDr.sub(totalCr);
      } else {
        closingCr = totalCr.sub(totalDr);
      }

      // Accumulate totals
      grandTotalOpeningDr = grandTotalOpeningDr.add(openingBalanceDr);
      grandTotalOpeningCr = grandTotalOpeningCr.add(openingBalanceCr);
      grandTotalPeriodDr = grandTotalPeriodDr.add(periodDr);
      grandTotalPeriodCr = grandTotalPeriodCr.add(periodCr);
      grandTotalClosingDr = grandTotalClosingDr.add(closingDr);
      grandTotalClosingCr = grandTotalClosingCr.add(closingCr);

      // Include in report if account has non-zero opening, movement or closing
      if (!closingDr.isZero() || !closingCr.isZero() || !periodDr.isZero() || !periodCr.isZero()) {
        rows.push({
          accountId: acc.id,
          accountCode: acc.accountCode,
          accountName: acc.accountName,
          category: acc.group.category,
          groupName: acc.group.groupName,
          openingDebit: Number(openingBalanceDr),
          openingCredit: Number(openingBalanceCr),
          periodDebit: Number(periodDr),
          periodCredit: Number(periodCr),
          closingDebit: Number(closingDr),
          closingCredit: Number(closingCr),
        });
      }
    }

    const difference = grandTotalClosingDr.sub(grandTotalClosingCr);
    const isReconciled = difference.abs().lt(0.01);

    return {
      companyId,
      asOfDate: tDate,
      fromDate: fDate,
      isReconciled,
      difference: Number(difference),
      totals: {
        openingDebit: Number(grandTotalOpeningDr),
        openingCredit: Number(grandTotalOpeningCr),
        periodDebit: Number(grandTotalPeriodDr),
        periodCredit: Number(grandTotalPeriodCr),
        closingDebit: Number(grandTotalClosingDr),
        closingCredit: Number(grandTotalClosingCr),
      },
      accounts: rows,
    };
  },

  // =========================================================================
  // 3. PROFIT & LOSS STATEMENT (INCOME STATEMENT)
  // =========================================================================
  /**
   * P&L: Summarizes Revenues (INCOME) and Expenses (EXPENSE) over a date range.
   * Net Profit = Total Income - Total Expense.
   */
  async getProfitAndLoss(companyId, query = {}) {
    if (!companyId) throw financialError('companyId is required.');

    const { fromDate, toDate } = query;
    const fDate = fromDate ? new Date(fromDate) : new Date(new Date().getFullYear(), 0, 1);
    const tDate = toDate ? new Date(toDate) : new Date();

    // 1. Fetch all accounts with group category INCOME or EXPENSE
    const accounts = await prisma.accountMaster.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        group: { category: { in: ['INCOME', 'EXPENSE'] } },
      },
      include: { group: true },
      orderBy: [{ accountCode: 'asc' }],
    });

    if (accounts.length === 0) {
      return {
        companyId,
        period: { fromDate: fDate, toDate: tDate },
        totalIncome: 0,
        totalExpense: 0,
        netProfit: 0,
        incomeGroups: [],
        expenseGroups: [],
      };
    }

    const accountIds = accounts.map((a) => a.id);

    // 2. Query period debits and credits from POSTED vouchers
    const movements = await prisma.journalVoucherItem.groupBy({
      by: ['accountId'],
      where: {
        companyId,
        accountId: { in: accountIds },
        voucher: {
          status: { in: ['POSTED', 'REVERSED'] },
          voucherDate: { gte: fDate, lte: tDate },
        },
      },
      _sum: { debitAmount: true, creditAmount: true },
    });

    const moveMap = new Map();
    for (const m of movements) {
      moveMap.set(m.accountId, {
        debit: new Decimal(m._sum.debitAmount || 0),
        credit: new Decimal(m._sum.creditAmount || 0),
      });
    }

    const incomeByGroup = {};
    const expenseByGroup = {};
    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);

    for (const acc of accounts) {
      const move = moveMap.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) };
      const category = acc.group.category;
      const grpName = acc.group.groupName;

      // For INCOME: Credit increases income, Debit decreases income
      // For EXPENSE: Debit increases expense, Credit decreases expense
      let netAmount = new Decimal(0);
      if (category === 'INCOME') {
        netAmount = move.credit.sub(move.debit);
        if (!netAmount.isZero()) {
          totalIncome = totalIncome.add(netAmount);
          if (!incomeByGroup[grpName]) incomeByGroup[grpName] = { groupName: grpName, total: new Decimal(0), accounts: [] };
          incomeByGroup[grpName].total = incomeByGroup[grpName].total.add(netAmount);
          incomeByGroup[grpName].accounts.push({
            accountId: acc.id,
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            amount: Number(netAmount),
          });
        }
      } else {
        netAmount = move.debit.sub(move.credit);
        if (!netAmount.isZero()) {
          totalExpense = totalExpense.add(netAmount);
          if (!expenseByGroup[grpName]) expenseByGroup[grpName] = { groupName: grpName, total: new Decimal(0), accounts: [] };
          expenseByGroup[grpName].total = expenseByGroup[grpName].total.add(netAmount);
          expenseByGroup[grpName].accounts.push({
            accountId: acc.id,
            accountCode: acc.accountCode,
            accountName: acc.accountName,
            amount: Number(netAmount),
          });
        }
      }
    }

    const netProfit = totalIncome.sub(totalExpense);

    return {
      companyId,
      period: { fromDate: fDate, toDate: tDate },
      totalIncome: Number(totalIncome),
      totalExpense: Number(totalExpense),
      netProfit: Number(netProfit),
      isProfit: netProfit.gte(0),
      incomeGroups: Object.values(incomeByGroup).map((g) => ({ ...g, total: Number(g.total) })),
      expenseGroups: Object.values(expenseByGroup).map((g) => ({ ...g, total: Number(g.total) })),
    };
  },

  // =========================================================================
  // 4. BALANCE SHEET
  // =========================================================================
  /**
   * Balance Sheet: Financial position at a given date (ASSET = LIABILITY + EQUITY).
   * Automatically incorporates Net Profit from P&L into Retained Earnings / Current Profit.
   */
  async getBalanceSheet(companyId, query = {}) {
    if (!companyId) throw financialError('companyId is required.');

    const asOf = query.asOfDate ? new Date(query.asOfDate) : new Date();

    // 1. Get Trial Balance as of this date
    const tb = await this.getTrialBalance(companyId, { asOfDate: asOf });

    // 2. Compute Net Profit up to this date
    const pl = await this.getProfitAndLoss(companyId, {
      fromDate: new Date(asOf.getFullYear(), 0, 1),
      toDate: asOf,
    });

    const assetGroups = {};
    const liabilityGroups = {};
    const equityGroups = {};

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let totalEquity = new Decimal(0);

    for (const row of tb.accounts) {
      const netDr = new Decimal(row.closingDebit);
      const netCr = new Decimal(row.closingCredit);
      const grp = row.groupName;

      if (row.category === 'ASSET') {
        const balance = netDr.sub(netCr);
        totalAssets = totalAssets.add(balance);
        if (!assetGroups[grp]) assetGroups[grp] = { groupName: grp, total: new Decimal(0), accounts: [] };
        assetGroups[grp].total = assetGroups[grp].total.add(balance);
        assetGroups[grp].accounts.push({ ...row, balance: Number(balance) });
      } else if (row.category === 'LIABILITY') {
        const balance = netCr.sub(netDr);
        totalLiabilities = totalLiabilities.add(balance);
        if (!liabilityGroups[grp]) liabilityGroups[grp] = { groupName: grp, total: new Decimal(0), accounts: [] };
        liabilityGroups[grp].total = liabilityGroups[grp].total.add(balance);
        liabilityGroups[grp].accounts.push({ ...row, balance: Number(balance) });
      } else if (row.category === 'EQUITY') {
        const balance = netCr.sub(netDr);
        totalEquity = totalEquity.add(balance);
        if (!equityGroups[grp]) equityGroups[grp] = { groupName: grp, total: new Decimal(0), accounts: [] };
        equityGroups[grp].total = equityGroups[grp].total.add(balance);
        equityGroups[grp].accounts.push({ ...row, balance: Number(balance) });
      }
    }

    // Add Current Period Net Profit to Equity
    const netProfitDec = new Decimal(pl.netProfit || 0);
    totalEquity = totalEquity.add(netProfitDec);

    const currentEarningsGroup = 'Current Period Retained Earnings';
    if (!equityGroups[currentEarningsGroup]) {
      equityGroups[currentEarningsGroup] = { groupName: currentEarningsGroup, total: new Decimal(0), accounts: [] };
    }
    equityGroups[currentEarningsGroup].total = equityGroups[currentEarningsGroup].total.add(netProfitDec);
    equityGroups[currentEarningsGroup].accounts.push({
      accountId: 'CURRENT-PERIOD-PL',
      accountCode: 'PL-RET-EARN',
      accountName: 'Current Period Profit / (Loss)',
      category: 'EQUITY',
      balance: Number(netProfitDec),
    });

    const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);
    const imbalance = totalAssets.sub(totalLiabilitiesAndEquity);
    const isBalanced = imbalance.abs().lt(0.01);

    return {
      companyId,
      asOfDate: asOf,
      isBalanced,
      imbalance: Number(imbalance),
      totalAssets: Number(totalAssets),
      totalLiabilities: Number(totalLiabilities),
      totalEquity: Number(totalEquity),
      totalLiabilitiesAndEquity: Number(totalLiabilitiesAndEquity),
      assets: Object.values(assetGroups).map((g) => ({ ...g, total: Number(g.total) })),
      liabilities: Object.values(liabilityGroups).map((g) => ({ ...g, total: Number(g.total) })),
      equity: Object.values(equityGroups).map((g) => ({ ...g, total: Number(g.total) })),
    };
  },

  // =========================================================================
  // 5. CASH BOOK
  // =========================================================================
  /**
   * Cash Book: Detailed register of all receipts and disbursements for Cash accounts.
   */
  async getCashBook(companyId, query = {}) {
    if (!companyId) throw financialError('companyId is required.');

    // Find cash account(s): controlType === 'CASH' or accountName containing Cash
    const cashAccounts = await prisma.accountMaster.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [
          { controlType: 'CASH' },
          { accountName: { contains: 'Cash' } },
          { group: { groupCode: 'CASH' } },
        ],
      },
    });

    if (cashAccounts.length === 0) {
      return {
        companyId,
        cashAccountsFound: 0,
        openingBalance: 0,
        totalReceipts: 0,
        totalPayments: 0,
        closingBalance: 0,
        entries: [],
      };
    }

    const cashAccountId = query.accountId || cashAccounts[0].id;
    return this.getGeneralLedger(companyId, cashAccountId, query);
  },
};

export default financialStatementsService;

