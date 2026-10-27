import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const proformaService = {
  async listProformas(companyId, options = {}) {
    const { search, status, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (search && search.trim()) {
      where.OR = [
        { invoiceNo: { contains: search.trim() } },
        { customer: { contains: search.trim() } },
        { orderRef: { contains: search.trim() } },
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

    return prisma.salesProforma.findMany(queryOptions);
  },

  async createProforma(companyId, data) {
    if (!data.customer?.trim()) {
      throw coreError('Customer name is required.');
    }
    const invoiceNo = data.invoiceNo?.trim() || `PI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    return prisma.salesProforma.create({
      data: {
        companyId,
        invoiceNo,
        customer: data.customer.trim(),
        orderRef: data.orderRef?.trim() || null,
        amount: parseFloat(data.amount) || 0,
        date: data.date ? new Date(data.date) : new Date(),
        status: data.status?.trim() || 'ISSUED',
      },
    });
  },

  async updateProformaStatus(companyId, proformaId, status) {
    const existing = await prisma.salesProforma.findFirst({
      where: { id: proformaId, companyId },
    });
    if (!existing) throw coreError('Proforma invoice not found.', 404);
    return prisma.salesProforma.update({
      where: { id: proformaId },
      data: { status },
    });
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
