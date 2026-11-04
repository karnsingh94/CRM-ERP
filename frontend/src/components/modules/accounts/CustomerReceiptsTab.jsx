'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { api } from '../../../lib/api';

export default function CustomerReceiptsTab({
  receipts = [],
  invoices = [],
  customers = [],
  bankAccounts = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [allocateReceipt, setAllocateReceipt] = useState(null);
  const [reverseAllocId, setReverseAllocId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Receipt
  const [receiptForm, setReceiptForm] = useState({
    customerId: '',
    paymentMode: 'BANK',
    bankAccountId: '',
    amount: '',
    paymentType: 'STANDARD', // 'STANDARD' or 'ADVANCE'
    receiptDate: new Date().toISOString().slice(0, 10),
    referenceNo: '',
    narration: '',
  });

  // Form State for Allocation
  const [allocForm, setAllocForm] = useState({
    invoiceId: '',
    amount: '',
  });

  const filteredReceipts = receipts.filter((r) => {
    return (
      !searchTerm ||
      r.paymentReceiptNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer?.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.referenceNo?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleRecordReceipt = async (e) => {
    e.preventDefault();
    if (!receiptForm.customerId || !receiptForm.amount || Number(receiptForm.amount) <= 0) {
      showToast('Please select a customer and enter a valid receipt amount.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/receipts`, {
        customerId: receiptForm.customerId,
        paymentMode: receiptForm.paymentMode,
        bankAccountId: receiptForm.paymentMode === 'BANK' ? receiptForm.bankAccountId : null,
        amount: Number(receiptForm.amount),
        paymentType: receiptForm.paymentType,
        receiptDate: receiptForm.receiptDate,
        referenceNo: receiptForm.referenceNo,
        narration: receiptForm.narration,
      });

      showToast(`Customer receipt recorded. GL Voucher posted.`);
      setIsRecordModalOpen(false);
      setReceiptForm({
        customerId: '',
        paymentMode: 'BANK',
        bankAccountId: '',
        amount: '',
        paymentType: 'STANDARD',
        receiptDate: new Date().toISOString().slice(0, 10),
        referenceNo: '',
        narration: '',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to record receipt.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteAllocation = async (e) => {
    e.preventDefault();
    if (!allocateReceipt || !allocForm.invoiceId || !allocForm.amount) {
      showToast('Please select target invoice and valid allocation amount.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/payment-allocations`, {
        paymentReceiptId: allocateReceipt.id,
        invoiceId: allocForm.invoiceId,
        amount: Number(allocForm.amount),
      });

      showToast('Payment allocated successfully against Sales Invoice.');
      setAllocateReceipt(null);
      setAllocForm({ invoiceId: '', amount: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to allocate payment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverseAllocation = async () => {
    if (!reverseAllocId) return;
    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/payment-allocations/${reverseAllocId}/reverse`, {
        reason: 'Authorized customer allocation cancellation and rollback',
      });
      showToast('Payment allocation reversed. Unallocated balance restored.');
      setReverseAllocId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to reverse allocation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Customer Receipts &amp; Advance Allocations</h3>
          <p>Bank and cash inflows, customer advance deposits, and settlement against invoices.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsRecordModalOpen(true)}>
            + Record Customer Receipt
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by receipt no, customer, ref..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '240px' }}
        />

        {searchTerm && (
          <button className={styles.filterReset} onClick={() => setSearchTerm('')}>
            Reset Filter
          </button>
        )}
      </div>

      {/* Receipts Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Receipt No</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Mode</th>
              <th>Type</th>
              <th>Total Amount</th>
              <th>Unallocated Balance</th>
              <th>Ref / Narration</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No customer receipts recorded yet.
                </td>
              </tr>
            ) : (
              filteredReceipts.map((rcpt) => (
                <tr key={rcpt.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{rcpt.paymentReceiptNo}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>
                    {rcpt.customer?.companyName || 'Valued Customer'}
                  </td>
                  <td>{new Date(rcpt.receiptDate).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={styles.badge + ' ' + (rcpt.paymentMode === 'BANK' ? styles.badgeBlue : styles.badgeGreen)}>
                      {rcpt.paymentMode}
                    </span>
                  </td>
                  <td>
                    <span className={styles.badge + ' ' + (rcpt.paymentType === 'ADVANCE' ? styles.badgePurple : styles.badgeGray)}>
                      {rcpt.paymentType}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800 }}>
                    ₹ {Number(rcpt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ fontWeight: 800, color: Number(rcpt.unallocatedAmount || 0) > 0 ? '#b45309' : '#64748b' }}>
                    ₹ {Number(rcpt.unallocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rcpt.referenceNo || rcpt.narration || '—'}
                  </td>
                  <td>
                    <span className={styles.badge + ' ' + (rcpt.status === 'POSTED' ? styles.badgeGreen : styles.badgeGray)}>
                      {rcpt.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      {Number(rcpt.unallocatedAmount || 0) > 0 && (
                        <button
                          className={styles.primary}
                          onClick={() => {
                            setAllocateReceipt(rcpt);
                            setAllocForm({ invoiceId: '', amount: Number(rcpt.unallocatedAmount) });
                          }}
                        >
                          Allocate
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

      {/* Record Receipt Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Customer Receipt / Inflow"
        maxWidth="560px"
      >
        <form onSubmit={handleRecordReceipt} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Customer *</label>
            <select
              value={receiptForm.customerId}
              onChange={(e) => setReceiptForm({ ...receiptForm, customerId: e.target.value })}
              required
            >
              <option value="">Select Paying Customer...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Receipt Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={receiptForm.amount}
                onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Receipt Date *</label>
              <input
                type="date"
                value={receiptForm.receiptDate}
                onChange={(e) => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Payment Mode *</label>
              <select
                value={receiptForm.paymentMode}
                onChange={(e) => setReceiptForm({ ...receiptForm, paymentMode: e.target.value })}
                required
              >
                <option value="BANK">Bank Deposit / RTGS / NEFT / Cheque</option>
                <option value="CASH">Cash Deposit</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Payment Type *</label>
              <select
                value={receiptForm.paymentType}
                onChange={(e) => setReceiptForm({ ...receiptForm, paymentType: e.target.value })}
                required
              >
                <option value="STANDARD">Against Specific Invoices</option>
                <option value="ADVANCE">Customer Advance (Liability Entry)</option>
              </select>
            </div>
          </div>

          {receiptForm.paymentMode === 'BANK' && (
            <div className={styles.formGroup}>
              <label>Receiving Bank Account *</label>
              <select
                value={receiptForm.bankAccountId}
                onChange={(e) => setReceiptForm({ ...receiptForm, bankAccountId: e.target.value })}
                required
              >
                <option value="">Select Operating Bank Account...</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} ({b.maskedAccountNumber}) — Bal: ₹{Number(b.currentBalance || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.formGroup}>
            <label>Reference No (UTR / Cheque No)</label>
            <input
              type="text"
              placeholder="e.g. UTR-HDFC-9912001"
              value={receiptForm.referenceNo}
              onChange={(e) => setReceiptForm({ ...receiptForm, referenceNo: e.target.value })}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Narration / Notes</label>
            <input
              type="text"
              placeholder="e.g. Inward payment for project advance"
              value={receiptForm.narration}
              onChange={(e) => setReceiptForm({ ...receiptForm, narration: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsRecordModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Receipt & Post GL'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Allocate Receipt Modal */}
      {allocateReceipt && (
        <Modal
          isOpen={Boolean(allocateReceipt)}
          onClose={() => setAllocateReceipt(null)}
          title={`Allocate Receipt ${allocateReceipt.paymentReceiptNo}`}
          maxWidth="520px"
        >
          <form onSubmit={handleExecuteAllocation} className={styles.modalForm}>
            <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
              <div>Customer: <b>{allocateReceipt.customer?.companyName}</b></div>
              <div>Available Unallocated: <b style={{ color: '#0369a1' }}>₹ {Number(allocateReceipt.unallocatedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</b></div>
            </div>

            <div className={styles.formGroup}>
              <label>Select Sales Invoice to Settle *</label>
              <select
                value={allocForm.invoiceId}
                onChange={(e) => {
                  const inv = invoices.find((i) => i.id === e.target.value);
                  const maxAlloc = Math.min(
                    Number(allocateReceipt.unallocatedAmount || 0),
                    Number(inv?.outstandingAmount || 0)
                  );
                  setAllocForm({
                    invoiceId: e.target.value,
                    amount: maxAlloc > 0 ? maxAlloc : Number(allocateReceipt.unallocatedAmount),
                  });
                }}
                required
              >
                <option value="">Select Posted Invoice...</option>
                {invoices
                  .filter((i) => (i.customerId === allocateReceipt.customerId || i.customer?.id === allocateReceipt.customerId) && Number(i.outstandingAmount || 0) > 0)
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNo} — Outstanding: ₹{Number(inv.outstandingAmount).toLocaleString('en-IN')} (Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : 'N/A'})
                    </option>
                  ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Allocation Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={Number(allocateReceipt.unallocatedAmount)}
                value={allocForm.amount}
                onChange={(e) => setAllocForm({ ...allocForm, amount: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
              <button type="button" className={styles.secondary} onClick={() => setAllocateReceipt(null)}>
                Cancel
              </button>
              <button type="submit" className={styles.primary} disabled={submitting}>
                {submitting ? 'Allocating...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Reversal Dialog */}
      <ConfirmDialog
        isOpen={Boolean(reverseAllocId)}
        onClose={() => setReverseAllocId(null)}
        onConfirm={handleReverseAllocation}
        title="Reverse Payment Allocation?"
        message="Reversing this allocation will restore the unallocated amount on the customer receipt and reopen the invoice outstanding balance. Reversing vouchers will be posted."
        confirmLabel="Yes, Reverse Allocation"
        isDanger={true}
      />
    </div>
  );
}

