import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ----------------------------------------------------------------------------
// MANDATORY TEST DATABASE SAFETY PRELOAD & HARD GUARDS
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envTestPath = path.resolve(__dirname, '../../.env.test');

dotenv.config({ path: envTestPath });

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
  console.error('\n🚨 FATAL SAFETY VIOLATION: Test suite attempted to connect to PRODUCTION database (crm_erp_db)!');
  console.error('ABORTING ALL TEST OPERATIONS IMMEDIATELY TO PROTECT PRODUCTION DATA INTEGRITY.\n');
  process.exit(1);
}

if (configuredDbName !== 'crm_erp_test_db') {
  console.error(`\n🚨 CONFIGURATION ERROR: Target database must be 'crm_erp_test_db', got '${configuredDbName}'.`);
  process.exit(1);
}

import prisma from '../../src/config/prisma.js';
import { Prisma } from '@prisma/client';
import bankAccountService from '../../src/services/accounting/bankAccount.service.js';
import bankStatementService from '../../src/services/accounting/bankStatement.service.js';
import bankReconciliationService from '../../src/services/accounting/bankReconciliation.service.js';
import tallyService from '../../src/services/accounting/tally.service.js';
import bankReportService from '../../src/services/accounting/bankReport.service.js';
import voucherService from '../../src/services/accounting/voucher.service.js';
import standardAccountsService from '../../src/services/accounting/standardAccounts.service.js';
import periodService from '../../src/services/accounting/period.service.js';

const Decimal = Prisma.Decimal;

let passedTests = 0;
let failedTests = 0;

