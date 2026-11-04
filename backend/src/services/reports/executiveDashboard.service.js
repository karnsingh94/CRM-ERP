import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

export const executiveDashboardService = {
  /**
   * Executive Management Dashboard KPIs
   * Computes high-level business indicators from verified database records.
   */
  async getExecutiveKpis(companyId, query = {}) {
    if (!companyId) {
      const err = new Error('companyId is required.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Execute parallel aggregates for tenant isolation
    const [
      salesOrderAgg,
      invoiceAgg,
      purchaseOrderAgg,
      billAgg,
      cashBankAccounts,
      stockAgg,
      dispatchAgg,
      returnAgg,
      latestPayroll,
      solarAgg,
      openTicketsCount,
    ] = await Promise.all([
      // 1. Sales Orders: active orders and monthly value
      prisma.salesOrder.aggregate({
        where: { companyId, status: { notIn: ['CANCELLED', 'DRAFT'] } },
        _count: { id: true },
        _sum: { amount: true },
      }),

      // 2. Receivables: Sales Invoices outstanding
      prisma.salesInvoice.aggregate({
        where: { companyId, status: { in: ['POSTED', 'PARTIALLY_PAID'] } },
        _count: { id: true },
        _sum: { totalAmount: true, paidAmount: true, outstandingAmount: true },
      }),

      // 3. Purchase Orders
      prisma.purchaseOrder.aggregate({
        where: { companyId, status: { notIn: ['CANCELLED', 'DRAFT'] } },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),

      // 4. Payables: Purchase Bills outstanding
      prisma.purchaseBill.aggregate({
        where: { companyId, status: { in: ['POSTED', 'UNPAID', 'PARTIALLY_PAID'] } },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),

      // 5. Cash & Bank balances from General Ledger control accounts
      prisma.accountMaster.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          controlType: { in: ['CASH', 'BANK'] },
        },
        select: {
          id: true,
          controlType: true,
          currentBalance: true,
          openingDebit: true,
          openingCredit: true,
        },
      }),

      // 6. Available Inventory Valuation
      prisma.inventoryStock.findMany({
        where: { companyId },
        select: { availableQty: true, averageCost: true, stock: true },
      }),

      // 7. Dispatch Summary
      prisma.dispatchOrder.aggregate({
        where: { companyId, status: { in: ['DISPATCHED', 'DELIVERED', 'IN_TRANSIT'] } },
        _count: { id: true },
        _sum: { totalDispatchedAmount: true, totalPackages: true },
      }),

      // 8. Returns & Credit Notes
      prisma.customerCreditNote.aggregate({
        where: { companyId, status: { not: 'CANCELLED' } },
        _count: { id: true },
        _sum: { netCreditAmount: true },
      }),

      // 9. Latest Monthly Payroll Cost
      prisma.payrollBatch.findFirst({
        where: { companyId, status: { in: ['APPROVED', 'PAID', 'LOCKED'] } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        select: { batchNumber: true, totalGross: true, totalNet: true, month: true, year: true },
      }),

      // 10. Solar Generation Today
      prisma.solarTelemetryLog.aggregate({
        where: { companyId, timestamp: { gte: startOfDay } },
        _sum: { dailyEnergyKwh: true, currentPowerKw: true },
      }),

      // 11. Open Solar Maintenance Tickets
      prisma.solarMaintenanceTicket.count({
        where: { companyId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
      }),
    ]);

    // Calculate Cash & Bank total balance including posted movements
    const cashBankIds = cashBankAccounts.map((a) => a.id);
    const cashBankMovements = cashBankIds.length > 0 ? await prisma.journalVoucherItem.groupBy({
      by: ['accountId'],
      where: {
        companyId,
        accountId: { in: cashBankIds },
        voucher: { status: { in: ['POSTED', 'REVERSED'] } },
      },
      _sum: { debitAmount: true, creditAmount: true },
    }) : [];

    const cashBankMoveMap = new Map();
    for (const m of cashBankMovements) {
      cashBankMoveMap.set(m.accountId, new Decimal(m._sum.debitAmount || 0).sub(new Decimal(m._sum.creditAmount || 0)));
    }

    let totalCashAndBank = new Decimal(0);
    for (const acc of cashBankAccounts) {
      const open = new Decimal(acc.openingDebit || 0).sub(new Decimal(acc.openingCredit || 0));
      const move = cashBankMoveMap.get(acc.id) || new Decimal(0);
      totalCashAndBank = totalCashAndBank.add(open.add(move));
    }

    // Calculate Available Stock Valuation
    let totalStockValuation = new Decimal(0);
    let totalAvailableUnits = 0;
    for (const st of stockAgg) {
      totalAvailableUnits += st.availableQty || 0;
      const itemVal = new Decimal(st.availableQty || 0).mul(new Decimal(st.averageCost || 0));
      totalStockValuation = totalStockValuation.add(itemVal);
    }

    // Payables: Total billed - Total paid
    const totalBillsAmount = new Decimal(billAgg._sum.totalAmount || 0);
    const totalBillsPaid = new Decimal(billAgg._sum.paidAmount || 0);
    const totalPayables = totalBillsAmount.sub(totalBillsPaid);

    return {
      companyId,
      timestamp: now,
      sales: {
        totalOrdersCount: salesOrderAgg._count.id,
        totalOrderValue: Number(salesOrderAgg._sum.amount || 0),
        totalInvoicedAmount: Number(invoiceAgg._sum.totalAmount || 0),
        receivablesOutstanding: Number(invoiceAgg._sum.outstandingAmount || 0),
      },
      purchases: {
        totalOrdersCount: purchaseOrderAgg._count.id,
        totalOrderValue: Number(purchaseOrderAgg._sum.totalAmount || 0),
        totalBilledAmount: Number(totalBillsAmount),
        payablesOutstanding: Number(totalPayables),
      },
      treasury: {
        cashAndBankBalance: Number(totalCashAndBank),
        activeCashBankAccounts: cashBankAccounts.length,
      },
      inventory: {
        totalAvailableStockUnits: totalAvailableUnits,
        availableStockValuation: Number(totalStockValuation),
      },
      dispatch: {
        activeDispatchesCount: dispatchAgg._count.id,
        totalDispatchedValue: Number(dispatchAgg._sum.totalDispatchedAmount || 0),
        totalPackages: dispatchAgg._sum.totalPackages || 0,
      },
      returns: {
        totalCreditNotesIssued: returnAgg._count.id,
        totalCreditAmount: Number(returnAgg._sum.netCreditAmount || 0),
      },
      payroll: {
        latestBatch: latestPayroll?.batchNumber || null,
        latestPayrollMonth: latestPayroll ? `${latestPayroll.month}/${latestPayroll.year}` : null,
        totalGrossPay: Number(latestPayroll?.totalGross || 0),
        totalNetPay: Number(latestPayroll?.totalNet || 0),
      },
      solar: {
        energyGeneratedTodayKwh: Number(solarAgg._sum.dailyEnergyKwh || 0),
        currentActivePowerKw: Number(solarAgg._sum.currentPowerKw || 0),
        openMaintenanceTicketsCount: openTicketsCount,
      },
    };
  },
};

export default executiveDashboardService;
