'use client';

import { useState, useMemo } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { api } from '../../../lib/api';

export default function GeneralLedgerTab({
  vouchers = [],
  accounts = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewVoucher, setViewVoucher] = useState(null);
  const [confirmPostId, setConfirmPostId] = useState(null);
  const [reverseVoucherModal, setReverseVoucherModal] = useState({ isOpen: false, voucher: null, reason: '' });
  const [submitting, setSubmitting] = useState(false);

  // Draft Voucher Form State
  const [form, setForm] = useState({
    voucherType: 'JOURNAL',
    voucherDate: new Date().toISOString().slice(0, 10),
    referenceNo: '',
    narration: '',
    items: [
      { accountId: '', debitAmount: '', creditAmount: '', narration: '' },
      { accountId: '', debitAmount: '', creditAmount: '', narration: '' },
    ],
  });

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const matchType = !typeFilter || v.voucherType === typeFilter;
      const matchStatus = !statusFilter || v.status === statusFilter;
      const matchSearch =
        !searchTerm ||
        v.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.narration?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [vouchers, typeFilter, statusFilter, searchTerm]);

  const handleAddItem = () => {
    setForm({
      ...form,
      items: [...form.items, { accountId: '', debitAmount: '', creditAmount: '', narration: '' }],
    });
  };

  const handleRemoveItem = (idx) => {
    if (form.items.length <= 2) return;
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== idx),
    });
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...form.items];
    updated[idx][field] = val;
    // Mutually exclusive Dr / Cr input for clarity
    if (field === 'debitAmount' && Number(val) > 0) {
      updated[idx].creditAmount = '';
    } else if (field === 'creditAmount' && Number(val) > 0) {
      updated[idx].debitAmount = '';
    }
    setForm({ ...form, items: updated });
  };

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    form.items.forEach((item) => {
      dr += Number(item.debitAmount || 0);
      cr += Number(item.creditAmount || 0);
    });
    return {
      dr: Math.round(dr * 100) / 100,
      cr: Math.round(cr * 100) / 100,
      diff: Math.round(Math.abs(dr - cr) * 100) / 100,
      isBalanced: Math.abs(dr - cr) < 0.001 && dr > 0,
    };
  }, [form.items]);

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!totals.isBalanced) {
      showToast(`Voucher is unbalanced. Total Dr (₹${totals.dr}) must equal Total Cr (₹${totals.cr}).`, 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/vouchers`, {
        voucherType: form.voucherType,
        voucherDate: form.voucherDate,
        referenceNo: form.referenceNo,
        narration: form.narration,
        items: form.items
          .filter((it) => it.accountId && (Number(it.debitAmount) > 0 || Number(it.creditAmount) > 0))
          .map((it) => ({
            accountId: it.accountId,
            debitAmount: Number(it.debitAmount || 0),
            creditAmount: Number(it.creditAmount || 0),
            narration: it.narration || null,
          })),
      });

      showToast('Draft Journal Voucher created successfully.');
      setIsCreateModalOpen(false);
      setForm({
        voucherType: 'JOURNAL',
        voucherDate: new Date().toISOString().slice(0, 10),
        referenceNo: '',
        narration: '',
        items: [
          { accountId: '', debitAmount: '', creditAmount: '', narration: '' },
          { accountId: '', debitAmount: '', creditAmount: '', narration: '' },
        ],
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create voucher.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostVoucher = async () => {
    if (!confirmPostId) return;
    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/vouchers/${confirmPostId}/post`, {});
      showToast('Journal Voucher POSTED to General Ledger. Balances updated.');
      setConfirmPostId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to post voucher.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseVoucher = async (e) => {
    e.preventDefault();
    if (!reverseVoucherModal.voucher || !reverseVoucherModal.reason || reverseVoucherModal.reason.trim().length < 5) {
      showToast('Please provide a comprehensive reversal reason (at least 5 characters).', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/vouchers/${reverseVoucherModal.voucher.id}/reverse`, {
        reason: reverseVoucherModal.reason.trim(),
      });
      showToast('Voucher reversed. Inverted reversal voucher generated and posted.');
      setReverseVoucherModal({ isOpen: false, voucher: null, reason: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to reverse voucher.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>General Ledger &amp; Journal Vouchers</h3>
          <p>Authoritative double-entry vouchers (Journal, Payments, Receipts, Contra) and audited postings.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsCreateModalOpen(true)}>
            + Create Journal Voucher
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by voucher no, ref, narration..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '220px' }}
        />

        <select
          className={styles.filterSelect}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Voucher Types</option>
          <option value="JOURNAL">JOURNAL</option>
          <option value="PAYMENT">PAYMENT</option>
          <option value="RECEIPT">RECEIPT</option>
          <option value="CONTRA">CONTRA</option>
          <option value="SALES_INVOICE">SALES INVOICE</option>
          <option value="PURCHASE_BILL">PURCHASE BILL</option>
          <option value="CREDIT_NOTE">CREDIT NOTE</option>
          <option value="DEBIT_NOTE">DEBIT NOTE</option>
        </select>

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="POSTED">POSTED</option>
          <option value="REVERSED">REVERSED</option>
        </select>

        {(searchTerm || typeFilter || statusFilter) && (
          <button
            className={styles.filterReset}
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('');
              setStatusFilter('');
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Vouchers Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Voucher No</th>
              <th>Type</th>
              <th>Date</th>
              <th>Reference No</th>
              <th>Narration</th>
              <th>Total Debit</th>
              <th>Total Credit</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVouchers.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No journal vouchers found matching the criteria.
                </td>
              </tr>
            ) : (
              filteredVouchers.map((vch) => (
                <tr key={vch.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{vch.voucherNo}</td>
                  <td>
                    <span className={styles.badge + ' ' + styles.badgeBlue}>{vch.voucherType}</span>
                  </td>
                  <td>{new Date(vch.voucherDate).toLocaleDateString('en-IN')}</td>
                  <td style={{ color: '#475569' }}>{vch.referenceNo || '—'}</td>
                  <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {vch.narration || 'N/A'}
                  </td>
                  <td style={{ fontWeight: 750 }}>₹ {Number(vch.totalDebit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 750 }}>₹ {Number(vch.totalCredit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span
                      className={
                        styles.badge +
                        ' ' +
                        (vch.status === 'POSTED'
                          ? styles.badgeGreen
                          : vch.status === 'DRAFT'
                          ? styles.badgeAmber
                          : styles.badgeRed)
                      }
                    >
                      {vch.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      <button className={styles.secondary} onClick={() => setViewVoucher(vch)}>
                        View
                      </button>
                      {vch.status === 'DRAFT' && (
                        <button className={styles.primary} onClick={() => setConfirmPostId(vch.id)}>
                          Post GL
                        </button>
                      )}
                      {vch.status === 'POSTED' && !vch.isReversal && (
                        <button
                          className={styles.danger}
                          onClick={() => setReverseVoucherModal({ isOpen: true, voucher: vch, reason: '' })}
                        >
                          Reverse
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Draft Voucher Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Double-Entry Journal Voucher"
        maxWidth="800px"
      >
        <form onSubmit={handleCreateVoucher} className={styles.modalForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Voucher Type *</label>
              <select
                value={form.voucherType}
                onChange={(e) => setForm({ ...form, voucherType: e.target.value })}
                required
              >
                <option value="JOURNAL">JOURNAL (Standard Double Entry)</option>
                <option value="PAYMENT">PAYMENT (Cash / Bank Outflow)</option>
                <option value="RECEIPT">RECEIPT (Cash / Bank Inflow)</option>
                <option value="CONTRA">CONTRA (Bank-to-Bank / Bank-to-Cash)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Voucher Date *</label>
              <input
                type="date"
                value={form.voucherDate}
                onChange={(e) => setForm({ ...form, voucherDate: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Reference No</label>
              <input
                type="text"
                placeholder="e.g. JV-MANUAL-001"
                value={form.referenceNo}
                onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Master Narration *</label>
            <input
              type="text"
              placeholder="e.g. Month-end depreciation adjustment or prepaid expense allocation"
              value={form.narration}
              onChange={(e) => setForm({ ...form, narration: e.target.value })}
              required
            />
          </div>

          {/* Line Items */}
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Voucher Debit / Credit Lines</strong>
              <button type="button" className={styles.secondary} onClick={handleAddItem} style={{ fontSize: '0.72rem' }}>
                + Add Line
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {form.items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 2fr 0.4fr', gap: '0.4rem', alignItems: 'center' }}>
                  <select
                    value={item.accountId}
                    onChange={(e) => handleItemChange(idx, 'accountId', e.target.value)}
                    required
                  >
                    <option value="">Select Account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountCode} — {acc.accountName} ({acc.normalBalance})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Debit (₹)"
                    value={item.debitAmount}
                    onChange={(e) => handleItemChange(idx, 'debitAmount', e.target.value)}
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Credit (₹)"
                    value={item.creditAmount}
                    onChange={(e) => handleItemChange(idx, 'creditAmount', e.target.value)}
                  />

                  <input
                    type="text"
                    placeholder="Line Narration"
                    value={item.narration}
                    onChange={(e) => handleItemChange(idx, 'narration', e.target.value)}
                  />

                  <button
                    type="button"
                    className={styles.danger}
                    onClick={() => handleRemoveItem(idx)}
                    disabled={form.items.length <= 2}
                    style={{ padding: '0.45rem', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Balance Invariant Validator */}
          <div
            style={{
              padding: '0.8rem 1rem',
              borderRadius: '8px',
              border: '1px solid ' + (totals.isBalanced ? '#bbf7d0' : '#fecaca'),
              background: totals.isBalanced ? '#f0fdf4' : '#fef2f2',
              marginTop: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
              <div>
                Total Debit: <b style={{ color: '#0369a1' }}>₹ {totals.dr.toFixed(2)}</b> &nbsp;|&nbsp;
                Total Credit: <b style={{ color: '#b45309' }}>₹ {totals.cr.toFixed(2)}</b>
              </div>
              <div>
                {totals.isBalanced ? (
                  <span style={{ color: '#15803d', fontWeight: 800 }}>✓ VOUCHER BALANCED</span>
                ) : (
                  <span style={{ color: '#b91c1c', fontWeight: 800 }}>
                    ⚠️ UNBALANCED (Difference: ₹ {totals.diff.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting || !totals.isBalanced}>
              {submitting ? 'Saving...' : 'Save Draft Voucher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Voucher Details Modal */}
      {viewVoucher && (
        <Modal
          isOpen={Boolean(viewVoucher)}
          onClose={() => setViewVoucher(null)}
          title={`Journal Voucher: ${viewVoucher.voucherNo}`}
          maxWidth="700px"
        >
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div>
                <h4 style={{ margin: 0, color: '#7f22fe' }}>{viewVoucher.voucherNo}</h4>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Type: {viewVoucher.voucherType}</p>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Date: {new Date(viewVoucher.voucherDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={styles.badge + ' ' + (viewVoucher.status === 'POSTED' ? styles.badgeGreen : styles.badgeAmber)}>
                  {viewVoucher.status}
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Ref: {viewVoucher.referenceNo || 'None'}
                </p>
              </div>
            </div>

            <p style={{ margin: '0.5rem 0', fontStyle: 'italic', color: '#334155' }}>
              &ldquo;{viewVoucher.narration}&rdquo;
            </p>

            <table className={styles.table} style={{ border: '1px solid #e2e8f0' }}>
              <thead>
                <tr>
                  <th>Account Code &amp; Name</th>
                  <th>Subledger Party</th>
                  <th>Debit (Dr)</th>
                  <th>Credit (Cr)</th>
                </tr>
              </thead>
              <tbody>
                {(viewVoucher.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td>
                      <b>{it.account?.accountCode || it.accountId}</b><br />
                      <span style={{ color: '#475569' }}>{it.account?.accountName}</span>
                    </td>
                    <td>{it.customer?.companyName || it.vendor?.name || '—'}</td>
                    <td>{Number(it.debitAmount || 0) > 0 ? `₹ ${Number(it.debitAmount).toFixed(2)}` : '—'}</td>
                    <td>{Number(it.creditAmount || 0) > 0 ? `₹ ${Number(it.creditAmount).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 800 }}>
              <div>Total: ₹ {Number(viewVoucher.totalDebit || 0).toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className={styles.primary} onClick={() => setViewVoucher(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reverse Voucher Modal */}
      {reverseVoucherModal.isOpen && (
        <Modal
          isOpen={reverseVoucherModal.isOpen}
          onClose={() => setReverseVoucherModal({ isOpen: false, voucher: null, reason: '' })}
          title={`Reverse Posted Voucher ${reverseVoucherModal.voucher?.voucherNo}`}
          maxWidth="500px"
        >
          <form onSubmit={handleReverseVoucher} className={styles.modalForm}>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
              Reversing this voucher will create an inverted Reversal Journal Voucher that restores all affected ledger accounts. This operation is permanent and fully audited.
            </p>

            <div className={styles.formGroup}>
              <label>Reversal Reason (Minimum 5 characters) *</label>
              <textarea
                rows="3"
                placeholder="e.g. Incorrect account classification or wrong line amount"
                value={reverseVoucherModal.reason}
                onChange={(e) => setReverseVoucherModal({ ...reverseVoucherModal, reason: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setReverseVoucherModal({ isOpen: false, voucher: null, reason: '' })}
              >
                Cancel
              </button>
              <button type="submit" className={styles.danger} disabled={submitting}>
                {submitting ? 'Reversing...' : 'Confirm Reversal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Post Dialog */}
      <ConfirmDialog
        isOpen={Boolean(confirmPostId)}
        onClose={() => setConfirmPostId(null)}
        onConfirm={handlePostVoucher}
        title="Post Journal Voucher to General Ledger?"
        message="Posting this voucher will apply debit and credit movements to all affected General Ledger accounts. Posted vouchers are immutable."
        confirmLabel="Yes, Post to GL"
      />
    </div>
  );
}

