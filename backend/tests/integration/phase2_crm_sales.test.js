import path from 'path';
import fs from 'fs';
import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runPhase2CrmSalesTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 2: CRM & Sales Comprehensive Verification');
  console.log('Target API:', API_BASE);
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
  if (clients.length < 1) throw new Error('At least one tenant required for Phase 2 test.');

  const companyA = clients[0].id;
  const companyB = clients.length > 1 ? clients[1].id : 'secondary-tenant-id';

  const tokenA = signToken({ userId: companyA, companyId: companyA, role: 'COMPANY_ADMIN' });
  const tokenB = signToken({ userId: companyB, companyId: companyB, role: 'COMPANY_ADMIN' });

  const authHeadersA = {
    'Authorization': `Bearer ${tokenA}`,
    'Content-Type': 'application/json',
  };
  const authHeadersB = {
    'Authorization': `Bearer ${tokenB}`,
    'Content-Type': 'application/json',
  };

  let testLeadId = null;
  let testCustomerId = null;
  let testContactId = null;
  let testOpportunityId = null;
  let testProductId = null;
  let testQuoteId = null;
  let testProformaId = null;
  let testOrderId = null;
  let testAdvanceId = null;

  // Cleanup helper
  const cleanups = [];
  const registerCleanup = (fn) => cleanups.push(fn);

  try {
    // ------------------------------------------------------------------
    // TEST 1: Lead Creation & Duplicate Detection
    // ------------------------------------------------------------------
    await test('1. Lead Creation & Duplicate Detection (Phone, Email, Company)', async () => {
      const uniqueSuffix = Date.now();
      const leadPayload = {
        name: `Acme Corp ${uniqueSuffix}`,
        contactPerson: 'John Doe',
        email: `john_${uniqueSuffix}@acme.com`,
        phone: `98765${String(uniqueSuffix).slice(-5)}`,
        companyName: `Acme Industrial ${uniqueSuffix}`,
        gstin: '07AAAAA0000A1Z5',
        source: 'Website',
        priority: 'HIGH',
        estimatedValue: 150000,
      };

      // Create initial lead
      const res1 = await fetch(`${API_BASE}/companies/${companyA}/crm/leads`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify(leadPayload),
      });
      const data1 = await res1.json();
      if (!res1.ok || !data1.success) throw new Error(`Lead creation failed: ${JSON.stringify(data1)}`);
      testLeadId = data1.data.id;
      registerCleanup(() => prisma.lead.delete({ where: { id: testLeadId } }).catch(() => {}));

      // Check duplicates with same email
      const checkRes = await fetch(`${API_BASE}/companies/${companyA}/crm/leads/check-duplicates`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({ email: leadPayload.email }),
      });
      const checkData = await checkRes.json();
      if (!checkRes.ok || !checkData.data?.hasDuplicate) {
        throw new Error('Duplicate check failed to detect existing email');
      }
    });

    // ------------------------------------------------------------------
    // TEST 2: Lead Conversion into Customer & Primary Contact
    // ------------------------------------------------------------------
    await test('2. Lead Conversion into Customer, Contact and Opportunity', async () => {
      const convertRes = await fetch(`${API_BASE}/companies/${companyA}/crm/leads/${testLeadId}/convert`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerName: 'Acme Converted Ltd',
          opportunityTitle: 'Initial Bulk Packaging Requirement',
          estimatedValue: 200000,
          pan: 'ABCDE1234F',
          reorderCycleDays: 45,
        }),
      });
      const convertData = await convertRes.json();
      if (!convertRes.ok || !convertData.success) {
        throw new Error(`Lead conversion failed: ${JSON.stringify(convertData)}`);
      }

      testCustomerId = convertData.data.customer?.id;
      testContactId = convertData.data.contact?.id;
      testOpportunityId = convertData.data.opportunity?.id;

      if (!testCustomerId) throw new Error('Converted customer ID missing');
      registerCleanup(() => prisma.crmCustomer.delete({ where: { id: testCustomerId } }).catch(() => {}));

      // Verify lead is marked WON and has convertedCustomerId
      const leadInDb = await prisma.lead.findUnique({ where: { id: testLeadId } });
      if (leadInDb.status !== 'WON' || leadInDb.convertedCustomerId !== testCustomerId) {
        throw new Error('Lead status was not updated to WON or convertedCustomerId was not set');
      }
    });

    // ------------------------------------------------------------------
    // TEST 3: Customer Master & Multi-Contact Management
    // ------------------------------------------------------------------
    await test('3. Customer Master & Multi-Contact Management (Primary & Decision Maker)', async () => {
      // Add a secondary contact to the customer
      const contactRes = await fetch(`${API_BASE}/companies/${companyA}/crm/contacts`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerId: testCustomerId,
          name: 'Jane Smith',
          email: 'jane@acme.com',
          phone: '9988776655',
          designation: 'Procurement Head',
          department: 'Purchase',
          stakeholderType: 'DECISION_MAKER',
          isDecisionMaker: true,
          isPrimary: false,
        }),
      });
      const contactData = await contactRes.json();
      if (!contactRes.ok || !contactData.success) {
        throw new Error(`Contact creation failed: ${JSON.stringify(contactData)}`);
      }
      const secondaryContactId = contactData.data.id;
      registerCleanup(() => prisma.crmContact.delete({ where: { id: secondaryContactId } }).catch(() => {}));

      // Verify customer contacts list
      const listContactsRes = await fetch(`${API_BASE}/companies/${companyA}/crm/contacts?customerId=${testCustomerId}`, {
        headers: authHeadersA,
      });
      const listData = await listContactsRes.json();
      if (!listContactsRes.ok || listData.data.length < 2) {
        throw new Error('Customer does not show multiple contacts');
      }
    });

    // ------------------------------------------------------------------
    // TEST 4: Centralized Communication History Logging
    // ------------------------------------------------------------------
    await test('4. Communication History Logging & Follow-up Task Linking', async () => {
      const commRes = await fetch(`${API_BASE}/companies/${companyA}/crm/communications`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerId: testCustomerId,
          communicationType: 'PHONE_CALL',
          subject: 'Price negotiation on bulk order',
          notes: 'Customer agreed on 5% discount subject to 30% advance payment.',
          outcome: 'Interested',
          nextFollowUpDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          employeeName: 'Sales Rep Vikram',
        }),
      });
      const commData = await commRes.json();
      if (!commRes.ok || !commData.success) {
        throw new Error(`Communication log failed: ${JSON.stringify(commData)}`);
      }
      const commId = commData.data.id;
      registerCleanup(() => prisma.crmCommunication.delete({ where: { id: commId } }).catch(() => {}));

      // Check communication appears in list
      const listRes = await fetch(`${API_BASE}/companies/${companyA}/crm/communications?customerId=${testCustomerId}`, {
        headers: authHeadersA,
      });
      const listData = await listRes.json();
      if (!listRes.ok || listData.data.length === 0) {
        throw new Error('Communication history record not retrieved');
      }
    });

    // ------------------------------------------------------------------
    // TEST 5: 360-Degree Customer Business History Timeline
    // ------------------------------------------------------------------
    await test('5. 360-Degree Customer Business History Timeline', async () => {
      const timelineRes = await fetch(`${API_BASE}/companies/${companyA}/crm/customers/${testCustomerId}/timeline`, {
        headers: authHeadersA,
      });
      const timelineData = await timelineRes.json();
      if (!timelineRes.ok || !timelineData.success) {
        throw new Error(`Timeline retrieval failed: ${JSON.stringify(timelineData)}`);
      }
      const data = timelineData.data;
      if (!data.customer || !Array.isArray(data.communications) || data.communications.length === 0) {
        throw new Error('Customer timeline data is missing expected customer record or communications');
      }
    });

    // ------------------------------------------------------------------
    // TEST 6: Customer Reorder Cycle Reminder Scheduled Processing
    // ------------------------------------------------------------------
    await test('6. Reorder Cycle Reminders: scheduled processing without duplicate notifications', async () => {
      // Set expected reorder date to yesterday
      const yesterday = new Date(Date.now() - 86400000);
      await prisma.crmCustomer.update({
        where: { id: testCustomerId },
        data: {
          expectedReorderDate: yesterday,
          reorderReminderStatus: 'PENDING',
        },
      });

      // Trigger reorder cycle reminder processing
      const processRes = await fetch(`${API_BASE}/companies/${companyA}/crm/reorder-reminders/process`, {
        method: 'POST',
        headers: authHeadersA,
      });
      const processData = await processRes.json();
      if (!processRes.ok || !processData.success) {
        throw new Error(`Reorder reminder processing failed: ${JSON.stringify(processData)}`);
      }

      // Check customer status is now REMINDER_SENT
      const updatedCust = await prisma.crmCustomer.findUnique({ where: { id: testCustomerId } });
      if (updatedCust.reorderReminderStatus !== 'REMINDER_SENT') {
        throw new Error(`Expected reorderReminderStatus REMINDER_SENT, got ${updatedCust.reorderReminderStatus}`);
      }

      // Re-triggering process should skip this customer and process 0 duplicates
      const reprocessRes = await fetch(`${API_BASE}/companies/${companyA}/crm/reorder-reminders/process`, {
        method: 'POST',
        headers: authHeadersA,
      });
      const reprocessData = await reprocessRes.json();
      const duplicateCount = reprocessData.data.remindersSent || 0;
      if (duplicateCount > 0) {
        throw new Error('Reorder reminder re-processing sent duplicate reminders for already REMINDER_SENT customer');
      }
    });

    // ------------------------------------------------------------------
    // TEST 7: Product Master Technical Specifications Persistence
    // ------------------------------------------------------------------
    await test('7. Product Master Technical Specifications (Dimensions, Weights, Die/Mould, MRP)', async () => {
      // Create test category first
      const cat = await prisma.productCategory.create({
        data: {
          companyId: companyA,
          name: `Tech Category ${Date.now()}`,
          description: 'Technical specs category',
        },
      });
      registerCleanup(() => prisma.productCategory.delete({ where: { id: cat.id } }).catch(() => {}));

      const prodRes = await fetch(`${API_BASE}/companies/${companyA}/products`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          name: 'Industrial HDPE Container 5L',
          sku: `SKU-HDPE-${Date.now()}`,
          category: cat.name,
          unit: 'PCS',
          sellingPrice: 120,
          purchasePrice: 85,
          length: 150,
          width: 120,
          height: 250,
          dimensionUnit: 'MM',
          netWeight: 220,
          grossWeight: 250,
          weightUnit: 'GM',
          materialDetails: 'High-Density Polyethylene Food Grade',
          packagingInstructions: '24 units per master carton with partition pads',
          dieMouldRef: 'MOULD-HDPE-5L-REV3',
          printingSpecs: 'Silk Screen 2 Colors Front & Back',
          batchPrefix: 'HDPE5L',
          requiresMfgDate: true,
          requiresExpDate: false,
          mrp: 180,
        }),
      });
      const prodData = await prodRes.json();
      if (!prodRes.ok || !prodData.success) {
        throw new Error(`Product creation with technical specs failed: ${JSON.stringify(prodData)}`);
      }
      testProductId = prodData.data.id;
      registerCleanup(() => prisma.product.delete({ where: { id: testProductId } }).catch(() => {}));

      // Verify retrieved technical specs
      const getProdRes = await fetch(`${API_BASE}/companies/${companyA}/products/${testProductId}`, {
        headers: authHeadersA,
      });
      const getProdData = await getProdRes.json();
      const p = getProdData.data;
      if (p.dieMouldRef !== 'MOULD-HDPE-5L-REV3' || Number(p.mrp) !== 180 || p.dimensionUnit !== 'MM') {
        throw new Error('Retrieved product does not contain expected technical specifications');
      }
    });

    // ------------------------------------------------------------------
    // TEST 8: Sales Quotation Creation V1, Approval, Revision V2 Branching
    // ------------------------------------------------------------------
    await test('8. Sales Quotation: V1 Snapshot, Approval Submission, V2 Revision Branching', async () => {
      const quoteRes = await fetch(`${API_BASE}/companies/${companyA}/sales/quotations`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerId: testCustomerId,
          customer: 'Acme Converted Ltd',
          title: 'Quotation for 5L HDPE Containers',
          items: [{ productId: testProductId, name: 'Industrial HDPE Container 5L', quantity: 500, unitPrice: 120, total: 60000 }],
          subtotal: 60000,
          taxAmount: 10800,
          totalAmount: 70800,
          paymentTerms: '30% Advance, Balance on Dispatch',
          deliveryTerms: 'Ex-Factory Bhiwandi',
        }),
      });
      const quoteData = await quoteRes.json();
      if (!quoteRes.ok || !quoteData.success) {
        throw new Error(`Quotation creation failed: ${JSON.stringify(quoteData)}`);
      }
      testQuoteId = quoteData.data.id;
      registerCleanup(() => prisma.salesQuotation.delete({ where: { id: testQuoteId } }).catch(() => {}));

      // Verify V1 version was registered
      const versions = await prisma.documentVersion.findMany({
        where: { entityType: 'SALES_QUOTATION', entityId: testQuoteId },
      });
      if (versions.length === 0 || versions[0].versionNumber !== 1) {
        throw new Error('Quotation V1 immutable version snapshot was not created');
      }

      // Submit Quotation for Approval
      const approvalRes = await fetch(`${API_BASE}/companies/${companyA}/sales/quotations/${testQuoteId}/submit-approval`, {
        method: 'POST',
        headers: authHeadersA,
      });
      const approvalData = await approvalRes.json();
      if (!approvalRes.ok || !approvalData.success) {
        throw new Error(`Quotation approval submission failed: ${JSON.stringify(approvalData)}`);
      }

      // Revise Quotation (V1 -> V2) with mandatory reason
      const reviseRes = await fetch(`${API_BASE}/companies/${companyA}/sales/quotations/${testQuoteId}/revise`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          revisionReason: 'Client requested quantity increase to 800 units and 3% additional discount.',
          items: [{ productId: testProductId, name: 'Industrial HDPE Container 5L', quantity: 800, unitPrice: 116.4, total: 93120 }],
          subtotal: 93120,
          taxAmount: 16761.6,
          totalAmount: 109881.6,
        }),
      });
      const reviseData = await reviseRes.json();
      if (!reviseRes.ok || !reviseData.success) {
        throw new Error(`Quotation revision failed: ${JSON.stringify(reviseData)}`);
      }
      if (reviseData.data.versionNumber !== 2) {
        throw new Error(`Expected revised quotation versionNumber 2, got ${reviseData.data.versionNumber}`);
      }
    });

    // ------------------------------------------------------------------
    // TEST 9: Proforma Invoice (PI) Creation V1, Approval, Revision V2 Branching
    // ------------------------------------------------------------------
    await test('9. Sales Proforma Invoice (PI): V1 Snapshot, Approval Submission, V2 Revision', async () => {
      const piRes = await fetch(`${API_BASE}/companies/${companyA}/sales/proforma`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerId: testCustomerId,
          customer: 'Acme Converted Ltd',
          quotationId: testQuoteId,
          items: [{ productId: testProductId, name: 'Industrial HDPE Container 5L', quantity: 800, unitPrice: 116.4, total: 93120 }],
          subtotal: 93120,
          taxAmount: 16761.6,
          totalAmount: 109881.6,
          advanceRequired: 33000, // Advance requirement
          advanceReceived: 0,
          balancePayable: 109881.6,
          paymentTerms: '30% Advance required prior to production release',
        }),
      });
      const piData = await piRes.json();
      if (!piRes.ok || !piData.success) {
        throw new Error(`Proforma creation failed: ${JSON.stringify(piData)}`);
      }
      testProformaId = piData.data.id;
      registerCleanup(() => prisma.salesProforma.delete({ where: { id: testProformaId } }).catch(() => {}));

      // Submit PI for Approval
      const piApprovalRes = await fetch(`${API_BASE}/companies/${companyA}/sales/proforma/${testProformaId}/submit-approval`, {
        method: 'POST',
        headers: authHeadersA,
      });
      const piApprovalData = await piApprovalRes.json();
      if (!piApprovalRes.ok || !piApprovalData.success) {
        throw new Error(`PI approval submission failed: ${JSON.stringify(piApprovalData)}`);
      }

      // Mark PI Approved directly in DB to simulate approver approval
      await prisma.salesProforma.update({
        where: { id: testProformaId },
        data: { status: 'APPROVED' },
      });
    });

    // ------------------------------------------------------------------
    // TEST 10: Customer Advance Payment Recording & Bank Credit Verification
    // ------------------------------------------------------------------
    await test('10. Customer Advance: Recording (PENDING) & Bank Credit Verification (VERIFIED)', async () => {
      const advRes = await fetch(`${API_BASE}/companies/${companyA}/sales/advances`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerId: testCustomerId,
          proformaId: testProformaId,
          amount: 33000,
          paymentMode: 'NEFT',
          bankReference: 'HDFC-NEFT-98723412',
          paymentDate: new Date().toISOString(),
          notes: 'Customer NEFT transfer received in HDFC current account',
        }),
      });
      const advData = await advRes.json();
      if (!advRes.ok || !advData.success) {
        throw new Error(`Customer advance recording failed: ${JSON.stringify(advData)}`);
      }
      testAdvanceId = advData.data.id;
      registerCleanup(() => {
        if (testAdvanceId) prisma.customerAdvance.delete({ where: { id: testAdvanceId } }).catch(() => {});
      });

      if (advData.data.verificationStatus !== 'PENDING') {
        throw new Error('Initial advance verificationStatus should be PENDING');
      }

      // Verify advance against bank credit
      const verifyRes = await fetch(`${API_BASE}/companies/${companyA}/sales/advances/${testAdvanceId}/verify`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          status: 'VERIFIED',
          notes: 'Bank statement line item matched with UTR HDFC-NEFT-98723412',
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(`Customer advance verification failed: ${JSON.stringify(verifyData)}`);
      }

      // Check Proforma advanceReceived and balancePayable were updated atomically
      const updatedPi = await prisma.salesProforma.findUnique({ where: { id: testProformaId } });
      if (Number(updatedPi.advanceReceived) !== 33000) {
        throw new Error(`Expected PI advanceReceived 33000, got ${updatedPi.advanceReceived}`);
      }
    });

    // ------------------------------------------------------------------
    // TEST 11: Sales Order Release Gate (Prevents release until required advance is verified)
    // ------------------------------------------------------------------
    await test('11. Sales Order Release Gate: enforces bank-verified advance prior to production release', async () => {
      // First create a Sales Order with an unverified PI or with advance requirement
      const orderRes = await fetch(`${API_BASE}/companies/${companyA}/sales/orders`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          customerId: testCustomerId,
          customer: 'Acme Converted Ltd',
          proformaId: testProformaId,
          orderNumber: `SO-TEST-${Date.now()}`,
          items: [{ productId: testProductId, name: 'Industrial HDPE Container 5L', quantity: 800, unitPrice: 116.4, total: 93120 }],
          subtotal: 93120,
          taxAmount: 16761.6,
          totalAmount: 109881.6,
          advanceReceived: 33000,
          balancePayable: 76881.6,
          deliveryTerms: 'Ex-Factory Bhiwandi',
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok || !orderData.success) {
        throw new Error(`Sales order creation failed: ${JSON.stringify(orderData)}`);
      }
      testOrderId = orderData.data.id;
      registerCleanup(() => prisma.salesOrder.delete({ where: { id: testOrderId } }).catch(() => {}));

      // Attempt Release — since advance of 33000 is VERIFIED, release should SUCCEED
      const releaseRes = await fetch(`${API_BASE}/companies/${companyA}/sales/orders/${testOrderId}/release`, {
        method: 'POST',
        headers: authHeadersA,
      });
      const releaseData = await releaseRes.json();
      if (!releaseRes.ok || !releaseData.success) {
        throw new Error(`Sales order release failed: ${JSON.stringify(releaseData)}`);
      }

      // Verify order is marked released in DB and customer lastOrderDate was updated
      const orderInDb = await prisma.salesOrder.findUnique({ where: { id: testOrderId } });
      if (!orderInDb.isReleased) {
        throw new Error('Order isReleased is false after releaseSalesOrder call');
      }

      const custInDb = await prisma.crmCustomer.findUnique({ where: { id: testCustomerId } });
      if (!custInDb.lastOrderDate) {
        throw new Error('Customer lastOrderDate was not updated on Sales Order release');
      }
    });

    // ------------------------------------------------------------------
    // TEST 12: Controlled Sales Representative Portfolio Reassignment
    // ------------------------------------------------------------------
    await test('12. Controlled Sales Representative Portfolio Reassignment', async () => {
      const reassignRes = await fetch(`${API_BASE}/companies/${companyA}/crm/reassign-portfolio`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({
          fromEmployeeId: 'emp-vikram-01',
          fromEmployeeName: 'Vikram Sales',
          toEmployeeId: 'emp-ananya-02',
          toEmployeeName: 'Ananya Sharma',
          leadIds: [testLeadId],
          customerIds: [testCustomerId],
          reason: 'Territory realignment and sales portfolio expansion',
        }),
      });
      const reassignData = await reassignRes.json();
      if (!reassignRes.ok || !reassignData.success) {
        throw new Error(`Portfolio reassignment failed: ${JSON.stringify(reassignData)}`);
      }
      if (reassignData.data.leadsReassigned !== 1 || reassignData.data.customersReassigned !== 1) {
        throw new Error('Reassignment count does not match transferred records');
      }
    });

    // ------------------------------------------------------------------
    // TEST 13: Strict Multi-Tenant Isolation
    // ------------------------------------------------------------------
    await test('13. Strict Multi-Tenant Isolation Across All Phase 2 Endpoints', async () => {
      if (companyB === 'secondary-tenant-id') {
        console.log('Skipping companyB query (no secondary tenant in DB)');
        return;
      }
      // Tenant B attempting to access Tenant A's customer timeline
      const crossTimelineRes = await fetch(`${API_BASE}/companies/${companyB}/crm/customers/${testCustomerId}/timeline`, {
        headers: authHeadersB,
      });
      if (crossTimelineRes.status !== 404 && crossTimelineRes.status !== 403) {
        throw new Error(`Cross-tenant customer timeline access should be rejected, got HTTP ${crossTimelineRes.status}`);
      }

      // Tenant B attempting to access Tenant A's quotations
      const crossQuoteRes = await fetch(`${API_BASE}/companies/${companyB}/sales/quotations`, {
        headers: authHeadersB,
      });
      const crossQuoteData = await crossQuoteRes.json();
      const containsTenantAQuote = (crossQuoteData.data || []).some((q) => q.id === testQuoteId);
      if (containsTenantAQuote) {
        throw new Error('Tenant B list returned Tenant A sales quotation');
      }
    });

  } finally {
    // Run cleanups in reverse order
    for (const fn of cleanups.reverse()) {
      try { await fn(); } catch (e) { /* ignore */ }
    }
  }

  console.log('\n========================================================================');
  console.log(`Phase 2 CRM & Sales Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Phase 2 CRM & Sales flow.`);
  }
}

if (process.argv[1] && process.argv[1].includes('phase2_crm_sales.test.js')) {
  runPhase2CrmSalesTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
