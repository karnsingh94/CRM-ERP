'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function AttendanceTab({ companyId, toast, userRole }) {
  const [attendances, setAttendances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  // Regularization modal
  const [showRegModal, setShowRegModal] = useState(false);
  const [regForm, setRegForm] = useState({
    employeeProfileId: '',
    attendanceDate: new Date().toISOString().split('T')[0],
    requestedInTime: '',
    requestedOutTime: '',
    reason: '',
  });

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/hrms/employees?limit=100`);
      if (res?.success) {
        setEmployees(res.data.items || []);
        if (res.data.items?.length > 0 && !regForm.employeeProfileId) {
          setRegForm((f) => ({ ...f, employeeProfileId: res.data.items[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [companyId, regForm.employeeProfileId]);

  const loadAttendance = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const query = new URLSearchParams({
        ...(selectedEmpId ? { employeeProfileId: selectedEmpId } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      }).toString();

      const res = await api.get(`/companies/${companyId}/hrms/attendance?${query}`);
      if (res?.success) {
        setAttendances(res.data.items || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load attendance', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmpId, startDate, endDate, toast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const handleCheckIn = async (employeeProfileId) => {
    if (!employeeProfileId) {
      toast('Select an employee profile first', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/attendance/check-in`, {
        employeeProfileId,
        source: 'WEB_PORTAL',
      });
      if (res?.success) {
        toast('Check-in recorded successfully');
        loadAttendance();
      }
    } catch (err) {
      toast(err.message || 'Check-in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (employeeProfileId) => {
    if (!employeeProfileId) {
      toast('Select an employee profile first', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/attendance/check-out`, {
        employeeProfileId,
        source: 'WEB_PORTAL',
      });
      if (res?.success) {
        toast('Check-out recorded successfully');
        loadAttendance();
      }
    } catch (err) {
      toast(err.message || 'Check-out failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegularizeSubmit = async (e) => {
    e.preventDefault();
    if (!regForm.employeeProfileId || !regForm.reason) {
      toast('Employee and reason are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/attendance/regularize`, regForm);
      if (res?.success) {
        toast('Regularization request submitted to approval engine');
        setShowRegModal(false);
        setRegForm({
          employeeProfileId: employees[0]?.id || '',
          attendanceDate: new Date().toISOString().split('T')[0],
          requestedInTime: '',
          requestedOutTime: '',
          reason: '',
        });
        loadAttendance();
      }
    } catch (err) {
      toast(err.message || 'Failed to submit regularization', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Daily Attendance Register & Punch Tracking</h2>
          <p>Real-time check-in/out, work hours, overtime, and regularization requests</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setShowRegModal(true)}
          >
            Request Regularization
          </button>
        </div>
      </div>

      {/* Quick Web Check-In Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginTop: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 'bold' }}>Quick Web Punch:</span>
        <select
          className={styles.selectInput}
          value={selectedEmpId}
          onChange={(e) => setSelectedEmpId(e.target.value)}
        >
          <option value="">Select Employee...</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.displayName} ({e.employeeCode})
            </option>
          ))}
        </select>
        <button
          className={`${styles.btn} ${styles.btnSuccess}`}
          disabled={!selectedEmpId || loading}
          onClick={() => handleCheckIn(selectedEmpId)}
        >
          ⏱️ Punch IN
        </button>
        <button
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={!selectedEmpId || loading}
          onClick={() => handleCheckOut(selectedEmpId)}
        >
          ⏱️ Punch OUT
        </button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar} style={{ marginTop: '1rem' }}>
        <input
          type="date"
          className={styles.selectInput}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          className={styles.selectInput}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadAttendance}>
          Filter
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>First In</th>
              <th>Last Out</th>
              <th>Total Work Hours</th>
              <th>Break Hours</th>
              <th>Overtime Hours</th>
              <th>Late Arrival</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {attendances.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No attendance records found for the selected period.
                </td>
              </tr>
            ) : (
              attendances.map((att) => (
                <tr key={att.id}>
                  <td style={{ fontWeight: 'bold' }}>{new Date(att.attendanceDate).toLocaleDateString()}</td>
                  <td>{att.profile?.displayName} ({att.profile?.employeeCode})</td>
                  <td>{att.firstInTime ? new Date(att.firstInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{att.lastOutTime ? new Date(att.lastOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td>{Number(att.totalWorkHours).toFixed(2)} hrs</td>
                  <td>{Number(att.breakHours || 0).toFixed(2)} hrs</td>
                  <td>{Number(att.overtimeHours || 0).toFixed(2)} hrs</td>
                  <td>
                    {att.lateMinutes > 0 ? (
                      <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{att.lateMinutes} mins</span>
                    ) : (
                      'On time'
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        att.status === 'PRESENT'
                          ? styles.badgeSuccess
                          : att.status === 'HALF_DAY'
                          ? styles.badgeWarning
                          : styles.badgeDanger
                      }`}
                    >
                      {att.status}
                    </span>
                    {att.isRegularized && (
                      <span className={`${styles.badge} ${styles.badgeInfo}`} style={{ marginLeft: '4px' }}>
                        Regularized
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeNeutral}`}>{att.source}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Regularization Modal */}
      {showRegModal && (
        <Modal isOpen={showRegModal} onClose={() => setShowRegModal(false)} title="Attendance Regularization Request">
          <form onSubmit={handleRegularizeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Employee *</label>
              <select
                value={regForm.employeeProfileId}
                onChange={(e) => setRegForm({ ...regForm, employeeProfileId: e.target.value })}
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
              <label>Attendance Date *</label>
              <input
                type="date"
                required
                value={regForm.attendanceDate}
                onChange={(e) => setRegForm({ ...regForm, attendanceDate: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Requested IN Time</label>
                <input
                  type="datetime-local"
                  value={regForm.requestedInTime}
                  onChange={(e) => setRegForm({ ...regForm, requestedInTime: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Requested OUT Time</label>
                <input
                  type="datetime-local"
                  value={regForm.requestedOutTime}
                  onChange={(e) => setRegForm({ ...regForm, requestedOutTime: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Reason for Regularization *</label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Biometric device was offline, client visit on-site..."
                value={regForm.reason}
                onChange={(e) => setRegForm({ ...regForm, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowRegModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