async function test(title, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ FAIL: ${title} -> ${err.message}`);
    failedTests++;
  }
}

async function runBankingAndTallyTests() {
  console.log('========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 8 Step 2 Part 3: Banking, Rec & Tally Tests');
  console.log(`Target Database: ${configuredDbName} (ISOLATED TEST DATABASE)`);
  console.log('Verifying: Bank Accounts, Statement CSV Import, BRS Engine, Adjustments, Tally XML');
  console.log('========================================================================\n');

  // Verify runtime connection
  const [dbRow] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb;');
  const activeDb = dbRow?.activeDb;
  console.log(`[Runtime Connection Verification] Active MySQL Database: ${activeDb}\n`);

  if (activeDb !== 'crm_erp_test_db') {
    console.error(`🚨 FATAL: Active database connection is '${activeDb}'. Aborting.`);
    process.exit(1);
  }

  // Setup dedicated test tenant
  const company = await prisma.clientAdmin.create({
    data: {
      name: `Banking & Tally Test Co - ${Date.now()}`,
      email: `bank_tally_${Date.now()}@testcorp.com`,
      organizationName: `Banking Test Org`,
      passwordHash: 'dummy-hashed-secret',
      status: 'ACTIVE',
    },
  });

  const actor = { id: 'usr-bank-officer', name: 'Treasury Officer', email: 'officer@testcorp.com' };

  // Setup FY and Periods
  const fy = await periodService.createFinancialYear(
    company.id,
    {
      name: 'FY 2026-27',
      code: `FY2627-${Date.now().toString().slice(-4)}`,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    },
    actor
  );
  await periodService.generateStandardPeriods(company.id, fy.id, actor);

  // Setup Customer and Vendor for vouchers
  const customer = await prisma.crmCustomer.create({
    data: {
      companyId: company.id,
      companyName: 'Tata Power Solar Systems',
      phone: '9900112233',
    },
  });

  const vendor = await prisma.vendor.create({
    data: {
      companyId: company.id,
      name: 'Schneider Electric India Ltd',
      phone: '9888112233',
    },
  });

  // State variables across tests
  let bankAccount1 = null;
  let bankAccount2 = null;
  let importedBatchId = null;
  let reconSession = null;
  let testVoucher1 = null;
  let testVoucher2 = null;

  // =========================================================================
  // 1. BANK ACCOUNT MANAGEMENT
  // =========================================================================

  await test('1.1 Bank Account Creation: Auto-masking and default BANK ledger linkage', async () => {
    bankAccount1 = await bankAccountService.createBankAccount(
      company.id,
      {
        bankName: 'HDFC Bank Ltd',
        accountHolderName: 'Azzuniqe Energy Pvt Ltd',
        accountNumber: '50200012345678',
        ifscCode: 'HDFC0001234',
        branchName: 'C-Scheme, Jaipur',
        accountType: 'CURRENT',
        openingBalance: 100000,
        isDefault: true,
      },
      actor
    );

    if (!bankAccount1.id) throw new Error('Bank account id missing.');
    if (bankAccount1.maskedAccountNumber !== 'XXXXXXXXXX5678') {
      throw new Error(`Expected masked number XXXXXXXXXX5678, got ${bankAccount1.maskedAccountNumber}`);
    }
    if (!bankAccount1.accountId) throw new Error('Default GL ledger account was not linked.');
    if (new Decimal(bankAccount1.currentBalance).toNumber() !== 100000) {
      throw new Error(`Expected currentBalance 100000, got ${bankAccount1.currentBalance}`);
    }
    if (!bankAccount1.isDefault) throw new Error('isDefault should be true.');
  });

  await test('1.2 Duplicate Account Number Prevention within same company', async () => {
    let duplicateError = false;
    try {
      await bankAccountService.createBankAccount(
        company.id,
        {
          bankName: 'Another Branch HDFC',
          accountHolderName: 'Azzuniqe Energy Pvt Ltd',
          accountNumber: '50200012345678', // Same account number
          ifscCode: 'HDFC0009999',
        },
        actor
      );
    } catch (err) {
      if (err.message.includes('already exists')) {
        duplicateError = true;
      }
    }
    if (!duplicateError) throw new Error('Should have rejected duplicate bank account number.');
  });

  await test('1.3 Update Bank Account: Update IFSC, branch, and status', async () => {
    const updated = await bankAccountService.updateBankAccount(
      company.id,
      bankAccount1.id,
      {
        branchName: 'MI Road Branch, Jaipur',
        overdraftLimit: 50000,
      },
      actor
    );

    if (updated.branchName !== 'MI Road Branch, Jaipur') {
      throw new Error(`Expected branch MI Road Branch, Jaipur, got ${updated.branchName}`);
    }
    if (new Decimal(updated.overdraftLimit).toNumber() !== 50000) {
      throw new Error(`Expected overdraft limit 50000, got ${updated.overdraftLimit}`);
    }
  });

  await test('1.4 Bank Account Balances and Summaries Query', async () => {
    const ledgerBal = await bankAccountService.getLedgerBalance(company.id, bankAccount1.id);
    const stmtBal = await bankAccountService.getStatementBalance(company.id, bankAccount1.id);
    const unrecSum = await bankAccountService.getUnreconciledTransactionSummary(company.id, bankAccount1.id);

    if (ledgerBal.ledgerAccountId !== bankAccount1.accountId) {
      throw new Error('Ledger balance account ID does not match linked account.');
    }
    if (stmtBal.statementBalance === undefined) throw new Error('Statement balance undefined.');
    if (unrecSum.unreconciledBankCount !== 0) throw new Error('Expected 0 unreconciled transactions initially.');
  });

  // =========================================================================
  // 2. BANK STATEMENT IMPORT (CSV)
  // =========================================================================

  const sampleCsvContent = `Date,Value Date,Description,Ref No,Txn ID,Debit,Credit,Balance
2026-05-01,2026-05-01,Customer RTGS Inward Tata Power,REF-TP-001,TXN1001,0,50000.00,150000.00
2026-05-03,2026-05-03,Vendor NEFT Payment Schneider,REF-SE-001,TXN1002,25000.00,0,125000.00
2026-05-05,2026-05-05,Bank Monthly Service Charges,CHG-MAY-01,TXN1003,1180.00,0,123820.00
2026-05-07,2026-05-07,Quarterly Interest Credited,INT-Q1-01,TXN1004,0,3500.00,127320.00
2026-05-10,2026-05-10,Direct Utility Payment Electricity,BILL-ELEC-01,TXN1005,7320.00,0,120000.00`;

  await test('2.1 CSV Statement Preview: Parse rows and validate structure', async () => {
    const preview = await bankStatementService.previewStatement(
      company.id,
      bankAccount1.id,
      sampleCsvContent
    );

    if (preview.totalRows !== 5) throw new Error(`Expected 5 total rows, got ${preview.totalRows}`);
    if (preview.validCount !== 5) throw new Error(`Expected 5 valid rows, got ${preview.validCount}`);
    if (preview.rejectedCount !== 0) throw new Error(`Expected 0 rejected rows, got ${preview.rejectedCount}`);
  });

  await test('2.2 CSV Statement Validation: Reject negative amounts and invalid date rows', async () => {
    const badCsv = `Date,Description,Debit,Credit
invalid-date,Bad Date Row,0,1000
2026-05-01,Negative Amount Row,-500,0
2026-05-02,Both Debit and Credit,500,500
2026-05-03,Zero Amount Row,0,0
2026-05-04,Good Row,100,0`;

    const preview = await bankStatementService.previewStatement(company.id, bankAccount1.id, badCsv);
    if (preview.validCount !== 1) throw new Error(`Expected exactly 1 valid row, got ${preview.validCount}`);
    if (preview.rejectedCount !== 4) throw new Error(`Expected 4 rejected rows, got ${preview.rejectedCount}`);
  });

  await test('2.3 CSV Statement Import: Transactional creation and running balance update', async () => {
    const importResult = await bankStatementService.importStatement(
      company.id,
      bankAccount1.id,
      sampleCsvContent,
      {},
      actor
    );

    if (importResult.importedCount !== 5) {
      throw new Error(`Expected 5 imported transactions, got ${importResult.importedCount}`);
    }
    importedBatchId = importResult.statementBatchId;

    // Check account current balance updated to latest running balance: 120,000
    const acct = await prisma.bankAccount.findUnique({ where: { id: bankAccount1.id } });
    if (new Decimal(acct.currentBalance).toNumber() !== 120000) {
      throw new Error(`Expected bank account balance updated to 120000, got ${acct.currentBalance}`);
    }
  });

  await test('2.4 Duplicate Statement Import Prevention: Detect and reject duplicate TXN IDs', async () => {
    let duplicateRejected = false;
    try {
      await bankStatementService.importStatement(
        company.id,
        bankAccount1.id,
        sampleCsvContent, // Re-importing exact same statement
        { skipRejected: false },
        actor
      );
    } catch (err) {
      if (err.message.includes('invalid/duplicate row') || err.message.includes('No valid rows found')) {
        duplicateRejected = true;
      }
    }
    if (!duplicateRejected) throw new Error('Expected duplicate statement import to be rejected.');
  });

  // =========================================================================
  // 3. BOOK JOURNAL VOUCHERS CREATION FOR RECONCILIATION
  // =========================================================================

  await test('3.1 Create and Post Book Vouchers for Matching (Receipt & Payment)', async () => {
    const debtorsAcct = await standardAccountsService.ensureStandardAccount(company.id, 'SUNDRY_DEBTORS');
    const creditorsAcct = await standardAccountsService.ensureStandardAccount(company.id, 'SUNDRY_CREDITORS');

    // Voucher 1: Customer Receipt ₹50,000 (Dr Bank, Cr Sundry Debtors)
    const draftV1 = await voucherService.createDraftVoucher(
      company.id,
      {
        voucherType: 'RECEIPT',
        voucherDate: new Date('2026-05-01'),
        referenceNo: 'REF-TP-001',
        narration: 'Receipt from Tata Power Solar',
        items: [
          { accountId: bankAccount1.accountId, debitAmount: 50000, creditAmount: 0 },
          { accountId: debtorsAcct.id, debitAmount: 0, creditAmount: 50000, customerId: customer.id },
        ],
      },
      actor
    );
    testVoucher1 = await voucherService.postVoucher(company.id, draftV1.id, actor);

    // Voucher 2: Vendor Payment ₹25,000 (Dr Sundry Creditors, Cr Bank)
    const draftV2 = await voucherService.createDraftVoucher(
      company.id,
      {
        voucherType: 'PAYMENT',
        voucherDate: new Date('2026-05-03'),
        referenceNo: 'REF-SE-001',
        narration: 'Payment to Schneider Electric',
        items: [
          { accountId: creditorsAcct.id, debitAmount: 25000, creditAmount: 0, vendorId: vendor.id },
          { accountId: bankAccount1.accountId, debitAmount: 0, creditAmount: 25000 },
        ],
      },
      actor
    );
    testVoucher2 = await voucherService.postVoucher(company.id, draftV2.id, actor);

    if (testVoucher1.status !== 'POSTED' || testVoucher2.status !== 'POSTED') {
      throw new Error('Vouchers not POSTED.');
    }
  });

  // =========================================================================
  // 4. BANK RECONCILIATION ENGINE
  // =========================================================================

  await test('4.1 Create Reconciliation Session: Calculate ledger balance and initial difference', async () => {
    // Bank statement closing balance as of 2026-05-31 is 120,000
    reconSession = await bankReconciliationService.createSession(
      company.id,
      {
        bankAccountId: bankAccount1.id,
        statementDate: new Date('2026-05-31'),
        statementClosingBalance: 120000,
        notes: 'May 2026 Bank Reconciliation',
      },
      actor
    );

    if (!reconSession.id) throw new Error('Reconciliation session id missing.');
    if (reconSession.status !== 'IN_PROGRESS') throw new Error('Status must be IN_PROGRESS.');
    // In books: Opening 0 + Receipt 50000 - Payment 25000 = 25000
    if (new Decimal(reconSession.ledgerClosingBalance).toNumber() !== 25000) {
      throw new Error(`Expected ledgerClosingBalance 25000, got ${reconSession.ledgerClosingBalance}`);
    }
  });

  await test('4.2 Manual Exact Matching: Match Customer Receipt ₹50,000', async () => {
    const bankTx = await prisma.bankTransaction.findFirst({
      where: { companyId: company.id, bankAccountId: bankAccount1.id, creditAmount: 50000 },
    });
    if (!bankTx) throw new Error('Bank transaction for 50000 not found.');

    const bankItem = testVoucher1.items.find((i) => i.accountId === bankAccount1.accountId);

    const matchItem = await bankReconciliationService.manualMatch(
      company.id,
      reconSession.id,
      {
        bankTransactionId: bankTx.id,
        voucherId: testVoucher1.id,
        voucherItemId: bankItem.id,
        matchedAmount: 50000,
        notes: 'Matched Tata Power Receipt',
      },
      actor
    );

    if (!matchItem.id) throw new Error('Reconciliation item not created.');

    const updatedTx = await prisma.bankTransaction.findUnique({ where: { id: bankTx.id } });
    if (updatedTx.reconciliationStatus !== 'RECONCILED') {
      throw new Error(`Expected status RECONCILED, got ${updatedTx.reconciliationStatus}`);
    }
  });

  await test('4.3 Duplicate Matching Rejection: Cannot match already reconciled transaction', async () => {
    const bankTx = await prisma.bankTransaction.findFirst({
      where: { companyId: company.id, bankAccountId: bankAccount1.id, creditAmount: 50000 },
    });

    let duplicateRejected = false;
    try {
      await bankReconciliationService.manualMatch(
        company.id,
        reconSession.id,
        {
          bankTransactionId: bankTx.id,
          voucherId: testVoucher1.id,
          matchedAmount: 50000,
        },
        actor
      );
    } catch (err) {
      if (err.message.includes('already matched')) duplicateRejected = true;
    }
    if (!duplicateRejected) throw new Error('Should have rejected duplicate match of same bank transaction.');
  });

  await test('4.4 Auto-Match Engine: Match Vendor Payment ₹25,000 by amount and reference', async () => {
    const autoResult = await bankReconciliationService.autoMatch(
      company.id,
      reconSession.id,
      { dateToleranceDays: 7 },
      actor
    );

    if (autoResult.matchedCount < 1) {
      throw new Error(`Expected at least 1 auto-matched transaction, got ${autoResult.matchedCount}`);
    }

    const matchedTx = await prisma.bankTransaction.findFirst({
      where: { companyId: company.id, bankAccountId: bankAccount1.id, debitAmount: 25000 },
    });
    if (matchedTx.reconciliationStatus !== 'RECONCILED') {
      throw new Error('Auto-matched transaction was not marked RECONCILED.');
    }
  });

  await test('4.5 Bank Difference Entries: Post Bank Charges ₹1,180 and Auto-Match', async () => {
    const bankChgTx = await prisma.bankTransaction.findFirst({
      where: { companyId: company.id, bankAccountId: bankAccount1.id, debitAmount: 1180 },
    });
    if (!bankChgTx) throw new Error('Bank charge transaction not found.');

    const adjustmentResult = await bankReconciliationService.postBankAdjustmentVoucher(
      company.id,
      reconSession.id,
      {
        adjustmentType: 'BANK_CHARGES',
        amount: 1180,
        voucherDate: new Date('2026-05-05'),
        referenceNo: 'CHG-MAY-01',
        narration: 'HDFC Monthly Service Charges May 2026',
        bankTransactionId: bankChgTx.id,
      },
      actor
    );

    if (adjustmentResult.voucher.status !== 'POSTED') {
      throw new Error('Bank adjustment voucher was not posted.');
    }
    if (!adjustmentResult.matchItem.id) {
      throw new Error('Adjustment was not matched with the bank transaction.');
    }

    const updatedTx = await prisma.bankTransaction.findUnique({ where: { id: bankChgTx.id } });
    if (updatedTx.reconciliationStatus !== 'RECONCILED') {
      throw new Error('Bank charges transaction was not reconciled.');
    }
  });

  await test('4.6 Bank Difference Entries: Post Interest Received ₹3,500 and Auto-Match', async () => {
    const intTx = await prisma.bankTransaction.findFirst({
      where: { companyId: company.id, bankAccountId: bankAccount1.id, creditAmount: 3500 },
    });
    if (!intTx) throw new Error('Interest transaction not found.');

    const intResult = await bankReconciliationService.postBankAdjustmentVoucher(
      company.id,
      reconSession.id,
      {
        adjustmentType: 'INTEREST_RECEIVED',
        amount: 3500,
        voucherDate: new Date('2026-05-07'),
        referenceNo: 'INT-Q1-01',
        narration: 'Savings / Auto-sweep interest credited',
        bankTransactionId: intTx.id,
      },
      actor
    );

    if (intResult.voucher.status !== 'POSTED') throw new Error('Interest voucher was not posted.');

    const updatedTx = await prisma.bankTransaction.findUnique({ where: { id: intTx.id } });
    if (updatedTx.reconciliationStatus !== 'RECONCILED') {
      throw new Error('Interest transaction was not reconciled.');
    }
  });

  await test('4.7 Unmatch / Reversal: Unmatch an item, restore UNRECONCILED status and re-match', async () => {
    const itemToUnmatch = await prisma.bankReconciliationItem.findFirst({
      where: { reconciliationId: reconSession.id, matchedAmount: 3500 },
    });
    if (!itemToUnmatch) throw new Error('Reconciliation item not found.');

    const unmatchResult = await bankReconciliationService.unmatchItem(
      company.id,
      reconSession.id,
      itemToUnmatch.id,
      actor
    );
    if (!unmatchResult.success) throw new Error('Unmatch failed.');

    const txAfterUnmatch = await prisma.bankTransaction.findUnique({
      where: { id: itemToUnmatch.bankTransactionId },
    });
    if (txAfterUnmatch.reconciliationStatus !== 'UNRECONCILED') {
      throw new Error('Transaction reconciliationStatus was not restored to UNRECONCILED.');
    }

    // Re-match it back
    await bankReconciliationService.manualMatch(
      company.id,
      reconSession.id,
      {
        bankTransactionId: itemToUnmatch.bankTransactionId,
        voucherId: itemToUnmatch.voucherId,
        matchedAmount: 3500,
        notes: 'Re-matched interest',
      },
      actor
    );
  });

  await test('4.8 Reconciliation Closing Rule: Prevent closing with unresolved difference without authorization', async () => {
    // Current state has unresolved difference (utility bill ₹7320 is unmatched)
    let closeRejected = false;
    try {
      await bankReconciliationService.closeSession(
        company.id,
        reconSession.id,
        {
          authorizedExceptionReason: '', // Empty reason
        },
        actor
      );
    } catch (err) {
      if (err.message.includes('authorized exception reason')) {
        closeRejected = true;
      }
    }
    if (!closeRejected) {
      throw new Error('Should have rejected closing reconciliation with unresolved difference without reason.');
    }

    // Now close with valid authorized exception reason
    const closedSession = await bankReconciliationService.closeSession(
      company.id,
      reconSession.id,
      {
        authorizedExceptionReason: 'Authorized by CFO: Direct utility debit of ₹7,320 pending electricity bill receipt',
      },
      actor
    );

    if (closedSession.status !== 'COMPLETED') {
      throw new Error(`Expected status COMPLETED, got ${closedSession.status}`);
    }
  });

  // =========================================================================
  // 5. TALLY PRIME INTEGRATION
  // =========================================================================

  let tallyMapping1 = null;

  await test('5.1 Tally Ledger Mapping: Map local Account to Tally Ledger Name', async () => {
    tallyMapping1 = await tallyService.createLedgerMapping(
      company.id,
      {
        accountId: bankAccount1.accountId,
        tallyLedgerName: 'HDFC Bank Main A/c',
        tallyParentGroup: 'Bank Accounts',
      },
      actor
    );

    if (!tallyMapping1.id) throw new Error('Tally mapping id missing.');
    if (tallyMapping1.tallyLedgerName !== 'HDFC Bank Main A/c') {
      throw new Error(`Expected HDFC Bank Main A/c, got ${tallyMapping1.tallyLedgerName}`);
    }
  });

  await test('5.2 Tally Duplicate Mapping Prevention: Cannot map same account or same tally name twice', async () => {
    let dupRejected = false;
    try {
      await tallyService.createLedgerMapping(
        company.id,
        {
          accountId: bankAccount1.accountId, // Same local account
          tallyLedgerName: 'Duplicate Name',
        },
        actor
      );
    } catch (err) {
      if (err.message.includes('already mapped')) dupRejected = true;
    }
    if (!dupRejected) throw new Error('Should have rejected duplicate mapping for the same local account.');
  });

  await test('5.3 Tally Mappings Preview: Check mapped vs unmapped accounts', async () => {
    const preview = await tallyService.previewLedgerMappings(company.id);
    if (preview.totalAccounts === 0) throw new Error('Total accounts should be greater than zero.');
    if (preview.mappedCount < 1) throw new Error('Expected at least 1 mapped account.');
  });

  await test('5.4 Tally Voucher Export: Generate standard Tally XML with stable GUID', async () => {
    const exportResult = await tallyService.exportVouchers(
      company.id,
      {
        voucherIds: [testVoucher1.id, testVoucher2.id],
      },
      actor
    );

    if (exportResult.voucherCount !== 2) {
      throw new Error(`Expected 2 exported vouchers, got ${exportResult.voucherCount}`);
    }
    if (!exportResult.batchNo.startsWith('TALLY-SYNC-')) {
      throw new Error(`Invalid batchNo format: ${exportResult.batchNo}`);
    }

    const xml = exportResult.xml;
    // Validate XML tags
    if (!xml.includes('<ENVELOPE>')) throw new Error('XML missing <ENVELOPE>');
    if (!xml.includes('<TALLYREQUEST>Import Data</TALLYREQUEST>')) throw new Error('XML missing TALLYREQUEST');
    if (!xml.includes('<VOUCHER VCHTYPE="Receipt"')) throw new Error('XML missing Receipt voucher');
    if (!xml.includes('<VOUCHER VCHTYPE="Payment"')) throw new Error('XML missing Payment voucher');
    if (!xml.includes(`AZZUNIQE-VCH-${testVoucher1.id}`)) throw new Error('XML missing stable GUID for voucher 1');
    if (!xml.includes(`AZZUNIQE-VCH-${testVoucher2.id}`)) throw new Error('XML missing stable GUID for voucher 2');
    if (!xml.includes('<LEDGERNAME>HDFC Bank Main A/c</LEDGERNAME>')) {
      throw new Error('XML did not use the mapped Tally ledger name.');
    }
  });

  await test('5.5 Duplicate Tally Export Prevention: Re-exporting without flag is prevented', async () => {
    let dupExportBlocked = false;
    try {
      await tallyService.exportVouchers(
        company.id,
        {
          voucherIds: [testVoucher1.id],
          reExport: false,
        },
        actor
      );
    } catch (err) {
      if (err.message.includes('already been exported') || err.message.includes('No eligible')) {
        dupExportBlocked = true;
      }
    }
    if (!dupExportBlocked) throw new Error('Should have prevented duplicate voucher export.');
  });

  await test('5.6 Tally Export Batches History', async () => {
    const batches = await tallyService.getExportBatches(company.id);
    if (batches.total < 1) throw new Error('Expected at least 1 export batch in history.');
    if (batches.items[0].batchType !== 'VOUCHER_EXPORT') {
      throw new Error(`Expected batchType VOUCHER_EXPORT, got ${batches.items[0].batchType}`);
    }
  });

  // =========================================================================
  // 6. BANKING & RECONCILIATION REPORTS
  // =========================================================================

  await test('6.1 Bank Book Report: Chronological running balance calculation', async () => {
    const bankBook = await bankReportService.getBankBook(company.id, bankAccount1.id, {
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    });

    if (bankBook.transactions.length < 2) {
      throw new Error(`Expected at least 2 bank book transactions, got ${bankBook.transactions.length}`);
    }
    // Verify first transaction is receipt (Dr ₹50,000)
    const firstTx = bankBook.transactions[0];
    if (new Decimal(firstTx.debitAmount).toNumber() !== 50000) {
      throw new Error(`Expected first transaction Dr 50000, got ${firstTx.debitAmount}`);
    }
  });

  await test('6.2 Bank Reconciliation Statement (BRS) Report', async () => {
    const brs = await bankReportService.getBankReconciliationStatement(company.id, bankAccount1.id, {
      asOfDate: '2026-05-31',
    });

    if (brs.balanceAsPerBooks === undefined) throw new Error('BRS balanceAsPerBooks undefined.');
    if (brs.balanceAsPerStatement === undefined) throw new Error('BRS balanceAsPerStatement undefined.');
    if (brs.adjustedBookBalance === undefined) throw new Error('BRS adjustedBookBalance undefined.');
  });

  await test('6.3 Bank Charges & Interest Summary Report', async () => {
    const summary = await bankReportService.getBankChargesAndInterestSummary(company.id, bankAccount1.id, {
      fromDate: '2026-05-01',
      toDate: '2026-05-31',
    });

    if (new Decimal(summary.totalBankCharges).toNumber() !== 1180) {
      throw new Error(`Expected totalBankCharges 1180, got ${summary.totalBankCharges}`);
    }
    if (new Decimal(summary.totalInterestReceived).toNumber() !== 3500) {
      throw new Error(`Expected totalInterestReceived 3500, got ${summary.totalInterestReceived}`);
    }
  });

  console.log('\n========================================================================');
  console.log(`Phase 8 Part 3 Tests Finished: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runBankingAndTallyTests().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
