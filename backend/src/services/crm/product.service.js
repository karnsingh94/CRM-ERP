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
      include: {
        pricings: {
          where: { isDefault: true },
          take: 1,
        },
      },
    };

    if (limit && Number(limit) > 0) {
      queryOptions.take = Math.min(Number(limit), 200);
      if (offset && Number(offset) >= 0) {
        queryOptions.skip = Number(offset);
      }
    }

    const products = await prisma.product.findMany(queryOptions);

    // Read real available stock from InventoryStock system
    const inventoryStocks = await prisma.inventoryStock.groupBy({
      by: ['sku'],
      where: { companyId },
      _sum: { stock: true },
    });

    const stockBySku = new Map();
    for (const item of inventoryStocks) {
      stockBySku.set(item.sku, item._sum.stock || 0);
    }

    return products.map((p) => {
      const realStock = stockBySku.has(p.sku) ? stockBySku.get(p.sku) : (p.stock || 0);
      return {
        ...p,
        stock: realStock,
      };
    });
  },

  async getProduct(companyId, productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, companyId },
      include: {
        pricings: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!product) throw coreError('Product not found.', 404);

    const inventorySum = await prisma.inventoryStock.aggregate({
      where: { companyId, sku: product.sku },
      _sum: { stock: true },
    });
    const realStock = inventorySum._sum.stock !== null ? inventorySum._sum.stock : (product.stock || 0);

    return {
      ...product,
      stock: realStock,
    };
  },

  async createProduct(companyId, data) {
    if (!data.sku?.trim() || !data.name?.trim()) {
      throw coreError('SKU code and product name are required.');
    }
    const sku = data.sku.trim().toUpperCase();
    const existing = await prisma.product.findFirst({
      where: { companyId, sku },
    });
    if (existing) throw coreError(`Product with SKU "${sku}" already exists in your company catalogue.`);

    const sellingPrice = data.sellingPrice !== undefined && data.sellingPrice !== '' ? parseFloat(data.sellingPrice) : 0;
    const purchasePrice = data.purchasePrice !== undefined && data.purchasePrice !== '' ? parseFloat(data.purchasePrice) : 0;
    const taxRate = data.taxRate !== undefined && data.taxRate !== '' ? parseFloat(data.taxRate) : 18.0;

    if (isNaN(sellingPrice) || sellingPrice < 0) {
      throw coreError('Selling rate cannot be negative.');
    }
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      throw coreError('Purchase rate cannot be negative.');
    }
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      throw coreError('GST / Tax rate must be between 0% and 100%.');
    }

    if (!data.category?.trim()) {
      throw coreError('Category is required. Please create and select a category in the Categories tab first.', 400);
    }
    const category = data.category.trim();

    // Verify category exists in ProductCategory master
    const existingCat = await prisma.productCategory.findFirst({
      where: { companyId, name: category },
    });
    if (!existingCat) {
      throw coreError(`Category "${category}" does not exist. Please create it first in the Categories tab.`, 400);
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create product master record (stock defaults to 0 as stock is managed in InventoryStock)
      const product = await tx.product.create({
        data: {
          companyId,
          sku,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          category,
          uom: data.uom?.trim() || 'PCS',
          sellingPrice,
          purchasePrice,
          taxRate,
          stock: 0,
          status: data.status?.trim() || 'ACTIVE',
        },
      });

      // 2. Initialize default standard pricing record
      await tx.productPricing.create({
        data: {
          companyId,
          productId: product.id,
          planName: 'Standard Rate',
          sellingPrice,
          purchasePrice,
          taxRate,
          discountRate: 0.0,
          isDefault: true,
          status: 'ACTIVE',
        },
      });

      return product;
    });
  },

  async updateProduct(companyId, productId, data) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, companyId },
    });
    if (!existing) throw coreError('Product not found.', 404);

    const updateData = {};

    if (data.sku !== undefined) {
      const newSku = data.sku.trim().toUpperCase();
      if (!newSku) throw coreError('SKU code cannot be empty.');
      if (newSku !== existing.sku) {
        const skuConflict = await prisma.product.findFirst({
          where: { companyId, sku: newSku },
        });
        if (skuConflict) throw coreError(`Product with SKU "${newSku}" already exists.`);
        updateData.sku = newSku;
      }
    }

    if (data.name !== undefined) {
      if (!data.name.trim()) throw coreError('Product name cannot be empty.');
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.category !== undefined) {
      const category = data.category?.trim();
      if (!category) throw coreError('Category cannot be empty.', 400);
      const existingCat = await prisma.productCategory.findFirst({
        where: { companyId, name: category },
      });
      if (!existingCat) {
        throw coreError(`Category "${category}" does not exist. Please create it first in the Categories tab.`, 400);
      }
      updateData.category = category;
    }

    if (data.uom !== undefined) {
      updateData.uom = data.uom.trim() || 'PCS';
    }

    if (data.status !== undefined) {
      updateData.status = data.status.trim() || 'ACTIVE';
    }

    let sellingPrice = undefined;
    if (data.sellingPrice !== undefined && data.sellingPrice !== '') {
      sellingPrice = parseFloat(data.sellingPrice);
      if (isNaN(sellingPrice) || sellingPrice < 0) {
        throw coreError('Selling rate cannot be negative.');
      }
      updateData.sellingPrice = sellingPrice;
    }

    let purchasePrice = undefined;
    if (data.purchasePrice !== undefined && data.purchasePrice !== '') {
      purchasePrice = parseFloat(data.purchasePrice);
      if (isNaN(purchasePrice) || purchasePrice < 0) {
        throw coreError('Purchase rate cannot be negative.');
      }
      updateData.purchasePrice = purchasePrice;
    }

    if (data.taxRate !== undefined && data.taxRate !== '') {
      const parsedTax = parseFloat(data.taxRate);
      if (isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) {
        throw coreError('GST / Tax rate must be between 0% and 100%.');
      }
      updateData.taxRate = parsedTax;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: updateData,
      });

      // Synchronize default standard pricing record if price changed
      if (sellingPrice !== undefined || purchasePrice !== undefined) {
        const defaultPricing = await tx.productPricing.findFirst({
          where: { companyId, productId, isDefault: true },
        });

        if (defaultPricing) {
          const pricingUpdate = {};
          if (sellingPrice !== undefined) pricingUpdate.sellingPrice = sellingPrice;
          if (purchasePrice !== undefined) pricingUpdate.purchasePrice = purchasePrice;
          await tx.productPricing.update({
            where: { id: defaultPricing.id },
            data: pricingUpdate,
          });
        }
      }

      return updated;
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
