import prisma from '../../src/config/prisma.js';
import dispatchService from '../../src/services/dispatch/dispatch.service.js';
import dispatchTrackingService from '../../src/services/dispatch/dispatchTracking.service.js';
import returnsService from '../../src/services/dispatch/returns.service.js';
import creditNoteService from '../../src/services/dispatch/creditNote.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Strict Database Guard: ONLY execute against crm_erp_test_db
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 7 Verification must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${dbUrl || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase7TargetedVerification() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 7: Step 4 Targeted Integration Verification');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Verifying: GST Credit Notes, RMA Cumulative Limits, Multi-Transaction Balances');
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

  // Tenant & Actors
  let client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const companyId = client.id;
  const actor1 = { id: 'usr-verif-agent', name: 'Logistics Supervisor' };
  const actor2 = { id: 'usr-verif-manager', name: 'Commercial Authority' };

  // Setup unique SKU and batches
  const sku = `VERIF-P7-COTTON-${Date.now().toString().slice(-4)}`;
  const product = await prisma.product.create({
    data: {
      companyId,
      sku,
      name: 'Phase 7 Verification Cotton',
      uom: 'KG',
      purchasePrice: new Decimal('180.00'),
      sellingPrice: new Decimal('300.00'),
      status: 'ACTIVE',
    },
  });

  const batch1 = await prisma.inventoryBatch.create({
    data: {
      companyId,
      batchNo: `BAT-VERIF-01-${Date.now().toString().slice(-4)}`,
      sku,
      warehouse: 'Targeted Warehouse',
      availableQty: 1000,
      unitCost: new Decimal('180.00'),
      manufacturingDate: new Date('2026-01-01'),
      status: 'ACTIVE',
      qualityStatus: 'ACCEPTED',
    },
  });

  const stockHeader = await prisma.inventoryStock.create({
    data: {
      companyId,
      sku,
      name: product.name,
      warehouse: 'Targeted Warehouse',
      uom: 'KG',
      stock: 1000,
      availableQty: 1000,
      averageCost: new Decimal('180.00'),
    },
  });

  // ==========================================================================
  // SECTION 1: GST CREDIT NOTE & ORIGINAL INVOICE VERIFICATION
  // ==========================================================================
  
  // 1.1 Original invoice with CGST + SGST (Intra-State: Rajasthan GSTIN 08...)
  await test('1.1 GST Credit Note: Original invoice with CGST + SGST (Intra-state Rajasthan)', async () => {
    const soIntra = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo: `SO-INTRA-${Date.now().toString().slice(-4)}`,
        customer: 'Jaipur Crafts Store',
        status: 'APPROVED',
        isReleased: true,
        itemsCount: 1,
        items: [{ sku, quantity: 10, price: 300, taxRate: 18, uom: 'KG' }],
      },
    });

    const dspIntra = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: soIntra.id,
        customerName: 'Jaipur Crafts Store',
        customerGstin: '08AABCJ5678K1Z2', // Intra-state Rajasthan (08)
        invoiceNo: 'INV-RAJ-2026-001',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku, dispatchedQty: 10, unitPrice: 300, taxRate: 18, uom: 'KG' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dspIntra.id, {}, actor1);
    await dispatchTrackingService.recordPOD(companyId, dspIntra.id, { receiverName: 'Jaipur Receiver' }, actor1);

    const rmaIntra = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspIntra.id,
        returnReason: 'TRANSIT_DAMAGE',
        items: [{ sku, returnQty: 10 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rmaIntra.id, {}, actor2);

    // 10 KG @ ₹300 = ₹3,000 Taxable. 18% GST = ₹540 total -> CGST ₹270 + SGST ₹270
    const cnIntra = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: rmaIntra.id,
        restockingFeeRate: 0,
      },
      actor1
    );

    if (Number(cnIntra.taxableAmount) !== 3000) throw new Error(`Taxable mismatch: expected 3000, got ${cnIntra.taxableAmount}`);
    if (Number(cnIntra.cgstAmount) !== 270) throw new Error(`CGST mismatch: expected 270, got ${cnIntra.cgstAmount}`);
    if (Number(cnIntra.sgstAmount) !== 270) throw new Error(`SGST mismatch: expected 270, got ${cnIntra.sgstAmount}`);
    if (Number(cnIntra.igstAmount) !== 0) throw new Error(`IGST should be 0 for intra-state, got ${cnIntra.igstAmount}`);
    if (Number(cnIntra.totalAmount) !== 3540) throw new Error(`Total mismatch: expected 3540, got ${cnIntra.totalAmount}`);
    if (Number(cnIntra.netCreditAmount) !== 3540) throw new Error(`Net credit mismatch: expected 3540, got ${cnIntra.netCreditAmount}`);
  });

  // 1.2 Original invoice with IGST (Inter-State: Maharashtra GSTIN 27...)
  await test('1.2 GST Credit Note: Original invoice with IGST (Inter-state Maharashtra)', async () => {
    const soInter = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo: `SO-INTER-${Date.now().toString().slice(-4)}`,
        customer: 'Mumbai Textiles Ltd',
        status: 'APPROVED',
        isReleased: true,
        itemsCount: 1,
        items: [{ sku, quantity: 20, price: 300, taxRate: 12, uom: 'KG' }],
      },
    });

    const dspInter = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: soInter.id,
        customerName: 'Mumbai Textiles Ltd',
        customerGstin: '27AABCM1234F1Z5', // Inter-state Maharashtra (27 != Rajasthan 08)
        invoiceNo: 'INV-MH-2026-002',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku, dispatchedQty: 20, unitPrice: 300, taxRate: 12, uom: 'KG' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dspInter.id, {}, actor1);
    await dispatchTrackingService.recordPOD(companyId, dspInter.id, { receiverName: 'Mumbai Receiver' }, actor1);

    const rmaInter = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspInter.id,
        returnReason: 'DEFECTIVE_PRODUCT',
        items: [{ sku, returnQty: 20 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rmaInter.id, {}, actor2);

    // 20 KG @ ₹300 = ₹6,000 Taxable. 12% GST = ₹720 IGST (Inter-state).
    const cnInter = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: rmaInter.id,
        restockingFeeRate: 0,
      },
      actor1
    );

    if (Number(cnInter.taxableAmount) !== 6000) throw new Error(`Taxable mismatch: expected 6000, got ${cnInter.taxableAmount}`);
    if (Number(cnInter.igstAmount) !== 720) throw new Error(`IGST mismatch: expected 720, got ${cnInter.igstAmount}`);
    if (Number(cnInter.cgstAmount) !== 0 || Number(cnInter.sgstAmount) !== 0) throw new Error('Intra-state tax applied instead of IGST');
    if (Number(cnInter.totalAmount) !== 6720) throw new Error(`Total mismatch: expected 6720, got ${cnInter.totalAmount}`);
    if (Number(cnInter.netCreditAmount) !== 6720) throw new Error(`Net credit mismatch: expected 6720, got ${cnInter.netCreditAmount}`);
  });

  // 1.3 Partial return: Proportional tax calculation against original invoice line
  await test('1.3 GST Credit Note: Partial return proportional tax calculation', async () => {
    const soPartial = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo: `SO-PART-${Date.now().toString().slice(-4)}`,
        customer: 'Delhi Garments House',
        status: 'APPROVED',
        isReleased: true,
        itemsCount: 1,
        items: [{ sku, quantity: 50, price: 300, taxRate: 18, uom: 'KG' }],
      },
    });

    const dspPartial = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: soPartial.id,
        customerName: 'Delhi Garments House',
        customerGstin: '07AABCD1234F1Z3', // Inter-state Delhi (07)
        invoiceNo: 'INV-DEL-2026-003',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku, dispatchedQty: 50, unitPrice: 300, taxRate: 18, uom: 'KG' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dspPartial.id, {}, actor1);
    await dispatchTrackingService.recordPOD(companyId, dspPartial.id, { receiverName: 'Delhi Receiver' }, actor1);

    // Partial return of only 15 KG out of 50 KG dispatched
    const rmaPartial = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspPartial.id,
        returnReason: 'EXCESS_STOCK',
        items: [{ sku, returnQty: 15 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rmaPartial.id, {}, actor2);

    // Proportional: 15 KG @ ₹300 = ₹4,500 Taxable. 18% IGST = ₹810.
    // 5% Restocking fee on ₹5,310 = ₹265.50. Net Credit = ₹5,044.50
    const cnPartial = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: rmaPartial.id,
        restockingFeeRate: 5,
      },
      actor1
    );

    if (Number(cnPartial.taxableAmount) !== 4500) throw new Error(`Taxable mismatch: expected 4500, got ${cnPartial.taxableAmount}`);
    if (Number(cnPartial.igstAmount) !== 810) throw new Error(`IGST mismatch: expected 810, got ${cnPartial.igstAmount}`);
    if (Number(cnPartial.totalAmount) !== 5310) throw new Error(`Total mismatch: expected 5310, got ${cnPartial.totalAmount}`);
    if (Number(cnPartial.restockingFeeAmount) !== 265.5) throw new Error(`Restocking fee mismatch: expected 265.5, got ${cnPartial.restockingFeeAmount}`);
    if (Number(cnPartial.netCreditAmount) !== 5044.5) throw new Error(`Net credit mismatch: expected 5044.5, got ${cnPartial.netCreditAmount}`);
  });

  // 1.4 Invoice unavailable: Assert clear validation error 422
  await test('1.4 GST Credit Note: Invoice unavailable returns validation error 422', async () => {
    // Create dispatch without invoiceNo
    const dspNoInv = await dispatchService.createDispatchOrder(
      companyId,
      {
        customerName: 'Uninvoiced Customer Corp',
        customerGstin: '08AABCU9999F1Z9',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku, dispatchedQty: 10, unitPrice: 300, taxRate: 18, uom: 'KG' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dspNoInv.id, {}, actor1);

    const rmaNoInv = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspNoInv.id,
        returnReason: 'DEFECTIVE_PRODUCT',
        items: [{ sku, returnQty: 5 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rmaNoInv.id, {}, actor2);

    // Attempting to create credit note without invoice and without taxRateOverride MUST throw 422
    try {
      await creditNoteService.createCreditNote(
        companyId,
        {
          customerReturnId: rmaNoInv.id,
        },
        actor1
      );
      throw new Error('Should have thrown validation error when invoice is unavailable');
    } catch (err) {
      if (err.status !== 422 || !err.message.includes('Original Tax Invoice is unavailable')) {
        throw new Error(`Expected 422 with invoice unavailable message, got status=${err.status}, msg=${err.message}`);
      }
    }
  });

  // 1.5 Multiple partial returns against same dispatch
  await test('1.5 GST Credit Note: Multiple partial returns against same dispatch', async () => {
    const soMulti = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo: `SO-MULTI-${Date.now().toString().slice(-4)}`,
        customer: 'Haryana Retailers Ltd',
        status: 'APPROVED',
        isReleased: true,
        itemsCount: 1,
        items: [{ sku, quantity: 40, price: 200, taxRate: 18, uom: 'KG' }],
      },
    });

    const dspMulti = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: soMulti.id,
        customerName: 'Haryana Retailers Ltd',
        customerGstin: '06AABCH4444F1Z7', // Inter-state Haryana (06)
        invoiceNo: 'INV-HR-2026-005',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku, dispatchedQty: 40, unitPrice: 200, taxRate: 18, uom: 'KG' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dspMulti.id, {}, actor1);
    await dispatchTrackingService.recordPOD(companyId, dspMulti.id, { receiverName: 'Haryana Receiver' }, actor1);

    // First partial return: 15 KG
    const rma1 = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspMulti.id,
        returnReason: 'SPECIFICATION_MISMATCH',
        items: [{ sku, returnQty: 15 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rma1.id, {}, actor2);

    const cn1 = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: rma1.id,
        restockingFeeRate: 0,
      },
      actor1
    );

    // Second partial return: 10 KG against same dispatch
    const rma2 = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspMulti.id,
        returnReason: 'TRANSIT_DAMAGE',
        items: [{ sku, returnQty: 10 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rma2.id, {}, actor2);

    const cn2 = await creditNoteService.createCreditNote(
      companyId,
      {
        customerReturnId: rma2.id,
        restockingFeeRate: 0,
      },
      actor1
    );

    // Assert both credit notes are distinct and proportional
    if (cn1.id === cn2.id) throw new Error('Credit notes should have distinct IDs');
    if (Number(cn1.taxableAmount) !== 3000) throw new Error(`CN1 taxable mismatch: expected 3000, got ${cn1.taxableAmount}`); // 15 * 200
    if (Number(cn2.taxableAmount) !== 2000) throw new Error(`CN2 taxable mismatch: expected 2000, got ${cn2.taxableAmount}`); // 10 * 200
    if (Number(cn1.igstAmount) !== 540) throw new Error(`CN1 IGST mismatch: expected 540, got ${cn1.igstAmount}`); // 3000 * 18%
    if (Number(cn2.igstAmount) !== 360) throw new Error(`CN2 IGST mismatch: expected 360, got ${cn2.igstAmount}`); // 2000 * 18%

    // Verify cumulative return limits prevent 3rd return exceeding remaining (40 - 25 = 15 remaining)
    try {
      await returnsService.createReturnRequest(
        companyId,
        {
          dispatchOrderId: dspMulti.id,
          returnReason: 'OTHER',
          items: [{ sku, returnQty: 20 }], // 20 > 15 remaining
        },
        actor1
      );
      throw new Error('Should have blocked return exceeding cumulative remaining quantity');
    } catch (err) {
      if (!err.message.includes('exceeds eligible dispatched quantity')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // 1.6 Duplicate issuance prevention for same RMA
  await test('1.6 GST Credit Note: Duplicate issuance prevention for same RMA', async () => {
    const existingCn = await prisma.customerCreditNote.findFirst({
      where: { companyId, status: { not: 'CANCELLED' } },
    });

    try {
      await creditNoteService.createCreditNote(
        companyId,
        { customerReturnId: existingCn.customerReturnId },
        actor1
      );
      throw new Error('Should have prevented duplicate credit note for same return');
    } catch (err) {
      if (!err.message.includes('Duplicate credit note prevented')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // ==========================================================================
  // SECTION 2: RMA QUANTITY VALIDATION
  // ==========================================================================
  await test('2.1 RMA Quantity: Rejected RMA does not count toward cumulative return limit', async () => {
    // Dispatch order for 20 units
    const dspRma = await dispatchService.createDispatchOrder(
      companyId,
      {
        customerName: 'Test Cumulative Customer',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku, dispatchedQty: 20, unitPrice: 200 }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dspRma.id, {}, actor1);

    // Request RMA for 15 units
    const rma1 = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspRma.id,
        returnReason: 'OTHER',
        items: [{ sku, returnQty: 15 }],
      },
      actor1
    );

    // Reject RMA 1
    await returnsService.rejectReturn(companyId, rma1.id, { reason: 'Invalid claim' }, actor2);

    // Because RMA 1 was REJECTED, it must NOT count toward the return limit!
    // Customer should now be allowed to request up to the full 20 units!
    const rma2 = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dspRma.id,
        returnReason: 'DEFECTIVE_PRODUCT',
        items: [{ sku, returnQty: 20 }],
      },
      actor1
    );

    if (!rma2 || Number(rma2.totalReturnedQty) !== 20) {
      throw new Error('Rejected RMA wrongly counted toward return limit');
    }
  });

  await test('2.2 RMA Quantity: Received quantity cannot exceed approved quantity', async () => {
    // Using rma2 (approved for 20 units)
    const rmaApproved = await returnsService.createReturnRequest(
      companyId,
      {
        customerName: 'Over-receipt Test Customer',
        returnReason: 'DEFECTIVE_PRODUCT',
        items: [{ sku, returnQty: 10, unitPrice: 200 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, rmaApproved.id, {}, actor2);

    // Attempt to receive 15 units (exceeding approved 10)
    try {
      await returnsService.receiveReturnedGoods(
        companyId,
        rmaApproved.id,
        {
          items: [{ sku, receivedQty: 15 }],
        },
        actor1
      );
      throw new Error('Should have failed when receivedQty > returnQty');
    } catch (err) {
      if (!err.message.includes('cannot exceed approved RMA return quantity')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // ==========================================================================
  // SECTION 3: MULTI-TRANSACTION DISPATCH & RETURN REALISTIC SIMULATION
  // ==========================================================================
  await test('3. Multi-Transaction Simulation: Benchmark (100 SO -> 40 Dsp + 30 Dsp; 10 Ret + 5 Ret)', async () => {
    // Prepare fresh batch with 100 units
    const simSku = `SIM-100-SKU-${Date.now().toString().slice(-4)}`;
    await prisma.inventoryBatch.create({
      data: {
        companyId,
        batchNo: `BAT-SIM-01-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        sku: simSku,
        warehouse: 'Targeted Warehouse',
        availableQty: 100,
        unitCost: new Decimal('150.00'),
        manufacturingDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        qualityStatus: 'ACCEPTED',
      },
    });

    await prisma.inventoryStock.create({
      data: {
        companyId,
        sku: simSku,
        name: 'Simulation Fabric',
        warehouse: 'Targeted Warehouse',
        uom: 'MTR',
        stock: 100,
        availableQty: 100,
        averageCost: new Decimal('150.00'),
      },
    });

    // 1. Original Sales Order: 100 units
    const soSim = await prisma.salesOrder.create({
      data: {
        companyId,
        orderNo: `SO-SIM-100-${Date.now().toString().slice(-4)}`,
        customer: 'Benchmark Client Corp',
        status: 'APPROVED',
        isReleased: true,
        itemsCount: 1,
        items: [{ sku: simSku, quantity: 100, price: 250, taxRate: 18, uom: 'MTR' }],
      },
    });

    // 2. Dispatch 1: 40 units
    const dsp1 = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: soSim.id,
        customerName: 'Benchmark Client Corp',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku: simSku, dispatchedQty: 40, unitPrice: 250, uom: 'MTR' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dsp1.id, {}, actor1);

    // Verify remaining pending on SO after Dispatch 1 (should be 60)
    let eligible = await dispatchService.listEligibleSalesOrders(companyId);
    let soMatch = eligible.find((s) => s.id === soSim.id);
    if (soMatch.totalPendingQty !== 60) throw new Error(`Pending after Dsp 1 should be 60, got ${soMatch.totalPendingQty}`);

    // 3. Dispatch 2: 30 units
    const dsp2 = await dispatchService.createDispatchOrder(
      companyId,
      {
        salesOrderId: soSim.id,
        customerName: 'Benchmark Client Corp',
        warehouseName: 'Targeted Warehouse',
        items: [{ sku: simSku, dispatchedQty: 30, unitPrice: 250, uom: 'MTR' }],
      },
      actor1
    );
    await dispatchService.executeDispatch(companyId, dsp2.id, {}, actor1);

    // Verify remaining pending on SO after Dispatch 2 (should be 30)
    eligible = await dispatchService.listEligibleSalesOrders(companyId);
    soMatch = eligible.find((s) => s.id === soSim.id);
    if (soMatch.totalPendingQty !== 30) throw new Error(`Pending after Dsp 2 should be 30, got ${soMatch.totalPendingQty}`);

    // Over-dispatch prevention: trying to dispatch 40 when remaining is 30 must fail!
    try {
      await dispatchService.createDispatchOrder(
        companyId,
        {
          salesOrderId: soSim.id,
          customerName: 'Benchmark Client Corp',
          warehouseName: 'Targeted Warehouse',
          items: [{ sku: simSku, dispatchedQty: 40, unitPrice: 250, uom: 'MTR' }],
        },
        actor1
      );
      throw new Error('Should have blocked over-dispatch');
    } catch (err) {
      if (!err.message.includes('exceeds remaining pending quantity')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // 4. Return 1: 10 units against Dispatch 1 (40 dispatched)
    const ret1 = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dsp1.id,
        returnReason: 'DEFECTIVE_PRODUCT',
        items: [{ sku: simSku, returnQty: 10, unitPrice: 250 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, ret1.id, {}, actor2);
    await returnsService.receiveReturnedGoods(companyId, ret1.id, {}, actor1);
    await returnsService.inspectReturnedGoods(
      companyId,
      ret1.id,
      {
        items: [{ sku: simSku, inspectedQty: 10, restockQty: 10, reworkQty: 0, rejectQty: 0, scrapQty: 0 }],
      },
      actor1
    );

    // 5. Return 2: 5 units against Dispatch 2 (30 dispatched)
    const ret2 = await returnsService.createReturnRequest(
      companyId,
      {
        dispatchOrderId: dsp2.id,
        returnReason: 'TRANSIT_DAMAGE',
        items: [{ sku: simSku, returnQty: 5, unitPrice: 250 }],
      },
      actor1
    );
    await returnsService.approveReturn(companyId, ret2.id, {}, actor2);
    await returnsService.receiveReturnedGoods(companyId, ret2.id, {}, actor1);
    await returnsService.inspectReturnedGoods(
      companyId,
      ret2.id,
      {
        items: [{ sku: simSku, inspectedQty: 5, restockQty: 5, reworkQty: 0, rejectQty: 0, scrapQty: 0 }],
      },
      actor1
    );

    // VERIFY EXACT BENCHMARK BALANCES:
    // Total Dispatched = 40 + 30 = 70 units
    const totalDispatched = Number(dsp1.totalDispatchedQty) + Number(dsp2.totalDispatchedQty);
    if (totalDispatched !== 70) throw new Error(`Expected total dispatched 70, got ${totalDispatched}`);

    // Remaining Dispatch Quantity = 100 - 70 = 30 units
    const remainingPending = soMatch.totalPendingQty;
    if (remainingPending !== 30) throw new Error(`Expected remaining pending 30, got ${remainingPending}`);

    // Total Returned = 10 + 5 = 15 units
    const totalReturned = Number(ret1.totalReturnedQty) + Number(ret2.totalReturnedQty);
    if (totalReturned !== 15) throw new Error(`Expected total returned 15, got ${totalReturned}`);

    // Net Delivered Quantity = Total Dispatched - Total Returned = 70 - 15 = 55 units
    const netDelivered = totalDispatched - totalReturned;
    if (netDelivered !== 55) throw new Error(`Expected net delivered 55, got ${netDelivered}`);

    // Inventory Movements verification:
    // Two SALES_DISPATCH (40 + 30 = 70 deducted)
    // Two RETURN_RESTOCK (10 + 5 = 15 restored to AVAILABLE)
    const movements = await prisma.inventoryMovement.findMany({
      where: { companyId, sku: simSku },
    });

    const dispatchMovements = movements.filter((m) => m.movementType === 'SALES_DISPATCH');
    const restockMovements = movements.filter((m) => m.movementType === 'RETURN_RESTOCK');

    if (dispatchMovements.length !== 2) throw new Error(`Expected 2 dispatch movements, got ${dispatchMovements.length}`);
    if (restockMovements.length !== 2) throw new Error(`Expected 2 restock movements, got ${restockMovements.length}`);

    const sumDispatchedMov = dispatchMovements.reduce((sum, m) => sum + m.quantity, 0);
    const sumRestockedMov = restockMovements.reduce((sum, m) => sum + m.quantity, 0);

    if (sumDispatchedMov !== 70) throw new Error(`Movement dispatched sum mismatch: ${sumDispatchedMov}`);
    if (sumRestockedMov !== 15) throw new Error(`Movement restocked sum mismatch: ${sumRestockedMov}`);
  });

  console.log('\n========================================================================');
  console.log(`Phase 7 Targeted Verification Finished: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} verification check(s) failed.`);
  }

  return { passed, failed };
}

// Execute directly if run as main
if (process.argv[1]?.includes('phase7_targeted_verification.test.js')) {
  runPhase7TargetedVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Targeted verification failed:', err);
      process.exit(1);
    });
}

