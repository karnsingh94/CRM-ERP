'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import styles from './AccountsModule.module.css';

// 12 Section Tabs
import AccountsDashboardTab from './accounts/AccountsDashboardTab';
import ChartOfAccountsTab from './accounts/ChartOfAccountsTab';
import FinancialPeriodsTab from './accounts/FinancialPeriodsTab';
import SalesInvoicesTab from './accounts/SalesInvoicesTab';
import CustomerReceiptsTab from './accounts/CustomerReceiptsTab';
import CustomerAgeingTab from './accounts/CustomerAgeingTab';
import VendorPayablesTab from './accounts/VendorPayablesTab';
import GeneralLedgerTab from './accounts/GeneralLedgerTab';
import BankAccountsTab from './accounts/BankAccountsTab';
import BankStatementImportTab from './accounts/BankStatementImportTab';
import BankReconciliationTab from './accounts/BankReconciliationTab';
import TallyIntegrationTab from './accounts/TallyIntegrationTab';

const TABS = [
  { id: 'dashboard', label: '1. Financial Dashboard', icon: '📊' },
  { id: 'coa', label: '2. Chart of Accounts', icon: '📂' },
  { id: 'periods', label: '3. Financial Years & Periods', icon: '📅' },
  { id: 'invoices', label: '4. Sales Invoices', icon: '📄', badgeKey: 'unpaidInvoices' },
  { id: 'receipts', label: '5. Customer Receipts', icon: '💰' },
  { id: 'ageing', label: '6. Customer Ageing', icon: '⏳' },
  { id: 'payables', label: '7. Vendor Payables', icon: '💳', badgeKey: 'unpaidBills' },
  { id: 'gl', label: '8. General Ledger & JVs', icon: '📖' },
  { id: 'banking', label: '9. Bank Accounts & Book', icon: '🏦' },
  { id: 'statementImport', label: '10. Statement Import', icon: '📥' },
  { id: 'reconciliation', label: '11. Bank Reconciliation', icon: '⚖️' },
  { id: 'tally', label: '12. Tally Prime XML', icon: '🔄' },
];

