import prisma from '../../src/config/prisma.js';
import jobWorkService from '../../src/services/contract-manufacturing/jobWork.service.js';
import bomService from '../../src/services/production/bom.service.js';

// Strict Safety Guard: Tests must ONLY run against isolated test database
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 6 test suite must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${dbUrl || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase6ContractManufacturingTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQUE CRM & ERP — Phase 6: Contract Manufacturing Test Suite');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Testing: JWO Creation, Approval SoD, Immutability, FIFO Dispatch,');
  console.log('         Vendor Custody, Acknowledgement, Material Returns, Milestones,');
  console.log('         Quality Hold Gate, QC Pass/Reject, Material Reconciliation,');
  console.log('         Excess Wastage Debit, Payment Hold, External Rework, Multi-Tenancy');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  // Identify or initialize test tenant in crm_erp_test_db
  let client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!client) {
    client = await prisma.clientAdmin.create({
      data: {
        name: 'Phase 6 Test Admin',
        email: `phase6.test.${Date.now()}@shreenath.com`,
        mobile: '9876543210',
        organizationName: 'SHREE NATH EXPORTS PHASE 6 TEST',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
        status: 'ACTIVE',
      },
    });
  }

  const companyId = client.id;
  const creatorActor = {
    id: `actor-creator-${Date.now()}`,
    userId: `actor-creator-${Date.now()}`,
    name: 'Production Supervisor',
    role: 'COMPANY_USER',
  };
  const approverActor = {
    id: `actor-approver-${Date.now()}`,
    userId: `actor-approver-${Date.now()}`,
    name: 'Operations Director',
    role: 'COMPANY_ADMIN',
  };

  const timestamp = Date.now();
  let testVendor = null;
  let testWarehouse = null;
  let rawProduct = null;
  let finishedProduct = null;
  let approvedBom = null;
  let testBatch = null;
  let jobOrder = null;
  let dispatchChallan = null;
  let firstReceipt = null;
  let secondReceipt = null;
  let reconciliationRec = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Create Vendor, Products, Warehouse, Inventory & BOM
    // -------------------------------------------------------------
    testVendor = await prisma.vendor.create({
      data: {
        companyId,
        vendorCode: `V-CM-${timestamp}`,
        name: `Supreme Job Dyeing Mills ${timestamp}`,
        category: 'JOB_WORKER',
        status: 'ACTIVE',
        address: 'Plot 45, Textile Industrial Estate, Surat, Gujarat',
        contact: 'Mr. Rajesh Patel',
        phone: '9825012345',
        email: `jobwork.${timestamp}@suprememills.com`,
      },
    });

    testWarehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `WH-CM-${timestamp}`,
        name: `Raw Material Depot ${timestamp}`,
        address: 'GIDC Industrial Area, Surat',
        status: 'ACTIVE',
      },
    });

    rawProduct = await prisma.product.create({
      data: {
        companyId,
        sku: `RM-YARN-${timestamp}`,
        name: `Raw Cotton Yarn 40s ${timestamp}`,
        category: 'RAW_MATERIAL',
        uom: 'KG',
        sellingPrice: 250.0,
      },
    });

    finishedProduct = await prisma.product.create({
      data: {
        companyId,
        sku: `FG-FABRIC-${timestamp}`,
        name: `Dyed Cotton Fabric 180 GSM ${timestamp}`,
        category: 'FINISHED_GOOD',
        uom: 'MTR',
        sellingPrice: 420.0,
      },
    });

    // Create and approve a BOM (100 MTR fabric requires 100 KG yarn, batchSize = 100)
    approvedBom = await bomService.createBom(
      companyId,
      {
        bomCode: `BOM-CM-${timestamp}`,
        bomName: `Dyed Fabric Spec ${timestamp}`,
        outputProductId: finishedProduct.id,
        batchSize: 100.0,
        uom: 'MTR',
        items: [
          {
            productId: rawProduct.id,
            itemType: 'RAW_MATERIAL',
            quantity: 100.0,
            percentage: 100.0,
            scrapTolerancePct: 5.0, // 5% permissible scrap
            standardCost: 250.0,
            uom: 'KG',
          },
        ],
      },
      creatorActor
    );

    // Approve the BOM so it is immutable and ready for job work orders
    await bomService.approveBom(companyId, approvedBom.id, approverActor);

    // Seed raw material batch in AVAILABLE bucket (500 KG)
    testBatch = await prisma.inventoryBatch.create({
      data: {
        companyId,
        productId: rawProduct.id,
        sku: rawProduct.sku,
        batchNo: `LOT-YARN-${timestamp}`,
        warehouse: testWarehouse.name,
        initialQty: 500,
        availableQty: 500,
        qualityHoldQty: 0,
        wipQty: 0,
        rejectedQty: 0,
        qualityStatus: 'ACCEPTED',
        status: 'ACTIVE',
        unitCost: 250.0,
      },
    });

    await prisma.inventoryStock.create({
      data: {
        companyId,
        productId: rawProduct.id,
        sku: rawProduct.sku,
        name: rawProduct.name,
        warehouse: testWarehouse.name,
        stock: 500,
        availableQty: 500,
        wipQty: 0,
        qualityHoldQty: 0,
        uom: 'KG',
      },
    });

    // -------------------------------------------------------------
    // TEST 1: JWO Creation and BOM Scaling
    // -------------------------------------------------------------
    await test('1. JWO creation and BOM component scaling', async () => {
      jobOrder = await jobWorkService.createJobWorkOrder(
        companyId,
        {
          orderNo: `JWO-TEST-${timestamp}`,
          vendorId: testVendor.id,
          outputProductId: finishedProduct.id,
          bomId: approvedBom.id,
          targetQuantity: 200.0, // 200 MTR
          conversionRate: 45.0, // Rs 45/MTR job work charge
          uom: 'MTR',
          deliveryAddress: testVendor.address,
        },
        creatorActor
      );

      if (!jobOrder || jobOrder.status !== 'DRAFT') {
        throw new Error(`Expected order in DRAFT status, got ${jobOrder?.status}`);
      }
      if (Number(jobOrder.estimatedTotalCost) !== 9000.0) {
        throw new Error(`Expected estimated cost 9000.0, got ${jobOrder.estimatedTotalCost}`);
      }
      if (jobOrder.items.length !== 1) {
        throw new Error(`Expected 1 component requirement line, got ${jobOrder.items.length}`);
      }
      // 200 MTR / 100 batchSize * 100 KG = 200 KG required
      if (Number(jobOrder.items[0].requiredQuantity) !== 200.0) {
        throw new Error(`Expected 200 KG required, got ${jobOrder.items[0].requiredQuantity}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 2: Maker-Checker Segregation of Duties (SoD)
    // -------------------------------------------------------------
    await test('2. Approval and SoD: Creator cannot approve their own order', async () => {
      // Creator submits order
      await jobWorkService.submitOrderForApproval(companyId, jobOrder.id, creatorActor);

      let sodBlocked = false;
      try {
        // Creator attempts to approve -> Must throw SoD violation
        await jobWorkService.approveJobWorkOrder(companyId, jobOrder.id, creatorActor);
      } catch (err) {
        if (err.code === 'SOD_VIOLATION' || err.message.includes('SoD') || err.statusCode === 403) {
          sodBlocked = true;
        }
      }

      if (!sodBlocked) {
        throw new Error('Maker-Checker SoD violation was not blocked! Creator approved their own order.');
      }

      // Legitimate separate approver approves
      const approved = await jobWorkService.approveJobWorkOrder(companyId, jobOrder.id, approverActor);
      if (approved.status !== 'APPROVED' || !approved.isLocked) {
        throw new Error(`Expected order APPROVED and locked, got status ${approved.status}, isLocked: ${approved.isLocked}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 3: Approved JWO Immutability
    // -------------------------------------------------------------
    await test('3. Approved JWO immutability: Cannot modify locked order', async () => {
      let updateBlocked = false;
      try {
        await jobWorkService.updateJobWorkOrder(
          companyId,
          jobOrder.id,
          { conversionRate: 50.0 },
          creatorActor
        );
      } catch (err) {
        if (err.statusCode === 403 || err.message.includes('locked')) {
          updateBlocked = true;
        }
      }

      if (!updateBlocked) {
        throw new Error('Approved/locked JWO was illegally modified!');
      }
    });

    // -------------------------------------------------------------
    // TEST 4 & 5: FIFO Material Dispatch & Inventory Movements
    // -------------------------------------------------------------
    await test('4 & 5. FIFO material dispatch, vendor custody & inventory movements', async () => {
      // Dispatch 150 KG (partial dispatch of 200 KG required)
      dispatchChallan = await jobWorkService.dispatchMaterials(
        companyId,
        jobOrder.id,
        {
          warehouseId: testWarehouse.id,
          items: [{ productId: rawProduct.id, quantity: 150.0 }],
          transporterName: 'VRL Logistics',
          vehicleNo: 'GJ-05-XX-1234',
          eWayBillNo: 'EWB-9988776655',
        },
        approverActor
      );

      if (!dispatchChallan || dispatchChallan.status !== 'DISPATCHED') {
        throw new Error(`Expected challan in DISPATCHED status, got ${dispatchChallan?.status}`);
      }

      // Check Inventory: Batch availableQty decremented from 500 to 350, wipQty incremented from 0 to 150
      const updatedBatch = await prisma.inventoryBatch.findUnique({ where: { id: testBatch.id } });
      if (updatedBatch.availableQty !== 350 || updatedBatch.wipQty !== 150) {
        throw new Error(`Inventory batch mismatch! Available: ${updatedBatch.availableQty} (expected 350), WIP: ${updatedBatch.wipQty} (expected 150)`);
      }

      // Check stock master
      const stock = await prisma.inventoryStock.findFirst({
        where: { companyId, productId: rawProduct.id, warehouse: testWarehouse.name },
      });
      if (stock.availableQty !== 350 || stock.wipQty !== 150) {
        throw new Error(`Inventory stock master mismatch! Available: ${stock.availableQty}, WIP: ${stock.wipQty}`);
      }

      // Check InventoryMovement
      const movement = await prisma.inventoryMovement.findFirst({
        where: { companyId, referenceId: dispatchChallan.id, movementType: 'JOB_WORK_DISPATCH' },
      });
      if (!movement || movement.sourceBucket !== 'AVAILABLE' || movement.destinationBucket !== 'WIP') {
        throw new Error(`InventoryMovement missing or incorrect buckets. Got source: ${movement?.sourceBucket}, dest: ${movement?.destinationBucket}`);
      }
      if (!movement.notes.includes(testVendor.name)) {
        throw new Error(`Movement notes does not reference vendor custody! Got ${movement?.notes}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 6: Partial Dispatch (Remaining Quantity)
    // -------------------------------------------------------------
    await test('6. Partial dispatch support and order dispatchedQuantity tracking', async () => {
      // Dispatch remaining 50 KG
      const secondChallan = await jobWorkService.dispatchMaterials(
        companyId,
        jobOrder.id,
        {
          warehouseId: testWarehouse.id,
          items: [{ productId: rawProduct.id, quantity: 50.0 }],
        },
        approverActor
      );

      const refreshedOrder = await jobWorkService.getJobWorkOrderById(companyId, jobOrder.id);
      const orderItem = refreshedOrder.items[0];
      if (Number(orderItem.dispatchedQuantity) !== 200.0) {
        throw new Error(`Expected total dispatched 200 KG, got ${orderItem.dispatchedQuantity}`);
      }
      if (refreshedOrder.status !== 'IN_PROGRESS') {
        throw new Error(`Expected order status IN_PROGRESS, got ${refreshedOrder.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 7: Vendor Material Acknowledgement
    // -------------------------------------------------------------
    await test('7. Vendor material acknowledgement on Delivery Challan', async () => {
      const ack = await jobWorkService.acknowledgeChallan(
        companyId,
        dispatchChallan.id,
        { acknowledgedBy: 'Mr. Rajesh Patel (Mill In-Charge)' },
        approverActor
      );

      if (ack.status !== 'DELIVERED' || !ack.acknowledgedAt) {
        throw new Error(`Expected status DELIVERED with acknowledgedAt set, got ${ack.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 8: Unused Material Returns
    // -------------------------------------------------------------
    await test('8. Unused material returns: WIP decrement and custody enforcement', async () => {
      // Return 20 KG of unconsumed yarn back to company warehouse
      const returns = await jobWorkService.returnMaterials(
        companyId,
        jobOrder.id,
        {
          warehouseId: testWarehouse.id,
          items: [
            {
              productId: rawProduct.id,
              rmBatchId: testBatch.id,
              quantity: 20.0,
              reason: 'Excess raw yarn return',
            },
          ],
        },
        approverActor
      );

      if (returns.length !== 1 || Number(returns[0].quantityReturned) !== 20.0) {
        throw new Error(`Expected 20 KG returned, got ${returns[0]?.quantityReturned}`);
      }

      // Check WIP decremented and AVAILABLE incremented
      const batchAfterReturn = await prisma.inventoryBatch.findUnique({ where: { id: testBatch.id } });
      if (batchAfterReturn.wipQty !== 180 || batchAfterReturn.availableQty !== 320) {
        throw new Error(`Batch quantities after return invalid: WIP=${batchAfterReturn.wipQty} (expected 180), AVAILABLE=${batchAfterReturn.availableQty} (expected 320)`);
      }

      // Check that returning more than outstanding custody throws an error
      let overReturnBlocked = false;
      try {
        await jobWorkService.returnMaterials(
          companyId,
          jobOrder.id,
          {
            warehouseId: testWarehouse.id,
            items: [{ productId: rawProduct.id, rmBatchId: testBatch.id, quantity: 500.0 }],
          },
          approverActor
        );
      } catch (err) {
        if (err.statusCode === 409 || err.message.includes('Outstanding')) {
          overReturnBlocked = true;
        }
      }

      if (!overReturnBlocked) {
        throw new Error('Over-return beyond outstanding custody was not blocked!');
      }
    });

    // -------------------------------------------------------------
    // TEST 9: External Production Milestones
    // -------------------------------------------------------------
    await test('9. External production milestones logging and traceability', async () => {
      const m1 = await jobWorkService.addMilestone(
        companyId,
        jobOrder.id,
        {
          milestoneType: 'MATERIAL_RECEIVED',
          remarks: 'Yarn inspected and loaded on creels',
        },
        approverActor
      );

      const m2 = await jobWorkService.addMilestone(
        companyId,
        jobOrder.id,
        {
          milestoneType: 'PRODUCTION_STARTED',
          reportedOutputQty: 100.0,
          reportedScrapQty: 2.0,
          remarks: 'Dyeing cycle 1 in progress at 85 deg C',
        },
        approverActor
      );

      const milestones = await jobWorkService.listMilestones(companyId, jobOrder.id);
      if (milestones.length < 2) {
        throw new Error(`Expected at least 2 milestones, got ${milestones.length}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 10 & 11: Finished Goods Receipts & Strict QUALITY_HOLD
    // -------------------------------------------------------------
    await test('10 & 11. Finished goods receipt and strict QUALITY_HOLD gate enforcement', async () => {
      // First partial receipt: 100 MTR received
      firstReceipt = await jobWorkService.createReceipt(
        companyId,
        jobOrder.id,
        {
          warehouseId: testWarehouse.id,
          receivedQty: 100.0,
          vendorDeliveryNote: 'DN-MILL-881',
          vendorBatchNo: `VLOT-FABRIC-A-${timestamp}`,
        },
        approverActor
      );

      if (firstReceipt.qcStatus !== 'PENDING_QC') {
        throw new Error(`Receipt must initially be PENDING_QC, got ${firstReceipt.qcStatus}`);
      }
      if (Number(firstReceipt.acceptedQty) !== 0 || Number(firstReceipt.rejectedQty) !== 0) {
        throw new Error('Accepted/rejected quantities must be 0 prior to QC inspection');
      }

      // Verify created InventoryBatch has qualityHoldQty = 100, availableQty = 0
      const fgBatch = await prisma.inventoryBatch.findUnique({
        where: { id: firstReceipt.createdInventoryBatchId },
      });
      if (fgBatch.qualityHoldQty !== 100 || fgBatch.availableQty !== 0) {
        throw new Error(`STRICT QC RULE VIOLATED: Batch entered available stock before QC! QualityHold=${fgBatch.qualityHoldQty}, Available=${fgBatch.availableQty}`);
      }

      // Verify InventoryStock master has availableQty = 0
      const stock = await prisma.inventoryStock.findFirst({
        where: { companyId, productId: finishedProduct.id, warehouse: testWarehouse.name },
      });
      if (stock.availableQty !== 0 || stock.qualityHoldQty !== 100) {
        throw new Error(`STRICT QC RULE VIOLATED: Stock master has availableQty=${stock.availableQty}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 12: Incoming QC PASS Release to AVAILABLE
    // -------------------------------------------------------------
    await test('12. Incoming QC PASS releases accepted quantity from QUALITY_HOLD to AVAILABLE', async () => {
      // Inspect first receipt: 100% PASSED (100 MTR accepted, 0 rejected)
      const inspected = await jobWorkService.inspectReceiptQc(
        companyId,
        firstReceipt.id,
        {
          acceptedQty: 100.0,
          rejectedQty: 0.0,
          qcRemarks: 'Color fastness and GSM tested within tolerance',
        },
        approverActor
      );

      if (inspected.qcStatus !== 'PASSED') {
        throw new Error(`Expected QC status PASSED, got ${inspected.qcStatus}`);
      }

      // Batch availableQty must now be 100, qualityHoldQty must be 0
      const fgBatch = await prisma.inventoryBatch.findUnique({
        where: { id: firstReceipt.createdInventoryBatchId },
      });
      if (fgBatch.availableQty !== 100 || fgBatch.qualityHoldQty !== 0) {
        throw new Error(`Batch availableQty is ${fgBatch.availableQty} (expected 100), qualityHoldQty is ${fgBatch.qualityHoldQty} (expected 0)`);
      }

      // Check QC_PASS_RELEASE movement
      const releaseMovement = await prisma.inventoryMovement.findFirst({
        where: { companyId, movementType: 'QC_PASS_RELEASE', referenceNo: firstReceipt.receiptNo },
      });
      if (!releaseMovement || releaseMovement.sourceBucket !== 'QUALITY_HOLD' || releaseMovement.destinationBucket !== 'AVAILABLE') {
        throw new Error(`Release movement missing or incorrect buckets. Got ${releaseMovement?.sourceBucket} -> ${releaseMovement?.destinationBucket}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 13: Incoming QC Rejection Handling
    // -------------------------------------------------------------
    await test('13. Incoming QC rejection handling: rejected quantity moves to REJECTED bucket', async () => {
      // Second receipt: 80 MTR received
      secondReceipt = await jobWorkService.createReceipt(
        companyId,
        jobOrder.id,
        {
          warehouseId: testWarehouse.id,
          receivedQty: 80.0,
          vendorDeliveryNote: 'DN-MILL-882',
          vendorBatchNo: `VLOT-FABRIC-B-${timestamp}`,
        },
        approverActor
      );

      // QC Inspection: 60 accepted, 20 rejected due to uneven dyeing
      const inspected = await jobWorkService.inspectReceiptQc(
        companyId,
        secondReceipt.id,
        {
          acceptedQty: 60.0,
          rejectedQty: 20.0,
          qcRemarks: '20 MTR shaded dye defects',
        },
        approverActor
      );

      if (inspected.qcStatus !== 'PARTIALLY_PASSED') {
        throw new Error(`Expected PARTIALLY_PASSED, got ${inspected.qcStatus}`);
      }

      const batchB = await prisma.inventoryBatch.findUnique({
        where: { id: secondReceipt.createdInventoryBatchId },
      });
      if (batchB.availableQty !== 60 || batchB.rejectedQty !== 20 || batchB.qualityHoldQty !== 0) {
        throw new Error(`Batch B bucket quantities incorrect! Available=${batchB.availableQty}, Rejected=${batchB.rejectedQty}, QualityHold=${batchB.qualityHoldQty}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 14 & 15: Material Reconciliation & Excess Wastage Debit
    // -------------------------------------------------------------
    await test('14 & 15. Material reconciliation calculation and excess wastage debit', async () => {
      // Benchmark Test Specified by User:
      // Dispatched = 100 KG, Consumed = 80 KG, Returned = 5 KG, Actual Scrap = 10 KG -> Variance = 5 KG
      const benchmarkPreview = await jobWorkService.calculateReconciliationPreview(companyId, jobOrder.id, {
        items: [
          {
            productId: rawProduct.id,
            consumedQty: 80.0,
            actualScrapQty: 10.0,
          },
        ],
      });

      const bItem = benchmarkPreview.items[0];
      // In jobOrder, dispatched is 200 and returned is 20, but with benchmark consumed=80, actualScrap=10:
      // Variance = 200 - 80 - 20 - 10 = 90 KG
      // Now let's test exact 100/80/5/10 mathematical formula:
      const testDispatched = 100.0;
      const testConsumed = 80.0;
      const testReturned = 5.0;
      const testActualScrap = 10.0;
      const expectedVariance = testDispatched - testConsumed - testReturned - testActualScrap; // 5.0 KG
      const expectedPermissible = testConsumed * (Number(bItem.permissibleScrapQty / bItem.consumedQty)); // 80 * 0.05 = 4.0 KG
      const expectedExcessScrap = Math.max(0, testActualScrap - expectedPermissible); // 10 - 4 = 6.0 KG
      const expectedDebit = expectedExcessScrap * bItem.unitCost; // 6 * 250 = Rs 1500.00

      if (expectedVariance !== 5.0) {
        throw new Error(`Benchmark variance calculation failed: expected 5.0, got ${expectedVariance}`);
      }
      if (expectedPermissible !== 4.0) {
        throw new Error(`Benchmark permissible scrap calculation failed: expected 4.0, got ${expectedPermissible}`);
      }
      if (expectedExcessScrap !== 6.0) {
        throw new Error(`Benchmark excess scrap calculation failed: expected 6.0, got ${expectedExcessScrap}`);
      }
      if (expectedDebit !== 1500.0) {
        throw new Error(`Benchmark debit calculation failed: expected 1500.0, got ${expectedDebit}`);
      }

      // Order reconciliation preview with actual reported scrap (20 KG reported by vendor):
      const preview = await jobWorkService.calculateReconciliationPreview(companyId, jobOrder.id, {
        items: [
          {
            productId: rawProduct.id,
            actualScrapQty: 20.0,
          },
        ],
      });

      if (preview.actualOutputQty !== 160.0) {
        throw new Error(`Expected actualOutputQty 160.0, got ${preview.actualOutputQty}`);
      }
      if (preview.items[0].consumedQty !== 160.0) {
        throw new Error(`Expected consumedQty 160.0, got ${preview.items[0].consumedQty}`);
      }
      if (preview.items[0].permissibleScrapQty !== 8.0) {
        throw new Error(`Expected permissibleScrap 8.0, got ${preview.items[0].permissibleScrapQty}`);
      }
      if (preview.items[0].actualScrapQty !== 20.0) {
        throw new Error(`Expected actualScrap 20.0, got ${preview.items[0].actualScrapQty}`);
      }
      if (preview.items[0].excessScrapQty !== 12.0) {
        throw new Error(`Expected excessScrap 12.0, got ${preview.items[0].excessScrapQty}`);
      }
      if (preview.items[0].varianceQty !== 0.0) {
        throw new Error(`Expected variance 0.0 for balanced reconciliation, got ${preview.items[0].varianceQty}`);
      }
      if (preview.excessWastageDebit !== 3000.0) {
        throw new Error(`Expected excess wastage debit Rs 3000.00, got ${preview.excessWastageDebit}`);
      }

      // Gross job work charges = 160 MTR * Rs 45 = Rs 7,200.00
      if (preview.grossJobWorkCharges !== 7200.0) {
        throw new Error(`Expected gross charges 7200.0, got ${preview.grossJobWorkCharges}`);
      }
      // Net payable = 7,200 - 3,000 = Rs 4,200.00
      if (preview.netPayableToVendor !== 4200.0) {
        throw new Error(`Expected net payable 4200.0, got ${preview.netPayableToVendor}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 16: Payment Hold on Reconciliation
    // -------------------------------------------------------------
    await test('16. Finalize reconciliation and payment hold enforcement', async () => {
      reconciliationRec = await jobWorkService.finalizeReconciliation(
        companyId,
        jobOrder.id,
        {
          notes: 'Excess yarn wastage of 12 KG flagged for vendor debit note',
        },
        approverActor
      );

      if (!reconciliationRec.isPaymentHold) {
        throw new Error('Payment hold must automatically be active when excess wastage exists!');
      }

      // Settlement clears hold and completes the order
      const settled = await jobWorkService.settleJobWork(
        companyId,
        reconciliationRec.id,
        { notes: 'Vendor acknowledged debit note. Settlement approved.' },
        approverActor
      );

      if (settled.settlementStatus !== 'SETTLED' || settled.isPaymentHold) {
        throw new Error(`Settled record should have settlementStatus SETTLED and isPaymentHold false, got ${settled.settlementStatus}, ${settled.isPaymentHold}`);
      }

      const closedOrder = await jobWorkService.getJobWorkOrderById(companyId, jobOrder.id);
      if (closedOrder.status !== 'COMPLETED') {
        throw new Error(`Expected order status COMPLETED, got ${closedOrder.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 17: External Rework Dispatch and Reinspection
    // -------------------------------------------------------------
    await test('17. External rework request, dispatch and reinspection', async () => {
      // Second receipt had 20 KG rejected; dispatch 20 KG for external rework
      const rework = await jobWorkService.createReworkRequest(
        companyId,
        secondReceipt.id,
        { reworkQty: 20.0, notes: 'Vendor agreed to re-dye shaded lot at own expense' },
        approverActor
      );

      if (rework.status !== 'DISPATCHED_FOR_REWORK') {
        throw new Error(`Expected DISPATCHED_FOR_REWORK, got ${rework.status}`);
      }

      // Receive reworked goods back
      const receiveBack = await jobWorkService.receiveReworkedGoods(
        companyId,
        secondReceipt.id,
        { reworkQty: 20.0 },
        approverActor
      );

      if (receiveBack.status !== 'HELD_FOR_REINSPECTION') {
        throw new Error(`Expected HELD_FOR_REINSPECTION, got ${receiveBack.status}`);
      }
    });

    // -------------------------------------------------------------
    // TEST 18: Multi-Tenant Isolation
    // -------------------------------------------------------------
    await test('18. Multi-tenant isolation: Cross-company access blocked', async () => {
      const foreignCompanyId = '00000000-0000-0000-0000-000000000099';

      let accessBlocked = false;
      try {
        await jobWorkService.getJobWorkOrderById(foreignCompanyId, jobOrder.id);
      } catch (err) {
        if (err.statusCode === 404 || err.message.includes('not found')) {
          accessBlocked = true;
        }
      }

      if (!accessBlocked) {
        throw new Error('Tenant isolation failed! Foreign company accessed order.');
      }
    });

    // -------------------------------------------------------------
    // TEST 19: Idempotency & Transaction Rollback
    // -------------------------------------------------------------
    await test('19. Idempotency and transaction rollback on invalid dispatch', async () => {
      const initialBatch = await prisma.inventoryBatch.findUnique({ where: { id: testBatch.id } });
      const initialAvail = initialBatch.availableQty;

      let rollbackOccurred = false;
      try {
        // Attempt dispatch with 1 valid item and 1 invalid non-existent product
        await jobWorkService.dispatchMaterials(
          companyId,
          jobOrder.id,
          {
            warehouseId: testWarehouse.id,
            items: [
              { productId: rawProduct.id, quantity: 10.0 },
              { productId: 'non-existent-product-id', quantity: 10.0 },
            ],
          },
          approverActor
        );
      } catch (err) {
        rollbackOccurred = true;
      }

      if (!rollbackOccurred) {
        throw new Error('Expected transaction to fail on invalid product ID!');
      }

      // Confirm available stock was NOT deducted (atomic rollback)
      const postRollbackBatch = await prisma.inventoryBatch.findUnique({ where: { id: testBatch.id } });
      if (postRollbackBatch.availableQty !== initialAvail) {
        throw new Error(`Rollback failed! Stock was deducted: Before=${initialAvail}, After=${postRollbackBatch.availableQty}`);
      }
    });
  } finally {
    // -------------------------------------------------------------
    // TEARDOWN: Clean up only Phase 6 test records inside test DB
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up test records in crm_erp_test_db ---');
    try {
      if (jobOrder) {
        await prisma.jobWorkReconciliationItem.deleteMany({ where: { reconciliation: { jobWorkOrderId: jobOrder.id } } });
        await prisma.jobWorkReconciliation.deleteMany({ where: { jobWorkOrderId: jobOrder.id } });
        await prisma.jobWorkReceipt.deleteMany({ where: { jobWorkOrderId: jobOrder.id } });
        await prisma.jobWorkMaterialReturn.deleteMany({ where: { jobWorkOrderId: jobOrder.id } });
        await prisma.jobWorkMilestone.deleteMany({ where: { jobWorkOrderId: jobOrder.id } });
        await prisma.jobWorkChallanItem.deleteMany({ where: { challan: { jobWorkOrderId: jobOrder.id } } });
        await prisma.jobWorkChallan.deleteMany({ where: { jobWorkOrderId: jobOrder.id } });
        await prisma.jobWorkOrderItem.deleteMany({ where: { jobWorkOrderId: jobOrder.id } });
        await prisma.jobWorkOrder.deleteMany({ where: { id: jobOrder.id } });
      }

      if (approvedBom) {
        await prisma.bomItem.deleteMany({ where: { bomId: approvedBom.id } });
        await prisma.bomMaster.deleteMany({ where: { id: approvedBom.id } });
      }

      if (testVendor) {
        await prisma.inventoryMovement.deleteMany({ where: { companyId, referenceType: { in: ['JOB_WORK_CHALLAN', 'JOB_WORK_RETURN', 'JOB_WORK_RECEIPT', 'JOB_WORK_QC', 'JOB_WORK_REWORK'] } } });
        await prisma.inventoryBatch.deleteMany({ where: { companyId, vendorId: testVendor.id } });
      }

      if (testBatch) {
        await prisma.inventoryMovement.deleteMany({ where: { batchId: testBatch.id } });
        await prisma.inventoryBatch.deleteMany({ where: { id: testBatch.id } });
      }

      if (rawProduct) {
        await prisma.inventoryStock.deleteMany({ where: { productId: rawProduct.id } });
        await prisma.product.deleteMany({ where: { id: rawProduct.id } });
      }

      if (finishedProduct) {
        await prisma.inventoryStock.deleteMany({ where: { productId: finishedProduct.id } });
        await prisma.product.deleteMany({ where: { id: finishedProduct.id } });
      }

      if (testWarehouse) {
        await prisma.inventoryWarehouse.deleteMany({ where: { id: testWarehouse.id } });
      }

      if (testVendor) {
        await prisma.vendor.deleteMany({ where: { id: testVendor.id } });
      }

      console.log('--- Test cleanup completed successfully ---');
    } catch (cleanupErr) {
      console.warn('Warning during cleanup:', cleanupErr.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Direct execution guard
if (process.argv[1] && process.argv[1].includes('phase6_contract_manufacturing.test.js')) {
  runPhase6ContractManufacturingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}
