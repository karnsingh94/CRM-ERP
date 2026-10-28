import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const pricingService = {
  async listPricings(companyId, options = {}) {
    const { productId, search, status } = options;
    const where = { companyId };
    if (productId) where.productId = productId;
    if (status && status !== 'ALL') where.status = status;

    if (search && search.trim()) {
      where.OR = [
        { planName: { contains: search.trim() } },
        { product: { name: { contains: search.trim() } } },
        { product: { sku: { contains: search.trim() } } },
      ];
    }

    return prisma.productPricing.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            category: true,
            uom: true,
            status: true,
          },
        },
      },
    });
  },

  async createPricing(companyId, data) {
    if (!data.productId) {
      throw coreError('Product selection is required for configuring pricing.');
    }
    if (!data.planName?.trim()) {
      throw coreError('Plan name (e.g. Standard, Wholesale, Retail) is required.');
    }

    const product = await prisma.product.findFirst({
      where: { id: data.productId, companyId },
    });
    if (!product) throw coreError('Selected product not found in your company catalogue.', 404);

    const sellingPrice = data.sellingPrice !== undefined && data.sellingPrice !== '' ? parseFloat(data.sellingPrice) : 0;
    const purchasePrice = data.purchasePrice !== undefined && data.purchasePrice !== '' ? parseFloat(data.purchasePrice) : 0;
    const taxRate = data.taxRate !== undefined && data.taxRate !== '' ? parseFloat(data.taxRate) : 18.0;
    const discountRate = data.discountRate !== undefined && data.discountRate !== '' ? parseFloat(data.discountRate) : 0.0;

    if (isNaN(sellingPrice) || sellingPrice < 0) {
      throw coreError('Selling rate cannot be negative.');
    }
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      throw coreError('Purchase rate cannot be negative.');
    }
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      throw coreError('Tax percentage must be between 0 and 100.');
    }
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
      throw coreError('Discount percentage must be between 0 and 100.');
    }

    const isDefault = Boolean(data.isDefault);

    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Unmark previous defaults for this product
        await tx.productPricing.updateMany({
          where: { companyId, productId: product.id },
          data: { isDefault: false },
        });

        // Synchronize default price with Product master
        await tx.product.update({
          where: { id: product.id },
          data: { sellingPrice, purchasePrice, taxRate },
        });
      }

      return tx.productPricing.create({
        data: {
          companyId,
          productId: product.id,
          planName: data.planName.trim(),
          sellingPrice,
          purchasePrice,
          taxRate,
          discountRate,
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          isDefault,
          status: data.status?.trim() || 'ACTIVE',
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              category: true,
              uom: true,
            },
          },
        },
      });
    });
  },

  async updatePricing(companyId, pricingId, data) {
    const existing = await prisma.productPricing.findFirst({
      where: { id: pricingId, companyId },
    });
    if (!existing) throw coreError('Pricing record not found.', 404);

    const updateData = {};

    if (data.planName !== undefined) {
      if (!data.planName.trim()) throw coreError('Plan name cannot be empty.');
      updateData.planName = data.planName.trim();
    }

    let sellingPrice = existing.sellingPrice;
    if (data.sellingPrice !== undefined && data.sellingPrice !== '') {
      const parsed = parseFloat(data.sellingPrice);
      if (isNaN(parsed) || parsed < 0) throw coreError('Selling rate cannot be negative.');
      updateData.sellingPrice = parsed;
      sellingPrice = parsed;
    }

    let purchasePrice = existing.purchasePrice;
    if (data.purchasePrice !== undefined && data.purchasePrice !== '') {
      const parsed = parseFloat(data.purchasePrice);
      if (isNaN(parsed) || parsed < 0) throw coreError('Purchase rate cannot be negative.');
      updateData.purchasePrice = parsed;
      purchasePrice = parsed;
    }

    if (data.taxRate !== undefined && data.taxRate !== '') {
      const parsed = parseFloat(data.taxRate);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) throw coreError('Tax percentage must be between 0 and 100.');
      updateData.taxRate = parsed;
    }

    if (data.discountRate !== undefined && data.discountRate !== '') {
      const parsed = parseFloat(data.discountRate);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) throw coreError('Discount percentage must be between 0 and 100.');
      updateData.discountRate = parsed;
    }

    if (data.validFrom !== undefined) {
      updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    }
    if (data.validUntil !== undefined) {
      updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    }
    if (data.status !== undefined) {
      updateData.status = data.status.trim() || 'ACTIVE';
    }

    const isDefault = data.isDefault !== undefined ? Boolean(data.isDefault) : existing.isDefault;
    updateData.isDefault = isDefault;

    return prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.productPricing.updateMany({
          where: { companyId, productId: existing.productId, id: { not: pricingId } },
          data: { isDefault: false },
        });

        // Sync default rate into product master
        const syncData = {
          sellingPrice: parseFloat(sellingPrice),
          purchasePrice: parseFloat(purchasePrice),
        };
        if (updateData.taxRate !== undefined) {
          syncData.taxRate = updateData.taxRate;
        }
        await tx.product.update({
          where: { id: existing.productId },
          data: syncData,
        });
      }

      return tx.productPricing.update({
        where: { id: pricingId },
        data: updateData,
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              category: true,
              uom: true,
            },
          },
        },
      });
    });
  },

  async removePricing(companyId, pricingId) {
    const existing = await prisma.productPricing.findFirst({
      where: { id: pricingId, companyId },
    });
    if (!existing) throw coreError('Pricing record not found.', 404);

    // If default pricing is being removed, check if other pricings exist
    if (existing.isDefault) {
      const other = await prisma.productPricing.findFirst({
        where: { companyId, productId: existing.productId, id: { not: pricingId } },
        orderBy: { createdAt: 'desc' },
      });
      if (other) {
        await prisma.productPricing.update({
          where: { id: other.id },
          data: { isDefault: true },
        });
        await prisma.product.update({
          where: { id: existing.productId },
          data: {
            sellingPrice: other.sellingPrice,
            purchasePrice: other.purchasePrice,
          },
        });
      }
    }

    await prisma.productPricing.delete({ where: { id: pricingId } });
    return true;
  },
};

export default pricingService;

