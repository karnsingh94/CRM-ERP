import fs from 'fs';
import prisma from '../backend/src/config/prisma.js';

async function main() {
  // 1. Read pre-Phase 4 backup
  const backupContent = fs.readFileSync('database_backups/crm_erp_db_pre_phase4_backup.sql', 'utf8');
  const lines = backupContent.split('\n');
  const backupCounts = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('INSERT INTO `')) {
      const match = trimmed.match(/^INSERT INTO `([^`]+)`/);
      if (match) {
        const table = match[1];
        const count = (trimmed.match(/\),\(/g) || []).length + 1;
        backupCounts[table] = (backupCounts[table] || 0) + count;
      }
    }
  }

  // 2. Query live table counts directly via SQL information_schema / table names
  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'crm_erp_db'");

  const liveCounts = {};
  for (const t of tables) {
    const name = t.TABLE_NAME || t.table_name;
    try {
      const countRes = await prisma.$queryRawUnsafe('SELECT COUNT(*) as c FROM `' + name + '`');
      liveCounts[name] = Number(countRes[0].c);
    } catch (e) {
      liveCounts[name] = 'ERROR: ' + e.message;
    }
  }

  // 3. Detailed inspection of suspicious products and records
  const allProducts = await prisma.product.findMany();
  const allStocks = await prisma.inventoryStock.findMany();
  const allBatches = await prisma.inventoryBatch.findMany();
  const allMovements = await prisma.inventoryMovement.findMany();
  const allPOs = await prisma.purchaseOrder.findMany();
  const allGRNs = await prisma.purchaseReceipt.findMany();
  const allSOs = await prisma.salesOrder.findMany();

  // 4. Foreign key integrity checks
  // Check for orphan stocks (pointing to non-existent company)
  const orphanStocks = await prisma.$queryRawUnsafe(
    'SELECT s.id, s.sku, s.company_id, s.product_id FROM inventory_stocks s LEFT JOIN Admins c ON s.company_id = c.id WHERE c.id IS NULL'
  );

  // Check for orphan batches
  const orphanBatches = await prisma.$queryRawUnsafe(
    'SELECT b.id, b.batch_no, b.company_id, b.stock_id FROM inventory_batches b LEFT JOIN Admins c ON b.company_id = c.id WHERE c.id IS NULL'
  );

  // Check for orphan movements
  const orphanMovements = await prisma.$queryRawUnsafe(
    'SELECT m.id, m.movement_no, m.company_id, m.stock_id FROM inventory_movements m LEFT JOIN Admins c ON m.company_id = c.id WHERE c.id IS NULL'
  );

  // Check for orphan POs
  const orphanPOs = await prisma.$queryRawUnsafe(
    'SELECT po.id, po.po_number, po.company_id, po.vendor_id FROM purchase_orders po LEFT JOIN Admins c ON po.company_id = c.id LEFT JOIN vendors v ON po.vendor_id = v.id WHERE c.id IS NULL OR v.id IS NULL'
  );

  // Check for orphan GRNs
  const orphanGRNs = await prisma.$queryRawUnsafe(
    'SELECT grn.id, grn.grn_no, grn.company_id, grn.order_id FROM purchase_receipts grn LEFT JOIN Admins c ON grn.company_id = c.id LEFT JOIN purchase_orders po ON grn.order_id = po.id WHERE c.id IS NULL OR po.id IS NULL'
  );

  // Check for orphan SOs
  const orphanSOs = await prisma.$queryRawUnsafe(
    'SELECT so.id, so.order_no, so.company_id, so.customer_id FROM sales_orders so LEFT JOIN Admins c ON so.company_id = c.id WHERE c.id IS NULL'
  );

  const report = {
    backupCounts,
    liveCounts,
    allProducts,
    allStocksCount: allStocks.length,
    allBatchesCount: allBatches.length,
    allMovementsCount: allMovements.length,
    allPOsCount: allPOs.length,
    allGRNsCount: allGRNs.length,
    allSOsCount: allSOs.length,
    orphanCounts: {
      orphanStocks: orphanStocks.length,
      orphanBatches: orphanBatches.length,
      orphanMovements: orphanMovements.length,
      orphanPOs: orphanPOs.length,
      orphanGRNs: orphanGRNs.length,
      orphanSOs: orphanSOs.length
    },
    samplePOs: allPOs.map(p => ({ id: p.id, poNumber: p.poNumber, vendorId: p.vendorId, createdAt: p.createdAt })),
    sampleGRNs: allGRNs.map(g => ({ id: g.id, grnNo: g.grnNo, orderId: g.orderId, createdAt: g.createdAt })),
    sampleSOs: allSOs.map(s => ({ id: s.id, orderNo: s.orderNo, customerId: s.customerId, createdAt: s.createdAt })),
    stockSKUs: allStocks.map(s => ({ id: s.id, sku: s.sku, name: s.name, stock: s.stock, availableQty: s.availableQty, productId: s.productId })),
    batchSKUs: allBatches.map(b => ({ id: b.id, batchNo: b.batchNo, sku: b.sku, availableQty: b.availableQty, grnNo: b.grnNo, createdAt: b.createdAt })),
    movementSKUs: allMovements.map(m => ({ id: m.id, movementNo: m.movementNo, movementType: m.movementType, sku: m.sku, quantity: m.quantity, createdAt: m.createdAt }))
  };

  fs.writeFileSync('scratch/reconciliation_result.json', JSON.stringify(report, null, 2));
  console.log('RECONCILIATION_SUCCESS');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('RECONCILIATION_ERROR', err);
  process.exit(1);
});
