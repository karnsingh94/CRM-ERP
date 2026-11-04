import { Router } from 'express';
import coaController from '../controllers/accounting/coa.controller.js';
import periodController from '../controllers/accounting/period.controller.js';
import voucherController from '../controllers/accounting/voucher.controller.js';
import salesInvoiceController from '../controllers/accounting/salesInvoice.controller.js';
import receiptController from '../controllers/accounting/receipt.controller.js';
import allocationController from '../controllers/accounting/allocation.controller.js';
import vendorPayableController from '../controllers/accounting/vendorPayable.controller.js';
import ageingController from '../controllers/accounting/ageing.controller.js';
import bankingController from '../controllers/accounting/banking.controller.js';
import reconciliationController from '../controllers/accounting/reconciliation.controller.js';
import tallyController from '../controllers/accounting/tally.controller.js';
import bankReportController from '../controllers/accounting/bankReport.controller.js';
import { requireCompanyUser, validateCompanyAccess, validateSubModuleAccess } from '../middlewares/auth.middleware.js';

const router = Router();

// Base middleware: all routes require company user and company access
router.use('/companies/:companyId/accounting', requireCompanyUser, validateCompanyAccess);
router.use('/companies/:companyId/accounts', requireCompanyUser, validateCompanyAccess);

const coaAccess = validateSubModuleAccess('chart_of_accounts');
const glAccess = validateSubModuleAccess('general_ledger');
const arAccess = validateSubModuleAccess('accounts_receivable');
const apAccess = validateSubModuleAccess('accounts_payable');
const bankAccess = validateSubModuleAccess('bank_reconciliation');

// ============================================================================
// 1. CHART OF ACCOUNTS (GROUPS & LEDGERS)
// ============================================================================
router.post('/companies/:companyId/accounting/groups', coaAccess, coaController.createGroup);
router.get('/companies/:companyId/accounting/groups', coaAccess, coaController.listGroups);
router.get('/companies/:companyId/accounting/groups/:groupId', coaAccess, coaController.getGroupById);
router.put('/companies/:companyId/accounting/groups/:groupId', coaAccess, coaController.updateGroup);

router.post('/companies/:companyId/accounting/accounts', coaAccess, coaController.createAccount);
router.get('/companies/:companyId/accounting/accounts', coaAccess, coaController.listAccounts);
router.get('/companies/:companyId/accounting/accounts/:accountId', coaAccess, coaController.getAccountById);
router.put('/companies/:companyId/accounting/accounts/:accountId', coaAccess, coaController.updateAccount);
router.patch('/companies/:companyId/accounting/accounts/:accountId/status', coaAccess, coaController.toggleAccountStatus);
router.delete('/companies/:companyId/accounting/accounts/:accountId', coaAccess, coaController.deleteAccount);

// ============================================================================
// 2. FINANCIAL YEAR & ACCOUNTING PERIODS
// ============================================================================
router.post('/companies/:companyId/accounting/financial-years', glAccess, periodController.createFinancialYear);
router.get('/companies/:companyId/accounting/financial-years', glAccess, periodController.listFinancialYears);
router.get('/companies/:companyId/accounting/financial-years/:fyId', glAccess, periodController.getFinancialYearById);
router.post('/companies/:companyId/accounting/financial-years/:fyId/set-current', glAccess, periodController.setCurrentFinancialYear);
router.post('/companies/:companyId/accounting/financial-years/:fyId/lock', glAccess, periodController.lockFinancialYear);
router.post('/companies/:companyId/accounting/financial-years/:fyId/generate-periods', glAccess, periodController.generateStandardPeriods);

router.post('/companies/:companyId/accounting/periods', glAccess, periodController.createPeriod);
router.get('/companies/:companyId/accounting/periods', glAccess, periodController.listPeriods);
router.get('/companies/:companyId/accounting/periods/:periodId', glAccess, periodController.getPeriodById);
router.post('/companies/:companyId/accounting/periods/:periodId/close', glAccess, periodController.closePeriod);
router.post('/companies/:companyId/accounting/periods/:periodId/reopen', glAccess, periodController.reopenPeriod);

