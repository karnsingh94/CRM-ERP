import prisma from '../../config/prisma.js';

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
    const gstPct = parseFloat(it.gst) || 0;
    const subtotal = qty * rate;
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
    const { search, status, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
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

  async createQuotation(companyId, data) {
    if (!data.customer?.trim() || !data.title?.trim()) {
      throw coreError('Customer and quote title are required.');
    }
    const quoteNo = data.quoteNo?.trim() || `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    const { totalAmount } = computeFinancialTotals(items, data.amount);

    const quotation = await prisma.salesQuotation.create({
      data: {
        companyId,
        quoteNo,
        customer: data.customer.trim(),
        title: data.title.trim(),
        amount: totalAmount,
        items,
        notes: data.notes?.trim() || null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        status: data.status?.trim() || 'SENT',
      },
    });

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

    return quotation;
  },

  async updateQuotationStatus(companyId, quoteId, status) {
    const existing = await prisma.salesQuotation.findFirst({
      where: { id: quoteId, companyId },
    });
    if (!existing) throw coreError('Quotation not found.', 404);

    const updated = await prisma.salesQuotation.update({
      where: { id: quoteId },
      data: { status },
    });

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

  async convertQuotationToOrder(companyId, quoteId) {
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
          customer: quote.customer,
          date: new Date(),
          itemsCount,
          amount: quote.amount,
          items: quote.items,
          notes: quote.notes
            ? `Converted from Quote ${quote.quoteNo}. ${quote.notes}`
            : `Converted from Quote ${quote.quoteNo}`,
          status: 'APPROVED',
          paymentStatus: 'PENDING',
        },
      });

      await tx.salesQuotation.update({
        where: { id: quoteId },
        data: { status: 'ACCEPTED' },
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
