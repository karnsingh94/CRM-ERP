import prisma from '../../config/prisma.js';
import { computeFinancialTotals } from './quotation.service.js';
import { notificationService } from '../notification.service.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const salesOrderService = {
  async listSalesOrders(companyId, options = {}) {
    const { search, status, paymentStatus, customerId, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (paymentStatus && paymentStatus !== 'ALL') where.paymentStatus = paymentStatus;
    if (customerId) where.customerId = String(customerId);
    if (search && search.trim()) {
      where.OR = [
        { orderNo: { contains: search.trim() } },
        { customer: { contains: search.trim() } },
        { proformaNo: { contains: search.trim() } },
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

  async createSalesOrder(companyId, data, currentUser = {}) {
    const customer = (data.customer || data.customerName)?.trim();
    if (!customer) {
      throw coreError('Customer name is required.');
    }
    const orderNo = data.orderNo?.trim() || data.orderNumber?.trim() || `SO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Duplicate check
    const existingOrder = await prisma.salesOrder.findFirst({
      where: { companyId, orderNo },
    });
    if (existingOrder) {
      throw coreError(`Order with number ${orderNo} already exists.`);
    }

    const items = Array.isArray(data.items) && data.items.length > 0 ? data.items : null;
    const { itemsCount, totalAmount } = computeFinancialTotals(items, data.amount);

    const advanceReceived = data.advanceReceived !== undefined && data.advanceReceived !== ''
      ? parseFloat(data.advanceReceived)
      : 0;
    const balancePayable = Math.max(0, totalAmount - advanceReceived);

    const order = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo,
        customerId: data.customerId ? String(data.customerId) : null,
        proformaId: data.proformaId ? String(data.proformaId) : null,
        proformaNo: data.proformaNo ? String(data.proformaNo).trim() : null,
        customer,
        date: data.date ? new Date(data.date) : new Date(),
        itemsCount,
        amount: totalAmount,
        advanceReceived,
        balancePayable,
        deliveryTerms: data.deliveryTerms?.trim() || 'Ex-Works / FOB Port',
        items,
        notes: data.notes?.trim() || null,
        assignedTo: data.assignedTo?.trim() || null,
        status: data.status?.trim() || 'PENDING_APPROVAL',
        paymentStatus: data.paymentStatus?.trim() || 'PENDING',
        isReleased: false,
      },
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_SALES_ORDER',
      entityType: 'SALES_ORDER',
      entityId: order.id,
      afterState: { id: order.id, orderNo: order.orderNo, amount: totalAmount },
      reason: 'Drafted sales order record',
    });

    return order;
  },

  /**
   * Release Sales Order Gate:
   * Enforces verified customer advance condition prior to release / manufacturing handover
   */
  async releaseSalesOrder(companyId, orderId, currentUser = {}) {
    const order = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw coreError('Sales order not found.', 404);

    if (order.isReleased) {
      return { success: true, message: 'Sales Order is already released.', order };
    }

    // Advance verification gate check
    if (order.proformaId) {
      const proforma = await prisma.salesProforma.findUnique({
        where: { id: order.proformaId },
      });

      if (proforma && parseFloat(proforma.advanceRequired) > 0) {
        const requiredAmount = parseFloat(proforma.advanceRequired);

        // Calculate verified advances
        const verifiedAdvances = await prisma.customerAdvance.aggregate({
          where: {
            companyId,
            proformaId: order.proformaId,
            verificationStatus: 'VERIFIED',
          },
          _sum: { amount: true },
        });

        const totalVerified = parseFloat(verifiedAdvances._sum.amount || 0);

        if (totalVerified < requiredAmount) {
          throw coreError(
            `Cannot release Sales Order #${order.orderNo}: Required advance payment of ₹${requiredAmount.toLocaleString()} has not been verified against bank credit records (Current verified: ₹${totalVerified.toLocaleString()}).`,
            400
          );
        }
      }
    }

    const releasedById = String(currentUser.userId || currentUser.id || 'releaser');
    const releasedByName = currentUser.name || currentUser.organizationName || 'Sales Manager';

    return prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: {
          isReleased: true,
          status: 'APPROVED',
          releasedAt: new Date(),
          releasedById,
        },
      });

      // Update customer's last order date and reorder cycle expected date
      if (order.customerId) {
        const customer = await tx.crmCustomer.findUnique({
          where: { id: order.customerId },
        });

        if (customer) {
          const now = new Date();
          const cycleDays = customer.reorderCycleDays || 30;
          const expectedReorderDate = new Date(now.getTime() + cycleDays * 24 * 60 * 60 * 1000);

          await tx.crmCustomer.update({
            where: { id: customer.id },
            data: {
              lastOrderDate: now,
              expectedReorderDate,
              reorderReminderStatus: 'PENDING',
            },
          });
        }
      }

      // Synchronize associated opportunity to WON
      const opp = await tx.crmOpportunity.findFirst({
        where: {
          companyId,
          companyName: order.customer,
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

      // Phase 1 Notification
      await notificationService.createNotification({
        companyId,
        recipientId: order.assignedTo || 'MANAGERS',
        category: 'TASK',
        title: `Sales Order Released: ${order.orderNo}`,
        message: `Order #${order.orderNo} for ${order.customer} has passed advance verification gate and is released by ${releasedByName}.`,
        entityType: 'SALES_ORDER',
        entityId: order.id,
      });

      await auditService.logAction({
        companyId,
        actor: currentUser,
        action: 'RELEASE_SALES_ORDER',
        entityType: 'SALES_ORDER',
        entityId: order.id,
        beforeState: { isReleased: false, status: order.status },
        afterState: { isReleased: true, status: 'APPROVED', releasedByName },
        reason: 'Sales order released through advance verification gate',
      });

      return updatedOrder;
    });
  },

  async updateSalesOrderStatus(companyId, orderId, status, paymentStatus, currentUser = {}) {
    const existing = await prisma.salesOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!existing) throw coreError('Sales order not found.', 404);

    const validStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CONFIRMED', 'DELIVERED', 'CANCELLED'];
    if (status !== undefined && !validStatuses.includes(status)) {
      throw coreError(`Invalid sales order status: ${status}. Valid statuses: ${validStatuses.join(', ')}`, 400);
    }

    const updateData = {};
    if (status !== undefined) {
      updateData.status = status;
      if (['APPROVED', 'CONFIRMED'].includes(status)) {
        updateData.isReleased = true;
        updateData.releasedAt = new Date();
      }
    }
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
