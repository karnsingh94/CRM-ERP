import fs from 'fs';

// Start fresh from backend/prisma/schema.prisma
let content = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');

// 1. Add reverse relations to ClientAdmin
const clientAdminTarget = '  inventoryAdjustments         InventoryAdjustment[]';
const clientAdminReplacement = `  inventoryAdjustments         InventoryAdjustment[]
  bomMasters                   BomMaster[]
  bomItems                     BomItem[]
  productionPlans              ProductionPlan[]
  productionOrders             ProductionOrder[]
  productionMaterialRequirements ProductionMaterialRequirement[]
  manufacturingBatches         ManufacturingBatch[]
  manufacturingBatchMaterials  ManufacturingBatchMaterial[]
  manufacturingProcessSteps    ManufacturingProcessStep[]
  dailyProductionReports       DailyProductionReport[]
  manufacturingQcs             ManufacturingQC[]
  manufacturingReprocessings   ManufacturingReprocessing[]`;

content = content.replace(clientAdminTarget, clientAdminReplacement);

// 2. Add reverse relations to Product
const productTarget = '  batches       InventoryBatch[]';
const productReplacement = `  batches       InventoryBatch[]
  outputBoms    BomMaster[]      @relation("ProductOutputBom")
  bomItems      BomItem[]
  productionPlans ProductionPlan[]
  productionOrders ProductionOrder[]
  materialRequirements ProductionMaterialRequirement[]
  manufacturingBatches ManufacturingBatch[]
  manufacturingBatchMaterials ManufacturingBatchMaterial[]
  manufacturingQcs ManufacturingQC[]`;

content = content.replace(productTarget, productReplacement);

// 3. Add reverse relation to SalesOrder
const soTarget = '  inventoryFulfillment InventoryFulfillment?';
const soReplacement = `  inventoryFulfillment InventoryFulfillment?
  productionOrders     ProductionOrder[]`;

content = content.replace(soTarget, soReplacement);

// 4. Add reverse relation to InventoryBatch
const batchTarget = '  product     Product?        @relation(fields: [productId], references: [id], onDelete: SetNull)';
const batchReplacement = `  product     Product?        @relation(fields: [productId], references: [id], onDelete: SetNull)
  manufacturingBatchMaterials ManufacturingBatchMaterial[]`;

content = content.replace(batchTarget, batchReplacement);

// 5. Add reverse relation to InventoryMovement
const movementTarget = '  stock       InventoryStock? @relation(fields: [stockId], references: [id], onDelete: SetNull)';
const movementReplacement = `  stock       InventoryStock? @relation(fields: [stockId], references: [id], onDelete: SetNull)
  manufacturingBatchMaterials ManufacturingBatchMaterial[]`;

content = content.replace(movementTarget, movementReplacement);

