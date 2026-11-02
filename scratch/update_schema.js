const fs = require('fs');

let content = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');
const isCRLF = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Remove stray jobWorkOrders from Product model (line 629)
content = content.replace(
  '  productionOrders ProductionOrder[]\n  jobWorkOrders    JobWorkOrder[]\n  materialRequirements ProductionMaterialRequirement[]',
  '  productionOrders ProductionOrder[]\n  materialRequirements ProductionMaterialRequirement[]'
);

// 2. Remove accidental jobWork lines from InventoryMovement (lines 1283-1284)
content = content.replace(
  '  manufacturingBatchMaterials ManufacturingBatchMaterial[]\n  jobWorkChallanItems         JobWorkChallanItem[]\n  jobWorkReceipts             JobWorkReceipt[] @relation("JobWorkReceiptInventoryBatch")',
  '  manufacturingBatchMaterials ManufacturingBatchMaterial[]'
);

// 3. Add jobWorkOrders to ProductionOrder
content = content.replace(
  '  qcInspections    ManufacturingQC[]\n\n  @@unique([companyId, orderNo])',
  '  qcInspections    ManufacturingQC[]\n  jobWorkOrders    JobWorkOrder[]\n\n  @@unique([companyId, orderNo])'
);

// 4. Append Phase 6 models
const phase6Models = `
// ====================================================================
// PHASE 6: CONTRACT MANUFACTURING / EXTERNAL SUPPLIER PRODUCTION
// ====================================================================

model JobWorkOrder {
  id                 String                   @id @default(uuid()) @db.Char(36)
  companyId          String                   @map("company_id") @db.Char(36)
  orderNo            String                   @map("order_no") @db.VarChar(60)
  vendorId           String                   @map("vendor_id") @db.Char(36)
  productionOrderId  String?                  @map("production_order_id") @db.Char(36)
  outputProductId    String                   @map("output_product_id") @db.Char(36)
  bomId              String                   @map("bom_id") @db.Char(36)
  targetQuantity     Decimal                  @map("target_quantity") @db.Decimal(14, 4)
  receivedQuantity   Decimal                  @default(0.0000) @map("received_quantity") @db.Decimal(14, 4)
  rejectedQuantity   Decimal                  @default(0.0000) @map("rejected_quantity") @db.Decimal(14, 4)
  uom                String                   @default("KG") @db.VarChar(20)
  conversionRate     Decimal                  @default(0.00) @map("conversion_rate") @db.Decimal(14, 2)
  estimatedTotalCost Decimal                  @default(0.00) @map("estimated_total_cost") @db.Decimal(14, 2)
  taxableValue       Decimal                  @default(0.00) @map("taxable_value") @db.Decimal(14, 2)
  status             String                   @default("DRAFT") @db.VarChar(30)
  issueDate          DateTime                 @default(now()) @map("issue_date")
  expectedReturnDate DateTime?                @map("expected_return_date")
  deliveryAddress    String?                  @map("delivery_address") @db.Text
  termsAndConditions String?                  @map("terms_and_conditions") @db.Text
  versionNumber      Int                      @default(1) @map("version_number")
  isLocked           Boolean                  @default(false) @map("is_locked")
  createdById        String?                  @map("created_by_id") @db.Char(36)
  approvedById       String?                  @map("approved_by_id") @db.Char(36)
  approvedAt         DateTime?                @map("approved_at")
  createdAt          DateTime                 @default(now()) @map("created_at")
  updatedAt          DateTime                 @updatedAt @map("updated_at")

  clientAdmin        ClientAdmin              @relation(fields: [companyId], references: [id], onDelete: Cascade)
  vendor             Vendor                   @relation(fields: [vendorId], references: [id], onDelete: Restrict)
  productionOrder    ProductionOrder?         @relation(fields: [productionOrderId], references: [id], onDelete: SetNull)
  outputProduct      Product                  @relation("JobWorkOutputProduct", fields: [outputProductId], references: [id], onDelete: Restrict)
  bom                BomMaster                @relation(fields: [bomId], references: [id], onDelete: Restrict)
  items              JobWorkOrderItem[]
  challans           JobWorkChallan[]
  milestones         JobWorkMilestone[]
  receipts           JobWorkReceipt[]
  materialReturns    JobWorkMaterialReturn[]
  reconciliations    JobWorkReconciliation[]

  @@unique([companyId, orderNo])
  @@index([companyId, vendorId])
  @@index([companyId, outputProductId])
  @@index([companyId, status])
  @@map("job_work_orders")
}

model JobWorkOrderItem {
  id                 String       @id @default(uuid()) @db.Char(36)
  companyId          String       @map("company_id") @db.Char(36)
  jobWorkOrderId     String       @map("job_work_order_id") @db.Char(36)
  productId          String       @map("product_id") @db.Char(36)
  itemType           String       @default("RAW_MATERIAL") @map("item_type") @db.VarChar(30)
  requiredQuantity   Decimal      @map("required_quantity") @db.Decimal(14, 4)
  dispatchedQuantity Decimal      @default(0.0000) @map("dispatched_quantity") @db.Decimal(14, 4)
  consumedQuantity   Decimal      @default(0.0000) @map("consumed_quantity") @db.Decimal(14, 4)
  returnedQuantity   Decimal      @default(0.0000) @map("returned_quantity") @db.Decimal(14, 4)
  uom                String       @default("KG") @db.VarChar(20)
  scrapTolerancePct  Decimal      @default(0.00) @map("scrap_tolerance_pct") @db.Decimal(5, 2)
  standardUnitCost   Decimal      @default(0.00) @map("standard_unit_cost") @db.Decimal(14, 2)
  createdAt          DateTime     @default(now()) @map("created_at")

  jobWorkOrder       JobWorkOrder @relation(fields: [jobWorkOrderId], references: [id], onDelete: Cascade)
  product            Product      @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([companyId, jobWorkOrderId])
  @@index([companyId, productId])
  @@map("job_work_order_items")
}

model JobWorkChallan {
  id                    String               @id @default(uuid()) @db.Char(36)
  companyId             String               @map("company_id") @db.Char(36)
  challanNo             String               @map("challan_no") @db.VarChar(60)
  jobWorkOrderId        String               @map("job_work_order_id") @db.Char(36)
  vendorId              String               @map("vendor_id") @db.Char(36)
  warehouseId           String               @map("warehouse_id") @db.Char(36)
  dispatchDate          DateTime             @default(now()) @map("dispatch_date")
  statutory1YearDueDate DateTime?            @map("statutory_1_year_due_date")
  transporterName       String?              @map("transporter_name") @db.VarChar(120)
  vehicleNo             String?              @map("vehicle_no") @db.VarChar(40)
  lrNumber              String?              @map("lr_number") @db.VarChar(60)
  eWayBillNo            String?              @map("eway_bill_no") @db.VarChar(60)
  destinationAddress    String               @map("destination_address") @db.Text
  totalTaxableValue     Decimal              @default(0.00) @map("total_taxable_value") @db.Decimal(14, 2)
  status                String               @default("DISPATCHED") @db.VarChar(30)
  acknowledgedAt        DateTime?            @map("acknowledged_at")
  acknowledgedBy        String?              @map("acknowledged_by") @db.VarChar(150)
  statutoryDeclaration  String?              @map("statutory_declaration") @db.VarChar(255)
  notes                 String?              @db.Text
  createdById           String?              @map("created_by_id") @db.Char(36)
  createdAt             DateTime             @default(now()) @map("created_at")

  clientAdmin           ClientAdmin          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  jobWorkOrder          JobWorkOrder         @relation(fields: [jobWorkOrderId], references: [id], onDelete: Restrict)
  vendor                Vendor               @relation(fields: [vendorId], references: [id], onDelete: Restrict)
  warehouse             InventoryWarehouse   @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  items                 JobWorkChallanItem[]

  @@unique([companyId, challanNo])
  @@index([companyId, jobWorkOrderId])
  @@index([companyId, vendorId])
  @@map("job_work_challans")
}

model JobWorkChallanItem {
  id                 String             @id @default(uuid()) @db.Char(36)
  companyId          String             @map("company_id") @db.Char(36)
  challanId          String             @map("challan_id") @db.Char(36)
  productId          String             @map("product_id") @db.Char(36)
  rmBatchId          String             @map("rm_batch_id") @db.Char(36)
  rmBatchNo          String             @map("rm_batch_no") @db.VarChar(60)
  sku                String             @db.VarChar(60)
  hsnCode            String?            @map("hsn_code") @db.VarChar(20)
  quantityDispatched Decimal            @map("quantity_dispatched") @db.Decimal(14, 4)
  uom                String             @default("KG") @db.VarChar(20)
  unitCost           Decimal            @default(0.00) @map("unit_cost") @db.Decimal(14, 2)
  taxableValue       Decimal            @default(0.00) @map("taxable_value") @db.Decimal(14, 2)
  movementId         String?            @map("movement_id") @db.Char(36)

  challan            JobWorkChallan     @relation(fields: [challanId], references: [id], onDelete: Cascade)
  product            Product            @relation(fields: [productId], references: [id], onDelete: Restrict)
  rmBatch            InventoryBatch     @relation(fields: [rmBatchId], references: [id], onDelete: Restrict)

  @@index([companyId, challanId])
  @@index([companyId, productId])
  @@index([companyId, rmBatchId])
  @@map("job_work_challan_items")
}

model JobWorkMilestone {
  id                String       @id @default(uuid()) @db.Char(36)
  companyId         String       @map("company_id") @db.Char(36)
  jobWorkOrderId    String       @map("job_work_order_id") @db.Char(36)
  milestoneType     String       @map("milestone_type") @db.VarChar(50)
  statusDate        DateTime     @default(now()) @map("status_date")
  reportedOutputQty Decimal?     @map("reported_output_qty") @db.Decimal(14, 4)
  reportedScrapQty  Decimal?     @map("reported_scrap_qty") @db.Decimal(14, 4)
  remarks           String?      @db.Text
  attachmentUri     String?      @map("attachment_uri") @db.VarChar(255)
  createdById       String?      @map("created_by_id") @db.Char(36)
  createdAt         DateTime     @default(now()) @map("created_at")

  jobWorkOrder      JobWorkOrder @relation(fields: [jobWorkOrderId], references: [id], onDelete: Cascade)

  @@index([companyId, jobWorkOrderId])
  @@map("job_work_milestones")
}

model JobWorkReceipt {
  id                      String              @id @default(uuid()) @db.Char(36)
  companyId               String              @map("company_id") @db.Char(36)
  receiptNo               String              @map("receipt_no") @db.VarChar(60)
  jobWorkOrderId          String              @map("job_work_order_id") @db.Char(36)
  challanNo               String?             @map("challan_no") @db.VarChar(60)
  vendorDeliveryNote      String?             @map("vendor_delivery_note") @db.VarChar(60)
  warehouseId             String              @map("warehouse_id") @db.Char(36)
  receivedQty             Decimal             @map("received_qty") @db.Decimal(14, 4)
  acceptedQty             Decimal             @default(0.0000) @map("accepted_qty") @db.Decimal(14, 4)
  rejectedQty             Decimal             @default(0.0000) @map("rejected_qty") @db.Decimal(14, 4)
  uom                     String              @default("KG") @db.VarChar(20)
  vendorBatchNo           String?             @map("vendor_batch_no") @db.VarChar(60)
  createdInventoryBatchId String?             @map("created_inventory_batch_id") @db.Char(36)
  qcStatus                String              @default("PENDING_QC") @map("qc_status") @db.VarChar(30)
  qcInspectionId          String?             @map("qc_inspection_id") @db.Char(36)
  qcRemarks               String?             @map("qc_remarks") @db.Text
  isRework                Boolean             @default(false) @map("is_rework")
  originalReceiptId       String?             @map("original_receipt_id") @db.Char(36)
  receivedById            String?             @map("received_by_id") @db.Char(36)
  receivedAt              DateTime            @default(now()) @map("received_at")

  clientAdmin             ClientAdmin         @relation(fields: [companyId], references: [id], onDelete: Cascade)
  jobWorkOrder            JobWorkOrder        @relation(fields: [jobWorkOrderId], references: [id], onDelete: Restrict)
  warehouse               InventoryWarehouse  @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  createdInventoryBatch   InventoryBatch?     @relation("JobWorkReceiptInventoryBatch", fields: [createdInventoryBatchId], references: [id], onDelete: SetNull)

  @@unique([companyId, receiptNo])
  @@index([companyId, jobWorkOrderId])
  @@index([companyId, qcStatus])
  @@map("job_work_receipts")
}

model JobWorkMaterialReturn {
  id               String          @id @default(uuid()) @db.Char(36)
  companyId        String          @map("company_id") @db.Char(36)
  returnNo         String          @map("return_no") @db.VarChar(60)
  jobWorkOrderId   String          @map("job_work_order_id") @db.Char(36)
  vendorId         String          @map("vendor_id") @db.Char(36)
  warehouseId      String          @map("warehouse_id") @db.Char(36)
  productId        String          @map("product_id") @db.Char(36)
  rmBatchId        String          @map("rm_batch_id") @db.Char(36)
  rmBatchNo        String          @map("rm_batch_no") @db.VarChar(60)
  sku              String          @db.VarChar(60)
  quantityReturned Decimal         @map("quantity_returned") @db.Decimal(14, 4)
  uom              String          @default("KG") @db.VarChar(20)
  reason           String?         @db.VarChar(255)
  returnedAt       DateTime        @default(now()) @map("returned_at")
  receivedById     String?         @map("received_by_id") @db.Char(36)

  jobWorkOrder     JobWorkOrder    @relation(fields: [jobWorkOrderId], references: [id], onDelete: Restrict)
  vendor           Vendor          @relation(fields: [vendorId], references: [id], onDelete: Restrict)
  rmBatch          InventoryBatch  @relation(fields: [rmBatchId], references: [id], onDelete: Restrict)

  @@unique([companyId, returnNo])
  @@index([companyId, jobWorkOrderId])
  @@index([companyId, vendorId])
  @@map("job_work_material_returns")
}

model JobWorkReconciliation {
  id                  String                        @id @default(uuid()) @db.Char(36)
  companyId           String                        @map("company_id") @db.Char(36)
  reconciliationNo    String                        @map("reconciliation_no") @db.VarChar(60)
  jobWorkOrderId      String                        @map("job_work_order_id") @db.Char(36)
  vendorId            String                        @map("vendor_id") @db.Char(36)
  outputProductId     String                        @map("output_product_id") @db.Char(36)
  plannedOutputQty    Decimal                       @map("planned_output_qty") @db.Decimal(14, 4)
  actualOutputQty     Decimal                       @map("actual_output_qty") @db.Decimal(14, 4)
  rejectedOutputQty   Decimal                       @default(0.0000) @map("rejected_output_qty") @db.Decimal(14, 4)
  grossJobWorkCharges Decimal                       @default(0.00) @map("gross_job_work_charges") @db.Decimal(14, 2)
  excessWastageDebit  Decimal                       @default(0.00) @map("excess_wastage_debit") @db.Decimal(14, 2)
  rejectionDebit      Decimal                       @default(0.00) @map("rejection_debit") @db.Decimal(14, 2)
  netPayableToVendor  Decimal                       @default(0.00) @map("net_payable_to_vendor") @db.Decimal(14, 2)
  settlementStatus    String                        @default("PENDING_AUDIT") @map("settlement_status") @db.VarChar(30)
  isPaymentHold       Boolean                       @default(false) @map("is_payment_hold")
  holdReason          String?                       @map("hold_reason") @db.VarChar(255)
  auditedById         String?                       @map("audited_by_id") @db.Char(36)
  auditedAt           DateTime?                     @map("audited_at")
  notes               String?                       @db.Text
  createdAt           DateTime                      @default(now()) @map("created_at")

  clientAdmin         ClientAdmin                   @relation(fields: [companyId], references: [id], onDelete: Cascade)
  jobWorkOrder        JobWorkOrder                  @relation(fields: [jobWorkOrderId], references: [id], onDelete: Restrict)
  items               JobWorkReconciliationItem[]

  @@unique([companyId, reconciliationNo])
  @@index([companyId, jobWorkOrderId])
  @@index([companyId, vendorId])
  @@map("job_work_reconciliations")
}

model JobWorkReconciliationItem {
  id                  String                @id @default(uuid()) @db.Char(36)
  companyId           String                @map("company_id") @db.Char(36)
  reconciliationId    String                @map("reconciliation_id") @db.Char(36)
  productId           String                @map("product_id") @db.Char(36)
  sku                 String                @db.VarChar(60)
  dispatchedQty       Decimal               @map("dispatched_qty") @db.Decimal(14, 4)
  consumedQty         Decimal               @map("consumed_qty") @db.Decimal(14, 4)
  returnedQty         Decimal               @default(0.0000) @map("returned_qty") @db.Decimal(14, 4)
  permissibleScrapQty Decimal               @default(0.0000) @map("permissible_scrap_qty") @db.Decimal(14, 4)
  actualScrapQty      Decimal               @default(0.0000) @map("actual_scrap_qty") @db.Decimal(14, 4)
  varianceQty         Decimal               @default(0.0000) @map("variance_qty") @db.Decimal(14, 4)
  unitCost            Decimal               @default(0.00) @map("unit_cost") @db.Decimal(14, 2)
  debitAmount         Decimal               @default(0.00) @map("debit_amount") @db.Decimal(14, 2)
  uom                 String                @default("KG") @db.VarChar(20)

  reconciliation      JobWorkReconciliation @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)
  product             Product               @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([companyId, reconciliationId])
  @@index([companyId, productId])
  @@map("job_work_reconciliation_items")
}
`;

content = content + phase6Models;

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync('backend/prisma/schema.prisma', content, 'utf8');
console.log('schema.prisma successfully updated with Phase 6 models and clean relations.');

