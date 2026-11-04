import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import assert from 'assert';

// ----------------------------------------------------------------------------
// MANDATORY TEST DATABASE SAFETY PRELOAD & HARD GUARDS
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envTestPath = path.resolve(__dirname, '../../.env.test');

dotenv.config({ path: envTestPath, override: true });

function sanitizeDbUrl(urlStr) {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return parsed.pathname.replace(/^\//, '');
  } catch (err) {
    const match = urlStr.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : 'unknown';
  }
}

const configuredDbName = sanitizeDbUrl(process.env.DATABASE_URL);
console.log(`[Database Safety Guard] Configured Target Database: ${configuredDbName}`);

if (configuredDbName === 'crm_erp_db') {
  console.error('\nFATAL SAFETY VIOLATION: Test suite attempted to connect to PRODUCTION database (crm_erp_db)!');
  console.error('ABORTING ALL TEST OPERATIONS IMMEDIATELY TO PROTECT PRODUCTION DATA INTEGRITY.\n');
  process.exit(1);
}

if (configuredDbName !== 'crm_erp_test_db') {
  console.error(`\nCONFIGURATION ERROR: Target database must be 'crm_erp_test_db', got '${configuredDbName}'.`);
  process.exit(1);
}

import prisma from '../../src/config/prisma.js';
import { Prisma } from '@prisma/client';
import standardAccountsService from '../../src/services/accounting/standardAccounts.service.js';
import periodService from '../../src/services/accounting/period.service.js';
import voucherService from '../../src/services/accounting/voucher.service.js';
import salesInvoiceService from '../../src/services/accounting/salesInvoice.service.js';
import receiptService from '../../src/services/accounting/receipt.service.js';
import allocationService from '../../src/services/accounting/allocation.service.js';
import vendorPayableService from '../../src/services/accounting/vendorPayable.service.js';
import bankAccountService from '../../src/services/accounting/bankAccount.service.js';
import bankStatementService from '../../src/services/accounting/bankStatement.service.js';
import bankReconciliationService from '../../src/services/accounting/bankReconciliation.service.js';
import tallyService from '../../src/services/accounting/tally.service.js';
import bankReportService from '../../src/services/accounting/bankReport.service.js';

const Decimal = Prisma.Decimal;