export default function AccountsModule({ activeCompany, showToast, initialSubTab }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (initialSubTab === 'invoices') return 'invoices';
    if (initialSubTab === 'bills' || initialSubTab === 'payables') return 'payables';
    if (initialSubTab === 'ledger' || initialSubTab === 'gl') return 'gl';
    if (initialSubTab === 'payments' || initialSubTab === 'receipts') return 'receipts';
    return 'dashboard';
  });

  const [loading, setLoading] = useState(false);

  // Core Data States
  const [accounts, setAccounts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [financialYears, setFinancialYears] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [bills, setBills] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [tallyMappings, setTallyMappings] = useState([]);
  const [tallyBatches, setTallyBatches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [ageingData, setAgeingData] = useState([]);

  const companyId = activeCompany?.id || activeCompany?._id;

  const toast = useCallback(
    (msg, type = 'success') => {
      if (typeof showToast === 'function') {
        showToast(msg, type);
      } else {
        console.log(`[Toast ${type}]: ${msg}`);
      }
    },
    [showToast]
  );

  const loadAllData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);

      const [
        accountsRes,
        groupsRes,
        fyRes,
        invoicesRes,
        receiptsRes,
        billsRes,
        vouchersRes,
        bankAccountsRes,
        reconciliationsRes,
        tallyMappingsRes,
        tallyBatchesRes,
        ageingRes,
      ] = await Promise.allSettled([
        api.get(`/companies/${companyId}/accounting/accounts`),
        api.get(`/companies/${companyId}/accounting/groups`),
        api.get(`/companies/${companyId}/accounting/financial-years`),
        api.get(`/companies/${companyId}/accounting/invoices`),
        api.get(`/companies/${companyId}/accounting/receipts`),
        api.get(`/companies/${companyId}/accounting/vendor-payables/bills`),
        api.get(`/companies/${companyId}/accounting/vouchers`),
        api.get(`/companies/${companyId}/accounting/bank-accounts`),
        api.get(`/companies/${companyId}/accounting/reconciliations`),
        api.get(`/companies/${companyId}/accounting/tally/ledger-mappings`),
        api.get(`/companies/${companyId}/accounting/tally/export-batches`),
        api.get(`/companies/${companyId}/accounting/ageing/customers`),
      ]);

      if (accountsRes.status === 'fulfilled') setAccounts(accountsRes.value?.items || accountsRes.value?.data || []);
      if (groupsRes.status === 'fulfilled') setGroups(groupsRes.value?.items || groupsRes.value?.data || []);
      if (fyRes.status === 'fulfilled') setFinancialYears(fyRes.value?.items || fyRes.value?.data || []);
      if (invoicesRes.status === 'fulfilled') setInvoices(invoicesRes.value?.items || invoicesRes.value?.data || []);
      if (receiptsRes.status === 'fulfilled') setReceipts(receiptsRes.value?.items || receiptsRes.value?.data || []);
      if (billsRes.status === 'fulfilled') setBills(billsRes.value?.items || billsRes.value?.data || []);
      if (vouchersRes.status === 'fulfilled') setVouchers(vouchersRes.value?.items || vouchersRes.value?.data || []);
      if (bankAccountsRes.status === 'fulfilled') setBankAccounts(bankAccountsRes.value?.items || bankAccountsRes.value?.data || []);
      if (reconciliationsRes.status === 'fulfilled') setReconciliations(reconciliationsRes.value?.items || reconciliationsRes.value?.data || []);
      if (tallyMappingsRes.status === 'fulfilled') setTallyMappings(tallyMappingsRes.value?.items || tallyMappingsRes.value?.data || []);
      if (tallyBatchesRes.status === 'fulfilled') setTallyBatches(tallyBatchesRes.value?.items || tallyBatchesRes.value?.data || []);
      if (ageingRes.status === 'fulfilled') setAgeingData(ageingRes.value?.data || ageingRes.value?.items || []);

      // Also attempt to load customers & vendors for dropdowns
      try {
        const [custRes, vendRes] = await Promise.allSettled([
          api.get(`/companies/${companyId}/customers`),
          api.get(`/companies/${companyId}/vendors`),
        ]);
        if (custRes.status === 'fulfilled') setCustomers(custRes.value?.items || custRes.value?.data || []);
        if (vendRes.status === 'fulfilled') setVendors(vendRes.value?.items || vendRes.value?.data || []);
      } catch (e) {}
    } catch (err) {
      toast(err.message || 'Failed to fetch accounts data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Badges
  const badges = useMemo(() => {
    const unpaidInvoices = invoices.filter((i) => i.status === 'POSTED' || i.status === 'PARTIALLY_PAID').length;
    const unpaidBills = bills.filter((b) => b.status === 'POSTED' || b.status === 'PARTIALLY_PAID').length;
    return {
      unpaidInvoices: unpaidInvoices > 0 ? unpaidInvoices : null,
      unpaidBills: unpaidBills > 0 ? unpaidBills : null,
    };
  }, [invoices, bills]);

  return (
    <div className={styles.module}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Commercial ERP &bull; Accounts &amp; Banking</span>
          <h2>Accounts, Commercial Billing &amp; Banking</h2>
          <p>
            Double-entry General Ledger, GST Tax Invoices, Receivables, Payables, Bank Reconciliation (BRS), and Tally Prime XML for{' '}
            <b>{activeCompany?.organizationName || 'Current Organization'}</b>
          </p>
        </div>
        <button type="button" onClick={loadAllData} disabled={loading}>
          {loading ? 'Refreshing...' : '🔄 Refresh Data'}
        </button>
      </div>

      {/* Accounting Workflow Flow Indicator */}
      <div className={styles.flow}>
        <span>1. Chart of Accounts</span> <b>&rarr;</b>
        <span>2. Periods &amp; FY</span> <b>&rarr;</b>
        <span>3. Sales Invoicing</span> <b>&rarr;</b>
        <span>4. Customer Receipts</span> <b>&rarr;</b>
        <span>5. Vendor Payables</span> <b>&rarr;</b>
        <span>6. General Ledger</span> <b>&rarr;</b>
        <span>7. Bank Reconciliation (BRS)</span> <b>&rarr;</b>
        <span>8. Tally XML Export</span>
      </div>

      {/* 12 Tabs Navigation Bar */}
      <div className={styles.tabs}>
        {TABS.map((tab) => {
          const badgeCount = tab.badgeKey ? badges[tab.badgeKey] : null;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? styles.active : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ marginRight: '4px' }}>{tab.icon}</span>
              {tab.label}
              {badgeCount !== null && badgeCount !== undefined && (
                <span className={styles.tabBadge}>{badgeCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'dashboard' && (
        <AccountsDashboardTab
          invoices={invoices}
          recentVouchers={vouchers}
          bankAccounts={bankAccounts}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'coa' && (
        <ChartOfAccountsTab
          accounts={accounts}
          groups={groups}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'periods' && (
        <FinancialPeriodsTab
          financialYears={financialYears}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'invoices' && (
        <SalesInvoicesTab
          invoices={invoices}
          customers={customers}
          companyId={companyId}
          activeCompany={activeCompany}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'receipts' && (
        <CustomerReceiptsTab
          receipts={receipts}
          invoices={invoices}
          customers={customers}
          bankAccounts={bankAccounts}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'ageing' && (
        <CustomerAgeingTab
          ageingData={ageingData}
          companyId={companyId}
          showToast={toast}
        />
      )}

      {activeTab === 'payables' && (
        <VendorPayablesTab
          bills={bills}
          vendors={vendors}
          bankAccounts={bankAccounts}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'gl' && (
        <GeneralLedgerTab
          vouchers={vouchers}
          accounts={accounts}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'banking' && (
        <BankAccountsTab
          bankAccounts={bankAccounts}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'statementImport' && (
        <BankStatementImportTab
          bankAccounts={bankAccounts}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'reconciliation' && (
        <BankReconciliationTab
          sessions={reconciliations}
          bankAccounts={bankAccounts}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}

      {activeTab === 'tally' && (
        <TallyIntegrationTab
          mappings={tallyMappings}
          accounts={accounts}
          exportBatches={tallyBatches}
          companyId={companyId}
          onRefresh={loadAllData}
          showToast={toast}
        />
      )}
    </div>
  );
}
