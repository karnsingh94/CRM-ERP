const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function test() {
  const models = [
    'jobWorkOrder',
    'jobWorkOrderItem',
    'jobWorkChallan',
    'jobWorkChallanItem',
    'jobWorkMilestone',
    'jobWorkReceipt',
    'jobWorkMaterialReturn',
    'jobWorkReconciliation',
    'jobWorkReconciliationItem'
  ];

  console.log('--- Phase 6 Models Count ---');
  for (const m of models) {
    const count = await prisma[m].count();
    console.log(`${m}: ${count}`);
  }

  console.log('--- Existing Models Verification ---');
  const clientAdminCount = await prisma.clientAdmin.count();
  const productCount = await prisma.product.count();
  const vendorCount = await prisma.vendor.count();
  const warehouseCount = await prisma.inventoryWarehouse.count();
  const stockCount = await prisma.inventoryStock.count();
  const batchCount = await prisma.inventoryBatch.count();

  console.log(`ClientAdmin: ${clientAdminCount}`);
  console.log(`Product: ${productCount}`);
  console.log(`Vendor: ${vendorCount}`);
  console.log(`InventoryWarehouse: ${warehouseCount}`);
  console.log(`InventoryStock: ${stockCount}`);
  console.log(`InventoryBatch: ${batchCount}`);

  await prisma.$disconnect();
}

test().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