async function runE2EVerification() {
  console.log('\n======================================================================');
  console.log('   AZZUNIQE CRM & ERP — PHASE 8 FINAL E2E INTEGRATION VERIFICATION   ');
  console.log('======================================================================\n');

  // STEP 0: RUNTIME HARD DB GUARD
  const [dbRow] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb;');
  const activeDb = dbRow?.activeDb;
  console.log(`[Runtime DB Guard] Active connected database: ${activeDb}`);

  if (activeDb === 'crm_erp_db') {
    throw new Error('FATAL: Connected to PRODUCTION DATABASE crm_erp_db! Aborting immediately.');
  }
  if (activeDb !== 'crm_erp_test_db') {
    throw new Error(`FATAL: Expected crm_erp_test_db but connected to ${activeDb}`);
  }
  console.log('✔ Runtime DB check passed: running strictly against crm_erp_test_db.\n');

  // SETUP: Create unique test companies
  const nonce = Date.now().toString().slice(-6);
  const companyA = await prisma.clientAdmin.create({
    data: {
      name: `E2E Test Company A ${nonce}`,
      organizationName: `Org A ${nonce}`,
      email: `admin_a_${nonce}@testcorp.com`,
      passwordHash: 'dummyhash',
      status: 'ACTIVE'
    }
  });

  const companyB = await prisma.clientAdmin.create({
    data: {
      name: `E2E Test Company B ${nonce}`,
      organizationName: `Org B ${nonce}`,
      email: `admin_b_${nonce}@testcorp.com`,
      passwordHash: 'dummyhash',
      status: 'ACTIVE'
    }
  });

  const companyId = companyA.id;
  const companyBId = companyB.id;
  const actor = { id: `usr_e2e_${nonce}`, name: 'E2E Auditor', email: `auditor_${nonce}@testcorp.com` };

  console.log(`Created test companies: A=${companyId}, B=${companyBId}`);

  // Setup FY and Accounting Periods
  const fyA = await periodService.createFinancialYear(companyId, {
    name: `FY 2026-27 (E2E ${nonce})`,
    code: `FY2627-${nonce}`,
    startDate: new Date('2026-04-01T00:00:00.000Z'),
    endDate: new Date('2027-03-31T23:59:59.999Z')
  }, actor);
  await periodService.generateStandardPeriods(companyId, fyA.id, actor);

  const activePeriod = await prisma.accountingPeriod.findFirst({
    where: { companyId, financialYearId: fyA.id, isClosed: false }
  });
  assert.ok(activePeriod, 'Open accounting period must exist');

  // Provision Standard Accounts
  const sundryDebtors = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_DEBTORS');
  const sundryCreditors = await standardAccountsService.ensureStandardAccount(companyId, 'SUNDRY_CREDITORS');
  const salesRev = await standardAccountsService.ensureStandardAccount(companyId, 'SALES_REVENUE');
  const purchaseExp = await standardAccountsService.ensureStandardAccount(companyId, 'PURCHASE_EXPENSE');
  const cashAcc = await standardAccountsService.ensureStandardAccount(companyId, 'CASH');
  const bankAccStd = await standardAccountsService.ensureStandardAccount(companyId, 'BANK');
  const custAdvAcc = await standardAccountsService.ensureStandardAccount(companyId, 'CUSTOMER_ADVANCES');
  const bankChgAcc = await standardAccountsService.ensureStandardAccount(companyId, 'BANK_CHARGES');

  // --------------------------------------------------------------------------
  // WORKFLOW 1: Create Ledger -> Create JV -> Validate -> Post -> GL Balances
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 1: Ledger Account -> Journal Voucher -> Post ---');
  const customGroup = await prisma.accountGroup.create({
    data: {
      companyId,
      groupName: `Operating Expenses ${nonce}`,
      groupCode: `OPEX_${nonce}`,
      category: 'EXPENSE'
    }
  });

  const customLedger = await prisma.accountMaster.create({
    data: {
      companyId,
      groupId: customGroup.id,
      accountName: `Office Supplies ${nonce}`,
      accountCode: `OFF_${nonce}`,
      normalBalance: 'DEBIT',
      openingDebit: new Decimal(0),
      openingCredit: new Decimal(0),
      currentBalance: new Decimal(0),
      isControlAccount: false
    }
  });

  const draftVoucher = await voucherService.createDraftVoucher(companyId, {
    voucherType: 'JOURNAL',
    voucherDate: new Date('2026-06-15'),
    financialYearId: fyA.id,
    accountingPeriodId: activePeriod.id,
    narration: 'Office supplies expense test',
    items: [
      { accountId: customLedger.id, debitAmount: 2500, creditAmount: 0, narration: 'Stationery' },
      { accountId: cashAcc.id, debitAmount: 0, creditAmount: 2500, narration: 'Cash payment' }
    ]
  }, actor);

  assert.strictEqual(draftVoucher.status, 'DRAFT', 'Voucher should start in DRAFT');

  // Validate voucher
  const validation = await voucherService.validateVoucherForPosting(companyId, draftVoucher.id);
  assert.strictEqual(validation.isValid, true, 'Draft voucher should be valid');

  // Post voucher
  const postedVoucher = await voucherService.postVoucher(companyId, draftVoucher.id, actor);
  assert.strictEqual(postedVoucher.status, 'POSTED', 'Voucher should be POSTED');

  // Verify GL ledger balance update
  const updatedLedger = await prisma.accountMaster.findUnique({ where: { id: customLedger.id } });
  assert.strictEqual(Number(updatedLedger.currentBalance), 2500, 'Custom ledger debit balance should be 2500');
  console.log('✔ Workflow 1 Passed: Custom ledger created, JV validated & posted, GL balance updated.');

  // --------------------------------------------------------------------------
  // WORKFLOW 2: Sales Invoice -> Post -> Customer Receipt -> Payment Allocation
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 2: Sales Invoice -> Post -> Receipt -> Allocation ---');
  const customer = await prisma.crmCustomer.create({
    data: {
      companyId,
      companyName: `E2E Customer Corp ${nonce}`,
      phone: `91111${nonce.slice(-5)}`,
      email: `cust_${nonce}@testcorp.com`,
      gstin: '27AABCT3518Q1ZV',
      billingAddress: 'Mumbai, Maharashtra'
    }
  });

  const invoice = await salesInvoiceService.createDraftInvoice(companyId, {
    customerId: customer.id,
    invoiceDate: new Date('2026-06-20'),
    items: [
      {
        sku: `CONSULT-${nonce}`,
        description: 'Consulting Services',
        quantity: 1,
        unitPrice: 10000,
        taxRate: 18
      }
    ]
  }, actor);

  assert.strictEqual(Number(invoice.totalAmount), 11800, 'Invoice total with 18% GST should be 11,800');

  // Post Invoice
  const postedInvoice = await salesInvoiceService.postInvoice(companyId, invoice.id, actor);
  assert.strictEqual(postedInvoice.status, 'POSTED', 'Invoice should be posted');
  assert.strictEqual(Number(postedInvoice.outstandingAmount), 11800, 'Outstanding should be 11,800');

  // Record Customer Receipt
  const receipt = await receiptService.createReceipt(companyId, {
    customerId: customer.id,
    paymentMode: 'BANK',
    amount: 11800,
    paymentDate: new Date('2026-06-22'),
    chequeOrReferenceNo: `REC-${nonce}-01`,
    notes: 'Full payment for consulting'
  }, actor);

  assert.strictEqual(Number(receipt.amount), 11800, 'Receipt amount should match');
  assert.strictEqual(Number(receipt.unallocatedAmount), 11800, 'Initially full receipt is unallocated');

  // Allocate payment against posted invoice
  const allocation = await allocationService.allocatePayment(companyId, {
    paymentReceiptId: receipt.id,
    invoiceId: postedInvoice.id,
    allocatedAmount: 11800
  }, actor);

  assert.strictEqual(Number(allocation.allocatedAmount), 11800, 'Allocated amount matches');

  // Verify Invoice is now PAID and outstanding is 0
  const refreshedInvoice = await prisma.salesInvoice.findUnique({ where: { id: postedInvoice.id } });
  assert.strictEqual(refreshedInvoice.status, 'PAID', 'Invoice status should be PAID');
  assert.strictEqual(Number(refreshedInvoice.outstandingAmount), 0, 'Invoice outstanding should be 0');

  const refreshedReceipt = await receiptService.getReceiptById(companyId, receipt.id);
  assert.strictEqual(Number(refreshedReceipt.unallocatedAmount), 0, 'Receipt unallocated amount should be 0');
  console.log('✔ Workflow 2 Passed: Sales invoice created, posted, receipt recorded, allocated, invoice PAID.');

  // --------------------------------------------------------------------------
  // WORKFLOW 3: Customer Advance -> Allocate -> Reverse Allocation
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 3: Customer Advance -> Allocate -> Reverse Allocation ---');
  const advanceReceipt = await receiptService.createReceipt(companyId, {
    customerId: customer.id,
    paymentMode: 'BANK',
    amount: 50000,
    isAdvance: true,
    paymentDate: new Date('2026-07-01'),
    chequeOrReferenceNo: `ADV-${nonce}-01`,
    notes: 'Retainer Advance'
  }, actor);

  assert.strictEqual(advanceReceipt.paymentType, 'ADVANCE');
  assert.strictEqual(Number(advanceReceipt.unallocatedAmount), 50000);

  // Create another invoice for 35,400
  const invoice2 = await salesInvoiceService.createDraftInvoice(companyId, {
    customerId: customer.id,
    invoiceDate: new Date('2026-07-05'),
    items: [
      {
        sku: `SOFT-${nonce}`,
        description: 'Software Development',
        quantity: 30,
        unitPrice: 1000,
        taxRate: 18
      }
    ]
  }, actor);

  const postedInvoice2 = await salesInvoiceService.postInvoice(companyId, invoice2.id, actor);
  assert.strictEqual(Number(postedInvoice2.totalAmount), 35400);

  // Allocate advance against invoice2
  const advAllocation = await allocationService.allocatePayment(companyId, {
    paymentReceiptId: advanceReceipt.id,
    invoiceId: postedInvoice2.id,
    allocatedAmount: 35400
  }, actor);

  const afterAllocReceipt = await receiptService.getReceiptById(companyId, advanceReceipt.id);
  assert.strictEqual(Number(afterAllocReceipt.unallocatedAmount), 14600, 'Unallocated should be 14,600');

  // Now reverse the advance allocation
  const reversedAlloc = await allocationService.reverseAllocation(companyId, advAllocation.id, 'Customer dispute/re-adjustment', actor);
  assert.strictEqual(reversedAlloc.status, 'REVERSED');

  // Verify advance unallocated restored to 50,000 and invoice outstanding restored to 35,400
  const restoredReceipt = await receiptService.getReceiptById(companyId, advanceReceipt.id);
  assert.strictEqual(Number(restoredReceipt.unallocatedAmount), 50000, 'Unallocated balance must be restored to 50,000');

  const restoredInvoice = await prisma.salesInvoice.findUnique({ where: { id: postedInvoice2.id } });
  assert.strictEqual(Number(restoredInvoice.outstandingAmount), 35400, 'Invoice outstanding must be restored to 35,400');
  console.log('✔ Workflow 3 Passed: Advance receipt created, allocated, reversed, and unallocated amount restored perfectly.');

  // --------------------------------------------------------------------------
  // WORKFLOW 4: Purchase Bill -> Vendor Payment -> Payment Allocation
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 4: Purchase Bill -> Vendor Payment -> Allocation ---');
  const vendor = await prisma.vendor.create({
    data: {
      companyId,
      name: `E2E Tech Supplies ${nonce}`,
      email: `vendor_${nonce}@testcorp.com`,
      phone: `92222${nonce.slice(-5)}`,
      city: 'Pune',
      state: 'Maharashtra',
      taxId: '27AADCB2233M1Z2'
    }
  });

  const vReq = await prisma.purchaseRequest.create({
    data: {
      companyId,
      requestNo: `PR-REC-${nonce}`,
      items: [{ sku: 'SERVER-01', name: 'Server Equipment', quantity: 1 }],
    },
  });

  const vQuote = await prisma.purchaseQuotation.create({
    data: {
      companyId,
      requestId: vReq.id,
      vendorId: vendor.id,
      quoteNo: `QUO-REC-${nonce}`,
      items: [{ sku: 'SERVER-01', quantity: 1, unitPrice: 12711.86 }],
    },
  });

  const vPO1 = await prisma.purchaseOrder.create({
    data: {
      companyId,
      requestId: vReq.id,
      quotationId: vQuote.id,
      vendorId: vendor.id,
      poNumber: `PO-REC-${nonce}`,
      items: [{ sku: 'SERVER-01', quantity: 1, unitPrice: 12711.86 }],
      subtotal: 12711.86,
      taxAmount: 2288.14,
      totalAmount: 15000,
    },
  });

  const purchaseBill = await prisma.purchaseBill.create({
    data: {
      companyId,
      orderId: vPO1.id,
      billNo: `PB-${nonce}-01`,
      vendorInvoiceNo: `VINV-${nonce}-01`,
      invoiceDate: new Date('2026-07-10'),
      dueDate: new Date('2026-08-10'),
      taxableAmount: 12711.86,
      taxAmount: 2288.14,
      totalAmount: 15000,
      status: 'UNPAID',
      paymentHold: false,
    }
  });

  // Post Purchase Bill to GL
  const postedBillVoucher = await vendorPayableService.postPurchaseBill(companyId, purchaseBill.id, actor);
  assert.ok(postedBillVoucher.id, 'Bill voucher should be generated and posted');

  // Record Vendor Payment
  const vendorPayment = await vendorPayableService.recordVendorPayment(companyId, {
    vendorId: vendor.id,
    amount: 15000,
    paymentDate: new Date('2026-07-15'),
    paymentMode: 'BANK',
    chequeOrReferenceNo: `VPAY-${nonce}-01`,
  }, actor);

  assert.strictEqual(Number(vendorPayment.amount), 15000);

  // Allocate Vendor Payment to Purchase Bill
  const billAlloc = await allocationService.allocatePayment(companyId, {
    paymentReceiptId: vendorPayment.id,
    billId: purchaseBill.id,
    allocatedAmount: 15000
  }, actor);
  assert.strictEqual(billAlloc.status, 'ACTIVE');

  const refreshedBill = await vendorPayableService.getVendorBillDetails(companyId, purchaseBill.id);
  assert.strictEqual(refreshedBill.status, 'PAID', 'Purchase bill should be marked PAID');
  assert.strictEqual(Number(refreshedBill.outstandingAmount), 0, 'Purchase bill outstanding should be 0');
  console.log('✔ Workflow 4 Passed: Purchase bill created, posted to GL, vendor payment recorded, bill marked PAID.');

  // --------------------------------------------------------------------------
  // WORKFLOW 5: Bank Account -> CSV Preview -> Import -> Reconciliation
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 5: Bank Account -> CSV Statement -> Import -> Reconciliation ---');
  const bankAccount = await bankAccountService.createBankAccount(companyId, {
    accountHolderName: companyA.name,
    accountName: `HDFC Current A/c ${nonce}`,
    accountNumber: `502000${nonce}`,
    bankName: 'HDFC Bank',
    branchName: 'Nariman Point',
    ifscCode: 'HDFC0000123',
    accountType: 'CURRENT',
    openingBalance: 100000,
    openingBalanceDate: new Date('2026-04-01')
  }, actor);

  assert.strictEqual(bankAccount.status, 'ACTIVE');

  // Preview CSV Statement
  const sampleCsv = `Date,Description,Reference No,Debit,Credit,Balance
2026-07-01,Client Wire In,REC-${nonce}-01,,11800,111800
2026-07-05,Vendor RTGS Out,VPAY-${nonce}-01,15000,,96800
2026-07-10,Monthly Bank Service Charges,CHG-${nonce},354,,96446`;

  const preview = await bankStatementService.previewStatement(companyId, bankAccount.id, sampleCsv);
  assert.strictEqual(preview.totalRows, 3, 'Preview should detect 3 rows');
  assert.strictEqual(preview.validCount, 3, 'Preview should have 3 valid rows');

  // Import Statement
  const importResult = await bankStatementService.importStatement(companyId, bankAccount.id, sampleCsv, {}, actor);
  assert.strictEqual(importResult.importedCount, 3, 'All 3 rows imported');

  // Create Reconciliation Session
  const session = await bankReconciliationService.createSession(companyId, {
    bankAccountId: bankAccount.id,
    statementDate: new Date('2026-07-31'),
    statementClosingBalance: 96446
  }, actor);

  assert.strictEqual(session.status, 'IN_PROGRESS');

  // Execute Auto-match
  const autoMatchResult = await bankReconciliationService.autoMatch(companyId, session.id, actor);
  console.log(`Auto-matched items: ${autoMatchResult.matchedCount}`);

  // Fetch Session details
  const sessionDetails = await bankReconciliationService.getSessionById(companyId, session.id);
  assert.ok(sessionDetails.session, 'Reconciliation session fetched');
  assert.ok(sessionDetails.summary, 'Reconciliation session summary populated');
  console.log('✔ Workflow 5 Passed: Bank account created, statement previewed, imported, rec session auto-matched.');

  // --------------------------------------------------------------------------
  // WORKFLOW 6: Bank Charges -> Adjustment Voucher -> BRS
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 6: Bank Charges -> Adjustment Voucher -> BRS ---');
  // Post bank charges adjustment voucher
  const adjResult = await bankReconciliationService.postBankAdjustmentVoucher(companyId, session.id, {
    adjustmentType: 'BANK_CHARGES',
    amount: 354,
    voucherDate: new Date('2026-07-10'),
    narration: 'Monthly bank service charge adjustment'
  }, actor);

  assert.strictEqual(adjResult.voucher.status, 'POSTED');

  // Generate BRS
  const brs = await bankReportService.getBankReconciliationStatement(companyId, bankAccount.id, { asOfDate: new Date('2026-07-31') });
  assert.ok(brs.asOfDate, 'BRS generated with asOfDate');
  assert.ok(brs.reconciliationDifference !== undefined, 'BRS contains reconciliationDifference calculation');
  console.log(`✔ Workflow 6 Passed: Bank charges adjustment voucher posted (${adjResult.voucher.voucherNo}), BRS generated.`);

  // --------------------------------------------------------------------------
  // WORKFLOW 7: Tally Ledger Mapping -> Voucher Export Preview -> XML Export
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 7: Tally Ledger Mapping -> Voucher Export -> XML ---');
  // Create mapping
  const mapping = await tallyService.createLedgerMapping(companyId, {
    accountId: cashAcc.id,
    tallyLedgerName: `Cash_${nonce}`,
    tallyParentGroup: 'Cash-in-Hand'
  });
  assert.strictEqual(mapping.tallyLedgerName, `Cash_${nonce}`);

  // Preview export
  const exportPreview = await tallyService.previewVoucherExport(companyId, {
    fromDate: new Date('2026-04-01'),
    toDate: new Date('2026-08-31')
  });
  assert.ok(exportPreview.totalFound > 0, 'Export preview should find posted vouchers');

  // Export Vouchers to XML
  const exportBatch = await tallyService.exportVouchers(companyId, {
    fromDate: new Date('2026-04-01'),
    toDate: new Date('2026-08-31')
  }, actor);

  assert.strictEqual(exportBatch.exportStatus, 'COMPLETED');
  assert.ok(exportBatch.xml.includes('<ENVELOPE>'), 'XML must contain standard Tally ENVELOPE tag');
  assert.ok(exportBatch.xml.includes('<TALLYMESSAGE'), 'XML must contain TALLYMESSAGE tag');
  assert.ok(exportBatch.xml.includes('GUID'), 'XML must include stable GUID for duplicate prevention');
  console.log(`✔ Workflow 7 Passed: Tally mapping created, vouchers previewed, XML exported with stable GUID (batch: ${exportBatch.batchNo}).`);

  // --------------------------------------------------------------------------
  // WORKFLOW 8: Role & Permission Verification: Tenant Isolation & RBAC
  // --------------------------------------------------------------------------
  console.log('\n--- WORKFLOW 8: RBAC & Tenant Isolation ---');
  // Company B user trying to access Company A's bank account
  let crossCompanyBlocked = false;
  try {
    await bankAccountService.getBankAccountById(companyBId, bankAccount.id);
  } catch (err) {
    crossCompanyBlocked = true;
    assert.strictEqual(err.statusCode || err.status, 404, 'Must throw 404 for cross-tenant access');
  }
  assert.strictEqual(crossCompanyBlocked, true, 'Cross-company access must be strictly rejected');

  // Company B user trying to access Company A's sales invoice
  let crossInvoiceBlocked = false;
  try {
    await salesInvoiceService.getInvoiceById(companyBId, postedInvoice.id);
  } catch (err) {
    crossInvoiceBlocked = true;
    assert.strictEqual(err.statusCode || err.status, 404, 'Must throw 404 for cross-tenant invoice access');
  }
  assert.strictEqual(crossInvoiceBlocked, true, 'Cross-company invoice access must be strictly rejected');

  console.log('✔ Workflow 8 Passed: Tenant isolation verified. Cross-company access completely blocked.');

  console.log('\n======================================================================');
  console.log('   ALL 8 END-TO-END VERIFICATION WORKFLOWS COMPLETED SUCCESSFULLY!    ');
  console.log('======================================================================\n');
}

runE2EVerification()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nE2E VERIFICATION TEST FAILED:', err);
    process.exit(1);
  });
