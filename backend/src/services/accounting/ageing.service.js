import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

export const ageingService = {
  // =========================================================================
  // 1. CUSTOMER OUTSTANDING & AGEING
  // =========================================================================

  async getCustomerAgeing(companyId, customerId = null, asOf = new Date()) {
    const asOfDate = new Date(asOf);

    const where = {
      companyId,
      status: { in: ['POSTED', 'PARTIALLY_PAID'] },
      outstandingAmount: { gt: 0 },
    };
    if (customerId) where.customerId = customerId;

    const invoices = await prisma.salesInvoice.findMany({
      where,
      orderBy: { invoiceDate: 'asc' },
      include: {
        customer: { select: { id: true, companyName: true, phone: true, gstin: true } },
      },
    });

    // Buckets: current (not yet due), 0-30, 31-60, 61-90, 90+
    const summary = {
      totalOutstanding: new Decimal(0),
      current: new Decimal(0), // not yet overdue
      bucket_0_30: new Decimal(0),
      bucket_31_60: new Decimal(0),
      bucket_61_90: new Decimal(0),
      bucket_90_plus: new Decimal(0),
      byCustomer: {},
    };

    for (const inv of invoices) {
      const outstanding = new Decimal(inv.outstandingAmount);
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.invoiceDate);
      const diffMs = asOfDate.getTime() - dueDate.getTime();
      const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      summary.totalOutstanding = summary.totalOutstanding.add(outstanding);

      let bucketKey = 'current';
      if (overdueDays <= 0) {
        summary.current = summary.current.add(outstanding);
        bucketKey = 'current';
      } else if (overdueDays <= 30) {
        summary.bucket_0_30 = summary.bucket_0_30.add(outstanding);
        bucketKey = 'bucket_0_30';
      } else if (overdueDays <= 60) {
        summary.bucket_31_60 = summary.bucket_31_60.add(outstanding);
        bucketKey = 'bucket_31_60';
      } else if (overdueDays <= 90) {
        summary.bucket_61_90 = summary.bucket_61_90.add(outstanding);
        bucketKey = 'bucket_61_90';
      } else {
        summary.bucket_90_plus = summary.bucket_90_plus.add(outstanding);
        bucketKey = 'bucket_90_plus';
      }

      const cId = inv.customerId;
      if (!summary.byCustomer[cId]) {
        summary.byCustomer[cId] = {
          customerId: cId,
          customerName: inv.customerName,
          gstin: inv.customerGstin,
          totalOutstanding: new Decimal(0),
          current: new Decimal(0),
          bucket_0_30: new Decimal(0),
          bucket_31_60: new Decimal(0),
          bucket_61_90: new Decimal(0),
          bucket_90_plus: new Decimal(0),
          invoices: [],
        };
      }

      summary.byCustomer[cId].totalOutstanding = summary.byCustomer[cId].totalOutstanding.add(outstanding);
      summary.byCustomer[cId][bucketKey] = summary.byCustomer[cId][bucketKey].add(outstanding);
      summary.byCustomer[cId].invoices.push({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        overdueDays,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        outstandingAmount: inv.outstandingAmount,
        bucket: bucketKey,
      });
    }

    return {
      asOfDate,
      summary: {
        totalOutstanding: summary.totalOutstanding,
        current: summary.current,
        bucket_0_30: summary.bucket_0_30,
        bucket_31_60: summary.bucket_31_60,
        bucket_61_90: summary.bucket_61_90,
        bucket_90_plus: summary.bucket_90_plus,
      },
      customers: Object.values(summary.byCustomer),
    };
  },

  // =========================================================================
  // 2. VENDOR OUTSTANDING & AGEING
  // =========================================================================

  async getVendorAgeing(companyId, vendorId = null, asOf = new Date()) {
    const asOfDate = new Date(asOf);

    const where = {
      companyId,
      status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
    };
    if (vendorId) where.order = { vendorId };

    const bills = await prisma.purchaseBill.findMany({
      where,
      orderBy: { invoiceDate: 'asc' },
      include: {
        order: { include: { vendor: true } },
        paymentAllocations: { where: { status: 'ACTIVE' } },
        debitNotes: { where: { status: 'POSTED' } },
      },
    });

    const summary = {
      totalOutstanding: new Decimal(0),
      current: new Decimal(0),
      bucket_0_30: new Decimal(0),
      bucket_31_60: new Decimal(0),
      bucket_61_90: new Decimal(0),
      bucket_90_plus: new Decimal(0),
      byVendor: {},
    };

    for (const bill of bills) {
      const allocated = bill.paymentAllocations.reduce((sum, a) => sum.add(new Decimal(a.allocatedAmount)), new Decimal(0));
      const dnTotal = bill.debitNotes.reduce((sum, dn) => sum.add(new Decimal(dn.totalAmount)), new Decimal(0));
      const totalBill = new Decimal(bill.totalAmount);
      const outstanding = totalBill.sub(allocated).sub(dnTotal);

      if (outstanding.lessThanOrEqualTo(0)) continue;

      const dueDate = bill.dueDate ? new Date(bill.dueDate) : new Date(bill.invoiceDate);
      const diffMs = asOfDate.getTime() - dueDate.getTime();
      const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      summary.totalOutstanding = summary.totalOutstanding.add(outstanding);

      let bucketKey = 'current';
      if (overdueDays <= 0) {
        summary.current = summary.current.add(outstanding);
        bucketKey = 'current';
      } else if (overdueDays <= 30) {
        summary.bucket_0_30 = summary.bucket_0_30.add(outstanding);
        bucketKey = 'bucket_0_30';
      } else if (overdueDays <= 60) {
        summary.bucket_31_60 = summary.bucket_31_60.add(outstanding);
        bucketKey = 'bucket_31_60';
      } else if (overdueDays <= 90) {
        summary.bucket_61_90 = summary.bucket_61_90.add(outstanding);
        bucketKey = 'bucket_61_90';
      } else {
        summary.bucket_90_plus = summary.bucket_90_plus.add(outstanding);
        bucketKey = 'bucket_90_plus';
      }

      const vId = bill.order?.vendorId || 'UNKNOWN';
      const vName = bill.order?.vendor?.name || 'Unknown Vendor';

      if (!summary.byVendor[vId]) {
        summary.byVendor[vId] = {
          vendorId: vId,
          vendorName: vName,
          totalOutstanding: new Decimal(0),
          current: new Decimal(0),
          bucket_0_30: new Decimal(0),
          bucket_31_60: new Decimal(0),
          bucket_61_90: new Decimal(0),
          bucket_90_plus: new Decimal(0),
          bills: [],
        };
      }

      summary.byVendor[vId].totalOutstanding = summary.byVendor[vId].totalOutstanding.add(outstanding);
      summary.byVendor[vId][bucketKey] = summary.byVendor[vId][bucketKey].add(outstanding);
      summary.byVendor[vId].bills.push({
        id: bill.id,
        billNo: bill.billNo,
        vendorInvoiceNo: bill.vendorInvoiceNo,
        invoiceDate: bill.invoiceDate,
        dueDate: bill.dueDate,
        overdueDays,
        totalAmount: bill.totalAmount,
        allocatedAmount: allocated,
        debitNotesTotal: dnTotal,
        outstandingAmount: outstanding,
        paymentHold: bill.paymentHold,
        holdReason: bill.holdReason,
        bucket: bucketKey,
      });
    }

    return {
      asOfDate,
      summary: {
        totalOutstanding: summary.totalOutstanding,
        current: summary.current,
        bucket_0_30: summary.bucket_0_30,
        bucket_31_60: summary.bucket_31_60,
        bucket_61_90: summary.bucket_61_90,
        bucket_90_plus: summary.bucket_90_plus,
      },
      vendors: Object.values(summary.byVendor),
    };
  },

  // =========================================================================
  // 3. STATEMENTS (CUSTOMER & VENDOR LEDGER)
  // =========================================================================

  async getCustomerStatement(companyId, customerId, fromDate, toDate) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) throw new Error(`Customer not found with id ${customerId}`);

    const fDate = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const tDate = toDate ? new Date(toDate) : new Date();

    // Opening balance before fDate
    const [priorInvoices, priorReceipts, priorCreditNotes] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { companyId, customerId, status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID'] }, invoiceDate: { lt: fDate } },
      }),
      prisma.paymentReceipt.findMany({
        where: { companyId, customerId, status: 'POSTED', paymentDate: { lt: fDate } },
      }),
      prisma.customerCreditNote.findMany({
        where: { companyId, customerId, status: 'ISSUED', createdAt: { lt: fDate } },
      }),
    ]);

    const priorInvTotal = priorInvoices.reduce((s, i) => s.add(new Decimal(i.totalAmount)), new Decimal(0));
    const priorRctTotal = priorReceipts.reduce((s, r) => s.add(new Decimal(r.amount)), new Decimal(0));
    const priorCnTotal = priorCreditNotes.reduce((s, c) => s.add(new Decimal(c.netCreditAmount)), new Decimal(0));
    const openingBalance = priorInvTotal.sub(priorRctTotal).sub(priorCnTotal);

    // Transactions in period
    const [periodInvoices, periodReceipts, periodCreditNotes] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { companyId, customerId, status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID'] }, invoiceDate: { gte: fDate, lte: tDate } },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.paymentReceipt.findMany({
        where: { companyId, customerId, status: 'POSTED', paymentDate: { gte: fDate, lte: tDate } },
        orderBy: { paymentDate: 'asc' },
      }),
      prisma.customerCreditNote.findMany({
        where: { companyId, customerId, status: 'ISSUED', createdAt: { gte: fDate, lte: tDate } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const entries = [];
    periodInvoices.forEach((i) => {
      entries.push({
        date: i.invoiceDate,
        type: 'INVOICE',
        referenceNo: i.invoiceNo,
        description: `Sales Invoice - ${i.customerName}`,
        debit: new Decimal(i.totalAmount),
        credit: new Decimal(0),
      });
    });

    periodReceipts.forEach((r) => {
      entries.push({
        date: r.paymentDate,
        type: 'RECEIPT',
        referenceNo: r.paymentReceiptNo,
        description: `Payment Receipt (${r.paymentMode})`,
        debit: new Decimal(0),
        credit: new Decimal(r.amount),
      });
    });

    periodCreditNotes.forEach((c) => {
      entries.push({
        date: c.createdAt,
        type: 'CREDIT_NOTE',
        referenceNo: c.creditNoteNo,
        description: `Credit Note - ${c.reason || 'Sales Return'}`,
        debit: new Decimal(0),
        credit: new Decimal(c.netCreditAmount),
      });
    });

    // Sort chronologically
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = new Decimal(openingBalance);
    const ledger = entries.map((entry) => {
      runningBalance = runningBalance.add(entry.debit).sub(entry.credit);
      return {
        ...entry,
        runningBalance,
      };
    });

    return {
      customer: { id: customer.id, name: customer.companyName, gstin: customer.gstin },
      fromDate: fDate,
      toDate: tDate,
      openingBalance,
      closingBalance: runningBalance,
      statement: ledger,
    };
  },

  async getVendorStatement(companyId, vendorId, fromDate, toDate) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });
    if (!vendor) throw new Error(`Vendor not found with id ${vendorId}`);

    const fDate = fromDate ? new Date(fromDate) : new Date('2000-01-01');
    const tDate = toDate ? new Date(toDate) : new Date();

    const [priorBills, priorPayments, priorDebitNotes] = await Promise.all([
      prisma.purchaseBill.findMany({
        where: { companyId, order: { vendorId }, invoiceDate: { lt: fDate } },
      }),
      prisma.paymentReceipt.findMany({
        where: { companyId, vendorId, paymentType: 'PAYMENT', status: 'POSTED', paymentDate: { lt: fDate } },
      }),
      prisma.vendorDebitNote.findMany({
        where: { companyId, vendorId, status: 'POSTED', debitNoteDate: { lt: fDate } },
      }),
    ]);

    const priorBillTotal = priorBills.reduce((s, b) => s.add(new Decimal(b.totalAmount)), new Decimal(0));
    const priorPayTotal = priorPayments.reduce((s, p) => s.add(new Decimal(p.amount)), new Decimal(0));
    const priorDnTotal = priorDebitNotes.reduce((s, d) => s.add(new Decimal(d.totalAmount)), new Decimal(0));
    // For vendor: Bills are Credits (liabilities), Payments & Debit Notes are Debits (liability reductions)
    const openingBalance = priorBillTotal.sub(priorPayTotal).sub(priorDnTotal);

    const [periodBills, periodPayments, periodDebitNotes] = await Promise.all([
      prisma.purchaseBill.findMany({
        where: { companyId, order: { vendorId }, invoiceDate: { gte: fDate, lte: tDate } },
        orderBy: { invoiceDate: 'asc' },
      }),
      prisma.paymentReceipt.findMany({
        where: { companyId, vendorId, paymentType: 'PAYMENT', status: 'POSTED', paymentDate: { gte: fDate, lte: tDate } },
        orderBy: { paymentDate: 'asc' },
      }),
      prisma.vendorDebitNote.findMany({
        where: { companyId, vendorId, status: 'POSTED', debitNoteDate: { gte: fDate, lte: tDate } },
        orderBy: { debitNoteDate: 'asc' },
      }),
    ]);

    const entries = [];
    periodBills.forEach((b) => {
      entries.push({
        date: b.invoiceDate,
        type: 'BILL',
        referenceNo: b.billNo,
        description: `Purchase Bill (${b.vendorInvoiceNo})`,
        debit: new Decimal(0),
        credit: new Decimal(b.totalAmount),
      });
    });

    periodPayments.forEach((p) => {
      entries.push({
        date: p.paymentDate,
        type: 'PAYMENT',
        referenceNo: p.paymentReceiptNo,
        description: `Disbursement (${p.paymentMode})`,
        debit: new Decimal(p.amount),
        credit: new Decimal(0),
      });
    });

    periodDebitNotes.forEach((d) => {
      entries.push({
        date: d.debitNoteDate,
        type: 'DEBIT_NOTE',
        referenceNo: d.debitNoteNo,
        description: `Vendor Debit Note - ${d.reason || 'Return'}`,
        debit: new Decimal(d.totalAmount),
        credit: new Decimal(0),
      });
    });

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = new Decimal(openingBalance);
    const ledger = entries.map((entry) => {
      runningBalance = runningBalance.add(entry.credit).sub(entry.debit);
      return {
        ...entry,
        runningBalance,
      };
    });

    return {
      vendor: { id: vendor.id, name: vendor.name, gstin: vendor.gstin },
      fromDate: fDate,
      toDate: tDate,
      openingBalance,
      closingBalance: runningBalance,
      statement: ledger,
    };
  },
};

export default ageingService;
