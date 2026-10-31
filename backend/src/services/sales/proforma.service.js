import prisma from '../../config/prisma.js';
import versionService from '../version.service.js';
import approvalService from '../approval.service.js';
import { auditService } from '../audit.service.js';
import { computeFinancialTotals } from './quotation.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const proformaService = {
  async listProformas(companyId, options = {}) {
    const { search, status, customerId, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (customerId) where.customerId = String(customerId);
    if (search && search.trim()) {
      where.OR = [
        { invoiceNo: { contains: search.trim() } },
        { customer: { contains: search.trim() } },
        { orderRef: { contains: search.trim() } },
        { quotationNo: { contains: search.trim() } },
      ];
    }

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        advances: {
          orderBy: { createdAt: 'desc' },
        },
      },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    return prisma.salesProforma.findMany(queryOptions);
  },

  async createProforma(companyId, data, currentUser = {}) {
    const customer = (data.customer || data.customerName)?.trim();
    if (!customer) {
      throw coreError('Customer name is required.');
    }
    const invoiceNo = data.invoiceNo?.trim() || `PI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    const { totalAmount } = computeFinancialTotals(items, data.amount);

    const advanceRequired = data.advanceRequired !== undefined && data.advanceRequired !== ''
      ? parseFloat(data.advanceRequired)
      : (totalAmount * 0.3); // default 30% advance if not specified

    const advanceReceived = data.advanceReceived !== undefined && data.advanceReceived !== ''
      ? parseFloat(data.advanceReceived)
      : 0;

    const balancePayable = Math.max(0, totalAmount - advanceReceived);

    const createdById = String(currentUser.userId || currentUser.id || 'user');
    const createdByName = currentUser.name || currentUser.organizationName || 'Sales Representative';

    const proforma = await prisma.salesProforma.create({
      data: {
        companyId,
        invoiceNo,
        customerId: data.customerId ? String(data.customerId) : null,
        quotationId: data.quotationId ? String(data.quotationId) : null,
        quotationNo: data.quotationNo ? String(data.quotationNo).trim() : null,
        customer,
        orderRef: data.orderRef?.trim() || null,
        items,
        subtotal: parseFloat(data.subtotal) || totalAmount,
        taxAmount: parseFloat(data.taxAmount) || 0,
        discountAmount: parseFloat(data.discountAmount) || 0,
        amount: totalAmount,
        advanceRequired,
        advanceReceived,
        balancePayable,
        paymentTerms: data.paymentTerms?.trim() || '30% Advance, 70% against BL/Delivery',
        deliveryTerms: data.deliveryTerms?.trim() || 'Ex-Works / FOB Port',
        validityDate: data.validityDate ? new Date(data.validityDate) : null,
        date: data.date ? new Date(data.date) : new Date(),
        status: data.status?.trim() || 'ISSUED',
        versionNumber: 1,
        isLocked: false,
        createdById,
        createdByName,
      },
    });

    // Phase 1 Document Versioning: Initial V1 snapshot
    try {
      await versionService.createInitialVersion({
        companyId,
        entityType: 'SALES_PROFORMA',
        entityId: proforma.id,
        snapshotData: {
          id: proforma.id,
          invoiceNo: proforma.invoiceNo,
          customer: proforma.customer,
          amount: totalAmount,
          advanceRequired,
          items,
          paymentTerms: proforma.paymentTerms,
          deliveryTerms: proforma.deliveryTerms,
        },
        createdById,
        createdByName,
      });
    } catch (err) {
      console.error('Failed to create PI V1 snapshot:', err.message);
    }

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_PROFORMA',
      entityType: 'SALES_PROFORMA',
      entityId: proforma.id,
      afterState: { id: proforma.id, invoiceNo: proforma.invoiceNo, amount: totalAmount },
      reason: 'Issued new Proforma Invoice V1',
    });

    return proforma;
  },

  /**
   * Submit Proforma Invoice for approval via Phase 1 Approval Engine
   */
  async submitForApproval(companyId, proformaId, currentUser = {}) {
    const proforma = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!proforma) throw coreError('Proforma invoice not found.', 404);

    if (proforma.status === 'APPROVED') {
      throw coreError(`Proforma Invoice #${proforma.invoiceNo} is already approved.`, 400);
    }

    const request = await approvalService.createRequest({
      companyId,
      entityType: 'SALES_PROFORMA',
      entityId: proforma.id,
      title: `Proforma Invoice Approval: ${proforma.invoiceNo} — ₹${proforma.amount}`,
      summary: `Proforma for ${proforma.customer} totaling ₹${proforma.amount} (Required Advance: ₹${proforma.advanceRequired})`,
      amount: Number(proforma.amount),
      totalLevels: 1,
      creatorId: currentUser.userId || currentUser.id || proforma.createdById,
      creatorName: currentUser.name || currentUser.organizationName || proforma.createdByName,
    });

    await prisma.salesProforma.update({
      where: { id: proformaId },
      data: { status: 'PENDING_APPROVAL' },
    });

    return { success: true, approvalRequest: request };
  },

  /**
   * Revise Proforma Invoice: Phase 1 branching workflow preserving previous version history
   */
  async reviseProforma(companyId, proformaId, data, currentUser = {}) {
    const proforma = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!proforma) throw coreError('Proforma invoice not found.', 404);

    if (!data.revisionReason?.trim()) {
      throw coreError('A mandatory revision reason must be provided to create a revised Proforma Invoice.', 400);
    }

    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : proforma.items;
    const { totalAmount } = computeFinancialTotals(items, data.amount || proforma.amount);
    const revisionReason = data.revisionReason.trim();

    const advanceRequired = data.advanceRequired !== undefined && data.advanceRequired !== ''
      ? parseFloat(data.advanceRequired)
      : parseFloat(proforma.advanceRequired);

    const balancePayable = Math.max(0, totalAmount - parseFloat(proforma.advanceReceived));

    const branched = await versionService.branchNewVersion({
      companyId,
      entityType: 'SALES_PROFORMA',
      entityId: proforma.id,
      newSnapshotData: {
        id: proforma.id,
        invoiceNo: proforma.invoiceNo,
        customer: proforma.customer,
        amount: totalAmount,
        advanceRequired,
        items,
        paymentTerms: data.paymentTerms?.trim() || proforma.paymentTerms,
        deliveryTerms: data.deliveryTerms?.trim() || proforma.deliveryTerms,
        revisionReason,
      },
      revisionReason,
      createdById: currentUser.userId || currentUser.id || proforma.createdById,
      createdByName: currentUser.name || currentUser.organizationName || proforma.createdByName,
    });

    const updated = await prisma.salesProforma.update({
      where: { id: proformaId },
      data: {
        amount: totalAmount,
        items,
        advanceRequired,
        balancePayable,
        paymentTerms: data.paymentTerms?.trim() || proforma.paymentTerms,
        deliveryTerms: data.deliveryTerms?.trim() || proforma.deliveryTerms,
        versionNumber: branched.versionNumber,
        status: 'ISSUED',
        isLocked: false,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'REVISE_PROFORMA',
      entityType: 'SALES_PROFORMA',
      entityId: proforma.id,
      beforeState: { versionNumber: proforma.versionNumber, amount: proforma.amount },
      afterState: { versionNumber: updated.versionNumber, amount: updated.amount, revisionReason },
      reason: `Branched PI revision V${branched.versionNumber}: ${revisionReason}`,
    });

    return updated;
  },

  async updateProformaStatus(companyId, proformaId, status, currentUser = {}) {
    const existing = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!existing) throw coreError('Proforma invoice not found.', 404);

    const isLocked = status === 'APPROVED';
    const updated = await prisma.salesProforma.update({
      where: { id: proformaId },
      data: { status, isLocked: isLocked ? true : existing.isLocked },
    });

    if (isLocked) {
      try {
        await versionService.lockVersion(companyId, 'SALES_PROFORMA', proformaId, updated.versionNumber, currentUser);
      } catch (err) {
        console.error('Non-blocking version lock note:', err.message);
      }
    }

    return updated;
  },

  async removeProforma(companyId, proformaId) {
    const existing = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!existing) throw coreError('Proforma invoice not found.', 404);
    await prisma.salesProforma.delete({ where: { id: proformaId } });
    return true;
  },
};

export default proformaService;
