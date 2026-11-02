import fs from 'fs';
import prisma from '../backend/src/config/prisma.js';

async function main() {
  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'crm_erp_db'");
  const counts = {};
  for (const t of tables) {
    const name = t.TABLE_NAME || t.table_name;
    const res = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM `' + name + '`');
    counts[name] = Number(res[0].c);
  }
  fs.writeFileSync('scratch/pre_step1_counts.json', JSON.stringify(counts, null, 2));
  console.log('BASELINE_RECORDED:', Object.keys(counts).length, 'tables');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

