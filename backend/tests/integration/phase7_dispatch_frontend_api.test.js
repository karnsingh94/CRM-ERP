import prisma from '../../src/config/prisma.js';
import dispatchService from '../../src/services/dispatch/dispatch.service.js';
import dispatchTrackingService from '../../src/services/dispatch/dispatchTracking.service.js';
import returnsService from '../../src/services/dispatch/returns.service.js';
import creditNoteService from '../../src/services/dispatch/creditNote.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Safety Guard: STRICTLY require crm_erp_test_db
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 7 Frontend API test suite must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${dbUrl || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase7FrontendWorkspaceApiTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 7: Frontend Workspace API Test Suite');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Testing: All 9 Workspace Tabs Backend Endpoints & Data Payloads');
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
        companyName: 'Shree Nath Exports Phase 7 UI Test',
        email: `phase7.ui.${Date.now()}@shreenath.com`,
        phone: '9876543210',
        businessType: 'Export Manufacturing',
      },
    });
  }

  const companyId = client.id;
  const actor1 = { id: 'usr-ui-agent', name: 'Logistics Supervisor' };
  const actor2 = { id: 'usr-ui-manager', name: 'Commercial Authority' };

  // Setup test products and batches
  const sku = `UI-P7-FABRIC-${Date.now().toString().slice(-4)}`;
  const product = await prisma.product.create({
    data: {
      companyId,
      sku,
      name: 'Phase 7 UI Linen Fabric',
      uom: 'MTR',
      purchasePrice: new Decimal('120.00'),
      sellingPrice: new Decimal('200.00'),
      status: 'ACTIVE',
    },
  });

  const batchA = await prisma.inventoryBatch.create({
    data: {
      companyId,
      batchNo: `BAT-UI-01-${Date.now().toString().slice(-4)}`,
      sku,
      warehouse: 'Main Warehouse',
      availableQty: 50,
      unitCost: new Decimal('115.00'),
      manufacturingDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      qualityStatus: 'ACCEPTED',
    },
  });

  const batchB = await prisma.inventoryBatch.create({
    data: {
      companyId,
      batchNo: `BAT-UI-02-${Date.now().toString().slice(-4)}`,
      sku,
      warehouse: 'Main Warehouse',
      availableQty: 50,
      unitCost: new Decimal('120.00'),
      manufacturingDate: new Date('2026-02-01'),
      status: 'ACTIVE',
      qualityStatus: 'ACCEPTED',
    },
  });

  await prisma.inventoryStock.create({
    data: {
      companyId,
      sku,
      name: product.name,
      warehouse: 'Main Warehouse',
      uom: 'MTR',
      stock: 100,
      availableQty: 100,
      averageCost: new Decimal('117.50'),
    },
  });

  const salesOrder = await prisma.salesOrder.create({
    data: {
      companyId,
      orderNo: `SO-UI-${Date.now().toString().slice(-4)}`,
      customer: 'Zara Apparel Corp',
      status: 'APPROVED',
      isReleased: true,
      amount: new Decimal('15000.00'),
      itemsCount: 1,
      items: [
        {
          sku,
          name: product.name,
          quantity: 75,
          price: 200.00,
          uom: 'MTR',
          taxRate: 18,
          hsnCode: '5208',
        },
      ],
    },
  });

  let dispatchOrder = null;
  let customerReturn = null;
  let creditNote = null;

  // --------------------------------------------------------------------------
  // TAB 1: Dispatch Dashboard Metrics Endpoint Data Payload
  // --------------------------------------------------------------------------
  await test('Tab 1: Dashboard Metrics Endpoint Data Payload', async () => {
    const data = await dispatchService.getDashboard(companyId);
    if (data.pendingSalesOrders === undefined) throw new Error('Missing pendingSalesOrders');
    if (data.readyToDispatch === undefined) throw new Error('Missing readyToDispatch');
    if (data.inTransit === undefined) throw new Error('Missing inTransit');
    if (data.delivered === undefined) throw new Error('Missing delivered');
    if (data.totalDispatchedAmount === undefined) throw new Error('Missing totalDispatchedAmount');
  });

  // --------------------------------------------------------------------------
  // TAB 2: Dispatch Planning & Eligible Sales Orders Queue
  // --------------------------------------------------------------------------
  await test('Tab 2: Dispatch Planning & Eligible Sales Orders Queue', async () => {
    const queue = await dispatchService.listEligibleSalesOrders(companyId);
    const orderMatch = queue.find((o) => o.id === salesOrder.id);
    if (!orderMatch) throw new Error('Sales order not found in eligible queue');
    if (orderMatch.totalPendingQty !== 75) throw new Error(`Expected pending 75, got ${orderMatch.totalPendingQty}`);

    // Create partial dispatch of 50 MTR
    dispatchOrder = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: salesOrder.id,
        customerName: 'Zara Apparel Corp',
        customerGstin: '08AABCR1234F1Z1',
        invoiceNo: 'INV-2026-UI-001',
        warehouseName: 'Main Warehouse',
        items: [
          {
            sku,
            dispatchedQty: 50,
            uom: 'MTR',
            unitPrice: 200.00,
            taxRate: 18,
          },
        ],
        carrierName: 'SafeXpress Logistics',
        vehicleNo: 'DL-01-AB-1234',
        driverName: 'Ramesh Singh',
        driverPhone: '9811223344',
      },
      actor1
    );

    if (!dispatchOrder || !dispatchOrder.dispatchNo) throw new Error('Failed to create dispatch order');
    if (Number(dispatchOrder.totalDispatchedQty) !== 50) throw new Error('Dispatched qty mismatch');
  });

  // --------------------------------------------------------------------------
  // TAB 3: Multi-Batch FIFO Allocation
  // --------------------------------------------------------------------------
  await test('Tab 3: Multi-Batch FIFO Allocation', async () => {
    const allocResult = await dispatchService.allocateFIFO(companyId, dispatchOrder.id, {}, actor1);
    if (!allocResult.allocations || allocResult.allocations.length === 0) throw new Error('FIFO allocation empty');

    // Batch A has 50 MTR, so all 50 allocated from Batch A
    const lineAlloc = allocResult.allocations[0];
    if (lineAlloc.allocations[0].batchNo !== batchA.batchNo) {
      throw new Error(`Expected oldest batch ${batchA.batchNo}, got ${lineAlloc.allocations[0].batchNo}`);
    }
  });

  // --------------------------------------------------------------------------
  // TAB 4: Packing & Carton Management
  // --------------------------------------------------------------------------
  await test('Tab 4: Packing & Carton Management', async () => {
    const pkg = await dispatchService.createPackage(
      companyId,
      dispatchOrder.id,
      {
        boxType: 'CARTON',
        lengthCm: 50,
        widthCm: 50,
        heightCm: 40,
        weightGrossKg: 15.5,
        weightNetKg: 14.0,
        barcode: 'BOX-UI-001',
      },
      actor1
    );

    if (!pkg || !pkg.packageCode) throw new Error('Carton creation failed');

    // Fetch Packing List
    const packingList = await dispatchService.getPackingList(companyId, dispatchOrder.id);
    if (!packingList.packages || packingList.packages.length === 0) throw new Error('Packing list packages empty');
    if (packingList.totalPackages !== 1) throw new Error('Total packages count mismatch');
  });

  // --------------------------------------------------------------------------
  // TAB 5: Delivery Challan & Dispatch Execution
  // --------------------------------------------------------------------------
  await test('Tab 5: Delivery Challan & Dispatch Execution', async () => {
    // Delivery Challan preview data
    const challan = await dispatchService.getDeliveryChallan(companyId, dispatchOrder.id);
    if (!challan.challanNo) throw new Error('Challan missing challanNo');
    if (challan.customerName !== 'Zara Apparel Corp') throw new Error('Challan customer mismatch');

    // Outward Gate Pass
    const gp = await dispatchService.generateGatePass(companyId, dispatchOrder.id, {}, actor1);
    if (!gp.gatePassNo) throw new Error('Gate pass generation failed');

    // Physical dispatch execution (deducts stock)
    const executed = await dispatchService.executeDispatch(companyId, dispatchOrder.id, {}, actor1);
    if (executed.status !== 'DISPATCHED') throw new Error(`Expected status DISPATCHED, got ${executed.status}`);
  });

  // --------------------------------------------------------------------------
  // TAB 6: Shipment Tracking & Proof of Delivery (POD)
  // --------------------------------------------------------------------------
  await test('Tab 6: Shipment Tracking & Proof of Delivery (POD)', async () => {
    // Add tracking event
    await dispatchTrackingService.addTrackingEvent(
      companyId,
      dispatchOrder.id,
      {
        status: 'OUT_FOR_DELIVERY',
        location: 'Delhi NCR Hub',
        remarks: 'Out for delivery to store',
      },
      actor1
    );

    // Record POD
    const pod = await dispatchTrackingService.recordPOD(
      companyId,
      dispatchOrder.id,
      {
        receiverName: 'Store Incharge Rajesh',
        podAttachmentUrl: 'https://cdn.azzuniqe.com/pod_zara.pdf',
        notes: 'Delivered in full, packaging undamaged.',
      },
      actor1
    );

    if (pod.status !== 'DELIVERED') throw new Error(`Expected status DELIVERED, got ${pod.status}`);

    const history = await dispatchTrackingService.getTrackingHistory(companyId, dispatchOrder.id);
    if (!history.timeline || history.timeline.length < 2) throw new Error('Tracking timeline incomplete');
  });

  // --------------------------------------------------------------------------
  // TAB 7: Customer Returns / RMA Workflow
  // --------------------------------------------------------------------------
  await test('Tab 7: Customer Returns / RMA Workflow', async () => {
    // Check eligible dispatches
    const eligibleDispatches = await returnsService.listEligibleDispatches(companyId);
    const dspMatch = eligibleDispatches.find((d) => d.id === dispatchOrder.id);
    if (!dspMatch) throw new Error('Dispatch order not found in eligible return dispatches');

    // Create RMA for 20 MTR
    customerReturn = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dispatchOrder.id,
        returnReason: 'SPECIFICATION_MISMATCH',
        reasonDetails: 'Fabric GSM slightly lower than specification',
        items: [
          {
            sku,
            returnQty: 20,
            returnReason: 'SPECIFICATION_MISMATCH',
          },
        ],
      },
      actor1
    );

    if (!customerReturn || !customerReturn.rmaNo) throw new Error('RMA creation failed');

    // Approval SoD
    await returnsService.submitForApproval(companyId, customerReturn.id, actor1);
    const approved = await returnsService.approveReturn(companyId, customerReturn.id, {}, actor2);
    if (approved.status !== 'APPROVED') throw new Error(`Expected APPROVED, got ${approved.status}`);

    // Inward receipt into quarantine (RETURN_HOLD)
    const received = await returnsService.receiveReturnedGoods(companyId, customerReturn.id, {}, actor1);
    if (received.status !== 'GOODS_RECEIVED') throw new Error(`Expected GOODS_RECEIVED, got ${received.status}`);
  });

  // --------------------------------------------------------------------------
  // TAB 8: Returned Goods QC & Reintegration
  // --------------------------------------------------------------------------
  await test('Tab 8: Returned Goods QC & Reintegration', async () => {
    // Disposition: 12 Restock (AVAILABLE) + 5 Rework (WIP) + 3 Reject (REJECTED) = 20 Inspected
    const qcResult = await returnsService.inspectReturnedGoods(
      companyId,
      customerReturn.id,
      {
        items: [
          {
            sku,
            inspectedQty: 20,
            restockQty: 12,
            reworkQty: 5,
            rejectQty: 3,
            scrapQty: 0,
            qcFindings: '12 MTR approved for direct resale, 5 MTR for steam rewash, 3 MTR rejected.',
          },
        ],
      },
      actor1
    );

    if (qcResult.status !== 'INSPECTED') throw new Error(`Expected status INSPECTED, got ${qcResult.status}`);
    if (qcResult.inspections.length !== 1) throw new Error('Inspection record missing');
  });

  // --------------------------------------------------------------------------
  // TAB 9: Customer Credit Notes & Financial Adjustments
  // --------------------------------------------------------------------------
  await test('Tab 9: Customer Credit Notes & Financial Adjustments', async () => {
    // 20 MTR returned at ₹200/MTR = ₹4,000 Taxable
    // 18% GST = ₹720 total (CGST 360 + SGST 360)
    // Gross = ₹4,720.00
    // 5% Restocking fee = ₹236.00
    // Net Credit = ₹4,484.00
    creditNote = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: customerReturn.id,
        restockingFeeRate: 5,
        settlementType: 'LEDGER_CREDIT',
      },
      actor1
    );

    if (!creditNote || !creditNote.creditNoteNo) throw new Error('Credit note creation failed');
    if (Number(creditNote.taxableAmount) !== 4000) throw new Error(`Taxable mismatch: ${creditNote.taxableAmount}`);
    if (Number(creditNote.netCreditAmount) !== 4484) throw new Error(`Net credit mismatch: ${creditNote.netCreditAmount}`);

    // Approve credit note
    const approved = await creditNoteService.approveCreditNote(companyId, creditNote.id, actor2);
    if (approved.status !== 'APPROVED') throw new Error('Credit note approval failed');

    // Apply settlement
    const applied = await creditNoteService.applyCreditNote(companyId, creditNote.id, {}, actor2);
    if (applied.status !== 'APPLIED') throw new Error('Credit note application failed');

    // Check credit dashboard metrics
    const crDashboard = await creditNoteService.getDashboard(companyId);
    if (crDashboard.appliedCreditNotes < 1) throw new Error('Applied credit notes count not reflected');
  });

  console.log('\n========================================================================');
  console.log(`Phase 7 Frontend API Test Suite Finished: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed in Phase 7 frontend API suite.`);
  }

  return { passed, failed };
}

// Execute directly if run as main
if (process.argv[1]?.includes('phase7_dispatch_frontend_api.test.js')) {
  runPhase7FrontendWorkspaceApiTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

