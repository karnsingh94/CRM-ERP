'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import { api } from '../../../lib/api';

export default function BankStatementImportTab({
  bankAccounts = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [selectedBankAccountId, setSelectedBankAccountId] = useState(bankAccounts[0]?.id || '');
  const [csvContent, setCsvContent] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skipRejected, setSkipRejected] = useState(true);

  const sampleCsvTemplate = `Date,Value Date,Description,Ref No,Txn ID,Debit,Credit,Balance
2026-05-01,2026-05-01,Inward NEFT Client Payment,REF-1001,TXN5001,0,50000.00,150000.00
2026-05-03,2026-05-03,Vendor Payment Equipment,REF-1002,TXN5002,25000.00,0,125000.00
2026-05-05,2026-05-05,Monthly Bank Service Charges,CHG-MAY,TXN5003,1180.00,0,123820.00
2026-05-07,2026-05-07,Quarterly Interest Credited,INT-Q1,TXN5004,0,3500.00,127320.00`;

  const handlePreview = async () => {
    if (!selectedBankAccountId) {
      showToast('Please select a target Bank Account.', 'error');
      return;
    }
    if (!csvContent || !csvContent.trim()) {
      showToast('Please paste or upload CSV statement content.', 'error');
      return;
    }

    try {
      setLoading(true);
      setImportResult(null);
      const res = await api.post(
        `/companies/${companyId}/accounting/bank-accounts/${selectedBankAccountId}/statements/preview`,
        {
          statementData: csvContent.trim(),
        }
      );

      setPreviewResult(res?.data || res || null);
      showToast(`Preview generated: ${res?.data?.validCount || 0} valid rows.`);
    } catch (err) {
      showToast(err.message || 'Failed to preview bank statement.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!selectedBankAccountId || !previewResult) return;

    try {
      setLoading(true);
      const res = await api.post(
        `/companies/${companyId}/accounting/bank-accounts/${selectedBankAccountId}/statements/import`,
        {
          statementData: csvContent.trim(),
          skipRejected,
        }
      );

      setImportResult(res?.data || res || null);
      setPreviewResult(null);
      showToast(`Statement imported! Batch: ${res?.data?.statementBatchId} (${res?.data?.importedCount} txns).`);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Import failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target.result || '');
      setPreviewResult(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Bank Statement Import (CSV)</h3>
          <p>Import electronic bank statements, validate date/polarity rules, and auto-detect duplicate transactions.</p>
        </div>
      </div>

      {/* Control Panel */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Select Target Bank Account *</label>
            <select
              value={selectedBankAccountId}
              onChange={(e) => {
                setSelectedBankAccountId(e.target.value);
                setPreviewResult(null);
                setImportResult(null);
              }}
            >
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} ({b.maskedAccountNumber}) — Current Bal: ₹{Number(b.currentBalance || 0).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Upload CSV File</label>
            <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
          </div>
        </div>

        <div className={styles.formGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label>Paste Raw CSV Text (Headers: Date, Description, Debit, Credit, Balance, Txn ID)</label>
            <button
              type="button"
              className={styles.secondary}
              style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              onClick={() => setCsvContent(sampleCsvTemplate)}
            >
              Load Sample Template
            </button>
          </div>
          <textarea
            rows="6"
            className={styles.codeBox}
            style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#0f172a', color: '#f8fafc', padding: '0.75rem' }}
            placeholder="Paste CSV text with headers..."
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              setPreviewResult(null);
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#475569', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={skipRejected}
              onChange={(e) => setSkipRejected(e.target.checked)}
            />
            Skip invalid or duplicate rows automatically during import
          </label>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              type="button"
              className={styles.secondary}
              onClick={handlePreview}
              disabled={loading || !csvContent.trim()}
            >
              {loading && !previewResult ? 'Validating...' : '🔍 Preview Statement'}
            </button>

            {previewResult && previewResult.validCount > 0 && (
              <button
                type="button"
                className={styles.primary}
                onClick={handleExecuteImport}
                disabled={loading}
              >
                {loading ? 'Importing...' : `📥 Execute Import (${previewResult.validCount} Valid Rows)`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Summary */}
      {previewResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span>📄</span>
              <div>
                <small>Total Statement Rows</small>
                <strong>{previewResult.totalRows} Rows</strong>
              </div>
            </div>

            <div className={styles.stat}>
              <span>✅</span>
              <div>
                <small>Valid Rows</small>
                <strong style={{ color: '#15803d' }}>{previewResult.validCount} Valid</strong>
              </div>
            </div>

            <div className={styles.stat}>
              <span>⚠️</span>
              <div>
                <small>Rejected / Invalid Rows</small>
                <strong style={{ color: previewResult.rejectedCount > 0 ? '#b91c1c' : '#64748b' }}>
                  {previewResult.rejectedCount} Rejected
                </strong>
              </div>
            </div>

            <div className={styles.stat}>
              <span>🏦</span>
              <div>
                <small>Bank Account</small>
                <strong style={{ fontSize: '0.95rem' }}>{previewResult.bankName}</strong>
              </div>
            </div>
          </div>

          {/* Rejected Rows Alerts */}
          {previewResult.rejectedRows && previewResult.rejectedRows.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '1rem' }}>
              <h5 style={{ margin: '0 0 0.5rem', color: '#b91c1c', fontSize: '0.85rem', fontWeight: 800 }}>
                ⚠️ Rejected Rows Report ({previewResult.rejectedRows.length} errors found)
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto', fontSize: '0.74rem' }}>
                {previewResult.rejectedRows.map((err, i) => (
                  <div key={i} style={{ color: '#991b1b' }}>
                    Line {err.rowNumber}: <b>{err.reason}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid Rows Preview Table */}
          <div className={styles.tableWrap}>
            <div style={{ padding: '0.65rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.82rem', fontWeight: 750 }}>
              Validated Statement Sample (First 10 rows)
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Ref No</th>
                  <th>External Ref</th>
                  <th>Debit (Dr)</th>
                  <th>Credit (Cr)</th>
                  <th>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.previewRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.rowNumber}</td>
                    <td>{new Date(r.transactionDate).toLocaleDateString('en-IN')}</td>
                    <td>{r.description}</td>
                    <td>{r.referenceNo || '—'}</td>
                    <td><span className={styles.badge + ' ' + styles.badgeBlue}>{r.externalRef || 'AUTO'}</span></td>
                    <td>{Number(r.debitAmount || 0) > 0 ? `₹ ${Number(r.debitAmount).toFixed(2)}` : '—'}</td>
                    <td>{Number(r.creditAmount || 0) > 0 ? `₹ ${Number(r.creditAmount).toFixed(2)}` : '—'}</td>
                    <td style={{ fontWeight: 800 }}>{r.runningBalance !== null ? `₹ ${Number(r.runningBalance).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#15803d', fontWeight: 800, fontSize: '0.95rem' }}>
            <span>✅</span> Bank Statement Successfully Imported!
          </div>
          <p style={{ margin: '0.4rem 0 0', color: '#166534', fontSize: '0.8rem' }}>
            Batch ID: <b>{importResult.statementBatchId}</b> &bull; Imported: <b>{importResult.importedCount} transactions</b> &bull; Skipped: <b>{importResult.skippedCount} rows</b>
          </p>
        </div>
      )}
    </div>
  );
}