// ============================================================================
// 3. DOUBLE-ENTRY JOURNAL VOUCHERS
// ============================================================================
router.post('/companies/:companyId/accounting/vouchers', glAccess, voucherController.createDraftVoucher);
router.get('/companies/:companyId/accounting/vouchers', glAccess, voucherController.listVouchers);
router.get('/companies/:companyId/accounting/vouchers/:voucherId', glAccess, voucherController.getVoucherById);
router.put('/companies/:companyId/accounting/vouchers/:voucherId', glAccess, voucherController.updateDraftVoucher);
router.post('/companies/:companyId/accounting/vouchers/:voucherId/validate', glAccess, voucherController.validateVoucher);
router.post('/companies/:companyId/accounting/vouchers/:voucherId/post', glAccess, voucherController.postVoucher);
router.post('/companies/:companyId/accounting/vouchers/:voucherId/cancel', glAccess, voucherController.cancelDraftVoucher);
router.post('/companies/:companyId/accounting/vouchers/:voucherId/reverse', glAccess, voucherController.reversePostedVoucher);

// ============================================================================
// 4. SALES INVOICING (ACCOUNTS RECEIVABLE)
// ============================================================================
const invoiceRoutes = (base) => {
  router.post(`${base}/invoices`, arAccess, salesInvoiceController.createInvoice);
  router.get(`${base}/invoices`, arAccess, salesInvoiceController.listInvoices);
  router.get(`${base}/invoices/:invoiceId`, arAccess, salesInvoiceController.getInvoiceById);
  router.put(`${base}/invoices/:invoiceId`, arAccess, salesInvoiceController.updateInvoice);
  router.post(`${base}/invoices/:invoiceId/post`, arAccess, salesInvoiceController.postInvoice);
  router.post(`${base}/invoices/:invoiceId/cancel`, arAccess, salesInvoiceController.cancelInvoice);
};
invoiceRoutes('/companies/:companyId/accounting');
invoiceRoutes('/companies/:companyId/accounts');

// ============================================================================
// 5. CUSTOMER RECEIPTS
// ============================================================================
const receiptRoutes = (base) => {
  router.post(`${base}/receipts`, arAccess, receiptController.createReceipt);
  router.get(`${base}/receipts`, arAccess, receiptController.listReceipts);
  router.get(`${base}/receipts/:receiptId`, arAccess, receiptController.getReceiptById);
};
receiptRoutes('/companies/:companyId/accounting');
receiptRoutes('/companies/:companyId/accounts');

// ============================================================================
// 6. PAYMENT ALLOCATIONS (RECEIPTS -> INVOICES / PAYMENTS -> BILLS)
// ============================================================================
const allocationRoutes = (base) => {
  router.post(`${base}/payment-allocations`, arAccess, allocationController.allocatePayment);
  router.get(`${base}/payment-allocations`, arAccess, allocationController.listAllocations);
  router.post(`${base}/payment-allocations/:allocationId/reverse`, arAccess, allocationController.reverseAllocation);
};
allocationRoutes('/companies/:companyId/accounting');
allocationRoutes('/companies/:companyId/accounts');

// ============================================================================
// 7. VENDOR PAYABLES (ACCOUNTS PAYABLE)
// ============================================================================
const vendorPayableRoutes = (base) => {
  router.get(`${base}/vendor-payables/bills`, apAccess, vendorPayableController.listVendorBills);
  router.get(`${base}/vendor-payables/bills/:billId`, apAccess, vendorPayableController.getVendorBillDetails);
  router.post(`${base}/vendor-payables/bills/:billId/post`, apAccess, vendorPayableController.postPurchaseBill);
  router.post(`${base}/vendor-payables/payments`, apAccess, vendorPayableController.recordVendorPayment);
  router.post(`${base}/vendor-payables/debit-notes`, apAccess, vendorPayableController.createVendorDebitNote);
};
vendorPayableRoutes('/companies/:companyId/accounting');
vendorPayableRoutes('/companies/:companyId/accounts');

// ============================================================================
// 8. AGEING & STATEMENTS
// ============================================================================
const ageingRoutes = (base) => {
  router.get(`${base}/ageing/customers`, arAccess, ageingController.getCustomerAgeing);
  router.get(`${base}/ageing/vendors`, apAccess, ageingController.getVendorAgeing);
  router.get(`${base}/statements/customers/:customerId`, arAccess, ageingController.getCustomerStatement);
  router.get(`${base}/statements/vendors/:vendorId`, apAccess, ageingController.getVendorStatement);
};
ageingRoutes('/companies/:companyId/accounting');
ageingRoutes('/companies/:companyId/accounts');

