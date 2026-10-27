import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runCrmSalesFlowTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — End-to-End CRM & Sales Integration Test Suite');
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

  // 1. Identify or setup test tenant
  const client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!client) throw new Error('No client found for integration test.');

  const companyId = client.id;
  const companyToken = signToken({
    userId: companyId,
    companyId,
    role: 'COMPANY_ADMIN',
    type: 'COMPANY_USER',
  });
  const headers = {
    Authorization: `Bearer ${companyToken}`,
    'Content-Type': 'application/json',
  };

  // Cross-tenant token for testing tenant isolation
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';
  const otherCompanyToken = signToken({
    userId: otherCompanyId,
    companyId: otherCompanyId,
    role: 'COMPANY_ADMIN',
    type: 'COMPANY_USER',
  });
  const otherHeaders = {
    Authorization: `Bearer ${otherCompanyToken}`,
    'Content-Type': 'application/json',
  };

  let testLeadId = null;
  let createdCustomerId = null;
  let createdContactId = null;
  let testOpportunityId = null;
  let testQuotationId = null;
  let createdOrderId = null;

  // STEP 1: Create a Lead
  await test('Step 1: Manual Lead Creation with valid inputs', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Vikram Malhotra',
        company: 'Malhotra Infotech Ltd',
        email: `vikram_${Date.now()}@malhotra.com`,
        phone: '9876543210',
        source: 'Manual',
        value: '750000',
        requirements: 'Requires 25 enterprise desktop workstations.',
        assignedTo: 'Karan',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Lead creation failed: ${JSON.stringify(json)}`);
    }
    testLeadId = json.data.id;
  });

  // STEP 2: Qualify the Lead
  await test('Step 2: Update Lead Status to QUALIFIED', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/leads/${testLeadId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'QUALIFIED' }),
    });
    const json = await res.json();
    if (!json.success || json.data?.status !== 'QUALIFIED') {
      throw new Error(`Lead qualification failed: ${JSON.stringify(json)}`);
    }
  });

  // STEP 3: Convert Lead to Customer (Create New Customer mode)
  await test('Step 3: Convert Lead into New Customer and mark Lead WON', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/leads/${testLeadId}/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        companyName: 'Malhotra Infotech Ltd',
        contactPerson: 'Vikram Malhotra',
        email: `vikram_${Date.now()}@malhotra.com`,
        phone: '9876543210',
        industry: 'Technology & IT',
        requirements: 'Requires 25 enterprise desktop workstations.',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.customer?.id || json.data?.lead?.status !== 'WON') {
      throw new Error(`Lead conversion failed: ${JSON.stringify(json)}`);
    }
    createdCustomerId = json.data.customer.id;
  });

  // STEP 4: Prevent Duplicate Customer on Lead Conversion (Link Existing Customer mode)
  await test('Step 4: Convert another Lead linking to existingCustomerId without duplicate customer', async () => {
    // Create second lead
    const lead2Res = await fetch(`${API_BASE}/companies/${companyId}/crm/leads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Rohan Malhotra',
        company: 'Malhotra Infotech Ltd',
        email: `rohan_${Date.now()}@malhotra.com`,
        phone: '9876543211',
      }),
    });
    const lead2Json = await lead2Res.json();
    const lead2Id = lead2Json.data.id;

    // Convert with existingCustomerId
    const convertRes = await fetch(`${API_BASE}/companies/${companyId}/crm/leads/${lead2Id}/convert`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        existingCustomerId: createdCustomerId,
      }),
    });
    const convertJson = await convertRes.json();
    if (!convertJson.success || convertJson.data?.customer?.id !== createdCustomerId) {
      throw new Error(`Linking existing customer failed: ${JSON.stringify(convertJson)}`);
    }
  });

  // STEP 5: Create and associate a Contact
  await test('Step 5: Create Contact attached to Customer', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/contacts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Vikram Malhotra',
        companyName: 'Malhotra Infotech Ltd',
        email: `vikram_${Date.now()}@malhotra.com`,
        phone: '9876543210',
        designation: 'Managing Director',
        isPrimary: true,
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Contact creation failed: ${JSON.stringify(json)}`);
    }
    createdContactId = json.data.id;
  });

  // STEP 6: Create Opportunity linked to Customer
  await test('Step 6: Create Opportunity linked to Customer', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/opportunities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: '25x Enterprise Workstations Procurement',
        companyName: 'Malhotra Infotech Ltd',
        contactPerson: 'Vikram Malhotra',
        value: '750000',
        probability: '25%',
        stage: 'DISCOVERY',
        expectedCloseDate: '2026-11-30',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Opportunity creation failed: ${JSON.stringify(json)}`);
    }
    testOpportunityId = json.data.id;
  });

  // STEP 7: Opportunity Stage validation — Mandatory Loss Reason on LOST
  await test('Step 7: Opportunity Stage validation enforces lossReason on LOST', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/opportunities/${testOpportunityId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ stage: 'LOST' }), // Missing lossReason
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for missing lossReason, received ${res.status}`);
    }
  });

  // STEP 8: Create Quotation associated with Opportunity
  await test('Step 8: Create Quotation auto-advances Opportunity stage to PROPOSAL', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sales/quotations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: 'Malhotra Infotech Ltd',
        title: 'Quotation for 25x Enterprise Workstations',
        opportunityId: testOpportunityId,
        items: [
          { item: 'Dell OptiPlex 7090 Desktop', qty: 25, rate: 30000, gst: 18, total: 885000 },
        ],
        amount: 885000,
        notes: 'Delivery within 10 days. 1 year onsite warranty included.',
        validUntil: '2026-12-15',
        status: 'SENT',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Quotation creation failed: ${JSON.stringify(json)}`);
    }
    testQuotationId = json.data.id;

    // Verify opportunity advanced to PROPOSAL
    const opp = await prisma.crmOpportunity.findUnique({ where: { id: testOpportunityId } });
    if (opp.stage !== 'PROPOSAL') {
      throw new Error(`Expected Opportunity stage PROPOSAL, got ${opp.stage}`);
    }
  });

  // STEP 9: Generate Proforma Invoice from Quotation
  await test('Step 9: Issue Proforma Invoice linked to Customer and Commercial Terms', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sales/proforma`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: 'Malhotra Infotech Ltd',
        title: 'PI - 25x Enterprise Workstations',
        quoteId: testQuotationId,
        amount: 885000,
        notes: 'Advance 50% payable on PI presentation.',
        validUntil: '2026-11-20',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Proforma issuance failed: ${JSON.stringify(json)}`);
    }
  });

  // STEP 10: Convert Quotation to Confirmed Sales Order atomically & mark Opportunity WON
  await test('Step 10: Convert Quotation to Sales Order atomically via transaction and mark Opportunity WON', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sales/quotations/${testQuotationId}/convert-to-order`, {
      method: 'POST',
      headers,
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Order conversion failed: ${JSON.stringify(json)}`);
    }
    createdOrderId = json.data.id;

    // Verify quote is ACCEPTED
    const quote = await prisma.salesQuotation.findUnique({ where: { id: testQuotationId } });
    if (quote.status !== 'ACCEPTED') {
      throw new Error(`Expected Quotation status ACCEPTED, got ${quote.status}`);
    }

    // Verify opportunity is WON
    const opp = await prisma.crmOpportunity.findUnique({ where: { id: testOpportunityId } });
    if (opp.stage !== 'WON') {
      throw new Error(`Expected Opportunity stage WON, got ${opp.stage}`);
    }
  });

  // STEP 10b: Duplicate quotation conversion must be strictly rejected
  await test('Step 10b: Duplicate conversion of already accepted Quotation is rejected with 400', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sales/quotations/${testQuotationId}/convert-to-order`, {
      method: 'POST',
      headers,
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for duplicate quotation conversion, got ${res.status}`);
    }
    const json = await res.json();
    if (!json.message?.toLowerCase().includes('already')) {
      throw new Error(`Expected duplicate conversion error message, got: ${json.message}`);
    }
  });

  // STEP 10c: Draft Sales Order creation does NOT mark Opportunity WON
  let draftOppId = null;
  let draftOrderId = null;
  await test('Step 10c: Draft Sales Order creation does NOT mark Opportunity as WON', async () => {
    // Create a new DISCOVERY opportunity
    const oppRes = await fetch(`${API_BASE}/companies/${companyId}/crm/opportunities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        companyName: 'Draft Commercials Private Limited',
        title: 'Draft Workstations Trial',
        value: '350000',
        stage: 'DISCOVERY',
        probability: '20%',
      }),
    });
    const oppJson = await oppRes.json();
    draftOppId = oppJson.data.id;

    // Create a DRAFT Sales Order
    const orderRes = await fetch(`${API_BASE}/companies/${companyId}/sales/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: 'Draft Commercials Private Limited',
        orderNo: `SO-DRAFT-${Date.now()}`,
        amount: 350000,
        status: 'DRAFT',
      }),
    });
    const orderJson = await orderRes.json();
    draftOrderId = orderJson.data.id;

    // Verify opportunity is still in DISCOVERY, NOT WON
    const oppCheck = await prisma.crmOpportunity.findUnique({ where: { id: draftOppId } });
    if (oppCheck.stage !== 'DISCOVERY') {
      throw new Error(`Expected Opportunity stage DISCOVERY, but was prematurely changed to ${oppCheck.stage}`);
    }
  });

  // STEP 10d: Invalid Sales Order status update is rejected with 400
  await test('Step 10d: Invalid Sales Order status transition is rejected with 400', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sales/orders/${draftOrderId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'INVALID_STATUS_FOO_BAR',
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected status 400 for invalid status transition, got ${res.status}`);
    }
  });

  // STEP 10e: Explicit Sales Order confirmation (APPROVED) transitions Opportunity to WON atomically
  await test('Step 10e: Confirmed order status update (APPROVED) transitions Opportunity to WON atomically', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/sales/orders/${draftOrderId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'APPROVED',
      }),
    });
    if (res.status !== 200) {
      throw new Error(`Expected status 200 for order confirmation, got ${res.status}`);
    }

    // Verify opportunity has now progressed to WON
    const oppCheck = await prisma.crmOpportunity.findUnique({ where: { id: draftOppId } });
    if (oppCheck.stage !== 'WON') {
      throw new Error(`Expected Opportunity stage WON after order approval, got ${oppCheck.stage}`);
    }

    // Clean up draft test records
    await prisma.salesOrder.deleteMany({ where: { id: draftOrderId } }).catch(() => null);
    await prisma.crmOpportunity.deleteMany({ where: { id: draftOppId } }).catch(() => null);
  });

  // STEP 11: Cross-Tenant Isolation
  await test('Step 11: Cross-company tenant isolation strictly rejects unauthorized access', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/crm/leads/${testLeadId}`, {
      headers: otherHeaders,
    });
    if (res.status !== 403 && res.status !== 401 && res.status !== 404) {
      throw new Error(`Tenant isolation failed: received status ${res.status}`);
    }
  });

  // Clean up test records
  await prisma.salesOrder.deleteMany({ where: { id: createdOrderId } }).catch(() => null);
  await prisma.salesQuotation.deleteMany({ where: { id: testQuotationId } }).catch(() => null);
  await prisma.crmOpportunity.deleteMany({ where: { id: testOpportunityId } }).catch(() => null);
  await prisma.crmContact.deleteMany({ where: { id: createdContactId } }).catch(() => null);
  await prisma.crmCustomer.deleteMany({ where: { id: createdCustomerId } }).catch(() => null);
  await prisma.lead.deleteMany({ where: { id: testLeadId } }).catch(() => null);

  console.log('\n========================================================================');
  console.log(`E2E CRM/SALES SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  return { passed, failed, success: failed === 0 };
}

runCrmSalesFlowTests().then((res) => {
  if (!res.success) process.exit(1);
});
