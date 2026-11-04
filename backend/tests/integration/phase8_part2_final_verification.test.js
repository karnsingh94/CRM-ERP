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
import salesInvoiceService from '../../src/services/accounting/salesInvoice.service.js';
import receiptService from '../../src/services/accounting/receipt.service.js';
import allocationService from '../../src/services/accounting/allocation.service.js';
import vendorPayableService from '../../src/services/accounting/vendorPayable.service.js';
import periodService from '../../src/services/accounting/period.service.js';
import voucherService from '../../src/services/accounting/voucher.service.js';
import standardAccountsService from '../../src/services/accounting/standardAccounts.service.js';

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

async function runFinalVerification() {
  console.log('========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 8 Step 2 Part 2: Final Accounting Verification');
  console.log(`Target Database: ${configuredDbName} (ISOLATED TEST DATABASE)`);
  console.log('Verifying: Advance Allocation Lifecycle, Reversal Integrity, Phase 7 Sync, Vendor Rec');
  console.log('========================================================================\n');

  // Runtime connection check
  const [dbRow] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb;');
  const activeDb = dbRow?.activeDb;
  console.log(`[Runtime Connection Verification] Active MySQL Database: ${activeDb}\n`);

  if (activeDb !== 'crm_erp_test_db') {
    console.error(`🚨 FATAL: Active database connection is '${activeDb}'. Aborting.`);
    process.exit(1);
  }

  // Setup dedicated verification tenant
  const company = await prisma.clientAdmin.create({
    data: {
      name: `Accounting Final Rec Co - ${Date.now()}`,
      email: `final_rec_${Date.now()}@testcorp.com`,
      organizationName: `Final Rec Org`,
      passwordHash: 'dummy-hashed-secret',
      status: 'ACTIVE',
    },
  });

  const actor = { id: 'usr-fin-controller', name: 'Financial Controller' };

  // Setup FY and Accounting Period
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

  // Setup Customers
  const customer = await prisma.crmCustomer.create({
    data: {
      companyId: company.id,
      companyName: 'Adani Solar Infrastructure Ltd',
      gstin: '08AADCA1111B1Z2',
      phone: '9829099888',
      billingAddress: 'RIICO Industrial Area, Jaipur, Rajasthan',
    },
  });

  const customerOther = await prisma.crmCustomer.create({
    data: {
      companyId: company.id,
      companyName: 'Different Customer Corp',
      gstin: '08AADCD2222C1Z4',
      phone: '9829077665',
    },
  });

  // Setup Bank Account
  const bankAcc = await prisma.bankAccount.create({
    data: {
      companyId: company.id,
      accountHolderName: company.name,
      bankName: 'State Bank of India',
      accountNumber: `SBI-${Date.now().toString().slice(-6)}`,
      ifscCode: 'SBIN0001234',
      branchName: 'Corporate Branch Jaipur',
      accountType: 'CURRENT',
      openingBalance: 1000000,
      currentBalance: 1000000,
    },
  });

  // ==========================================================================
  // SCENARIO 1: CUSTOMER ADVANCE ALLOCATION LIFECYCLE (MANDATED REQUIREMENT 1)
  // ==========================================================================
  let advanceReceipt;
  let postedInvoice1;
  let postedInvoice2;
  let advanceAllocation1;

  await test('1.1 Receive Customer Advance: Dr Bank / Cr Customer Advances liability', async () => {
    // 1. Receive ₹50,000 Advance
    advanceReceipt = await receiptService.createReceipt(
      company.id,
      {
        customerId: customer.id,
        paymentMode: 'BANK',
        amount: 50000,
        isAdvance: true,
        bankAccountId: bankAcc.id,
        chequeOrReferenceNo: 'SBI-RTGS-ADV-001',
        paymentDate: new Date('2026-05-01'),
        notes: 'Advance booking for 50kW solar project',
      },
      actor
    );

    if (advanceReceipt.status !== 'POSTED') throw new Error('Advance receipt not posted');
    if (advanceReceipt.paymentType !== 'ADVANCE') throw new Error('Payment type must be ADVANCE');
    if (Number(advanceReceipt.unallocatedAmount) !== 50000) throw new Error('Unallocated amount mismatch');

    // Verify CustomerAdvance model record
    const advRecord = await prisma.customerAdvance.findFirst({
      where: { companyId: company.id, customerId: customer.id },
    });
    if (!advRecord || Number(advRecord.amount) !== 50000) {
      throw new Error('CustomerAdvance record was not created with ₹50,000');
    }

    // Verify GL Voucher: Dr Bank ₹50,000 / Cr Customer Advances liability ₹50,000
    const rctVoucher = await voucherService.getVoucherById(company.id, advanceReceipt.voucherId);
    const bankLine = rctVoucher.items.find((i) => i.account.controlType === 'BANK');
    const advLine = rctVoucher.items.find((i) => i.account.controlType === 'CUSTOMER_ADVANCES');

    if (!bankLine || Number(bankLine.debitAmount) !== 50000) {
      throw new Error(`Bank debit line invalid: Dr ₹${bankLine?.debitAmount}`);
    }
    if (!advLine || Number(advLine.creditAmount) !== 50000) {
      throw new Error(`Customer Advances credit line invalid: Cr ₹${advLine?.creditAmount}`);
    }
  });

  await test('1.2 Create and Post Sales Invoices for Advance Allocation', async () => {
    // Invoice 1: 30 units @ ₹1,000 = ₹30,000 + 18% GST (₹5,400) = ₹35,400 Total
    const draft1 = await salesInvoiceService.createDraftInvoice(
      company.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-05-10'),
        items: [{ sku: 'SOLAR-MODULE-400W', quantity: 30, unitPrice: 1000, taxRate: 18 }],
      },
      actor
    );
    postedInvoice1 = await salesInvoiceService.postInvoice(company.id, draft1.id, actor);
    if (Number(postedInvoice1.totalAmount) !== 35400) throw new Error('Invoice 1 total mismatch');

    // Invoice 2: 20 units @ ₹1,000 = ₹20,000 + 18% GST (₹3,600) = ₹23,600 Total
    const draft2 = await salesInvoiceService.createDraftInvoice(
      company.id,
      {
        customerId: customer.id,
        invoiceDate: new Date('2026-05-12'),
        items: [{ sku: 'SOLAR-MODULE-400W', quantity: 20, unitPrice: 1000, taxRate: 18 }],
      },
      actor
    );
    postedInvoice2 = await salesInvoiceService.postInvoice(company.id, draft2.id, actor);
    if (Number(postedInvoice2.totalAmount) !== 23600) throw new Error('Invoice 2 total mismatch');
  });

  await test('1.3 Exact Lifecycle Step 1 & 2: Allocate ₹35,400 -> Unallocated becomes ₹14,600', async () => {
    const advAccBefore = await standardAccountsService.ensureStandardAccount(company.id, 'CUSTOMER_ADVANCES');
    const debAccBefore = await standardAccountsService.ensureStandardAccount(company.id, 'SUNDRY_DEBTORS');

    const balAdvBefore = Number(advAccBefore.currentBalance);
    const balDebBefore = Number(debAccBefore.currentBalance);

    // Over-allocation rejection test: Attempt to allocate ₹60,000 when only ₹50,000 available
    try {
      await allocationService.allocatePayment(
        company.id,
        {
          paymentReceiptId: advanceReceipt.id,
          invoiceId: postedInvoice1.id,
          allocatedAmount: 60000,
        },
        actor
      );
      throw new Error('Should have rejected allocation exceeding available advance');
    } catch (err) {
      if (!err.message.includes('exceeds available unallocated')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Allocate ₹35,400 from advance (₹50,000) to settle Invoice 1 (₹35,400)
    advanceAllocation1 = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: advanceReceipt.id,
        invoiceId: postedInvoice1.id,
        allocatedAmount: 35400,
        notes: 'Advance settlement against Invoice 1',
      },
      actor
    );

    // Verify adjustment voucher was generated and linked:
    // Dr: Customer Advances liability (reducing liability by ₹35,400)
    // Cr: Sundry Debtors (with customerId) for ₹35,400
    const adjVoucher = await prisma.journalVoucher.findFirst({
      where: {
        companyId: company.id,
        referenceType: 'ADVANCE_ALLOCATION',
        referenceId: advanceAllocation1.id,
        status: 'POSTED',
      },
      include: { items: { include: { account: true } } },
    });

    if (!adjVoucher) throw new Error('GL Adjustment voucher was NOT generated for advance allocation!');
    if (Number(adjVoucher.totalDebit) !== 35400 || Number(adjVoucher.totalCredit) !== 35400) {
      throw new Error(`Adjustment voucher unbalanced: Dr ₹${adjVoucher.totalDebit}, Cr ₹${adjVoucher.totalCredit}`);
    }

    const drLine = adjVoucher.items.find((i) => i.account.controlType === 'CUSTOMER_ADVANCES');
    if (!drLine || Number(drLine.debitAmount) !== 35400) {
      throw new Error(`Adjustment Dr line invalid: expected Dr ₹35,400 on Customer Advances, got ${drLine?.debitAmount}`);
    }

    const crLine = adjVoucher.items.find((i) => i.account.controlType === 'SUNDRY_DEBTORS');
    if (!crLine || Number(crLine.creditAmount) !== 35400 || crLine.customerId !== customer.id) {
      throw new Error(`Adjustment Cr line invalid: expected Cr ₹35,400 on Sundry Debtors with customerId, got Cr ₹${crLine?.creditAmount}`);
    }

    // Verify Invoice 1 outstanding = 0 (PAID)
    const inv1Updated = await salesInvoiceService.getInvoiceById(company.id, postedInvoice1.id);
    if (Number(inv1Updated.outstandingAmount) !== 0 || inv1Updated.status !== 'PAID') {
      throw new Error(`Invoice 1 outstanding expected 0 (PAID), got ${inv1Updated.outstandingAmount} (${inv1Updated.status})`);
    }

    // Verify remaining unallocated advance is exactly ₹14,600 (50,000 - 35,400)
    const rctUpdated = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctUpdated.unallocatedAmount) !== 14600) {
      throw new Error(`Advance unallocated expected 14600, got ${rctUpdated.unallocatedAmount}`);
    }

    // Verify GL Account balances updated
    const advAccAfter = await prisma.accountMaster.findUnique({ where: { id: advAccBefore.id } });
    const debAccAfter = await prisma.accountMaster.findUnique({ where: { id: debAccBefore.id } });

    if (Number(advAccAfter.currentBalance) !== balAdvBefore - 35400) {
      throw new Error(`Customer Advances GL balance not decremented correctly: ${advAccAfter.currentBalance}`);
    }
    if (Number(debAccAfter.currentBalance) !== balDebBefore - 35400) {
      throw new Error(`Sundry Debtors GL balance not decremented correctly: ${debAccAfter.currentBalance}`);
    }
  });

  await test('1.4 Exact Lifecycle Step 3: Reverse the ₹35,400 allocation -> Unallocated restored to EXACT ₹50,000', async () => {
    // Reverse advanceAllocation1 (₹35,400)
    const revAlloc = await allocationService.reverseAllocation(
      company.id,
      advanceAllocation1.id,
      'Customer requested project hold before dispatch',
      actor
    );
    if (revAlloc.status !== 'REVERSED') throw new Error('Status should be REVERSED');

    // 1. Verify advance receipt unallocated is restored to EXACT ₹50,000 (14,600 + 35,400 = 50,000)!
    const rctRestored = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctRestored.unallocatedAmount) !== 50000) {
      throw new Error(`Unallocated advance expected EXACT 50000, got ${rctRestored.unallocatedAmount}`);
    }
    if (Number(rctRestored.amount) !== 50000) {
      throw new Error(`Advance original amount should remain 50000, got ${rctRestored.amount}`);
    }

    // 2. Verify Invoice 1 outstanding restored to ₹35,400 (POSTED)
    const inv1Restored = await salesInvoiceService.getInvoiceById(company.id, postedInvoice1.id);
    if (Number(inv1Restored.outstandingAmount) !== 35400 || inv1Restored.status !== 'POSTED') {
      throw new Error(`Invoice 1 outstanding expected 35400 (POSTED), got ${inv1Restored.outstandingAmount} (${inv1Restored.status})`);
    }

    // 3. Verify original advance receipt voucher is untouched and POSTED
    const origReceiptVoucher = await voucherService.getVoucherById(company.id, advanceReceipt.voucherId);
    if (origReceiptVoucher.status !== 'POSTED') {
      throw new Error(`Original receipt voucher was mutated! Status: ${origReceiptVoucher.status}`);
    }

    // 4. Verify adjustment voucher was marked REVERSED
    const origAdjVoucher = await prisma.journalVoucher.findFirst({
      where: {
        companyId: company.id,
        referenceType: 'ADVANCE_ALLOCATION',
        referenceId: advanceAllocation1.id,
      },
    });
    if (origAdjVoucher.status !== 'REVERSED') {
      throw new Error(`Adjustment voucher status expected REVERSED, got ${origAdjVoucher.status}`);
    }

    // 5. Verify reversing voucher was created with inverted lines
    const reversingVoucher = await prisma.journalVoucher.findFirst({
      where: {
        companyId: company.id,
        isReversal: true,
        reversalOfVoucherId: origAdjVoucher.id,
      },
      include: { items: { include: { account: true } } },
    });
    if (!reversingVoucher) throw new Error('Reversing voucher not found for advance allocation!');

    const revDrDebtors = reversingVoucher.items.find((i) => i.account.controlType === 'SUNDRY_DEBTORS');
    const revCrAdvances = reversingVoucher.items.find((i) => i.account.controlType === 'CUSTOMER_ADVANCES');

    if (!revDrDebtors || Number(revDrDebtors.debitAmount) !== 35400) {
      throw new Error(`Reversing Dr line invalid: expected Dr ₹35,400 on Sundry Debtors, got ${revDrDebtors?.debitAmount}`);
    }
    if (!revCrAdvances || Number(revCrAdvances.creditAmount) !== 35400) {
      throw new Error(`Reversing Cr line invalid: expected Cr ₹35,400 on Customer Advances, got ${revCrAdvances?.creditAmount}`);
    }

    // 6. Verify GL Account balances restored to pre-allocation values
    const advAccRestored = await standardAccountsService.ensureStandardAccount(company.id, 'CUSTOMER_ADVANCES');
    const debAccRestored = await standardAccountsService.ensureStandardAccount(company.id, 'SUNDRY_DEBTORS');

    // Customer Advances liability restored to ₹50,000
    if (Number(advAccRestored.currentBalance) !== 50000) {
      throw new Error(`Customer Advances GL balance expected 50000, got ${advAccRestored.currentBalance}`);
    }
    // Sundry Debtors restored to ₹59,000 (Invoice 1 ₹35,400 + Invoice 2 ₹23,600)
    if (Number(debAccRestored.currentBalance) !== 59000) {
      throw new Error(`Sundry Debtors GL balance expected 59000, got ${debAccRestored.currentBalance}`);
    }

    // 7. Duplicate reversal rejection
    try {
      await allocationService.reverseAllocation(company.id, advanceAllocation1.id, 'Duplicate attempt', actor);
      throw new Error('Should have blocked duplicate reversal');
    } catch (err) {
      if (!err.message.includes('already in REVERSED status')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  await test('1.5 Concurrent Reversal Guard: Simultaneous reversals cannot restore amount twice', async () => {
    // Re-allocate ₹10,000 to Invoice 1 (Unallocated becomes 50,000 - 10,000 = 40,000)
    const testAlloc = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: advanceReceipt.id,
        invoiceId: postedInvoice1.id,
        allocatedAmount: 10000,
        notes: 'Allocation for concurrency test',
      },
      actor
    );

    const rctPre = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctPre.unallocatedAmount) !== 40000) throw new Error('Unallocated expected 40000');

    // Fire two simultaneous reversals for testAlloc
    const [res1, res2] = await Promise.allSettled([
      allocationService.reverseAllocation(company.id, testAlloc.id, 'Concurrent 1', actor),
      allocationService.reverseAllocation(company.id, testAlloc.id, 'Concurrent 2', actor),
    ]);

    const succ = (res1.status === 'fulfilled' ? 1 : 0) + (res2.status === 'fulfilled' ? 1 : 0);
    const fail = (res1.status === 'rejected' ? 1 : 0) + (res2.status === 'rejected' ? 1 : 0);

    if (succ !== 1 || fail !== 1) {
      throw new Error(`Concurrency violation! Succeeded: ${succ}, Failed: ${fail}. Expected exactly 1 success and 1 failure.`);
    }

    // Verify unallocated amount restored exactly once: 40,000 + 10,000 = 50,000 (NEVER 60,000!)
    const rctPost = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctPost.unallocatedAmount) !== 50000) {
      throw new Error(`Double-restoration detected! Expected 50000, got ${rctPost.unallocatedAmount}`);
    }
  });

  await test('1.6 Multiple Partial Allocations and Selective Reversal', async () => {
    // Current unallocated = ₹50,000.
    // Allocate 1: ₹20,000 to Invoice 1 (Unallocated becomes 30,000)
    const partAlloc1 = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: advanceReceipt.id,
        invoiceId: postedInvoice1.id,
        allocatedAmount: 20000,
      },
      actor
    );

    // Allocate 2: ₹20,000 to Invoice 2 (Unallocated becomes 10,000)
    const partAlloc2 = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: advanceReceipt.id,
        invoiceId: postedInvoice2.id,
        allocatedAmount: 20000,
      },
      actor
    );

    const rctPart = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctPart.unallocatedAmount) !== 10000) {
      throw new Error(`Unallocated expected 10000, got ${rctPart.unallocatedAmount}`);
    }

    // Selective Reversal: Reverse ONLY Allocation 1 (₹20,000)
    await allocationService.reverseAllocation(company.id, partAlloc1.id, 'Partial 1 reversed', actor);

    // Unallocated should now be 10,000 + 20,000 = ₹30,000
    const rctAfterPart1Rev = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctAfterPart1Rev.unallocatedAmount) !== 30000) {
      throw new Error(`Unallocated expected 30000, got ${rctAfterPart1Rev.unallocatedAmount}`);
    }

    // Invoice 2 must still remain partially paid with ₹20,000 allocated!
    const inv2Check = await salesInvoiceService.getInvoiceById(company.id, postedInvoice2.id);
    if (Number(inv2Check.paidAmount) !== 20000) {
      throw new Error(`Invoice 2 paidAmount mutated: ${inv2Check.paidAmount}`);
    }

    // Now reverse Allocation 2 (₹20,000)
    await allocationService.reverseAllocation(company.id, partAlloc2.id, 'Partial 2 reversed', actor);

    // Unallocated should now be full ₹50,000
    const rctFullyRestored = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctFullyRestored.unallocatedAmount) !== 50000) {
      throw new Error(`Unallocated expected 50000, got ${rctFullyRestored.unallocatedAmount}`);
    }
  });

  await test('1.7 Same Receipt, Different Allocations: Concurrent Reversal via Row-Level Locking', async () => {
    // Starting state: advanceReceipt unallocated = ₹50,000.
    // Allocate ₹20,000 to Invoice A (postedInvoice1)
    const allocA = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: advanceReceipt.id,
        invoiceId: postedInvoice1.id,
        allocatedAmount: 20000,
        notes: 'Alloc A for concurrent reversal test',
      },
      actor
    );

    // Allocate ₹20,000 to Invoice B (postedInvoice2)
    const allocB = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: advanceReceipt.id,
        invoiceId: postedInvoice2.id,
        allocatedAmount: 20000,
        notes: 'Alloc B for concurrent reversal test',
      },
      actor
    );

    // Expected unallocated balance = ₹10,000 (50,000 - 20,000 - 20,000)
    const rctMid = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctMid.unallocatedAmount) !== 10000) {
      throw new Error(`Unallocated expected 10000, got ${rctMid.unallocatedAmount}`);
    }

    // Now reverse both different allocations simultaneously using Promise.allSettled
    const [resA, resB] = await Promise.allSettled([
      allocationService.reverseAllocation(company.id, allocA.id, 'Concurrent Reversal Alloc A', actor),
      allocationService.reverseAllocation(company.id, allocB.id, 'Concurrent Reversal Alloc B', actor),
    ]);

    // Both reversals must succeed exactly once
    if (resA.status !== 'fulfilled') {
      throw new Error(`Reversal Alloc A failed: ${resA.reason?.message}`);
    }
    if (resB.status !== 'fulfilled') {
      throw new Error(`Reversal Alloc B failed: ${resB.reason?.message}`);
    }

    // Receipt unallocated amount = ₹50,000
    const rctFinal = await receiptService.getReceiptById(company.id, advanceReceipt.id);
    if (Number(rctFinal.unallocatedAmount) !== 50000) {
      throw new Error(`Unallocated amount mismatch after concurrent reversals: expected 50000, got ${rctFinal.unallocatedAmount}`);
    }

    // Invoice A outstanding restored correctly (35,400 POSTED)
    const invAFinal = await salesInvoiceService.getInvoiceById(company.id, postedInvoice1.id);
    if (Number(invAFinal.outstandingAmount) !== 35400 || invAFinal.status !== 'POSTED') {
      throw new Error(`Invoice A outstanding mismatch: ${invAFinal.outstandingAmount} (${invAFinal.status})`);
    }

    // Invoice B outstanding restored correctly (23,600 POSTED)
    const invBFinal = await salesInvoiceService.getInvoiceById(company.id, postedInvoice2.id);
    if (Number(invBFinal.outstandingAmount) !== 23600 || invBFinal.status !== 'POSTED') {
      throw new Error(`Invoice B outstanding mismatch: ${invBFinal.outstandingAmount} (${invBFinal.status})`);
    }

    // Both adjustment vouchers reversed exactly once
    const adjVouchers = await prisma.journalVoucher.findMany({
      where: {
        companyId: company.id,
        referenceType: 'ADVANCE_ALLOCATION',
        referenceId: { in: [allocA.id, allocB.id] },
      },
    });
    if (adjVouchers.length !== 2) throw new Error(`Expected 2 adjustment vouchers, got ${adjVouchers.length}`);
    for (const v of adjVouchers) {
      if (v.status !== 'REVERSED') throw new Error(`Adjustment voucher ${v.voucherNo} not REVERSED`);
    }

    // Both reversal vouchers posted exactly once
    const revVouchers = await prisma.journalVoucher.findMany({
      where: {
        companyId: company.id,
        isReversal: true,
        reversalOfVoucherId: { in: adjVouchers.map((v) => v.id) },
      },
    });
    if (revVouchers.length !== 2) throw new Error(`Expected 2 reversal vouchers, got ${revVouchers.length}`);
    for (const rv of revVouchers) {
      if (rv.status !== 'POSTED') throw new Error(`Reversal voucher ${rv.voucherNo} not POSTED`);
    }

    // Customer Advances GL and Sundry Debtors GL reconcile exactly
    const advAccFinal = await standardAccountsService.ensureStandardAccount(company.id, 'CUSTOMER_ADVANCES');
    const debAccFinal = await standardAccountsService.ensureStandardAccount(company.id, 'SUNDRY_DEBTORS');

    if (Number(advAccFinal.currentBalance) !== 50000) {
      throw new Error(`Customer Advances GL mismatch: expected 50000, got ${advAccFinal.currentBalance}`);
    }
    if (Number(debAccFinal.currentBalance) !== 59000) {
      throw new Error(`Sundry Debtors GL mismatch: expected 59000, got ${debAccFinal.currentBalance}`);
    }
  });

  // ==========================================================================
  // SCENARIO 2: PAYMENT ALLOCATION REVERSAL INTEGRITY (MANDATED REQUIREMENT 2)
  // ==========================================================================
  await test('2.1 Standard Receipt Allocation Reversal preserves original payment voucher', async () => {
    // Record regular receipt of ₹30,000
    const regReceipt = await receiptService.createReceipt(
      company.id,
      {
        customerId: customer.id,
        paymentMode: 'BANK',
        amount: 30000,
        bankAccountId: bankAcc.id,
        chequeOrReferenceNo: 'REG-PAY-1100',
      },
      actor
    );

    // Allocate full ₹23,600 to clear Invoice 2 balance
    const regAlloc = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: regReceipt.id,
        invoiceId: postedInvoice2.id,
        allocatedAmount: 23600,
      },
      actor
    );

    const inv2Paid = await salesInvoiceService.getInvoiceById(company.id, postedInvoice2.id);
    if (inv2Paid.status !== 'PAID' || Number(inv2Paid.outstandingAmount) !== 0) {
      throw new Error('Invoice 2 should be PAID with 0 outstanding');
    }

    // Reverse allocation
    await allocationService.reverseAllocation(company.id, regAlloc.id, 'Cheque bounce reconciliation', actor);

    // Verify original receipt voucher is STILL POSTED and completely untouched!
    const origReceiptVoucher = await voucherService.getVoucherById(company.id, regReceipt.voucherId);
    if (origReceiptVoucher.status !== 'POSTED') {
      throw new Error(`Original receipt voucher mutated: ${origReceiptVoucher.status}`);
    }

    // Invoice 2 outstanding restored to full ₹23,600 (POSTED)
    const inv2AfterRev = await salesInvoiceService.getInvoiceById(company.id, postedInvoice2.id);
    if (Number(inv2AfterRev.outstandingAmount) !== 23600 || inv2AfterRev.status !== 'POSTED') {
      throw new Error(`Invoice 2 balance not restored: ${inv2AfterRev.outstandingAmount} (${inv2AfterRev.status})`);
    }

    // Receipt unallocated restored to ₹30,000
    const regRctRestored = await receiptService.getReceiptById(company.id, regReceipt.id);
    if (Number(regRctRestored.unallocatedAmount) !== 30000) {
      throw new Error(`Receipt unallocated not restored: ${regRctRestored.unallocatedAmount}`);
    }
  });

  // ==========================================================================
  // SCENARIO 3: PHASE 7 DISPATCH INVOICE SYNCHRONIZATION (MANDATED REQUIREMENT 3)
  // ==========================================================================
  let dispatch1;

  await test('3.1 Phase 7 DispatchOrder invoice synchronization and ownership validation', async () => {
    // Create Phase 7 Dispatch Order
    dispatch1 = await prisma.dispatchOrder.create({
      data: {
        companyId: company.id,
        dispatchNo: `DSP-${Date.now().toString().slice(-6)}`,
        customerId: customer.id,
        customerName: customer.companyName,
        status: 'DELIVERED',
        fulfillmentType: 'FULL',
        items: {
          create: [
            {
              companyId: company.id,
              sku: 'SOLAR-CAB-4SQMM',
              productName: '4 sqmm Solar DC Cable',
              orderedQty: 500,
              dispatchedQty: 500,
              unitPrice: 50,
              taxRate: 18,
              totalAmount: 25000,
              taxAmount: 4500,
              grossAmount: 29500,
            },
          ],
        },
      },
    });

    // 1. Create SalesInvoice linked to dispatchOrderId (taxRate and items derived from dispatch)
    const dispatchInvoice = await salesInvoiceService.createDraftInvoice(
      company.id,
      {
        customerId: customer.id,
        dispatchOrderId: dispatch1.id,
        invoiceNo: `INV-DSP-${Date.now().toString().slice(-4)}`,
      },
      actor
    );

    if (Number(dispatchInvoice.totalAmount) !== 29500) {
      throw new Error(`Derived total amount mismatch: expected 29500, got ${dispatchInvoice.totalAmount}`);
    }

    // Post Invoice: must safely synchronize invoiceNo & invoiceDate back to DispatchOrder
    await salesInvoiceService.postInvoice(company.id, dispatchInvoice.id, actor);

    const syncedDispatch = await prisma.dispatchOrder.findUnique({ where: { id: dispatch1.id } });
    if (syncedDispatch.invoiceNo !== dispatchInvoice.invoiceNo) {
      throw new Error(`Dispatch invoiceNo was not synchronized: expected ${dispatchInvoice.invoiceNo}, got ${syncedDispatch.invoiceNo}`);
    }
    if (!syncedDispatch.invoiceDate) {
      throw new Error('Dispatch invoiceDate was not synchronized');
    }
  });

  await test('3.2 Conflict Prevention: Cannot overwrite existing invoice or create duplicate invoice for dispatch', async () => {
    // 1. Attempting to create another invoice for dispatch1 must fail with duplicate check
    try {
      await salesInvoiceService.createDraftInvoice(
        company.id,
        {
          customerId: customer.id,
          dispatchOrderId: dispatch1.id,
          invoiceNo: `INV-CONFLICT-${Date.now().toString().slice(-4)}`,
        },
        actor
      );
      throw new Error('Should have blocked conflicting invoice creation on already-invoiced dispatch order');
    } catch (err) {
      if (!err.message.includes('already has a linked invoice') && !err.message.includes('already linked to active Sales Invoice')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // 2. Customer mismatch check: cannot link Dispatch belonging to Customer A to Customer B invoice
    const newDispatch = await prisma.dispatchOrder.create({
      data: {
        companyId: company.id,
        dispatchNo: `DSP-CUSTA-${Date.now().toString().slice(-6)}`,
        customerId: customer.id,
        customerName: customer.companyName,
        status: 'DISPATCHED',
        items: {
          create: [{ companyId: company.id, sku: 'TEST', productName: 'Test Solar Item', orderedQty: 10, dispatchedQty: 10, unitPrice: 100, taxRate: 18 }],
        },
      },
    });

    try {
      await salesInvoiceService.createDraftInvoice(
        company.id,
        {
          customerId: customerOther.id, // Mismatched customer!
          dispatchOrderId: newDispatch.id,
        },
        actor
      );
      throw new Error('Should have blocked dispatch invoice with mismatched customerId');
    } catch (err) {
      if (!err.message.includes('Customer mismatch')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // ==========================================================================
  // SCENARIO 4: VENDOR PAYMENT & SUBLEDGER RECONCILIATION (MANDATED REQUIREMENT 4)
  // ==========================================================================
  let vendor;
  let vBill1;
  let vBill2;

  await test('4.1 Vendor Payables: Purchase Bill GL Posting & Subledger Reconciliation', async () => {
    vendor = await prisma.vendor.create({
      data: {
        companyId: company.id,
        name: 'Waaree Solar Inverters Ltd',
        taxId: '08AAACW9999K1Z5',
        pan: 'AAACW9999K',
        phone: '9829055443',
      },
    });

    const vReq = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        requestNo: `PR-REC-${Date.now().toString().slice(-6)}`,
        items: [{ sku: 'WAAREE-INV', name: '10kW Inverter', quantity: 2 }],
      },
    });

    const vQuote = await prisma.purchaseQuotation.create({
      data: {
        companyId: company.id,
        requestId: vReq.id,
        vendorId: vendor.id,
        quoteNo: `QUO-REC-${Date.now().toString().slice(-6)}`,
        items: [{ sku: 'WAAREE-INV', quantity: 2, unitPrice: 50000 }],
      },
    });

    const vPO1 = await prisma.purchaseOrder.create({
      data: {
        companyId: company.id,
        requestId: vReq.id,
        quotationId: vQuote.id,
        vendorId: vendor.id,
        poNumber: `PO-REC-1-${Date.now().toString().slice(-6)}`,
        items: [{ sku: 'WAAREE-INV', quantity: 1, unitPrice: 50000 }],
        subtotal: 50000,
        taxAmount: 9000,
        totalAmount: 59000,
      },
    });

    // Bill 1: ₹59,000 (taxable 50,000 + tax 9,000)
    vBill1 = await prisma.purchaseBill.create({
      data: {
        companyId: company.id,
        orderId: vPO1.id,
        billNo: `PB-001-${Date.now().toString().slice(-4)}`,
        vendorInvoiceNo: `VINV-001-${Date.now().toString().slice(-4)}`,
        invoiceDate: new Date('2026-05-15'),
        dueDate: new Date('2026-06-15'),
        taxableAmount: 50000,
        taxAmount: 9000,
        totalAmount: 59000,
        status: 'UNPAID',
        paymentHold: false,
      },
    });

    // Post Bill 1 to GL: Dr Purchase ₹50,000 / Dr Input GST ₹9,000 / Cr Sundry Creditors ₹59,000
    const pbVoucher = await vendorPayableService.postPurchaseBill(company.id, vBill1.id, actor);
    if (pbVoucher.status !== 'POSTED') throw new Error('Purchase Bill voucher not posted');

    const credLine = pbVoucher.items.find((i) => i.account.controlType === 'SUNDRY_CREDITORS');
    if (!credLine || Number(credLine.creditAmount) !== 59000 || credLine.vendorId !== vendor.id) {
      throw new Error(`Creditors line invalid: Cr ₹${credLine?.creditAmount}, vendorId: ${credLine?.vendorId}`);
    }
  });

  await test('4.2 PaymentHold blocks allocation, release allows allocation and subledger update', async () => {
    // Put Bill 1 on payment hold
    await prisma.purchaseBill.update({
      where: { id: vBill1.id },
      data: {
        paymentHold: true,
        holdReason: 'Warranty clause amendment pending under commercial negotiation',
      },
    });

    // Disburse payment of ₹59,000
    const vPayment = await vendorPayableService.recordVendorPayment(
      company.id,
      {
        vendorId: vendor.id,
        paymentMode: 'BANK',
        amount: 59000,
        bankAccountId: bankAcc.id,
        chequeOrReferenceNo: 'SBI-DISB-7788',
      },
      actor
    );

    // Verify Payment GL Voucher: Dr Sundry Creditors ₹59,000 / Cr Bank ₹59,000
    const payVoucher = await voucherService.getVoucherById(company.id, vPayment.voucherId);
    const drCred = payVoucher.items.find((i) => i.account.controlType === 'SUNDRY_CREDITORS');
    if (!drCred || Number(drCred.debitAmount) !== 59000 || drCred.vendorId !== vendor.id) {
      throw new Error(`Payment voucher Dr line invalid: Dr ₹${drCred?.debitAmount}, vendorId: ${drCred?.vendorId}`);
    }

    // Attempting allocation while on hold MUST FAIL!
    try {
      await allocationService.allocatePayment(
        company.id,
        {
          paymentReceiptId: vPayment.id,
          billId: vBill1.id,
          allocatedAmount: 59000,
        },
        actor
      );
      throw new Error('Should have blocked payment allocation against bill on hold');
    } catch (err) {
      if (!err.message.includes('Payment Hold Enforced') && !err.message.includes('HOLD')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Release hold
    await prisma.purchaseBill.update({
      where: { id: vBill1.id },
      data: {
        paymentHold: false,
        holdReleaseReason: 'Commercial negotiation agreed and signed',
      },
    });

    // Now allocation must succeed
    const successfulAlloc = await allocationService.allocatePayment(
      company.id,
      {
        paymentReceiptId: vPayment.id,
        billId: vBill1.id,
        allocatedAmount: 59000,
      },
      actor
    );
    if (successfulAlloc.status !== 'ACTIVE') throw new Error('Bill allocation failed after hold release');

    // Bill 1 status updated to PAID
    const billAfter = await vendorPayableService.getVendorBillDetails(company.id, vBill1.id);
    if (Number(billAfter.outstandingAmount) !== 0 || billAfter.status !== 'PAID') {
      throw new Error(`Bill outstanding expected 0 (PAID), got ${billAfter.outstandingAmount}`);
    }

    // Reversal of vendor bill allocation does NOT touch the payment voucher
    await allocationService.reverseAllocation(company.id, successfulAlloc.id, 'Wrong bill allocation', actor);
    const payVoucherAfterRev = await voucherService.getVoucherById(company.id, vPayment.voucherId);
    if (payVoucherAfterRev.status !== 'POSTED') {
      throw new Error('Payment voucher was mutated during allocation reversal');
    }
  });

  await test('4.3 Vendor Debit Note: Subledger adjustment & General Ledger Reconciliation', async () => {
    // Create Vendor Debit Note for ₹11,800
    const dn = await vendorPayableService.createVendorDebitNote(
      company.id,
      {
        vendorId: vendor.id,
        purchaseBillId: vBill1.id,
        taxableAmount: 10000,
        cgstAmount: 900,
        sgstAmount: 900,
        totalAmount: 11800,
        reason: 'Price revision agreed due to bulk discount',
      },
      actor
    );

    if (dn.status !== 'POSTED') throw new Error('Debit Note not posted');

    const dnVoucher = await voucherService.getVoucherById(company.id, dn.voucherId);
    const drCreditor = dnVoucher.items.find((i) => i.account.controlType === 'SUNDRY_CREDITORS');
    if (!drCreditor || Number(drCreditor.debitAmount) !== 11800 || drCreditor.vendorId !== vendor.id) {
      throw new Error(`Debit Note Dr Creditor line mismatch: Dr ₹${drCreditor?.debitAmount}`);
    }

    // Verify subledger statement reflects all movements with zero discrepancy
    const stmt = await prisma.journalVoucherItem.findMany({
      where: {
        companyId: company.id,
        vendorId: vendor.id,
        voucher: { status: 'POSTED' },
      },
    });

    // Total Debits vs Total Credits on vendor subledger
    const subledgerDr = stmt.reduce((sum, item) => sum.add(new Decimal(item.debitAmount)), new Decimal(0));
    const subledgerCr = stmt.reduce((sum, item) => sum.add(new Decimal(item.creditAmount)), new Decimal(0));

    // Net balance on vendor subledger = Credits - Debits
    const netSubledgerVendor = subledgerCr.sub(subledgerDr);

    // Verify against Sundry Creditors AccountMaster currentBalance
    const creditorsAcc = await standardAccountsService.ensureStandardAccount(company.id, 'SUNDRY_CREDITORS');
    const glCreditorBal = new Decimal(creditorsAcc.currentBalance);

    if (!netSubledgerVendor.equals(glCreditorBal)) {
      throw new Error(`Vendor subledger (₹${netSubledgerVendor}) does not reconcile with Sundry Creditors GL head (₹${glCreditorBal})`);
    }
  });

  console.log('\n========================================================================');
  console.log(`Phase 8 Part 2 Final Verification Finished: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    throw new Error(`${failedTests} test(s) failed in Final Verification suite.`);
  }
}

runFinalVerification()
  .catch((err) => {
    console.error('Final verification runner failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
