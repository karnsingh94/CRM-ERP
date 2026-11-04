import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import prisma from '../../src/config/prisma.js';
import csvExportUtil, { generateCSV, sanitizeCellValue } from '../../src/utils/csvExport.util.js';
import financialStatementsService from '../../src/services/reports/financialStatements.service.js';
import operationalReportsService from '../../src/services/reports/operationalReports.service.js';
import executiveDashboardService from '../../src/services/reports/executiveDashboard.service.js';
import crossModuleReportService from '../../src/services/reports/crossModuleReport.service.js';
import { voucherService } from '../../src/services/accounting/voucher.service.js';

test('PHASE 11: STEP 1 - BACKEND REPORTING ENGINE & DATA INTEGRITY VERIFICATION', async (t) => {
  let company;
  let cashAccount;
  let bankAccount;
  let salesAccount;
  let expenseAccount;
  let assetAccount;
  let voucher;
  let testSku;

  // 0. Safety Guard: Active DB must strictly be crm_erp_test_db
  await t.test('0. Database Safety Check: Active DB must strictly be crm_erp_test_db', async () => {
    const [result] = await prisma.$queryRawUnsafe('SELECT DATABASE() as db');
    assert.equal(
      result.db,
      'crm_erp_test_db',
      `SAFETY VIOLATION: Expected test database crm_erp_test_db, but connected to ${result.db}`
    );
  });

  // Setup fixtures
  await t.test('Setup: Provision Tenant, Chart of Accounts, Vouchers & Transactional Data', async () => {
    const timestamp = Date.now();
    company = await prisma.clientAdmin.create({
      data: {
        name: `Reports Test Company ${timestamp}`,
        organizationName: `Reports Test Org ${timestamp}`,
        email: `reports_test_${timestamp}@sne-reports.com`,
        passwordHash: 'dummy_hash_for_tests',
        status: 'ACTIVE',
      },
    });

    // 1. Create Account Groups
    const assetGroup = await prisma.accountGroup.create({
      data: { companyId: company.id, groupName: 'Current Assets', groupCode: `CURR-ASSET-${timestamp}`, category: 'ASSET' },
    });
    const liabilityGroup = await prisma.accountGroup.create({
      data: { companyId: company.id, groupName: 'Current Liabilities', groupCode: `CURR-LIAB-${timestamp}`, category: 'LIABILITY' },
    });
    const incomeGroup = await prisma.accountGroup.create({
      data: { companyId: company.id, groupName: 'Direct Incomes', groupCode: `INCOME-${timestamp}`, category: 'INCOME' },
    });
    const expenseGroup = await prisma.accountGroup.create({
      data: { companyId: company.id, groupName: 'Direct Expenses', groupCode: `EXPENSE-${timestamp}`, category: 'EXPENSE' },
    });
    const equityGroup = await prisma.accountGroup.create({
      data: { companyId: company.id, groupName: 'Shareholders Equity', groupCode: `EQUITY-${timestamp}`, category: 'EQUITY' },
    });

    // 2. Create Account Masters
    cashAccount = await prisma.accountMaster.create({
      data: {
        companyId: company.id,
        groupId: assetGroup.id,
        accountCode: `1001-${timestamp}`,
        accountName: 'Cash In Hand',
        normalBalance: 'DEBIT',
        controlType: 'CASH',
        openingDebit: 5000,
        status: 'ACTIVE',
      },
    });

    bankAccount = await prisma.accountMaster.create({
      data: {
        companyId: company.id,
        groupId: assetGroup.id,
        accountCode: `1002-${timestamp}`,
        accountName: 'HDFC Bank Operating Account',
        normalBalance: 'DEBIT',
        controlType: 'BANK',
        openingDebit: 25000,
        status: 'ACTIVE',
      },
    });

    salesAccount = await prisma.accountMaster.create({
      data: {
        companyId: company.id,
        groupId: incomeGroup.id,
        accountCode: `3001-${timestamp}`,
        accountName: 'Solar Panel Sales Revenue',
        normalBalance: 'CREDIT',
        openingCredit: 0,
        status: 'ACTIVE',
      },
    });

    expenseAccount = await prisma.accountMaster.create({
      data: {
        companyId: company.id,
        groupId: expenseGroup.id,
        accountCode: `4001-${timestamp}`,
        accountName: 'Plant O&M Maintenance Expense',
        normalBalance: 'DEBIT',
        openingDebit: 0,
        status: 'ACTIVE',
      },
    });

    assetAccount = await prisma.accountMaster.create({
      data: {
        companyId: company.id,
        groupId: assetGroup.id,
        accountCode: `1003-${timestamp}`,
        accountName: 'Spare Parts Inventory Asset',
        normalBalance: 'DEBIT',
        openingDebit: 10000,
        status: 'ACTIVE',
      },
    });

    const capitalAccount = await prisma.accountMaster.create({
      data: {
        companyId: company.id,
        groupId: equityGroup.id,
        accountCode: `2001-${timestamp}`,
        accountName: 'Owners Capital Account',
        normalBalance: 'CREDIT',
        openingCredit: 40000, // Exactly balances opening Dr 5,000 + 25,000 + 10,000 = 40,000
        status: 'ACTIVE',
      },
    });

    // 3. Create Balanced POSTED Journal Voucher
    // Dr. Bank 15,000, Cr. Sales 15,000 (Revenue received)
    voucher = await prisma.journalVoucher.create({
      data: {
        companyId: company.id,
        voucherNo: `JV-REP-${timestamp}-01`,
        voucherDate: new Date(),
        voucherType: 'RECEIPT',
        totalDebit: 15000,
        totalCredit: 15000,
        status: 'POSTED',
        narration: 'Receipt against Solar Inverter Sales',
        items: {
          create: [
            {
              companyId: company.id,
              accountId: bankAccount.id,
              sequenceNo: 1,
              debitAmount: 15000,
              creditAmount: 0,
              narration: 'Deposit into Bank',
            },
            {
              companyId: company.id,
              accountId: salesAccount.id,
              sequenceNo: 2,
              debitAmount: 0,
              creditAmount: 15000,
              narration: 'Sales revenue recognized',
            },
          ],
        },
      },
    });

    // 4. Create another POSTED Voucher: Dr. Expense 3,000, Cr. Cash 3,000
    await prisma.journalVoucher.create({
      data: {
        companyId: company.id,
        voucherNo: `JV-REP-${timestamp}-02`,
        voucherDate: new Date(),
        voucherType: 'PAYMENT',
        totalDebit: 3000,
        totalCredit: 3000,
        status: 'POSTED',
        narration: 'Cash paid for solar panel cleaning consumable',
        items: {
          create: [
            {
              companyId: company.id,
              accountId: expenseAccount.id,
              sequenceNo: 1,
              debitAmount: 3000,
              creditAmount: 0,
              narration: 'Maintenance expense',
            },
            {
              companyId: company.id,
              accountId: cashAccount.id,
              sequenceNo: 2,
              debitAmount: 0,
              creditAmount: 3000,
              narration: 'Disbursement from Cash',
            },
          ],
        },
      },
    });

    // 5. Create a DRAFT Voucher (must be EXCLUDED from reports)
    await prisma.journalVoucher.create({
      data: {
        companyId: company.id,
        voucherNo: `JV-DRAFT-${timestamp}`,
        voucherDate: new Date(),
        voucherType: 'JOURNAL',
        totalDebit: 99999,
        totalCredit: 99999,
        status: 'DRAFT',
        narration: 'Unposted draft voucher',
        items: {
          create: [
            {
              companyId: company.id,
              accountId: bankAccount.id,
              sequenceNo: 1,
              debitAmount: 99999,
              creditAmount: 0,
            },
            {
              companyId: company.id,
              accountId: salesAccount.id,
              sequenceNo: 2,
              debitAmount: 0,
              creditAmount: 99999,
            },
          ],
        },
      },
    });

    // 6. Setup Inventory & Batches for Ageing test
    testSku = `SKU-REP-${timestamp}`;
    await prisma.product.create({
      data: {
        companyId: company.id,
        sku: testSku,
        name: 'Reports Test Solar Panel',
        uom: 'PCS',
        stock: 50,
      },
    });

    const stock = await prisma.inventoryStock.create({
      data: {
        companyId: company.id,
        sku: testSku,
        name: 'Reports Test Solar Panel',
        warehouse: 'Main Warehouse',
        stock: 50,
        availableQty: 50,
        averageCost: 1000,
        uom: 'PCS',
      },
    });

    // Batch 1: Aged 15 days (bucket 0-30)
    await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku: testSku,
        batchNo: `BATCH-15D-${timestamp}`,
        warehouse: 'Main Warehouse',
        receivedDate: new Date(Date.now() - 15 * 86400000),
        availableQty: 20,
        unitCost: 1000,
        status: 'ACTIVE',
      },
    });

    // Batch 2: Aged 45 days (bucket 31-60)
    await prisma.inventoryBatch.create({
      data: {
        companyId: company.id,
        stockId: stock.id,
        sku: testSku,
        batchNo: `BATCH-45D-${timestamp}`,
        warehouse: 'Main Warehouse',
        receivedDate: new Date(Date.now() - 45 * 86400000),
        availableQty: 30,
        unitCost: 1000,
        status: 'ACTIVE',
      },
    });
  });

  // Test 1: Financial Statements - Trial Balance Reconciles
  await t.test('1. Financial Statements: Trial Balance strict Debit = Credit reconciliation', async () => {
    const tb = await financialStatementsService.getTrialBalance(company.id);

    assert.equal(tb.isReconciled, true, 'Trial Balance must be reconciled');
    assert.equal(tb.difference, 0, 'Debit and Credit difference must be zero');
    assert.ok(tb.totals.closingDebit > 0, 'Closing Debit must be positive');
    assert.equal(tb.totals.closingDebit, tb.totals.closingCredit, 'Total Closing Debit must strictly equal Total Closing Credit');

    // Confirm DRAFT voucher was excluded
    const bankRow = tb.accounts.find((a) => a.accountId === bankAccount.id);
    assert.ok(bankRow, 'Bank account must be in Trial Balance');
    // Opening 25,000 + Period Dr 15,000 = 40,000 (NOT 40,000 + 99,999 draft)
    assert.equal(bankRow.closingDebit, 40000, 'Draft vouchers must NOT be included in Trial Balance');
  });

  // Test 2: Financial Statements - Profit & Loss Statement
  await t.test('2. Financial Statements: P&L Statement calculates Revenue, Expense and Net Profit', async () => {
    const pl = await financialStatementsService.getProfitAndLoss(company.id);

    // Total Income = 15,000, Total Expense = 3,000, Net Profit = 12,000
    assert.equal(pl.totalIncome, 15000);
    assert.equal(pl.totalExpense, 3000);
    assert.equal(pl.netProfit, 12000);
    assert.equal(pl.isProfit, true);
  });

  // Test 3: Financial Statements - Balance Sheet Equilibrium
  await t.test('3. Financial Statements: Balance Sheet balances (Assets = Liabilities + Equity including P&L Net Profit)', async () => {
    const bs = await financialStatementsService.getBalanceSheet(company.id);

    assert.equal(bs.isBalanced, true, 'Balance sheet must balance');
    assert.equal(bs.imbalance, 0, 'Imbalance must be 0');
    // Total Assets = Cash (2,000) + Bank (40,000) + Asset (10,000) = 52,000
    assert.equal(bs.totalAssets, 52000);
    // Total Liabilities & Equity = Opening Equity (40,000) + Net Profit (12,000) = 52,000
    assert.equal(bs.totalLiabilitiesAndEquity, 52000);
  });

  // Test 4: Financial Statements - General Ledger & Cash Book Running Balance
  await t.test('4. Financial Statements: Cash Book & General Ledger running balance calculation', async () => {
    const cb = await financialStatementsService.getCashBook(company.id);

    // Cash had opening 5,000, paid 3,000, closing must be 2,000
    assert.equal(cb.openingBalance, 5000);
    assert.equal(cb.totalCredit, 3000); // 3,000 disbursement
    assert.equal(cb.closingBalance, 2000);
    assert.equal(cb.lines.length, 1);
    assert.equal(cb.lines[0].runningBalance, 2000);
  });

  // Test 5: Operational Reports - Inventory Ageing Buckets & Valuation
  await t.test('5. Operational Reports: Stock Ageing correctly buckets batches (0-30, 31-60, 61-90, 90+)', async () => {
    const ageing = await operationalReportsService.getStockAgeingReport(company.id);

    assert.equal(ageing.summary.totalQty, 50);
    assert.equal(ageing.summary.totalValuation, 50000);
    assert.equal(ageing.summary.bucket_0_30.qty, 20, '20 units aged 15 days must be in bucket_0_30');
    assert.equal(ageing.summary.bucket_31_60.qty, 30, '30 units aged 45 days must be in bucket_31_60');
    assert.equal(ageing.summary.bucket_61_90.qty, 0);
    assert.equal(ageing.summary.bucket_90_plus.qty, 0);

    const val = await operationalReportsService.getStockValuationReport(company.id);
    assert.equal(val.totalCompanyValuation, 50000);
  });

  // Test 6: Operational Reports - Solar PR Sensor Fallback
  await t.test('6. Operational Reports: Solar PR returns SENSOR_UNAVAILABLE when pyranometer data is absent', async () => {
    const plant = await prisma.solarPlant.create({
      data: {
        companyId: company.id,
        name: 'Report Audit Solar Plant',
        code: `PLANT-REP-${Date.now()}`,
        capacityDcKw: 100,
        capacityAcKw: 80,
      },
    });

    const inverter = await prisma.solarInverter.create({
      data: {
        companyId: company.id,
        plantId: plant.id,
        inverterCode: `INV-REP-${Date.now()}`,
        ratedCapacityKw: 50,
        make: 'Sungrow',
        model: 'SG50CX',
        serialNumber: `SN-REP-${Date.now()}`,
      },
    });

    // Ingest telemetry without irradiance sensor data
    await prisma.solarTelemetryLog.create({
      data: {
        companyId: company.id,
        plantId: plant.id,
        inverterId: inverter.id,
        timestamp: new Date(),
        dailyEnergyKwh: 450,
        currentPowerKw: 75,
        totalEnergyKwh: 12000,
        irradianceWm2: null, // Sensor absent!
      },
    });

    const report = await operationalReportsService.getSolarGenerationReport(company.id, plant.id);
    assert.equal(report.totalGenerationKwh, 450);
    assert.equal(report.specificYieldKwhPerKwp, 4.5); // 450 kWh / 100 kWp = 4.5 kWh/kWp
    assert.equal(report.performanceRatio.status, 'SENSOR_UNAVAILABLE');
    assert.equal(report.performanceRatio.ratioPercent, null);
  });

  // Test 7: Executive Dashboard KPIs
  await t.test('7. Executive Dashboard: High-level KPIs computed from verified records', async () => {
    const kpis = await executiveDashboardService.getExecutiveKpis(company.id);

    assert.equal(kpis.companyId, company.id);
    assert.ok(kpis.treasury.cashAndBankBalance >= 42000, 'Treasury balance includes cash (2,000) + bank (40,000)');
    assert.equal(kpis.inventory.totalAvailableStockUnits, 50);
    assert.equal(kpis.inventory.availableStockValuation, 50000);
  });

  // Test 8: Cross-Module Flow & Three-Way Matching
  await t.test('8. Cross-Module Flow: Three-Way Matching detects PO vs GRN vs Bill variances', async () => {
    const vendor = await prisma.vendor.create({
      data: {
        companyId: company.id,
        name: 'Audit Vendor Solar Cells Ltd',
        vendorCode: `VND-AUDIT-${Date.now()}`,
      },
    });

    const vReq = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        requestNo: `PR-REP-${Date.now()}`,
        items: [{ sku: testSku, quantity: 100 }],
      },
    });

    const vQuote = await prisma.purchaseQuotation.create({
      data: {
        companyId: company.id,
        requestId: vReq.id,
        vendorId: vendor.id,
        quoteNo: `QUO-REP-${Date.now()}`,
        items: [{ sku: testSku, quantity: 100, unitPrice: 50 }],
      },
    });

    // 1. PO for 100 units @ 50 = 5000
    const po = await prisma.purchaseOrder.create({
      data: {
        companyId: company.id,
        vendorId: vendor.id,
        requestId: vReq.id,
        quotationId: vQuote.id,
        poNumber: `PO-REP-${Date.now()}`,
        items: [{ sku: testSku, quantity: 100, unitPrice: 50 }],
        totalAmount: 5000,
        status: 'ISSUED',
      },
    });

    // 2. GRN received 90 units (accepted 85, rejected 5)
    await prisma.purchaseReceipt.create({
      data: {
        companyId: company.id,
        orderId: po.id,
        grnNo: `GRN-REP-${Date.now()}`,
        warehouse: 'Main Warehouse',
        items: [],
        receivedQty: 90,
        acceptedQty: 85,
        rejectedQty: 5,
        qcStatus: 'PARTIAL_REJECTION',
      },
    });

    // 3. Bill received for 85 units @ 50 = 4250
    await prisma.purchaseBill.create({
      data: {
        companyId: company.id,
        orderId: po.id,
        billNo: `BILL-REP-${Date.now()}`,
        vendorInvoiceNo: `VINV-${Date.now()}`,
        totalAmount: 4250,
        status: 'POSTED',
      },
    });

    const flow = await crossModuleReportService.getPurchaseOrderFlowTrace(company.id, po.id);
    assert.equal(flow.threeWayMatching.quantities.orderedQty, 100);
    assert.equal(flow.threeWayMatching.quantities.acceptedQty, 85);
    assert.equal(flow.threeWayMatching.quantities.quantityVariance, -15, 'Detected -15 quantity variance');
    assert.equal(flow.threeWayMatching.financials.poAmount, 5000);
    assert.equal(flow.threeWayMatching.financials.billedAmount, 4250);
    assert.equal(flow.threeWayMatching.financials.valueVariance, -750, 'Detected -750 value variance');
    assert.equal(flow.threeWayMatching.isMatched, false, 'Variance correctly flagged isMatched = false');
  });

  // Test 9: RFC-4180 CSV Export Utility & Formula Injection Protection
  await t.test('9. CSV Export Utility: RFC-4180 escaping & CWE-1236 Formula Injection Protection', async () => {
    // Formula trigger cell values
    assert.equal(sanitizeCellValue('=1+1'), "'=1+1", 'Leading = must be escaped');
    assert.equal(sanitizeCellValue('+cmd|'), "'+cmd|", 'Leading + must be escaped');
    assert.equal(sanitizeCellValue('-100'), "'-100", 'Leading - in string must be escaped');
    assert.equal(sanitizeCellValue('@HYPERLINK("evil")'), '"\'@HYPERLINK(""evil"")"', 'Leading @ must be escaped and quotes RFC-4180 escaped');

    // Quotes and commas
    assert.equal(sanitizeCellValue('Hello, "World"'), '"Hello, ""World"""', 'Commas and quotes must be RFC-4180 escaped');

    // Safe numbers and null
    assert.equal(sanitizeCellValue(123.45), '123.45');
    assert.equal(sanitizeCellValue(null), '');
    assert.equal(sanitizeCellValue(undefined), '');

    // Full CSV Generation with BOM
    const headers = [
      { key: 'accountCode', label: 'Account Code' },
      { key: 'accountName', label: 'Account Name' },
      { key: 'balance', label: 'Closing Balance', format: (v) => Number(v).toFixed(2) },
    ];
    const rows = [
      { accountCode: '1001', accountName: 'Cash In Hand, Primary', balance: 2000 },
      { accountCode: '2001', accountName: '=SUM(A1:A2)', balance: 5000 },
    ];

    const csv = generateCSV(headers, rows);
    assert.ok(csv.startsWith('\uFEFF'), 'CSV must include UTF-8 BOM for Excel native compatibility');
    assert.ok(csv.includes('"Cash In Hand, Primary"'), 'Commas in text must be quoted');
    assert.ok(csv.includes("'=SUM(A1:A2)"), 'Formula injection attempt must be neutralized');
  });

  // Test 10: Reversal Voucher Mechanics & Audit Trail
  await t.test('10. Financial Accuracy: Reversal Voucher Mechanics, Audit Trail & DRAFT Exclusion', async () => {
    // 1. Post a new voucher: Debit Cash 1200, Credit Sales 1200
    const testVoucher = await voucherService.createDraftVoucher(company.id, {
      voucherType: 'JOURNAL',
      narration: 'Voucher to test reversal mechanics',
      items: [
        { accountId: cashAccount.id, debitAmount: 1200, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 1200 },
      ],
    });
    const postedVoucher = await voucherService.postVoucher(company.id, testVoucher.id);
    assert.equal(postedVoucher.status, 'POSTED');

    // Verify Trial Balance balances with the posted voucher
    const tbBefore = await financialStatementsService.getTrialBalance(company.id);
    assert.equal(tbBefore.isReconciled, true);

    // 2. Reverse the voucher
    const reversalVoucher = await voucherService.reversePostedVoucher(company.id, postedVoucher.id, 'Customer cancellation for test reversal');
    assert.equal(reversalVoucher.status, 'POSTED');
    assert.equal(reversalVoucher.isReversal, true);

    // Check original voucher status is now REVERSED
    const refreshedOriginal = await prisma.journalVoucher.findUnique({ where: { id: postedVoucher.id } });
    assert.equal(refreshedOriginal.status, 'REVERSED');

    // 3. Verify Trial Balance: Both original (REVERSED) and reversal (POSTED) are included, net effect is 0
    const tbAfter = await financialStatementsService.getTrialBalance(company.id);
    assert.equal(tbAfter.isReconciled, true, 'Trial balance must remain reconciled after reversal');
    assert.equal(Math.abs(tbAfter.difference), 0, 'No debit/credit discrepancy');

    // 4. Verify General Ledger statement for Cash Account contains both lines with full audit trail
    const gl = await financialStatementsService.getGeneralLedger(company.id, cashAccount.id);
    const voucherIdsInGl = gl.lines.map((e) => e.voucherId);
    assert.ok(voucherIdsInGl.includes(postedVoucher.id), 'Audit trail must retain original reversed voucher');
    assert.ok(voucherIdsInGl.includes(reversalVoucher.id), 'Audit trail must include reversal voucher');

    // 5. Verify DRAFT vouchers are excluded from financial statements
    const draftVoucher = await voucherService.createDraftVoucher(company.id, {
      voucherType: 'JOURNAL',
      narration: 'Draft voucher must never appear in reports',
      items: [
        { accountId: cashAccount.id, debitAmount: 999999, creditAmount: 0 },
        { accountId: salesAccount.id, debitAmount: 0, creditAmount: 999999 },
      ],
    });
    const glWithDraft = await financialStatementsService.getGeneralLedger(company.id, cashAccount.id);
    const hasDraftInGl = glWithDraft.lines.some((e) => e.voucherId === draftVoucher.id);
    assert.equal(hasDraftInGl, false, 'DRAFT vouchers must never be included in General Ledger');
  });

  // Test 11: Cross-Module Flow Traces (Sales Order, Job Work, Solar Maintenance, Payroll GL)
  await t.test('11. Cross-Module Flow Traces: Sales, Job Work, Solar Spares & Payroll GL', async () => {
    // 1. Sales Order End-to-End Flow Trace
    const salesOrder = await prisma.salesOrder.create({
      data: {
        companyId: company.id,
        orderNo: `SO-REP-${Date.now()}`,
        customer: 'Acme Solar Installations Ltd',
        date: new Date(),
        itemsCount: 1,
        amount: 25000,
        status: 'CONFIRMED',
        paymentStatus: 'PARTIAL',
      },
    });

    const testProduct = await prisma.product.findFirst({ where: { companyId: company.id } });
    const bom = await prisma.bomMaster.create({
      data: {
        companyId: company.id,
        bomCode: `BOM-REP-${Date.now()}`,
        bomName: 'Solar Panel Standard Assembly BOM',
        outputProductId: testProduct.id,
        outputProductSku: testProduct.sku,
      },
    });

    const prodOrder = await prisma.productionOrder.create({
      data: {
        companyId: company.id,
        salesOrderId: salesOrder.id,
        orderNo: `PRD-REP-${Date.now()}`,
        outputProductId: testProduct.id,
        bomId: bom.id,
        targetQuantity: 50,
        producedQuantity: 50,
        uom: 'PCS',
        priority: 'HIGH',
        status: 'COMPLETED',
      },
    });

    const dispatchOrder = await prisma.dispatchOrder.create({
      data: {
        companyId: company.id,
        salesOrderId: salesOrder.id,
        salesOrderNo: salesOrder.orderNo,
        customerName: 'Acme Solar Installations Ltd',
        dispatchNo: `DSP-REP-${Date.now()}`,
        dispatchDate: new Date(),
        fulfillmentType: 'DIRECT',
        totalPackages: 5,
        totalDispatchedAmount: 25000,
        status: 'DELIVERED',
      },
    });

    const crmCust = await prisma.crmCustomer.create({
      data: {
        companyId: company.id,
        companyName: 'Acme Solar Installations Ltd',
      },
    });

    const salesInvoice = await prisma.salesInvoice.create({
      data: {
        companyId: company.id,
        salesOrderId: salesOrder.id,
        dispatchOrderId: dispatchOrder.id,
        invoiceNo: `INV-REP-${Date.now()}`,
        invoiceDate: new Date(),
        customerName: 'Acme Solar Installations Ltd',
        customerId: crmCust.id,
        taxableAmount: 25000,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        discountAmount: 0,
        otherCharges: 0,
        totalAmount: 25000,
        paidAmount: 10000,
        outstandingAmount: 15000,
        status: 'PARTIALLY_PAID',
      },
    });

    const soTrace = await crossModuleReportService.getSalesOrderFlowTrace(company.id, salesOrder.id);
    assert.equal(soTrace.salesOrder.orderNo, salesOrder.orderNo);
    assert.equal(soTrace.salesOrder.customerName, 'Acme Solar Installations Ltd');
    assert.equal(soTrace.salesOrder.totalAmount, 25000);
    assert.equal(soTrace.stages.production.count, 1);
    assert.equal(soTrace.stages.dispatch.count, 1);
    assert.equal(soTrace.stages.invoicing.count, 1);

    // 2. Job Work Flow Trace
    const vendor = await prisma.vendor.create({
      data: {
        companyId: company.id,
        name: 'Precision Fabricators Ltd',
        vendorCode: `VEND-JW-${Date.now()}`,
      },
    });

    const jwOrder = await prisma.jobWorkOrder.create({
      data: {
        clientAdmin: { connect: { id: company.id } },
        vendor: { connect: { id: vendor.id } },
        outputProduct: { connect: { id: testProduct.id } },
        bom: { connect: { id: bom.id } },
        orderNo: `JWO-REP-${Date.now()}`,
        targetQuantity: 100,
        receivedQuantity: 100,
        rejectedQuantity: 0,
        uom: 'PCS',
        conversionRate: 1,
        estimatedTotalCost: 8000,
        taxableValue: 8000,
        status: 'COMPLETED',
        issueDate: new Date(),
      },
    });

    const warehouse = await prisma.inventoryWarehouse.create({
      data: {
        companyId: company.id,
        code: `WH-REP-${Date.now()}`,
        name: 'Regional Jobwork Hub',
      },
    });

    const jwChallan = await prisma.jobWorkChallan.create({
      data: {
        clientAdmin: { connect: { id: company.id } },
        jobWorkOrder: { connect: { id: jwOrder.id } },
        vendor: { connect: { id: vendor.id } },
        warehouse: { connect: { id: warehouse.id } },
        destinationAddress: 'Industrial Area Phase 2, Jaipur',
        challanNo: `CHL-REP-${Date.now()}`,
        status: 'DISPATCHED',
        totalTaxableValue: 8000,
      },
    });

    const jwReceipt = await prisma.jobWorkReceipt.create({
      data: {
        clientAdmin: { connect: { id: company.id } },
        jobWorkOrder: { connect: { id: jwOrder.id } },
        warehouse: { connect: { id: warehouse.id } },
        receiptNo: `JWR-REP-${Date.now()}`,
        receivedQty: 100,
        acceptedQty: 98,
        rejectedQty: 2,
        qcStatus: 'ACCEPTED',
      },
    });

    const jwTrace = await crossModuleReportService.getJobWorkFlowTrace(company.id, jwOrder.id);
    assert.equal(jwTrace.order.orderNo, jwOrder.orderNo);
    assert.equal(jwTrace.order.supplierName, 'Precision Fabricators Ltd');
    assert.equal(jwTrace.challans.length, 1);
    assert.equal(jwTrace.receipts.length, 1);

    // 3. Solar Maintenance & Spares Flow Trace
    const solarPlant = await prisma.solarPlant.create({
      data: {
        companyId: company.id,
        name: 'Ajmer Solar Plant Unit 2',
        code: `PLANT-TRACE-${Date.now()}`,
        capacityDcKw: 250,
        capacityAcKw: 250,
        plantType: 'ROOFTOP',
        commissionDate: new Date(),
        status: 'ACTIVE',
      },
    });

    const solarInverter = await prisma.solarInverter.create({
      data: {
        companyId: company.id,
        plantId: solarPlant.id,
        inverterCode: `INV-TRACE-${Date.now()}`,
        ratedCapacityKw: 50,
        make: 'Sungrow',
        model: 'SG50CX',
        serialNumber: `SN-TRACE-${Date.now()}`,
        status: 'ONLINE',
      },
    });

    const solarTicket = await prisma.solarMaintenanceTicket.create({
      data: {
        companyId: company.id,
        plantId: solarPlant.id,
        inverterId: solarInverter.id,
        ticketNo: `TKT-TRACE-${Date.now()}`,
        category: 'INVERTER',
        priority: 'HIGH',
        subject: 'Inverter IGBT replacement',
        description: 'Replacement of damaged IGBT module in unit 2',
        technicianName: 'Rajesh Sharma',
        status: 'RESOLVED',
        sparePartsDetails: [
          { sku: 'SP-IGBT-01', partName: 'IGBT Module 50kW', quantity: 2, unitCost: 4500, totalCost: 9000 },
        ],
      },
    });

    const solarTrace = await crossModuleReportService.getSolarMaintenanceFlowTrace(company.id, solarTicket.id);
    assert.equal(solarTrace.ticket.ticketNo, solarTicket.ticketNo);
    assert.equal(solarTrace.ticket.plantName, solarPlant.name);
    assert.equal(solarTrace.ticket.totalSparesCost, 9000);
    assert.equal(solarTrace.sparePartsDetails.length, 1);

    // 4. Payroll Accounting Trace
    const payrollBatch = await prisma.payrollBatch.create({
      data: {
        companyId: company.id,
        batchNumber: `PAY-TRACE-${Date.now()}`,
        month: 10,
        year: 2026,
        periodStartDate: new Date(2026, 9, 1),
        periodEndDate: new Date(2026, 9, 31),
        totalEmployees: 1,
        totalGross: 50000,
        totalDeductions: 5000,
        totalNet: 45000,
        status: 'POSTED_TO_GL',
      },
    });

    const payrollTrace = await crossModuleReportService.getPayrollAccountingFlowTrace(company.id, payrollBatch.id);
    assert.equal(payrollTrace.batch.batchNo, payrollBatch.batchNumber);
    assert.equal(payrollTrace.batch.totalNet, 45000);
    assert.equal(payrollTrace.batch.employeeCount, 1);
  });

  // Test 12: Multi-Tenant Isolation & Cross-Company Security
  await t.test('12. Security: Multi-Tenant Data Isolation, Cross-Company Rejection & Payroll Masking', async () => {
    // 1. Provision Tenant B
    const companyB = await prisma.clientAdmin.create({
      data: {
        name: `Tenant B Competitor ${Date.now()}`,
        organizationName: `Competitor Solar Org ${Date.now()}`,
        email: `tenant_b_${Date.now()}@competitor.com`,
        passwordHash: 'dummy_hash',
        status: 'ACTIVE',
      },
    });

    try {
      // 2. Tenant B attempts to read Tenant A's General Ledger
      await assert.rejects(
        async () => {
          await financialStatementsService.getGeneralLedger(companyB.id, cashAccount.id);
        },
        (err) => {
          assert.equal(err.statusCode || err.status, 404);
          return true;
        },
        'Tenant B must be rejected when attempting to read Tenant A ledger account'
      );

      // 3. Tenant B attempts to read Tenant A's PO flow trace
      const poA = await prisma.purchaseOrder.findFirst({ where: { companyId: company.id } });
      await assert.rejects(
        async () => {
          await crossModuleReportService.getPurchaseOrderFlowTrace(companyB.id, poA.id);
        },
        (err) => {
          assert.equal(err.statusCode || err.status, 404);
          return true;
        },
        'Tenant B must be rejected when accessing Tenant A purchase order'
      );

      // 4. Tenant B's Trial Balance must be completely empty (isolated)
      const tbB = await financialStatementsService.getTrialBalance(companyB.id);
      assert.equal(tbB.accounts.length, 0, "Tenant B trial balance must not contain Tenant A's accounts");

      // 5. Verify sensitive payroll fields are omitted in Department Payroll Summary
      const payrollSummary = await operationalReportsService.getDepartmentPayrollSummary(company.id, {
        month: 10,
        year: 2026,
      });
      // Ensure summary does not leak individual PII (Aadhaar, PAN, Bank account numbers)
      const summaryStr = JSON.stringify(payrollSummary);
      assert.equal(summaryStr.includes('aadhaar'), false, 'Aadhaar must not be exposed');
      assert.equal(summaryStr.includes('bankAccountNumber'), false, 'Bank account number must not be exposed');
      assert.equal(summaryStr.includes('panNumber'), false, 'PAN must not be exposed');
    } finally {
      await prisma.clientAdmin.deleteMany({ where: { id: companyB.id } });
    }
  });

  // Test 13: SLA & Date Policy Verification
  await t.test('13. SLA & Date Policies: PO expectedDate vs Dispatch Order promisedDeliveryDate', async () => {
    // 1. PO expectedDate is used strictly for procurement delivery delay
    const po = await prisma.purchaseOrder.findFirst({ where: { companyId: company.id } });
    assert.ok('expectedDate' in po, 'PurchaseOrder has expectedDate for vendor lead time');

    // 2. DispatchOrder lacks customer promised delivery date in schema
    const dispatchFields = Prisma.dmmf.datamodel.models.find((m) => m.name === 'DispatchOrder').fields.map((f) => f.name);
    assert.equal(
      dispatchFields.includes('promisedDeliveryDate'),
      false,
      'DispatchOrder schema has no promisedDeliveryDate field; delivery SLA is explicitly NOT IMPLEMENTED'
    );
  });

  // Cleanup
  await t.test('Cleanup: Safe teardown of test records', async () => {
    if (company?.id) {
      await prisma.jobWorkReceipt.deleteMany({ where: { companyId: company.id } });
      await prisma.jobWorkChallan.deleteMany({ where: { companyId: company.id } });
      await prisma.jobWorkOrder.deleteMany({ where: { companyId: company.id } });
      await prisma.inventoryWarehouse.deleteMany({ where: { companyId: company.id } });
      await prisma.salesInvoice.deleteMany({ where: { companyId: company.id } });
      await prisma.crmCustomer.deleteMany({ where: { companyId: company.id } });
      await prisma.dispatchOrder.deleteMany({ where: { companyId: company.id } });
      await prisma.productionOrder.deleteMany({ where: { companyId: company.id } });
      await prisma.bomMaster.deleteMany({ where: { companyId: company.id } });
      await prisma.salesOrder.deleteMany({ where: { companyId: company.id } });
      await prisma.payrollBatch.deleteMany({ where: { companyId: company.id } });
      await prisma.solarMaintenanceTicket.deleteMany({ where: { companyId: company.id } });
      await prisma.journalVoucherItem.deleteMany({ where: { companyId: company.id } });
      await prisma.journalVoucher.deleteMany({ where: { companyId: company.id } });
      await prisma.purchaseBill.deleteMany({ where: { companyId: company.id } });
      await prisma.purchaseReceipt.deleteMany({ where: { companyId: company.id } });
      await prisma.purchaseOrder.deleteMany({ where: { companyId: company.id } });
      await prisma.purchaseQuotation.deleteMany({ where: { companyId: company.id } });
      await prisma.purchaseRequest.deleteMany({ where: { companyId: company.id } });
      await prisma.vendor.deleteMany({ where: { companyId: company.id } });
      await prisma.solarTelemetryLog.deleteMany({ where: { companyId: company.id } });
      await prisma.solarInverter.deleteMany({ where: { companyId: company.id } });
      await prisma.solarPlant.deleteMany({ where: { companyId: company.id } });
      await prisma.inventoryBatch.deleteMany({ where: { companyId: company.id } });
      await prisma.inventoryStock.deleteMany({ where: { companyId: company.id } });
      await prisma.product.deleteMany({ where: { companyId: company.id } });
      await prisma.accountMaster.deleteMany({ where: { companyId: company.id } });
      await prisma.accountGroup.deleteMany({ where: { companyId: company.id } });
      await prisma.clientAdmin.deleteMany({ where: { id: company.id } });
    }
  });
});
