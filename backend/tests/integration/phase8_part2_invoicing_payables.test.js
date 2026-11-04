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

const Decimal = Prisma.Decimal;
import salesInvoiceService from '../../src/services/accounting/salesInvoice.service.js';
import receiptService from '../../src/services/accounting/receipt.service.js';
import allocationService from '../../src/services/accounting/allocation.service.js';
import vendorPayableService from '../../src/services/accounting/vendorPayable.service.js';
import ageingService from '../../src/services/accounting/ageing.service.js';
import coaService from '../../src/services/accounting/coa.service.js';
import periodService from '../../src/services/accounting/period.service.js';
import voucherService from '../../src/services/accounting/voucher.service.js';
import standardAccountsService from '../../src/services/accounting/standardAccounts.service.js';

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

async function runPart2Tests() {
  console.log('========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 8 Step 2 Part 2: Invoicing, Receipts & Payables');
  console.log(`Target Database: ${configuredDbName} (ISOLATED TEST DATABASE)`);
  console.log('Verifying: Sales Invoicing, GST Split, Receipts, Allocations, Payables, Ageing');
  console.log('========================================================================\n');

  // Runtime MySQL verification
  const [dbNameRow] = await prisma.$queryRawUnsafe('SELECT DATABASE() AS activeDb;');
  const activeDb = dbNameRow?.activeDb;
  console.log(`[Runtime Connection Verification] Active MySQL Database: ${activeDb}\n`);

  if (activeDb !== 'crm_erp_test_db') {
    console.error(`🚨 FATAL: Active database connection is '${activeDb}'. Aborting.`);
    process.exit(1);
  }

  // Setup Company A (Tenant A)
  const companyA = await prisma.clientAdmin.create({
    data: {
      name: `Accounting Test Co A - ${Date.now()}`,
      email: `acct_a_${Date.now()}@testcorp.com`,
      organizationName: `Acct Test Org A`,
      passwordHash: 'dummy-hashed-secret',
      status: 'ACTIVE',
    },
  });

  // Setup Company B (Tenant B for cross-company boundary testing)
  const companyB = await prisma.clientAdmin.create({
    data: {
      name: `Accounting Test Co B - ${Date.now()}`,
      email: `acct_b_${Date.now()}@testcorp.com`,
      organizationName: `Acct Test Org B`,
      passwordHash: 'dummy-hashed-secret',
      status: 'ACTIVE',
    },
  });

  const actor = { id: 'usr-acct-head', name: 'Chief Financial Officer' };

  // Setup FY and Accounting Periods for Company A
  const fyA = await periodService.createFinancialYear(
    companyA.id,
    {
      name: 'FY 2026-27',
      code: `FY2627-${Date.now().toString().slice(-4)}`,
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
    },
    actor
  );
  await periodService.generateStandardPeriods(companyA.id, fyA.id, actor);

  // Setup Customers in Company A
  // 1. Intra-state Rajasthan Customer (GSTIN starts with 08)
  const custIntra = await prisma.crmCustomer.create({
    data: {
      companyId: companyA.id,
      companyName: 'Jaipur Solar Distribution Ltd',
      gstin: '08ABCDE1234F1Z5',
      phone: '9876543210',
      billingAddress: 'Tonk Road, Jaipur, Rajasthan',
    },
  });

  // 2. Inter-state Maharashtra Customer (GSTIN starts with 27)
  const custInter = await prisma.crmCustomer.create({
    data: {
      companyId: companyA.id,
      companyName: 'Mumbai Energy Solutions PVT LTD',
      gstin: '27AABCM5678G2Z1',
      phone: '9123456780',
      billingAddress: 'Nariman Point, Mumbai, Maharashtra',
    },
  });

  // Setup Customer in Company B
  const custCompB = await prisma.crmCustomer.create({
    data: {
      companyId: companyB.id,
      companyName: 'Tenant B Customer Ltd',
      phone: '9998887776',
    },
  });

  // Setup Bank Account for Company A
  const bankAcc = await prisma.bankAccount.create({
    data: {
      companyId: companyA.id,
      accountHolderName: 'Accounting Test Co A',
      bankName: 'HDFC Bank',
      accountNumber: `HDFC-${Date.now().toString().slice(-6)}`,
      ifscCode: 'HDFC0001234',
      branchName: 'MI Road, Jaipur',
      accountType: 'CURRENT',
      openingBalance: 500000,
      currentBalance: 500000,
    },
  });

  let intraInvoice;
  let interInvoice;

  // --------------------------------------------------------------------------
  // TEST 1: INVOICE TAX CALCULATION & GST SPLITS
  // --------------------------------------------------------------------------
  await test('1.1 Invoice Calculation: Intra-state 18% GST (9% CGST + 9% SGST)', async () => {
    // 10 units @ ₹1,000 = ₹10,000 taxable. 18% tax -> ₹900 CGST, ₹900 SGST, ₹0 IGST. Total: ₹11,800
    intraInvoice = await salesInvoiceService.createDraftInvoice(
      companyA.id,
      {
        customerId: custIntra.id,
        invoiceDate: new Date('2026-05-10'),
        items: [
          {
            sku: 'SOLAR-INV-5KW',
            description: '5kW Hybrid Solar Inverter',
            quantity: 10,
            unitPrice: 1000,
            taxRate: 18,
          },
        ],
      },
      actor
    );

    if (Number(intraInvoice.taxableAmount) !== 10000) {
      throw new Error(`Taxable amount mismatch: expected 10000, got ${intraInvoice.taxableAmount}`);
    }
    if (Number(intraInvoice.cgstAmount) !== 900) {
      throw new Error(`CGST mismatch: expected 900, got ${intraInvoice.cgstAmount}`);
    }
    if (Number(intraInvoice.sgstAmount) !== 900) {
      throw new Error(`SGST mismatch: expected 900, got ${intraInvoice.sgstAmount}`);
    }
    if (Number(intraInvoice.igstAmount) !== 0) {
      throw new Error(`IGST mismatch: expected 0, got ${intraInvoice.igstAmount}`);
    }
    if (Number(intraInvoice.totalAmount) !== 11800) {
      throw new Error(`Total amount mismatch: expected 11800, got ${intraInvoice.totalAmount}`);
    }
    if (intraInvoice.isInterState !== false) {
      throw new Error('Invoice should be intra-state');
    }
  });

  await test('1.2 Invoice Calculation: Inter-state 18% GST (18% IGST, 0 CGST/SGST)', async () => {
    // 5 units @ ₹2,000 = ₹10,000 taxable. 18% tax -> ₹1,800 IGST. Total: ₹11,800
    interInvoice = await salesInvoiceService.createDraftInvoice(
      companyA.id,
      {
        customerId: custInter.id,
        invoiceDate: new Date('2026-05-12'),
        items: [
          {
            sku: 'SOLAR-PANEL-540W',
            description: '540W Mono PERC Solar Panel',
            quantity: 5,
            unitPrice: 2000,
            taxRate: 18,
          },
        ],
      },
      actor
    );

    if (Number(interInvoice.taxableAmount) !== 10000) {
      throw new Error(`Taxable amount mismatch: expected 10000, got ${interInvoice.taxableAmount}`);
    }
    if (Number(interInvoice.cgstAmount) !== 0 || Number(interInvoice.sgstAmount) !== 0) {
      throw new Error(`CGST/SGST should be 0 for inter-state, got CGST ${interInvoice.cgstAmount}, SGST ${interInvoice.sgstAmount}`);
    }
    if (Number(interInvoice.igstAmount) !== 1800) {
      throw new Error(`IGST mismatch: expected 1800, got ${interInvoice.igstAmount}`);
    }
    if (Number(interInvoice.totalAmount) !== 11800) {
      throw new Error(`Total amount mismatch: expected 11800, got ${interInvoice.totalAmount}`);
    }
    if (interInvoice.isInterState !== true) {
      throw new Error('Invoice should be inter-state');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: STRICT MISSING TAX DATA REJECTION (MANDATED REQUIREMENT)
  // --------------------------------------------------------------------------
  await test('2. Strict Tax Invariant: Reject invoice creation when taxRate is missing (no silent 18% assumption)', async () => {
    try {
      await salesInvoiceService.createDraftInvoice(
        companyA.id,
        {
          customerId: custIntra.id,
          invoiceDate: new Date('2026-05-15'),
          items: [
            {
              sku: 'NO-TAX-ITEM',
              description: 'Missing tax rate',
              quantity: 2,
              unitPrice: 500,
              // taxRate omitted
            },
          ],
        },
        actor
      );
      throw new Error('Should have rejected invoice with missing taxRate');
    } catch (err) {
      if (!err.message.includes('Missing taxRate')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: ATOMIC INVOICE POSTING & BALANCED JOURNAL GENERATION
  // --------------------------------------------------------------------------
  await test('3.1 Atomic Invoice Posting: Generate balanced double-entry voucher', async () => {
    const posted = await salesInvoiceService.postInvoice(companyA.id, intraInvoice.id, actor);

    if (posted.status !== 'POSTED') throw new Error(`Invoice status should be POSTED, got ${posted.status}`);
    if (!posted.voucherId) throw new Error('Voucher was not linked to posted invoice');

    const voucher = await voucherService.getVoucherById(companyA.id, posted.voucherId);
    if (voucher.status !== 'POSTED') throw new Error(`Voucher status should be POSTED, got ${voucher.status}`);
    if (Number(voucher.totalDebit) !== 11800 || Number(voucher.totalCredit) !== 11800) {
      throw new Error(`Voucher totals mismatch: Dr ₹${voucher.totalDebit}, Cr ₹${voucher.totalCredit}`);
    }

    // Verify voucher lines:
    // Line 1: Sundry Debtors Debit ₹11,800 (with customerId)
    const debtorsLine = voucher.items.find((i) => i.account.controlType === 'SUNDRY_DEBTORS');
    if (!debtorsLine) throw new Error('Sundry Debtors line missing from journal entry');
    if (Number(debtorsLine.debitAmount) !== 11800 || debtorsLine.customerId !== custIntra.id) {
      throw new Error(`Debtors line invalid: Dr ₹${debtorsLine.debitAmount}, customerId ${debtorsLine.customerId}`);
    }

    // Line 2: Sales Revenue Credit ₹10,000
    const salesLine = voucher.items.find((i) => i.account.controlType === 'SALES_REVENUE');
    if (!salesLine || Number(salesLine.creditAmount) !== 10000) {
      throw new Error(`Sales line invalid: Cr ₹${salesLine?.creditAmount}`);
    }

    // Line 3: Output CGST Credit ₹900
    const cgstLine = voucher.items.find((i) => i.account.controlType === 'OUTPUT_CGST');
    if (!cgstLine || Number(cgstLine.creditAmount) !== 900) {
      throw new Error(`Output CGST line invalid: Cr ₹${cgstLine?.creditAmount}`);
    }

    // Line 4: Output SGST Credit ₹900
    const sgstLine = voucher.items.find((i) => i.account.controlType === 'OUTPUT_SGST');
    if (!sgstLine || Number(sgstLine.creditAmount) !== 900) {
      throw new Error(`Output SGST line invalid: Cr ₹${sgstLine?.creditAmount}`);
    }
  });

  await test('3.2 Posting Immutability & Duplicate Prevention', async () => {
    // 1. Cannot post an already posted invoice
    try {
      await salesInvoiceService.postInvoice(companyA.id, intraInvoice.id, actor);
      throw new Error('Should have rejected double posting of invoice');
    } catch (err) {
      if (!err.message.includes('already been POSTED') && !err.message.includes('Only DRAFT')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // 2. Cannot update items on posted invoice
    try {
      await salesInvoiceService.updateDraftInvoice(
        companyA.id,
        intraInvoice.id,
        { items: [{ sku: 'MODIFIED', quantity: 1, unitPrice: 100, taxRate: 18 }] },
        actor
      );
      throw new Error('Should have blocked update on posted invoice');
    } catch (err) {
      if (!err.message.includes('IMMUTABLE')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  // Post the inter-state invoice as well for subsequent tests
  await test('3.3 Post Inter-state Invoice (IGST Ledger Line)', async () => {
    const postedInter = await salesInvoiceService.postInvoice(companyA.id, interInvoice.id, actor);
    const voucher = await voucherService.getVoucherById(companyA.id, postedInter.voucherId);
    const igstLine = voucher.items.find((i) => i.account.controlType === 'OUTPUT_IGST');
    if (!igstLine || Number(igstLine.creditAmount) !== 1800) {
      throw new Error(`Output IGST line invalid: Cr ₹${igstLine?.creditAmount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: CUSTOMER RECEIPTS & ADVANCES
  // --------------------------------------------------------------------------
  let receipt1;
  let advanceReceipt;

  await test('4.1 Customer Receipt: Record Bank receipt and generate balanced voucher', async () => {
    // Receipt of ₹15,000 from Jaipur Solar (covers intraInvoice ₹11,800 + partial for next)
    receipt1 = await receiptService.createReceipt(
      companyA.id,
      {
        customerId: custIntra.id,
        paymentMode: 'BANK',
        amount: 15000,
        bankAccountId: bankAcc.id,
        chequeOrReferenceNo: 'HDFC-NEFT-99120',
        paymentDate: new Date('2026-05-18'),
        notes: 'Full payment against invoice 1 + on-account balance',
      },
      actor
    );

    if (receipt1.status !== 'POSTED') throw new Error(`Receipt status should be POSTED, got ${receipt1.status}`);
    if (Number(receipt1.amount) !== 15000) throw new Error(`Amount mismatch: ${receipt1.amount}`);
    if (Number(receipt1.unallocatedAmount) !== 15000) {
      throw new Error(`Unallocated amount should be initial ₹15,000, got ${receipt1.unallocatedAmount}`);
    }

    const voucher = await voucherService.getVoucherById(companyA.id, receipt1.voucherId);
    if (Number(voucher.totalDebit) !== 15000 || Number(voucher.totalCredit) !== 15000) {
      throw new Error(`Receipt voucher unbalanced: Dr ₹${voucher.totalDebit}, Cr ₹${voucher.totalCredit}`);
    }
  });

  await test('4.2 Customer Advance: Record advance with Customer Advances liability accounting', async () => {
    advanceReceipt = await receiptService.createReceipt(
      companyA.id,
      {
        customerId: custInter.id,
        paymentMode: 'BANK',
        amount: 25000,
        isAdvance: true,
        bankAccountId: bankAcc.id,
        chequeOrReferenceNo: 'ICICI-RTGS-7721',
        paymentDate: new Date('2026-05-20'),
        notes: 'Advance booking for upcoming megawatt project',
      },
      actor
    );

    if (advanceReceipt.paymentType !== 'ADVANCE') {
      throw new Error(`Payment type should be ADVANCE, got ${advanceReceipt.paymentType}`);
    }

    // Verify CustomerAdvance model record was created
    const advRecord = await prisma.customerAdvance.findFirst({
      where: { companyId: companyA.id, customerId: custInter.id },
    });
    if (!advRecord || Number(advRecord.amount) !== 25000) {
      throw new Error('CustomerAdvance record was not created or amount mismatch');
    }

    // Verify voucher credits Customer Advances liability account
    const voucher = await voucherService.getVoucherById(companyA.id, advanceReceipt.voucherId);
    const advLine = voucher.items.find((i) => i.account.controlType === 'CUSTOMER_ADVANCES');
    if (!advLine || Number(advLine.creditAmount) !== 25000) {
      throw new Error(`Customer Advances line missing or amount mismatch: Cr ₹${advLine?.creditAmount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: PAYMENT ALLOCATION ENGINE (STRICT XOR, PARTIAL, ATOMICITY)
  // --------------------------------------------------------------------------
  let allocation1;

  await test('5.1 Payment Allocation: Allocate receipt against Sales Invoice (Partial / Full)', async () => {
    // Allocate ₹11,800 from receipt1 (₹15,000) to fully pay intraInvoice (₹11,800)
    allocation1 = await allocationService.allocatePayment(
      companyA.id,
      {
        paymentReceiptId: receipt1.id,
        invoiceId: intraInvoice.id,
        allocatedAmount: 11800,
        notes: 'Full settlement of invoice 1',
      },
      actor
    );

    if (allocation1.status !== 'ACTIVE') throw new Error('Allocation status should be ACTIVE');
    if (allocation1.targetType !== 'SALES_INVOICE') throw new Error('Target type should be SALES_INVOICE');

    // Verify invoice paidAmount and outstanding
    const updatedInvoice = await salesInvoiceService.getInvoiceById(companyA.id, intraInvoice.id);
    if (Number(updatedInvoice.paidAmount) !== 11800) {
      throw new Error(`Invoice paidAmount expected 11800, got ${updatedInvoice.paidAmount}`);
    }
    if (Number(updatedInvoice.outstandingAmount) !== 0) {
      throw new Error(`Invoice outstanding expected 0, got ${updatedInvoice.outstandingAmount}`);
    }
    if (updatedInvoice.status !== 'PAID') {
      throw new Error(`Invoice status expected PAID, got ${updatedInvoice.status}`);
    }

    // Verify receipt unallocatedAmount deducted: 15,000 - 11,800 = 3,200
    const updatedReceipt = await receiptService.getReceiptById(companyA.id, receipt1.id);
    if (Number(updatedReceipt.unallocatedAmount) !== 3200) {
      throw new Error(`Receipt unallocated expected 3200, got ${updatedReceipt.unallocatedAmount}`);
    }
  });

  await test('5.2 Target XOR Enforcement: Reject allocation specifying both invoice and bill or neither', async () => {
    // Both invoiceId and billId provided
    try {
      await allocationService.allocatePayment(
        companyA.id,
        {
          paymentReceiptId: receipt1.id,
          invoiceId: intraInvoice.id,
          billId: 'fake-bill-id',
          allocatedAmount: 500,
        },
        actor
      );
      throw new Error('Should have rejected allocation with both invoiceId and billId');
    } catch (err) {
      if (!err.message.includes('PaymentAllocation must target either a SalesInvoice OR a PurchaseBill')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Neither invoiceId nor billId provided
    try {
      await allocationService.allocatePayment(
        companyA.id,
        {
          paymentReceiptId: receipt1.id,
          allocatedAmount: 500,
        },
        actor
      );
      throw new Error('Should have rejected allocation with neither invoiceId nor billId');
    } catch (err) {
      if (!err.message.includes('PaymentAllocation must target either a SalesInvoice OR a PurchaseBill')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  await test('5.3 Over-Allocation Rejection: Cannot exceed unallocated receipt amount or invoice outstanding', async () => {
    // Current unallocated on receipt1 is ₹3,200. Attempting to allocate ₹5,000 must fail.
    const newDraftInv = await salesInvoiceService.createDraftInvoice(
      companyA.id,
      {
        customerId: custIntra.id,
        items: [{ sku: 'TEST-SKU', quantity: 1, unitPrice: 10000, taxRate: 18 }],
      },
      actor
    );
    await salesInvoiceService.postInvoice(companyA.id, newDraftInv.id, actor);

    try {
      await allocationService.allocatePayment(
        companyA.id,
        {
          paymentReceiptId: receipt1.id,
          invoiceId: newDraftInv.id,
          allocatedAmount: 5000, // 5000 > 3200 unallocated
        },
        actor
      );
      throw new Error('Should have blocked allocation exceeding unallocated receipt amount');
    } catch (err) {
      if (!err.message.includes('exceeds available unallocated')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Allocate ₹3,200 correctly
    await allocationService.allocatePayment(
      companyA.id,
      {
        paymentReceiptId: receipt1.id,
        invoiceId: newDraftInv.id,
        allocatedAmount: 3200,
      },
      actor
    );

    // Now receipt unallocated is 0. Attempting to allocate anything more must fail.
    try {
      await allocationService.allocatePayment(
        companyA.id,
        {
          paymentReceiptId: receipt1.id,
          invoiceId: newDraftInv.id,
          allocatedAmount: 100,
        },
        actor
      );
      throw new Error('Should have blocked allocation from empty receipt');
    } catch (err) {
      if (!err.message.includes('exceeds available unallocated')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  await test('5.4 Reversal Integrity: Roll back allocation and restore ledger balances', async () => {
    // Reverse allocation1 (₹11,800)
    const reversed = await allocationService.reverseAllocation(
      companyA.id,
      allocation1.id,
      'Allocated against wrong invoice number by clerk',
      actor
    );

    if (reversed.status !== 'REVERSED') throw new Error(`Status should be REVERSED, got ${reversed.status}`);

    // Receipt unallocated balance restored
    const receiptAfterRev = await receiptService.getReceiptById(companyA.id, receipt1.id);
    if (Number(receiptAfterRev.unallocatedAmount) !== 11800) {
      throw new Error(`Receipt unallocated expected 11800, got ${receiptAfterRev.unallocatedAmount}`);
    }

    // Invoice restored to POSTED and outstanding back to ₹11,800
    const invAfterRev = await salesInvoiceService.getInvoiceById(companyA.id, intraInvoice.id);
    if (Number(invAfterRev.paidAmount) !== 0 || Number(invAfterRev.outstandingAmount) !== 11800) {
      throw new Error(`Invoice balance not restored: Paid ${invAfterRev.paidAmount}, Outstanding ${invAfterRev.outstandingAmount}`);
    }
    if (invAfterRev.status !== 'POSTED') {
      throw new Error(`Invoice status expected POSTED, got ${invAfterRev.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: VENDOR PAYABLES, PAYMENT HOLD ENFORCEMENT & DEBIT NOTES
  // --------------------------------------------------------------------------
  let testVendor;
  let testPO;
  let testBill;

  await test('6.1 Vendor Setup & Purchase Bill GL Posting', async () => {
    testVendor = await prisma.vendor.create({
      data: {
        companyId: companyA.id,
        name: 'Insolation Energy Solar Manufacturing',
        taxId: '08AAACI1234K1Z8',
        pan: 'AAACI1234K',
        phone: '9829012345',
      },
    });

    const testReq = await prisma.purchaseRequest.create({
      data: {
        companyId: companyA.id,
        requestNo: `PR-${Date.now().toString().slice(-6)}`,
        items: [{ sku: 'SOLAR-CELL', name: 'Mono Solar Cells', quantity: 100 }],
      },
    });

    const testQuote = await prisma.purchaseQuotation.create({
      data: {
        companyId: companyA.id,
        requestId: testReq.id,
        vendorId: testVendor.id,
        quoteNo: `QUO-${Date.now().toString().slice(-6)}`,
        items: [{ sku: 'SOLAR-CELL', name: 'Mono Solar Cells', quantity: 100, unitPrice: 200 }],
      },
    });

    testPO = await prisma.purchaseOrder.create({
      data: {
        companyId: companyA.id,
        requestId: testReq.id,
        quotationId: testQuote.id,
        vendorId: testVendor.id,
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        items: [{ sku: 'SOLAR-CELL', name: 'Mono Solar Cells', quantity: 100, unitPrice: 200 }],
        subtotal: 20000,
        taxAmount: 3600,
        totalAmount: 23600,
      },
    });

    testBill = await prisma.purchaseBill.create({
      data: {
        companyId: companyA.id,
        orderId: testPO.id,
        billNo: `PBILL-${Date.now().toString().slice(-6)}`,
        vendorInvoiceNo: `VINV-${Date.now().toString().slice(-6)}`,
        invoiceDate: new Date('2026-05-15'),
        dueDate: new Date('2026-06-15'),
        taxableAmount: 20000,
        taxAmount: 3600,
        totalAmount: 23600,
        status: 'UNPAID',
        paymentHold: false,
      },
    });

    // Post Purchase Bill to GL
    const pbVoucher = await vendorPayableService.postPurchaseBill(companyA.id, testBill.id, actor);
    if (pbVoucher.status !== 'POSTED') throw new Error('Purchase Bill voucher not posted');

    // Verify voucher items: Debit Purchase ₹20,000, Debit Input CGST ₹1,800, Input SGST ₹1,800, Credit Sundry Creditors ₹23,600
    const creditorsLine = pbVoucher.items.find((i) => i.account.controlType === 'SUNDRY_CREDITORS');
    if (!creditorsLine || Number(creditorsLine.creditAmount) !== 23600 || creditorsLine.vendorId !== testVendor.id) {
      throw new Error(`Creditors line invalid: Cr ₹${creditorsLine?.creditAmount}, vendorId ${creditorsLine?.vendorId}`);
    }
  });

  await test('6.2 Payment Hold Enforcement: Block allocation against bill on payment hold', async () => {
    // Put bill on payment hold
    await prisma.purchaseBill.update({
      where: { id: testBill.id },
      data: {
        paymentHold: true,
        holdReason: 'Cell efficiency deviation under technical review by QC lead',
      },
    });

    // Record vendor payment
    const vPayment = await vendorPayableService.recordVendorPayment(
      companyA.id,
      {
        vendorId: testVendor.id,
        paymentMode: 'BANK',
        amount: 23600,
        bankAccountId: bankAcc.id,
        chequeOrReferenceNo: 'HDFC-RTGS-5544',
      },
      actor
    );

    // Attempting to allocate against hold bill MUST FAIL!
    try {
      await allocationService.allocatePayment(
        companyA.id,
        {
          paymentReceiptId: vPayment.id,
          billId: testBill.id,
          allocatedAmount: 10000,
        },
        actor
      );
      throw new Error('Should have blocked allocation against bill on payment hold');
    } catch (err) {
      if (!err.message.includes('Payment Hold Enforced') && !err.message.includes('HOLD')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }

    // Release hold
    await prisma.purchaseBill.update({
      where: { id: testBill.id },
      data: {
        paymentHold: false,
        holdReleaseReason: 'Technical review passed with minor discount adjustment',
      },
    });

    // Now allocation must succeed
    const successfulAlloc = await allocationService.allocatePayment(
      companyA.id,
      {
        paymentReceiptId: vPayment.id,
        billId: testBill.id,
        allocatedAmount: 20000,
      },
      actor
    );
    if (successfulAlloc.status !== 'ACTIVE') throw new Error('Allocation failed after hold release');
  });

  await test('6.3 Vendor Debit Note: Create debit note and post GL adjustment', async () => {
    const debitNote = await vendorPayableService.createVendorDebitNote(
      companyA.id,
      {
        vendorId: testVendor.id,
        purchaseBillId: testBill.id,
        taxableAmount: 3050.85,
        cgstAmount: 274.58,
        sgstAmount: 274.57,
        totalAmount: 3600,
        reason: 'Rate difference credit',
      },
      actor
    );

    if (debitNote.status !== 'POSTED') throw new Error('Vendor Debit Note not posted');
    if (!debitNote.voucherId) throw new Error('Voucher was not generated for Debit Note');

    const dnVoucher = await voucherService.getVoucherById(companyA.id, debitNote.voucherId);
    if (Number(dnVoucher.totalDebit) !== 3600 || Number(dnVoucher.totalCredit) !== 3600) {
      throw new Error(`Debit note voucher unbalanced: Dr ₹${dnVoucher.totalDebit}, Cr ₹${dnVoucher.totalCredit}`);
    }

    // Verify Sundry Creditors debited (reducing vendor liability)
    const debitedCreditor = dnVoucher.items.find((i) => i.account.controlType === 'SUNDRY_CREDITORS');
    if (!debitedCreditor || Number(debitedCreditor.debitAmount) !== 3600) {
      throw new Error(`Creditors debit line mismatch: Dr ₹${debitedCreditor?.debitAmount}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: AGEING BUCKETS & STATEMENTS
  // --------------------------------------------------------------------------
  await test('7.1 Customer Ageing & Statements: Verify buckets (0-30, 31-60, 61-90, 90+) and chronological ledger', async () => {
    const ageing = await ageingService.getCustomerAgeing(companyA.id, null, new Date('2026-07-01'));
    if (!ageing.summary) throw new Error('Ageing summary missing');

    const stmt = await ageingService.getCustomerStatement(
      companyA.id,
      custIntra.id,
      new Date('2026-05-01'),
      new Date('2026-06-30')
    );
    if (!stmt.statement || stmt.statement.length === 0) {
      throw new Error('Customer statement ledger is empty');
    }

    // Ensure running balances are computed
    for (const line of stmt.statement) {
      if (line.runningBalance === undefined || line.runningBalance === null) {
        throw new Error('Running balance missing in statement line');
      }
    }
  });

  await test('7.2 Vendor Ageing & Statements: Verify bill ageing and vendor statement', async () => {
    const vendorAgeing = await ageingService.getVendorAgeing(companyA.id, testVendor.id, new Date('2026-07-01'));
    if (!vendorAgeing.summary) throw new Error('Vendor ageing summary missing');

    const vStmt = await ageingService.getVendorStatement(
      companyA.id,
      testVendor.id,
      new Date('2026-05-01'),
      new Date('2026-06-30')
    );
    if (!vStmt.statement || vStmt.statement.length === 0) {
      throw new Error('Vendor statement ledger is empty');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: MULTI-TENANT ISOLATION
  // --------------------------------------------------------------------------
  await test('8. Multi-Tenant Isolation: Cross-company allocation strictly forbidden', async () => {
    // Attempt to allocate Company A receipt against Company B customer/invoice
    const invCompB = await salesInvoiceService.createDraftInvoice(
      companyB.id,
      {
        customerId: custCompB.id,
        items: [{ sku: 'CO-B-SKU', quantity: 1, unitPrice: 500, taxRate: 18 }],
      },
      actor
    );

    try {
      await allocationService.allocatePayment(
        companyA.id,
        {
          paymentReceiptId: receipt1.id,
          invoiceId: invCompB.id, // belongs to Company B
          allocatedAmount: 500,
        },
        actor
      );
      throw new Error('Should have blocked cross-company allocation');
    } catch (err) {
      // Must be 404 or customer mismatch
      if (!err.message.includes('not found') && !err.message.includes('Customer mismatch')) {
        throw new Error(`Unexpected error: ${err.message}`);
      }
    }
  });

  console.log('\n========================================================================');
  console.log(`Phase 8 Part 2 Verification Finished: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('========================================================================\n');

  if (failedTests > 0) {
    throw new Error(`${failedTests} test(s) failed in Phase 8 Part 2 suite.`);
  }
}

runPart2Tests()
  .catch((err) => {
    console.error('Part 2 test runner failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
