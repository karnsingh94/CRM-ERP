'use client';

import { useState } from 'react';
import styles from '../AccountsModule.module.css';
import Modal from '../../ui/Modal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { api } from '../../../lib/api';

export default function FinancialPeriodsTab({
  financialYears = [],
  companyId,
  onRefresh,
  showToast,
}) {
  const [isCreateFyModalOpen, setIsCreateFyModalOpen] = useState(false);
  const [selectedFyId, setSelectedFyId] = useState(financialYears[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  // Close/Reopen Confirm State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    periodId: null,
    action: null,
    periodName: '',
  });

  const [fyForm, setFyForm] = useState({
    name: '',
    code: '',
    startDate: '',
    endDate: '',
  });

  const currentFy = financialYears.find((f) => f.id === selectedFyId) || financialYears[0];

  const handleCreateFy = async (e) => {
    e.preventDefault();
    if (!fyForm.name || !fyForm.code || !fyForm.startDate || !fyForm.endDate) {
      showToast('Please provide all Financial Year fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/companies/${companyId}/accounting/financial-years`, {
        name: fyForm.name.trim(),
        code: fyForm.code.trim(),
        startDate: fyForm.startDate,
        endDate: fyForm.endDate,
      });

      // Auto-generate 12 monthly periods
      if (res?.data?.id) {
        await api.post(`/companies/${companyId}/accounting/financial-years/${res.data.id}/generate-periods`, {});
      }

      showToast('Financial Year & standard periods created successfully.');
      setIsCreateFyModalOpen(false);
      setFyForm({ name: '', code: '', startDate: '', endDate: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Failed to create financial year.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePeriodAction = async () => {
    const { periodId, action } = confirmDialog;
    if (!periodId || !action) return;

    try {
      setSubmitting(true);
      if (action === 'close') {
        await api.post(`/companies/${companyId}/accounting/periods/${periodId}/close`, {
          reason: 'Month-end accounts reconciliation closed',
        });
        showToast('Accounting period closed successfully. New postings restricted.');
      } else {
        await api.post(`/companies/${companyId}/accounting/periods/${periodId}/reopen`, {
          reason: 'Authorized audit adjustment reopening',
        });
        showToast('Accounting period reopened for adjustment postings.');
      }
      setConfirmDialog({ isOpen: false, periodId: null, action: null, periodName: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast(err.message || 'Period action failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div className={styles.sectionHeader}>
        <div>
          <h3>Financial Years &amp; Accounting Periods</h3>
          <p>Control financial period locks, prevent backdated entries, and manage period states.</p>
        </div>
        <div className={styles.quickActions}>
          <button className={styles.primary} onClick={() => setIsCreateFyModalOpen(true)}>
            + New Financial Year
          </button>
        </div>
      </div>

      {/* FY Selector & Overview */}
      <div className={styles.filterBar} style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 750, color: '#334155' }}>Select Financial Year:</label>
          <select
            className={styles.filterSelect}
            value={selectedFyId}
            onChange={(e) => setSelectedFyId(e.target.value)}
          >
            {financialYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name} ({fy.code}) {fy.isCurrent ? '— [CURRENT FY]' : ''}
              </option>
            ))}
          </select>
        </div>

        {currentFy && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className={styles.badge + ' ' + (currentFy.isLocked ? styles.badgeRed : styles.badgeGreen)}>
              {currentFy.isLocked ? '🔒 FY LOCKED' : '🔓 ACTIVE FY'}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              {new Date(currentFy.startDate).toLocaleDateString('en-IN')} to {new Date(currentFy.endDate).toLocaleDateString('en-IN')}
            </span>
          </div>
        )}
      </div>

      {/* Monthly Periods Table */}
      <div className={styles.tableWrap}>
        <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
            Monthly Periods for {currentFy?.name || 'Selected Year'}
          </strong>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Period Name</th>
              <th>Period Code</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Closed By / At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!currentFy?.periods || currentFy.periods.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No monthly accounting periods generated for this Financial Year.
                </td>
              </tr>
            ) : (
              currentFy.periods.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 800, color: '#0f172a' }}>{p.name}</td>
                  <td style={{ color: '#7f22fe', fontWeight: 700 }}>{p.code}</td>
                  <td>{new Date(p.startDate).toLocaleDateString('en-IN')}</td>
                  <td>{new Date(p.endDate).toLocaleDateString('en-IN')}</td>
                  <td>
                    <span className={styles.badge + ' ' + (p.status === 'OPEN' ? styles.badgeGreen : styles.badgeRed)}>
                      {p.status === 'OPEN' ? '🟢 OPEN' : '🔒 CLOSED'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {p.closedAt ? `${new Date(p.closedAt).toLocaleDateString('en-IN')} (${p.closedByName || 'Officer'})` : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.actions} style={{ justifyContent: 'flex-end' }}>
                      {p.status === 'OPEN' ? (
                        <button
                          className={styles.danger}
                          onClick={() =>
                            setConfirmDialog({
                              isOpen: true,
                              periodId: p.id,
                              action: 'close',
                              periodName: p.name,
                            })
                          }
                        >
                          Close Period
                        </button>
                      ) : (
                        <button
                          className={styles.secondary}
                          onClick={() =>
                            setConfirmDialog({
                              isOpen: true,
                              periodId: p.id,
                              action: 'reopen',
                              periodName: p.name,
                            })
                          }
                        >
                          Reopen Period
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

      {/* Create Financial Year Modal */}
      <Modal
        isOpen={isCreateFyModalOpen}
        onClose={() => setIsCreateFyModalOpen(false)}
        title="Create New Financial Year"
        maxWidth="500px"
      >
        <form onSubmit={handleCreateFy} className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label>Financial Year Name *</label>
            <input
              type="text"
              placeholder="e.g. FY 2026-27"
              value={fyForm.name}
              onChange={(e) => setFyForm({ ...fyForm, name: e.target.value })}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>FY Code *</label>
            <input
              type="text"
              placeholder="e.g. FY2627"
              value={fyForm.code}
              onChange={(e) => setFyForm({ ...fyForm, code: e.target.value })}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Start Date *</label>
              <input
                type="date"
                value={fyForm.startDate}
                onChange={(e) => setFyForm({ ...fyForm, startDate: e.target.value })}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>End Date *</label>
              <input
                type="date"
                value={fyForm.endDate}
                onChange={(e) => setFyForm({ ...fyForm, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1rem' }}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setIsCreateFyModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={submitting}>
              {submitting ? 'Creating...' : 'Save & Generate Periods'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Action Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, periodId: null, action: null, periodName: '' })}
        onConfirm={handlePeriodAction}
        title={confirmDialog.action === 'close' ? 'Close Accounting Period?' : 'Reopen Accounting Period?'}
        message={
          confirmDialog.action === 'close'
            ? `Are you sure you want to CLOSE "${confirmDialog.periodName}"? Once closed, new transactions, invoices, and vouchers cannot be posted to this period without authorized reopening.`
            : `Are you sure you want to REOPEN "${confirmDialog.periodName}"? Reopening will permit backdated postings and adjustments with an audit trail entry.`
        }
        confirmLabel={confirmDialog.action === 'close' ? 'Yes, Close Period' : 'Yes, Reopen Period'}
        isDanger={confirmDialog.action === 'close'}
      />
    </div>
  );
}

