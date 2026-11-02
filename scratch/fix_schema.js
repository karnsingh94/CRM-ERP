const fs = require('fs');

let content = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');

// Normalize all line endings to \n first for consistent manipulation
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// Clean Product model
const oldProdSection = `  manufacturingBatches ManufacturingBatch[]
  manufacturingBatchMaterials ManufacturingBatchMaterial[]
  jobWorkChallanItems         JobWorkChallanItem[]
  jobWorkReceipts             JobWorkReceipt[] @relation("JobWorkReceiptInventoryBatch")
  jobWorkMaterialReturns      JobWorkMaterialReturn[]
  manufacturingQcs ManufacturingQC[]
  jobWorkOutputOrders JobWorkOrder[] @relation("JobWorkOutputProduct")
  jobWorkOrderItems JobWorkOrderItem[]
  jobWorkChallanItems JobWorkChallanItem[]
  jobWorkReconciliationItems JobWorkReconciliationItem[]`;

const newProdSection = `  manufacturingBatches ManufacturingBatch[]
  manufacturingBatchMaterials ManufacturingBatchMaterial[]
  manufacturingQcs ManufacturingQC[]
  jobWorkOutputOrders JobWorkOrder[] @relation("JobWorkOutputProduct")
  jobWorkOrderItems JobWorkOrderItem[]
  jobWorkChallanItems JobWorkChallanItem[]
  jobWorkReconciliationItems JobWorkReconciliationItem[]`;

content = content.replace(oldProdSection, newProdSection);

// Clean InventoryMovement model
const oldMovSection = `  clientAdmin ClientAdmin     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  stock       InventoryStock? @relation(fields: [stockId], references: [id], onDelete: SetNull)
  manufacturingBatchMaterials ManufacturingBatchMaterial[]
  jobWorkChallanItems         JobWorkChallanItem[]
  jobWorkReceipts             JobWorkReceipt[] @relation("JobWorkReceiptInventoryBatch")
  jobWorkMaterialReturns      JobWorkMaterialReturn[]`;

const newMovSection = `  clientAdmin ClientAdmin     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  stock       InventoryStock? @relation(fields: [stockId], references: [id], onDelete: SetNull)
  manufacturingBatchMaterials ManufacturingBatchMaterial[]`;

content = content.replace(oldMovSection, newMovSection);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync('backend/prisma/schema.prisma', content, 'utf8');
console.log('Re-normalized schema.');
