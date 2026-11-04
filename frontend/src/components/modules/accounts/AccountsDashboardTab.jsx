'use client';

import { useMemo } from 'react';
import styles from '../AccountsModule.module.css';

export default function AccountsDashboardTab({
  metrics,
  recentVouchers = [],
  invoices = [],
  bankAccounts = [],
  onNavigateTab,
}) {
  const stats = useMemo(() => {
    const totalRec = invoices
      .filter((i) => i.status === 'POSTED' || i.status === 'PARTIALLY_PAID')
      .reduce((sum, i) => sum + Number(i.outstandingAmount || 0), 0);

    const totalBank = bankAccounts
      .reduce((sum, b) => sum + Number(b.currentBalance || 0), 0);

    const overdueCount = invoices
      .filter((i) => {
        if (i.status !== 'POSTED' && i.status !== 'PARTIALLY_PAID') return false;
        return i.dueDate && new Date(i.dueDate) < new Date();
      }).length;

    return {
      totalRec,
      totalBank,
      overdueCount,
      totalInvoices: invoices.length,
    };
  }, [invoices, bankAccounts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI Cards */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>💰</span>
          <div>
            <small>Total Receivables</small>
            <strong>₹ {stats.totalRec.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div className={styles.stat}>
          <span>🏦</span>
          <div>
            <small>Total Bank Balances</small>
            <strong>₹ {stats.totalBank.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div className={styles.stat}>
          <span>📄</span>
          <div>
            <small>Active Invoices</small>
            <strong>{stats.totalInvoices} Invoices</strong>
          </div>
        </div>

        <div className={styles.stat}>
          <span>⚠️</span>
          <div>
            <small>Overdue Invoices</small>
            <strong style={{ color: stats.overdueCount > 0 ? '#b91c1c' : '#15803d' }}>
              {stats.overdueCount} Overdue
            </strong>
          </div>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.1rem' }}>
        <h4 style={{ margin: '0 0 0.8rem', fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
          ⚡ Accounting Quick Actions
        </h4>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className={styles.primary} onClick={() => onNavigateTab('invoices')}>
            + New Sales Invoice
          </button>
          <button className={styles.secondary} onClick={() => onNavigateTab('receipts')}>
            + Record Customer Receipt
          </button>
          <button className={styles.secondary} onClick={() => onNavigateTab('gl')}>
            + New Journal Voucher
          </button>
          <button className={styles.secondary} onClick={() => onNavigateTab('reconciliation')}>
            ⚖️ Bank Reconciliation (BRS)
          </button>
          <button className={styles.secondary} onClick={() => onNavigateTab('statementImport')}>
            📥 Import Bank Statement
          </button>
          <button className={styles.secondary} onClick={() => onNavigateTab('tally')}>
            🔄 Tally Prime XML Export
          </button>
        </div>
      </div>

      {/* Recent Journal Vouchers */}
      <div className={styles.tableWrap}>
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>Recent Financial Transactions &amp; Vouchers</strong>
          <button
            onClick={() => onNavigateTab('gl')}
            style={{ border: 'none', background: 'transparent', color: '#7f22fe', fontWeight: 750, fontSize: '0.74rem', cursor: 'pointer' }}
          >
            View Full General Ledger &rarr;
          </button>
        </div>

        {recentVouchers.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
            No recent accounting vouchers recorded.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Date</th>
                <th>Narration</th>
                <th>Total Debit</th>
                <th>Total Credit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentVouchers.slice(0, 8).map((vch) => (
                <tr key={vch.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{vch.voucherNo}</td>
                  <td><span className={styles.badge + ' ' + styles.badgeBlue}>{vch.voucherType}</span></td>
                  <td>{new Date(vch.voucherDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {vch.narration || 'N/A'}
                  </td>
                  <td style={{ fontWeight: 700 }}>₹ {Number(vch.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 700 }}>₹ {Number(vch.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span className={styles.badge + ' ' + (vch.status === 'POSTED' ? styles.badgeGreen : vch.status === 'DRAFT' ? styles.badgeAmber : styles.badgeRed)}>
                      {vch.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

