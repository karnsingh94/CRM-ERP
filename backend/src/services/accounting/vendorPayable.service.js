import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';
import voucherService from './voucher.service.js';
import standardAccountsService from './standardAccounts.service.js';
import allocationService from './allocation.service.js';
import auditService from '../audit.service.js';

const Decimal = Prisma.Decimal;

function payableError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export const vendorPayableService = {
  // =========================================================================
  // 1. PURCHASE BILL ACCOUNTING POSTING
  // =========================================================================

  async postPurchaseBill(companyId, billId, actor = {}) {
    const bill = await prisma.purchaseBill.findFirst({
      where: { id: billId, companyId },
      include: {
        order: { include: { vendor: true } },
      },
    });

    if (!bill) {
      throw payableError(`Purchase Bill not found with id ${billId}.`, 404);
    }

    const vendor = bill.order?.vendor;
    if (!vendor) {
      throw payableError(`Vendor details missing for Purchase Bill ${bill.billNo}.`);
    }

    // Check if journal entry already posted for this bill
    const existingVoucherItem = await prisma.journalVoucherItem.findFirst({
      where: { companyId, billId: bill.id },
      include: { voucher: true },
    });
    if (existingVoucherItem && existingVoucherItem.voucher?.status === 'POSTED') {
      throw payableError(`Purchase Bill ${bill.billNo} has already been posted to General Ledger (Voucher: ${existingVoucherItem.voucher.voucherNo}).`);
    }

    const creditorsAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_CREDITORS');
    const purchaseAccount = await standardAccountsService.ensureStandardAccount(companyId, 'PURCHASE_EXPENSE');

    const totalBillAmt = new Decimal(bill.totalAmount);
    const taxableAmt = new Decimal(bill.taxableAmount);
    const taxAmt = new Decimal(bill.taxAmount);

    // Determine GST split based on vendor GSTIN or state
    let isInterState = false;
    if (vendor.gstin && vendor.gstin.length >= 2) {
      isInterState = vendor.gstin.slice(0, 2) !== '08'; // Default Rajasthan "08"
    }

    const voucherItems = [
      // 1. Debit Purchase Expense
      {
        accountId: purchaseAccount.id,
        debitAmount: Number(taxableAmt),
        creditAmount: 0,
        narration: `Purchase expense on Bill ${bill.billNo} (${bill.vendorInvoiceNo})`,
      },
    ];

    // 2. Debit Input GST
    if (taxAmt.greaterThan(0)) {
      if (isInterState) {
        const inputIgst = await standardAccountsService.ensureStandardAccount(companyId, 'INPUT_IGST');
        voucherItems.push({
          accountId: inputIgst.id,
          debitAmount: Number(taxAmt),
          creditAmount: 0,
          narration: `Input IGST on Bill ${bill.billNo}`,
        });
      } else {
        const halfTax = taxAmt.div(2);
        const inputCgst = await standardAccountsService.ensureStandardAccount(companyId, 'INPUT_CGST');
        const inputSgst = await standardAccountsService.ensureStandardAccount(companyId, 'INPUT_SGST');
        voucherItems.push({
          accountId: inputCgst.id,
          debitAmount: Number(halfTax),
          creditAmount: 0,
          narration: `Input CGST on Bill ${bill.billNo}`,
        });
        voucherItems.push({
          accountId: inputSgst.id,
          debitAmount: Number(halfTax),
          creditAmount: 0,
          narration: `Input SGST on Bill ${bill.billNo}`,
        });
      }
    }

    // 3. Credit Sundry Creditors control account (with vendorId)
    voucherItems.push({
      accountId: creditorsAccount.id,
      vendorId: vendor.id,
      debitAmount: 0,
      creditAmount: Number(totalBillAmt),
      narration: `Purchase Bill ${bill.billNo} from ${vendor.name}`,
    });

    // Create & Post Voucher
    const draftVoucher = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: bill.invoiceDate,
        voucherType: 'PURCHASE',
        referenceType: 'PURCHASE_BILL',
        referenceId: bill.id,
        referenceNo: bill.billNo,
        narration: `Purchase Bill ${bill.billNo} dated ${bill.invoiceDate.toISOString().split('T')[0]} from ${vendor.name}`,
        items: voucherItems,
      },
      actor
    );

    const postedVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);

    await auditService.logAudit({
      companyId,
      actorId: actor.id || actor.userId || 'system',
      actorName: actor.name || 'Authorised Signatory',
      action: 'PURCHASE_BILL_POST',
      serviceCode: 'accounts_banking',
      moduleCode: 'vendor_payables',
      details: `POSTED Purchase Bill ${bill.billNo} to General Ledger. Amount: ₹${totalBillAmt.toFixed(2)}. Voucher: ${postedVoucher.voucherNo}.`,
    });

    return postedVoucher;
  },

  // =========================================================================
  // 2. RECORD VENDOR PAYMENT
  // =========================================================================

  async recordVendorPayment(companyId, data, actor = {}) {
    const {
      vendorId,
      paymentReceiptNo,
      paymentMode = 'BANK',
      amount,
      paymentDate = new Date(),
      bankAccountId,
      chequeOrReferenceNo,
      notes,
      allocations = [],
    } = data;

    if (!vendorId) {
      throw payableError('vendorId is required for vendor payment.');
    }

    const payAmt = new Decimal(amount || 0);
    if (payAmt.lessThanOrEqualTo(0)) {
      throw payableError('Payment amount must be greater than zero.');
    }

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });
    if (!vendor) {
      throw payableError(`Vendor not found with id ${vendorId}.`, 404);
    }

    const modeUpper = paymentMode.toUpperCase();
    let creditAccount;
    if (modeUpper === 'CASH') {
      creditAccount = await standardAccountsService.ensureStandardAccount(companyId, 'CASH');
    } else {
      creditAccount = await standardAccountsService.ensureStandardAccount(companyId, 'BANK');
    }

    const creditorsAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_CREDITORS');

    // Double-entry voucher lines:
    // Debit Sundry Creditors (vendorId)
    // Credit Bank / Cash
    const voucherItems = [
      {
        accountId: creditorsAccount.id,
        vendorId,
        debitAmount: Number(payAmt),
        creditAmount: 0,
        narration: `Payment to ${vendor.name} via ${modeUpper}`,
      },
      {
        accountId: creditAccount.id,
        debitAmount: 0,
        creditAmount: Number(payAmt),
        narration: `Funds disbursed via ${modeUpper} Ref: ${chequeOrReferenceNo || 'N/A'}`,
      },
    ];

    const resolvedPayNo = paymentReceiptNo
      ? paymentReceiptNo.trim().toUpperCase()
      : `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    return prisma.$transaction(async (tx) => {
      const payment = await tx.paymentReceipt.create({
        data: {
          companyId,
          paymentReceiptNo: resolvedPayNo,
          paymentType: 'PAYMENT',
          vendorId,
          paymentMode: modeUpper,
          amount: payAmt,
          unallocatedAmount: payAmt,
          paymentDate: new Date(paymentDate),
          bankAccountId: bankAccountId || null,
          chequeOrReferenceNo: chequeOrReferenceNo || null,
          status: 'POSTED',
          notes: notes || null,
          createdById: actor.id || actor.userId || null,
        },
      });

      // Post General Ledger Voucher
      const draftVoucher = await voucherService.createDraftVoucher(
        companyId,
        {
          voucherDate: new Date(paymentDate),
          voucherType: 'PAYMENT',
          referenceType: 'VENDOR_PAYMENT',
          referenceId: payment.id,
          referenceNo: payment.paymentReceiptNo,
          narration: `Payment ${payment.paymentReceiptNo} to ${vendor.name} for ₹${payAmt.toFixed(2)}`,
          items: voucherItems,
        },
        actor
      );

      const postedVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);

      await tx.paymentReceipt.update({
        where: { id: payment.id },
        data: { voucherId: postedVoucher.id },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Accounts Officer',
        action: 'VENDOR_PAYMENT_POST',
        serviceCode: 'accounts_banking',
        moduleCode: 'vendor_payables',
        details: `Recorded Vendor Payment ${payment.paymentReceiptNo} to ${vendor.name} for ₹${payAmt.toFixed(2)}. Voucher: ${postedVoucher.voucherNo}.`,
      });

      return tx.paymentReceipt.findUnique({
        where: { id: payment.id },
        include: {
          vendor: true,
          voucher: { include: { items: { include: { account: true } } } },
          allocations: { include: { bill: true } },
        },
      });
    });

    // Auto-allocate if allocations provided (executed after payment transaction commits)
    if (allocations && allocations.length > 0) {
      for (const alloc of allocations) {
        await allocationService.allocatePayment(
          companyId,
          {
            paymentReceiptId: result.id,
            billId: alloc.billId,
            allocatedAmount: alloc.amount,
            notes: alloc.notes,
          },
          actor
        );
      }
      return prisma.paymentReceipt.findUnique({
        where: { id: result.id },
        include: {
          vendor: true,
          voucher: { include: { items: { include: { account: true } } } },
          allocations: { include: { bill: true } },
        },
      });
    }

    return result;
  },

  // =========================================================================
  // 3. VENDOR DEBIT NOTE INTEGRATION
  // =========================================================================

  async createVendorDebitNote(companyId, data, actor = {}) {
    const {
      debitNoteNo,
      vendorId,
      purchaseBillId,
      debitNoteDate = new Date(),
      taxableAmount = 0,
      cgstAmount = 0,
      sgstAmount = 0,
      igstAmount = 0,
      totalAmount,
      reason,
      notes,
    } = data;

    if (!vendorId) throw payableError('vendorId is required for Vendor Debit Note.');

    const vendor = await prisma.vendor.findFirst({
      where: { id: vendorId, companyId },
    });
    if (!vendor) throw payableError(`Vendor not found with id ${vendorId}.`, 404);

    let bill = null;
    if (purchaseBillId) {
      bill = await prisma.purchaseBill.findFirst({
        where: { id: purchaseBillId, companyId },
      });
      if (!bill) throw payableError(`Purchase Bill not found with id ${purchaseBillId}.`, 404);
    }

    const tTaxable = new Decimal(taxableAmount || 0);
    const tCgst = new Decimal(cgstAmount || 0);
    const tSgst = new Decimal(sgstAmount || 0);
    const tIgst = new Decimal(igstAmount || 0);
    const calculatedTotal = tTaxable.add(tCgst).add(tSgst).add(tIgst);
    const finalTotal = totalAmount ? new Decimal(totalAmount) : calculatedTotal;

    if (finalTotal.lessThanOrEqualTo(0)) {
      throw payableError('Debit Note total must be greater than zero.');
    }

    const resolvedDnNo = debitNoteNo
      ? debitNoteNo.trim().toUpperCase()
      : `VDN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const existing = await prisma.vendorDebitNote.findFirst({
      where: { companyId, debitNoteNo: resolvedDnNo },
    });
    if (existing) throw payableError(`Vendor Debit Note with number '${resolvedDnNo}' already exists.`);

    const creditorsAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_CREDITORS');
    const purchaseAccount = await standardAccountsService.ensureStandardAccount(companyId, 'PURCHASE_EXPENSE');

    // Debit Note Accounting lines:
    // Debit: Sundry Creditors (reduces vendor liability)
    // Credit: Purchase Expense / Input Tax Reversal
    const voucherItems = [
      {
        accountId: creditorsAccount.id,
        vendorId,
        debitAmount: Number(finalTotal),
        creditAmount: 0,
        narration: `Vendor Debit Note ${resolvedDnNo} to ${vendor.name}`,
      },
      {
        accountId: purchaseAccount.id,
        debitAmount: 0,
        creditAmount: Number(tTaxable),
        narration: `Purchase adjustment/return on ${resolvedDnNo}`,
      },
    ];

    if (tCgst.greaterThan(0)) {
      const inpCgst = await standardAccountsService.ensureStandardAccount(companyId, 'INPUT_CGST');
      voucherItems.push({
        accountId: inpCgst.id,
        debitAmount: 0,
        creditAmount: Number(tCgst),
        narration: `Input CGST reversal on ${resolvedDnNo}`,
      });
    }

    if (tSgst.greaterThan(0)) {
      const inpSgst = await standardAccountsService.ensureStandardAccount(companyId, 'INPUT_SGST');
      voucherItems.push({
        accountId: inpSgst.id,
        debitAmount: 0,
        creditAmount: Number(tSgst),
        narration: `Input SGST reversal on ${resolvedDnNo}`,
      });
    }

    if (tIgst.greaterThan(0)) {
      const inpIgst = await standardAccountsService.ensureStandardAccount(companyId, 'INPUT_IGST');
      voucherItems.push({
        accountId: inpIgst.id,
        debitAmount: 0,
        creditAmount: Number(tIgst),
        narration: `Input IGST reversal on ${resolvedDnNo}`,
      });
    }

    return prisma.$transaction(async (tx) => {
      const dn = await tx.vendorDebitNote.create({
        data: {
          companyId,
          debitNoteNo: resolvedDnNo,
          vendorId,
          purchaseBillId: purchaseBillId || null,
          debitNoteDate: new Date(debitNoteDate),
          taxableAmount: tTaxable,
          cgstAmount: tCgst,
          sgstAmount: tSgst,
          igstAmount: tIgst,
          totalAmount: finalTotal,
          reason: reason || 'Purchase return / Price revision',
          status: 'POSTED',
          notes: notes || null,
        },
      });

      const draftVoucher = await voucherService.createDraftVoucher(
        companyId,
        {
          voucherDate: new Date(debitNoteDate),
          voucherType: 'DEBIT_NOTE',
          referenceType: 'VENDOR_DEBIT_NOTE',
          referenceId: dn.id,
          referenceNo: dn.debitNoteNo,
          narration: `Vendor Debit Note ${dn.debitNoteNo} for ${vendor.name}`,
          items: voucherItems,
        },
        actor
      );

      const postedVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);

      await tx.vendorDebitNote.update({
        where: { id: dn.id },
        data: { voucherId: postedVoucher.id },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Commercial Officer',
        action: 'VENDOR_DEBIT_NOTE_POST',
        serviceCode: 'accounts_banking',
        moduleCode: 'vendor_payables',
        details: `POSTED Vendor Debit Note ${dn.debitNoteNo} to ${vendor.name} for ₹${finalTotal.toFixed(2)}. Voucher: ${postedVoucher.voucherNo}.`,
      });

      return tx.vendorDebitNote.findUnique({
        where: { id: dn.id },
        include: { vendor: true, purchaseBill: true },
      });
    });
  },

  // =========================================================================
  // 4. LIST & DETAILS
  // =========================================================================

  async listVendorBills(companyId, filters = {}) {
    const { vendorId, status, paymentHold, page = 1, limit = 25 } = filters;
    const where = { companyId };
    if (vendorId) where.order = { vendorId };
    if (status) where.status = status;
    if (paymentHold !== undefined) where.paymentHold = Boolean(paymentHold);

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, bills] = await Promise.all([
      prisma.purchaseBill.count({ where }),
      prisma.purchaseBill.findMany({
        where,
        skip,
        take,
        orderBy: { invoiceDate: 'desc' },
        include: {
          order: { include: { vendor: true } },
          paymentAllocations: { where: { status: 'ACTIVE' } },
          debitNotes: { where: { status: 'POSTED' } },
        },
      }),
    ]);

    const formattedBills = bills.map((b) => {
      const allocated = b.paymentAllocations.reduce((sum, a) => sum.add(new Decimal(a.allocatedAmount)), new Decimal(0));
      const dnTotal = b.debitNotes.reduce((sum, dn) => sum.add(new Decimal(dn.totalAmount)), new Decimal(0));
      const totalAmt = new Decimal(b.totalAmount);
      const outstanding = Decimal.max(0, totalAmt.sub(allocated).sub(dnTotal));
      return {
        ...b,
        vendor: b.order?.vendor,
        allocatedAmount: allocated,
        debitNotesTotal: dnTotal,
        outstandingAmount: outstanding,
      };
    });

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take),
      bills: formattedBills,
    };
  },

  async getVendorBillDetails(companyId, billId) {
    const bill = await prisma.purchaseBill.findFirst({
      where: { id: billId, companyId },
      include: {
        order: { include: { vendor: true } },
        paymentAllocations: {
          where: { status: 'ACTIVE' },
          include: { paymentReceipt: true },
        },
        debitNotes: true,
        voucherItems: { include: { voucher: true } },
      },
    });

    if (!bill) throw payableError(`Purchase Bill not found with id ${billId}.`, 404);

    const allocated = bill.paymentAllocations.reduce((sum, a) => sum.add(new Decimal(a.allocatedAmount)), new Decimal(0));
    const dnTotal = bill.debitNotes.reduce((sum, dn) => sum.add(new Decimal(dn.totalAmount)), new Decimal(0));
    const totalAmt = new Decimal(bill.totalAmount);
    const outstanding = Decimal.max(0, totalAmt.sub(allocated).sub(dnTotal));

    return {
      ...bill,
      vendor: bill.order?.vendor,
      allocatedAmount: allocated,
      debitNotesTotal: dnTotal,
      outstandingAmount: outstanding,
    };
  },
};

export default vendorPayableService;
