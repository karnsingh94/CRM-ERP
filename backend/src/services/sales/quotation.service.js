import prisma from '../../config/prisma.js';
import versionService from '../version.service.js';
import approvalService from '../approval.service.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function computeFinancialTotals(items, fallbackAmount = 0) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      itemsCount: 1,
      totalAmount: parseFloat(fallbackAmount) || 0,
    };
  }

  const itemsCount = items.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0);
  const totalAmount = items.reduce((acc, it) => {
    const qty = parseInt(it.qty) || 1;
    const rate = parseFloat(it.rate) || 0;
    const discount = parseFloat(it.discount) || 0;
    const discountedRate = rate - (rate * discount) / 100;
    const gstPct = parseFloat(it.gst) || 0;
    const subtotal = qty * discountedRate;
    const total = subtotal + (subtotal * gstPct) / 100;
    return acc + (it.total !== undefined ? parseFloat(it.total) : total);
  }, 0);

  return {
    itemsCount,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export const quotationService = {
  async listQuotations(companyId, options = {}) {
    const { search, status, customerId, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (customerId) where.customerId = String(customerId);
    if (search && search.trim()) {
      where.OR = [
        { quoteNo: { contains: search.trim() } },
        { customer: { contains: search.trim() } },
        { title: { contains: search.trim() } },
      ];
    }

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    return prisma.salesQuotation.findMany(queryOptions);
  },

  async createQuotation(companyId, data, currentUser = {}) {
    const customer = (data.customer || data.customerName)?.trim();
    const title = (data.title || data.quoteTitle || `Quotation for ${customer}`)?.trim();
    if (!customer || !title) {
      throw coreError('Customer and quote title are required.');
    }
    const quoteNo = data.quoteNo?.trim() || `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    const { totalAmount } = computeFinancialTotals(items, data.amount);

    const preparedById = String(data.preparedById || currentUser.userId || currentUser.id || 'user');
    const preparedByName = data.preparedByName || currentUser.name || currentUser.organizationName || 'Sales Representative';

    const quotation = await prisma.salesQuotation.create({
      data: {
        companyId,
        quoteNo,
        customerId: data.customerId ? String(data.customerId) : null,
        contactPersonId: data.contactPersonId ? String(data.contactPersonId) : null,
        customer,
        title,
        amount: totalAmount,
        items,
        notes: data.notes?.trim() || null,
        paymentTerms: data.paymentTerms?.trim() || '30% Advance, 70% against BL/Delivery',
        deliveryTerms: data.deliveryTerms?.trim() || 'Ex-Works / FOB Port',
        preparedById,
        preparedByName,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: data.status?.trim() || 'SENT',
        versionNumber: 1,
        isLocked: false,
      },
    });

    // Phase 1 Document Versioning: Create initial immutable V1 snapshot
    try {
      await versionService.createInitialVersion({
        companyId,
        entityType: 'SALES_QUOTATION',
        entityId: quotation.id,
        snapshotData: {
          id: quotation.id,
          quoteNo: quotation.quoteNo,
          customer: quotation.customer,
          title: quotation.title,
          amount: totalAmount,
          items,
          notes: quotation.notes,
          paymentTerms: quotation.paymentTerms,
          deliveryTerms: quotation.deliveryTerms,
        },
        createdById: preparedById,
        createdByName: preparedByName,
      });
    } catch (err) {
      console.error('Failed to create quotation V1 version snapshot:', err.message);
    }

    // Workflow connection: If an Opportunity is in DISCOVERY for this customer, advance to PROPOSAL
    try {
      if (data.opportunityId) {
        await prisma.crmOpportunity.update({
          where: { id: String(data.opportunityId) },
          data: { stage: 'PROPOSAL', probability: '50%' },
        });
      } else {
        const opp = await prisma.crmOpportunity.findFirst({
          where: {
            companyId,
            companyName: data.customer.trim(),
            stage: 'DISCOVERY',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (opp) {
          await prisma.crmOpportunity.update({
            where: { id: opp.id },
            data: { stage: 'PROPOSAL', probability: '50%' },
          });
        }
      }
    } catch {
      // Non-blocking commercial link
    }

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_QUOTATION',
      entityType: 'SALES_QUOTATION',
      entityId: quotation.id,
      afterState: { id: quotation.id, quoteNo: quotation.quoteNo, amount: quotation.amount },
      reason: 'Created sales quotation V1',
    });

    return quotation;
  },

  /**
   * Submit Sales Quotation for approval via Phase 1 Approval Engine
   */
  async submitForApproval(companyId, quoteId, currentUser = {}) {
    const quote = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) throw coreError('Quotation not found.', 404);

    if (quote.status === 'APPROVED' || quote.status === 'ACCEPTED') {
      throw coreError(`Quotation #${quote.quoteNo} is already approved or accepted.`, 400);
    }

    const request = await approvalService.createRequest({
      companyId,
      entityType: 'SALES_QUOTATION',
      entityId: quote.id,
      title: `Sales Quotation Approval: ${quote.quoteNo} — ₹${quote.amount}`,
      summary: `Quotation for ${quote.customer} (${quote.title}) totaling ₹${quote.amount}`,
      amount: Number(quote.amount),
      totalLevels: 1,
      creatorId: currentUser.userId || currentUser.id || quote.preparedById,
      creatorName: currentUser.name || currentUser.organizationName || quote.preparedByName,
    });

    await prisma.salesQuotation.update({
      where: { id: quoteId },
      data: { status: 'PENDING_APPROVAL' },
    });

    return { success: true, approvalRequest: request };
  },

  /**
   * Revise quotation: Phase 1 branching workflow preserving previous approved versions
   */
  async reviseQuotation(companyId, quoteId, data, currentUser = {}) {
    const quote = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) throw coreError('Quotation not found.', 404);

    if (!data.revisionReason?.trim()) {
      throw coreError('A mandatory revision reason must be provided to create a revised quotation.', 400);
    }

    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : quote.items;
    const { totalAmount } = computeFinancialTotals(items, data.amount || quote.amount);
    const revisionReason = data.revisionReason.trim();

    // Branch a new version in DocumentVersion history
    const branchedVersion = await versionService.branchNewVersion({
      companyId,
      entityType: 'SALES_QUOTATION',
      entityId: quote.id,
      newSnapshotData: {
        id: quote.id,
        quoteNo: quote.quoteNo,
        customer: quote.customer,
        title: data.title?.trim() || quote.title,
        amount: totalAmount,
        items,
        notes: data.notes?.trim() || quote.notes,
        paymentTerms: data.paymentTerms?.trim() || quote.paymentTerms,
        deliveryTerms: data.deliveryTerms?.trim() || quote.deliveryTerms,
        revisionReason,
      },
      revisionReason,
      createdById: currentUser.userId || currentUser.id || quote.preparedById,
      createdByName: currentUser.name || currentUser.organizationName || quote.preparedByName,
    });

    // Update active quotation record to new revision
    const updated = await prisma.salesQuotation.update({
      where: { id: quoteId },
      data: {
        title: data.title?.trim() || quote.title,
        amount: totalAmount,
        items,
        notes: `Rev V${branchedVersion.versionNumber}: ${revisionReason}`,
        paymentTerms: data.paymentTerms?.trim() || quote.paymentTerms,
        deliveryTerms: data.deliveryTerms?.trim() || quote.deliveryTerms,
        versionNumber: branchedVersion.versionNumber,
        status: 'DRAFT',
        isLocked: false,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'REVISE_QUOTATION',
      entityType: 'SALES_QUOTATION',
      entityId: quote.id,
      beforeState: { versionNumber: quote.versionNumber, amount: quote.amount },
      afterState: { versionNumber: updated.versionNumber, amount: updated.amount, revisionReason },
      reason: `Branched quotation revision V${branchedVersion.versionNumber}: ${revisionReason}`,
    });

    return updated;
  },

  async updateQuotationStatus(companyId, quoteId, status, currentUser = {}) {
    const existing = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!existing) throw coreError('Quotation not found.', 404);

    const isLocked = status === 'APPROVED' || status === 'ACCEPTED';
    const updated = await prisma.salesQuotation.update({
      where: { id: quoteId },
      data: { status, isLocked: isLocked ? true : existing.isLocked },
    });

    if (isLocked) {
      try {
        await versionService.lockVersion(companyId, 'SALES_QUOTATION', quoteId, updated.versionNumber, currentUser);
      } catch (err) {
        console.error('Non-blocking version lock note:', err.message);
      }
    }

    if (status === 'ACCEPTED') {
      try {
        const opp = await prisma.crmOpportunity.findFirst({
          where: {
            companyId,
            companyName: existing.customer,
            stage: { in: ['DISCOVERY', 'PROPOSAL', 'NEGOTIATION'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (opp) {
          await prisma.crmOpportunity.update({
            where: { id: opp.id },
            data: { stage: 'WON', probability: '100%' },
          });
        }
      } catch {}
    } else if (status === 'SENT') {
      try {
        const opp = await prisma.crmOpportunity.findFirst({
          where: {
            companyId,
            companyName: existing.customer,
            stage: 'DISCOVERY',
          },
          orderBy: { createdAt: 'desc' },
        });
        if (opp) {
          await prisma.crmOpportunity.update({
            where: { id: opp.id },
            data: { stage: 'PROPOSAL', probability: '50%' },
          });
        }
      } catch {}
    }

    return updated;
  },

  async convertQuotationToOrder(companyId, quoteId, currentUser = {}) {
    const quote = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!quote) throw coreError('Quotation not found.', 404);

    if (quote.status === 'ACCEPTED') {
      throw coreError('Quotation has already been accepted and converted to an order.', 400);
    }
    if (quote.status === 'REJECTED') {
      throw coreError('Cannot convert a rejected quotation.', 400);
    }
    if (quote.status === 'DRAFT') {
      throw coreError('Cannot convert a draft quotation. Quotation must be sent or accepted first.', 400);
    }

    return prisma.$transaction(async (tx) => {
      const orderNo = `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const items = quote.items;
      const itemsCount = Array.isArray(items)
        ? items.reduce((acc, it) => acc + (parseInt(it.qty) || 1), 0)
        : 1;

      const newOrder = await tx.salesOrder.create({
        data: {
          companyId,
          orderNo,
          customerId: quote.customerId || null,
          customer: quote.customer,
          date: new Date(),
          itemsCount,
          amount: quote.amount,
          items: quote.items,
          notes: quote.notes
            ? `Converted from Quote ${quote.quoteNo}. ${quote.notes}`
            : `Converted from Quote ${quote.quoteNo}`,
          deliveryTerms: quote.deliveryTerms || null,
          status: 'APPROVED',
          paymentStatus: 'PENDING',
          isReleased: true,
          releasedAt: new Date(),
          releasedById: currentUser.userId || currentUser.id || null,
        },
      });

      await tx.salesQuotation.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED', isLocked: true },
      });

      // Synchronize Opportunity stage to WON
      const opp = await tx.crmOpportunity.findFirst({
        where: {
          companyId,
          companyName: quote.customer,
          stage: { in: ['DISCOVERY', 'PROPOSAL', 'NEGOTIATION'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (opp) {
        await tx.crmOpportunity.update({
          where: { id: opp.id },
          data: { stage: 'WON', probability: '100%' },
        });
      }

      return newOrder;
    });
  },

  async removeQuotation(companyId, quoteId) {
    const existing = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!existing) throw coreError('Quotation not found.', 404);
    await prisma.salesQuotation.delete({ where: { id: quoteId } });
    return true;
  },
};

export default quotationService;
