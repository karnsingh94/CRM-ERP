import prisma from '../../config/prisma.js';
import { Prisma } from '@prisma/client';
import voucherService from './voucher.service.js';
import standardAccountsService from './standardAccounts.service.js';
import auditService from '../audit.service.js';

const Decimal = Prisma.Decimal;

function allocError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export const allocationService = {
  // =========================================================================
  // 1. ALLOCATE PAYMENT (CUSTOMER RECEIPT OR VENDOR PAYMENT)
  // =========================================================================

  async allocatePayment(companyId, data, actor = {}) {
    const {
      paymentReceiptId,
      invoiceId,
      billId,
      allocatedAmount,
      allocationDate = new Date(),
      notes,
    } = data;

    if (!paymentReceiptId) {
      throw allocError('paymentReceiptId is required for allocation.');
    }

    const allocAmt = new Decimal(allocatedAmount || 0);
    if (allocAmt.lessThanOrEqualTo(0)) {
      throw allocError('Allocated amount must be strictly greater than zero.');
    }

    // MANDATED INVARIANT 1: Strict Target XOR (Exactly one target: invoiceId OR billId, never both, never neither)
    if ((invoiceId && billId) || (!invoiceId && !billId)) {
      throw allocError('PaymentAllocation must target either a SalesInvoice OR a PurchaseBill, never both and never neither.', 422);
    }

    const targetType = invoiceId ? 'SALES_INVOICE' : 'PURCHASE_BILL';

    // Verify Payment Receipt
    const receipt = await prisma.paymentReceipt.findFirst({
      where: { id: paymentReceiptId, companyId },
    });
    if (!receipt) {
      throw allocError(`Payment Receipt not found with id ${paymentReceiptId}.`, 404);
    }

    if (receipt.status !== 'POSTED') {
      throw allocError(`Receipt ${receipt.paymentReceiptNo} is in ${receipt.status} status. Only POSTED receipts can be allocated.`);
    }

    const currentUnallocated = new Decimal(receipt.unallocatedAmount);
    if (allocAmt.greaterThan(currentUnallocated)) {
      throw allocError(
        `Allocation amount (₹${allocAmt.toFixed(2)}) exceeds available unallocated receipt amount (₹${currentUnallocated.toFixed(2)}).`
      );
    }

    const allocationResult = await prisma.$transaction(async (tx) => {
      // Re-fetch receipt with exclusive row-level lock (FOR UPDATE)
      const [lockedReceipt] = await tx.$queryRawUnsafe(
        'SELECT id, amount, unallocated_amount, payment_type FROM payment_receipts WHERE id = ? AND company_id = ? FOR UPDATE;',
        paymentReceiptId,
        companyId
      );
      if (!lockedReceipt) {
        throw allocError(`Payment Receipt not found with id ${paymentReceiptId}.`, 404);
      }
      const unalloc = new Decimal(lockedReceipt.unallocated_amount);
      if (allocAmt.greaterThan(unalloc)) {
        throw allocError(`Allocation amount (₹${allocAmt.toFixed(2)}) exceeds available unallocated receipt amount (₹${unalloc.toFixed(2)}).`);
      }

      let partyName = '';
      let targetRef = '';
      let invoice = null;

      // CASE A: CUSTOMER SALES INVOICE ALLOCATION
      if (invoiceId) {
        invoice = await tx.salesInvoice.findFirst({
          where: { id: invoiceId, companyId },
        });
        if (!invoice) {
          throw allocError(`Sales Invoice not found with id ${invoiceId}.`, 404);
        }

        // Party ownership check
        if (invoice.customerId !== receipt.customerId) {
          throw allocError(
            `Customer mismatch: Receipt customer (${receipt.customerId}) does not match Invoice customer (${invoice.customerId}). Cross-party allocation is strictly prohibited.`
          );
        }

        if (invoice.status !== 'POSTED' && invoice.status !== 'PARTIALLY_PAID') {
          throw allocError(`Invoice ${invoice.invoiceNo} is in ${invoice.status} status. Only POSTED or PARTIALLY_PAID invoices can receive payment.`);
        }

        const invoiceOutstanding = new Decimal(invoice.outstandingAmount);
        if (allocAmt.greaterThan(invoiceOutstanding)) {
          throw allocError(
            `Allocation amount (₹${allocAmt.toFixed(2)}) exceeds invoice outstanding balance (₹${invoiceOutstanding.toFixed(2)}).`
          );
        }

        const newPaid = new Decimal(invoice.paidAmount).add(allocAmt);
        const newOutstanding = invoiceOutstanding.sub(allocAmt);
        const newStatus = newOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';

        await tx.salesInvoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status: newStatus,
          },
        });

        partyName = invoice.customerName;
        targetRef = `Invoice ${invoice.invoiceNo}`;
      }

      // CASE B: VENDOR PURCHASE BILL ALLOCATION
      if (billId) {
        const bill = await tx.purchaseBill.findFirst({
          where: { id: billId, companyId },
          include: {
            order: { include: { vendor: true } },
            paymentAllocations: { where: { status: 'ACTIVE' } },
            debitNotes: { where: { status: 'POSTED' } },
          },
        });
        if (!bill) {
          throw allocError(`Purchase Bill not found with id ${billId}.`, 404);
        }

        // Party ownership check
        const billVendorId = bill.order?.vendorId;
        if (receipt.vendorId && billVendorId && receipt.vendorId !== billVendorId) {
          throw allocError(
            `Vendor mismatch: Payment vendor (${receipt.vendorId}) does not match Bill vendor (${billVendorId}).`
          );
        }

        // MANDATED INVARIANT: PAYMENT HOLD ENFORCEMENT
        if (bill.paymentHold) {
          throw allocError(
            `Payment Hold Enforced: Cannot allocate payment to Purchase Bill ${bill.billNo}. Hold Reason: ${bill.holdReason || 'Disputed / Pending clearance'}. Release hold before making payment.`,
            403
          );
        }

        // Calculate bill outstanding
        const existingAllocTotal = bill.paymentAllocations.reduce(
          (sum, a) => sum.add(new Decimal(a.allocatedAmount)),
          new Decimal(0)
        );
        const debitNotesTotal = bill.debitNotes.reduce(
          (sum, dn) => sum.add(new Decimal(dn.totalAmount)),
          new Decimal(0)
        );
        const billTotal = new Decimal(bill.totalAmount);
        const billOutstanding = billTotal.sub(existingAllocTotal).sub(debitNotesTotal);

        if (allocAmt.greaterThan(billOutstanding)) {
          throw allocError(
            `Allocation amount (₹${allocAmt.toFixed(2)}) exceeds bill outstanding balance (₹${billOutstanding.toFixed(2)}).`
          );
        }

        const newAllocatedTotal = existingAllocTotal.add(allocAmt);
        const newBillOutstanding = billTotal.sub(newAllocatedTotal).sub(debitNotesTotal);
        const newStatus = newBillOutstanding.isZero() ? 'PAID' : 'PARTIALLY_PAID';

        await tx.purchaseBill.update({
          where: { id: billId },
          data: {
            status: newStatus,
            paidAt: newBillOutstanding.isZero() ? new Date() : bill.paidAt,
          },
        });

        partyName = bill.order?.vendor?.name || 'Vendor';
        targetRef = `Purchase Bill ${bill.billNo}`;
      }

      // Deduct unallocated from receipt
      const remainingUnallocated = unalloc.sub(allocAmt);
      await tx.paymentReceipt.update({
        where: { id: paymentReceiptId },
        data: {
          unallocatedAmount: remainingUnallocated,
        },
      });

      // Create PaymentAllocation record
      const allocation = await tx.paymentAllocation.create({
        data: {
          companyId,
          paymentReceiptId,
          invoiceId: invoiceId || null,
          billId: billId || null,
          targetType,
          allocatedAmount: allocAmt,
          allocationDate: new Date(allocationDate),
          status: 'ACTIVE',
          notes: notes || null,
        },
      });

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Accounts Clerk',
        action: 'PAYMENT_ALLOCATION_CREATE',
        serviceCode: 'accounts_banking',
        moduleCode: 'payment_allocations',
        details: `Allocated ₹${allocAmt.toFixed(2)} from ${receipt.paymentReceiptNo} against ${targetRef} (${partyName}). Remaining unallocated: ₹${remainingUnallocated.toFixed(2)}.`,
      });

      return allocation;
    });

    // CASE A.1: CUSTOMER ADVANCE ADJUSTMENT GL VOUCHER
    // When an advance is allocated against a posted invoice, accounting requires:
    // Dr Customer Advances liability (reducing advance liability)
    // Cr Sundry Debtors (with customerId) (reducing trade receivable)
    if (receipt.paymentType === 'ADVANCE' && invoiceId) {
      try {
        const advAccount = await standardAccountsService.ensureStandardAccount(companyId, 'CUSTOMER_ADVANCES');
        const debtorsAccount = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_DEBTORS');

        const draftVoucher = await voucherService.createDraftVoucher(
          companyId,
          {
            voucherDate: new Date(allocationDate),
            voucherType: 'JOURNAL',
            referenceType: 'ADVANCE_ALLOCATION',
            referenceId: allocationResult.id,
            referenceNo: receipt.paymentReceiptNo,
            narration: `Advance settlement from ${receipt.paymentReceiptNo} against Invoice ${invoiceId}`,
            items: [
              {
                accountId: advAccount.id,
                debitAmount: Number(allocAmt),
                creditAmount: 0,
                narration: `Debit Customer Advances liability on settlement`,
              },
              {
                accountId: debtorsAccount.id,
                customerId: receipt.customerId,
                debitAmount: 0,
                creditAmount: Number(allocAmt),
                narration: `Credit Sundry Debtors on advance settlement`,
              },
            ],
          },
          actor
        );

        const adjVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);

        await prisma.paymentAllocation.update({
          where: { id: allocationResult.id },
          data: {
            notes: `[VOUCHER:${adjVoucher.id}] ${notes || ''}`.trim(),
          },
        });
      } catch (voucherErr) {
        // Roll back the allocation if voucher creation fails
        await this.reverseAllocation(companyId, allocationResult.id, `Failed to post adjustment voucher: ${voucherErr.message}`, actor);
        throw voucherErr;
      }
    }

    return allocationResult;
  },

  // =========================================================================
  // 2. REVERSE PAYMENT ALLOCATION (AUDITED ROLLBACK)
  // =========================================================================

  async reverseAllocation(companyId, allocationId, reason, actor = {}) {
    let attempts = 0;
    while (attempts < 3) {
      try {
        return await this._executeReverseAllocation(companyId, allocationId, reason, actor);
      } catch (err) {
        attempts++;
        const isDeadlock =
          err.message?.includes('deadlock') ||
          err.message?.includes('write conflict') ||
          err.message?.includes('Lock wait timeout');
        if (isDeadlock && attempts < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempts * 50));
          continue;
        }
        throw err;
      }
    }
  },

  async _executeReverseAllocation(companyId, allocationId, reason, actor = {}) {
    const allocation = await prisma.paymentAllocation.findFirst({
      where: { id: allocationId, companyId },
      include: {
        paymentReceipt: true,
        invoice: true,
        bill: {
          include: {
            paymentAllocations: { where: { status: 'ACTIVE' } },
            debitNotes: { where: { status: 'POSTED' } },
          },
        },
      },
    });

    if (!allocation) {
      throw allocError(`Payment Allocation not found with id ${allocationId}.`, 404);
    }

    if (allocation.status !== 'ACTIVE') {
      throw allocError(`Allocation is already in ${allocation.status} status and cannot be reversed.`);
    }

    // 1. If an advance adjustment voucher was created for this allocation, reverse it
    const linkedAdjVoucher = await prisma.journalVoucher.findFirst({
      where: {
        companyId,
        referenceType: 'ADVANCE_ALLOCATION',
        referenceId: allocationId,
        status: 'POSTED',
      },
    });

    if (linkedAdjVoucher) {
      await voucherService.reversePostedVoucher(
        companyId,
        linkedAdjVoucher.id,
        `Reversal of advance allocation ${allocationId}: ${reason || 'Advance allocation reversed'}`,
        actor
      );
    }

    // 2. Perform atomic balance reversals in database transaction
    return prisma.$transaction(async (tx) => {
      // Atomic CAS Guard: verify ACTIVE status
      const cas = await tx.paymentAllocation.updateMany({
        where: { id: allocationId, companyId, status: 'ACTIVE' },
        data: {
          status: 'REVERSED',
          notes: reason ? `Reversed: ${reason}` : 'Reversed',
        },
      });

      if (cas.count === 0) {
        throw allocError('Concurrent modification: Allocation is no longer active.');
      }

      const allocAmt = new Decimal(allocation.allocatedAmount);

      // Exclusive row-level lock on receipt to prevent lost updates across concurrent reversals on the same receipt
      const [lockedReceipt] = await tx.$queryRawUnsafe(
        'SELECT id, amount, unallocated_amount, payment_type FROM payment_receipts WHERE id = ? AND company_id = ? FOR UPDATE;',
        allocation.paymentReceiptId,
        companyId
      );

      if (!lockedReceipt) {
        throw allocError(`Payment Receipt not found with id ${allocation.paymentReceiptId}.`, 404);
      }

      const currentUnalloc = new Decimal(lockedReceipt.unallocated_amount);
      const receiptTotal = new Decimal(lockedReceipt.amount);
      const newUnallocated = Decimal.min(receiptTotal, currentUnalloc.add(allocAmt));

      await tx.paymentReceipt.updateMany({
        where: { id: allocation.paymentReceiptId, companyId },
        data: {
          unallocatedAmount: newUnallocated,
        },
      });

      // 2. Restore Sales Invoice or Purchase Bill balance
      if (allocation.invoiceId && allocation.invoice) {
        const inv = allocation.invoice;
        const newPaid = Decimal.max(0, new Decimal(inv.paidAmount).sub(allocAmt));
        const newOutstanding = Decimal.min(new Decimal(inv.totalAmount), new Decimal(inv.outstandingAmount).add(allocAmt));
        const newStatus = newPaid.isZero() ? 'POSTED' : 'PARTIALLY_PAID';

        await tx.salesInvoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status: newStatus,
          },
        });
      }

      if (allocation.billId && allocation.bill) {
        const bill = allocation.bill;
        const remainingActive = bill.paymentAllocations.filter((a) => a.id !== allocationId);
        const existingAllocTotal = remainingActive.reduce(
          (sum, a) => sum.add(new Decimal(a.allocatedAmount)),
          new Decimal(0)
        );
        const debitNotesTotal = bill.debitNotes.reduce(
          (sum, dn) => sum.add(new Decimal(dn.totalAmount)),
          new Decimal(0)
        );
        const billTotal = new Decimal(bill.totalAmount);
        const billOutstanding = billTotal.sub(existingAllocTotal).sub(debitNotesTotal);
        const newStatus = existingAllocTotal.isZero() && debitNotesTotal.isZero() ? 'UNPAID' : 'PARTIALLY_PAID';

        await tx.purchaseBill.update({
          where: { id: allocation.billId },
          data: {
            status: billOutstanding.isZero() ? 'PAID' : newStatus,
          },
        });
      }

      await auditService.logAudit({
        companyId,
        actorId: actor.id || actor.userId || 'system',
        actorName: actor.name || 'Authorised Officer',
        action: 'PAYMENT_ALLOCATION_REVERSE',
        serviceCode: 'accounts_banking',
        moduleCode: 'payment_allocations',
        details: `Reversed allocation ${allocationId} of ₹${allocAmt.toFixed(2)}. Reason: ${reason || 'Not specified'}. Restored receipt & ledger balances.`,
      });

      return tx.paymentAllocation.findUnique({
        where: { id: allocationId },
        include: { paymentReceipt: true, invoice: true, bill: true },
      });
    });
  },

  async listAllocations(companyId, filters = {}) {
    const { paymentReceiptId, invoiceId, billId, status = 'ACTIVE' } = filters;
    const where = { companyId };
    if (paymentReceiptId) where.paymentReceiptId = paymentReceiptId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (billId) where.billId = billId;
    if (status) where.status = status;

    return prisma.paymentAllocation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        paymentReceipt: { select: { paymentReceiptNo: true, paymentMode: true, paymentDate: true } },
        invoice: { select: { invoiceNo: true, customerName: true, totalAmount: true } },
        bill: { select: { billNo: true, totalAmount: true } },
      },
    });
  },
};

export default allocationService;
