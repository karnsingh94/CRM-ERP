import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const prodMod = await prisma.module.findFirst({
    where: { code: 'product' },
    include: { subModules: true },
  });
  console.log('Product Module ID:', prodMod?.id.toString(), 'serviceId:', prodMod?.serviceId.toString());
  console.log('SubModules:', prodMod?.subModules.map(sm => ({ id: sm.id.toString(), name: sm.name, code: sm.code, route: sm.route })));
}

main().finally(() => prisma.$disconnect());
