import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const customerService = {
  async listCustomers(companyId, options = {}) {
    const { search, limit, offset, status } = options;
    const where = { companyId };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search && search.trim()) {
      where.OR = [
        { companyName: { contains: search.trim() } },
        { contactPerson: { contains: search.trim() } },
        { email: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { gstin: { contains: search.trim() } },
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

    return prisma.crmCustomer.findMany(queryOptions);
  },

  async createCustomer(companyId, data) {
    if (!data.companyName?.trim()) {
      throw coreError('Company name is required.');
    }
    return prisma.crmCustomer.create({
      data: {
        companyId,
        companyName: data.companyName.trim(),
        gstin: data.gstin?.trim() || null,
        contactPerson: data.contactPerson?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        industry: data.industry?.trim() || 'Technology & IT',
        requirements: data.requirements?.trim() || null,
        assignedTo: data.assignedTo?.trim() || null,
        status: data.status?.trim() || 'ACTIVE',
      },
    });
  },

  async updateCustomer(companyId, customerId, data) {
    const existing = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) throw coreError('Customer not found.', 404);

    const updateData = {};
    if (data.companyName !== undefined) updateData.companyName = String(data.companyName).trim();
    if (data.gstin !== undefined) updateData.gstin = data.gstin ? String(data.gstin).trim() : null;
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson ? String(data.contactPerson).trim() : null;
    if (data.email !== undefined) updateData.email = data.email ? String(data.email).trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? String(data.phone).trim() : null;
    if (data.industry !== undefined) updateData.industry = data.industry ? String(data.industry).trim() : 'Technology & IT';
    if (data.requirements !== undefined) updateData.requirements = data.requirements ? String(data.requirements).trim() : null;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo ? String(data.assignedTo).trim() : null;
    if (data.status !== undefined) updateData.status = String(data.status).trim();

    return prisma.crmCustomer.update({
      where: { id: customerId },
      data: updateData,
    });
  },

  async removeCustomer(companyId, customerId) {
    const existing = await prisma.crmCustomer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!existing) throw coreError('Customer not found.', 404);
    await prisma.crmCustomer.delete({ where: { id: customerId } });
    return true;
  },
};

export default customerService;
