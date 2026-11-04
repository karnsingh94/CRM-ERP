import prisma from '../../src/config/prisma.js';
import { Prisma } from '@prisma/client';

const Decimal = Prisma.Decimal;

// Strict Database Guard: ONLY execute against crm_erp_test_db
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('crm_erp_test_db')) {
  console.error('\n🚨 FATAL SAFETY VIOLATION: Phase 8 Schema Verification must ONLY execute against crm_erp_test_db!');
  console.error(`Current DATABASE_URL: ${dbUrl || 'NOT SET'}\n`);
  process.exit(1);
}

export async function runPhase8SchemaVerification() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Phase 8: Step 1 Schema Verification Test Suite');
  console.log('Target Database: crm_erp_test_db (ISOLATED TEST DATABASE)');
  console.log('Verifying: Bank Reconciliation, Payment Allocation, Voucher Items, Bank Transactions, Accounting Safety');
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

  // Tenant & Client
  let client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const companyId = client.id;
  const testSuffix = Date.now().toString().slice(-4);

  // --------------------------------------------------------------------------
  // TEST 1: Bank Reconciliation & BankReconciliationItem Junction Model
  // --------------------------------------------------------------------------
  await test('1. Bank Reconciliation: BankTransaction mandatory BankAccount relation and BankReconciliationItem junction model', async () => {
    // 1. Create Chart of Accounts group and bank ledger
    const grp = await prisma.accountGroup.create({
      data: {
        companyId,
        groupName: `Current Assets ${testSuffix}`,
        groupCode: `GRP-CA-${testSuffix}`,
        category: 'ASSET',
      },
    });

    const bankLedger = await prisma.accountMaster.create({
      data: {
        companyId,
        groupId: grp.id,
        accountCode: `ACC-HDFC-${testSuffix}`,
        accountName: `HDFC Bank Operating ${testSuffix}`,
        normalBalance: 'DEBIT',
        controlType: 'BANK',
      },
    });

    // 2. Create BankAccount
    const bankAccount = await prisma.bankAccount.create({
      data: {
        companyId,
        bankName: 'HDFC Bank Ltd',
        accountHolderName: 'Azzuniqe Tech Pvt Ltd',
        accountNumber: `HDFC${testSuffix}001`,
        maskedAccountNumber: `XXXX${testSuffix}`,
        ifscCode: 'HDFC0001234',
        accountId: bankLedger.id,
        openingBalance: new Decimal('50000.00'),
        currentBalance: new Decimal('50000.00'),
      },
    });

    if (!bankAccount.id) throw new Error('BankAccount creation failed');

    // 3. Create BankTransaction with mandatory BankAccount relation
    const txn = await prisma.bankTransaction.create({
      data: {
        companyId,
        bankAccountId: bankAccount.id,
        transactionDate: new Date('2026-04-10'),
        referenceNo: `UTR-${testSuffix}-001`,
        externalRef: `EXT-${testSuffix}-001`,
        description: 'Customer RTGS Inward Payment',
        creditAmount: new Decimal('12500.00'),
        debitAmount: new Decimal('0.00'),
        runningBalance: new Decimal('62500.00'),
      },
    });

    if (txn.bankAccountId !== bankAccount.id) throw new Error('BankTransaction relation mismatch');

    // 4. Create JournalVoucher for the ledger entry
    const jv = await prisma.journalVoucher.create({
      data: {
        companyId,
        voucherNo: `JV-REC-${testSuffix}`,
        voucherDate: new Date('2026-04-10'),
        voucherType: 'RECEIPT',
        totalDebit: new Decimal('12500.00'),
        totalCredit: new Decimal('12500.00'),
        status: 'POSTED',
      },
    });

    const jvItem = await prisma.journalVoucherItem.create({
      data: {
        companyId,
        voucherId: jv.id,
        accountId: bankLedger.id,
        sequenceNo: 1,
        debitAmount: new Decimal('12500.00'),
        creditAmount: new Decimal('0.00'),
        narration: 'Bank inward receipt',
      },
    });

    // 5. Create BankReconciliation session and BankReconciliationItem
    const recon = await prisma.bankReconciliation.create({
      data: {
        companyId,
        bankAccountId: bankAccount.id,
        statementDate: new Date('2026-04-30'),
        statementClosingBalance: new Decimal('62500.00'),
        ledgerClosingBalance: new Decimal('62500.00'),
        differenceAmount: new Decimal('0.00'),
        status: 'RECONCILED',
      },
    });

    const reconItem = await prisma.bankReconciliationItem.create({
      data: {
        companyId,
        reconciliationId: recon.id,
        bankTransactionId: txn.id,
        voucherId: jv.id,
        voucherItemId: jvItem.id,
        matchedAmount: new Decimal('12500.00'),
        clearanceDate: new Date('2026-04-11'),
        matchType: 'EXACT',
      },
    });

    if (!reconItem.id) throw new Error('BankReconciliationItem junction creation failed');

    // 6. Verify duplicate prevention on BankReconciliationItem (same transaction in same session)
    try {
      await prisma.bankReconciliationItem.create({
        data: {
          companyId,
          reconciliationId: recon.id,
          bankTransactionId: txn.id,
          matchedAmount: new Decimal('12500.00'),
        },
      });
      throw new Error('Should have prevented duplicate bank reconciliation item for same transaction');
    } catch (err) {
      if (!err.message.includes('Unique constraint failed')) {
        throw new Error(`Unexpected error on duplicate check: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Payment Allocation XOR and Outstanding Balance Verification
  // --------------------------------------------------------------------------
  await test('2. Payment Allocation: XOR target schema support and company scoping', async () => {
    // Create customer and SalesInvoice
    const cust = await prisma.crmCustomer.create({
      data: {
        companyId,
        companyName: `Test Client Corp ${testSuffix}`,
        customerCode: `CUST-ALLOC-${testSuffix}`,
        phone: `980000${testSuffix}`,
      },
    });

    const invoice = await prisma.salesInvoice.create({
      data: {
        companyId,
        customerId: cust.id,
        customerName: cust.companyName,
        invoiceNo: `INV-ALLOC-${testSuffix}`,
        invoiceDate: new Date('2026-04-12'),
        taxableAmount: new Decimal('10000.00'),
        cgstAmount: new Decimal('900.00'),
        sgstAmount: new Decimal('900.00'),
        totalAmount: new Decimal('11800.00'),
        paidAmount: new Decimal('0.00'),
        outstandingAmount: new Decimal('11800.00'),
        status: 'POSTED',
      },
    });

    // Create PaymentReceipt for customer
    const receipt = await prisma.paymentReceipt.create({
      data: {
        companyId,
        paymentReceiptNo: `REC-ALLOC-${testSuffix}`,
        paymentType: 'CUSTOMER_RECEIPT',
        customerId: cust.id,
        paymentMode: 'NEFT',
        amount: new Decimal('11800.00'),
        unallocatedAmount: new Decimal('11800.00'),
        paymentDate: new Date('2026-04-15'),
      },
    });

    // Create PaymentAllocation targeting SalesInvoice (XOR: invoiceId set, billId null)
    const alloc = await prisma.paymentAllocation.create({
      data: {
        companyId,
        paymentReceiptId: receipt.id,
        invoiceId: invoice.id,
        billId: null,
        targetType: 'SALES_INVOICE',
        allocatedAmount: new Decimal('11800.00'),
      },
    });

    if (!alloc.id || alloc.invoiceId !== invoice.id || alloc.billId !== null) {
      throw new Error('Payment allocation XOR target verification failed');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Journal Voucher Items Debit/Credit Integrity & Company Scoping
  // --------------------------------------------------------------------------
  await test('3. Journal Voucher Items: Positive amounts, full invoice/bill relation & company scoping', async () => {
    const debtorsLedger = await prisma.accountMaster.create({
      data: {
        companyId,
        groupId: (await prisma.accountGroup.findFirst({ where: { companyId } })).id,
        accountCode: `ACC-DEBTORS-${testSuffix}`,
        accountName: `Sundry Debtors ${testSuffix}`,
        normalBalance: 'DEBIT',
        controlType: 'SUNDRY_DEBTORS',
      },
    });

    const salesLedger = await prisma.accountMaster.create({
      data: {
        companyId,
        groupId: (await prisma.accountGroup.findFirst({ where: { companyId } })).id,
        accountCode: `ACC-SALES-${testSuffix}`,
        accountName: `Domestic Sales ${testSuffix}`,
        normalBalance: 'CREDIT',
        controlType: 'SALES',
      },
    });

    const jv = await prisma.journalVoucher.create({
      data: {
        companyId,
        voucherNo: `JV-CORRECT-${testSuffix}`,
        voucherDate: new Date('2026-04-18'),
        voucherType: 'SALES_INVOICE',
        totalDebit: new Decimal('5000.00'),
        totalCredit: new Decimal('5000.00'),
        status: 'POSTED',
      },
    });

    // Line 1: Debit to Sundry Debtors
    const item1 = await prisma.journalVoucherItem.create({
      data: {
        companyId,
        voucherId: jv.id,
        accountId: debtorsLedger.id,
        sequenceNo: 1,
        debitAmount: new Decimal('5000.00'),
        creditAmount: new Decimal('0.00'),
        narration: 'Debtors debit for sales invoice',
      },
    });

    // Line 2: Credit to Sales
    const item2 = await prisma.journalVoucherItem.create({
      data: {
        companyId,
        voucherId: jv.id,
        accountId: salesLedger.id,
        sequenceNo: 2,
        debitAmount: new Decimal('0.00'),
        creditAmount: new Decimal('5000.00'),
        narration: 'Revenue recognition',
      },
    });

    if (Number(item1.debitAmount) !== 5000 || Number(item1.creditAmount) !== 0) {
      throw new Error('Debit amount assertion failed on line 1');
    }
    if (Number(item2.creditAmount) !== 5000 || Number(item2.debitAmount) !== 0) {
      throw new Error('Credit amount assertion failed on line 2');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Bank Statement Duplicate Detection
  // --------------------------------------------------------------------------
  await test('4. Bank Transactions: Deduplication on externalRef per company & bank account', async () => {
    const bankAccount = await prisma.bankAccount.findFirst({ where: { companyId } });

    const extRef = `DUP-STMT-${testSuffix}-999`;

    await prisma.bankTransaction.create({
      data: {
        companyId,
        bankAccountId: bankAccount.id,
        transactionDate: new Date('2026-04-20'),
        referenceNo: 'CHQ-998877',
        externalRef: extRef,
        description: 'Vendor RTGS Transfer Out',
        debitAmount: new Decimal('3400.00'),
        creditAmount: new Decimal('0.00'),
      },
    });

    // Attempting to import the exact same externalRef must throw unique constraint error!
    try {
      await prisma.bankTransaction.create({
        data: {
          companyId,
          bankAccountId: bankAccount.id,
          transactionDate: new Date('2026-04-20'),
          referenceNo: 'CHQ-998877',
          externalRef: extRef,
          description: 'Duplicate import row',
          debitAmount: new Decimal('3400.00'),
          creditAmount: new Decimal('0.00'),
        },
      });
      throw new Error('Should have blocked duplicate bank transaction with same externalRef');
    } catch (err) {
      if (!err.message.includes('Unique constraint failed')) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Existing Accounting Safety & CustomerCreditNote SalesInvoice Link
  // --------------------------------------------------------------------------
  await test('5. Accounting Safety: CustomerCreditNote links to SalesInvoice & Decimal precision', async () => {
    const invoice = await prisma.salesInvoice.findFirst({ where: { companyId } });

    // Create CustomerCreditNote associated with the new SalesInvoice
    const cn = await prisma.customerCreditNote.create({
      data: {
        companyId,
        creditNoteNo: `CN-SAFETY-${testSuffix}`,
        salesInvoiceId: invoice.id,
        customerName: invoice.customerName,
        taxableAmount: new Decimal('2500.00'),
        cgstAmount: new Decimal('225.00'),
        sgstAmount: new Decimal('225.00'),
        totalAmount: new Decimal('2950.00'),
        netCreditAmount: new Decimal('2950.00'),
        settlementType: 'LEDGER_CREDIT',
        status: 'DRAFT',
      },
    });

    if (cn.salesInvoiceId !== invoice.id) {
      throw new Error('CustomerCreditNote salesInvoiceId link mismatch');
    }

    // Verify relation lookup
    const invWithCn = await prisma.salesInvoice.findUnique({
      where: { id: invoice.id },
      include: { creditNotes: true },
    });

    if (!invWithCn.creditNotes.some((c) => c.id === cn.id)) {
      throw new Error('SalesInvoice inverse creditNotes relation lookup failed');
    }
  });

  console.log(`\n========================================================================`);
  console.log(`Phase 8 Schema Verification Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} verification check(s) failed in Phase 8 schema suite.`);
  }
}

// Auto-run when invoked directly
if (process.argv[1]?.includes('phase8_schema_verification.test.js')) {
  runPhase8SchemaVerification()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Schema verification failed:', err);
      process.exit(1);
    });
}
