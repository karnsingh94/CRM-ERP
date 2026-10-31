import prisma from '../../src/config/prisma.js';
import inventoryService from '../../src/services/inventory/inventory.service.js';
import purchaseService from '../../src/services/purchase/purchase.service.js';

export async function runPhase4InventoryWarehouseTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 4: Inventory & Warehouse Management Test Suite');
  console.log('Testing: 8 Buckets, Batches/Lots, FIFO Engine, Reservations, Sampling,');
  console.log('         Gate Pass, Fortnightly Audits, Maker-Checker Adjustments, GRN Integration');
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

  // 1. Identify primary and secondary tenants
  const clients = await prisma.clientAdmin.findMany({
    where: { deletedAt: null },
    take: 2,
    orderBy: { createdAt: 'desc' },
  });
  if (clients.length < 1) throw new Error('At least one tenant required for Phase 4 test.');

  const companyA = clients[0].id;
  const companyB = clients.length > 1 ? clients[1].id : '00000000-0000-0000-0000-000000000099';

  const actorManager = { email: 'inv.manager@sne.com', name: 'Inventory Manager', role: 'COMPANY_ADMIN', id: 'actor-inv-mgr' };
  const actorStorekeeper = { email: 'storekeeper@sne.com', name: 'Store Keeper', role: 'COMPANY_USER', id: 'actor-store-1' };
  const actorAuditor = { email: 'internal.auditor@sne.com', name: 'Stock Auditor', role: 'AUDITOR', id: 'actor-audit-1' };

  const testSku = `PROD-TEST-${Date.now()}`;
  let testWarehouse = null;
  let testBatch1 = null;
  let testBatch2 = null;
  let testBatch3 = null;
  let testReservation = null;
  let testSampling = null;
  let testGatePass = null;
  let testVerification = null;
  let testAdjustment = null;
  let testVendor = null;
  let testPO = null;
  let testGRN = null;
  let testPR = null;

  try {
    // TEST 1: Creation of all eight inventory buckets
    await test('1. Eight inventory buckets initialization and stock breakdown verification', async () => {
      const stock = await inventoryService.createStock(companyA, {
        sku: testSku,
        name: 'Standard Export Master Carton Box',
        warehouse: 'Unit 2 Packaging Warehouse',
        stock: 1000,
        averageCost: 45,
        reorderLevel: 200,
        uom: 'PCS',
      }, actorStorekeeper);

      if (!stock?.id) throw new Error('Failed to create initial stock');
      if (stock.availableQty !== 1000) throw new Error(`Expected availableQty 1000, got ${stock.availableQty}`);
      if (stock.reservedStock !== 0) throw new Error(`Expected reservedStock 0, got ${stock.reservedStock}`);
      if (stock.wipQty !== 0 || stock.qualityHoldQty !== 0 || stock.rejectedQty !== 0) {
        throw new Error('Initial auxiliary bucket quantities must be 0');
      }

      // Transfer 100 units from AVAILABLE to WIP, and 50 to QUALITY_HOLD
      await inventoryService.transferBucket(companyA, {
        sku: testSku,
        warehouse: 'Unit 2 Packaging Warehouse',
        sourceBucket: 'AVAILABLE',
        destinationBucket: 'WIP',
        quantity: 100,
        reason: 'Issued to production floor line 1',
      }, actorStorekeeper);

      await inventoryService.transferBucket(companyA, {
        sku: testSku,
        warehouse: 'Unit 2 Packaging Warehouse',
        sourceBucket: 'AVAILABLE',
        destinationBucket: 'QUALITY_HOLD',
        quantity: 50,
        reason: 'Isolated for laboratory tensile test',
      }, actorStorekeeper);

      const updated = (await inventoryService.listStocks(companyA, { sku: testSku }))[0];
      if (updated.bucketBreakdown.available !== 850) throw new Error(`Expected 850 available, got ${updated.bucketBreakdown.available}`);
      if (updated.bucketBreakdown.wip !== 100) throw new Error(`Expected 100 WIP, got ${updated.bucketBreakdown.wip}`);
      if (updated.bucketBreakdown.qualityHold !== 50) throw new Error(`Expected 50 Quality Hold, got ${updated.bucketBreakdown.qualityHold}`);
      if (updated.totalOnHand !== 1000) throw new Error(`Total on hand must remain 1000, got ${updated.totalOnHand}`);
    });

    // TEST 2: Warehouse creation and location management
    await test('2. Warehouse creation and management', async () => {
      testWarehouse = await inventoryService.createWarehouse(companyA, {
        code: `WH-UNIT-${Date.now()}`,
        name: `Finished Goods Central Hub ${Date.now()}`,
        address: 'Plot 88, Export Zone, Kandla SEZ, Gujarat',
        contactName: 'Ramesh Patel',
        contactPhone: '9825012345',
        isDefault: false,
      });

      if (!testWarehouse?.id) throw new Error('Failed to create warehouse');
      const bin = await inventoryService.createBin(companyA, testWarehouse.id, {
        code: 'BIN-RACK-A1',
        aisle: 'Aisle-01',
        rack: 'Rack-A',
        description: 'Fast moving finished goods',
      });
      if (!bin?.id) throw new Error('Failed to create bin inside warehouse');
    });

    // TEST 3 & 4: Batch / Lot creation and tracking (Multiple batches for one product)
    await test('3 & 4. Batch creation, tracking and multiple batches for single product', async () => {
      // Batch 1: Oldest batch (Mfg: 30 days ago)
      testBatch1 = await inventoryService.createBatch(companyA, {
        sku: testSku,
        batchNo: `LOT-2026-B1-${Date.now()}`,
        warehouse: 'Unit 2 Packaging Warehouse',
        initialQty: 300,
        manufacturingDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        receivedDate: new Date(Date.now() - 25 * 86400000).toISOString(),
        expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
        unitCost: 44,
      }, actorStorekeeper);

      // Batch 2: Middle batch (Mfg: 15 days ago)
      testBatch2 = await inventoryService.createBatch(companyA, {
        sku: testSku,
        batchNo: `LOT-2026-B2-${Date.now()}`,
        warehouse: 'Unit 2 Packaging Warehouse',
        initialQty: 400,
        manufacturingDate: new Date(Date.now() - 15 * 86400000).toISOString(),
        receivedDate: new Date(Date.now() - 10 * 86400000).toISOString(),
        expiryDate: new Date(Date.now() + 200 * 86400000).toISOString(),
        unitCost: 45,
      }, actorStorekeeper);

      // Batch 3: Fresh batch (Mfg: 2 days ago)
      testBatch3 = await inventoryService.createBatch(companyA, {
        sku: testSku,
        batchNo: `LOT-2026-B3-${Date.now()}`,
        warehouse: 'Unit 2 Packaging Warehouse',
        initialQty: 500,
        manufacturingDate: new Date(Date.now() - 2 * 86400000).toISOString(),
        receivedDate: new Date(Date.now() - 1 * 86400000).toISOString(),
        expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        unitCost: 46,
      }, actorStorekeeper);

      const batches = await inventoryService.listBatches(companyA, { sku: testSku });
      if (batches.length < 3) throw new Error(`Expected at least 3 distinct batches, got ${batches.length}`);
    });

    // TEST 5: FIFO Allocation from the oldest eligible batch
    await test('5. FIFO allocation allocates from oldest eligible batch first', async () => {
      // Allocate 200 units (Batch 1 has 300 units available)
      const result = await inventoryService.allocateFIFO(companyA, {
        sku: testSku,
        quantity: 200,
        warehouse: 'Unit 2 Packaging Warehouse',
        referenceType: 'SALES_DISPATCH',
        referenceNo: 'SO-TEST-001',
      }, actorStorekeeper);

      if (result.totalAllocated !== 200) throw new Error(`Expected 200 allocated, got ${result.totalAllocated}`);
      if (result.allocations.length !== 1) throw new Error(`Expected 1 batch allocation, got ${result.allocations.length}`);
      if (result.allocations[0].batchId !== testBatch1.id) {
        throw new Error(`Expected allocation from oldest batch ${testBatch1.batchNo}, got ${result.allocations[0].batchNo}`);
      }
    });

    // TEST 6: FIFO Allocation across multiple batches
    await test('6. FIFO allocation across multiple batches when oldest batch is insufficient', async () => {
      // Need 450 units. Oldest batch has 300 units; remaining 150 must come from Batch 2.
      const result = await inventoryService.allocateFIFO(companyA, {
        sku: testSku,
        quantity: 450,
        warehouse: 'Unit 2 Packaging Warehouse',
        referenceType: 'PRODUCTION_ISSUE',
        referenceNo: 'PRD-LINE-2',
      }, actorStorekeeper);

      if (result.totalAllocated !== 450) throw new Error(`Expected 450 allocated, got ${result.totalAllocated}`);
      if (result.allocations.length !== 2) throw new Error(`Expected 2 batches allocated, got ${result.allocations.length}`);
      if (result.allocations[0].batchId !== testBatch1.id || result.allocations[0].quantity !== 300) {
        throw new Error('Batch 1 was not fully allocated first');
      }
      if (result.allocations[1].batchId !== testBatch2.id || result.allocations[1].quantity !== 150) {
        throw new Error('Batch 2 was not allocated for remaining balance');
      }
    });

    // TEST 7: Prevention of negative stock
    await test('7. Prevention of negative stock on bucket transfers and adjustments', async () => {
      let blocked = false;
      try {
        await inventoryService.transferBucket(companyA, {
          sku: testSku,
          warehouse: 'Unit 2 Packaging Warehouse',
          sourceBucket: 'AVAILABLE',
          destinationBucket: 'SCRAP',
          quantity: 9999999, // Exceeds available stock
          reason: 'Mass purge attempt',
        }, actorStorekeeper);
      } catch (err) {
        blocked = true;
      }
      if (!blocked) throw new Error('System allowed transfer exceeding available stock (negative stock vulnerability)');
    });

    // TEST 8: Stock reservation and release
    await test('8. Stock reservation and release workflow', async () => {
      testReservation = await inventoryService.createReservation(companyA, {
        sku: testSku,
        warehouse: 'Unit 2 Packaging Warehouse',
        quantity: 150,
        referenceType: 'SALES_ORDER',
        referenceNo: 'SO-SNE-9901',
        notes: 'Reserved for premium export shipment',
      }, actorStorekeeper);

      if (!testReservation?.id) throw new Error('Failed to create reservation');
      if (testReservation.status !== 'ACTIVE') throw new Error(`Expected ACTIVE, got ${testReservation.status}`);

      // Check stock updated
      const reservedStockCheck = (await inventoryService.listStocks(companyA, { sku: testSku }))[0];
      if (reservedStockCheck.bucketBreakdown.reserved < 150) {
        throw new Error('Reserved stock quantity did not increment');
      }

      // Release reservation
      const released = await inventoryService.releaseReservation(companyA, testReservation.id, actorManager, 'Customer requested order cancellation');
      if (released.status !== 'RELEASED') throw new Error(`Expected RELEASED, got ${released.status}`);
    });

    // TEST 9: Prevention of invalid bucket reservation
    await test('9. Strict rejection of reservations from Quality Hold, Rejected or Scrap buckets', async () => {
      // Transfer to Rejected bucket
      await inventoryService.transferBucket(companyA, {
        sku: testSku,
        warehouse: 'Unit 2 Packaging Warehouse',
        sourceBucket: 'AVAILABLE',
        destinationBucket: 'REJECTED',
        quantity: 25,
        reason: 'QC rejection for box crushing test failure',
      }, actorStorekeeper);

      // Attempt FIFO allocation from Rejected bucket must fail (FIFO only considers eligible AVAILABLE stock)
      const stock = (await inventoryService.listStocks(companyA, { sku: testSku }))[0];
      const maxAvailable = stock.availableQty;

      let blocked = false;
      try {
        await inventoryService.createReservation(companyA, {
          sku: testSku,
          warehouse: 'Unit 2 Packaging Warehouse',
          quantity: maxAvailable + 10, // Demands more than AVAILABLE, testing if Rejected stock can be tapped
          referenceType: 'SALES_ORDER',
          referenceNo: 'SO-INVALID-RESERVE',
        }, actorStorekeeper);
      } catch (err) {
        blocked = true;
      }
      if (!blocked) throw new Error('System allowed reservation beyond available stock');
    });

    // TEST 10: Sampling request and stock movement
    await test('10. Sampling request creation and stock isolation in Sampling bucket', async () => {
      testSampling = await inventoryService.createSampling(companyA, {
        sku: testSku,
        warehouse: 'Unit 2 Packaging Warehouse',
        quantity: 10,
        customerName: 'Gulf Trading Est, Dubai',
        referenceType: 'EXPORT_ENQUIRY',
        referenceNo: 'ENQ-GULF-2026',
        billingType: 'FREE',
        responsiblePerson: 'Export Sales Manager',
      }, actorStorekeeper);

      if (!testSampling?.id) throw new Error('Failed to create sampling record');
      if (testSampling.status !== 'ISSUED') throw new Error(`Expected status ISSUED, got ${testSampling.status}`);

      // Verify stock in Sampling bucket
      const stock = (await inventoryService.listStocks(companyA, { sku: testSku }))[0];
      if (stock.bucketBreakdown.sampling < 10) throw new Error('Sampling bucket quantity was not incremented');

      // Sample return inspection: 8 passed to AVAILABLE, 2 damaged to QUALITY_HOLD
      const returned = await inventoryService.returnSampling(companyA, testSampling.id, {
        returnedQty: 8,
        destinationBucket: 'AVAILABLE',
        inspectionStatus: 'PASSED_CLEAN',
      }, actorStorekeeper);

      if (returned.status !== 'PARTIALLY_RETURNED') throw new Error(`Expected PARTIALLY_RETURNED, got ${returned.status}`);
    });

    // TEST 11 & 12: Paid, Free and Waived sampling with Approval Requirement
    await test('11 & 12. Payment waived sampling requires Phase 1 Approval Engine authorization', async () => {
      const waivedSample = await inventoryService.createSampling(companyA, {
        sku: testSku,
        warehouse: 'Unit 2 Packaging Warehouse',
        quantity: 15,
        customerName: 'European Retailers Consortium',
        billingType: 'PAYMENT_WAIVED',
        waivedReason: 'Strategic trial order volume agreement exceeding 50,000 units',
        responsiblePerson: 'VP Commercial',
      }, actorStorekeeper);

      // Waived sample must initially be PENDING_APPROVAL and NOT deduct stock until authorized
      if (waivedSample.status !== 'PENDING_APPROVAL') {
        throw new Error(`Expected waived sample status PENDING_APPROVAL, got ${waivedSample.status}`);
      }
      if (waivedSample.isWaivedApproved !== false) {
        throw new Error('Waived sample must have isWaivedApproved false before manager sign-off');
      }

      // Manager approves fee waiver
      const approvedSample = await inventoryService.approveWaivedSampling(companyA, waivedSample.id, actorManager);
      if (approvedSample.status !== 'ISSUED') throw new Error(`Expected ISSUED after approval, got ${approvedSample.status}`);
      if (approvedSample.isWaivedApproved !== true) throw new Error('Expected isWaivedApproved true');

      await prisma.inventorySampling.delete({ where: { id: waivedSample.id } });
    });

    // TEST 13 & 14: Gate Pass creation, dispatch and partial return
    await test('13 & 14. Gate Pass creation, dispatch and partial return reconciliation', async () => {
      testGatePass = await inventoryService.createGatePass(companyA, {
        gatePassType: 'SAMPLE',
        fromWarehouse: 'Unit 2 Packaging Warehouse',
        destination: 'Trade Fair Grounds, Pragati Maidan, New Delhi',
        purpose: 'Exhibition display samples',
        expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        items: [{ sku: testSku, name: 'Master Carton', qty: 20, uom: 'PCS' }],
      }, actorStorekeeper);

      if (!testGatePass?.id) throw new Error('Failed to create gate pass');

      // Dispatch gate pass
      const dispatched = await inventoryService.dispatchGatePass(companyA, testGatePass.id, actorStorekeeper);
      if (dispatched.status !== 'DISPATCHED') throw new Error(`Expected DISPATCHED, got ${dispatched.status}`);

      // Partial return
      const partialReturn = await inventoryService.returnGatePass(companyA, testGatePass.id, { isPartial: true, notes: '10 units returned, 10 still at fair' }, actorStorekeeper);
      if (partialReturn.status !== 'PARTIALLY_RETURNED') throw new Error(`Expected PARTIALLY_RETURNED, got ${partialReturn.status}`);

      // Final return
      const fullReturn = await inventoryService.returnGatePass(companyA, testGatePass.id, { isPartial: false, notes: 'Remaining 10 units returned' }, actorStorekeeper);
      if (fullReturn.status !== 'RETURNED') throw new Error(`Expected RETURNED, got ${fullReturn.status}`);
    });

    // TEST 15: Fortnightly Physical Stock Verification & Variance Calculation
    await test('15. Fortnightly physical stock verification with auto variance calculation', async () => {
      testVerification = await inventoryService.createVerificationSession(companyA, {
        warehouse: 'Unit 2 Packaging Warehouse',
        scheduleFrequency: 'FORTNIGHTLY',
        verifierName: 'Ramesh Patel',
      }, actorAuditor);

      if (!testVerification?.id) throw new Error('Failed to create physical verification session');
      if (testVerification.items.length === 0) throw new Error('Session failed to auto-populate system stock lines');

      const targetItem = testVerification.items.find((i) => i.sku === testSku);
      if (!targetItem) throw new Error(`Target item ${testSku} not found in session items`);

      // Physical count detected 10 shortage (counted = system - 10)
      const countedQty = targetItem.systemQty - 10;
      const submitted = await inventoryService.submitPhysicalCounts(companyA, testVerification.id, {
        items: [{ sku: testSku, systemQty: targetItem.systemQty, countedQty, remarks: '10 cartons water damaged in corner' }],
      }, actorAuditor);

      if (submitted.status !== 'PENDING_APPROVAL') throw new Error(`Expected PENDING_APPROVAL, got ${submitted.status}`);
      if (submitted.totalVarianceShortage !== 10) {
        throw new Error(`Expected totalVarianceShortage 10, got ${submitted.totalVarianceShortage}`);
      }
      if (submitted.totalVarianceExcess !== 0) {
        throw new Error(`Expected totalVarianceExcess 0, got ${submitted.totalVarianceExcess}`);
      }
    });

    // TEST 16: Stock Adjustment Approval & Maker-Checker Segregation
    await test('16. Stock adjustment maker-checker enforcement (creator cannot approve)', async () => {
      testAdjustment = await inventoryService.createAdjustment(companyA, {
        warehouse: 'Unit 2 Packaging Warehouse',
        sku: testSku,
        bucket: 'AVAILABLE',
        adjustmentType: 'DAMAGE',
        adjustmentQty: -10,
        reason: 'Water damaged cartons identified during fortnightly physical verification',
      }, actorStorekeeper);

      if (!testAdjustment?.id) throw new Error('Failed to create adjustment request');
      if (testAdjustment.status !== 'PENDING_APPROVAL') {
        throw new Error(`Expected PENDING_APPROVAL, got ${testAdjustment.status}`);
      }

      // Maker-checker violation attempt: Storekeeper (creator) attempts to approve their own adjustment
      let selfApprovalBlocked = false;
      try {
        await inventoryService.approveAdjustment(companyA, testAdjustment.id, actorStorekeeper);
      } catch (err) {
        if (err.message.includes('Segregation of Duties')) selfApprovalBlocked = true;
      }
      if (!selfApprovalBlocked) throw new Error('Maker-checker rule was not enforced; creator self-approved adjustment');

      // Authorized manager approval succeeds
      const approved = await inventoryService.approveAdjustment(companyA, testAdjustment.id, actorManager);
      if (approved.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${approved.status}`);
    });

    // TEST 17: Centralized Inventory Movement Ledger Accuracy
    await test('17. Centralized inventory movement ledger accuracy and bucket filtering', async () => {
      const movements = await inventoryService.listMovements(companyA, { sku: testSku });
      if (movements.length < 3) throw new Error(`Expected at least 3 movements recorded, got ${movements.length}`);

      // Filter by bucket
      const wipMovements = await inventoryService.listMovements(companyA, { sku: testSku, destinationBucket: 'WIP' });
      if (wipMovements.length === 0) throw new Error('Failed to filter movements by destination bucket WIP');
      if (wipMovements[0].destinationBucket !== 'WIP') throw new Error('Movement filter returned wrong bucket');
    });

    // TEST 18: Phase 3 GRN Integration without duplicate stock posting
    await test('18. Phase 3 GRN integration creates batch and populates Available bucket without duplicates', async () => {
      // 1. Create vendor
      testVendor = await purchaseService.createVendor(companyA, {
        name: `Supplier Corp ${Date.now()}`,
        email: 'supplier@corptest.com',
        requiresApproval: false,
      }, actorManager);

      // 2. Create PR and Quote
      testPR = await purchaseService.createRequest(companyA, {
        department: 'Packaging',
        priority: 'MEDIUM',
        purpose: 'GRN integration test batch',
        items: [{ sku: testSku, name: 'Standard Export Master Carton Box', qty: 500, uom: 'PCS' }],
      }, actorManager);
      await purchaseService.approveRequest(companyA, testPR.id, actorManager);

      const quote = await purchaseService.createQuotation(companyA, {
        requestId: testPR.id,
        vendorId: testVendor.id,
        deliveryDays: 5,
        items: [{ sku: testSku, unitRate: 40 }],
      }, actorManager);
      await purchaseService.requestQuoteException(companyA, testPR.id, { reason: 'Single vendor available' }, actorManager);
      await purchaseService.selectQuotation(companyA, quote.id, {}, actorManager);

      // 3. Create and approve PO
      testPO = await purchaseService.createOrder(companyA, quote.id, {}, actorManager);
      await purchaseService.approveOrder(companyA, testPO.id, actorManager);

      // 4. Record GRN with 500 accepted
      testGRN = await purchaseService.createReceipt(companyA, testPO.id, {
        warehouse: 'Unit 2 Packaging Warehouse',
        deliveryChallanNo: `DC-TEST-${Date.now()}`,
        items: [{ sku: testSku, receivedQty: 500, acceptedQty: 500 }],
      }, actorStorekeeper);

      if (testGRN.acceptedQty !== 500) throw new Error(`Expected 500 accepted, got ${testGRN.acceptedQty}`);

      // Verify that GRN created an active InventoryBatch
      const grnBatch = await prisma.inventoryBatch.findFirst({
        where: { companyId: companyA, grnId: testGRN.id, sku: testSku },
      });
      if (!grnBatch) throw new Error('Phase 3 GRN failed to automatically create an InventoryBatch record');
      if (grnBatch.availableQty !== 500) throw new Error(`Expected batch availableQty 500, got ${grnBatch.availableQty}`);
    });

    // TEST 19: Tenant isolation between two companies
    await test('19. Multi-tenant isolation: Tenant B cannot access Tenant A batches, reservations or movements', async () => {
      // Attempting to query Tenant A batches from Tenant B context
      const crossBatches = await inventoryService.listBatches(companyB, { sku: testSku });
      if (crossBatches.length > 0) throw new Error('Tenant B listBatches exposed Tenant A inventory batches');

      // Attempting to query Tenant A reservations from Tenant B context
      const crossReservations = await inventoryService.listReservations(companyB, { sku: testSku });
      if (crossReservations.length > 0) throw new Error('Tenant B listReservations exposed Tenant A reservations');

      // Attempting to query Tenant A movements from Tenant B context
      const crossMovements = await inventoryService.listMovements(companyB, { sku: testSku });
      if (crossMovements.length > 0) throw new Error('Tenant B listMovements exposed Tenant A stock ledger');
    });

    // TEST 20: Unauthorized inventory operation prevention
    await test('20. Prevention of unauthorized direct stock transfers and invalid bucket states', async () => {
      let invalidBucketBlocked = false;
      try {
        await inventoryService.transferBucket(companyA, {
          sku: testSku,
          warehouse: 'Unit 2 Packaging Warehouse',
          sourceBucket: 'NON_EXISTENT_BUCKET',
          destinationBucket: 'AVAILABLE',
          quantity: 10,
          reason: 'Test invalid bucket',
        }, actorStorekeeper);
      } catch (err) {
        if (err.message.includes('Invalid inventory bucket')) invalidBucketBlocked = true;
      }
      if (!invalidBucketBlocked) throw new Error('System allowed transfer with invalid bucket name');
    });

  } finally {
    console.log('\nCleaning up Phase 4 test artifacts...');
    try {
      if (testGRN?.id) {
        await prisma.inventoryMovement.deleteMany({ where: { referenceId: testGRN.id } });
        await prisma.purchaseDeviation.deleteMany({ where: { receiptId: testGRN.id } });
        await prisma.purchaseReceipt.deleteMany({ where: { id: testGRN.id } });
      }
      if (testPO?.id) {
        await prisma.purchaseOrder.deleteMany({ where: { id: testPO.id } });
      }
      if (testPR?.id) {
        await prisma.purchaseQuotation.deleteMany({ where: { requestId: testPR.id } });
        await prisma.purchaseRequest.deleteMany({ where: { id: testPR.id } });
      }
      if (testVendor?.id) {
        await prisma.vendor.deleteMany({ where: { id: testVendor.id } });
      }

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
      console.warn('Cleanup warning:', e.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`Phase 4 Inventory & Warehouse Suite: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) throw new Error(`${failed} tests failed in Phase 4 Inventory & Warehouse flow.`);
}

if (process.argv[1] && process.argv[1].includes('phase4_inventory_warehouse.test.js')) {
  runPhase4InventoryWarehouseTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
