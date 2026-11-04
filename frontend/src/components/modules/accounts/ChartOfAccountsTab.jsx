'use client';

import { useState, useMemo } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import { api } from '../../../lib/api';

export default function ChartOfAccountsTab({
  accounts = [],
  groups = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    accountCode: '',
    accountName: '',
    groupId: '',
    normalBalance: 'DEBIT',
    isControlAccount: false,
    controlType: '',
    openingBalance: '0',
  });

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchCat = !categoryFilter || acc.category === categoryFilter || acc.group?.category === categoryFilter;
      const matchSearch =
        !searchTerm ||
        acc.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.accountCode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [accounts, categoryFilter, searchTerm]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!form.accountCode || !form.accountName || !form.groupId) {
      showToast('Please fill all required account fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/companies/${companyId}/accounting/accounts`, {
        accountCode: form.accountCode.trim(),
        accountName: form.accountName.trim(),
        groupId: form.groupId,
        normalBalance: form.normalBalance,
        isControlAccount: form.isControlAccount,
        controlType: form.controlType ? form.controlType.trim() : null,
        openingBalance: Number(form.openingBalance || 0),
      });

      showToast('Account created successfully in Chart of Accounts.');
      setIsCreateModalOpen(false);
      setForm({
        accountCode: '',
        accountName: '',
        groupId: '',
        normalBalance: 'DEBIT',
        isControlAccount: false,
        controlType: '',
        openingBalance: '0',
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create account.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header & Filter Bar */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Chart of Accounts &amp; General Ledgers</h3>
          <p>Double-entry classification, asset/liability nature, and control accounts.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsCreateModalOpen(true)}>
            + New Ledger Account
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <input
          type="text"
          className={styles.filterInput}
          placeholder="Search by code or account name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ minWidth: '220px' }}
        />

        <select
          className={styles.filterSelect}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="ASSET">Assets</option>
          <option value="LIABILITY">Liabilities</option>
          <option value="EQUITY">Equity</option>
          <option value="INCOME">Income / Revenue</option>
          <option value="EXPENSE">Expenses</option>
        </select>

        {(searchTerm || categoryFilter) && (
          <button
            className={styles.filterReset}
            onClick={() => {
              setSearchTerm('');
              setCategoryFilter('');
            }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Accounts Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Account Code</th>
              <th>Account Name</th>
              <th>Account Group</th>
              <th>Category</th>
              <th>Normal Balance</th>
              <th>Control Account</th>
              <th>Current Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No ledger accounts match the criteria.
                </td>
              </tr>
            ) : (
              filteredAccounts.map((acc) => (
                <tr key={acc.id}>
                  <td style={{ fontWeight: 800, color: '#7f22fe' }}>{acc.accountCode}</td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{acc.accountName}</td>
                  <td>{acc.group?.groupName || acc.accountGroup?.groupName || 'Primary Group'}</td>
                  <td>
                    <span className={styles.badge + ' ' + (
                      (acc.category || acc.group?.category) === 'ASSET' ? styles.badgeBlue :
                      (acc.category || acc.group?.category) === 'LIABILITY' ? styles.badgeAmber :
                      (acc.category || acc.group?.category) === 'INCOME' ? styles.badgeGreen :
                      styles.badgePurple
                    )}>
                      {acc.category || acc.group?.category || 'ASSET'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: acc.normalBalance === 'DEBIT' ? '#0369a1' : '#b45309' }}>
                      {acc.normalBalance}
                    </span>
                  </td>
                  <td>
                    {acc.isControlAccount ? (
                      <span className={styles.badge + ' ' + styles.badgeAmber}>
                        {acc.controlType || 'CONTROL'}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>No</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 800 }}>
                    ₹ {Number(acc.currentBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={styles.badge + ' ' + (acc.status === 'ACTIVE' ? styles.badgeGreen : styles.badgeGray)}>
                      {acc.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Account Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create General Ledger Account"
        maxWidth="560px"
      >
        <form onSubmit={handleCreateAccount} className={styles.modalForm}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Account Code *</label>
              <input
                type="text"
                placeholder="e.g. 1140-BANK-ICICI"
                value={form.accountCode}
                onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Account Name *</label>
              <input
                type="text"
                placeholder="e.g. ICICI Corporate Current A/c"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                required
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Parent Account Group *</label>
              <select
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                required
              >
                <option value="">Select Account Group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.groupName} ({g.category})
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Normal Balance Nature *</label>
              <select
                value={form.normalBalance}
                onChange={(e) => setForm({ ...form, normalBalance: e.target.value })}
                required
              >
                <option value="DEBIT">DEBIT (Assets, Expenses)</option>
                <option value="CREDIT">CREDIT (Liabilities, Income, Equity)</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.isControlAccount}
                  onChange={(e) => setForm({ ...form, isControlAccount: e.target.checked })}
                />
                Is Control Subledger Account (e.g. Debtors, Creditors)
              </label>
            </div>
            {form.isControlAccount && (
              <div className={styles.formGroup}>
                <label>Control Type</label>
                <select
                  value={form.controlType}
                  onChange={(e) => setForm({ ...form, controlType: e.target.value })}
                >
                  <option value="">Select Control Type...</option>
                  <option value="SUNDRY_DEBTORS">Sundry Debtors (Customer Subledger)</option>
                  <option value="SUNDRY_CREDITORS">Sundry Creditors (Vendor Subledger)</option>
                  <option value="BANK">Bank Account</option>
                  <option value="CASH">Cash Account</option>
                  <option value="DUTIES_TAXES">Duties &amp; Taxes</option>
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Creating...' : 'Save Ledger Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

