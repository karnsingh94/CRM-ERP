'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './reports.module.css';
import { api } from '../../../lib/api';
import ReportFilterBar from './ReportFilterBar';
import ReportDataTable from './ReportDataTable';
import ReportExportActions from './ReportExportActions';

const FINANCIAL_SUBTABS = [
  { id: 'trial-balance', label: '1. Trial Balance', exportType: 'trial-balance' },
  { id: 'profit-loss', label: '2. Profit & Loss', exportType: 'profit-loss' },
  { id: 'balance-sheet', label: '3. Balance Sheet', exportType: 'balance-sheet' },
  { id: 'cash-book', label: '4. Cash Book', exportType: 'cash-book' },
  { id: 'general-ledger', label: '5. General Ledger', exportType: 'general-ledger' },
  { id: 'reversal-audit', label: '6. Reversal Audit', exportType: null, isUnavailable: true },
];

export default function FinancialStatementsTab({
  activeCompany,
  showToast,
  currentUser,
}) {
  const companyId = activeCompany?.id;
  const [subTab, setSubTab] = useState('trial-balance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const [reportData, setReportData] = useState(null);

  // Accounts list for General Ledger selector
  const [accountsList, setAccountsList] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Fetch accounts list once for General Ledger dropdown
  useEffect(() => {
    if (!companyId) return;
    api.get(`/companies/${companyId}/reports/financial/trial-balance`)
      .then((res) => {
        if (res?.success && Array.isArray(res.data?.accounts)) {
          setAccountsList(res.data.accounts);
          if (res.data.accounts.length > 0 && !selectedAccountId) {
            setSelectedAccountId(res.data.accounts[0].id);
          }
        }
      })
      .catch(() => {});
  }, [companyId]);

  const fetchStatement = useCallback(async (currentFilters = filters, targetSubTab = subTab, targetAccId = selectedAccountId) => {
    if (!companyId) return;
    if (targetSubTab === 'reversal-audit') {
      setReportData(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();
      if (currentFilters.fromDate) queryParams.set('fromDate', currentFilters.fromDate);
      if (currentFilters.toDate) queryParams.set('toDate', currentFilters.toDate);

      let endpoint = '';
      if (targetSubTab === 'trial-balance') {
        endpoint = `/companies/${companyId}/reports/financial/trial-balance`;
      } else if (targetSubTab === 'profit-loss') {
        endpoint = `/companies/${companyId}/reports/financial/profit-and-loss`;
      } else if (targetSubTab === 'balance-sheet') {
        endpoint = `/companies/${companyId}/reports/financial/balance-sheet`;
      } else if (targetSubTab === 'cash-book') {
        endpoint = `/companies/${companyId}/reports/financial/cash-book`;
      } else if (targetSubTab === 'general-ledger') {
        if (!targetAccId) {
          setReportData(null);
          setLoading(false);
          return;
        }
        queryParams.set('accountId', targetAccId);
        endpoint = `/companies/${companyId}/reports/financial/general-ledger`;
      }

      const qs = queryParams.toString();
      const res = await api.get(`${endpoint}${qs ? `?${qs}` : ''}`);
      if (res?.success) {
        setReportData(res.data);
      } else {
        throw new Error(res?.message || 'Failed to fetch financial statement');
      }
    } catch (err) {
      console.error('Financial Statement Error:', err);
      setError(err.message || 'Could not load financial statement.');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters, subTab, selectedAccountId]);

  useEffect(() => {
    fetchStatement(filters, subTab, selectedAccountId);
  }, [subTab, selectedAccountId]);

  const activeTabConfig = FINANCIAL_SUBTABS.find((t) => t.id === subTab);

  // Render Table depending on subTab
  const renderContent = () => {
    if (subTab === 'reversal-audit') {
      return (
        <div className={styles.tableCard} style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '2.5rem' }}>🔒</span>
          <h3 style={{ margin: '0.75rem 0 0.25rem', color: '#18181b', fontWeight: 800 }}>
            Reversal Audit Trail Endpoint Not Mounted
          </h3>
          <p style={{ color: '#71717a', fontSize: '0.88rem', maxWidth: '480px', margin: '0 auto' }}>
            In accordance with Phase 11 Step 2 backend contracts, no standalone <code>/financial/reversal-audit</code> endpoint is implemented.
            All voucher reversal transactions are immutably logged in the General Ledger.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <span className={`${styles.badge} ${styles.badgeWarning}`}>NOT IMPLEMENTED</span>
          </div>
        </div>
      );
    }

    if (subTab === 'trial-balance') {
      const accounts = reportData?.accounts || [];
      const columns = [
        { key: 'accountCode', label: 'Code', width: '110px' },
        { key: 'accountName', label: 'Account Name' },
        { key: 'groupName', label: 'Group' },
        { key: 'category', label: 'Category', render: (val) => <span className={`${styles.badge} ${styles.badgeNeutral}`}>{val}</span> },
        { key: 'openingDebit', label: 'Opening Dr', format: 'currency', isNumeric: true },
        { key: 'openingCredit', label: 'Opening Cr', format: 'currency', isNumeric: true },
        { key: 'periodDebit', label: 'Period Dr', format: 'currency', isNumeric: true },
        { key: 'periodCredit', label: 'Period Cr', format: 'currency', isNumeric: true },
        { key: 'closingDebit', label: 'Closing Dr', format: 'currency', isNumeric: true },
        { key: 'closingCredit', label: 'Closing Cr', format: 'currency', isNumeric: true },
      ];

      const totals = reportData ? {
        accountName: 'Total Reconciliation',
        closingDebit: reportData.totalDebit,
        closingCredit: reportData.totalCredit,
      } : null;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reportData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#ffffff', padding: '0.85rem 1.25rem', borderRadius: '8px', border: '1px solid #e4e4e7' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#52525b' }}>Reconciliation Status:</span>
              <span className={`${styles.badge} ${reportData.isReconciled ? styles.badgeSuccess : styles.badgeDanger}`}>
                {reportData.isReconciled ? '✅ BALANCED (Total Dr = Total Cr)' : '❌ UNBALANCED'}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#71717a', marginLeft: 'auto' }}>
                Total Accounts: <strong>{accounts.length}</strong>
              </span>
            </div>
          )}

          <ReportDataTable
            title="Trial Balance Statement"
            subtitle="Double-entry ledger balances across Asset, Liability, Equity, Income, and Expense"
            columns={columns}
            data={accounts}
            totals={totals}
            isLoading={loading}
            error={error}
            onRetry={() => fetchStatement(filters, subTab, selectedAccountId)}
          />
        </div>
      );
    }

    if (subTab === 'profit-loss') {
      const incomeGroups = reportData?.incomeGroups || [];
      const expenseGroups = reportData?.expenseGroups || [];

      // Flatten groups into table rows with group headers
      const rows = [];
      for (const grp of incomeGroups) {
        for (const acc of grp.accounts || []) {
          rows.push({ type: 'INCOME', group: grp.groupName, ...acc });
        }
      }
      for (const grp of expenseGroups) {
        for (const acc of grp.accounts || []) {
          rows.push({ type: 'EXPENSE', group: grp.groupName, ...acc });
        }
      }

      const columns = [
        { key: 'type', label: 'Classification', width: '130px', render: (v) => (
          <span className={`${styles.badge} ${v === 'INCOME' ? styles.badgeSuccess : styles.badgeWarning}`}>{v}</span>
        )},
        { key: 'group', label: 'Account Group' },
        { key: 'accountCode', label: 'Code', width: '120px' },
        { key: 'accountName', label: 'Ledger Name' },
        { key: 'amount', label: 'Net Amount', format: 'currency', isNumeric: true },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reportData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Income / Revenue</div>
                <div className={styles.kpiValue} style={{ color: '#15803d' }}>
                  ₹ {(reportData.totalIncome || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Expenses</div>
                <div className={styles.kpiValue} style={{ color: '#b91c1c' }}>
                  ₹ {(reportData.totalExpense || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Net Profit / (Loss)</div>
                <div className={styles.kpiValue} style={{ color: (reportData.netProfit || 0) >= 0 ? '#15803d' : '#b91c1c' }}>
                  ₹ {(reportData.netProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          )}

          <ReportDataTable
            title="Statement of Profit & Loss"
            subtitle="Revenues and operating expenditures for the selected financial period"
            columns={columns}
            data={rows}
            isLoading={loading}
            error={error}
            onRetry={() => fetchStatement(filters, subTab, selectedAccountId)}
          />
        </div>
      );
    }

    if (subTab === 'balance-sheet') {
      const assets = reportData?.assets || [];
      const liabilities = reportData?.liabilities || [];
      const equity = reportData?.equity || [];

      const rows = [];
      for (const grp of assets) {
        for (const acc of grp.accounts || []) {
          rows.push({ category: 'ASSET', group: grp.groupName, ...acc });
        }
      }
      for (const grp of liabilities) {
        for (const acc of grp.accounts || []) {
          rows.push({ category: 'LIABILITY', group: grp.groupName, ...acc });
        }
      }
      for (const grp of equity) {
        for (const acc of grp.accounts || []) {
          rows.push({ category: 'EQUITY', group: grp.groupName, ...acc });
        }
      }

      const columns = [
        { key: 'category', label: 'Category', width: '130px', render: (v) => (
          <span className={`${styles.badge} ${v === 'ASSET' ? styles.badgePrimary : v === 'LIABILITY' ? styles.badgeWarning : styles.badgeNeutral}`}>{v}</span>
        )},
        { key: 'group', label: 'Group' },
        { key: 'accountCode', label: 'Code', width: '120px' },
        { key: 'accountName', label: 'Account Name' },
        { key: 'balance', label: 'Closing Balance', format: 'currency', isNumeric: true },
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reportData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Assets</div>
                <div className={styles.kpiValue} style={{ color: '#7f22fe' }}>
                  ₹ {(reportData.totalAssets || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Liabilities</div>
                <div className={styles.kpiValue} style={{ color: '#c2410c' }}>
                  ₹ {(reportData.totalLiabilities || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Total Equity</div>
                <div className={styles.kpiValue} style={{ color: '#15803d' }}>
                  ₹ {(reportData.totalEquity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className={styles.kpiCard}>
                <div className={styles.kpiLabel}>Balance Sheet Invariant</div>
                <div className={styles.kpiValue} style={{ fontSize: '1.1rem' }}>
                  <span className={`${styles.badge} ${reportData.isBalanced ? styles.badgeSuccess : styles.badgeDanger}`}>
                    {reportData.isBalanced ? '✅ BALANCED' : '❌ UNBALANCED'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <ReportDataTable
            title="Balance Sheet Statement"
            subtitle="Financial position: Assets = Liabilities + Equity (including period retained earnings)"
            columns={columns}
            data={rows}
            isLoading={loading}
            error={error}
            onRetry={() => fetchStatement(filters, subTab, selectedAccountId)}
          />
        </div>
      );
    }

    if (subTab === 'cash-book' || subTab === 'general-ledger') {
      const lines = reportData?.lines || [];
      const columns = [
        { key: 'voucherDate', label: 'Date', format: 'date', width: '110px' },
        { key: 'voucherNo', label: 'Voucher No', width: '140px' },
        { key: 'voucherType', label: 'Type', width: '100px', render: (v) => <span className={`${styles.badge} ${styles.badgeNeutral}`}>{v}</span> },
        { key: 'narration', label: 'Narration' },
        { key: 'debitAmount', label: 'Debit', format: 'currency', isNumeric: true },
        { key: 'creditAmount', label: 'Credit', format: 'currency', isNumeric: true },
        { key: 'runningBalance', label: 'Running Balance', format: 'currency', isNumeric: true },
      ];

      const totals = reportData ? {
        narration: 'Closing Balance',
        debitAmount: reportData.totalDebit,
        creditAmount: reportData.totalCredit,
        runningBalance: reportData.closingBalance,
      } : null;

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reportData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: '#ffffff', padding: '0.85rem 1.25rem', borderRadius: '8px', border: '1px solid #e4e4e7', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: '#71717a' }}>Opening Balance: </span>
                <strong>₹ {(reportData.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div>
                <span style={{ color: '#71717a' }}>Total Receipts / Debits: </span>
                <strong style={{ color: '#15803d' }}>₹ {(reportData.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div>
                <span style={{ color: '#71717a' }}>Total Disbursements / Credits: </span>
                <strong style={{ color: '#b91c1c' }}>₹ {(reportData.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{ color: '#71717a' }}>Closing Balance: </span>
                <strong style={{ fontSize: '0.95rem' }}>₹ {(reportData.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          )}

          <ReportDataTable
            title={subTab === 'cash-book' ? 'Cash & Bank Book' : `General Ledger: ${reportData?.account?.accountName || 'Account Ledger'}`}
            subtitle="Chronological audit log of posted journal vouchers with running balances"
            columns={columns}
            data={lines}
            totals={totals}
            isLoading={loading}
            error={error}
            onRetry={() => fetchStatement(filters, subTab, selectedAccountId)}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Subtab Navigation Bar */}
      <div className={`${styles.navTabs} no-print`}>
        {FINANCIAL_SUBTABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.navTab} ${subTab === tab.id ? styles.navTabActive : ''}`}
            onClick={() => setSubTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter and Export Bar */}
      {subTab !== 'reversal-audit' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }} className="no-print">
          <ReportFilterBar
            filters={filters}
            isLoading={loading}
            onApplyFilters={(newF) => {
              setFilters(newF);
              fetchStatement(newF, subTab, selectedAccountId);
            }}
            onResetFilters={() => {
              setFilters({});
              fetchStatement({}, subTab, selectedAccountId);
            }}
            extraFilters={
              subTab === 'general-ledger' && accountsList.length > 0 ? (
                <div className={styles.filterItem}>
                  <label className={styles.filterLabel}>Select Ledger Account</label>
                  <select
                    className={styles.filterInput}
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  >
                    {accountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountCode} — {acc.accountName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null
            }
          />

          <ReportExportActions
            companyId={companyId}
            reportType={activeTabConfig?.exportType}
            filters={{ ...filters, accountId: subTab === 'general-ledger' ? selectedAccountId : undefined }}
            canExport={Boolean(activeTabConfig?.exportType)}
            reportTitle={activeTabConfig?.label}
            showToast={showToast}
          />
        </div>
      )}

      {renderContent()}
    </div>
  );
}

