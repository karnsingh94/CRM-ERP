import prisma from '../../src/config/prisma.js';
import purchaseService from '../../src/services/purchase/purchase.service.js';

export async function runPhase3PurchaseVendorTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 3: Purchase & Vendor Management Test Suite');
  console.log('Testing: Vendor KYC, PR Indents, 5-Quote Landed Cost, Dual Artwork,');
  console.log('         Partial GRN, QC Deviations, Full Invoice Payment Hold');
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
  if (clients.length < 1) throw new Error('At least one tenant required for Phase 3 test.');

  const companyA = clients[0].id;
  const companyB = clients.length > 1 ? clients[1].id : '00000000-0000-0000-0000-000000000099';

  const actorManager = { email: 'purchase.manager@sne.com', name: 'Purchase Manager', role: 'COMPANY_ADMIN', id: 'actor-mgr-1' };
  const actorBuyer = { email: 'buyer@sne.com', name: 'Procurement Executive', role: 'COMPANY_USER', id: 'actor-buyer-1' };
  const actorDesigner = { email: 'designer@sne.com', name: 'Lead Packaging Designer', role: 'DESIGNER', id: 'actor-des-1' };
  const actorQC = { email: 'qc.inspector@sne.com', name: 'QC Inspector', role: 'QC_OFFICER', id: 'actor-qc-1' };

  let testVendor1 = null;
  let testVendor2 = null;
  let testPR = null;
  let singlePR = null;
  let testQuote1 = null;
  let testQuote2 = null;
  let singleQuote = null;
  let testPO = null;
  let testProof = null;
  let testGRN1 = null;
  let testGRN2 = null;
  let testBill = null;

  try {
    // TEST 1: Vendor Master & Onboarding with KYC and Approval
    await test('1. Vendor registration with PAN, GSTIN, bank details and onboarding approval', async () => {
      testVendor1 = await purchaseService.createVendor(companyA, {
        name: 'Apex Industrial Packaging Ltd',
        legalName: 'Apex Industrial Packaging Private Limited',
        pan: 'ABCDE1234F',
        taxId: '24ABCDE1234F1Z5',
        category: 'Packaging Materials',
        email: 'sales@apexpackaging.com',
        phone: '9876543210',
        registeredAddress: 'Plot 45, GIDC Industrial Estate, Vadodara, Gujarat',
        paymentTerms: '30 Days Net',
        creditPeriodDays: 30,
        leadTimeDays: 7,
        requiresApproval: true,
        bankDetails: {
          accountNumber: '918237465019',
          ifsc: 'HDFC0000123',
          bankName: 'HDFC Bank Ltd',
        },
      }, actorBuyer);

      if (!testVendor1?.id) throw new Error('Failed to register vendor 1');
      if (testVendor1.approvalStatus !== 'PENDING_APPROVAL') throw new Error(`Expected PENDING_APPROVAL, got ${testVendor1.approvalStatus}`);

      // Manager approves vendor onboarding
      const approvedVendor = await purchaseService.approveVendor(companyA, testVendor1.id, actorManager);
      if (approvedVendor.approvalStatus !== 'APPROVED') throw new Error('Vendor onboarding approval failed');
      testVendor1 = approvedVendor;

      // Register second vendor for competitive bidding
      testVendor2 = await purchaseService.createVendor(companyA, {
        name: 'Paramount Polymers Corp',
        legalName: 'Paramount Polymers Corporation',
        pan: 'PARPL9876K',
        taxId: '24PARPL9876K1Z9',
        category: 'Packaging Materials',
        email: 'orders@paramountpoly.com',
        paymentTerms: '45 Days Net',
        leadTimeDays: 5,
        requiresApproval: true,
      }, actorBuyer);
      await purchaseService.approveVendor(companyA, testVendor2.id, actorManager);
    });

    // TEST 2: Purchase Request with Priority and Immutable V1 DocumentVersion
    await test('2. Purchase Request creation with priority, immutable V1 snapshot and approval', async () => {
      const sku = `BOX-CORR-${Date.now()}`;
      testPR = await purchaseService.createRequest(companyA, {
        department: 'Packaging',
        requestedBy: 'Store Supervisor',
        priority: 'HIGH',
        purpose: 'Export Order SN-EXP-2026',
        requiredBy: new Date(Date.now() + 10 * 86400000).toISOString(),
        items: [
          { sku, name: '7-Ply Heavy Duty Corrugated Boxes', qty: 1000, uom: 'PCS', specification: 'GSM 180, Bursting Factor 24' },
        ],
      }, actorBuyer);

      if (!testPR?.id) throw new Error('Failed to create purchase request');
      if (testPR.priority !== 'HIGH') throw new Error(`Expected priority HIGH, got ${testPR.priority}`);
      if (testPR.versionNumber !== 1) throw new Error(`Expected version 1, got ${testPR.versionNumber}`);

      // Check immutable snapshot in DocumentVersion
      const v1Snapshot = await prisma.documentVersion.findFirst({
        where: { companyId: companyA, entityType: 'PURCHASE_REQUEST', entityId: testPR.id, versionNumber: 1 },
      });
      if (!v1Snapshot) throw new Error('Immutable V1 DocumentVersion snapshot was not recorded for PR');

      // Approve PR
      const approvedPR = await purchaseService.approveRequest(companyA, testPR.id, actorManager);
      if (approvedPR.status !== 'APPROVED') throw new Error(`Expected PR status APPROVED, got ${approvedPR.status}`);
      if (!approvedPR.approvedAt) throw new Error('Expected approvedAt timestamp to be recorded');
      testPR = approvedPR;
    });

    // TEST 3: PR Rejection blocks sourcing
    await test('3. Rejected PR is blocked from RFQ and PO sourcing', async () => {
      const rejectPR = await purchaseService.createRequest(companyA, {
        department: 'Admin',
        priority: 'LOW',
        purpose: 'Non-budgeted office furniture',
        items: [{ sku: 'OFF-CHAIR-01', name: 'Ergonomic Office Chair', qty: 5, uom: 'PCS' }],
      }, actorBuyer);

      await purchaseService.rejectRequest(companyA, rejectPR.id, 'Outside annual Capex budget', actorManager);

      // Attempting to quote against a rejected PR must throw error
      let blocked = false;
      try {
        await purchaseService.createQuotation(companyA, {
          requestId: rejectPR.id,
          vendorId: testVendor1.id,
          items: [{ sku: 'OFF-CHAIR-01', unitRate: 4500 }],
        }, actorBuyer);
      } catch (err) {
        blocked = true;
      }
      if (!blocked) throw new Error('Rejected PR allowed quotation creation when it must be strictly blocked');
      await prisma.purchaseRequest.delete({ where: { id: rejectPR.id } });
    });

    // TEST 4: PR Revision branches to V2
    await test('4. PR Revision branches to V2 with preserved previous version', async () => {
      const revisedPR = await purchaseService.reviseRequest(companyA, testPR.id, {
        purpose: 'Export Order SN-EXP-2026 (Updated Specs)',
        reason: 'Client requested upgraded bursting factor',
      }, actorManager);

      if (revisedPR.versionNumber !== 2) throw new Error(`Expected version 2, got ${revisedPR.versionNumber}`);
      const v2Snapshot = await prisma.documentVersion.findFirst({
        where: { companyId: companyA, entityType: 'PURCHASE_REQUEST', entityId: testPR.id, versionNumber: 2 },
      });
      if (!v2Snapshot) throw new Error('V2 DocumentVersion snapshot was not created on revision');

      // Approve V2 revision to enable sourcing
      testPR = await purchaseService.approveRequest(companyA, testPR.id, actorManager);
    });

    // TEST 5: RFQ Landed Cost Calculation (Basic + Tax + Freight + Loading + Unloading + Handling + Other)
    await test('5. RFQ Landed Cost calculation and Lowest Landed Cost determination', async () => {
      const sku = testPR.items[0].sku;

      // Quote 1: Vendor 1 (Higher basic rate, but lower handling)
      // Basic: 1000 * 50 = 50,000. Tax: 9,000 (18%). Freight: 2,000. Loading: 500. Unloading: 500. Handling: 300. Other: 200.
      // Expected Landed Cost: 50000 + 9000 + 2000 + 500 + 500 + 300 + 200 = 62,500
      testQuote1 = await purchaseService.createQuotation(companyA, {
        requestId: testPR.id,
        vendorId: testVendor1.id,
        vendorQuoteNo: 'APX-Q-2026-001',
        deliveryDays: 6,
        paymentTerms: '30 Days',
        taxAmount: 9000,
        freightAmount: 2000,
        loadingCharges: 500,
        unloadingCharges: 500,
        handlingCharges: 300,
        otherCharges: 200,
        items: [{ sku, unitRate: 50 }],
      }, actorBuyer);

      if (Number(testQuote1.landedCost) !== 62500) {
        throw new Error(`Expected Quote 1 Landed Cost 62500, got ${testQuote1.landedCost}`);
      }

      // Quote 2: Vendor 2 (Lower basic rate, higher freight)
      // Basic: 1000 * 45 = 45,000. Tax: 8,100 (18%). Freight: 1,500. Loading: 400. Unloading: 400. Handling: 200. Other: 100.
      // Expected Landed Cost: 45000 + 8100 + 1500 + 400 + 400 + 200 + 100 = 55,700
      testQuote2 = await purchaseService.createQuotation(companyA, {
        requestId: testPR.id,
        vendorId: testVendor2.id,
        vendorQuoteNo: 'PAR-Q-9901',
        deliveryDays: 5,
        paymentTerms: '45 Days',
        taxAmount: 8100,
        freightAmount: 1500,
        loadingCharges: 400,
        unloadingCharges: 400,
        handlingCharges: 200,
        otherCharges: 100,
        items: [{ sku, unitRate: 45 }],
      }, actorBuyer);

      if (Number(testQuote2.landedCost) !== 55700) {
        throw new Error(`Expected Quote 2 Landed Cost 55700, got ${testQuote2.landedCost}`);
      }

      // Quote 2 should now be marked lowest
      const reloadedQuote2 = await prisma.purchaseQuotation.findUnique({ where: { id: testQuote2.id } });
      if (!reloadedQuote2.isLowestLandedCost) throw new Error('Quote 2 was not flagged as lowest landed cost');
    });

    // TEST 6: Quotation Comparison Matrix & Minimum 2 Comparable Quotes Rule
    await test('6. Quotation comparison matrix and non-lowest selection justification rule', async () => {
      const comparison = await purchaseService.compareQuotations(companyA, testPR.id);
      if (comparison.quotationCount !== 2) throw new Error(`Expected 2 quotes in comparison, got ${comparison.quotationCount}`);
      if (comparison.isMinimumMet !== true) throw new Error('Expected isMinimumMet to be true');

      // Select Non-Lowest Vendor without written justification should fail
      let rejectedNoJustification = false;
      try {
        await purchaseService.selectQuotation(companyA, testQuote1.id, { nonLowestJustification: '' }, actorBuyer);
      } catch (err) {
        rejectedNoJustification = true;
      }
      if (!rejectedNoJustification) throw new Error('Selecting non-lowest vendor without justification must be rejected');

      // Select Non-Lowest Vendor WITH written justification
      const selected = await purchaseService.selectQuotation(companyA, testQuote1.id, {
        nonLowestJustification: 'Vendor 1 has proven export-grade puncture resistance and ISO 9001 certified batch testing',
      }, actorBuyer);

      if (selected.status !== 'SELECTED') throw new Error(`Expected status SELECTED, got ${selected.status}`);
      testQuote1 = selected;
    });

    // TEST 7: Single quote exception approval requirement
    await test('7. Single quote exception approval workflow when < 2 quotes exist', async () => {
      singlePR = await purchaseService.createRequest(companyA, {
        department: 'Speciality',
        priority: 'MEDIUM',
        purpose: 'Proprietary ink batch',
        items: [{ sku: 'SPEC-INK-01', name: 'UV Fluorescent Ink', qty: 20, uom: 'LITRE' }],
      }, actorBuyer);
      await purchaseService.approveRequest(companyA, singlePR.id, actorManager);

      singleQuote = await purchaseService.createQuotation(companyA, {
        requestId: singlePR.id,
        vendorId: testVendor1.id,
        items: [{ sku: 'SPEC-INK-01', unitRate: 1200 }],
      }, actorBuyer);

      // Attempting to select without 2 quotes or exception must fail
      let blockedWithoutException = false;
      try {
        await purchaseService.selectQuotation(companyA, singleQuote.id, {}, actorBuyer);
      } catch (err) {
        blockedWithoutException = true;
      }
      if (!blockedWithoutException) throw new Error('Single quote selection must be blocked without manager exception');

      // Request and grant manager exception
      await purchaseService.requestQuoteException(companyA, singlePR.id, {
        reason: 'Single source OEM authorized chemical formulator in India',
      }, actorManager);

      // Selection must now succeed
      const allowedSelection = await purchaseService.selectQuotation(companyA, singleQuote.id, {}, actorBuyer);
      if (allowedSelection.status !== 'SELECTED') throw new Error('Selection failed after exception was granted');
    });

    // TEST 8: Purchase Order Creation with Immutable V1 and Commercial Approval
    await test('8. Purchase Order creation linked to selected quote with V1 snapshot and commercial approval', async () => {
      testPO = await purchaseService.createOrder(companyA, testQuote1.id, {
        expectedDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        deliveryAddress: 'Shree Nath Exports, Factory Unit 2, GIDC, Vadodara',
        transporterResponsibility: 'BUYER',
        specialInstructions: 'Palletized packaging with waterproof stretch wrap',
      }, actorBuyer);

      if (!testPO?.id) throw new Error('Failed to create purchase order');
      if (testPO.versionNumber !== 1) throw new Error(`Expected PO version 1, got ${testPO.versionNumber}`);

      // Verify immutable V1 snapshot
      const poV1 = await prisma.documentVersion.findFirst({
        where: { companyId: companyA, entityType: 'PURCHASE_ORDER', entityId: testPO.id, versionNumber: 1 },
      });
      if (!poV1) throw new Error('PO immutable V1 DocumentVersion snapshot was not recorded');

      // Commercial Approval
      const approvedPO = await purchaseService.approveOrder(companyA, testPO.id, actorManager);
      if (approvedPO.status !== 'ISSUED' && approvedPO.status !== 'APPROVED') {
        throw new Error(`Expected PO status ISSUED or APPROVED, got ${approvedPO.status}`);
      }
      if (!approvedPO.approvedAt) throw new Error('Expected approvedAt timestamp on approved PO');
      testPO = approvedPO;
    });

    // TEST 9: Artwork Proof & Dual Approval Workflow (Design vs Commercial)
    await test('9. Artwork Proof separate Design Approval (Design team) vs Commercial PO Approval', async () => {
      testProof = await purchaseService.createArtworkProof(companyA, {
        orderId: testPO.id,
        title: 'Corrugated Box Front/Back Branding Proof v1',
        buyerArtworkUrl: 'https://storage.snenet.in/artworks/box-front-v1.pdf',
        supplierProofUrl: 'https://storage.snenet.in/proofs/apex-proof-9012.pdf',
        comments: 'Check Pantone 286C color matching and barcode scannability',
      }, actorBuyer);

      if (!testProof?.id) throw new Error('Failed to upload artwork proof');
      if (testProof.designStatus !== 'PENDING') throw new Error(`Expected designStatus PENDING, got ${testProof.designStatus}`);
      if (testProof.commercialStatus !== 'PENDING') throw new Error(`Expected commercialStatus PENDING, got ${testProof.commercialStatus}`);

      // 1. Technical Design Review approved by Designer
      const designApproved = await purchaseService.reviewArtworkDesign(companyA, testProof.id, {
        decision: 'APPROVED',
        comments: 'Barcode verified at 100% scale and Pantone PMS 286C confirmed',
      }, actorDesigner);

      if (designApproved.designStatus !== 'APPROVED') throw new Error('Design approval failed');
      // Verify Commercial Approval is STILL PENDING (independent dual approval)
      if (designApproved.commercialStatus !== 'PENDING') throw new Error('Commercial status should still be PENDING');

      // 2. Commercial Review approved by Commercial Manager
      const commercialApproved = await purchaseService.reviewArtworkCommercial(companyA, testProof.id, {
        decision: 'APPROVED',
        comments: 'Standard contractual artwork terms accepted',
      }, actorManager);

      if (commercialApproved.commercialStatus !== 'APPROVED') throw new Error('Commercial approval failed');
      testProof = commercialApproved;
    });

    // TEST 10: Multiple Partial GRNs & Order Balance Calculation
    await test('10. Goods Receipt Notes with multiple partial receipts and order balance tracking', async () => {
      const sku = testPO.items[0].sku;

      // Partial GRN 1: 600 of 1000 ordered
      testGRN1 = await purchaseService.createReceipt(companyA, testPO.id, {
        warehouse: 'Main Raw Material Warehouse',
        vehicleNo: 'GJ-06-XX-1122',
        deliveryChallanNo: 'DC-APX-8801',
        carrierName: 'Gati Logistics',
        items: [
          { sku, receivedQty: 600, acceptedQty: 600, rejectedQty: 0, shortQty: 0, damagedQty: 0 },
        ],
        inspectionRemarks: 'Part shipment received in good condition',
      }, actorQC);

      if (testGRN1.acceptedQty !== 600) throw new Error(`Expected 600 accepted, got ${testGRN1.acceptedQty}`);

      // Verify PO status transitioned to PARTIALLY_RECEIVED
      const partialPO = await prisma.purchaseOrder.findUnique({ where: { id: testPO.id } });
      if (partialPO.status !== 'PARTIALLY_RECEIVED') throw new Error(`Expected PO status PARTIALLY_RECEIVED, got ${partialPO.status}`);
    });

    // TEST 11: Cumulative Over-Receipt Prevention (> 5% Tolerance)
    await test('11. Over-receipt validation prevents delivery exceeding 5% tolerance', async () => {
      const sku = testPO.items[0].sku;
      // Already received: 600. Max remaining with 5% tolerance: (1000 * 1.05) - 600 = 450.
      // Attempting to receive 600 more (total 1200 / 20% excess) must fail
      let overReceiptBlocked = false;
      try {
        await purchaseService.createReceipt(companyA, testPO.id, {
          warehouse: 'Main Raw Material Warehouse',
          deliveryChallanNo: 'DC-APX-EXCESS',
          items: [
            { sku, receivedQty: 600, acceptedQty: 600 },
          ],
        }, actorQC);
      } catch (err) {
        overReceiptBlocked = true;
      }
      if (!overReceiptBlocked) throw new Error('Over-receipt exceeding tolerance was not blocked');
    });

    // TEST 12: Quality Inspection Breakdown & Auto Deviation Creation
    await test('12. QC inspection with short/damaged/rejected materials routes to Quality Hold and auto-creates Deviation', async () => {
      const sku = testPO.items[0].sku;

      // Partial GRN 2: Remaining 400 received with QC issues:
      // Received: 400. Accepted: 350. Damaged: 30. Rejected: 10. Short: 10.
      testGRN2 = await purchaseService.createReceipt(companyA, testPO.id, {
        warehouse: 'Main Raw Material Warehouse',
        vehicleNo: 'GJ-06-XX-9900',
        deliveryChallanNo: 'DC-APX-8802',
        carrierName: 'Gati Logistics',
        items: [
          {
            sku,
            receivedQty: 400,
            acceptedQty: 350,
            rejectedQty: 10,
            damagedQty: 30,
            shortQty: 10,
            rejectionReason: 'Crushed edges and moisture damage during transit',
          },
        ],
        inspectionRemarks: 'Batch moisture above acceptable threshold; crushed cartons isolated',
      }, actorQC);

      if (testGRN2.acceptedQty !== 350) throw new Error(`Expected 350 accepted, got ${testGRN2.acceptedQty}`);
      if (testGRN2.rejectedQty !== 10) throw new Error(`Expected 10 rejected, got ${testGRN2.rejectedQty}`);
      if (testGRN2.damagedQty !== 30) throw new Error(`Expected 30 damaged, got ${testGRN2.damagedQty}`);
      if (testGRN2.shortQty !== 10) throw new Error(`Expected 10 short, got ${testGRN2.shortQty}`);

      // Verify auto-created PurchaseDeviation
      const deviation = await prisma.purchaseDeviation.findFirst({
        where: { companyId: companyA, receiptId: testGRN2.id },
      });
      if (!deviation) throw new Error('PurchaseDeviation was not automatically created for GRN QC discrepancies');
      if (deviation.resolutionStatus !== 'OPEN') throw new Error(`Expected deviation status OPEN, got ${deviation.resolutionStatus}`);
    });

    // TEST 13: Supplier Bill & FULL INVOICE PAYMENT HOLD on QC Discrepancy
    await test('13. Supplier bill placed on FULL PAYMENT HOLD due to GRN QC discrepancy', async () => {
      testBill = await purchaseService.createBill(companyA, testPO.id, {
        vendorInvoiceNo: 'INV-APX-2026-908',
        invoiceDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        taxableAmount: 50000,
        taxAmount: 9000,
        otherCharges: 3500,
      }, actorBuyer);

      if (!testBill?.id) throw new Error('Failed to create supplier bill');
      if (!testBill.paymentHold) throw new Error('Supplier bill MUST be placed on FULL PAYMENT HOLD when GRN has QC discrepancies');
      if (testBill.status !== 'PAYMENT_HOLD') throw new Error(`Expected bill status PAYMENT_HOLD, got ${testBill.status}`);
    });

    // TEST 14: Strict Payment Block while on Payment Hold
    await test('14. Strict payment block: paying bill on hold throws HTTP 400 error', async () => {
      let paymentBlocked = false;
      try {
        await purchaseService.markBillPaid(companyA, testBill.id, { paymentReference: 'UTR-TEST-0001' }, actorBuyer);
      } catch (err) {
        if (err.message.includes('FULL PAYMENT HOLD')) paymentBlocked = true;
      }
      if (!paymentBlocked) throw new Error('Paying bill on hold must be strictly blocked');
    });

    // TEST 15: Authorized Hold Release and Successful Payment
    await test('15. Authorized hold release by manager allows subsequent payment release', async () => {
      // 1. Resolve deviation first
      const deviation = await prisma.purchaseDeviation.findFirst({
        where: { companyId: companyA, receiptId: testGRN2.id },
      });
      await purchaseService.resolveDeviation(companyA, deviation.id, {
        correctiveAction: 'Vendor issued Credit Note CN-APX-101 for damaged and short material',
        supplierResponse: 'Accepted carrier damage liability',
        resolutionStatus: 'RESOLVED',
      }, actorManager);

      // 2. Manager releases payment hold with justification
      const releasedBill = await purchaseService.releasePaymentHold(companyA, testBill.id, {
        reason: 'Credit Note CN-APX-101 received and verified for damaged 30 and rejected 10 boxes',
      }, actorManager);

      if (releasedBill.paymentHold !== false) throw new Error('Payment hold was not cleared');
      if (releasedBill.status !== 'UNPAID') throw new Error(`Expected status UNPAID after hold release, got ${releasedBill.status}`);

      // 3. Payment release now succeeds
      const paidBill = await purchaseService.markBillPaid(companyA, testBill.id, {
        paymentReference: 'UTR-HDFC-992817263',
      }, actorBuyer);

      if (paidBill.status !== 'PAID') throw new Error(`Expected bill status PAID, got ${paidBill.status}`);
    });

    // TEST 16: Multi-Tenant Boundary Isolation
    await test('16. Multi-tenant isolation: Tenant B cannot access Tenant A purchase orders or bills', async () => {
      // Attempting to fetch Tenant A's PO from Tenant B
      let orderIsolated = false;
      try {
        await purchaseService.getOrder(companyB, testPO.id);
      } catch (err) {
        orderIsolated = true;
      }
      if (!orderIsolated) throw new Error('Tenant B was able to access Tenant A purchase order');

      // Attempting to release hold on Tenant A's bill from Tenant B
      let billIsolated = false;
      try {
        await purchaseService.releasePaymentHold(companyB, testBill.id, { reason: 'Unauthorized' }, actorManager);
      } catch (err) {
        billIsolated = true;
      }
      if (!billIsolated) throw new Error('Tenant B was able to modify Tenant A purchase bill');
    });

  } finally {
    // Teardown test artifacts in strict foreign key order
    console.log('\nCleaning up Phase 3 test data...');
    try {
      if (testBill?.id) await prisma.purchaseBill.deleteMany({ where: { id: testBill.id } });
      if (testPO?.id) {
        await prisma.purchaseDeviation.deleteMany({ where: { orderId: testPO.id } });
        await prisma.inventoryMovement.deleteMany({ where: { companyId: companyA, sku: testPR?.items?.[0]?.sku } });
        await prisma.purchaseReceipt.deleteMany({ where: { orderId: testPO.id } });
        await prisma.purchaseArtworkProof.deleteMany({ where: { orderId: testPO.id } });
        await prisma.purchaseOrder.deleteMany({ where: { id: testPO.id } });
      }
      const quoteIds = [testQuote1?.id, testQuote2?.id, singleQuote?.id].filter(Boolean);
      if (quoteIds.length > 0) {
        await prisma.purchaseQuotation.deleteMany({ where: { id: { in: quoteIds } } });
      }
      const prIds = [testPR?.id, singlePR?.id].filter(Boolean);
      if (prIds.length > 0) {
        await prisma.purchaseRequest.deleteMany({ where: { id: { in: prIds } } });
      }
      const vendorIds = [testVendor1?.id, testVendor2?.id].filter(Boolean);
      if (vendorIds.length > 0) {
        await prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
      }
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`Phase 3 Purchase & Vendor Suite: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) throw new Error(`${failed} tests failed in Phase 3 Purchase & Vendor flow.`);
}

if (process.argv[1] && process.argv[1].includes('phase3_purchase_vendor.test.js')) {
  runPhase3PurchaseVendorTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
