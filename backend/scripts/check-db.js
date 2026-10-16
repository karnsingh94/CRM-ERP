import prisma from '../src/config/prisma.js';
import logger from '../src/utils/logger.js';

async function main() {
  logger.info('Running database diagnostic check...');
  try {
    const tables = await prisma.$queryRawUnsafe('SHOW TABLES;');
    console.log('Tables:', tables);

    const clients = await prisma.clientAdmin.findMany({
      select: { id: true, name: true, organizationName: true },
    });
    console.log('Clients:', clients);

    const services = await prisma.service.findMany({
      select: { id: true, name: true, code: true },
    });
    console.log('Services:', services);

    logger.info('Database diagnostic check completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error('Database diagnostic error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