// ============================================================================
// 9. BANK ACCOUNT MANAGEMENT & STATEMENT IMPORT
// ============================================================================
const bankingRoutes = (base) => {
  router.post(`${base}/bank-accounts`, bankAccess, bankingController.createBankAccount);
  router.get(`${base}/bank-accounts`, bankAccess, bankingController.listBankAccounts);
  router.get(`${base}/bank-accounts/:bankAccountId`, bankAccess, bankingController.getBankAccountById);
  router.put(`${base}/bank-accounts/:bankAccountId`, bankAccess, bankingController.updateBankAccount);
  router.patch(`${base}/bank-accounts/:bankAccountId/status`, bankAccess, bankingController.toggleAccountStatus);
  router.delete(`${base}/bank-accounts/:bankAccountId`, bankAccess, bankingController.deleteBankAccount);
  router.get(`${base}/bank-accounts/:bankAccountId/ledger-balance`, bankAccess, bankingController.getLedgerBalance);
  router.get(`${base}/bank-accounts/:bankAccountId/statement-balance`, bankAccess, bankingController.getStatementBalance);
  router.get(`${base}/bank-accounts/:bankAccountId/unreconciled-summary`, bankAccess, bankingController.getUnreconciledTransactionSummary);

  // Statement Import
  router.post(`${base}/bank-accounts/:bankAccountId/statements/preview`, bankAccess, bankingController.previewStatement);
  router.post(`${base}/bank-accounts/:bankAccountId/statements/import`, bankAccess, bankingController.importStatement);
  router.get(`${base}/bank-accounts/:bankAccountId/transactions`, bankAccess, bankingController.listTransactions);
};
bankingRoutes('/companies/:companyId/accounting');
bankingRoutes('/companies/:companyId/accounts');

// ============================================================================
// 10. BANK RECONCILIATION ENGINE & DIFFERENCE ENTRIES
// ============================================================================
const reconciliationRoutes = (base) => {
  router.post(`${base}/reconciliations`, bankAccess, reconciliationController.createSession);
  router.get(`${base}/reconciliations`, bankAccess, reconciliationController.listSessions);
  router.get(`${base}/reconciliations/:reconciliationId`, bankAccess, reconciliationController.getSessionById);
  router.post(`${base}/reconciliations/:reconciliationId/match`, bankAccess, reconciliationController.manualMatch);
  router.post(`${base}/reconciliations/:reconciliationId/auto-match`, bankAccess, reconciliationController.autoMatch);
  router.post(`${base}/reconciliations/:reconciliationId/items/:itemId/unmatch`, bankAccess, reconciliationController.unmatchItem);
  router.post(`${base}/reconciliations/:reconciliationId/adjustments`, bankAccess, reconciliationController.postBankAdjustmentVoucher);
  router.post(`${base}/reconciliations/:reconciliationId/close`, bankAccess, reconciliationController.closeSession);
};
reconciliationRoutes('/companies/:companyId/accounting');
reconciliationRoutes('/companies/:companyId/accounts');

// ============================================================================
// 11. TALLY PRIME INTEGRATION
// ============================================================================
const tallyRoutes = (base) => {
  // Ledger Mappings
  router.post(`${base}/tally/ledger-mappings`, glAccess, tallyController.createLedgerMapping);
  router.get(`${base}/tally/ledger-mappings`, glAccess, tallyController.listLedgerMappings);
  router.put(`${base}/tally/ledger-mappings/:mappingId`, glAccess, tallyController.updateLedgerMapping);
  router.get(`${base}/tally/ledger-mappings/preview`, glAccess, tallyController.previewLedgerMappings);

  // Voucher Export
  router.post(`${base}/tally/vouchers/preview`, glAccess, tallyController.previewVoucherExport);
  router.post(`${base}/tally/vouchers/export`, glAccess, tallyController.exportVouchers);
  router.get(`${base}/tally/export-batches`, glAccess, tallyController.getExportBatches);
  router.get(`${base}/tally/failed-exports`, glAccess, tallyController.getFailedExports);
};
tallyRoutes('/companies/:companyId/accounting');
tallyRoutes('/companies/:companyId/accounts');

// ============================================================================
// 12. BANKING & RECONCILIATION REPORTS
// ============================================================================
const bankReportRoutes = (base) => {
  router.get(`${base}/reports/bank-book/:bankAccountId`, bankAccess, bankReportController.getBankBook);
  router.get(`${base}/reports/brs/:bankAccountId`, bankAccess, bankReportController.getBankReconciliationStatement);
  router.get(`${base}/reports/unreconciled/:bankAccountId`, bankAccess, bankReportController.getUnreconciledTransactions);
  router.get(`${base}/reports/bank-charges/:bankAccountId`, bankAccess, bankReportController.getBankChargesAndInterestSummary);
};
bankReportRoutes('/companies/:companyId/accounting');
bankReportRoutes('/companies/:companyId/accounts');

export default router;
