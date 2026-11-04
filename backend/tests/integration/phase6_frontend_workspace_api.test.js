import prisma from '../../src/config/prisma.js';
import jobWorkService from '../../src/services/contract-manufacturing/jobWork.service.js';
import bomService from '../../src/services/production/bom.service.js';

// Safety Guard: STRICTLY require crm_erp_test_db
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 6 test suite must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${dbUrl || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase6FrontendWorkspaceApiTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQUE CRM & ERP — Phase 6: Frontend Workspace API Test Suite');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Testing: All 10 Workspace Tabs Backend Endpoints & Data Payloads');
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

  // 1. Get test client
  let client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  if (!client) {
    client = await prisma.clientAdmin.create({
      data: {
        name: 'Phase 6 UI Test Admin',
        email: `phase6.ui.${Date.now()}@shreenath.com`,
        mobile: '9876543299',
        organizationName: 'SHREE NATH EXPORTS UI TEST',
        passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz012345678901234567890123456789',
        status: 'ACTIVE',
      },
    });
  }

  const companyId = client.id;
  const timestamp = Date.now();

  const creatorActor = {
    id: `ui-creator-${timestamp}`,
    userId: `ui-creator-${timestamp}`,
    name: 'UI Production Supervisor',
    email: 'ui.creator@shreenath.com',
    role: 'PRODUCTION_MANAGER',
  };

  const approverActor = {
    id: `ui-approver-${timestamp}`,
    userId: `ui-approver-${timestamp}`,
    name: 'UI Director Approver',
    email: 'ui.approver@shreenath.com',
    role: 'DIRECTOR',
  };

  // Setup test warehouse, vendor, products & BOM
  const testWarehouse = await prisma.inventoryWarehouse.create({
    data: {
      companyId,
      code: `WH-UI-${timestamp}`,
      name: `UI Test Central Warehouse ${timestamp}`,
      address: 'GIDC Industrial Area, Surat',
      status: 'ACTIVE',
    },
  });

  const testVendor = await prisma.vendor.create({
    data: {
      companyId,
      vendorCode: `V-UI-${timestamp}`,
      name: `UI Subcontracting Partner ${timestamp}`,
      category: 'JOB_WORKER',
      status: 'ACTIVE',
      address: 'Industrial Plot 12, Surat',
      contact: 'Mr. Arvind Shah',
      phone: '9876512345',
      email: `vendor.${timestamp}@externalmfg.com`,
    },
  });

  const fgProduct = await prisma.product.create({
    data: {
      companyId,
      name: `UI Test Finished Perfume ${timestamp}`,
      sku: `SKU-FG-UI-${timestamp}`,
      category: 'FINISHED_GOOD',
      uom: 'BOTTLE',
      sellingPrice: 1500.0,
      status: 'ACTIVE',
    },
  });

  const rmProduct = await prisma.product.create({
    data: {
      companyId,
      name: `UI Test Aroma Extract ${timestamp}`,
      sku: `SKU-RM-UI-${timestamp}`,
      category: 'RAW_MATERIAL',
      uom: 'KG',
      sellingPrice: 200.0,
      status: 'ACTIVE',
    },
  });

  const bom = await bomService.createBom(companyId, {
    bomCode: `BOM-UI-${timestamp}`,
    bomName: 'UI Test Perfume BOM',
    outputProductId: fgProduct.id,
    batchSize: 100,
    uom: 'BOTTLE',
    items: [
      {
        productId: rmProduct.id,
        itemType: 'RAW_MATERIAL',
        quantity: 100.0,
        percentage: 100.0,
        scrapTolerancePct: 5.0, // 5% permissible scrap
        standardCost: 80.0,
        uom: 'KG',
      },
    ],
  }, creatorActor);

  await bomService.approveBom(companyId, bom.id, approverActor);

  const rmBatch = await prisma.inventoryBatch.create({
    data: {
      companyId,
      productId: rmProduct.id,
      sku: rmProduct.sku,
      batchNo: `LOT-RM-UI-${timestamp}`,
      warehouse: testWarehouse.name,
      initialQty: 500,
      availableQty: 500,
      qualityHoldQty: 0,
      wipQty: 0,
      rejectedQty: 0,
      qualityStatus: 'ACCEPTED',
      status: 'ACTIVE',
      unitCost: 80.0,
    },
  });

  let jwoId = null;
  let challanId = null;
  let receiptId = null;
  let reconId = null;

  // TAB 1: Dashboard Metrics
  await test('Tab 1: Dashboard Metrics Endpoint Data Payload', async () => {
    const stats = await jobWorkService.getDashboardMetrics(companyId);
    if (!stats || typeof stats.orders?.total !== 'number' || typeof stats.challans?.total !== 'number') {
      throw new Error('Dashboard stats missing required numerical metrics');
    }
  });

  // TAB 2: Manufacturers Directory
  await test('Tab 2: Manufacturer Directory List & Filter Endpoint', async () => {
    const list = await jobWorkService.listContractManufacturers(companyId, {});
    if (!list || list.length === 0) {
      throw new Error('Contract manufacturers list empty');
    }
    const found = list.find((v) => v.id === testVendor.id);
    if (!found) throw new Error('Test vendor not found in list');
  });

  // TAB 3: Job Work Orders
  await test('Tab 3: Job Work Order Creation & Approval Lifecycle', async () => {
    const order = await jobWorkService.createJobWorkOrder(companyId, {
      vendorId: testVendor.id,
      outputProductId: fgProduct.id,
      bomId: bom.id,
      targetQuantity: 100,
      uom: 'BOTTLE',
      deliveryAddress: 'GIDC Industrial Estate, Plot 12',
      processingRatePerUnit: 15.0,
      deliveryDate: new Date(Date.now() + 14 * 86400000).toISOString(),
    }, creatorActor);

    jwoId = order.id;

    await jobWorkService.submitOrderForApproval(companyId, jwoId, creatorActor);
    const approved = await jobWorkService.approveJobWorkOrder(companyId, jwoId, approverActor);

    if (approved.status !== 'APPROVED') {
      throw new Error(`Expected order status APPROVED, got ${approved.status}`);
    }
  });

  // TAB 4: FIFO Dispatch & Rule 55 Challans
  await test('Tab 4: Material Dispatch & Rule 55 Delivery Challan Creation', async () => {
    const challan = await jobWorkService.dispatchMaterials(
      companyId,
      jwoId,
      {
        warehouseId: testWarehouse.id,
        transportMode: 'ROAD',
        vehicleNo: 'GJ-01-XX-8888',
        transporterName: 'Fast Logistic Cargo',
        eWayBillNo: 'EWB-9988112233',
        notes: 'Fragile aroma oils for subcontracting',
        items: [
          {
            productId: rmProduct.id,
            quantity: 100.0,
          },
        ],
      },
      creatorActor
    );

    challanId = challan.id;

    if (!challan.challanNo.startsWith('JWC-')) {
      throw new Error(`Expected challanNo starting with JWC-, got ${challan.challanNo}`);
    }

    const challans = await jobWorkService.listChallans(companyId, { orderId: jwoId });
    if (!challans || challans.length === 0) throw new Error('Challans list returned empty');
  });

  // TAB 5: Vendor Material Custody Tracking & Returns
  await test('Tab 5: Vendor Custody Acknowledgement & Material Return', async () => {
    // Vendor acknowledges receipt of goods
    await jobWorkService.acknowledgeChallan(companyId, challanId, {
      remarks: 'Goods received intact at factory gate',
    }, creatorActor);

    // Return 5 KG unconsumed raw material
    const returns = await jobWorkService.returnMaterials(companyId, jwoId, {
      warehouseId: testWarehouse.id,
      items: [
        {
          productId: rmProduct.id,
          rmBatchId: rmBatch.id,
          quantity: 5.0,
          reason: 'Excess raw aroma oil return',
        },
      ],
    }, creatorActor);

    if (returns.length !== 1 || Number(returns[0].quantityReturned) !== 5.0) {
      throw new Error(`Expected 5 KG returned, got ${returns[0]?.quantityReturned}`);
    }
  });

  // TAB 6: Production Milestones
  await test('Tab 6: External Production Milestone Tracking', async () => {
    const milestone = await jobWorkService.addMilestone(companyId, jwoId, {
      milestoneType: 'PRODUCTION_STARTED',
      reportedOutputQty: 80.0,
      reportedScrapQty: 10.0,
      remarks: 'Bottling & packaging initiated under vendor supervision',
    }, creatorActor);

    if (!milestone || milestone.milestoneType !== 'PRODUCTION_STARTED') {
      throw new Error('Milestone logging failed');
    }

    const milestones = await jobWorkService.listMilestones(companyId, jwoId);
    if (!milestones || milestones.length === 0) throw new Error('Milestones list returned empty');
  });

  // TAB 7: Finished Goods Receipt Gate (QUALITY_HOLD)
  await test('Tab 7: Finished Goods Receipt Placed in QUALITY_HOLD', async () => {
    const receipt = await jobWorkService.createReceipt(companyId, jwoId, {
      warehouseId: testWarehouse.id,
      receivedQty: 80.0,
      vendorDeliveryNote: 'DN-BOTTLER-771',
      vendorBatchNo: `VLOT-PERF-UI-${timestamp}`,
    }, creatorActor);

    receiptId = receipt.id;
    if (receipt.qcStatus !== 'PENDING_QC') {
      throw new Error(`Receipt must initially be PENDING_QC, got ${receipt.qcStatus}`);
    }

    const fgBatch = await prisma.inventoryBatch.findUnique({
      where: { id: receipt.createdInventoryBatchId },
    });
    if (fgBatch.qualityHoldQty !== 80 || fgBatch.availableQty !== 0) {
      throw new Error(`Stock must be in QUALITY_HOLD: qualityHoldQty=${fgBatch.qualityHoldQty}, availableQty=${fgBatch.availableQty}`);
    }
  });

  // TAB 8: Subcontractor QC Gate
  await test('Tab 8: Subcontractor QC Inspection & Release to AVAILABLE', async () => {
    const inspected = await jobWorkService.inspectReceiptQc(companyId, receiptId, {
      acceptedQty: 80.0,
      rejectedQty: 0.0,
      qcRemarks: 'All 80 bottles passed volume, crimp and visual checks.',
    }, approverActor);

    if (inspected.qcStatus !== 'PASSED') {
      throw new Error(`Expected QC status PASSED, got ${inspected.qcStatus}`);
    }

    const updatedBatch = await prisma.inventoryBatch.findUnique({
      where: { id: inspected.createdInventoryBatchId },
    });
    if (updatedBatch.availableQty !== 80 || updatedBatch.qualityHoldQty !== 0) {
      throw new Error(`Expected availableQty=80, qualityHoldQty=0, got ${updatedBatch.availableQty}, ${updatedBatch.qualityHoldQty}`);
    }
  });

  // TAB 9: Scrap Reconciliation (User Benchmark: Dispatched=100, Consumed=80, Returned=5, Scrap=10 -> Variance=5)
  await test('Tab 9: Material Scrap Reconciliation Preview & Finalization', async () => {
    const preview = await jobWorkService.calculateReconciliationPreview(companyId, jwoId, {
      items: [
        {
          productId: rmProduct.id,
          consumedQty: 80.0,
          actualScrapQty: 10.0,
        },
      ],
    });

    const bItem = preview.items[0];
    // Dispatched = 100, Consumed = 80, Returned = 5, Actual Scrap = 10 -> Variance = 5 KG
    if (bItem.dispatchedQty !== 100.0) throw new Error(`Expected dispatched 100, got ${bItem.dispatchedQty}`);
    if (bItem.returnedQty !== 5.0) throw new Error(`Expected returned 5, got ${bItem.returnedQty}`);
    if (bItem.consumedQty !== 80.0) throw new Error(`Expected consumed 80, got ${bItem.consumedQty}`);
    if (bItem.actualScrapQty !== 10.0) throw new Error(`Expected actual scrap 10, got ${bItem.actualScrapQty}`);
    if (bItem.varianceQty !== 5.0) throw new Error(`Expected variance 5, got ${bItem.varianceQty}`);

    // Permissible scrap = 80 * 0.05 = 4 KG; Excess scrap = 10 - 4 = 6 KG; Excess debit = 6 * 200 (sellingPrice) = Rs 1200
    if (bItem.permissibleScrapQty !== 4.0) throw new Error(`Expected permissible scrap 4, got ${bItem.permissibleScrapQty}`);
    if (bItem.excessScrapQty !== 6.0) throw new Error(`Expected excess scrap 6, got ${bItem.excessScrapQty}`);
    if (preview.excessWastageDebit !== 1200.0) throw new Error(`Expected excess debit 1200, got ${preview.excessWastageDebit}`);

    const finalRecon = await jobWorkService.finalizeReconciliation(companyId, jwoId, {
      notes: 'Final reconciled with subcontractor Arvind Shah',
    }, approverActor);

    reconId = finalRecon.id;
    if (!finalRecon.isPaymentHold) {
      throw new Error('Payment hold must be enabled due to excess scrap!');
    }
  });

  // TAB 10: Billing & Settlement with Wastage Debit and Payment Hold
  await test('Tab 10: Billing Settlement with Excess Wastage Debit and Hold Release', async () => {
    const settled = await jobWorkService.settleJobWork(companyId, reconId, {
      notes: 'Subcontractor agreed to debit note for excess scrap. Hold released.',
    }, approverActor);

    if (settled.settlementStatus !== 'SETTLED' || settled.isPaymentHold) {
      throw new Error(`Expected SETTLED and isPaymentHold=false, got ${settled.settlementStatus}, ${settled.isPaymentHold}`);
    }

    const closedOrder = await jobWorkService.getJobWorkOrderById(companyId, jwoId);
    if (closedOrder.status !== 'COMPLETED') {
      throw new Error(`Expected order status COMPLETED, got ${closedOrder.status}`);
    }
  });

  console.log('\n------------------------------------------------------------------------');
  console.log(`Phase 6 Frontend Workspace API Test Suite Completed: ${passed} PASSED, ${failed} FAILED`);
  console.log('------------------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

// Execute directly if run as main script
if (process.argv[1]?.includes('phase6_frontend_workspace_api.test.js')) {
  runPhase6FrontendWorkspaceApiTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal Test Execution Error:', err);
      process.exit(1);
    });
}