// 6. Append Phase 5 models
const phase5Models = `
// ==========================================
// PHASE 5: MANUFACTURING & PRODUCTION ENUMS
// ==========================================

enum BomStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  ARCHIVED
}

enum ProductionOrderStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  MATERIAL_PENDING
  READY_FOR_PRODUCTION
  IN_PROGRESS
  PARTIALLY_COMPLETED
  COMPLETED
  ON_HOLD
  CANCELLED
}

enum ProcessStepStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
  FAILED
}

enum ManufacturingQcStatus {
  PENDING
  IN_PROGRESS
  PASSED
  FAILED
  QUALITY_HOLD
}

enum ReprocessingStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  IN_PROGRESS
  COMPLETED
  REJECTED
}

// ==========================================
// PHASE 5: MANUFACTURING & PRODUCTION MODELS
// ==========================================

model BomMaster {
  id               String      @id @default(uuid()) @db.Char(36)
  companyId        String      @map("company_id") @db.Char(36)
  bomCode          String      @map("bom_code") @db.VarChar(60)
  bomName          String      @map("bom_name") @db.VarChar(180)
  outputProductId  String      @map("output_product_id") @db.Char(36)
  outputProductSku String      @map("output_product_sku") @db.VarChar(60)
  version          String      @default("1.0") @db.VarChar(20)
  revisionNumber   Int         @default(1) @map("revision_number")
  parentBomId      String?     @map("parent_bom_id") @db.Char(36)
  revisionReason   String?     @map("revision_reason") @db.VarChar(255)
  batchSize        Decimal     @default(1.0000) @map("batch_size") @db.Decimal(14, 4)
  uom              String      @default("KG") @db.VarChar(20)
  description      String?     @db.Text
  totalPercentage  Decimal     @default(100.0000) @map("total_percentage") @db.Decimal(7, 4)
  standardCost     Decimal     @default(0.00) @map("standard_cost") @db.Decimal(14, 2)
  liveCost         Decimal?    @map("live_cost") @db.Decimal(14, 2)
  status           BomStatus   @default(DRAFT)
  isLocked         Boolean     @default(false) @map("is_locked")
  createdById      String?     @map("created_by_id") @db.Char(36)
  approvedById     String?     @map("approved_by_id") @db.Char(36)
  approvedAt       DateTime?   @map("approved_at")
  createdAt        DateTime    @default(now()) @map("created_at")
  updatedAt        DateTime    @updatedAt @map("updated_at")

  clientAdmin      ClientAdmin @relation(fields: [companyId], references: [id], onDelete: Cascade)
  outputProduct    Product     @relation("ProductOutputBom", fields: [outputProductId], references: [id], onDelete: Restrict)
  parentBom        BomMaster?  @relation("BomRevisionLineage", fields: [parentBomId], references: [id], onDelete: Restrict)
  childRevisions   BomMaster[] @relation("BomRevisionLineage")
  items            BomItem[]
  productionPlans  ProductionPlan[]
  productionOrders ProductionOrder[]

  @@unique([companyId, bomCode, version])
  @@index([companyId, outputProductId])
  @@index([companyId, parentBomId])
  @@map("bom_masters")
}

model BomItem {
  id                String    @id @default(uuid()) @db.Char(36)
  companyId         String    @map("company_id") @db.Char(36)
  bomId             String    @map("bom_id") @db.Char(36)
  productId         String    @map("product_id") @db.Char(36)
  itemType          String    @default("RAW_MATERIAL") @map("item_type") @db.VarChar(30) // RAW_MATERIAL, PACKAGING
  percentage        Decimal   @map("percentage") @db.Decimal(7, 4)
  quantityPerBatch   Decimal   @map("quantity_per_batch") @db.Decimal(14, 4)
  uom               String    @default("KG") @db.VarChar(20)
  scrapTolerancePct Decimal   @default(0.00) @map("scrap_tolerance_pct") @db.Decimal(5, 2)
  standardUnitCost  Decimal   @default(0.00) @map("standard_unit_cost") @db.Decimal(14, 2)
  sequenceOrder     Int       @default(1) @map("sequence_order")
  notes             String?   @db.VarChar(255)
  createdAt         DateTime  @default(now()) @map("created_at")

  clientAdmin       ClientAdmin @relation(fields: [companyId], references: [id], onDelete: Cascade)
  bom               BomMaster   @relation(fields: [bomId], references: [id], onDelete: Cascade)
  product           Product     @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([companyId, bomId])
  @@index([companyId, productId])
  @@map("bom_items")
}

model ProductionPlan {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @map("company_id") @db.Char(36)
  planNo          String    @map("plan_no") @db.VarChar(60)
  planName        String    @map("plan_name") @db.VarChar(180)
  outputProductId String    @map("output_product_id") @db.Char(36)
  bomId           String    @map("bom_id") @db.Char(36)
  plannedQuantity Decimal   @map("planned_quantity") @db.Decimal(14, 4)
  plannedBatches  Int       @default(1) @map("planned_batches")
  uom             String    @default("KG") @db.VarChar(20)
  priority        String    @default("MEDIUM") @db.VarChar(20)
  startDate       DateTime  @map("start_date")
  targetDate      DateTime  @map("target_date")
  status          String    @default("DRAFT") @db.VarChar(30)
  notes           String?   @db.Text
  createdById     String?   @map("created_by_id") @db.Char(36)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  clientAdmin     ClientAdmin       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  outputProduct   Product           @relation(fields: [outputProductId], references: [id], onDelete: Restrict)
  bom             BomMaster         @relation(fields: [bomId], references: [id], onDelete: Restrict)
  orders          ProductionOrder[]

  @@unique([companyId, planNo])
  @@index([companyId, outputProductId])
  @@map("production_plans")
}

model ProductionOrder {
  id               String                @id @default(uuid()) @db.Char(36)
  companyId        String                @map("company_id") @db.Char(36)
  orderNo          String                @map("order_no") @db.VarChar(60)
  planId           String?               @map("plan_id") @db.Char(36)
  salesOrderId     String?               @map("sales_order_id") @db.Char(36)
  outputProductId  String                @map("output_product_id") @db.Char(36)
  bomId            String                @map("bom_id") @db.Char(36)
  targetQuantity   Decimal               @map("target_quantity") @db.Decimal(14, 4)
  producedQuantity Decimal               @default(0.0000) @map("produced_quantity") @db.Decimal(14, 4)
  rejectedQuantity Decimal               @default(0.0000) @map("rejected_quantity") @db.Decimal(14, 4)
  uom              String                @default("KG") @db.VarChar(20)
  priority         String                @default("MEDIUM") @db.VarChar(20)
  status           ProductionOrderStatus @default(DRAFT)
  scheduledStart   DateTime?             @map("scheduled_start")
  scheduledEnd     DateTime?             @map("scheduled_end")
  actualStart      DateTime?             @map("actual_start")
  actualEnd        DateTime?             @map("actual_end")
  notes            String?               @db.Text
  createdById      String?               @map("created_by_id") @db.Char(36)
  approvedById     String?               @map("approved_by_id") @db.Char(36)
  createdAt        DateTime              @default(now()) @map("created_at")
  updatedAt        DateTime              @updatedAt @map("updated_at")

  clientAdmin      ClientAdmin       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  plan             ProductionPlan?   @relation(fields: [planId], references: [id], onDelete: SetNull)
  salesOrder       SalesOrder?       @relation(fields: [salesOrderId], references: [id], onDelete: SetNull)
  outputProduct    Product           @relation(fields: [outputProductId], references: [id], onDelete: Restrict)
  bom              BomMaster         @relation(fields: [bomId], references: [id], onDelete: Restrict)
  materialReqs     ProductionMaterialRequirement[]
  batches          ManufacturingBatch[]
  dprs             DailyProductionReport[]
  qcInspections    ManufacturingQC[]

  @@unique([companyId, orderNo])
  @@index([companyId, status])
  @@index([companyId, salesOrderId])
  @@map("production_orders")
}

model ProductionMaterialRequirement {
  id          String   @id @default(uuid()) @db.Char(36)
  companyId   String   @map("company_id") @db.Char(36)
  orderId     String   @map("order_id") @db.Char(36)
  productId   String   @map("product_id") @db.Char(36)
  requiredQty Decimal  @map("required_qty") @db.Decimal(14, 4)
  reservedQty Decimal  @default(0.0000) @map("reserved_qty") @db.Decimal(14, 4)
  issuedQty   Decimal  @default(0.0000) @map("issued_qty") @db.Decimal(14, 4)
  consumedQty Decimal  @default(0.0000) @map("consumed_qty") @db.Decimal(14, 4)
  returnedQty Decimal  @default(0.0000) @map("returned_qty") @db.Decimal(14, 4)
  uom         String   @default("KG") @db.VarChar(20)
  status      String   @default("PENDING") @db.VarChar(30)
  createdAt   DateTime @default(now()) @map("created_at")

  clientAdmin ClientAdmin     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  order       ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product         @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@index([companyId, orderId])
  @@index([companyId, productId])
  @@map("production_material_requirements")
}

model ManufacturingBatch {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @map("company_id") @db.Char(36)
  batchNo         String    @map("batch_no") @db.VarChar(60)
  orderId         String    @map("order_id") @db.Char(36)
  outputProductId String    @map("output_product_id") @db.Char(36)
  batchQuantity   Decimal   @map("batch_quantity") @db.Decimal(14, 4)
  actualOutputQty Decimal   @default(0.0000) @map("actual_output_qty") @db.Decimal(14, 4)
  wastageQty      Decimal   @default(0.0000) @map("wastage_qty") @db.Decimal(14, 4)
  uom             String    @default("KG") @db.VarChar(20)
  machineName     String?   @map("machine_name") @db.VarChar(100)
  shift           String    @default("Shift A") @db.VarChar(30)
  supervisorName  String?   @map("supervisor_name") @db.VarChar(100)
  status          String    @default("PLANNED") @db.VarChar(30)
  genealogyData   Json?     @map("genealogy_data")
  mfgDate         DateTime? @map("mfg_date")
  expDate         DateTime? @map("exp_date")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  clientAdmin     ClientAdmin       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  order           ProductionOrder   @relation(fields: [orderId], references: [id], onDelete: Restrict)
  outputProduct   Product           @relation(fields: [outputProductId], references: [id], onDelete: Restrict)
  steps           ManufacturingProcessStep[]
  materials       ManufacturingBatchMaterial[]
  qcInspections   ManufacturingQC[]
  reprocessings   ManufacturingReprocessing[]

  @@unique([companyId, batchNo])
  @@index([companyId, orderId])
  @@index([companyId, outputProductId])
  @@map("manufacturing_batches")
}

model ManufacturingBatchMaterial {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @map("company_id") @db.Char(36)
  batchId         String    @map("batch_id") @db.Char(36)
  rmBatchId       String    @map("rm_batch_id") @db.Char(36)
  productId       String    @map("product_id") @db.Char(36)
  movementId      String?   @map("movement_id") @db.Char(36)
  sku             String    @db.VarChar(60)
  rmBatchNo       String    @map("rm_batch_no") @db.VarChar(60)
  issuedQty       Decimal   @map("issued_qty") @db.Decimal(14, 4)
  consumedQty     Decimal   @default(0.0000) @map("consumed_qty") @db.Decimal(14, 4)
  returnedQty     Decimal   @default(0.0000) @map("returned_qty") @db.Decimal(14, 4)
  uom             String    @default("KG") @db.VarChar(20)
  unitCost        Decimal   @default(0.00) @map("unit_cost") @db.Decimal(14, 2)
  issuedAt        DateTime  @default(now()) @map("issued_at")
  issuedById      String?   @map("issued_by_id") @db.Char(36)
  notes           String?   @db.VarChar(255)

  clientAdmin        ClientAdmin        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  manufacturingBatch ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  rmBatch            InventoryBatch     @relation(fields: [rmBatchId], references: [id], onDelete: Restrict)
  product            Product            @relation(fields: [productId], references: [id], onDelete: Restrict)
  movement           InventoryMovement? @relation(fields: [movementId], references: [id], onDelete: SetNull)

  @@index([companyId, batchId])
  @@index([companyId, rmBatchId])
  @@index([companyId, productId])
  @@map("manufacturing_batch_materials")
}

model ManufacturingProcessStep {
  id              String            @id @default(uuid()) @db.Char(36)
  companyId       String            @map("company_id") @db.Char(36)
  batchId         String            @map("batch_id") @db.Char(36)
  stepNumber      Int               @map("step_number")
  stageName       String            @map("stage_name") @db.VarChar(80)
  ingredientNotes String?           @map("ingredient_notes") @db.Text
  targetDuration  Int?              @map("target_duration")
  actualDuration  Int?              @map("actual_duration")
  targetTempC     Decimal?          @map("target_temp_c") @db.Decimal(6, 2)
  actualTempC     Decimal?          @map("actual_temp_c") @db.Decimal(6, 2)
  operatorName    String?           @map("operator_name") @db.VarChar(100)
  status          ProcessStepStatus @default(PENDING)
  notes           String?           @db.Text
  verifiedAt      DateTime?         @map("verified_at")
  verifiedById    String?           @map("verified_by_id") @db.Char(36)
  createdAt       DateTime          @default(now()) @map("created_at")

  clientAdmin     ClientAdmin        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  batch           ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)

  @@unique([batchId, stepNumber])
  @@index([companyId, batchId])
  @@map("manufacturing_process_steps")
}

model DailyProductionReport {
  id              String    @id @default(uuid()) @db.Char(36)
  companyId       String    @map("company_id") @db.Char(36)
  dprNo           String    @map("dpr_no") @db.VarChar(60)
  dprDate         DateTime  @map("dpr_date")
  shift           String    @default("Shift A") @db.VarChar(30)
  orderId         String?   @map("order_id") @db.Char(36)
  machineName     String?   @map("machine_name") @db.VarChar(100)
  plannedQty      Decimal   @map("planned_qty") @db.Decimal(14, 4)
  actualQty       Decimal   @map("actual_qty") @db.Decimal(14, 4)
  wastageQty      Decimal   @default(0.0000) @map("wastage_qty") @db.Decimal(14, 4)
  efficiencyPct   Decimal   @default(0.00) @map("efficiency_pct") @db.Decimal(5, 2)
  downtimeMinutes Int       @default(0) @map("downtime_minutes")
  downtimeReason  String?   @map("downtime_reason") @db.VarChar(180)
  supervisorName  String?   @map("supervisor_name") @db.VarChar(100)
  isVerified      Boolean   @default(false) @map("is_verified")
  verifiedById    String?   @map("verified_by_id") @db.Char(36)
  verifiedAt      DateTime? @map("verified_at")
  notes           String?   @db.Text
  createdAt       DateTime  @default(now()) @map("created_at")

  clientAdmin     ClientAdmin      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  order           ProductionOrder? @relation(fields: [orderId], references: [id], onDelete: SetNull)

  @@unique([companyId, dprNo])
  @@index([companyId, dprDate])
  @@map("daily_production_reports")
}

model ManufacturingQC {
  id               String                @id @default(uuid()) @db.Char(36)
  companyId        String                @map("company_id") @db.Char(36)
  qcNo             String                @map("qc_no") @db.VarChar(60)
  qcType           String                @default("FINISHED_GOODS") @map("qc_type") @db.VarChar(30) // IN_PROCESS, FINISHED_GOODS
  orderId          String?               @map("order_id") @db.Char(36)
  batchId          String                @map("batch_id") @db.Char(36)
  productId        String                @map("product_id") @db.Char(36)
  testedQty        Decimal               @map("tested_qty") @db.Decimal(14, 4)
  passedQty        Decimal               @default(0.0000) @map("passed_qty") @db.Decimal(14, 4)
  rejectedQty      Decimal               @default(0.0000) @map("rejected_qty") @db.Decimal(14, 4)
  parameterResults Json?                 @map("parameter_results")
  status           ManufacturingQcStatus @default(PENDING)
  disposition      String?               @db.VarChar(50)
  inspectorName    String?               @map("inspector_name") @db.VarChar(100)
  testedAt         DateTime?             @map("tested_at")
  remarks          String?               @db.Text
  createdAt        DateTime              @default(now()) @map("created_at")

  clientAdmin      ClientAdmin        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  order            ProductionOrder?   @relation(fields: [orderId], references: [id], onDelete: SetNull)
  batch            ManufacturingBatch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  product          Product            @relation(fields: [productId], references: [id], onDelete: Restrict)
  reprocessingRepaired ManufacturingReprocessing? @relation("PostReworkQc")

  @@unique([companyId, qcNo])
  @@index([companyId, batchId])
  @@index([companyId, productId])
  @@map("manufacturing_qc_inspections")
}

model ManufacturingReprocessing {
  id               String             @id @default(uuid()) @db.Char(36)
  companyId        String             @map("company_id") @db.Char(36)
  reprocessNo      String             @map("reprocess_no") @db.VarChar(60)
  originalBatchId  String             @map("original_batch_id") @db.Char(36)
  reason           String             @db.Text
  reworkPlan       String             @map("rework_plan") @db.Text
  additionalInputs Json?              @map("additional_inputs")
  quantity         Decimal            @map("quantity") @db.Decimal(14, 4)
  status           ReprocessingStatus @default(DRAFT)
  approvedById     String?            @map("approved_by_id") @db.Char(36)
  approvedAt       DateTime?          @map("approved_at")
  postReworkQcId   String?            @unique @map("post_rework_qc_id") @db.Char(36)
  completedAt      DateTime?          @map("completed_at")
  createdAt        DateTime           @default(now()) @map("created_at")

  clientAdmin      ClientAdmin        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  originalBatch    ManufacturingBatch @relation(fields: [originalBatchId], references: [id], onDelete: Restrict)
  postReworkQc     ManufacturingQC?   @relation("PostReworkQc", fields: [postReworkQcId], references: [id], onDelete: SetNull)

  @@unique([companyId, reprocessNo])
  @@index([companyId, originalBatchId])
  @@map("manufacturing_reprocessings")
}
`;

content += phase5Models;
fs.writeFileSync('scratch/test_schema.prisma', content, 'utf8');
console.log('Successfully re-built scratch/test_schema.prisma');
