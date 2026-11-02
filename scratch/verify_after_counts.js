import fs from 'fs';
import prisma from '../backend/src/config/prisma.js';

async function main() {
  const preCounts = JSON.parse(fs.readFileSync('scratch/pre_step1_counts.json', 'utf8'));

  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'crm_erp_db'");
  const postCounts = {};
  for (const t of tables) {
    const name = t.TABLE_NAME || t.table_name;
    const res = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM `' + name + '`');
    postCounts[name] = Number(res[0].c);
  }

  const comparison = [];
  let allPreExistingMatched = true;

  for (const table of Object.keys(preCounts).sort()) {
    const pre = preCounts[table];
    const post = postCounts[table];
    if (pre !== post) {
      allPreExistingMatched = false;
    }
    comparison.push({
      table,
      preStep1Count: pre,
      postStep1Count: post,
      match: pre === post
    });
  }

  // Identify new tables added
  const newTables = Object.keys(postCounts).filter(t => preCounts[t] === undefined);

  console.log('--- STEP 1 VERIFICATION RESULTS ---');
  console.log('ALL_PRE_EXISTING_ROW_COUNTS_MATCH:', allPreExistingMatched);
  console.log('NEW_PHASE_5_TABLES_CREATED:', newTables);
  console.table(comparison.filter(c => c.preStep1Count > 0));

  fs.writeFileSync('scratch/post_step1_verification.json', JSON.stringify({
    allPreExistingMatched,
    newTables,
    comparison
  }, null, 2));

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

