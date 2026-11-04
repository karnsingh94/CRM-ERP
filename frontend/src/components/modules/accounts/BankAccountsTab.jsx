'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import { api } from '../../../lib/api';

export default function BankAccountsTab({
  bankAccounts = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedBankBook, setSelectedBankBook] = useState(null);
  const [bankBookLoading, setBankBookLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    accountType: 'CURRENT',
    openingBalance: '0',
    overdraftLimit: '0',
    isDefault: false,
  });

  const [dateRange, setDateRange] = useState({
    fromDate: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
  });

  const handleCreateBankAccount = async (e) => {
    e.preventDefault();
    if (!form.bankName || !form.accountHolderName || !form.accountNumber || !form.ifscCode) {
      showToast('Please fill all mandatory bank account fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/bank-accounts`, {
        bankName: form.bankName.trim(),
        accountHolderName: form.accountHolderName.trim(),
        accountNumber: form.accountNumber.trim(),
        ifscCode: form.ifscCode.trim().toUpperCase(),
        branchName: form.branchName ? form.branchName.trim() : null,
        accountType: form.accountType,
        openingBalance: Number(form.openingBalance || 0),
        overdraftLimit: Number(form.overdraftLimit || 0),
        isDefault: Boolean(form.isDefault),
      });

      showToast('Bank Account created and linked to standard BANK ledger.');
      setIsCreateModalOpen(false);
      setForm({
        bankName: '',
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        branchName: '',
        accountType: 'CURRENT',
        openingBalance: '0',
        overdraftLimit: '0',
        isDefault: false,
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create bank account.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenBankBook = async (bankAccount) => {
    try {
      setBankBookLoading(true);
      const res = await api.get(
        `/companies/${companyId}/accounting/reports/bank-book/${bankAccount.id}?fromDate=${dateRange.fromDate}&toDate=${dateRange.toDate}`
      );
      setSelectedBankBook({
        bankAccount,
        data: res?.data || res || {},
      });
    } catch (err) {
      showToast(err.message || 'Failed to load Bank Book statement.', 'error');
    } finally {
      setBankBookLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Bank Account Management &amp; Bank Book</h3>
          <p>Commercial bank accounts, cash registers, running balances, and GL statements.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsCreateModalOpen(true)}>
            + Add Bank Account
          </button>
        </div>
      </div>

      {/* Bank Accounts Grid */}
      <div className={styles.cardGrid}>
        {bankAccounts.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
            No commercial bank accounts added yet. Click &quot;Add Bank Account&quot; to begin.
          </div>
        ) : (
          bankAccounts.map((b) => (
            <div key={b.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h4 className={styles.cardTitle}>{b.bankName}</h4>
                  <p className={styles.cardSubtitle}>
                    {b.accountType} A/C &bull; {b.maskedAccountNumber || b.accountNumber}
                  </p>
                </div>
                {b.isDefault && (
                  <span className={styles.badge + ' ' + styles.badgePurple}>PRIMARY</span>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <small style={{ color: '#64748b', fontSize: '0.72rem' }}>Statement Balance</small>
                <div style={{ fontSize: '1.25rem', fontWeight: 850, color: '#0f172a' }}>
                  ₹ {Number(b.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.74rem', color: '#475569' }}>
                <div>Holder: <b>{b.accountHolderName}</b></div>
                <div>IFSC: <b>{b.ifscCode}</b> {b.branchName ? `(${b.branchName})` : ''}</div>
                <div>Linked GL: <b style={{ color: '#7f22fe' }}>{b.ledgerAccount?.accountName || '1120-MAIN-BANK'}</b></div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '0.45rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button
                  className={styles.secondary}
                  onClick={() => handleOpenBankBook(b)}
                  disabled={bankBookLoading}
                >
                  📖 View Bank Book
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Bank Account Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Add Commercial Bank Account"
        maxWidth="560px"
      >
        <form onSubmit={handleCreateBankAccount} className={styles.modalForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Bank Name *</label>
              <input
                type="text"
                placeholder="e.g. HDFC Bank Ltd"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Account Holder Name *</label>
              <input
                type="text"
                placeholder="e.g. Azzuniqe Energy Pvt Ltd"
                value={form.accountHolderName}
                onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Account Number *</label>
              <input
                type="text"
                placeholder="e.g. 50200012345678"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>IFSC Code *</label>
              <input
                type="text"
                placeholder="e.g. HDFC0001234"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Branch Name</label>
              <input
                type="text"
                placeholder="e.g. C-Scheme Branch, Jaipur"
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Account Type *</label>
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                required
              >
                <option value="CURRENT">CURRENT</option>
                <option value="SAVINGS">SAVINGS</option>
                <option value="OVERDRAFT">OVERDRAFT / CC</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Opening Statement Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Overdraft Limit (₹)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.overdraftLimit}
                onChange={(e) => setForm({ ...form, overdraftLimit: e.target.value })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Set as Default / Primary Bank Account for the company
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button type="button" className={styles.secondary} onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Creating...' : 'Save Bank Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bank Book Statement Modal */}
      {selectedBankBook && (
        <Modal
          isOpen={Boolean(selectedBankBook)}
          onClose={() => setSelectedBankBook(null)}
          title={`Bank Book: ${selectedBankBook.bankAccount.bankName} (${selectedBankBook.bankAccount.maskedAccountNumber})`}
          maxWidth="840px"
        >
          <div className={styles.docPreview}>
            <div className={styles.docHeader}>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a' }}>{selectedBankBook.bankAccount.bankName}</h4>
                <p style={{ margin: '2px 0', color: '#64748b' }}>
                  Ledger Statement: {selectedBankBook.data.ledgerAccountCode} — {selectedBankBook.data.ledgerAccountName}
                </p>
                <small style={{ color: '#64748b' }}>
                  Period: {new Date(dateRange.fromDate).toLocaleDateString('en-IN')} to {new Date(dateRange.toDate).toLocaleDateString('en-IN')}
                </small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p>Opening Balance: <b>₹ {Number(selectedBankBook.data.openingBalance || 0).toFixed(2)}</b></p>
                <p>Closing Balance: <b style={{ color: '#7f22fe' }}>₹ {Number(selectedBankBook.data.closingBalance || 0).toFixed(2)}</b></p>
              </div>
            </div>

            <table className={styles.table} style={{ border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher No</th>
                  <th>Type</th>
                  <th>Contra Ledger</th>
                  <th>Particulars</th>
                  <th>Debit (Inflow)</th>
                  <th>Credit (Outflow)</th>
                  <th>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {(!selectedBankBook.data.transactions || selectedBankBook.data.transactions.length === 0) ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                      No transactions recorded in the Bank Book for this period.
                    </td>
                  </tr>
                ) : (
                  selectedBankBook.data.transactions.map((tx, idx) => (
                    <tr key={idx}>
                      <td>{new Date(tx.voucherDate).toLocaleDateString('en-IN')}</td>
                      <td style={{ fontWeight: 700, color: '#7f22fe' }}>{tx.voucherNo}</td>
                      <td><span className={styles.badge + ' ' + styles.badgeBlue}>{tx.voucherType}</span></td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.contraLedger}
                      </td>
                      <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.narration || '—'}
                      </td>
                      <td>{Number(tx.debitAmount || 0) > 0 ? `₹ ${Number(tx.debitAmount).toFixed(2)}` : '—'}</td>
                      <td>{Number(tx.creditAmount || 0) > 0 ? `₹ ${Number(tx.creditAmount).toFixed(2)}` : '—'}</td>
                      <td style={{ fontWeight: 800 }}>₹ {Number(tx.runningBalance || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className={styles.secondary} onClick={() => window.print()}>
                🖨️ Print Bank Book
              </button>
              <button className={styles.primary} onClick={() => setSelectedBankBook(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

