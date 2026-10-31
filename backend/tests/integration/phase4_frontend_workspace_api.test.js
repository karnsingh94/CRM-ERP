import prisma from '../../src/config/prisma.js';
import inventoryService from '../../src/services/inventory/inventory.service.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name} -> ${err.message}`);
    failed++;
  }
}

export async function runFrontendWorkspaceApiTests() {
  console.log('\n========================================================================');
  console.log('Phase 4: Frontend Inventory Workspace API & Action Flow Verification');
  console.log('Testing 10 Tabs, State Transitions, Maker-Checker & Real Endpoints');
  console.log('========================================================================\n');

  const clients = await prisma.clientAdmin.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
  if (clients.length < 1) throw new Error('At least one tenant required.');

  const companyA = clients[0].id;
  const companyB = clients.length > 1 ? clients[1].id : '00000000-0000-0000-0000-000000000099';

  const actorManager = { email: 'inv.mgr@sne.com', name: 'Inventory Manager', role: 'COMPANY_ADMIN', id: 'act-inv-mgr' };
  const actorAuditor = { email: 'auditor@sne.com', name: 'Internal Auditor', role: 'AUDITOR', id: 'act-audit' };
  const actorSupervisor = { email: 'warehouse.sup@sne.com', name: 'Warehouse Supervisor', role: 'COMPANY_ADMIN', id: 'act-sup' };

  const testSku = `FE-TEST-${Date.now()}`;
  let testWarehouse = null;
  let testBin = null;
  let testStock = null;
  let testBatch = null;
  let testReservation = null;
  let testSampling = null;
  let testGatePass = null;
  let testVerification = null;
  let testAdjustment = null;

  try {
    // 1. Tab 3: Warehouse & Bin Management
    await test('Tab 3: Warehouse Management — create warehouse and configure bin location', async () => {
      testWarehouse = await inventoryService.createWarehouse(companyA, {
        code: `WH-FE-${Date.now()}`.slice(0, 30),
        name: `Packaging Godown ${Date.now()}`,
        address: 'Phase 4 Industrial Area',
        contactName: 'Ramesh Storehead',
        contactPhone: '+91 9876543210',
        isDefault: false,
      });
      if (!testWarehouse.id) throw new Error('Failed to create warehouse');

      testBin = await inventoryService.createBin(companyA, testWarehouse.id, {
        code: 'BIN-P4-01',
        aisle: 'Aisle 2',
        rack: 'R-05',
        description: 'Master carton packing boxes',
      });
      if (!testBin.id) throw new Error('Failed to create bin');
    });

    // 2. Tab 2: Stock Overview & Master
    await test('Tab 2: Stock Overview — initialize stock master across 8 buckets and link bin', async () => {
      testStock = await inventoryService.createStock(companyA, {
        sku: testSku,
        name: 'Export Multi-ply Carton',
        warehouse: testWarehouse.name,
        binId: testBin.id,
        stock: 500,
        reorderLevel: 50,
        uom: 'PCS',
        averageCost: 45.0,
      });

      if (testStock.availableQty !== 500) throw new Error(`Expected availableQty 500, got ${testStock.availableQty}`);
      if (testStock.binId !== testBin.id) throw new Error('Failed to associate bin to stock record');
    });

    // 3. Tab 1: Dashboard 8-Bucket KPI Verification
    await test('Tab 1: Dashboard — verifies all 8 dedicated inventory buckets and counters', async () => {
      const dash = await inventoryService.dashboard(companyA);
      if (!dash.buckets) throw new Error('Dashboard missing 8-bucket breakdown');
      const b = dash.buckets;
      const expectedTotal = b.available + b.reserved + b.wip + b.qualityHold + b.rejected + b.sampling + b.returnHold + b.scrap;
      if (b.totalOnHand !== expectedTotal) {
        throw new Error(`Mathematical mismatch: totalOnHand (${b.totalOnHand}) !== sum(8 buckets) (${expectedTotal})`);
      }
      if (dash.warehousesCount < 1) throw new Error('Dashboard warehouses count invalid');
    });

    // 4. Tab 2 Action: Transfer Stock Between Buckets
    await test('Tab 2 Action: Bucket Transfer — transfer 100 units from Available to Quality Hold', async () => {
      const transferred = await inventoryService.transferBucket(companyA, {
        sku: testSku,
        warehouse: testWarehouse.name,
        sourceBucket: 'AVAILABLE',
        destinationBucket: 'QUALITY_HOLD',
        quantity: 100,
        reason: 'Sample QC test hold',
      }, actorManager);

      if (transferred.availableQty !== 400) throw new Error(`Expected available 400, got ${transferred.availableQty}`);
      if (transferred.qualityHoldQty !== 100) throw new Error(`Expected qualityHold 100, got ${transferred.qualityHoldQty}`);
      if (transferred.stock !== 500) throw new Error('Total physical stock was altered during bucket transfer');
    });

    // 5. Tab 4: Batch & FIFO Engine
    await test('Tab 4: Batch / Lot & FIFO — register batch and run FIFO allocation simulator', async () => {
      testBatch = await inventoryService.createBatch(companyA, {
        stockId: testStock.id,
        sku: testSku,
        batchNo: `LOT-FE-${Date.now()}`,
        warehouse: testWarehouse.name,
        initialQty: 400,
        availableQty: 400,
        receivedDate: new Date('2026-05-01'),
        expiryDate: new Date('2027-05-01'),
        vendorName: 'Corrugated Pack Ltd',
        qualityStatus: 'ACCEPTED',
        unitCost: 45.0,
      }, actorManager);

      if (testBatch.availableQty !== 400) throw new Error('Batch creation failed');

      // Run FIFO allocation simulation
      const fifo = await inventoryService.allocateFIFO(companyA, {
        sku: testSku,
        warehouse: testWarehouse.name,
        quantity: 150,
        autoReserve: false,
      }, actorManager);

      if (fifo.allocatedQty !== 150) throw new Error(`Expected 150 allocated, got ${fifo.allocatedQty}`);
      if (fifo.batchesAllocated.length !== 1) throw new Error('Expected 1 batch allocated');
      if (fifo.batchesAllocated[0].batchNo !== testBatch.batchNo) throw new Error('Wrong batch allocated via FIFO');
    });

    // 6. Tab 5: Stock Reservation & Release
    await test('Tab 5: Stock Reservation — create reservation from Available and release back', async () => {
      testReservation = await inventoryService.createReservation(companyA, {
        sku: testSku,
        warehouse: testWarehouse.name,
        batchNo: testBatch.batchNo,
        quantity: 50,
        referenceType: 'SALES_ORDER',
        referenceNo: 'SO-FE-001',
        notes: 'UI reservation test',
      }, actorManager);

      if (testReservation.status !== 'ACTIVE') throw new Error('Reservation not active');

      // Verify Available decreased by 50, Reserved increased by 50
      const stMid = await prisma.inventoryStock.findFirst({ where: { companyId: companyA, sku: testSku } });
      if (stMid.availableQty !== 750) throw new Error(`Expected available 750, got ${stMid.availableQty}`);
      if (stMid.reservedStock !== 50) throw new Error(`Expected reserved 50, got ${stMid.reservedStock}`);

      // Release reservation
      const released = await inventoryService.releaseReservation(companyA, testReservation.id, actorManager, 'Order cancelled');
      if (released.status !== 'RELEASED') throw new Error('Reservation status not updated to RELEASED');

      const stEnd = await prisma.inventoryStock.findFirst({ where: { companyId: companyA, sku: testSku } });
      if (stEnd.availableQty !== 800) throw new Error(`Expected available restored to 800, got ${stEnd.availableQty}`);
      if (stEnd.reservedStock !== 0) throw new Error(`Expected reserved restored to 0, got ${stEnd.reservedStock}`);
    });

    // 7. Tab 6: Customer Sampling & Fee Waiver Workflow
    await test('Tab 6: Sampling Management — fee waiver approval and return workflow', async () => {
      testSampling = await inventoryService.createSampling(companyA, {
        sku: testSku,
        warehouse: testWarehouse.name,
        quantity: 20,
        customerName: 'Global Exporters LLC',
        billingType: 'PAYMENT_WAIVED',
        waivedReason: 'Annual supplier sample contract agreement',
        expectedReturnDate: new Date('2026-11-15'),
        responsiblePerson: 'Sunil Sales',
      }, actorManager);

      if (testSampling.status !== 'PENDING_APPROVAL') throw new Error('Payment waived sampling must require approval');
      if (testSampling.isWaivedApproved !== false) throw new Error('Payment waiver must not be pre-approved');

      // Approve waiver
      const approvedSample = await inventoryService.approveWaivedSampling(companyA, testSampling.id, actorManager);
      if (approvedSample.status !== 'ISSUED') throw new Error('Approved sampling must be ISSUED');
      if (!approvedSample.isWaivedApproved) throw new Error('Waiver must be flagged as approved');

      // Return sample
      const returnedSample = await inventoryService.returnSampling(companyA, testSampling.id, {
        returnedQty: 10,
        destinationBucket: 'AVAILABLE',
        inspectionStatus: 'PASSED_QC',
        notes: 'Unopened samples returned',
      }, actorManager);

      if (returnedSample.status !== 'PARTIALLY_RETURNED') throw new Error('Expected PARTIALLY_RETURNED status');
      if (returnedSample.returnedQty !== 10) throw new Error(`Expected returnedQty 10, got ${returnedSample.returnedQty}`);
    });

    // 8. Tab 7: Gate Pass Dispatch & Return
    await test('Tab 7: Gate Pass Register — create, dispatch and partial return flow', async () => {
      testGatePass = await inventoryService.createGatePass(companyA, {
        gatePassType: 'RETURNABLE',
        fromWarehouse: testWarehouse.name,
        destination: 'Shree Lab Testers Pvt Ltd',
        purpose: 'Compression strength test',
        items: [{ sku: testSku, name: 'Export Multi-ply Carton', qty: 5, uom: 'PCS', value: 225 }],
      }, actorManager);

      if (testGatePass.status !== 'APPROVED') throw new Error('Gate pass not approved initially');

      // Dispatch
      const dispatched = await inventoryService.dispatchGatePass(companyA, testGatePass.id, actorManager);
      if (dispatched.status !== 'DISPATCHED') throw new Error('Gate pass not marked DISPATCHED');

      // Return
      const returnedGP = await inventoryService.returnGatePass(companyA, testGatePass.id, {
        isPartial: true,
        notes: '3 units returned, 2 units retained for destructive test',
      }, actorManager);
      if (returnedGP.status !== 'PARTIALLY_RETURNED') throw new Error('Gate pass not marked PARTIALLY_RETURNED');
    });

    // 9. Tab 8: Physical Verification & Automated Variance
    await test('Tab 8: Physical Stock Verification — snapshot, variance calculation and Maker-Checker SoD', async () => {
      testVerification = await inventoryService.createVerificationSession(companyA, {
        warehouse: testWarehouse.name,
        scheduleFrequency: 'FORTNIGHTLY',
        verifierName: actorAuditor.name,
        notes: 'Bi-weekly stock reconciliation',
      }, actorAuditor);

      if (testVerification.status !== 'IN_PROGRESS') throw new Error('Session should be IN_PROGRESS');
      if (testVerification.items.length === 0) throw new Error('Session snapshot failed to capture warehouse items');

      // Submit physical counts with a shortage of 5 units
      const targetItem = testVerification.items.find((it) => it.sku === testSku);
      const systemQty = targetItem.systemQty;
      const countedQty = systemQty - 5;

      const countedSession = await inventoryService.submitPhysicalCounts(companyA, testVerification.id, {
        items: [{ sku: testSku, countedQty }],
      }, actorAuditor);

      if (countedSession.status !== 'PENDING_APPROVAL') throw new Error('Session not PENDING_APPROVAL');
      if (countedSession.totalVarianceShortage !== 5) throw new Error(`Expected variance shortage 5, got ${countedSession.totalVarianceShortage}`);

      // Maker-Checker: Verifier actorAuditor CANNOT approve their own session
      let sodBlocked = false;
      try {
        await inventoryService.approveVerificationSession(companyA, testVerification.id, actorAuditor);
      } catch (err) {
        if (err.statusCode === 403 || err.message.includes('Segregation of Duties')) sodBlocked = true;
      }
      if (!sodBlocked) throw new Error('Maker-Checker SoD failed: Verifier was allowed to approve own session!');

      // Second user (actorSupervisor) CAN approve
      const approvedSession = await inventoryService.approveVerificationSession(companyA, testVerification.id, actorSupervisor);
      if (approvedSession.status !== 'APPROVED') throw new Error('Approved session status should be APPROVED');
    });

    // 10. Tab 9: Stock Adjustment Maker-Checker Segregation of Duties
    await test('Tab 9: Stock Adjustment — maker-checker enforcement (creator cannot approve own adjustment)', async () => {
      testAdjustment = await inventoryService.createAdjustment(companyA, {
        sku: testSku,
        warehouse: testWarehouse.name,
        bucket: 'AVAILABLE',
        adjustmentType: 'DAMAGE',
        adjustmentQty: -10,
        reason: 'Water droplet damage near bay door',
        notes: 'Surveyor verified',
      }, actorManager);

      if (testAdjustment.status !== 'PENDING_APPROVAL') throw new Error('Adjustment not PENDING_APPROVAL');

      // Creator actorManager CANNOT approve
      let makerBlocked = false;
      try {
        await inventoryService.approveAdjustment(companyA, testAdjustment.id, actorManager);
      } catch (err) {
        if (err.statusCode === 403 || err.message.includes('Segregation of Duties')) makerBlocked = true;
      }
      if (!makerBlocked) throw new Error('Segregation of Duties failed: Maker was allowed to approve own adjustment!');

      // Checker actorSupervisor approves
      const approvedAdj = await inventoryService.approveAdjustment(companyA, testAdjustment.id, actorSupervisor);
      if (approvedAdj.status !== 'APPROVED') throw new Error('Adjustment should be APPROVED');
    });

    // 11. Tab 10: Stock Movement Ledger
    await test('Tab 10: Movement Ledger — verifies multi-bucket audit log entries and bucket filters', async () => {
      const movements = await inventoryService.listMovements(companyA, { sku: testSku });
      if (movements.length < 3) throw new Error(`Expected at least 3 ledger movements for ${testSku}, found ${movements.length}`);

      const qualityHoldMoves = await inventoryService.listMovements(companyA, { sku: testSku, bucket: 'QUALITY_HOLD' });
      if (qualityHoldMoves.length === 0) throw new Error('Failed to filter movement ledger by QUALITY_HOLD bucket');
    });

    // 12. Multi-tenant security
    await test('Cross-tenant security: Tenant B cannot access Tenant A inventory records', async () => {
      const crossStocks = await inventoryService.listStocks(companyB, { sku: testSku });
      if (crossStocks.length > 0) throw new Error('Tenant B listStocks exposed Tenant A stock records');

      const crossGatePasses = await inventoryService.listGatePasses(companyB);
      const leaked = crossGatePasses.some((gp) => gp.id === testGatePass.id);
      if (leaked) throw new Error('Tenant B listGatePasses exposed Tenant A gate passes');
    });

  } finally {
    console.log('\nCleaning up Frontend Test Artifacts...');
    try {
      if (testAdjustment?.id) await prisma.inventoryAdjustment.deleteMany({ where: { id: testAdjustment.id } });
      if (testVerification?.id) {
        await prisma.inventoryPhysicalVerificationItem.deleteMany({ where: { sessionId: testVerification.id } });
        await prisma.inventoryPhysicalVerification.deleteMany({ where: { id: testVerification.id } });
      }
      if (testGatePass?.id) await prisma.inventoryGatePass.deleteMany({ where: { id: testGatePass.id } });
      if (testSampling?.id) await prisma.inventorySampling.deleteMany({ where: { id: testSampling.id } });
      if (testReservation?.id) await prisma.inventoryReservation.deleteMany({ where: { id: testReservation.id } });

      await prisma.inventoryMovement.deleteMany({ where: { companyId: companyA, sku: testSku } });
      await prisma.inventoryBatch.deleteMany({ where: { companyId: companyA, sku: testSku } });
      await prisma.inventoryStock.deleteMany({ where: { companyId: companyA, sku: testSku } });

      if (testWarehouse?.id) {
        await prisma.inventoryBin.deleteMany({ where: { warehouseId: testWarehouse.id } });
        await prisma.inventoryWarehouse.deleteMany({ where: { id: testWarehouse.id } });
      }
    } catch (e) {
      console.warn('Cleanup note:', e.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`Frontend Workspace API Suite: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) throw new Error(`${failed} tests failed in Frontend Workspace API Suite.`);
}

if (process.argv[1] && process.argv[1].includes('phase4_frontend_workspace_api.test.js')) {
  runFrontendWorkspaceApiTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
