import prisma from '../../config/prisma.js';

function coreError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const categoryService = {
  async listCategories(companyId, options = {}) {
    const { search } = options;
    const where = { companyId };
    if (search && search.trim()) {
      where.name = { contains: search.trim() };
    }

    const categories = await prisma.productCategory.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Compute linked product count for each category
    const productCounts = await prisma.product.groupBy({
      by: ['category'],
      where: { companyId },
      _count: { id: true },
    });

    const countMap = new Map();
    for (const row of productCounts) {
      if (row.category) {
        countMap.set(row.category.toLowerCase(), row._count.id);
      }
    }

    return categories.map((cat) => ({
      ...cat,
      productCount: countMap.get(cat.name.toLowerCase()) || 0,
    }));
  },

  async createCategory(companyId, data) {
    if (!data.name?.trim()) {
      throw coreError('Category name is required.');
    }
    const name = data.name.trim();

    // Check duplicate name within tenant
    const existing = await prisma.productCategory.findFirst({
      where: {
        companyId,
        name: { equals: name },
      },
    });
    if (existing) {
      throw coreError(`Category "${name}" already exists in your company catalogue.`);
    }

    return prisma.productCategory.create({
      data: {
        companyId,
        name,
        description: data.description?.trim() || null,
      },
    });
  },

  async updateCategory(companyId, categoryId, data) {
    const existing = await prisma.productCategory.findFirst({
      where: { id: categoryId, companyId },
    });
    if (!existing) throw coreError('Category not found.', 404);

    const updateData = {};
    let newName = null;

    if (data.name !== undefined) {
      newName = data.name.trim();
      if (!newName) throw coreError('Category name cannot be empty.');

      if (newName.toLowerCase() !== existing.name.toLowerCase()) {
        const conflict = await prisma.productCategory.findFirst({
          where: {
            companyId,
            name: { equals: newName },
            id: { not: categoryId },
          },
        });
        if (conflict) {
          throw coreError(`Category "${newName}" already exists in your company catalogue.`);
        }
      }
      updateData.name = newName;
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.productCategory.update({
        where: { id: categoryId },
        data: updateData,
      });

      // If category name was renamed, update linked products in this company
      if (newName && newName !== existing.name) {
        await tx.product.updateMany({
          where: { companyId, category: existing.name },
          data: { category: newName },
        });
      }

      return updated;
    });
  },

  async removeCategory(companyId, categoryId) {
    const existing = await prisma.productCategory.findFirst({
      where: { id: categoryId, companyId },
    });
    if (!existing) throw coreError('Category not found.', 404);

    // Enforce safety: do not cascade delete products
    const linkedCount = await prisma.product.count({
      where: { companyId, category: existing.name },
    });

    if (linkedCount > 0) {
      throw coreError(
        `Cannot delete category "${existing.name}" because it is linked to ${linkedCount} product(s). Please reassign or update linked products first before removing this category.`,
        400
      );
    }

    await prisma.productCategory.delete({
      where: { id: categoryId },
    });

    return true;
  },
};

export default categoryService;

