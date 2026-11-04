'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function ShiftManagementTab({ companyId, toast, userRole }) {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);

  const [shiftForm, setShiftForm] = useState({
    shiftName: '',
    shiftCode: '',
    startTime: '09:00',
    endTime: '18:00',
    graceMinutes: 15,
    breakDurationMinutes: 60,
    halfDayThresholdHours: 4.0,
    fullDayThresholdHours: 8.0,
    isOvernight: false,
    isDefault: false,
  });

  const [rosterForm, setRosterForm] = useState({
    employeeProfileId: '',
    shiftId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    isWeeklyOff: false,
  });

  const loadShifts = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/shifts`);
      if (res?.success) {
        setShifts(res.data || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load shifts', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/hrms/employees?limit=100`);
      if (res?.success) {
        setEmployees(res.data.items || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [companyId]);

  useEffect(() => {
    loadShifts();
    loadEmployees();
  }, [loadShifts, loadEmployees]);

  const handleCreateShift = async (e) => {
    e.preventDefault();
    if (!shiftForm.shiftName || !shiftForm.shiftCode) {
      toast('Shift name and code are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/shifts`, shiftForm);
      if (res?.success) {
        toast('Shift policy created successfully');
        setShowCreateModal(false);
        setShiftForm({
          shiftName: '',
          shiftCode: '',
          startTime: '09:00',
          endTime: '18:00',
          graceMinutes: 15,
          breakDurationMinutes: 60,
          halfDayThresholdHours: 4.0,
          fullDayThresholdHours: 8.0,
          isOvernight: false,
          isDefault: false,
        });
        loadShifts();
      }
    } catch (err) {
      toast(err.message || 'Failed to create shift', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRoster = async (e) => {
    e.preventDefault();
    if (!rosterForm.employeeProfileId || !rosterForm.shiftId || !rosterForm.startDate) {
      toast('Employee, shift, and start date are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/shifts/roster/assign`, rosterForm);
      if (res?.success) {
        toast('Shift roster assigned successfully');
        setShowRosterModal(false);
      }
    } catch (err) {
      toast(err.message || 'Failed to assign roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Shift Management & Rotational Rostering</h2>
          <p>Work timing policies, overnight crossover support, and employee shift schedules</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowRosterModal(true)}>
              Assign Roster
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)}>
              + Create Shift Policy
            </button>
          </div>
        )}
      </div>

      <div className={styles.tableContainer} style={{ marginTop: '1rem' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Shift Name</th>
              <th>Timings</th>
              <th>Overnight?</th>
              <th>Grace (mins)</th>
              <th>Break (mins)</th>
              <th>Full Day Thresh</th>
              <th>Default</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 'bold' }}>{s.shiftCode}</td>
                <td>{s.shiftName}</td>
                <td>{s.startTime} - {s.endTime}</td>
                <td>
                  <span className={`${styles.badge} ${s.isOvernight ? styles.badgeWarning : styles.badgeNeutral}`}>
                    {s.isOvernight ? 'YES (Midnight+)' : 'NO'}
                  </span>
                </td>
                <td>{s.graceMinutes}m</td>
                <td>{s.breakDurationMinutes}m</td>
                <td>{Number(s.fullDayThresholdHours)} hrs</td>
                <td>
                  {s.isDefault ? (
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>DEFAULT</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <span className={`${styles.badge} ${s.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Shift Policy">
          <form onSubmit={handleCreateShift} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Night Operation Shift"
                  value={shiftForm.shiftName}
                  onChange={(e) => setShiftForm({ ...shiftForm, shiftName: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Shift Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NGT-A"
                  value={shiftForm.shiftCode}
                  onChange={(e) => setShiftForm({ ...shiftForm, shiftCode: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Start Time (HH:MM) *</label>
                <input
                  type="time"
                  required
                  value={shiftForm.startTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>End Time (HH:MM) *</label>
                <input
                  type="time"
                  required
                  value={shiftForm.endTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Grace Period (minutes)</label>
                <input
                  type="number"
                  value={shiftForm.graceMinutes}
                  onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: Number(e.target.value) })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Break Duration (minutes)</label>
                <input
                  type="number"
                  value={shiftForm.breakDurationMinutes}
                  onChange={(e) => setShiftForm({ ...shiftForm, breakDurationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={shiftForm.isOvernight}
                  onChange={(e) => setShiftForm({ ...shiftForm, isOvernight: e.target.checked })}
                />
                Crosses Midnight (Overnight Shift)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={shiftForm.isDefault}
                  onChange={(e) => setShiftForm({ ...shiftForm, isDefault: e.target.checked })}
                />
                Set as Default Company Shift
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {loading ? 'Saving...' : 'Save Shift Policy'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Roster Modal */}
      {showRosterModal && (
        <Modal isOpen={showRosterModal} onClose={() => setShowRosterModal(false)} title="Assign Shift Roster">
          <form onSubmit={handleAssignRoster} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Select Employee *</label>
              <select
                value={rosterForm.employeeProfileId}
                onChange={(e) => setRosterForm({ ...rosterForm, employeeProfileId: e.target.value })}
                required
              >
                <option value="">Select Employee...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.displayName} ({e.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Select Shift *</label>
              <select
                value={rosterForm.shiftId}
                onChange={(e) => setRosterForm({ ...rosterForm, shiftId: e.target.value })}
                required
              >
                <option value="">Select Shift Policy...</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shiftName} ({s.startTime} - {s.endTime})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Effective Start Date *</label>
                <input
                  type="date"
                  required
                  value={rosterForm.startDate}
                  onChange={(e) => setRosterForm({ ...rosterForm, startDate: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>End Date (Optional)</label>
                <input
                  type="date"
                  value={rosterForm.endDate}
                  onChange={(e) => setRosterForm({ ...rosterForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowRosterModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {loading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

