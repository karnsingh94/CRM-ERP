import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

import prisma from '../../src/config/prisma.js';
import coaService from '../../src/services/accounting/coa.service.js';
import periodService from '../../src/services/accounting/period.service.js';
import voucherService from '../../src/services/accounting/voucher.service.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Hard database guard: verify database name without exposing credentials
const rawDbUrl = process.env.DATABASE_URL || '';
let resolvedDbName = 'UNKNOWN';
try {
  const match = rawDbUrl.match(/\/([a-zA-Z0-9_-]+)(?:\?|$)/);
  if (match) resolvedDbName = match[1];
} catch {
  resolvedDbName = 'PARSE_ERROR';
}

console.log(`\n[Database Safety Guard] Configured Target Database: ${resolvedDbName}`);

if (resolvedDbName !== 'crm_erp_test_db') {
  console.error(`\n🚨 FATAL SAFETY VIOLATION: Refusing execution! Connected database is '${resolvedDbName}', expected 'crm_erp_test_db'.`);
  process.exit(1);
}

export async function runPhase8AccountingCoreTests() {
  console.log('========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 8 Step 2 Part 1: Accounting Core Test Suite');
  console.log(`Target Database: ${resolvedDbName} (ISOLATED TEST DATABASE)`);
  console.log('Verifying: Concurrency, Reversal Integrity, Normal Balances, Invariants');
  console.log('========================================================================\n');

  // Verify directly from MySQL runtime connection
  const activeDbResult = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb');
  const activeDb = activeDbResult[0]?.activeDb;
  console.log(`[Runtime Connection Verification] Active MySQL Database: ${activeDb}\n`);

  if (activeDb !== 'crm_erp_test_db') {
    console.error(`\n🚨 FATAL SAFETY VIOLATION: Active database is '${activeDb}', NOT 'crm_erp_test_db'! Aborting.`);
    process.exit(1);
  }

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

  // Tenant 1 & Tenant 2 for cross-company testing
  const uniqueTs = Date.now();
  const testTenant = await prisma.clientAdmin.create({
    data: {
      name: `Accounting Test Company ${uniqueTs}`,
      organizationName: `Accounting Test Org ${uniqueTs}`,
      email: `acct_test_${uniqueTs}@example.com`,
      passwordHash: 'dummy_hash',
      status: 'ACTIVE',
    },
  });
  const companyId = testTenant.id;

  const clients = await prisma.clientAdmin.findMany({
    where: { id: { not: companyId }, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 1,
  });
  const otherCompanyId = clients[0] ? clients[0].id : '00000000-0000-0000-0000-000000000000';

  const actor = { id: 'usr-fin-001', name: 'Chief Accountant' };
  const testSuffix = uniqueTs.toString().slice(-4);

  // --------------------------------------------------------------------------
  // SECTION 1: CHART OF ACCOUNTS (GROUPS & LEDGER MASTERS)
  // --------------------------------------------------------------------------
  let assetGroup, debtorsGroup, salesGroup;
  let bankLedger, debtorsLedger, salesLedger;

  await test('1.1 COA: Create hierarchical Account Groups and prevent circular references', async () => {
    // 1. Root Asset Group
    assetGroup = await coaService.createGroup(
      companyId,
      {
        groupName: `Current Assets ${testSuffix}`,
        groupCode: `CA-${testSuffix}`,
        category: 'ASSET',
      },
      actor
    );

    // 2. Child Group under Current Assets
    debtorsGroup = await coaService.createGroup(
      companyId,
      {
        groupName: `Trade Debtors Group ${testSuffix}`,
        groupCode: `TD-${testSuffix}`,
        category: 'ASSET',
        parentId: assetGroup.id,
      },
      actor
    );

    // 3. Revenue Group
    salesGroup = await coaService.createGroup(
      companyId,
      {
        groupName: `Operating Revenue ${testSuffix}`,
        groupCode: `REV-${testSuffix}`,
        category: 'INCOME',
      },
      actor
    );

    // 4. Circular reference prevention: assetGroup cannot have debtorsGroup as parent
    try {
      await coaService.updateGroup(companyId, assetGroup.id, { parentId: debtorsGroup.id }, actor);
      throw new Error('Should have blocked circular group hierarchy');
    } catch (err) {
      if (!err.message.includes('Circular parent-child reference')) {
        throw new Error(`Unexpected error on circular check: ${err.message}`);
      }
    }
  });

  await test('1.2 COA: Create Ledger Accounts with Control Account classification & balance rules', async () => {
    // 1. Bank Account (Debit normal balance, Control: BANK)
    bankLedger = await coaService.createAccount(
      companyId,
      {
        groupId: assetGroup.id,
        accountCode: `1010-${testSuffix}`,
        accountName: `Main Bank Operating ${testSuffix}`,
        normalBalance: 'DEBIT',
        controlType: 'BANK',
        openingDebit: 10000,
      },
      actor
    );
    if (Number(bankLedger.currentBalance) !== 10000) {
      throw new Error(`Expected opening balance 10000, got ${bankLedger.currentBalance}`);
    }

    // 2. Debtors Account (Debit normal balance, Control: SUNDRY_DEBTORS)
    debtorsLedger = await coaService.createAccount(
      companyId,
      {
        groupId: debtorsGroup.id,
        accountCode: `1020-${testSuffix}`,
        accountName: `Trade Debtors Control ${testSuffix}`,
        normalBalance: 'DEBIT',
        controlType: 'SUNDRY_DEBTORS',
        openingDebit: 0,
      },
      actor
    );
    if (!debtorsLedger.isControlAccount || debtorsLedger.controlType !== 'SUNDRY_DEBTORS') {
      throw new Error('Debtors control account configuration mismatch');
    }

    // 3. Sales Account (Credit normal balance, Control: SALES)
    salesLedger = await coaService.createAccount(
      companyId,
      {
        groupId: salesGroup.id,
        accountCode: `4010-${testSuffix}`,
        accountName: `Commercial Fabric Sales ${testSuffix}`,
        normalBalance: 'CREDIT',
        controlType: 'SALES',
        openingCredit: 0,
      },
      actor
    );

    // 4. Duplicate code prevention within same company
    try {
      await coaService.createAccount(
        companyId,
        {
          groupId: assetGroup.id,
          accountCode: `1010-${testSuffix}`, // duplicate
          accountName: 'Duplicate Code Test',
          normalBalance: 'DEBIT',
        },
        actor
      );
      throw new Error('Should have prevented duplicate account code in company');
    } catch (err) {
      if (!err.message.includes('already exists for this company')) {
        throw new Error(`Unexpected duplicate error: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 2: FINANCIAL YEARS & ACCOUNTING PERIODS
  // --------------------------------------------------------------------------
  let testFy, testPeriod1, testPeriod2;

  await test('2.1 Financial Year: Create FY, prevent overlaps, and generate monthly periods', async () => {
    const startYear = 2030 + parseInt(testSuffix.slice(-2), 10);
    const startDate = new Date(`${startYear}-04-01`);
    const endDate = new Date(`${startYear + 1}-03-31`);

    testFy = await periodService.createFinancialYear(
      companyId,
      {
        name: `FY ${startYear}-${startYear + 1}`,
        code: `FY${startYear}${startYear + 1}`,
        startDate,
        endDate,
        isCurrent: true,
      },
      actor
    );

    // Prevent overlapping FY dates
    try {
      await periodService.createFinancialYear(
        companyId,
        {
          name: `Overlapping FY`,
          code: `FY-OVERLAP-${testSuffix}`,
          startDate: new Date(`${startYear}-06-01`),
          endDate: new Date(`${startYear + 1}-05-31`),
        },
        actor
      );
      throw new Error('Should have blocked overlapping Financial Year');
    } catch (err) {
      if (!err.message.includes('overlap with existing fiscal year')) {
        throw new Error(`Unexpected overlap error: ${err.message}`);
      }
    }

    // Generate 12 standard monthly periods
    const periods = await periodService.generateStandardPeriods(companyId, testFy.id, actor);
    if (periods.length !== 12) throw new Error(`Expected 12 periods, got ${periods.length}`);
    testPeriod1 = periods[0];
    testPeriod2 = periods[1];
  });

  await test('2.2 Accounting Period: Close period and prevent transactions, reopen with audit', async () => {
    // Close period 1
    const closed = await periodService.closePeriod(companyId, testPeriod1.id, actor);
    if (!closed.isClosed) throw new Error('Period closure failed');

    // Attempting to reopen without reason must fail
    try {
      await periodService.reopenPeriod(companyId, testPeriod1.id, '', actor);
      throw new Error('Should require valid reason to reopen closed period');
    } catch (err) {
      if (!err.message.includes('valid authorization reason is required')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Reopen period 1 with authorized reason
    const reopened = await periodService.reopenPeriod(companyId, testPeriod1.id, 'Audit adjustment approved by CFO', actor);
    if (reopened.isClosed) throw new Error('Period reopening failed');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: DOUBLE-ENTRY JOURNAL VOUCHER ENGINE
  // --------------------------------------------------------------------------
  let customer;

  await test('3.1 Voucher Invariants: Rejection of unbalanced and invalid line structures', async () => {
    customer = await prisma.crmCustomer.create({
      data: {
        companyId,
        companyName: `Alpha Global Exports ${testSuffix}`,
        customerCode: `CUST-VOUCH-${testSuffix}`,
        phone: `998877${testSuffix}`,
      },
    });

    // TEST: Both debit and credit on one line must fail!
    try {
      await voucherService.createDraftVoucher(
        companyId,
        {
          voucherDate: testPeriod1.startDate,
          financialYearId: testFy.id,
          accountingPeriodId: testPeriod1.id,
          items: [
            { accountId: bankLedger.id, debitAmount: 500, creditAmount: 500 }, // INVALID
            { accountId: salesLedger.id, creditAmount: 500 },
          ],
        },
        actor
      );
      throw new Error('Should have blocked line containing both debit and credit');
    } catch (err) {
      if (!err.message.includes('cannot have both positive debit')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // TEST: Unbalanced voucher posting (Debit != Credit) must fail!
    const unbalVoucher = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: testPeriod1.startDate,
        financialYearId: testFy.id,
        accountingPeriodId: testPeriod1.id,
        items: [
          { accountId: bankLedger.id, debitAmount: 1000 },
          { accountId: salesLedger.id, creditAmount: 800 }, // 1000 != 800
        ],
      },
      actor
    );

    try {
      await voucherService.postVoucher(companyId, unbalVoucher.id, actor);
      throw new Error('Should have rejected unbalanced voucher posting');
    } catch (err) {
      if (!err.message.includes('Unbalanced Voucher')) {
        throw new Error(`Unexpected unbalance error: ${err.message}`);
      }
    }
  });

  await test('3.2 Control Accounts: Sundry Debtors subledger customer requirement', async () => {
    const draftWithoutCust = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: testPeriod1.startDate,
        financialYearId: testFy.id,
        accountingPeriodId: testPeriod1.id,
        items: [
          { accountId: debtorsLedger.id, debitAmount: 2500, customerId: null },
          { accountId: salesLedger.id, creditAmount: 2500 },
        ],
      },
      actor
    );

    try {
      await voucherService.postVoucher(companyId, draftWithoutCust.id, actor);
      throw new Error('Should have rejected debtors entry without customerId');
    } catch (err) {
      if (!err.message.includes('Trade Debtors control account')) {
        throw new Error(`Unexpected control error: ${err.message}`);
      }
    }
  });

  let validVoucher;

  await test('3.3 Voucher Posting: Atomic execution and balance update', async () => {
    const preBank = await coaService.getAccountById(companyId, bankLedger.id);
    const preSales = await coaService.getAccountById(companyId, salesLedger.id);

    // Create balanced draft voucher: Bank Dr ₹7,500, Sales Cr ₹7,500
    validVoucher = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: testPeriod1.startDate,
        voucherType: 'RECEIPT',
        financialYearId: testFy.id,
        accountingPeriodId: testPeriod1.id,
        narration: 'Customer cash sales receipt',
        items: [
          { accountId: bankLedger.id, debitAmount: 7500, creditAmount: 0 },
          { accountId: salesLedger.id, debitAmount: 0, creditAmount: 7500 },
        ],
      },
      actor
    );

    const posted = await voucherService.postVoucher(companyId, validVoucher.id, actor);
    if (posted.status !== 'POSTED') throw new Error('Voucher status was not updated to POSTED');

    const postBank = await coaService.getAccountById(companyId, bankLedger.id);
    const postSales = await coaService.getAccountById(companyId, salesLedger.id);

    const expectedBank = Number(preBank.currentBalance) + 7500;
    const expectedSales = Number(preSales.currentBalance) + 7500;

    if (Number(postBank.currentBalance) !== expectedBank) {
      throw new Error(`Bank balance mismatch: expected ${expectedBank}, got ${postBank.currentBalance}`);
    }
    if (Number(postSales.currentBalance) !== expectedSales) {
      throw new Error(`Sales balance mismatch: expected ${expectedSales}, got ${postSales.currentBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3.4: CONCURRENT VOUCHER POSTING (MANDATED REQUIREMENT 2)
  // --------------------------------------------------------------------------
  await test('3.4 Concurrency: Two simultaneous POST requests for same DRAFT voucher execute CAS guard', async () => {
    // Create a new DRAFT voucher for concurrent execution test
    const concurrentDraft = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: testPeriod1.startDate,
        voucherType: 'JOURNAL',
        financialYearId: testFy.id,
        accountingPeriodId: testPeriod1.id,
        narration: 'Concurrent posting race condition test voucher',
        items: [
          { accountId: bankLedger.id, debitAmount: 1200 },
          { accountId: salesLedger.id, creditAmount: 1200 },
        ],
      },
      actor
    );

    const bankBefore = await coaService.getAccountById(companyId, bankLedger.id);

    // Fire two simultaneous post requests concurrently
    const [result1, result2] = await Promise.allSettled([
      voucherService.postVoucher(companyId, concurrentDraft.id, { id: 'usr-1', name: 'User 1' }),
      voucherService.postVoucher(companyId, concurrentDraft.id, { id: 'usr-2', name: 'User 2' }),
    ]);

    // Exactly one must succeed (fulfilled) and exactly one must fail (rejected)
    const successCount = (result1.status === 'fulfilled' ? 1 : 0) + (result2.status === 'fulfilled' ? 1 : 0);
    const failureCount = (result1.status === 'rejected' ? 1 : 0) + (result2.status === 'rejected' ? 1 : 0);

    if (successCount !== 1 || failureCount !== 1) {
      throw new Error(`Concurrency violation! Succeeded: ${successCount}, Failed: ${failureCount}. Expected exactly 1 success and 1 failure.`);
    }

    // Verify error message on failed call
    const failedResult = result1.status === 'rejected' ? result1 : result2;
    if (!failedResult.reason.message.includes('Concurrent posting prevented') && !failedResult.reason.message.includes('already transitioned away from DRAFT')) {
      throw new Error(`Unexpected concurrency failure reason: ${failedResult.reason.message}`);
    }

    // Verify ledger balance updated only once (by ₹1,200)
    const bankAfter = await coaService.getAccountById(companyId, bankLedger.id);
    const expectedBankBalance = Number(bankBefore.currentBalance) + 1200;
    if (Number(bankAfter.currentBalance) !== expectedBankBalance) {
      throw new Error(`Double-posting detected on ledger! Expected balance ${expectedBankBalance}, got ${bankAfter.currentBalance}`);
    }

    // Verify voucher status is POSTED and recorded only once
    const finalVoucher = await voucherService.getVoucherById(companyId, concurrentDraft.id);
    if (finalVoucher.status !== 'POSTED') throw new Error(`Voucher status should be POSTED, got ${finalVoucher.status}`);
  });

  // --------------------------------------------------------------------------
  // TEST 3.5: IMMUTABILITY & REVERSAL INTEGRITY (MANDATED REQUIREMENT 3)
  // --------------------------------------------------------------------------
  await test('3.5 Reversal Integrity: Invert lines, preserve original voucher immutability & audit trail', async () => {
    // 1. Immutability check: cannot update or cancel posted voucher directly
    try {
      await voucherService.updateDraftVoucher(companyId, validVoucher.id, { narration: 'Hacked' }, actor);
      throw new Error('Should have blocked edit on posted voucher');
    } catch (err) {
      if (!err.message.includes('is IMMUTABLE')) throw new Error(`Unexpected error: ${err.message}`);
    }

    const preBank = await coaService.getAccountById(companyId, bankLedger.id);
    const preSales = await coaService.getAccountById(companyId, salesLedger.id);

    // Snapshot original voucher lines before reversal
    const origSnapshot = await voucherService.getVoucherById(companyId, validVoucher.id);
    const origLine1 = origSnapshot.items[0];
    const origLine2 = origSnapshot.items[1];

    // Execute Reversal
    const reversal = await voucherService.reversePostedVoucher(
      companyId,
      validVoucher.id,
      'Customer cheque returned unpaid by clearing house',
      actor
    );

    // Verify reversal header
    if (!reversal.isReversal || reversal.reversalOfVoucherId !== validVoucher.id) {
      throw new Error('Reversal voucher header linkage failed');
    }
    if (reversal.status !== 'POSTED') throw new Error('Reversal voucher was not auto-posted');

    // Verify reversal lines: exactly inverted
    const revLine1 = reversal.items.find((i) => i.accountId === origLine1.accountId);
    const revLine2 = reversal.items.find((i) => i.accountId === origLine2.accountId);

    // Original Line 1 was Bank Dr ₹7,500, Cr 0 -> Reversal Line 1 must be Bank Dr 0, Cr ₹7,500
    if (Number(revLine1.debitAmount) !== Number(origLine1.creditAmount) || Number(revLine1.creditAmount) !== Number(origLine1.debitAmount)) {
      throw new Error(`Reversal Line 1 not inverted! Original Dr: ${origLine1.debitAmount}, Rev Cr: ${revLine1.creditAmount}`);
    }

    // Original Line 2 was Sales Dr 0, Cr ₹7,500 -> Reversal Line 2 must be Sales Dr ₹7,500, Cr 0
    if (Number(revLine2.debitAmount) !== Number(origLine2.creditAmount) || Number(revLine2.creditAmount) !== Number(origLine2.debitAmount)) {
      throw new Error(`Reversal Line 2 not inverted! Original Cr: ${origLine2.creditAmount}, Rev Dr: ${revLine2.debitAmount}`);
    }

    // Verify original posted voucher lines remain completely unchanged
    const origAfterRev = await voucherService.getVoucherById(companyId, validVoucher.id);
    if (origAfterRev.status !== 'REVERSED') throw new Error(`Original status should be REVERSED, got ${origAfterRev.status}`);
    if (Number(origAfterRev.items[0].debitAmount) !== Number(origLine1.debitAmount)) throw new Error('Original line 1 mutated');
    if (Number(origAfterRev.items[1].creditAmount) !== Number(origLine2.creditAmount)) throw new Error('Original line 2 mutated');

    // Verify reversal cannot be posted or reversed twice
    try {
      await voucherService.reversePostedVoucher(companyId, validVoucher.id, 'Duplicate reversal attempt', actor);
      throw new Error('Should have prevented duplicate reversal');
    } catch (err) {
      if (!err.message.includes('Only POSTED vouchers can be reversed') && !err.message.includes('already been reversed')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Verify ledger balances restored
    const postBank = await coaService.getAccountById(companyId, bankLedger.id);
    const postSales = await coaService.getAccountById(companyId, salesLedger.id);

    const expectedBank = Number(preBank.currentBalance) - 7500;
    const expectedSales = Number(preSales.currentBalance) - 7500;

    if (Number(postBank.currentBalance) !== expectedBank) {
      throw new Error(`Bank balance mismatch post-reversal: expected ${expectedBank}, got ${postBank.currentBalance}`);
    }
    if (Number(postSales.currentBalance) !== expectedSales) {
      throw new Error(`Sales balance mismatch post-reversal: expected ${expectedSales}, got ${postSales.currentBalance}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: NORMAL BALANCE CALCULATIONS ACROSS ALL 5 CATEGORIES (REQUIREMENT 4)
  // --------------------------------------------------------------------------
  await test('4. Normal Balance Calculation: Verified across ASSET, LIABILITY, EQUITY, INCOME, EXPENSE', async () => {
    // 1. Create one group for each category
    const grpAsset = await coaService.createGroup(companyId, { groupName: `Asset Grp ${testSuffix}`, groupCode: `AST-${testSuffix}`, category: 'ASSET' }, actor);
    const grpLiab = await coaService.createGroup(companyId, { groupName: `Liab Grp ${testSuffix}`, groupCode: `LIB-${testSuffix}`, category: 'LIABILITY' }, actor);
    const grpEq = await coaService.createGroup(companyId, { groupName: `Equity Grp ${testSuffix}`, groupCode: `EQ-${testSuffix}`, category: 'EQUITY' }, actor);
    const grpInc = await coaService.createGroup(companyId, { groupName: `Income Grp ${testSuffix}`, groupCode: `INC-${testSuffix}`, category: 'INCOME' }, actor);
    const grpExp = await coaService.createGroup(companyId, { groupName: `Expense Grp ${testSuffix}`, groupCode: `EXP-${testSuffix}`, category: 'EXPENSE' }, actor);

    // 2. Create one account for each with opening balance
    // ASSET (DEBIT normal): Opening Dr 1,000 -> Current Balance = +1,000
    const accAsset = await coaService.createAccount(companyId, { groupId: grpAsset.id, accountCode: `AST-${testSuffix}`, accountName: 'Test Asset Equipment', normalBalance: 'DEBIT', openingDebit: 1000 }, actor);
    // LIABILITY (CREDIT normal): Opening Cr 2,000 -> Current Balance = +2,000
    const accLiab = await coaService.createAccount(companyId, { groupId: grpLiab.id, accountCode: `LIB-${testSuffix}`, accountName: 'Test Loan Payable', normalBalance: 'CREDIT', openingCredit: 2000 }, actor);
    // EQUITY (CREDIT normal): Opening Cr 5,000 -> Current Balance = +5,000
    const accEq = await coaService.createAccount(companyId, { groupId: grpEq.id, accountCode: `EQ-${testSuffix}`, accountName: 'Share Capital', normalBalance: 'CREDIT', openingCredit: 5000 }, actor);
    // INCOME (CREDIT normal): Opening Cr 0 -> Current Balance = 0
    const accInc = await coaService.createAccount(companyId, { groupId: grpInc.id, accountCode: `INC-${testSuffix}`, accountName: 'Service Revenue', normalBalance: 'CREDIT', openingCredit: 0 }, actor);
    // EXPENSE (DEBIT normal): Opening Dr 0 -> Current Balance = 0
    const accExp = await coaService.createAccount(companyId, { groupId: grpExp.id, accountCode: `EXP-${testSuffix}`, accountName: 'Office Rent', normalBalance: 'DEBIT', openingDebit: 0 }, actor);

    if (Number(accAsset.currentBalance) !== 1000) throw new Error('Asset opening balance mismatch');
    if (Number(accLiab.currentBalance) !== 2000) throw new Error('Liability opening balance mismatch');
    if (Number(accEq.currentBalance) !== 5000) throw new Error('Equity opening balance mismatch');

    // 3. Post a multi-line balanced voucher testing movements on all 5:
    // Expense Dr ₹400  (Debit normal: 0 + 400 = 400)
    // Asset Dr ₹600    (Debit normal: 1,000 + 600 = 1,600)
    // Liability Cr ₹500 (Credit normal: 2,000 + 500 = 2,500)
    // Income Cr ₹500   (Credit normal: 0 + 500 = 500)
    // Total Dr = ₹1,000, Total Cr = ₹1,000 (Balanced!)
    const multiVoucher = await voucherService.createDraftVoucher(
      companyId,
      {
        voucherDate: testPeriod1.startDate,
        financialYearId: testFy.id,
        accountingPeriodId: testPeriod1.id,
        narration: 'Multi-category normal balance testing voucher',
        items: [
          { accountId: accExp.id, debitAmount: 400 },
          { accountId: accAsset.id, debitAmount: 600 },
          { accountId: accLiab.id, creditAmount: 500 },
          { accountId: accInc.id, creditAmount: 500 },
        ],
      },
      actor
    );

    await voucherService.postVoucher(companyId, multiVoucher.id, actor);

    // Verify all 5 balances updated strictly according to their normal balance formula
    const curAsset = await coaService.getAccountById(companyId, accAsset.id);
    const curLiab = await coaService.getAccountById(companyId, accLiab.id);
    const curEq = await coaService.getAccountById(companyId, accEq.id);
    const curInc = await coaService.getAccountById(companyId, accInc.id);
    const curExp = await coaService.getAccountById(companyId, accExp.id);

    if (Number(curAsset.currentBalance) !== 1600) throw new Error(`Asset balance expected 1600, got ${curAsset.currentBalance}`);
    if (Number(curLiab.currentBalance) !== 2500) throw new Error(`Liability balance expected 2500, got ${curLiab.currentBalance}`);
    if (Number(curEq.currentBalance) !== 5000) throw new Error(`Equity balance expected 5000, got ${curEq.currentBalance}`);
    if (Number(curInc.currentBalance) !== 500) throw new Error(`Income balance expected 500, got ${curInc.currentBalance}`);
    if (Number(curExp.currentBalance) !== 400) throw new Error(`Expense balance expected 400, got ${curExp.currentBalance}`);
  });

  // --------------------------------------------------------------------------
  // TEST 5: CLOSED PERIOD & TENANT ISOLATION REJECTION
  // --------------------------------------------------------------------------
  await test('5. Security: Closed Period rejection & cross-company boundary protection', async () => {
    // Close period 2
    await periodService.closePeriod(companyId, testPeriod2.id, actor);

    // Attempt to post into closed period 2
    try {
      await voucherService.createDraftVoucher(
        companyId,
        {
          voucherDate: testPeriod2.startDate,
          financialYearId: testFy.id,
          accountingPeriodId: testPeriod2.id,
          items: [
            { accountId: bankLedger.id, debitAmount: 100 },
            { accountId: salesLedger.id, creditAmount: 100 },
          ],
        },
        actor
      );
      throw new Error('Should have rejected voucher creation in closed period');
    } catch (err) {
      if (!err.message.includes('closed Accounting Period')) {
        throw new Error(`Unexpected closed period error: ${err.message}`);
      }
    }

    // Cross-company access rejection
    if (otherCompanyId && otherCompanyId !== companyId) {
      try {
        await voucherService.getVoucherById(otherCompanyId, validVoucher.id);
        throw new Error('Should have rejected cross-company access');
      } catch (err) {
        if (!err.message.includes('not found')) {
          throw new Error(`Unexpected tenant isolation error: ${err.message}`);
        }
      }
    }
  });

  console.log(`\n========================================================================`);
  console.log(`Phase 8 Accounting Core Verification Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} test(s) failed in Phase 8 Accounting Core suite.`);
  }
}

// Auto-run when invoked directly
if (process.argv[1]?.includes('phase8_accounting_core.test.js')) {
  runPhase8AccountingCoreTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Accounting core test failed:', err);
      process.exit(1);
    });
}
