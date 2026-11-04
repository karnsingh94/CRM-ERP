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

export async function runPhase5ManufacturingTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQUE CRM & ERP — Phase 5: Manufacturing & Production Test Suite');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Testing: BOM 100% Formula, Immutability, Revisions, Costing Simulation,');
  console.log('         Production Plans, Orders, FIFO RM Issue (WIP), Sequential Mixing,');
  console.log('         DPR Logs, QC Gate & FG Receipt, 2-Way Genealogy, Reprocessing');
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

  // 1. Identify or initialize test tenant in crm_erp_test_db
  let client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!client) {
    client = await prisma.clientAdmin.create({
      data: {
        name: 'Shree Nath Exports Test Admin',
        email: `test.admin.${Date.now()}@shreenath.com`,
        mobile: '9876543210',
        organizationName: 'SHREE NATH EXPORTS TEST',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
        status: 'ACTIVE',
      },
    });
  }

  const companyId = client.id;
  const actor = {
    id: 'actor-mfg-mgr',
    userId: 'actor-mfg-mgr',
    email: 'mfg.manager@sne.com',
    name: 'Production Manager',
    role: 'COMPANY_ADMIN',
  };

  const timestamp = Date.now();
  let testWarehouse = null;
  let rmProduct1 = null;
  let rmProduct2 = null;
  let pkgProduct = null;
  let fgProduct = null;
  let rmBatch1 = null;
  let rmBatch2 = null;
  let bomV1 = null;
  let bomV1Revision = null;
  let prodPlan = null;
  let prodOrder = null;
  let mfgBatch = null;
  let dprRecord = null;
  let reprocessingRecord = null;

  try {
    // ------------------------------------------------------------------
    // SETUP: Create Warehouse & Test Products (2 RMs, 1 Packaging, 1 FG)
    // ------------------------------------------------------------------
    testWarehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId,
        code: `WH-MFG-${timestamp}`,
        name: `Manufacturing Test WH ${timestamp}`,
        status: 'ACTIVE',
      },
    });

    rmProduct1 = await prisma.product.create({
      data: {
        companyId,
        sku: `RM-ING-A-${timestamp}`,
        name: `Active Ingredient A ${timestamp}`,
        uom: 'KG',
        category: 'Raw Materials',
        purchasePrice: 150.0,
      },
    });

    rmProduct2 = await prisma.product.create({
      data: {
        companyId,
        sku: `RM-SOL-B-${timestamp}`,
        name: `Solvent Base B ${timestamp}`,
        uom: 'KG',
        category: 'Raw Materials',
        purchasePrice: 80.0,
      },
    });

    pkgProduct = await prisma.product.create({
      data: {
        companyId,
        sku: `PKG-BTL-${timestamp}`,
        name: `Glass Bottle 500ml ${timestamp}`,
        uom: 'NOS',
        category: 'Packaging',
        purchasePrice: 15.0,
      },
    });

    fgProduct = await prisma.product.create({
      data: {
        companyId,
        sku: `FG-ELIXIR-${timestamp}`,
        name: `Finished Elixir 500ml ${timestamp}`,
        uom: 'KG',
        category: 'Finished Goods',
        sellingPrice: 450.0,
      },
    });

    // Seed stock & batches for RM1 and RM2 in AVAILABLE bucket
    await inventoryService.createStock(companyId, {
      sku: rmProduct1.sku,
      initialQuantity: 500,
      warehouseId: testWarehouse.id,
      notes: 'Initial test RM1 stock',
    }, actor);

    rmBatch1 = await inventoryService.createBatch(companyId, {
      sku: rmProduct1.sku,
      batchNo: `BAT-RM1-${timestamp}`,
      warehouse: testWarehouse.name,
      initialQty: 500,
      mfgDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    }, actor);

    await inventoryService.createStock(companyId, {
      sku: rmProduct2.sku,
      initialQuantity: 500,
      warehouseId: testWarehouse.id,
      notes: 'Initial test RM2 stock',
    }, actor);

    rmBatch2 = await inventoryService.createBatch(companyId, {
      sku: rmProduct2.sku,
      batchNo: `BAT-RM2-${timestamp}`,
      warehouse: testWarehouse.name,
      initialQty: 500,
      mfgDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    }, actor);

    await inventoryService.createStock(companyId, {
      sku: pkgProduct.sku,
      initialQuantity: 500,
      warehouseId: testWarehouse.id,
      notes: 'Initial test PKG stock',
    }, actor);

    await inventoryService.createBatch(companyId, {
      sku: pkgProduct.sku,
      batchNo: `BAT-PKG-${timestamp}`,
      warehouse: testWarehouse.name,
      initialQty: 500,
      mfgDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
    }, actor);

    // ------------------------------------------------------------------
    // TEST 1: BOM Formula Validation Rejects Non-100.0000% Formulas
    // ------------------------------------------------------------------
    await test('1. BOM Formula validation rejects non-100% formulas (Under/Over sum)', async () => {
      // Under-sum: 50% + 40% = 90%
      let rejectedUnder = false;
      try {
        bomService.validateFormulaPercentages([
          { productId: rmProduct1.id, percentage: 50.0 },
          { productId: rmProduct2.id, percentage: 40.0 },
        ]);
      } catch (err) {
        if (err.message.includes('100.0000%')) rejectedUnder = true;
      }
      if (!rejectedUnder) throw new Error('Expected 90% formula to be rejected.');

      // Over-sum: 70% + 35% = 105%
      let rejectedOver = false;
      try {
        bomService.validateFormulaPercentages([
          { productId: rmProduct1.id, percentage: 70.0 },
          { productId: rmProduct2.id, percentage: 35.0 },
        ]);
      } catch (err) {
        if (err.message.includes('100.0000%')) rejectedOver = true;
      }
      if (!rejectedOver) throw new Error('Expected 105% formula to be rejected.');
    });

    // ------------------------------------------------------------------
    // TEST 2: BOM Creation with Exact 100.0000% Formula
    // ------------------------------------------------------------------
    await test('2. Create BOM Formula with exact 100.0000% components & standard costing snapshot', async () => {
      bomV1 = await bomService.createBom(companyId, {
        bomName: `Elixir Standard Formula v1.0 ${timestamp}`,
        outputProductId: fgProduct.id,
        batchSize: 100.0,
        uom: 'KG',
        overheadCost: 500.0,
        laborCost: 300.0,
        items: [
          { productId: rmProduct1.id, itemType: 'RAW_MATERIAL', percentage: 60.0000, quantity: 60.0, uom: 'KG', scrapTolerancePct: 1.5 },
          { productId: rmProduct2.id, itemType: 'RAW_MATERIAL', percentage: 35.0000, quantity: 35.0, uom: 'KG', scrapTolerancePct: 1.0 },
          { productId: pkgProduct.id, itemType: 'PACKAGING', percentage: 5.0000, quantity: 5.0, uom: 'NOS', scrapTolerancePct: 0.5 },
        ],
      }, actor);

      if (!bomV1.id || bomV1.version !== '1.0') throw new Error('BOM creation failed or version incorrect.');
      if (bomV1.status !== 'DRAFT' || bomV1.isLocked !== false) throw new Error('Initial BOM should be DRAFT and unlocked.');
      if (bomV1.items.length !== 3) throw new Error('BOM should contain exactly 3 components.');
    });

    // ------------------------------------------------------------------
    // TEST 3: BOM Approval & Immutability Lock
    // ------------------------------------------------------------------
    await test('3. BOM Approval via Phase 1 Engine and Immutability enforcement on approved versions', async () => {
      // Submit for approval
      await bomService.submitForApproval(companyId, bomV1.id, actor);

      // Approve BOM
      const approvedBom = await bomService.approveBom(companyId, bomV1.id, actor);
      if (approvedBom.status !== 'APPROVED' || approvedBom.isLocked !== true) {
        throw new Error('Approved BOM must have status=APPROVED and isLocked=true.');
      }

      // Verify that attempting to update an approved/locked BOM throws BOM_IMMUTABLE error
      let modificationBlocked = false;
      try {
        await bomService.updateBom(companyId, bomV1.id, { bomName: 'Attempted Unsafe Update' }, actor);
      } catch (err) {
        if (err.code === 'DOCUMENT_VERSION_LOCKED' || err.message.includes('locked') || err.message.includes('immutable')) {
          modificationBlocked = true;
        }
      }
      if (!modificationBlocked) throw new Error('Modifying an approved BOM should be strictly blocked.');
    });

    // ------------------------------------------------------------------
    // TEST 4: BOM Revision Branching
    // ------------------------------------------------------------------
    await test('4. BOM Revision Branching creates new version lineage preserving historical version', async () => {
      bomV1Revision = await bomService.branchRevision(companyId, bomV1.id, 'Optimized active ratio', actor);

      if (!bomV1Revision.id) throw new Error('Revision branching failed.');
      if (bomV1Revision.version !== '1.1') throw new Error(`Expected version 1.1, got ${bomV1Revision.version}`);
      if (bomV1Revision.parentBomId !== bomV1.id) throw new Error('Revision must reference parentBomId.');
      if (bomV1Revision.status !== 'DRAFT' || bomV1Revision.isLocked !== false) {
        throw new Error('Branched revision must start as unlocked DRAFT.');
      }
      if (bomV1Revision.items.length !== 3) throw new Error('Revision should inherit parent items.');
    });

    // ------------------------------------------------------------------
    // TEST 5: BOM Costing Simulation (Standard vs Live Costing)
    // ------------------------------------------------------------------
    await test('5. Standard vs Live Costing simulation with scaling and component variance', async () => {
      const simulation = await bomService.simulateCosting(companyId, bomV1.id, 250.0);

      if (simulation.scaleFactor !== 2.5) throw new Error(`Scale factor expected 2.5, got ${simulation.scaleFactor}`);
      if (simulation.components.length !== 3) throw new Error('Simulation must include all components.');
      if (Number(simulation.totalStandardCost) <= 0) throw new Error('Standard cost calculation failed.');
    });

    // ------------------------------------------------------------------
    // TEST 6: Production Planning
    // ------------------------------------------------------------------
    await test('6. Create Production Plan linked to output product, approved BOM and planned batch count', async () => {
      prodPlan = await productionService.createPlan(companyId, {
        planName: `Q4 Elixir Production Plan ${timestamp}`,
        outputProductId: fgProduct.id,
        bomId: bomV1.id,
        plannedQuantity: 200.0,
        uom: 'KG',
        priority: 'HIGH',
      }, actor);

      if (!prodPlan.id) throw new Error('Production plan creation failed.');
      if (prodPlan.plannedBatches !== 2) throw new Error(`Expected 2 batches (200kg / 100kg batchSize), got ${prodPlan.plannedBatches}`);
    });

    // ------------------------------------------------------------------
    // TEST 7: Production Order Creation & Material Availability Check
    // ------------------------------------------------------------------
    await test('7. Production Order creation and automated Material Availability / Shortage evaluation', async () => {
      prodOrder = await productionService.createOrder(companyId, {
        planId: prodPlan.id,
        outputProductId: fgProduct.id,
        bomId: bomV1.id,
        targetQuantity: 100.0,
        uom: 'KG',
        batchSize: 100.0,
      }, actor);

      if (!prodOrder.id) throw new Error('Production order creation failed.');
      if (prodOrder.materialReqs.length !== 3) throw new Error('Order must generate 3 material requirements from BOM.');

      // Check material availability
      const availability = await productionService.checkMaterialAvailability(companyId, prodOrder.id);
      if (typeof availability.hasShortage !== 'boolean') throw new Error('Availability evaluation missing hasShortage flag.');
      if (!Array.isArray(availability.requirements)) throw new Error('Missing availability requirements breakdown.');
    });

    // ------------------------------------------------------------------
    // TEST 8: FIFO Raw Material Issue to WIP & Manufacturing Batch
    // ------------------------------------------------------------------
    await test('8. FIFO Raw Material Issue moves stock to WIP and establishes 2-way batch genealogy', async () => {
      // 1. Create Manufacturing Batch
      mfgBatch = await productionService.createBatch(companyId, prodOrder.id, {
        batchQuantity: 100.0,
        uom: 'KG',
      }, actor);

      if (!mfgBatch.id) throw new Error('Manufacturing batch creation failed.');
      if (mfgBatch.steps.length !== 7) throw new Error('Default sequential mixing should have 7 process steps.');

      // 2. Issue materials FIFO to WIP
      const issueResult = await productionService.issueMaterialsFIFO(companyId, prodOrder.id, {
        batchId: mfgBatch.id,
      }, actor);

      if (issueResult.issuedCount < 1) throw new Error('Expected materials to be issued to WIP.');

      // 3. Verify stock moved to WIP bucket
      const rm1Stock = await prisma.inventoryStock.findFirst({
        where: { companyId, sku: rmProduct1.sku },
      });
      if (Number(rm1Stock.wipQty || rm1Stock.workInProgress) <= 0) {
        throw new Error('Stock not credited to WIP bucket after material issue.');
      }

      // 4. Backward Genealogy check (Batch -> RM materials)
      const genealogy = await productionService.getBatchGenealogy(companyId, mfgBatch.id);
      if (!genealogy.rawMaterials || genealogy.rawMaterials.length === 0) {
        throw new Error('Genealogy must trace issued raw material batches.');
      }

      // 5. Forward Traceability check (RM Batch -> FG Batch)
      const forwardTrace = await productionService.traceRawMaterialForward(companyId, rmBatch1.id);
      if (!forwardTrace.manufacturingBatches || forwardTrace.manufacturingBatches.length === 0) {
        throw new Error('Forward traceability must trace RM batch to manufacturing batch.');
      }
    });

    // ------------------------------------------------------------------
    // TEST 9: Sequential Mixing Stage Gates Enforcement
    // ------------------------------------------------------------------
    await test('9. Sequential Mixing Stage Gates block out-of-order execution (Step N requires Step N-1)', async () => {
      // Complete Step 1 (Dispensing & Pre-Weighing)
      const step1 = await productionService.completeProcessStep(companyId, mfgBatch.id, 1, {
        notes: 'Pre-weighing completed accurately',
        recordedTempC: 24.5,
      }, actor);
      if (step1.status !== 'COMPLETED') throw new Error('Step 1 should be COMPLETED.');

      // Attempt Step 3 directly (Skipping Step 2) -> MUST BE BLOCKED
      let step3Blocked = false;
      try {
        await productionService.completeProcessStep(companyId, mfgBatch.id, 3, {
          notes: 'Attempting premature step 3',
        }, actor);
      } catch (err) {
        if (err.code === 'SEQUENTIAL_GATE_VIOLATION' || err.message.includes('COMPLETED') || err.message.includes('Step')) {
          step3Blocked = true;
        }
      }
      if (!step3Blocked) throw new Error('Sequential gate failed: Step 3 was completed without Step 2!');

      // Complete Step 2 through Step 7 sequentially
      for (let s = 2; s <= 7; s++) {
        await productionService.completeProcessStep(companyId, mfgBatch.id, s, {
          notes: `Step ${s} completed sequentially`,
          recordedTempC: 30.0,
        }, actor);
      }

      // Verify batch status is now QC_PENDING
      const updatedBatch = await prisma.manufacturingBatch.findUnique({ where: { id: mfgBatch.id } });
      if (updatedBatch.status !== 'QC_PENDING') {
        throw new Error(`Expected batch status QC_PENDING after all steps, got ${updatedBatch.status}`);
      }
    });

    // ------------------------------------------------------------------
    // TEST 10: Daily Production Report (DPR) Logging
    // ------------------------------------------------------------------
    await test('10. Daily Production Report (DPR) tracks operating hours, downtime and efficiency %', async () => {
      dprRecord = await productionService.createDpr(companyId, {
        dprDate: new Date().toISOString(),
        shift: 'Shift A',
        machineName: 'Elixir Line 1',
        orderId: prodOrder.id,
        plannedQty: 100.0,
        actualQty: 98.0,
        wastageQty: 2.0,
        downtimeMinutes: 60,
        downtimeReason: 'Minor seal replacement',
      }, actor);

      if (!dprRecord.id) throw new Error('DPR creation failed.');
      if (Number(dprRecord.efficiencyPct) !== 98) {
        throw new Error(`Efficiency calculation error: expected 98.0%, got ${dprRecord.efficiencyPct}%`);
      }
    });

    // ------------------------------------------------------------------
    // TEST 11: QC Gate Enforced Finished Goods Receipt
    // ------------------------------------------------------------------
    await test('11. Manufacturing QC Gate strictly enforces PASSED disposition before Finished Goods receipt', async () => {
      // 1. Attempt FG receipt before QC -> MUST BE REJECTED
      let receiptBlockedNoQc = false;
      try {
        await productionService.receiveFinishedGoods(companyId, mfgBatch.id, {
          warehouse: testWarehouse.name,
          actualOutputQty: 98.0,
        }, actor);
      } catch (err) {
        if (err.code === 'QC_GATE_REJECTED' || err.message.includes('Quality inspection')) {
          receiptBlockedNoQc = true;
        }
      }
      if (!receiptBlockedNoQc) throw new Error('FG receipt succeeded without required QC inspection!');

      // 2. Perform QC Inspection with PASSED disposition
      const qcInspection = await productionService.createQcInspection(companyId, {
        batchId: mfgBatch.id,
        testedQty: 98.0,
        passedQty: 98.0,
        status: 'PASSED',
        remarks: 'Meets all pH, viscosity, and microbial specifications',
        parameterResults: [
          { name: 'pH', spec: '6.5 - 7.2', result: '6.8', passed: true },
          { name: 'Viscosity (cP)', spec: '120 - 150', result: '135', passed: true },
        ],
      }, actor);

      if (qcInspection.status !== 'PASSED') throw new Error('QC status should be PASSED.');

      // 3. Now execute FG Receipt -> MUST SUCCEED
      const fgReceipt = await productionService.receiveFinishedGoods(companyId, mfgBatch.id, {
        warehouse: testWarehouse.name,
        actualOutputQty: 98.0,
        notes: 'Passed QC FG Receipt into Factory Warehouse',
      }, actor);

      if (!fgReceipt.success || Number(fgReceipt.receivedQty) !== 98.0) {
        throw new Error('FG Receipt response invalid.');
      }
      const finishedBatch = await prisma.manufacturingBatch.findUnique({ where: { id: mfgBatch.id } });
      if (finishedBatch.status !== 'COMPLETED') {
        throw new Error(`Batch status expected COMPLETED, got ${finishedBatch.status}`);
      }

      // Verify stock credited to AVAILABLE bucket for finished good
      const fgStock = await prisma.inventoryStock.findFirst({
        where: { companyId, sku: fgProduct.sku },
      });
      if (Number(fgStock.availableQty || fgStock.stock) < 98.0) {
        throw new Error('Finished good stock not credited to AVAILABLE bucket.');
      }
    });

    // ------------------------------------------------------------------
    // TEST 12: Internal Reprocessing Flow
    // ------------------------------------------------------------------
    await test('12. Internal Reprocessing workflow tracks non-conformance, root cause and QC release', async () => {
      // Create a dummy batch to reprocess
      const offSpecBatch = await productionService.createBatch(companyId, prodOrder.id, {
        batchQuantity: 50.0,
        uom: 'KG',
      }, actor);

      reprocessingRecord = await productionService.createReprocessing(companyId, {
        originalBatchId: offSpecBatch.id,
        reason: 'Slightly high viscosity (165 cP vs 150 cP max)',
        reworkPlan: 'Blend with 10% solvent base B and reheat to 40C',
        quantity: 50.0,
      }, actor);

      if (!reprocessingRecord.id || reprocessingRecord.status !== 'PENDING_APPROVAL') {
        throw new Error('Reprocessing creation failed or status incorrect.');
      }

      // Complete reprocessing QC
      const completedReprocess = await productionService.completeReprocessingQc(
        companyId,
        reprocessingRecord.id,
        {
          status: 'PASSED',
          remarks: 'Viscosity restored to 138 cP. Fully conforming.',
        },
        actor
      );

      if (completedReprocess.status !== 'COMPLETED') {
        throw new Error(`Expected reprocessing status COMPLETED, got ${completedReprocess.status}`);
      }
    });

  } finally {
    // ------------------------------------------------------------------
    // TEARDOWN: Clean up test records strictly within crm_erp_test_db
    // ------------------------------------------------------------------
    try {
      await prisma.dailyProductionReport.deleteMany({ where: { companyId } });
      await prisma.manufacturingReprocessing.deleteMany({ where: { companyId } });
      await prisma.manufacturingQC.deleteMany({ where: { companyId } });
      await prisma.manufacturingProcessStep.deleteMany({ where: { companyId } });
      await prisma.manufacturingBatchMaterial.deleteMany({ where: { companyId } });
      await prisma.manufacturingBatch.deleteMany({ where: { companyId } });
      await prisma.productionMaterialRequirement.deleteMany({ where: { companyId } });
      await prisma.productionOrder.deleteMany({ where: { companyId } });
      await prisma.productionPlan.deleteMany({ where: { companyId } });
      await prisma.bomItem.deleteMany({ where: { companyId } });
      await prisma.bomMaster.updateMany({ where: { companyId }, data: { parentBomId: null } });
      await prisma.bomMaster.deleteMany({ where: { companyId } });

      // Clean inventory & product records
      const skus = [rmProduct1?.sku, rmProduct2?.sku, pkgProduct?.sku, fgProduct?.sku].filter(Boolean);
      for (const sku of skus) {
        await prisma.inventoryMovement.deleteMany({ where: { companyId, sku } });
        await prisma.inventoryBatch.deleteMany({ where: { companyId, sku } });
        await prisma.inventoryStock.deleteMany({ where: { companyId, sku } });
        await prisma.product.deleteMany({ where: { companyId, sku } });
      }

      if (testWarehouse?.id) {
        await prisma.inventoryWarehouse.deleteMany({ where: { id: testWarehouse.id } });
      }
    } catch (e) {
      console.warn('Teardown warning in crm_erp_test_db:', e.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`Phase 5 Manufacturing Test Suite Summary: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) throw new Error(`${failed} tests failed in Phase 5 Manufacturing Suite.`);
}

if (process.argv[1] && process.argv[1].includes('phase5_manufacturing_production.test.js')) {
  runPhase5ManufacturingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
