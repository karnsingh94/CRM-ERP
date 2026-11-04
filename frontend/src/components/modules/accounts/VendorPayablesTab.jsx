'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import { api } from '../../../lib/api';

export default function VendorPayablesTab({
  bills = [],
  vendors = [],
  bankAccounts = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDebitNoteModalOpen, setIsDebitNoteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for Payment
  const [payForm, setPayForm] = useState({
    vendorId: '',
    billId: '',
    amount: '',
    paymentMode: 'BANK',
    bankAccountId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    referenceNo: '',
    narration: '',
  });

  // Form State for Debit Note
  const [dnForm, setDnForm] = useState({
    vendorId: '',
    billId: '',
    amount: '',
    taxRate: '18',
    reason: 'Purchase return / Price revision',
  });

  const filteredBills = bills.filter((b) => {
    return (
      !searchTerm ||
      b.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!payForm.vendorId || !payForm.amount || Number(payForm.amount) <= 0) {
      showToast('Please select vendor and valid payment amount.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/vendor-payables/payments`, {
        vendorId: payForm.vendorId,
        billId: payForm.billId || null,
        amount: Number(payForm.amount),
        paymentMode: payForm.paymentMode,
        bankAccountId: payForm.paymentMode === 'BANK' ? payForm.bankAccountId : null,
        paymentDate: payForm.paymentDate,
        referenceNo: payForm.referenceNo,
        narration: payForm.narration,
      });

      showToast('Vendor payment recorded and double-entry voucher posted.');
      setIsPaymentModalOpen(false);
      setPayForm({
        vendorId: '',
        billId: '',
        amount: '',
        paymentMode: 'BANK',
        bankAccountId: '',
        paymentDate: new Date().toISOString().slice(0, 10),
        referenceNo: '',
        narration: '',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to record vendor payment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDebitNote = async (e) => {
    e.preventDefault();
    if (!dnForm.vendorId || !dnForm.amount || Number(dnForm.amount) <= 0) {
      showToast('Please select vendor and valid debit note amount.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/vendor-payables/debit-notes`, {
        vendorId: dnForm.vendorId,
        purchaseBillId: dnForm.billId || null,
        taxableAmount: Number(dnForm.amount),
        taxRate: Number(dnForm.taxRate),
        reason: dnForm.reason,
      });

      showToast('Vendor debit note created and GL adjustment voucher posted.');
      setIsDebitNoteModalOpen(false);
      setDnForm({
        vendorId: '',
        billId: '',
        amount: '',
        taxRate: '18',
        reason: 'Purchase return / Price revision',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create debit note.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Vendor Payables, Bills &amp; Debit Notes</h3>
          <p>Track vendor obligations, three-way bill matches, payment holds, and debit notes.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.secondary} onClick={() => setIsDebitNoteModalOpen(true)}>
            + Vendor Debit Note
          </button>
          <button className={styles.primary} onClick={() => setIsPaymentModalOpen(true)}>
            + Record Vendor Payment
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by bill number, vendor..."
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

      {/* Bills Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Bill Number</th>
              <th>Vendor</th>
              <th>Bill Date</th>
              <th>Due Date</th>
              <th>Total Bill Amount</th>
              <th>Outstanding</th>
              <th>Hold Status</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No vendor bills / purchase bills found.
                </td>
              </tr>
            ) : (
              filteredBills.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{b.billNumber}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{b.vendor?.name || b.vendorName || 'Supplier'}</td>
                  <td>{new Date(b.billDate).toLocaleDateString('en-IN')}</td>
                  <td>{b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td style={{ fontWeight: 700 }}>₹ {Number(b.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ fontWeight: 800, color: Number(b.outstandingAmount || 0) > 0 ? '#b91c1c' : '#15803d' }}>
                    ₹ {Number(b.outstandingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    {b.isPaymentHold ? (
                      <span className={styles.badge + ' ' + styles.badgeRed}>🛑 ON HOLD</span>
                    ) : (
                      <span className={styles.badge + ' ' + styles.badgeGreen}>CLEAR</span>
                    )}
                  </td>
                  <td>
                    <span className={styles.badge + ' ' + (b.status === 'PAID' ? styles.badgeGreen : b.status === 'POSTED' ? styles.badgeBlue : styles.badgeAmber)}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      {Number(b.outstandingAmount || 0) > 0 && !b.isPaymentHold && (
                        <button
                          className={styles.primary}
                          onClick={() => {
                            setPayForm({
                              ...payForm,
                              vendorId: b.vendorId,
                              billId: b.id,
                              amount: Number(b.outstandingAmount),
                            });
                            setIsPaymentModalOpen(true);
                          }}
                        >
                          Pay Bill
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

      {/* Record Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Record Vendor Payment / Outflow"
        maxWidth="540px"
      >
        <form onSubmit={handleRecordPayment} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Vendor *</label>
            <select
              value={payForm.vendorId}
              onChange={(e) => setPayForm({ ...payForm, vendorId: e.target.value })}
              required
            >
              <option value="">Select Vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Payment Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Payment Date *</label>
              <input
                type="date"
                value={payForm.paymentDate}
                onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Payment Mode *</label>
              <select
                value={payForm.paymentMode}
                onChange={(e) => setPayForm({ ...payForm, paymentMode: e.target.value })}
                required
              >
                <option value="BANK">Bank Transfer / NEFT / RTGS</option>
                <option value="CASH">Cash Payment</option>
              </select>
            </div>
            {payForm.paymentMode === 'BANK' && (
              <div className={styles.formGroup}>
                <label>Paying Bank Account *</label>
                <select
                  value={payForm.bankAccountId}
                  onChange={(e) => setPayForm({ ...payForm, bankAccountId: e.target.value })}
                  required
                >
                  <option value="">Select Bank Account...</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({b.maskedAccountNumber}) — ₹{Number(b.currentBalance || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label>Reference No (UTR / Cheque No)</label>
            <input
              type="text"
              placeholder="e.g. UTR-NEFT-9912001"
              value={payForm.referenceNo}
              onChange={(e) => setPayForm({ ...payForm, referenceNo: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsPaymentModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment & Post GL'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Debit Note Modal */}
      <Modal
        isOpen={isDebitNoteModalOpen}
        onClose={() => setIsDebitNoteModalOpen(false)}
        title="Create Vendor Debit Note"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateDebitNote} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Vendor *</label>
            <select
              value={dnForm.vendorId}
              onChange={(e) => setDnForm({ ...dnForm, vendorId: e.target.value })}
              required
            >
              <option value="">Select Vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Taxable Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={dnForm.amount}
                onChange={(e) => setDnForm({ ...dnForm, amount: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>GST Rate *</label>
              <select
                value={dnForm.taxRate}
                onChange={(e) => setDnForm({ ...dnForm, taxRate: e.target.value })}
                required
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Reason / Narration *</label>
            <textarea
              rows="3"
              value={dnForm.reason}
              onChange={(e) => setDnForm({ ...dnForm, reason: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsDebitNoteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create & Post Debit Note'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

