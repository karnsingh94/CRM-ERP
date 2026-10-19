import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Update Product Master route to /products
  await prisma.subModule.update({
    where: { id: 5n },
    data: {
      name: 'Product Directory',
      route: '/products',
    },
  });

  // 2. Update Price Management route to /products/pricing
  await prisma.subModule.update({
    where: { id: 6n },
    data: {
      name: 'Pricing & Plans',
      route: '/products/pricing',
    },
  });

  // 3. Check or Create Categories subModule
  const existingCat = await prisma.subModule.findFirst({
    where: {
      moduleId: 2n,
      code: 'categories',
    },
  });

  if (!existingCat) {
    const createdCat = await prisma.subModule.create({
      data: {
        moduleId: 2n,
        serviceId: 1n,
        name: 'Categories',
        code: 'categories',
        route: '/products/categories',
        orderNo: 2,
        status: 'ACTIVE',
      },
    });
    console.log('Created Categories submodule with ID:', createdCat.id.toString());
  } else {
    console.log('Categories submodule already exists with ID:', existingCat.id.toString());
  }

  // 4. Update order numbers so they are 1, 2, 3
  await prisma.subModule.update({ where: { id: 5n }, data: { orderNo: 1 } });
  await prisma.subModule.update({ where: { id: 6n }, data: { orderNo: 3 } });

  console.log('Updated Product Master and Price Management submodules!');
}

main().finally(() => prisma.$disconnect());
