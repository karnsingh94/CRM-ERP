import prisma from '../../config/prisma.js';
import { computeFinancialTotals } from './quotation.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const salesOrderService = {
  async listSalesOrders(companyId, options = {}) {
    const { search, status, paymentStatus, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (paymentStatus && paymentStatus !== 'ALL') where.paymentStatus = paymentStatus;
    if (search && search.trim()) {
      where.OR = [
        { orderNo: { contains: search.trim() } },
        { customer: { contains: search.trim() } },
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

    return prisma.salesOrder.findMany(queryOptions);
  },

  async createSalesOrder(companyId, data) {
    if (!data.customer?.trim()) {
      throw coreError('Customer name is required.');
    }
    const orderNo = data.orderNo?.trim() || `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Duplicate check
    const existingOrder = await prisma.salesOrder.findFirst({
      where: { companyId, orderNo },
    });
    if (existingOrder) {
      throw coreError(`Order with number ${orderNo} already exists.`);
    }

    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    const { itemsCount, totalAmount } = computeFinancialTotals(items, data.amount);

    return prisma.salesOrder.create({
      data: {
        companyId,
        orderNo,
        customer: data.customer.trim(),
        date: data.date ? new Date(data.date) : new Date(),
        itemsCount,
        amount: totalAmount,
        items,
        notes: data.notes?.trim() || null,
        assignedTo: data.assignedTo?.trim() || null,
        status: data.status?.trim() || 'PENDING_APPROVAL',
        paymentStatus: data.paymentStatus?.trim() || 'PENDING',
      },
    });
  },

  async updateSalesOrderStatus(companyId, orderId, status, paymentStatus) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!existing) throw coreError('Sales order not found.', 404);

    const validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
    if (status !== undefined && !validStatuses.includes(status)) {
      throw coreError(`Invalid sales order status: ${status}. Valid statuses: ${validStatuses.join(', ')}`, 400);
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;

    return prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: updateData,
      });

      // Synchronize associated opportunity to WON ONLY when the business explicitly confirms the deal
      if (['APPROVED', 'CONFIRMED'].includes(status)) {
        const opp = await tx.crmOpportunity.findFirst({
          where: {
            companyId,
            companyName: existing.customer,
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
      }

      return updatedOrder;
    });
  },

  async removeSalesOrder(companyId, orderId) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!existing) throw coreError('Sales order not found.', 404);
    await prisma.salesOrder.delete({ where: { id: orderId } });
    return true;
  },
};

export default salesOrderService;
