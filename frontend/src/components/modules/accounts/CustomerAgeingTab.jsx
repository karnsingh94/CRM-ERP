'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import { api } from '../../../lib/api';

export default function CustomerAgeingTab({
  ageingData = [],
  companyId,
  showToast,
}) {
  const [selectedCustomerStatement, setSelectedCustomerStatement] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const handleViewStatement = async (customerId, customerName) => {
    try {
      setStatementLoading(true);
      const res = await api.get(`/companies/${companyId}/accounting/statements/customers/${customerId}`);
      setSelectedCustomerStatement({
        customerName,
        data: res?.data || res || {},
      });
    } catch (err) {
      showToast(err.message || 'Failed to load customer statement.', 'error');
    } finally {
      setStatementLoading(false);
    }
  };

  const totals = ageingData.reduce(
    (acc, row) => ({
      current: acc.current + Number(row.current || 0),
      days30: acc.days30 + Number(row.days1To30 || row.days30 || 0),
      days60: acc.days60 + Number(row.days31To60 || row.days60 || 0),
      days90: acc.days90 + Number(row.days61To90 || row.days90 || 0),
      over90: acc.over90 + Number(row.daysOver90 || row.over90 || 0),
      total: acc.total + Number(row.totalOutstanding || 0),
    }),
    { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Customer Receivables Ageing &amp; Statements</h3>
          <p>Overdue ageing schedules (Current, 1–30, 31–60, 61–90, 90+ days) and ledger statements.</p>
        </div>
      </div>

      {/* Ageing Summary Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>🟢</span>
          <div>
            <small>Current (Not Due)</small>
            <strong>₹ {totals.current.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div className={styles.stat}>
          <span>🟡</span>
          <div>
            <small>1–30 Days Overdue</small>
            <strong>₹ {totals.days30.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div className={styles.stat}>
          <span>🟠</span>
          <div>
            <small>31–60 Days Overdue</small>
            <strong>₹ {totals.days60.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>

        <div className={styles.stat}>
          <span>🔴</span>
          <div>
            <small>60+ Days Overdue</small>
            <strong style={{ color: '#b91c1c' }}>
              ₹ {(totals.days90 + totals.over90).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>

      {/* Ageing Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>GSTIN</th>
              <th>Current (Not Due)</th>
              <th>1–30 Days</th>
              <th>31–60 Days</th>
              <th>61–90 Days</th>
              <th>90+ Days</th>
              <th>Total Outstanding</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ageingData.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No outstanding customer receivables recorded.
                </td>
              </tr>
            ) : (
              ageingData.map((row) => (
                <tr key={row.customerId}>
                  <td style={{ fontWeight: 800, color: '#0f172a' }}>{row.customerName}</td>
                  <td style={{ color: '#64748b', fontSize: '0.72rem' }}>{row.gstin || '—'}</td>
                  <td>₹ {Number(row.current || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>₹ {Number(row.days1To30 || row.days30 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>₹ {Number(row.days31To60 || row.days60 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>₹ {Number(row.days61To90 || row.days90 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ color: Number(row.daysOver90 || row.over90 || 0) > 0 ? '#b91c1c' : '#475569', fontWeight: 700 }}>
                    ₹ {Number(row.daysOver90 || row.over90 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>
                    ₹ {Number(row.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={styles.secondary}
                      onClick={() => handleViewStatement(row.customerId, row.customerName)}
                      disabled={statementLoading}
                    >
                      Ledger Statement
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Customer Statement Modal */}
      {selectedCustomerStatement && (
        <Modal
          isOpen={Boolean(selectedCustomerStatement)}
          onClose={() => setSelectedCustomerStatement(null)}
          title={`Statement of Account: ${selectedCustomerStatement.customerName}`}
          maxWidth="760px"
        >
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a' }}>{selectedCustomerStatement.customerName}</h4>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Customer Ledger &amp; Transaction History</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p>Generated: <b>{new Date().toLocaleDateString('en-IN')}</b></p>
                <p>Net Balance: <b style={{ color: '#7f22fe' }}>
                  ₹ {Number(selectedCustomerStatement.data.closingBalance || selectedCustomerStatement.data.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </b></p>
              </div>
            </div>

            <table className={styles.table} style={{ border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher / Invoice No</th>
                  <th>Type</th>
                  <th>Particulars</th>
                  <th>Debit (Dr)</th>
                  <th>Credit (Cr)</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {(!selectedCustomerStatement.data.transactions || selectedCustomerStatement.data.transactions.length === 0) ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      No statement transactions found.
                    </td>
                  </tr>
                ) : (
                  selectedCustomerStatement.data.transactions.map((tx, idx) => (
                    <tr key={idx}>
                      <td>{new Date(tx.date || tx.voucherDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontWeight: 700, color: '#7f22fe' }}>{tx.voucherNo || tx.referenceNo || '—'}</td>
                      <td><span className={styles.badge + ' ' + styles.badgeBlue}>{tx.voucherType || 'INVOICE'}</span></td>
                      <td>{tx.narration || tx.particulars || 'Invoice Settlement'}</td>
                      <td>{Number(tx.debitAmount || 0) > 0 ? `₹ ${Number(tx.debitAmount).toFixed(2)}` : '—'}</td>
                      <td>{Number(tx.creditAmount || 0) > 0 ? `₹ ${Number(tx.creditAmount).toFixed(2)}` : '—'}</td>
                      <td style={{ fontWeight: 800 }}>₹ {Number(tx.runningBalance || tx.balance || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className={styles.secondary} onClick={() => window.print()}>
                🖨️ Print Statement
              </button>
              <button className={styles.primary} onClick={() => setSelectedCustomerStatement(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

