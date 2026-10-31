import prisma from '../../config/prisma.js';
import { notificationService } from '../notification.service.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const advanceService = {
  /**
   * Record a customer advance payment entry (pending verification)
   */
  async recordAdvance(companyId, data, currentUser = {}) {
    if (!data.customerId) {
      throw coreError('Customer ID is required to record an advance.');
    }
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw coreError('Advance amount must be a positive number.');
    }
    if (!data.paymentMode?.trim()) {
      throw coreError('Payment mode is required (e.g. NEFT, RTGS, CHEQUE, IMPS, UPI, CASH).');
    }

    const customer = await prisma.crmCustomer.findFirst({
      where: { id: String(data.customerId), companyId },
    });
    if (!customer) throw coreError('Customer not found.', 404);

    const advanceNo = data.advanceNo?.trim() || `ADV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const advance = await prisma.customerAdvance.create({
      data: {
        companyId,
        advanceNo,
        customerId: customer.id,
        proformaId: data.proformaId ? String(data.proformaId) : null,
        amount,
        paymentMode: data.paymentMode.trim().toUpperCase(),
        bankReference: data.bankReference?.trim() || null,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : new Date(),
        notes: data.notes?.trim() || null,
        attachmentId: data.attachmentId ? String(data.attachmentId) : null,
        verificationStatus: 'PENDING',
      },
    });

    // Notify company finance / admins for verification
    await notificationService.createNotification({
      companyId,
      recipientId: 'MANAGERS',
      category: 'APPROVAL',
      title: `Advance Payment Recorded: ${advance.advanceNo}`,
      message: `₹${advance.amount} received from ${customer.companyName} via ${advance.paymentMode}. Pending bank credit verification.`,
      entityType: 'CUSTOMER_ADVANCE',
      entityId: advance.id,
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'RECORD_ADVANCE',
      entityType: 'CUSTOMER_ADVANCE',
      entityId: advance.id,
      afterState: { id: advance.id, advanceNo: advance.advanceNo, amount: advance.amount, customerId: customer.id },
      reason: `Recorded advance receipt of ₹${advance.amount}`,
    });

    return advance;
  },

  /**
   * Authorize or reject customer advance payment against bank credit evidence
   */
  async verifyAdvance(companyId, advanceId, data, currentUser = {}) {
    const { status, rejectionReason } = data;
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw coreError('Verification status must be either VERIFIED or REJECTED.', 400);
    }

    const advance = await prisma.customerAdvance.findFirst({
      where: { id: advanceId, companyId },
      include: { customer: true, proforma: true },
    });
    if (!advance) throw coreError('Advance record not found.', 404);

    if (advance.verificationStatus === 'VERIFIED') {
      throw coreError(`Advance #${advance.advanceNo} has already been verified.`, 400);
    }

    const verifiedById = String(currentUser.userId || currentUser.id || 'verifier');
    const verifiedByName = currentUser.name || currentUser.organizationName || 'Finance Manager';

    return prisma.$transaction(async (tx) => {
      const updatedAdvance = await tx.customerAdvance.update({
        where: { id: advanceId },
        data: {
          verificationStatus: status,
          verifiedById,
          verifiedByName,
          verifiedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? (rejectionReason?.trim() || 'Payment not credited') : null,
        },
      });

      // If verified and linked to a PI, update the PI's advance received and balance payable
      if (status === 'VERIFIED' && advance.proformaId) {
        const proforma = await tx.salesProforma.findUnique({
          where: { id: advance.proformaId },
        });

        if (proforma) {
          const newAdvanceReceived = parseFloat(proforma.advanceReceived || 0) + parseFloat(advance.amount);
          const newBalancePayable = Math.max(0, parseFloat(proforma.amount) - newAdvanceReceived);

          await tx.salesProforma.update({
            where: { id: proforma.id },
            data: {
              advanceReceived: newAdvanceReceived,
              balancePayable: newBalancePayable,
            },
          });
        }
      }

      // Notify customer owner
      await notificationService.createNotification({
        companyId,
        recipientId: advance.customer?.assignedTo || 'MANAGERS',
        category: 'ALERT',
        title: `Advance ${status}: ${advance.advanceNo}`,
        message: status === 'VERIFIED'
          ? `Advance payment of ₹${advance.amount} for ${advance.customer.companyName} was VERIFIED by ${verifiedByName}.`
          : `Advance payment of ₹${advance.amount} was REJECTED: ${rejectionReason || 'Credit unverified'}.`,
        entityType: 'CUSTOMER_ADVANCE',
        entityId: advance.id,
      });

      await auditService.logAction({
        companyId,
        actor: currentUser,
        action: `VERIFY_ADVANCE_${status}`,
        entityType: 'CUSTOMER_ADVANCE',
        entityId: advance.id,
        beforeState: { verificationStatus: advance.verificationStatus },
        afterState: { verificationStatus: status, verifiedByName },
        reason: `Bank credit verification outcome: ${status}`,
      });

      return updatedAdvance;
    });
  },

  /**
   * List advance receipts
   */
  async listAdvances(companyId, options = {}) {
    const { customerId, proformaId, verificationStatus, limit = 50, offset = 0 } = options;
    const where = { companyId };

    if (customerId) where.customerId = String(customerId);
    if (proformaId) where.proformaId = String(proformaId);
    if (verificationStatus && verificationStatus !== 'ALL') {
      where.verificationStatus = verificationStatus;
    }

    const [items, total] = await Promise.all([
      prisma.customerAdvance.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        take: Number(limit) || 50,
        skip: Number(offset) || 0,
        include: {
          customer: {
            select: { id: true, companyName: true, customerCode: true },
          },
          proforma: {
            select: { id: true, invoiceNo: true, amount: true, advanceRequired: true },
          },
        },
      }),
      prisma.customerAdvance.count({ where }),
    ]);

    return { items, total };
  },
};

export default advanceService;

