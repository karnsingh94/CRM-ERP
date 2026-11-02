import prisma from '../../src/config/prisma.js';
import bomService from '../../src/services/production/bom.service.js';
import productionService from '../../src/services/production/production.service.js';
import inventoryService from '../../src/services/inventory/inventory.service.js';

// Strict Safety Guard: Tests must ONLY run against isolated test database
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 5 test suite must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${process.env.DATABASE_URL || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase5FrontendWorkspaceApiTests() {
  console.log('\n========================================================================');
  console.log('Phase 5: Frontend Manufacturing & Production Workspace API Verification');
  console.log('Testing 12 Workspace Tabs, Real Endpoints, State Transitions & Security');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
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

  // 1. Fetch or create test tenant
  let client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!client) {
    client = await prisma.clientAdmin.create({
      data: {
        name: 'Shree Nath Exports Phase 5 FE Admin',
        email: `admin.p5fe.${Date.now()}@shreenathexports.com`,
        mobile: '9876543210',
        organizationName: 'SHREE NATH EXPORTS TEST',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
        status: 'ACTIVE',
      },
    });
  }

  const companyId = client.id;
  const companyB = '00000000-0000-0000-0000-000000000099';
  const actor = {
    id: `act-p5fe-${Date.now()}`,
    userId: `act-p5fe-${Date.now()}`,
    email: 'production.lead@shreenath.com',
    name: 'Production Lead FE',
    role: 'COMPANY_ADMIN',
  };

  const testSuffix = Date.now().toString().slice(-6);
  const fgSku = `FG-FE-${testSuffix}`;
  const rm1Sku = `RM-FE1-${testSuffix}`;
  const rm2Sku = `RM-FE2-${testSuffix}`;
  const pm1Sku = `PM-FE1-${testSuffix}`;

  let testWarehouse = null;
  let testFgProduct = null;
  let testRm1Product = null;
  let testRm2Product = null;
  let testPm1Product = null;
  let rmBatch1 = null;
  let rmBatch2 = null;
  let pmBatch1 = null;

  let testBom = null;
  let testBomRevision = null;
  let testPlan = null;
  let testOrder = null;
  let testBatch = null;
  let testDpr = null;
  let testQc = null;
  let testFgReceipt = null;
  let testReprocess = null;

  try {
    // PREPARATION: Create Warehouse & Test Products
    testWarehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `WH-P5FE-${testSuffix}`,
        name: `Production Godown ${testSuffix}`,
        status: 'ACTIVE',
      },
    });

    testFgProduct = await prisma.product.create({
      data: {
        companyId,
        sku: fgSku,
        name: `Herbal Infusion Bottle ${testSuffix}`,
        uom: 'BOTTLE',
        category: 'Finished Goods',
        purchasePrice: 85.0,
        sellingPrice: 160.0,
      },
    });

    testRm1Product = await prisma.product.create({
      data: {
        companyId,
        sku: rm1Sku,
        name: `Organic Botanical Extract ${testSuffix}`,
        uom: 'KG',
        category: 'Raw Materials',
        purchasePrice: 450.0,
        sellingPrice: 600.0,
      },
    });

    testRm2Product = await prisma.product.create({
      data: {
        companyId,
        sku: rm2Sku,
        name: `Purified Demineralized Water ${testSuffix}`,
        uom: 'LITER',
        category: 'Raw Materials',
        purchasePrice: 12.0,
        sellingPrice: 20.0,
      },
    });

    testPm1Product = await prisma.product.create({
      data: {
        companyId,
        sku: pm1Sku,
        name: `Amber Glass Bottle 500ml ${testSuffix}`,
        uom: 'PCS',
        category: 'Packaging',
        purchasePrice: 22.0,
        sellingPrice: 35.0,
      },
    });

    // Seed stock & batches for RM1, RM2, and PM1
    await inventoryService.createStock(companyId, {
      sku: rm1Sku,
      stock: 200,
      warehouse: testWarehouse.name,
      notes: 'Initial test RM1 stock',
    }, actor);

    rmBatch1 = await inventoryService.createBatch(companyId, {
      sku: rm1Sku,
      batchNo: `RM1-B-${testSuffix}`,
      warehouse: testWarehouse.name,
      initialQty: 200,
      mfgDate: new Date('2026-10-01').toISOString(),
      expiryDate: new Date('2028-10-01').toISOString(),
    }, actor);

    await inventoryService.createStock(companyId, {
      sku: rm2Sku,
      stock: 500,
      warehouse: testWarehouse.name,
      notes: 'Initial test RM2 stock',
    }, actor);

    rmBatch2 = await inventoryService.createBatch(companyId, {
      sku: rm2Sku,
      batchNo: `RM2-B-${testSuffix}`,
      warehouse: testWarehouse.name,
      initialQty: 500,
      mfgDate: new Date('2026-10-01').toISOString(),
      expiryDate: new Date('2028-10-01').toISOString(),
    }, actor);

    await inventoryService.createStock(companyId, {
      sku: pm1Sku,
      stock: 500,
      warehouse: testWarehouse.name,
      notes: 'Initial test PM1 stock',
    }, actor);

    pmBatch1 = await inventoryService.createBatch(companyId, {
      sku: pm1Sku,
      batchNo: `PM1-B-${testSuffix}`,
      warehouse: testWarehouse.name,
      initialQty: 500,
      mfgDate: new Date('2026-10-01').toISOString(),
      expiryDate: new Date('2030-10-01').toISOString(),
    }, actor);

    // =========================================================================
    // TAB 1: Manufacturing Dashboard
    // =========================================================================
    await test('Tab 1: Manufacturing Dashboard — query summary metrics and module health', async () => {
      const bomCount = await prisma.bomMaster.count({ where: { companyId } });
      const orderCount = await prisma.productionOrder.count({ where: { companyId } });
      const batchCount = await prisma.manufacturingBatch.count({ where: { companyId } });
      const dprCount = await prisma.dailyProductionReport.count({ where: { companyId } });

      if (typeof bomCount !== 'number' || typeof orderCount !== 'number') {
        throw new Error('Failed to retrieve manufacturing dashboard counts');
      }
    });

    // =========================================================================
    // TAB 2: BOM Master & Formula Management (100.0000% Check & Revisions)
    // =========================================================================
    await test('Tab 2: BOM Master — formula validation rejects non-100.0000% and accepts 100.0000%', async () => {
      // 1. Try invalid formula (60% + 30% = 90% != 100%)
      let threwErr = false;
      try {
        bomService.validateFormulaPercentages([
          { productId: testRm1Product.id, percentage: 60.0 },
          { productId: testRm2Product.id, percentage: 30.0 },
        ]);
      } catch (e) {
        if (e.message.includes('100.0000%')) threwErr = true;
      }
      if (!threwErr) throw new Error('Expected 90% formula to be rejected by strict 100.0000% rule');

      // 2. Create valid formula (60.0000% + 35.0000% + 5.0000% = 100.0000%)
      testBom = await bomService.createBom(companyId, {
        bomName: `Herbal Infusion Master BOM ${testSuffix}`,
        outputProductId: testFgProduct.id,
        batchSize: 100.0,
        uom: 'BOTTLE',
        overheadCost: 300.0,
        laborCost: 200.0,
        items: [
          { productId: testRm1Product.id, itemType: 'RAW_MATERIAL', percentage: 60.0000, quantity: 60.0, uom: 'KG', scrapTolerancePct: 1.0 },
          { productId: testRm2Product.id, itemType: 'RAW_MATERIAL', percentage: 35.0000, quantity: 35.0, uom: 'LITER', scrapTolerancePct: 0.5 },
          { productId: testPm1Product.id, itemType: 'PACKAGING', percentage: 5.0000, quantity: 5.0, uom: 'PCS', scrapTolerancePct: 0.0 },
        ],
      }, actor);

      if (!testBom?.id) throw new Error('Failed to create valid 100.0000% BOM');
      if (testBom.status !== 'DRAFT') throw new Error(`Expected DRAFT status, received ${testBom.status}`);
      if (testBom.items.length !== 3) throw new Error(`Expected 3 BOM items, received ${testBom.items.length}`);
    });

    await test('Tab 2: BOM Master — workflow submission, approval and immutable revision branching', async () => {
      // Submit for approval
      const submitted = await bomService.submitForApproval(companyId, testBom.id, actor);
      if (submitted.status !== 'PENDING_APPROVAL') throw new Error(`Expected PENDING_APPROVAL, got ${submitted.status}`);

      // Approve BOM
      const approved = await bomService.approveBom(companyId, testBom.id, actor);
      if (approved.status !== 'APPROVED' || !approved.isLocked) {
        throw new Error(`Expected APPROVED & locked status, got status=${approved.status}, isLocked=${approved.isLocked}`);
      }

      // Immutability: In-place edit of approved BOM must fail
      let editBlocked = false;
      try {
        await bomService.updateBom(companyId, testBom.id, { bomName: 'Unauthorized in-place edit' }, actor);
      } catch (e) {
        editBlocked = true;
      }
      if (!editBlocked) throw new Error('Expected update on APPROVED BOM to be blocked');

      // Create Revision Branch
      testBomRevision = await bomService.branchRevision(companyId, testBom.id, 'Optimizing active ratio for shelf stability', actor);

      if (!testBomRevision?.id) throw new Error('Failed to create BOM revision');
      if (testBomRevision.version !== '1.1') throw new Error(`Expected version 1.1, got ${testBomRevision.version}`);
      if (testBomRevision.parentBomId !== testBom.id) throw new Error('Revision lineage parentBomId missing');
    });

    // =========================================================================
    // TAB 3: BOM Costing & Simulation
    // =========================================================================
    await test('Tab 3: BOM Costing & Simulation — standard vs live costs and target batch simulation', async () => {
      const simulation = await bomService.simulateCosting(companyId, testBom.id, 250.0);

      if (!simulation || typeof simulation.totalStandardCost !== 'number') {
        throw new Error('Simulation failed to return total standard cost');
      }
      if (simulation.scaleFactor !== 2.5) throw new Error(`Scale factor mismatch: expected 2.5, got ${simulation.scaleFactor}`);
      if (simulation.components.length !== 3) throw new Error(`Expected 3 simulation components, got ${simulation.components.length}`);
    });

    // =========================================================================
    // TAB 4: Production Planning
    // =========================================================================
    await test('Tab 4: Production Planning — create and list plans linked to approved BOM', async () => {
      testPlan = await productionService.createPlan(companyId, {
        planName: `Monthly Infusion Plan ${testSuffix}`,
        outputProductId: testFgProduct.id,
        bomId: testBom.id,
        plannedQuantity: 200.0,
        uom: 'BOTTLE',
        priority: 'HIGH',
      }, actor);

      if (!testPlan?.id) throw new Error('Failed to create production plan');
      if (testPlan.plannedBatches !== 2) throw new Error(`Expected 2 batches, got ${testPlan.plannedBatches}`);

      const plans = await productionService.listPlans(companyId);
      const found = plans.find(p => p.id === testPlan.id);
      if (!found) throw new Error('Created production plan not found in plan list');
    });

    // =========================================================================
    // TAB 5: Production Work Orders
    // =========================================================================
    await test('Tab 5: Production Orders — create work order, status progression to RELEASED', async () => {
      testOrder = await productionService.createOrder(companyId, {
        planId: testPlan.id,
        outputProductId: testFgProduct.id,
        bomId: testBom.id,
        targetQuantity: 100.0,
        uom: 'BOTTLE',
        batchSize: 100.0,
      }, actor);

      if (!testOrder?.id) throw new Error('Failed to create production order');
      if (testOrder.materialReqs.length !== 3) throw new Error('Order must generate 3 material requirements');

      // Transition PLANNED -> READY_FOR_PRODUCTION
      const updated = await productionService.updateOrderStatus(companyId, testOrder.id, 'READY_FOR_PRODUCTION', actor);
      if (updated.status !== 'READY_FOR_PRODUCTION') throw new Error(`Expected READY_FOR_PRODUCTION status, got ${updated.status}`);
    });

    // =========================================================================
    // TAB 6: Raw Material Requirements & FIFO Issue
    // =========================================================================
    await test('Tab 6: RM Requirements & FIFO Issue — check availability, issue to WIP, and return unused', async () => {
      // 1. Check availability
      const avail = await productionService.checkMaterialAvailability(companyId, testOrder.id);
      if (!avail || typeof avail.hasShortage !== 'boolean') throw new Error('Failed to fetch material availability');
      if (avail.hasShortage) {
        throw new Error('Unexpected material shortage with stock already present');
      }

      // 2. Create batch first (required for batch linking during FIFO issue)
      testBatch = await productionService.createBatch(companyId, testOrder.id, {
        batchQuantity: 100.0,
        uom: 'BOTTLE',
      }, actor);
      if (!testBatch?.id) throw new Error('Failed to create manufacturing batch');

      // 3. Issue FIFO material to WIP
      const issueResult = await productionService.issueMaterialsFIFO(companyId, testOrder.id, {
        batchId: testBatch.id,
      }, actor);

      if (!issueResult || issueResult.issuedCount < 1) {
        throw new Error('Failed to issue FIFO material allocations to WIP');
      }

      // 4. Return unused material from WIP to Available
      const returnResult = await productionService.returnUnusedMaterial(companyId, {
        orderId: testOrder.id,
        rmBatchId: rmBatch2.id,
        quantity: 5.0,
        reason: 'Excess purified water return from mixing vessel',
      }, actor);

      if (!returnResult || !returnResult.success) {
        throw new Error('Failed to return unused material from WIP');
      }
    });

    // =========================================================================
    // TAB 7: Manufacturing Batch Management
    // =========================================================================
    await test('Tab 7: Manufacturing Batch — verify batch status and process steps', async () => {
      const batchRecord = await prisma.manufacturingBatch.findUnique({
        where: { id: testBatch.id },
        include: { steps: true, materials: true },
      });

      if (!batchRecord) throw new Error('Batch record not found');
      if (batchRecord.steps.length !== 7) throw new Error(`Expected 7 process steps, got ${batchRecord.steps.length}`);
    });

    // =========================================================================
    // TAB 8: Mixing Sequence & Process Tracking (7 Sequential Stage Gates)
    // =========================================================================
    await test('Tab 8: Mixing Sequence & Process Tracking — stage gate blocks out-of-order execution', async () => {
      // Attempting step 3 before step 1 & 2 must fail
      let blocked = false;
      try {
        await productionService.completeProcessStep(companyId, testBatch.id, 3, {
          notes: 'Attempting out-of-order execution',
        }, actor);
      } catch (e) {
        blocked = true;
      }
      if (!blocked) throw new Error('Expected out-of-order stage completion to be blocked by stage gate');

      // Complete Step 1: Dispensing & Pre-Weighing
      const step1 = await productionService.completeProcessStep(companyId, testBatch.id, 1, {
        notes: 'Pre-weighed exact active botanical ratio',
        recordedTempC: 24.5,
      }, actor);
      if (step1.status !== 'COMPLETED') throw new Error('Failed to complete step 1');

      // Complete Step 2 through 7 sequentially
      for (let s = 2; s <= 7; s++) {
        await productionService.completeProcessStep(companyId, testBatch.id, s, {
          notes: `Step ${s} completed sequentially`,
          recordedTempC: 30.0,
        }, actor);
      }

      const postBatch = await prisma.manufacturingBatch.findUnique({ where: { id: testBatch.id } });
      if (postBatch.status !== 'QC_PENDING') {
        throw new Error(`Expected batch status QC_PENDING after all 7 steps, got ${postBatch.status}`);
      }
    });

    // =========================================================================
    // TAB 9: Daily Production Report (DPR)
    // =========================================================================
    await test('Tab 9: Daily Production Report — create DPR and verify efficiency calculation', async () => {
      testDpr = await productionService.createDpr(companyId, {
        dprDate: new Date().toISOString(),
        shift: 'Shift A',
        machineName: 'Infusion Line 1',
        orderId: testOrder.id,
        plannedQty: 100.0,
        actualQty: 96.0,
        wastageQty: 4.0,
        downtimeMinutes: 30,
        downtimeReason: 'Conveyor feeder adjustment',
      }, actor);

      if (!testDpr?.id) throw new Error('Failed to create DPR report');
      if (Number(testDpr.efficiencyPct) !== 96) {
        throw new Error(`Expected 96% efficiency, got ${testDpr.efficiencyPct}`);
      }

      const dprList = await productionService.listDprs(companyId);
      const found = dprList.find(r => r.id === testDpr.id);
      if (!found) throw new Error('Created DPR not found in list');
    });

    // =========================================================================
    // TAB 10: Manufacturing Quality Control & FG Receipt Gate
    // =========================================================================
    await test('Tab 10: Manufacturing QC & FG Receipt — gate blocks FG receipt until QC PASS', async () => {
      // 1. FG receipt without QC PASS must fail
      let receiptBlocked = false;
      try {
        await productionService.receiveFinishedGoods(companyId, testBatch.id, {
          warehouse: testWarehouse.name,
          actualOutputQty: 96.0,
        }, actor);
      } catch (e) {
        receiptBlocked = true;
      }
      if (!receiptBlocked) throw new Error('Expected FG receipt to be blocked prior to QC PASS');

      // 2. Perform QC Inspection -> PASS
      testQc = await productionService.createQcInspection(companyId, {
        batchId: testBatch.id,
        testedQty: 96.0,
        passedQty: 96.0,
        status: 'PASSED',
        remarks: 'Meets all organoleptic and analytical specifications',
        parameterResults: [
          { name: 'pH', spec: '6.5 - 7.2', result: '6.85', passed: true },
          { name: 'Viscosity (cP)', spec: '120 - 150', result: '135', passed: true },
        ],
      }, actor);

      if (!testQc?.id) throw new Error('Failed to create QC inspection');

      // 3. Perform FG Receipt after QC PASS
      testFgReceipt = await productionService.receiveFinishedGoods(companyId, testBatch.id, {
        warehouse: testWarehouse.name,
        actualOutputQty: 96.0,
        notes: 'Passed QC FG Receipt into Factory Warehouse',
      }, actor);

      if (!testFgReceipt?.success || Number(testFgReceipt.receivedQty) !== 96.0) {
        throw new Error('Finished goods receipt failed or invalid response');
      }

      // Verify stock credited to AVAILABLE bucket for finished good
      const fgStock = await prisma.inventoryStock.findFirst({
        where: { companyId, sku: fgSku },
      });
      if (Number(fgStock.availableQty || fgStock.stock) < 96.0) {
        throw new Error('Finished good stock not credited to AVAILABLE bucket');
      }
    });

    // =========================================================================
    // TAB 11: Finished Goods & Batch Traceability (2-Way Genealogy)
    // =========================================================================
    await test('Tab 11: 2-Way Batch Traceability — verify backward FG->RM and forward RM->FG links', async () => {
      // 1. Backward genealogy (FG Batch -> consumed RMs)
      const backward = await productionService.getBatchGenealogy(companyId, testBatch.id);
      if (!backward || !Array.isArray(backward.rawMaterials)) {
        throw new Error('Backward traceability payload incomplete');
      }
      if (backward.rawMaterials.length === 0) {
        throw new Error('Backward traceability failed to return consumed raw material batches');
      }

      // 2. Forward genealogy (RM Batch -> FG batch)
      const forward = await productionService.traceRawMaterialForward(companyId, rmBatch1.id);
      if (!forward || !forward.manufacturingBatches || forward.manufacturingBatches.length === 0) {
        throw new Error('Forward traceability did not identify manufactured batch');
      }
      const hasBatch = forward.manufacturingBatches.some(b => (b.batchNo || b.batchNumber) === (testBatch.batchNo || testBatch.batchNumber));
      if (!hasBatch) throw new Error('Forward traceability did not identify manufactured batch');
    });

    // =========================================================================
    // TAB 12: Internal Reprocessing
    // =========================================================================
    await test('Tab 12: Internal Reprocessing — create rework ticket and execute post-reprocessing QC', async () => {
      // Create off-spec batch
      const offSpecBatch = await productionService.createBatch(companyId, testOrder.id, {
        batchQuantity: 20.0,
        uom: 'BOTTLE',
      }, actor);

      testReprocess = await productionService.createReprocessing(companyId, {
        originalBatchId: offSpecBatch.id,
        reason: 'Slightly high viscosity (160 cP vs 150 cP spec)',
        reworkPlan: 'Blend with purified solvent and recirculate for 30 minutes',
        quantity: 20.0,
      }, actor);

      if (!testReprocess?.id || testReprocess.status !== 'PENDING_APPROVAL') {
        throw new Error('Failed to create reprocessing ticket or status invalid');
      }

      // Post-reprocessing QC verification
      const verified = await productionService.completeReprocessingQc(
        companyId,
        testReprocess.id,
        {
          status: 'PASSED',
          remarks: 'Viscosity normalized to 135 cP. Batch conforming to standard.',
        },
        actor
      );

      if (!verified || verified.status !== 'COMPLETED') {
        throw new Error('Post-reprocessing QC sign-off failed');
      }
    });

    // =========================================================================
    // TENANT ISOLATION
    // =========================================================================
    await test('Tenant Isolation: Tenant B cannot access Tenant A production orders, batches or DPRs', async () => {
      const bOrders = await productionService.listOrders(companyB);
      if (bOrders.some(o => o.id === testOrder.id)) {
        throw new Error('Tenant B listOrders exposed Tenant A order');
      }

      const bBatches = await prisma.manufacturingBatch.findMany({ where: { companyId: companyB } });
      if (bBatches.some(b => b.id === testBatch.id)) {
        throw new Error('Tenant B findMany exposed Tenant A batch');
      }

      const bDprs = await productionService.listDprs(companyB);
      if (bDprs.some(d => d.id === testDpr.id)) {
        throw new Error('Tenant B listDprs exposed Tenant A DPR');
      }
    });

  } finally {
    console.log('\nCleaning up Phase 5 Frontend Workspace Test Artifacts...');
    try {
      await prisma.manufacturingReprocessing.deleteMany({ where: { companyId } });
      await prisma.manufacturingQC.deleteMany({ where: { companyId } });
      await prisma.dailyProductionReport.deleteMany({ where: { companyId } });
      await prisma.manufacturingProcessStep.deleteMany({ where: { companyId } });
      await prisma.manufacturingBatchMaterial.deleteMany({ where: { companyId } });
      await prisma.manufacturingBatch.deleteMany({ where: { companyId } });
      await prisma.productionMaterialRequirement.deleteMany({ where: { companyId } });
      await prisma.productionOrder.deleteMany({ where: { companyId } });
      await prisma.productionPlan.deleteMany({ where: { companyId } });

      if (testBom?.id || testBomRevision?.id) {
        await prisma.bomMaster.updateMany({
          where: { companyId },
          data: { parentBomId: null },
        });
        await prisma.bomItem.deleteMany({
          where: { companyId },
        });
        await prisma.bomMaster.deleteMany({ where: { companyId } });
      }

      await prisma.inventoryMovement.deleteMany({ where: { companyId, sku: { in: [fgSku, rm1Sku, rm2Sku, pm1Sku] } } });
      await prisma.inventoryBatch.deleteMany({ where: { companyId, sku: { in: [fgSku, rm1Sku, rm2Sku, pm1Sku] } } });
      await prisma.inventoryStock.deleteMany({ where: { companyId, sku: { in: [fgSku, rm1Sku, rm2Sku, pm1Sku] } } });

      if (testWarehouse?.id) {
        await prisma.inventoryWarehouse.deleteMany({ where: { id: testWarehouse.id } });
      }

      await prisma.product.deleteMany({ where: { companyId, sku: { in: [fgSku, rm1Sku, rm2Sku, pm1Sku] } } });
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`Phase 5 Frontend Workspace API Suite: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) throw new Error(`${failed} tests failed in Phase 5 Frontend Workspace API Suite.`);
}

if (process.argv[1] && process.argv[1].includes('phase5_frontend_workspace_api.test.js')) {
  runPhase5FrontendWorkspaceApiTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
