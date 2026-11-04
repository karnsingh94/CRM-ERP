const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const prodM = await prisma.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at FROM crm_erp_db._prisma_migrations ORDER BY finished_at ASC').catch(e => ({ error: e.message }));
  console.log('crm_erp_db migrations count:', Array.isArray(prodM) ? prodM.length : prodM);
  if (Array.isArray(prodM)) {
    console.log('crm_erp_db migrations:', prodM.map(m => m.migration_name));
  }
  
  const testM = await prisma.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at FROM crm_erp_test_db._prisma_migrations ORDER BY finished_at ASC').catch(e => ({ error: e.message }));
  console.log('crm_erp_test_db migrations count:', Array.isArray(testM) ? testM.length : testM);
  if (Array.isArray(testM)) {
    console.log('crm_erp_test_db migrations:', testM.map(m => m.migration_name));
  }
  
  await prisma.$disconnect();
}
main();

