import prisma from '../backend/src/config/prisma.js';

async function main() {
  const prodTables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'crm_erp_db'
  `);
  const tempTables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'crm_erp_db_restore_val_temp'
  `);

  const results = [];
  let allMatched = true;

  for (const t of prodTables) {
    const name = t.TABLE_NAME || t.table_name;
    const prodCountRes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM `crm_erp_db`.`' + name + '`');
    const tempCountRes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM `crm_erp_db_restore_val_temp`.`' + name + '`');
    const prodCount = Number(prodCountRes[0].c);
    const tempCount = Number(tempCountRes[0].c);
    if (prodCount !== tempCount) allMatched = false;
    results.push({ table: name, prodCount, tempCount, match: prodCount === tempCount });
  }

  console.log('TABLES_IN_PROD:', prodTables.length, 'TABLES_IN_TEMP:', tempTables.length);
  console.log('ALL_ROW_COUNTS_MATCH:', allMatched);
  console.table(results.filter(r => r.prodCount > 0));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

