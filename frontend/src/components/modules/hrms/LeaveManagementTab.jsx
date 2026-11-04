'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function LeaveManagementTab({ companyId, toast, userRole }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    isHalfDay: false,
    halfDaySession: 'FIRST_HALF',
    reason: '',
  });

  const loadInitialData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [empRes, typeRes] = await Promise.all([
        api.get(`/companies/${companyId}/hrms/employees?limit=100`),
        api.get(`/companies/${companyId}/hrms/leaves/types`),
      ]);

      if (empRes?.success) {
        const emps = empRes.data.items || [];
        setEmployees(emps);
        if (emps.length > 0 && !selectedEmpId) {
          setSelectedEmpId(emps[0].id);
        }
      }
      if (typeRes?.success) {
        setLeaveTypes(typeRes.data || []);
        if (typeRes.data?.length > 0 && !applyForm.leaveTypeId) {
          setApplyForm((f) => ({ ...f, leaveTypeId: typeRes.data[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmpId, applyForm.leaveTypeId]);

  const loadBalancesAndRequests = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const reqQuery = selectedEmpId ? `?employeeProfileId=${selectedEmpId}` : '';
      const [balRes, reqRes] = await Promise.all([
        selectedEmpId ? api.get(`/companies/${companyId}/hrms/employees/${selectedEmpId}/leaves/balances`) : Promise.resolve(null),
        api.get(`/companies/${companyId}/hrms/leaves/requests${reqQuery}`),
      ]);

      if (balRes?.success) {
        setBalances(balRes.data || []);
      }
      if (reqRes?.success) {
        setRequests(reqRes.data || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load leave records', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmpId, toast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedEmpId) {
      loadBalancesAndRequests();
    }
  }, [selectedEmpId, loadBalancesAndRequests]);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!selectedEmpId || !applyForm.leaveTypeId || !applyForm.reason) {
      toast('Please select employee, leave type and provide reason', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/leaves/requests`, {
        ...applyForm,
        employeeProfileId: selectedEmpId,
      });

      if (res?.success) {
        toast('Leave application submitted for approval');
        setShowApplyModal(false);
        setApplyForm({
          leaveTypeId: leaveTypes[0]?.id || '',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          isHalfDay: false,
          halfDaySession: 'FIRST_HALF',
          reason: '',
        });
        loadBalancesAndRequests();
      }
    } catch (err) {
      toast(err.message || 'Failed to apply leave', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/leaves/requests/${requestId}/approve`);
      if (res?.success) {
        toast('Leave approved & balance deducted');
        loadBalancesAndRequests();
      }
    } catch (err) {
      toast(err.message || 'Approval failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/leaves/requests/${requestId}/reject`, { reason });
      if (res?.success) {
        toast('Leave request rejected');
        loadBalancesAndRequests();
      }
    } catch (err) {
      toast(err.message || 'Rejection failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!confirm('Cancel this leave request? If already approved, deducted balance will be restored.')) return;
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/leaves/requests/${requestId}/cancel`);
      if (res?.success) {
        toast('Leave cancelled & balance restored');
        loadBalancesAndRequests();
      }
    } catch (err) {
      toast(err.message || 'Cancellation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Leave Management & Balance Ledger</h2>
          <p>Annual leave entitlements, multi-day/half-day applications and approval tracking</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowApplyModal(true)}>
          + Apply for Leave
        </button>
      </div>

      <div className={styles.filterBar} style={{ marginTop: '1rem' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Select Employee:</label>
        <select
          className={styles.selectInput}
          style={{ minWidth: '260px' }}
          value={selectedEmpId}
          onChange={(e) => setSelectedEmpId(e.target.value)}
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.displayName} ({e.employeeCode})
            </option>
          ))}
        </select>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadBalancesAndRequests}>
          Refresh
        </button>
      </div>

      {/* Leave Balances Grid */}
      {balances.length > 0 && (
        <div className={styles.statGrid}>
          {balances.map((b) => (
            <div key={b.id} className={styles.statCard}>
              <div className={styles.metricTitle}>{b.leaveType?.name || 'Leave'} ({b.year})</div>
              <div className={styles.metricValue}>{Number(b.currentBalance).toFixed(1)} Days</div>
              <div className={styles.metricSub}>
                Opening: {Number(b.openingBalance)} | Used: {Number(b.used)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leave Applications Table */}
      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.25rem 0 0.5rem' }}>Leave Applications & History</h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Duration</th>
              <th>Days</th>
              <th>Session</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No leave applications recorded.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.profile?.displayName}</td>
                  <td style={{ fontWeight: 'bold' }}>{r.leaveType?.name}</td>
                  <td>
                    {new Date(r.startDate).toLocaleDateString()} to {new Date(r.endDate).toLocaleDateString()}
                  </td>
                  <td>{Number(r.daysCount)} days</td>
                  <td>{r.isHalfDay ? r.halfDaySession || 'HALF_DAY' : 'Full Day'}</td>
                  <td>{r.reason}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        r.status === 'APPROVED'
                          ? styles.badgeSuccess
                          : r.status === 'REJECTED'
                          ? styles.badgeDanger
                          : r.status === 'CANCELLED'
                          ? styles.badgeNeutral
                          : styles.badgeWarning
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {userRole !== 'EMPLOYEE' && r.status === 'PENDING' && (
                        <>
                          <button
                            className={`${styles.btn} ${styles.btnSuccess}`}
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                            onClick={() => handleApprove(r.id)}
                          >
                            Approve
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnDanger}`}
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                            onClick={() => handleReject(r.id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(r.status === 'PENDING' || r.status === 'APPROVED') && (
                        <button
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: '#dc2626' }}
                          onClick={() => handleCancel(r.id)}
                        >
                          Cancel
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

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <Modal isOpen={showApplyModal} onClose={() => setShowApplyModal(false)} title="Apply for Leave">
          <form onSubmit={handleApplyLeave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Applicant Employee *</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                required
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.displayName} ({e.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Leave Category *</label>
              <select
                value={applyForm.leaveTypeId}
                onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                required
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.isPaid ? 'Paid' : 'Unpaid'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>From Date *</label>
                <input
                  type="date"
                  required
                  value={applyForm.startDate}
                  onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>To Date *</label>
                <input
                  type="date"
                  required
                  value={applyForm.endDate}
                  onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={applyForm.isHalfDay}
                onChange={(e) => setApplyForm({ ...applyForm, isHalfDay: e.target.checked })}
              />
              Half-Day Leave
            </label>

            {applyForm.isHalfDay && (
              <div className={styles.formGroup}>
                <label>Half-Day Session</label>
                <select
                  value={applyForm.halfDaySession}
                  onChange={(e) => setApplyForm({ ...applyForm, halfDaySession: e.target.value })}
                >
                  <option value="FIRST_HALF">First Half (Morning)</option>
                  <option value="SECOND_HALF">Second Half (Afternoon)</option>
                </select>
              </div>
            )}

            <div className={styles.formGroup}>
              <label>Reason *</label>
              <textarea
                rows={3}
                required
                placeholder="State the reason for leave..."
                value={applyForm.reason}
                onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowApplyModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

