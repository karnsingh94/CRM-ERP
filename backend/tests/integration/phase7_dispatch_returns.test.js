import prisma from '../../src/config/prisma.js';
import dispatchService from '../../src/services/dispatch/dispatch.service.js';
import dispatchTrackingService from '../../src/services/dispatch/dispatchTracking.service.js';
import returnsService from '../../src/services/dispatch/returns.service.js';
import creditNoteService from '../../src/services/dispatch/creditNote.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Strict Safety Guard: Tests must ONLY run against isolated test database
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 7 test suite must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${dbUrl || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase7DispatchReturnsTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 7: Dispatch & Returns Test Suite');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Testing: 20 Core Scenarios (Dispatch, FIFO, Returns, QC, Credit Notes)');
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
        companyName: 'Shree Nath Exports Phase 7 Test',
        email: 'phase7test@shreenath.com',
        phone: '9876543210',
        businessType: 'Export Manufacturing',
      },
    });
  }

  const companyId = client.id;
  const actor1 = { id: 'usr-agent-001', name: 'Dispatch Coordinator' };
  const actor2 = { id: 'usr-mgr-002', name: 'Commercial Manager' };

  // Setup test customer, product, and inventory batches
  const sku = `TEST-P7-FABRIC-${Date.now().toString().slice(-4)}`;
  const product = await prisma.product.create({
    data: {
      companyId,
      sku,
      name: 'Phase 7 Export Cotton Fabric',
      uom: 'MTR',
      purchasePrice: new Decimal('150.00'),
      sellingPrice: new Decimal('250.00'),
      status: 'ACTIVE',
    },
  });

  // Create 2 batches for multi-batch FIFO testing:
  // Batch 1: 60 MTR received earlier
  // Batch 2: 80 MTR received later
  const batch1 = await prisma.inventoryBatch.create({
    data: {
      companyId,
      batchNo: `BAT-P7-01-${Date.now().toString().slice(-4)}`,
      sku,
      warehouse: 'Dispatch Warehouse',
      availableQty: 60,
      unitCost: new Decimal('145.00'),
      manufacturingDate: new Date('2026-01-01'),
      receivedDate: new Date('2026-01-05'),
      status: 'ACTIVE',
      qualityStatus: 'ACCEPTED',
    },
  });

  const batch2 = await prisma.inventoryBatch.create({
    data: {
      companyId,
      batchNo: `BAT-P7-02-${Date.now().toString().slice(-4)}`,
      sku,
      warehouse: 'Dispatch Warehouse',
      availableQty: 80,
      unitCost: new Decimal('150.00'),
      manufacturingDate: new Date('2026-02-01'),
      receivedDate: new Date('2026-02-05'),
      status: 'ACTIVE',
      qualityStatus: 'ACCEPTED',
    },
  });

  // Stock header
  const stockHeader = await prisma.inventoryStock.create({
    data: {
      companyId,
      sku,
      name: product.name,
      warehouse: 'Dispatch Warehouse',
      uom: 'MTR',
      stock: 140,
      availableQty: 140,
      averageCost: new Decimal('147.50'),
    },
  });

  // Create an approved Sales Order for 100 MTR
  const salesOrder = await prisma.salesOrder.create({
    data: {
      companyId,
      orderNo: `SO-P7-${Date.now().toString().slice(-4)}`,
      customer: 'Global Apparel Inc',
      status: 'APPROVED',
      isReleased: true,
      amount: new Decimal('25000.00'),
      itemsCount: 1,
      items: [
        {
          sku,
          name: product.name,
          quantity: 100,
          price: 250.00,
          uom: 'MTR',
          taxRate: 18,
          hsnCode: '5208',
        },
      ],
    },
  });

  let dispatchOrder1 = null;
  let dispatchOrder2 = null;
  let customerReturn = null;
  let creditNote = null;

  // --------------------------------------------------------------------------
  // TEST 1: Approved Sales Order dispatch eligibility
  // --------------------------------------------------------------------------
  await test('1. Approved Sales Order dispatch eligibility', async () => {
    const eligible = await dispatchService.listEligibleSalesOrders(companyId);
    const found = eligible.find((so) => so.id === salesOrder.id);
    if (!found) throw new Error('Sales Order not found in eligible list');
    if (found.totalPendingQty !== 100) throw new Error(`Expected pending 100, got ${found.totalPendingQty}`);
    if (found.items[0].sku !== sku) throw new Error('SKU mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Partial dispatch creation (40 MTR out of 100 MTR)
  // --------------------------------------------------------------------------
  await test('2. Partial dispatch creation (40 MTR out of 100 MTR)', async () => {
    dispatchOrder1 = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: salesOrder.id,
        customerName: 'Global Apparel Inc',
        warehouseName: 'Dispatch Warehouse',
        items: [
          {
            sku,
            dispatchedQty: 40,
            uom: 'MTR',
            unitPrice: 250.00,
            taxRate: 18,
          },
        ],
        carrierName: 'FastLogistics Express',
        vehicleNo: 'RJ-14-GA-9999',
      },
      actor1
    );

    if (!dispatchOrder1 || !dispatchOrder1.dispatchNo) throw new Error('Failed to create partial dispatch order');
    if (dispatchOrder1.fulfillmentType !== 'PARTIAL') throw new Error(`Expected PARTIAL fulfillment, got ${dispatchOrder1.fulfillmentType}`);
    if (Number(dispatchOrder1.totalDispatchedQty) !== 40) throw new Error(`Expected dispatchedQty 40, got ${dispatchOrder1.totalDispatchedQty}`);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Multiple dispatches against one Sales Order (remaining 60 MTR)
  // --------------------------------------------------------------------------
  await test('3. Multiple dispatches against one Sales Order (remaining 60 MTR)', async () => {
    // Check remaining eligible quantity on SO
    const eligible = await dispatchService.listEligibleSalesOrders(companyId);
    const found = eligible.find((so) => so.id === salesOrder.id);
    if (!found || found.totalPendingQty !== 60) {
      throw new Error(`Expected remaining pending 60, got ${found ? found.totalPendingQty : 'none'}`);
    }

    // Dispatch remaining 60
    dispatchOrder2 = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: salesOrder.id,
        customerName: 'Global Apparel Inc',
        warehouseName: 'Dispatch Warehouse',
        items: [
          {
            sku,
            dispatchedQty: 60,
            uom: 'MTR',
            unitPrice: 250.00,
            taxRate: 18,
          },
        ],
        carrierName: 'Delhivery B2B',
        vehicleNo: 'RJ-14-GA-8888',
      },
      actor1
    );

    if (!dispatchOrder2) throw new Error('Failed to create second dispatch order');
    if (Number(dispatchOrder2.totalDispatchedQty) !== 60) throw new Error(`Expected 60, got ${dispatchOrder2.totalDispatchedQty}`);
  });

  // --------------------------------------------------------------------------
  // TEST 4: Multi-batch FIFO allocation
  // --------------------------------------------------------------------------
  await test('4. Multi-batch FIFO allocation', async () => {
    // First, execute physical dispatch on dispatchOrder1 (40 MTR) so Batch 1 has 20 MTR remaining
    await dispatchService.executeDispatch(companyId, dispatchOrder1.id, {}, actor1);

    // Now for dispatchOrder2 (60 MTR needed):
    // Batch 1 has 20 available, so FIFO allocates: 20 from Batch 1 + 40 from Batch 2!
    const allocResult = await dispatchService.allocateFIFO(companyId, dispatchOrder2.id, {}, actor1);
    if (!allocResult || !allocResult.allocations || allocResult.allocations.length === 0) {
      throw new Error('Allocation returned empty');
    }

    const itemAlloc = allocResult.allocations[0];
    if (itemAlloc.allocations.length !== 2) {
      throw new Error(`Expected 2 batch allocations (FIFO multi-batch), got ${itemAlloc.allocations.length}`);
    }

    const b1Alloc = itemAlloc.allocations.find((a) => a.batchNo === batch1.batchNo);
    const b2Alloc = itemAlloc.allocations.find((a) => a.batchNo === batch2.batchNo);

    if (!b1Alloc || b1Alloc.allocatedQty !== 20) throw new Error(`Expected Batch 1 allocated 20, got ${b1Alloc ? b1Alloc.allocatedQty : 'none'}`);
    if (!b2Alloc || b2Alloc.allocatedQty !== 40) throw new Error(`Expected Batch 2 allocated 40, got ${b2Alloc ? b2Alloc.allocatedQty : 'none'}`);
  });

  // --------------------------------------------------------------------------
  // TEST 5: Stock deduction and movement ledger
  // --------------------------------------------------------------------------
  await test('5. Stock deduction and movement ledger', async () => {
    // Verify that dispatchOrder1 (40 MTR) already decremented Batch 1 down to 20
    const b1After = await prisma.inventoryBatch.findUnique({ where: { id: batch1.id } });
    if (b1After.availableQty !== 20) {
      throw new Error(`Expected Batch 1 availableQty 20 after dispatch, got ${b1After.availableQty}`);
    }

    // Verify inventory movement
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        companyId,
        referenceId: dispatchOrder1.id,
        movementType: 'SALES_DISPATCH',
      },
    });

    if (!movement) throw new Error('InventoryMovement SALES_DISPATCH not found');
    if (movement.sourceBucket !== 'AVAILABLE' || movement.destinationBucket !== 'DISPATCHED_CUSTOMER') {
      throw new Error(`Invalid buckets: ${movement.sourceBucket} -> ${movement.destinationBucket}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Duplicate dispatch prevention (Idempotency guard)
  // --------------------------------------------------------------------------
  await test('6. Duplicate dispatch prevention', async () => {
    try {
      await dispatchService.executeDispatch(companyId, dispatchOrder1.id, {}, actor1);
      throw new Error('Should have thrown error on duplicate dispatch execution');
    } catch (err) {
      if (!err.message.includes('already been dispatched')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Packing list and delivery challan creation
  // --------------------------------------------------------------------------
  await test('7. Packing list and delivery challan creation', async () => {
    // Add a package to dispatchOrder2
    const pkg = await dispatchService.createPackage(
      companyId,
      dispatchOrder2.id,
      {
        boxType: 'WOODEN_PALLET',
        lengthCm: 120,
        widthCm: 80,
        heightCm: 100,
        weightGrossKg: 42.5,
        weightNetKg: 39.0,
        barcode: 'PALLET-P7-001',
      },
      actor1
    );

    if (!pkg || pkg.packageNumber !== 1) throw new Error('Package creation failed');

    // Retrieve packing list
    const packingList = await dispatchService.getPackingList(companyId, dispatchOrder2.id);
    if (packingList.totalPackages !== 1) throw new Error(`Expected totalPackages 1, got ${packingList.totalPackages}`);
    if (packingList.totalGrossWeightKg !== 42.5) throw new Error(`Expected weight 42.5, got ${packingList.totalGrossWeightKg}`);

    // Retrieve delivery challan
    const challan = await dispatchService.getDeliveryChallan(companyId, dispatchOrder2.id);
    if (!challan.challanNo) throw new Error('Delivery challan document missing challanNo');
    if (challan.customerName !== 'Global Apparel Inc') throw new Error('Delivery challan customer mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Gate Pass integration
  // --------------------------------------------------------------------------
  await test('8. Gate Pass integration', async () => {
    const gpResult = await dispatchService.generateGatePass(companyId, dispatchOrder2.id, {}, actor1);
    if (!gpResult.gatePassNo || !gpResult.gatePassNo.startsWith('GP-OUT')) {
      throw new Error(`Invalid Gate Pass generated: ${gpResult.gatePassNo}`);
    }

    const orderAfter = await prisma.dispatchOrder.findUnique({ where: { id: dispatchOrder2.id } });
    if (orderAfter.gatePassNo !== gpResult.gatePassNo) throw new Error('Gate pass number not linked on dispatch order');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Shipment tracking and POD
  // --------------------------------------------------------------------------
  await test('9. Shipment tracking and POD', async () => {
    // Execute dispatch on order 2 first
    await dispatchService.executeDispatch(companyId, dispatchOrder2.id, {}, actor1);

    // Add tracking event IN_TRANSIT
    await dispatchTrackingService.addTrackingEvent(
      companyId,
      dispatchOrder2.id,
      {
        status: 'IN_TRANSIT',
        location: 'Jaipur Hub',
        carrierStatus: 'In Transit to Mumbai Port',
        remarks: 'Vehicle on scheduled route',
      },
      actor1
    );

    // Record POD
    const podOrder = await dispatchTrackingService.recordPOD(
      companyId,
      dispatchOrder2.id,
      {
        receiverName: 'Warehouse Manager Robert',
        podAttachmentUrl: 'https://docs.azzuniqe.com/pod/pod_so_p7.pdf',
        notes: 'Delivered in good condition, seal intact.',
      },
      actor1
    );

    if (podOrder.status !== 'DELIVERED') throw new Error(`Expected status DELIVERED, got ${podOrder.status}`);
    if (!podOrder.deliveredAt) throw new Error('deliveredAt not set');

    // Verify history
    const history = await dispatchTrackingService.getTrackingHistory(companyId, dispatchOrder2.id);
    if (history.timeline.length < 3) throw new Error(`Expected at least 3 timeline events, got ${history.timeline.length}`);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Failed delivery handling
  // --------------------------------------------------------------------------
  await test('10. Failed delivery handling', async () => {
    // Update dispatchOrder1 status to FAILED via recordFailedDelivery
    const failResult = await dispatchTrackingService.recordFailedDelivery(
      companyId,
      dispatchOrder1.id,
      {
        failureReason: 'Consignee warehouse closed on national holiday',
        location: 'Delhi Regional Hub',
        remarks: 'Re-attempt scheduled for next business day',
        attemptNumber: 1,
      },
      actor1
    );

    if (failResult.status !== 'FAILED') throw new Error(`Expected status FAILED, got ${failResult.status}`);
  });

  // --------------------------------------------------------------------------
  // TEST 11: RMA creation and approval
  // --------------------------------------------------------------------------
  await test('11. RMA creation and approval', async () => {
    // Create RMA against dispatchOrder2 (which has 60 MTR delivered)
    customerReturn = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dispatchOrder2.id,
        returnReason: 'TRANSIT_DAMAGE',
        reasonDetails: 'Water damage during container shipment',
        items: [
          {
            sku,
            returnQty: 25,
            returnReason: 'TRANSIT_DAMAGE',
          },
        ],
      },
      actor1
    );

    if (!customerReturn || !customerReturn.rmaNo) throw new Error('RMA creation failed');
    if (customerReturn.status !== 'REQUESTED') throw new Error(`Expected status REQUESTED, got ${customerReturn.status}`);
    if (Number(customerReturn.totalReturnedQty) !== 25) throw new Error(`Expected returnedQty 25, got ${customerReturn.totalReturnedQty}`);
  });

  // --------------------------------------------------------------------------
  // TEST 12: Maker-checker SoD for Return Approval
  // --------------------------------------------------------------------------
  await test('12. Maker-checker SoD for Return Approval', async () => {
    // Submit for approval
    await returnsService.submitForApproval(companyId, customerReturn.id, actor1);

    // Approval by Commercial Manager (actor2 !== actor1)
    const approved = await returnsService.approveReturn(companyId, customerReturn.id, {}, actor2);
    if (approved.status !== 'APPROVED') throw new Error(`Expected APPROVED status, got ${approved.status}`);
    if (approved.approvedById !== actor2.id) throw new Error('Approver ID mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Return quantity validation (cannot exceed dispatched)
  // --------------------------------------------------------------------------
  await test('13. Return quantity validation (cannot exceed dispatched)', async () => {
    // Dispatch 2 had 60 MTR. 25 MTR already returned. Maximum allowed is 35.
    // Trying to return 40 MTR must be rejected!
    try {
      await returnsService.createReturnRequest(
        companyId,
        {
          dispatchOrderId: dispatchOrder2.id,
          returnReason: 'DEFECTIVE_PRODUCT',
          items: [{ sku, returnQty: 40 }],
        },
        actor1
      );
      throw new Error('Should have failed when return quantity exceeds eligible dispatched quantity');
    } catch (err) {
      if (!err.message.includes('exceeds eligible dispatched quantity')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 14: Return QC disposition validation (Sum must match inspected)
  // --------------------------------------------------------------------------
  await test('14. Return QC disposition validation (Sum must match inspected)', async () => {
    // Receive goods first
    await returnsService.receiveReturnedGoods(companyId, customerReturn.id, {}, actor1);

    // Attempt inspection with sum mismatch: 25 inspected, but restock (10) + rework (5) = 15 != 25!
    try {
      await returnsService.inspectReturnedGoods(
        companyId,
        customerReturn.id,
        {
          items: [
            {
              sku,
              inspectedQty: 25,
              restockQty: 10,
              reworkQty: 5,
              rejectQty: 0,
              scrapQty: 0,
            },
          ],
        },
        actor1
      );
      throw new Error('Should have failed when disposition sum does not equal inspected quantity');
    } catch (err) {
      if (!err.message.includes('Inspection quantity mismatch')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 15: Return-to-stock and rework movements
  // --------------------------------------------------------------------------
  await test('15. Return-to-stock and rework movements', async () => {
    // Valid disposition breakdown: 25 total
    // 15 Restock to AVAILABLE
    // 5 Rework to WIP
    // 3 Reject to REJECTED
    // 2 Scrap to SCRAP
    // Total = 15 + 5 + 3 + 2 = 25
    const inspResult = await returnsService.inspectReturnedGoods(
      companyId,
      customerReturn.id,
      {
        items: [
          {
            sku,
            inspectedQty: 25,
            restockQty: 15,
            reworkQty: 5,
            rejectQty: 3,
            scrapQty: 2,
            qcFindings: '15 MTR pristine, 5 MTR edge fray for rework, 3 MTR oil stained rejected, 2 MTR torn scrapped.',
          },
        ],
      },
      actor1
    );

    if (inspResult.status !== 'INSPECTED') throw new Error(`Expected status INSPECTED, got ${inspResult.status}`);

    // Verify movements created
    const restockMov = await prisma.inventoryMovement.findFirst({
      where: { companyId, movementType: 'RETURN_RESTOCK', referenceId: customerReturn.id },
    });
    const reworkMov = await prisma.inventoryMovement.findFirst({
      where: { companyId, movementType: 'RETURN_REWORK', referenceId: customerReturn.id },
    });
    const rejectMov = await prisma.inventoryMovement.findFirst({
      where: { companyId, movementType: 'RETURN_REJECT', referenceId: customerReturn.id },
    });
    const scrapMov = await prisma.inventoryMovement.findFirst({
      where: { companyId, movementType: 'RETURN_SCRAP', referenceId: customerReturn.id },
    });

    if (!restockMov || restockMov.quantity !== 15) throw new Error('RESTOCK movement quantity mismatch');
    if (!reworkMov || reworkMov.quantity !== 5) throw new Error('REWORK movement quantity mismatch');
    if (!rejectMov || rejectMov.quantity !== 3) throw new Error('REJECT movement quantity mismatch');
    if (!scrapMov || scrapMov.quantity !== 2) throw new Error('SCRAP movement quantity mismatch');
  });

  // --------------------------------------------------------------------------
  // TEST 16: Duplicate restocking prevention (Over-inspection guard)
  // --------------------------------------------------------------------------
  await test('16. Duplicate restocking prevention', async () => {
    // Trying to inspect more than received quantity
    try {
      await returnsService.inspectReturnedGoods(
        companyId,
        customerReturn.id,
        {
          items: [
            {
              sku,
              inspectedQty: 10,
              restockQty: 10,
              reworkQty: 0,
              rejectQty: 0,
              scrapQty: 0,
            },
          ],
        },
        actor1
      );
      throw new Error('Should have failed when attempting duplicate over-inspection');
    } catch (err) {
      if (!err.message.includes('Over-inspection prevented')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 17: Credit note tax reversal calculation
  // --------------------------------------------------------------------------
  await test('17. Credit note tax reversal calculation', async () => {
    // Return was 25 MTR at ₹250/MTR = ₹6,250 Taxable
    // 18% GST = ₹1,125 total (CGST 562.50 + SGST 562.50)
    // Total Gross = ₹7,375.00
    creditNote = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: customerReturn.id,
        restockingFeeRate: 5, // 5% restocking fee
        settlementType: 'LEDGER_CREDIT',
        taxRateOverride: 18,
      },
      actor1
    );

    if (!creditNote || !creditNote.creditNoteNo) throw new Error('Failed to create credit note');
    if (Number(creditNote.taxableAmount) !== 6250) {
      throw new Error(`Expected taxableAmount 6250, got ${creditNote.taxableAmount}`);
    }
    if (Number(creditNote.cgstAmount) !== 562.5 || Number(creditNote.sgstAmount) !== 562.5) {
      throw new Error(`CGST/SGST mismatch: ${creditNote.cgstAmount}, ${creditNote.sgstAmount}`);
    }
    if (Number(creditNote.totalAmount) !== 7375) {
      throw new Error(`Expected totalAmount 7375, got ${creditNote.totalAmount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 18: Credit note net credit & restocking fee calculation
  // --------------------------------------------------------------------------
  await test('18. Credit note net credit & restocking fee calculation', async () => {
    // 5% of 7375 = ₹368.75 restocking fee
    // Net credit = 7375 - 368.75 = ₹7,006.25
    const fee = Number(creditNote.restockingFeeAmount);
    const net = Number(creditNote.netCreditAmount);

    if (Math.abs(fee - 368.75) > 0.01) {
      throw new Error(`Expected restocking fee 368.75, got ${fee}`);
    }
    if (Math.abs(net - 7006.25) > 0.01) {
      throw new Error(`Expected net credit 7006.25, got ${net}`);
    }

    // Approve credit note by manager
    const approvedCn = await creditNoteService.approveCreditNote(companyId, creditNote.id, actor2);
    if (approvedCn.status !== 'APPROVED') throw new Error(`Expected status APPROVED, got ${approvedCn.status}`);

    // Apply credit note
    const appliedCn = await creditNoteService.applyCreditNote(companyId, creditNote.id, {}, actor2);
    if (appliedCn.status !== 'APPLIED') throw new Error(`Expected status APPLIED, got ${appliedCn.status}`);
  });

  // --------------------------------------------------------------------------
  // TEST 19: Duplicate credit note prevention
  // --------------------------------------------------------------------------
  await test('19. Duplicate credit note prevention', async () => {
    try {
      await creditNoteService.createCreditNote(
        companyId,
        {
          customerReturnId: customerReturn.id,
          restockingFeeRate: 5,
        },
        actor1
      );
      throw new Error('Should have failed when issuing duplicate credit note for same RMA');
    } catch (err) {
      if (!err.message.includes('Duplicate credit note prevented')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 20: Multi-tenant isolation
  // --------------------------------------------------------------------------
  await test('20. Multi-tenant isolation', async () => {
    const foreignCompanyId = 'comp-unauthorized-999';

    // Attempt to access dispatch order under wrong company ID
    try {
      await dispatchService.getDispatchOrderById(foreignCompanyId, dispatchOrder2.id);
      throw new Error('Should have failed cross-tenant dispatch access');
    } catch (err) {
      if (!err.message.includes('not found')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Attempt to access return under wrong company ID
    try {
      await returnsService.getReturnById(foreignCompanyId, customerReturn.id);
      throw new Error('Should have failed cross-tenant return access');
    } catch (err) {
      if (!err.message.includes('not found')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  console.log('\n========================================================================');
  console.log(`Phase 7 Test Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed in Phase 7 integration suite.`);
  }

  return { passed, failed };
}

// Execute directly if run as main
if (process.argv[1]?.includes('phase7_dispatch_returns.test.js')) {
  runPhase7DispatchReturnsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
