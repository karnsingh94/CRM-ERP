import prisma from '../../config/prisma.js';
import { auditService } from '../audit.service.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const customerService = {
  async listCustomers(companyId, options = {}) {
    const { search, limit, offset, status, category } = options;
    const where = { companyId };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (category && category !== 'ALL') {
      where.customerCategory = category;
    }
    if (search && search.trim()) {
      where.OR = [
        { companyName: { contains: search.trim() } },
        { customerCode: { contains: search.trim() } },
        { contactPerson: { contains: search.trim() } },
        { email: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { gstin: { contains: search.trim() } },
      ];
    }

    const queryOptions = {
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        contacts: {
          take: 5,
          orderBy: { isPrimary: 'desc' },
        },
      },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    return prisma.crmCustomer.findMany(queryOptions);
  },

  async createCustomer(companyId, data, currentUser = {}) {
    if (!data.companyName?.trim()) {
      throw coreError('Company / Account name is required.');
    }

    const customerCode = data.customerCode?.trim() || `CUST-${Math.floor(1000 + Math.random() * 9000)}`;

    const customer = await prisma.crmCustomer.create({
      data: {
        companyId,
        companyName: data.companyName.trim(),
        customerCode,
        gstin: data.gstin ? data.gstin.trim().toUpperCase() : null,
        pan: data.pan ? data.pan.trim().toUpperCase() : null,
        contactPerson: data.contactPerson?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        industry: data.industry?.trim() || 'Technology & IT',
        customerCategory: data.customerCategory?.trim() || 'DOMESTIC',
        billingAddress: data.billingAddress?.trim() || null,
        shippingAddress: data.shippingAddress?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        pincode: data.pincode?.trim() || null,
        creditLimit: data.creditLimit !== undefined && data.creditLimit !== '' ? parseFloat(data.creditLimit) : 0,
        paymentTerms: data.paymentTerms?.trim() || '30% Advance, 70% against BL/Delivery',
        reorderCycleDays: data.reorderCycleDays !== undefined ? parseInt(data.reorderCycleDays, 10) : 30,
        requirements: data.requirements?.trim() || null,
        assignedTo: data.assignedTo?.trim() || null,
        status: data.status?.trim() || 'ACTIVE',
      },
    });

    // Create primary contact if contactPerson is specified
    if (data.contactPerson?.trim()) {
      await prisma.crmContact.create({
        data: {
          companyId,
          customerId: customer.id,
          name: data.contactPerson.trim(),
          companyName: data.companyName.trim(),
          role: 'Primary Contact',
          designation: data.contactDesignation?.trim() || 'Key Decision Maker',
          department: data.contactDepartment?.trim() || 'Commercial',
          stakeholderType: 'DECISION_MAKER',
          isPrimary: true,
          isDecisionMaker: true,
          communicationPreference: 'EMAIL',
          email: data.email?.trim() || null,
          phone: data.phone?.trim() || null,
        },
      });
    }

    // Phase 1 Audit Log
    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'CREATE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: customer.id,
      afterState: { id: customer.id, companyName: customer.companyName, customerCode: customer.customerCode },
      reason: 'Registered new customer record',
    });

    return customer;
  },

  async updateCustomer(companyId, customerId, data, currentUser = {}) {
    const existing = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) throw coreError('Customer not found.', 404);

    const updateData = {};
    if (data.companyName !== undefined) updateData.companyName = String(data.companyName).trim();
    if (data.customerCode !== undefined) updateData.customerCode = data.customerCode ? String(data.customerCode).trim() : null;
    if (data.gstin !== undefined) updateData.gstin = data.gstin ? String(data.gstin).trim().toUpperCase() : null;
    if (data.pan !== undefined) updateData.pan = data.pan ? String(data.pan).trim().toUpperCase() : null;
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson ? String(data.contactPerson).trim() : null;
    if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? String(data.phone).trim() : null;
    if (data.industry !== undefined) updateData.industry = data.industry ? String(data.industry).trim() : 'Technology & IT';
    if (data.customerCategory !== undefined) updateData.customerCategory = String(data.customerCategory).trim();
    if (data.billingAddress !== undefined) updateData.billingAddress = data.billingAddress ? String(data.billingAddress).trim() : null;
    if (data.shippingAddress !== undefined) updateData.shippingAddress = data.shippingAddress ? String(data.shippingAddress).trim() : null;
    if (data.city !== undefined) updateData.city = data.city ? String(data.city).trim() : null;
    if (data.state !== undefined) updateData.state = data.state ? String(data.state).trim() : null;
    if (data.pincode !== undefined) updateData.pincode = data.pincode ? String(data.pincode).trim() : null;
    if (data.creditLimit !== undefined) updateData.creditLimit = data.creditLimit !== '' ? parseFloat(data.creditLimit) : 0;
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms ? String(data.paymentTerms).trim() : null;
    if (data.reorderCycleDays !== undefined) updateData.reorderCycleDays = parseInt(data.reorderCycleDays, 10) || 30;
    if (data.requirements !== undefined) updateData.requirements = data.requirements ? String(data.requirements).trim() : null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo ? String(data.assignedTo).trim() : null;
    if (data.status !== undefined) updateData.status = String(data.status).trim();

    const updated = await prisma.crmCustomer.update({
      where: { id: customerId },
      data: updateData,
    });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'UPDATE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: customerId,
      beforeState: existing,
      afterState: updated,
      reason: 'Updated customer profile attributes',
    });

    return updated;
  },

  async removeCustomer(companyId, customerId, currentUser = {}) {
    const existing = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) throw coreError('Customer not found.', 404);

    await prisma.crmCustomer.delete({ where: { id: customerId } });

    await auditService.logAction({
      companyId,
      actor: currentUser,
      action: 'DELETE_CUSTOMER',
      entityType: 'CUSTOMER',
      entityId: customerId,
      beforeState: existing,
      reason: `Deleted customer record: ${existing.companyName}`,
    });

    return true;
  },

  /**
   * Unified 360-degree Customer Timeline
   */
  async getCustomerTimeline(companyId, customerId) {
    const customer = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
      include: {
        contacts: {
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!customer) throw coreError('Customer not found.', 404);

    const [leads, opportunities, quotes, proformas, orders, communications, advances] = await Promise.all([
      prisma.lead.findMany({
        where: {
          companyId,
          OR: [
            { convertedCustomerId: customerId },
            { company: customer.companyName },
            { email: customer.email || '___none___' },
          ],
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crmOpportunity.findMany({
        where: { companyId, companyName: customer.companyName },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesQuotation.findMany({
        where: {
          companyId,
          OR: [{ customerId }, { customer: customer.companyName }],
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesProforma.findMany({
        where: {
          companyId,
          OR: [{ customerId }, { customer: customer.companyName }],
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salesOrder.findMany({
        where: {
          companyId,
          OR: [{ customerId }, { customer: customer.companyName }],
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crmCommunication.findMany({
        where: { companyId, customerId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customerAdvance.findMany({
        where: { companyId, customerId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      customer,
      leads,
      opportunities,
      quotations: quotes,
      proformas,
      salesOrders: orders,
      communications,
      advances,
    };
  },
};

export default customerService;
