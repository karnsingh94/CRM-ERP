'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import { api } from '../../../lib/api';

export default function TallyIntegrationTab({
  mappings = [],
  accounts = [],
  exportBatches = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [isExportPreviewModalOpen, setIsExportPreviewModalOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState(null);
  const [mappingPreview, setMappingPreview] = useState(null);
  const [isMappingPreviewModalOpen, setIsMappingPreviewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reExport, setReExport] = useState(false);

  // Mapping Form
  const [mapForm, setMapForm] = useState({
    accountId: '',
    tallyLedgerName: '',
    tallyParentGroup: 'Current Assets',
  });

  const handleCreateMapping = async (e) => {
    e.preventDefault();
    if (!mapForm.accountId || !mapForm.tallyLedgerName) {
      showToast('Please select local account and enter Tally ledger name.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/tally/ledger-mappings`, {
        accountId: mapForm.accountId,
        tallyLedgerName: mapForm.tallyLedgerName.trim(),
        tallyParentGroup: mapForm.tallyParentGroup.trim(),
      });

      showToast('Tally ledger mapping saved.');
      setIsMappingModalOpen(false);
      setMapForm({ accountId: '', tallyLedgerName: '', tallyParentGroup: 'Current Assets' });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to save mapping.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenExportPreview = async () => {
    try {
      setSubmitting(true);
      const res = await api.post(`/companies/${companyId}/accounting/tally/vouchers/preview`, {
        reExport,
      });
      setExportPreview(res?.data || res || null);
      setIsExportPreviewModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load voucher export preview.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenMappingPreview = async () => {
    try {
      setSubmitting(true);
      const res = await api.get(`/companies/${companyId}/accounting/tally/ledger-mappings/preview`);
      setMappingPreview(res?.data || res || null);
      setIsMappingPreviewModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load mapping status preview.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteExportXml = async () => {
    try {
      setSubmitting(true);
      const res = await api.post(`/companies/${companyId}/accounting/tally/vouchers/export`, {
        reExport,
      });

      const batchNo = res?.data?.batchNo || `TALLY-SYNC-${Date.now()}`;
      const xml = res?.data?.xml;

      if (xml) {
        // Trigger browser file download of standard Tally XML
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${batchNo}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      showToast(`Export complete! Batch: ${batchNo} (${res?.data?.voucherCount || 0} vouchers).`);
      setIsExportPreviewModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Tally export failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Tally Prime Integration &amp; XML Export</h3>
          <p>Map local ERP accounts to Tally ledgers, generate standard XML envelopes, and download vouchers.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={handleOpenMappingPreview}>
            🔍 View Mapping Status
          </button>
          <button className={styles.primary} onClick={() => setIsMappingModalOpen(true)}>
            + Map Ledger
          </button>
          <button className={styles.primary} style={{ background: '#0284c7', borderColor: '#0284c7' }} onClick={handleOpenExportPreview}>
            📤 Export Tally XML
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.78rem', color: '#334155' }}>
        <span>ℹ️</span>
        <div>
          <b>Idempotent Tally XML Exchange:</b> Each exported voucher carries a stable GUID (<code>AZZUNIQE-VCH-$&#123;id&#125;</code>) preventing duplicate posting in Tally Prime. Standard XML format is fully compatible with Tally Prime 2.0+ Import Data menu.
        </div>
      </div>

      {/* Tally Ledger Mappings Table */}
      <div className={styles.tableWrap}>
        <div style={{ padding: '0.65rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
            Active Ledger Mappings ({mappings.length})
          </strong>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Local Account Code</th>
              <th>Local Account Name</th>
              <th>Mapped Tally Ledger Name</th>
              <th>Tally Parent Group</th>
              <th>Status</th>
              <th>Mapped On</th>
            </tr>
          </thead>
          <tbody>
            {mappings.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No Tally ledger mappings configured. Click &quot;Map Ledger&quot; or check &quot;View Mapping Status&quot;.
                </td>
              </tr>
            ) : (
              mappings.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{m.account?.accountCode}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{m.account?.accountName}</td>
                  <td style={{ fontWeight: 800, color: '#0369a1' }}>{m.tallyLedgerName}</td>
                  <td>{m.tallyParentGroup || 'Primary'}</td>
                  <td>
                    <span className={styles.badge + ' ' + (m.status === 'ACTIVE' ? styles.badgeGreen : styles.badgeGray)}>
                      {m.status}
                    </span>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Export Batches History Table */}
      <div className={styles.tableWrap}>
        <div style={{ padding: '0.65rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
            Tally XML Export History Batches ({exportBatches.length})
          </strong>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Batch Number</th>
              <th>Batch Type</th>
              <th>Total Vouchers</th>
              <th>Export Status</th>
              <th>Exported At</th>
            </tr>
          </thead>
          <tbody>
            {exportBatches.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  No Tally sync batches generated yet.
                </td>
              </tr>
            ) : (
              exportBatches.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{b.batchNo}</td>
                  <td><span className={styles.badge + ' ' + styles.badgeBlue}>{b.batchType}</span></td>
                  <td style={{ fontWeight: 800 }}>{b.totalCount || b._count?.vouchers || 0}</td>
                  <td><span className={styles.badge + ' ' + styles.badgeGreen}>{b.status}</span></td>
                  <td>{new Date(b.createdAt || b.startedAt).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Ledger Mapping Modal */}
      <Modal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        title="Map Local Account to Tally Ledger"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateMapping} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Select Local General Ledger Account *</label>
            <select
              value={mapForm.accountId}
              onChange={(e) => {
                const acc = accounts.find((a) => a.id === e.target.value);
                setMapForm({
                  ...mapForm,
                  accountId: e.target.value,
                  tallyLedgerName: acc ? acc.accountName : mapForm.tallyLedgerName,
                });
              }}
              required
            >
              <option value="">Select Account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} — {a.accountName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Tally Prime Ledger Name (Exact match in Tally) *</label>
            <input
              type="text"
              placeholder="e.g. HDFC Bank Main A/c"
              value={mapForm.tallyLedgerName}
              onChange={(e) => setMapForm({ ...mapForm, tallyLedgerName: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Tally Parent Group *</label>
            <select
              value={mapForm.tallyParentGroup}
              onChange={(e) => setMapForm({ ...mapForm, tallyParentGroup: e.target.value })}
              required
            >
              <option value="Bank Accounts">Bank Accounts</option>
              <option value="Cash-in-hand">Cash-in-hand</option>
              <option value="Sundry Debtors">Sundry Debtors</option>
              <option value="Sundry Creditors">Sundry Creditors</option>
              <option value="Duties & Taxes">Duties &amp; Taxes</option>
              <option value="Sales Accounts">Sales Accounts</option>
              <option value="Purchase Accounts">Purchase Accounts</option>
              <option value="Direct Expenses">Direct Expenses</option>
              <option value="Indirect Expenses">Indirect Expenses</option>
              <option value="Direct Incomes">Direct Incomes</option>
              <option value="Indirect Incomes">Indirect Incomes</option>
              <option value="Current Assets">Current Assets</option>
              <option value="Current Liabilities">Current Liabilities</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsMappingModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Export Preview & Download Modal */}
      {isExportPreviewModalOpen && exportPreview && (
        <Modal
          isOpen={isExportPreviewModalOpen}
          onClose={() => setIsExportPreviewModalOpen(false)}
          title="Tally Prime Voucher Export Preview"
          maxWidth="680px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span>📄</span>
                <div>
                  <small>Eligible Vouchers</small>
                  <strong style={{ color: '#0369a1' }}>{exportPreview.eligibleCount} Vouchers</strong>
                </div>
              </div>
              <div className={styles.stat}>
                <span>⏭️</span>
                <div>
                  <small>Already Exported (Skipped)</small>
                  <strong>{exportPreview.skippedCount} Skipped</strong>
                </div>
              </div>
              <div className={styles.stat}>
                <span>⚠️</span>
                <div>
                  <small>Missing Ledgers</small>
                  <strong style={{ color: exportPreview.missingLedgersCount > 0 ? '#b45309' : '#15803d' }}>
                    {exportPreview.missingLedgersCount} Missing
                  </strong>
                </div>
              </div>
            </div>

            {exportPreview.missingLedgers && exportPreview.missingLedgers.length > 0 && (
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.8rem', fontSize: '0.75rem', color: '#92400e' }}>
                <b>Notice:</b> The following accounts do not have an explicit Tally mapping and will export using their ERP account name:
                <div style={{ marginTop: '4px', fontWeight: 700 }}>{exportPreview.missingLedgers.join(', ')}</div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#475569' }}>
              <input
                type="checkbox"
                id="reExportToggle"
                checked={reExport}
                onChange={(e) => setReExport(e.target.checked)}
              />
              <label htmlFor="reExportToggle" style={{ cursor: 'pointer' }}>
                Force Re-export of previously exported vouchers
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button className={styles.secondary} onClick={() => setIsExportPreviewModalOpen(false)}>
                Cancel
              </button>
              <button
                className={styles.primary}
                onClick={handleExecuteExportXml}
                disabled={submitting || exportPreview.eligibleCount === 0}
              >
                {submitting ? 'Generating XML...' : `📥 Download Tally XML (${exportPreview.eligibleCount} Vouchers)`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mapping Status Modal */}
      {isMappingPreviewModalOpen && mappingPreview && (
        <Modal
          isOpen={isMappingPreviewModalOpen}
          onClose={() => setIsMappingPreviewModalOpen(false)}
          title="Tally Ledger Mapping Health & Coverage"
          maxWidth="700px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
              <div>Total Accounts: <b>{mappingPreview.totalAccounts}</b></div>
              <div style={{ color: '#15803d' }}>Mapped: <b>{mappingPreview.mappedCount}</b></div>
              <div style={{ color: '#b91c1c' }}>Unmapped: <b>{mappingPreview.unmappedCount}</b></div>
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th>Mapped Tally Ledger</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(mappingPreview.accounts || []).map((acc) => (
                    <tr key={acc.accountId}>
                      <td style={{ fontWeight: 800 }}>{acc.accountCode}</td>
                      <td>{acc.accountName}</td>
                      <td style={{ fontWeight: 700, color: acc.isMapped ? '#0369a1' : '#64748b' }}>
                        {acc.tallyLedgerName}
                      </td>
                      <td>
                        <span className={styles.badge + ' ' + (acc.isMapped ? styles.badgeGreen : styles.badgeAmber)}>
                          {acc.isMapped ? 'MAPPED' : 'DEFAULT'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className={styles.primary} onClick={() => setIsMappingPreviewModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

