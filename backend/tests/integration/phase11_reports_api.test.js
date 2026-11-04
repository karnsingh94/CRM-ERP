import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import prisma from '../../src/config/prisma.js';
import app from '../../src/app.js';
import { signToken } from '../../src/utils/token.js';

test('PHASE 11: STEP 2 - REPORTING CONTROLLERS, ROUTES & PERMISSION VERIFICATION', async (t) => {
  let server;
  let baseUrl;
  let companyA;
  let companyB;
  let cashAccount;
  let salesAccount;
  let capitalAccount;
  let empAccounting;
  let empGeneral;
  let empPayroll;
  let adminTokenA;
  let adminTokenB;
  let accountingEmpToken;
  let generalEmpToken;
  let payrollEmpToken;
  let timestamp;
  let testSalesOrder;
  let testPo;

  // 0. Database Safety Check: Active DB must strictly be crm_erp_test_db
  await t.test('0. Database Safety Check: Active DB must strictly be crm_erp_test_db', async () => {
    const [result] = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
    assert.equal(
      result.db,
      'crm_erp_test_db',
      `SAFETY VIOLATION: Expected test database crm_erp_test_db, but connected to ${result.db}`
    );
  });

  // Setup: Provision Server, Tenants, Users, Accounts & Transactions
  await t.test('Setup: Spin up HTTP server & provision multi-tenant fixtures', async () => {
    timestamp = Date.now();

    // 1. Start HTTP Server on an ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;

    // 2. Tenant A
    companyA = await prisma.clientAdmin.create({
      data: {
        name: `Tenant A Solar ${timestamp}`,
        organizationName: `Tenant A Org ${timestamp}`,
        email: `tenant_a_${timestamp}@solar.com`,
        passwordHash: 'dummy_hash',
        status: 'ACTIVE',
      },
    });

    // 3. Tenant B (for multi-tenant isolation verification)
    companyB = await prisma.clientAdmin.create({
      data: {
        name: `Tenant B Competitor ${timestamp}`,
        organizationName: `Tenant B Org ${timestamp}`,
        email: `tenant_b_${timestamp}@competitor.com`,
        passwordHash: 'dummy_hash',
        status: 'ACTIVE',
      },
    });

    // 4. Provision Chart of Accounts for Tenant A
    const assetGroup = await prisma.accountGroup.create({
      data: { companyId: companyA.id, groupName: 'Current Assets', groupCode: `ASSET-${timestamp}`, category: 'ASSET' },
    });
    const incomeGroup = await prisma.accountGroup.create({
      data: { companyId: companyA.id, groupName: 'Direct Revenue', groupCode: `REV-${timestamp}`, category: 'INCOME' },
    });
    const equityGroup = await prisma.accountGroup.create({
      data: { companyId: companyA.id, groupName: 'Equity', groupCode: `EQ-${timestamp}`, category: 'EQUITY' },
    });

    cashAccount = await prisma.accountMaster.create({
      data: {
        companyId: companyA.id,
        groupId: assetGroup.id,
        accountCode: `1001-${timestamp}`,
        accountName: 'Cash In Hand',
        normalBalance: 'DEBIT',
        controlType: 'CASH',
        openingDebit: 10000,
        status: 'ACTIVE',
      },
    });

    salesAccount = await prisma.accountMaster.create({
      data: {
        companyId: companyA.id,
        groupId: incomeGroup.id,
        accountCode: `3001-${timestamp}`,
        accountName: 'Sales Revenue',
        normalBalance: 'CREDIT',
        openingCredit: 0,
        status: 'ACTIVE',
      },
    });

    capitalAccount = await prisma.accountMaster.create({
      data: {
        companyId: companyA.id,
        groupId: equityGroup.id,
        accountCode: `2001-${timestamp}`,
        accountName: 'Owner Equity',
        normalBalance: 'CREDIT',
        openingCredit: 10000,
        status: 'ACTIVE',
      },
    });

    // 5. Seed a posted journal voucher for financial report verification
    await prisma.journalVoucher.create({
      data: {
        companyId: companyA.id,
        voucherNo: `JV-API-${timestamp}`,
        voucherDate: new Date(),
        voucherType: 'RECEIPT',
        totalDebit: 5000,
        totalCredit: 5000,
        status: 'POSTED',
        narration: 'Revenue receipt',
        items: {
          create: [
            {
              companyId: companyA.id,
              accountId: cashAccount.id,
              sequenceNo: 1,
              debitAmount: 5000,
              creditAmount: 0,
            },
            {
              companyId: companyA.id,
              accountId: salesAccount.id,
              sequenceNo: 2,
              debitAmount: 0,
              creditAmount: 5000,
            },
          ],
        },
      },
    });

    // 6. Seed employees with granular permissions
    empAccounting = await prisma.companyEmployee.create({
      data: {
        companyId: companyA.id,
        name: 'Anita Accountant',
        email: `anita_${timestamp}@company-a.com`,
        role: 'EMPLOYEE',
        permissions: { viewFinancialReports: true, financial_reports: true },
      },
    });

    empGeneral = await prisma.companyEmployee.create({
      data: {
        companyId: companyA.id,
        name: 'Gaurav General',
        email: `gaurav_${timestamp}@company-a.com`,
        role: 'EMPLOYEE',
        permissions: {},
      },
    });

    empPayroll = await prisma.companyEmployee.create({
      data: {
        companyId: companyA.id,
        name: 'Pooja Payroll',
        email: `pooja_${timestamp}@company-a.com`,
        role: 'EMPLOYEE',
        permissions: { viewPayrollReports: true, payroll_reports: true },
      },
    });

    // 7. Seed Sales Order and Purchase Order for cross-module tests
    testSalesOrder = await prisma.salesOrder.create({
      data: {
        companyId: companyA.id,
        orderNo: `SO-API-${timestamp}`,
        customer: 'API Test Client',
        date: new Date(),
        itemsCount: 1,
        amount: 15000,
        status: 'CONFIRMED',
      },
    });

    const vendor = await prisma.vendor.create({
      data: {
        companyId: companyA.id,
        name: `API Test Vendor ${timestamp}`,
        vendorCode: `VEND-API-${timestamp}`,
      },
    });

    const pr = await prisma.purchaseRequest.create({
      data: {
        companyId: companyA.id,
        requestNo: `PR-API-${timestamp}`,
        items: [],
        status: 'APPROVED',
      },
    });

    const pq = await prisma.purchaseQuotation.create({
      data: {
        companyId: companyA.id,
        requestId: pr.id,
        vendorId: vendor.id,
        quoteNo: `PQ-API-${timestamp}`,
        items: [{ sku: 'SKU-DUMMY', quantity: 10, unitPrice: 750 }],
        status: 'ACCEPTED',
      },
    });

    testPo = await prisma.purchaseOrder.create({
      data: {
        companyId: companyA.id,
        vendorId: vendor.id,
        requestId: pr.id,
        quotationId: pq.id,
        poNumber: `PO-API-${timestamp}`,
        orderDate: new Date(),
        expectedDate: new Date(),
        items: [{ sku: 'SKU-DUMMY', quantity: 10, unitPrice: 750 }],
        totalAmount: 7500,
        status: 'ISSUED',
      },
    });

    // 8. Sign JWT tokens
    adminTokenA = signToken({
      userId: companyA.id,
      companyId: companyA.id,
      role: 'COMPANY_ADMIN',
    });

    adminTokenB = signToken({
      userId: companyB.id,
      companyId: companyB.id,
      role: 'COMPANY_ADMIN',
    });

    accountingEmpToken = signToken({
      userId: empAccounting.id,
      companyId: companyA.id,
      role: 'EMPLOYEE',
      permissions: empAccounting.permissions,
    });

    generalEmpToken = signToken({
      userId: empGeneral.id,
      companyId: companyA.id,
      role: 'EMPLOYEE',
      permissions: empGeneral.permissions,
    });

    payrollEmpToken = signToken({
      userId: empPayroll.id,
      companyId: companyA.id,
      role: 'EMPLOYEE',
      permissions: empPayroll.permissions,
    });
  });

  // Test 1: Authentication Guard
  await t.test('1. Authentication Guard: Unauthenticated requests rejected with 401', async () => {
    const unauthRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/dashboard`);
    assert.equal(unauthRes.status, 401, 'Request without token must return 401');

    const invalidRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/dashboard`, {
      headers: { Authorization: 'Bearer invalid.token.string' },
    });
    assert.equal(invalidRes.status, 401, 'Request with invalid token must return 401');
  });

  // Test 2: Multi-Tenant Data Isolation & Company Validation
  await t.test('2. Multi-Tenant Isolation: Cross-company access rejected with 403', async () => {
    // Tenant B attempts to access Tenant A dashboard
    const crossRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/dashboard`, {
      headers: { Authorization: `Bearer ${adminTokenB}` },
    });
    assert.equal(crossRes.status, 403, 'Cross-company access must be blocked with 403');
    const body = await crossRes.json();
    assert.equal(body.code, 'TENANT_ISOLATION_VIOLATION');

    // Invalid company UUID format
    const malformedRes = await fetch(`${baseUrl}/companies/not-a-valid-uuid/reports/dashboard`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(malformedRes.status, 400, 'Invalid company UUID format must return 400');
  });

  // Test 3: Financial Reports Access & Granular Permissions
  await t.test('3. Financial Reports: Authorization, Trial Balance, P&L, Balance Sheet & Cash Book', async () => {
    // 1. Company Admin: Trial Balance
    const tbRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(tbRes.status, 200);
    const tb = await tbRes.json();
    assert.equal(tb.success, true);
    assert.equal(tb.data.isReconciled, true, 'Trial balance must be reconciled');

    // 2. Company Admin: Profit & Loss
    const plRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/profit-loss`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(plRes.status, 200);
    const pl = await plRes.json();
    assert.equal(pl.success, true);
    assert.ok(pl.data.totalIncome >= 5000);

    // 3. Company Admin: Balance Sheet
    const bsRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/balance-sheet`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(bsRes.status, 200);
    const bs = await bsRes.json();
    assert.equal(bs.success, true);
    assert.equal(bs.data.isBalanced, true, 'Balance sheet must balance');

    // 4. Company Admin: General Ledger
    const glRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/financial/general-ledger?accountId=${cashAccount.id}`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(glRes.status, 200);
    const gl = await glRes.json();
    assert.equal(gl.success, true);
    assert.ok(gl.data.lines.length >= 1);

    // Missing accountId for General Ledger
    const glMissingRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/general-ledger`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(glMissingRes.status, 400, 'General Ledger without accountId must return 400');

    // 5. Company Admin: Cash Book
    const cbRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/cash-book`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(cbRes.status, 200);

    // 6. Accounting Employee (Permitted) -> 200
    const accEmpRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance`, {
      headers: { Authorization: `Bearer ${accountingEmpToken}` },
    });
    assert.equal(accEmpRes.status, 200, 'Permitted accounting employee must be accepted');

    // 7. General Employee (Unauthorized) -> 403
    const genEmpRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance`, {
      headers: { Authorization: `Bearer ${generalEmpToken}` },
    });
    assert.equal(genEmpRes.status, 403, 'Unauthorized employee must be blocked from financial reports');
    const genBody = await genEmpRes.json();
    assert.equal(genBody.code, 'FORBIDDEN_FINANCIAL_REPORTS');
  });

  // Test 4: HRMS & Payroll Permissions
  await t.test('4. HRMS & Payroll Reports: Privacy, Permissions & PII Masking', async () => {
    // 1. Company Admin accesses payroll summary
    const payRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/hrms/payroll`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(payRes.status, 200);
    const payBody = await payRes.json();
    assert.equal(payBody.success, true);

    // Verify PII is never leaked
    const payStr = JSON.stringify(payBody);
    assert.equal(payStr.includes('aadhaar'), false, 'Aadhaar must not be exposed');
    assert.equal(payStr.includes('bankAccountNumber'), false, 'Bank account must not be exposed');
    assert.equal(payStr.includes('panNumber'), false, 'PAN must not be exposed');

    // 2. Payroll Employee accesses payroll summary -> 200
    const payEmpRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/hrms/payroll`, {
      headers: { Authorization: `Bearer ${payrollEmpToken}` },
    });
    assert.equal(payEmpRes.status, 200, 'Permitted payroll employee must access payroll summary');

    // 3. General Employee without payroll permission -> 403
    const genPayRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/hrms/payroll`, {
      headers: { Authorization: `Bearer ${generalEmpToken}` },
    });
    assert.equal(genPayRes.status, 403, 'Unauthorized employee must be blocked from payroll');
    const genPayBody = await genPayRes.json();
    assert.equal(genPayBody.code, 'FORBIDDEN_PAYROLL_REPORTS');

    // 4. Monthly attendance report access
    const attRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/hrms/attendance`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(attRes.status, 200);
  });

  // Test 5: Operational Reports Endpoints
  await t.test('5. Operational Reports: Executive Dashboard, CRM, Purchase, Inventory, Production, Job Work, Dispatch, Solar', async () => {
    const endpoints = [
      '/dashboard',
      '/sales/lead-conversion',
      '/sales/customer-sales',
      '/sales/quotation-conversion',
      '/purchase/vendor-summary',
      '/purchase/pending-orders',
      '/purchase/grn-inspection',
      '/inventory/stock-ageing',
      '/inventory/stock-valuation',
      '/production/efficiency',
      '/job-work/summary',
      '/dispatch/summary',
      '/solar/generation',
      '/solar/maintenance-cost',
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}/companies/${companyA.id}/reports${ep}`, {
        headers: { Authorization: `Bearer ${adminTokenA}` },
      });
      assert.equal(res.status, 200, `Endpoint GET /reports${ep} must return 200`);
      const body = await res.json();
      assert.equal(body.success, true, `Endpoint GET /reports${ep} success must be true`);
    }

    // Verify Dispatch SLA is reported as NOT IMPLEMENTED
    const dspRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/dispatch/summary`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    const dspBody = await dspRes.json();
    assert.equal(dspBody.data.deliverySLA, 'NOT IMPLEMENTED');
  });

  // Test 6: Cross-Module Flow Traces
  await t.test('6. Cross-Module Flow Traces: Sales, Purchase (Three-Way Matching) & Parameter Validation', async () => {
    // 1. Sales Order Flow Trace
    const soRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/cross-module/sales-flow?salesOrderId=${testSalesOrder.id}`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(soRes.status, 200);
    const soData = await soRes.json();
    assert.equal(soData.data.salesOrder.orderNo, testSalesOrder.orderNo);

    // Missing salesOrderId -> 400
    const soMissingRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/cross-module/sales-flow`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(soMissingRes.status, 400);

    // 2. Purchase Order Flow Trace & Three-Way Matching
    const poRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/cross-module/purchase-flow?purchaseOrderId=${testPo.id}`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(poRes.status, 200);
    const poData = await poRes.json();
    assert.ok(poData.data.threeWayMatching !== undefined);

    // Missing purchaseOrderId -> 400
    const poMissingRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/cross-module/purchase-flow`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(poMissingRes.status, 400);
  });

  // Test 7: Query Filter Validation (Dates, Ranges, Pagination)
  await t.test('7. Query Filter Validation: Date formats, inverted ranges & pagination limits', async () => {
    // 1. Invalid fromDate format -> 400
    const invDateRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance?fromDate=not-a-date`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(invDateRes.status, 400);

    // 2. Inverted date range (fromDate > toDate) -> 400
    const invRangeRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance?fromDate=2026-12-31&toDate=2026-01-01`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(invRangeRes.status, 400);
    const invBody = await invRangeRes.json();
    assert.ok(invBody.message.includes('fromDate cannot be greater than toDate'));

    // 3. Invalid pagination limit > 500 -> 400
    const invLimitRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance?limit=1000`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(invLimitRes.status, 400);

    // 4. Valid filters -> 200
    const validRes = await fetch(
      `${baseUrl}/companies/${companyA.id}/reports/financial/trial-balance?fromDate=2026-01-01&toDate=2026-12-31&limit=50&page=1`,
      { headers: { Authorization: `Bearer ${adminTokenA}` } }
    );
    assert.equal(validRes.status, 200);
  });

  // Test 8: RFC-4180 CSV Export, Content Headers, BOM & Audit Logging
  await t.test('8. CSV Export: Headers, UTF-8 BOM, Permission Enforcement & Audit Trail', async () => {
    // 1. Export Trial Balance
    const exportRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/export/trial-balance`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(exportRes.status, 200);
    assert.equal(exportRes.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.ok(exportRes.headers.get('content-disposition')?.includes('attachment; filename='));

    const arrayBuf = await exportRes.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    assert.equal(buf[0], 0xef, 'Byte 0 must be UTF-8 BOM 0xEF');
    assert.equal(buf[1], 0xbb, 'Byte 1 must be UTF-8 BOM 0xBB');
    assert.equal(buf[2], 0xbf, 'Byte 2 must be UTF-8 BOM 0xBF');

    const csvText = buf.toString('utf8');
    assert.ok(csvText.includes('Account Code,Account Name'), 'Must include headers');

    // 2. Export Stock Valuation via path parameter
    const stockExpRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/export/stock-valuation`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(stockExpRes.status, 200);

    // 2b. Export via query parameter route: /export?reportType=trial-balance
    const queryExpRes1 = await fetch(`${baseUrl}/companies/${companyA.id}/reports/export?reportType=trial-balance`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(queryExpRes1.status, 200, 'Export via /export?reportType=... must succeed');

    // 2c. Export via query parameter route: /export?report=stock-valuation
    const queryExpRes2 = await fetch(`${baseUrl}/companies/${companyA.id}/reports/export?report=stock-valuation`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(queryExpRes2.status, 200, 'Export via /export?report=... must succeed');

    // 3. Unauthorized Employee exporting payroll CSV -> 403
    const unauthExpRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/export/hrms-payroll`, {
      headers: { Authorization: `Bearer ${generalEmpToken}` },
    });
    assert.equal(unauthExpRes.status, 403, 'Unauthorized export attempt must be blocked with 403');

    // 4. Unsupported export type -> 400
    const badExpRes = await fetch(`${baseUrl}/companies/${companyA.id}/reports/export/invalid-report-type`, {
      headers: { Authorization: `Bearer ${adminTokenA}` },
    });
    assert.equal(badExpRes.status, 400);

    // 5. Verify Audit Log entry created for the export
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        companyId: companyA.id,
        serviceCode: 'reporting',
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    assert.ok(auditLogs.length >= 1, 'Audit log must record report export events');
    assert.ok(auditLogs[0].action.startsWith('REPORT_EXPORT_'));
  });

  // Teardown: Stop HTTP Server & Safely Clean Test Fixtures
  await t.test('Cleanup: Stop server & clean test fixtures', async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    if (companyA?.id) {
      await prisma.auditLog.deleteMany({ where: { companyId: companyA.id } });
      await prisma.purchaseOrder.deleteMany({ where: { companyId: companyA.id } });
      await prisma.purchaseQuotation.deleteMany({ where: { companyId: companyA.id } });
      await prisma.purchaseRequest.deleteMany({ where: { companyId: companyA.id } });
      await prisma.vendor.deleteMany({ where: { companyId: companyA.id } });
      await prisma.salesOrder.deleteMany({ where: { companyId: companyA.id } });
      await prisma.journalVoucherItem.deleteMany({ where: { companyId: companyA.id } });
      await prisma.journalVoucher.deleteMany({ where: { companyId: companyA.id } });
      await prisma.accountMaster.deleteMany({ where: { companyId: companyA.id } });
      await prisma.accountGroup.deleteMany({ where: { companyId: companyA.id } });
      await prisma.companyEmployee.deleteMany({ where: { companyId: companyA.id } });
      await prisma.clientAdmin.deleteMany({ where: { id: companyA.id } });
    }

    if (companyB?.id) {
      await prisma.clientAdmin.deleteMany({ where: { id: companyB.id } });
    }
  });
});
