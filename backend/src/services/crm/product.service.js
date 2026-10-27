import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const productService = {
  async listProducts(companyId, options = {}) {
    const { search, category, status, limit, offset } = options;
    const where = { companyId };
    if (status && status !== 'ALL') where.status = status;
    if (category && category !== 'ALL') where.category = category;
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { sku: { contains: search.trim() } },
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

    return prisma.product.findMany(queryOptions);
  },

  async createProduct(companyId, data) {
    if (!data.sku?.trim() || !data.name?.trim()) {
      throw coreError('SKU code and product name are required.');
    }
    const sku = data.sku.trim().toUpperCase();
    const existing = await prisma.product.findFirst({
      where: { companyId, sku },
    });
    if (existing) throw coreError(`Product with SKU "${sku}" already exists.`);

    return prisma.product.create({
      data: {
        companyId,
        sku,
        name: data.name.trim(),
        category: data.category?.trim() || 'Finished Goods',
        uom: data.uom?.trim() || 'PCS',
        sellingPrice: parseFloat(data.sellingPrice) || 0,
        purchasePrice: parseFloat(data.purchasePrice) || 0,
        stock: parseInt(data.stock) || 0,
        status: data.status?.trim() || 'ACTIVE',
      },
    });
  },

  async removeProduct(companyId, productId) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) throw coreError('Product not found.', 404);
    await prisma.product.delete({ where: { id: productId } });
    return true;
  },
};

export default productService;
