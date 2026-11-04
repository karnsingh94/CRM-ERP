'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function SalaryStructureTab({ companyId, toast, userRole }) {
  const [components, setComponents] = useState([]);
  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCompModal, setShowCompModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [compForm, setCompForm] = useState({
    name: '',
    code: '',
    type: 'EARNING',
    calculationType: 'FLAT',
    isTaxable: true,
    isStatutory: false,
  });

  const [assignForm, setAssignForm] = useState({
    employeeProfileId: '',
    salaryStructureId: '',
    ctcAnnual: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
    revisionReason: 'Annual Appraisal / Increment',
  });

  const loadBaseData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const [compRes, structRes, empRes] = await Promise.all([
        api.get(`/companies/${companyId}/hrms/compensation/components`),
        api.get(`/companies/${companyId}/hrms/compensation/structures`),
        api.get(`/companies/${companyId}/hrms/employees?limit=100`),
      ]);

      if (compRes?.success) setComponents(compRes.data || []);
      if (structRes?.success) {
        setStructures(structRes.data || []);
        if (structRes.data?.length > 0 && !assignForm.salaryStructureId) {
          setAssignForm((f) => ({ ...f, salaryStructureId: structRes.data[0].id }));
        }
      }
      if (empRes?.success) {
        const emps = empRes.data.items || [];
        setEmployees(emps);
        if (emps.length > 0 && !selectedEmpId) {
          setSelectedEmpId(emps[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmpId, assignForm.salaryStructureId]);

  const loadHistory = useCallback(async () => {
    if (!companyId || !selectedEmpId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/employees/${selectedEmpId}/compensation/history`);
      if (res?.success) {
        setSalaryHistory(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmpId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (selectedEmpId) {
      loadHistory();
    }
  }, [selectedEmpId, loadHistory]);

  const handleCreateComponent = async (e) => {
    e.preventDefault();
    if (!compForm.name || !compForm.code) {
      toast('Name and code are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/compensation/components`, compForm);
      if (res?.success) {
        toast('Salary component created');
        setShowCompModal(false);
        setCompForm({
          name: '',
          code: '',
          type: 'EARNING',
          calculationType: 'FLAT',
          isTaxable: true,
          isStatutory: false,
        });
        loadBaseData();
      }
    } catch (err) {
      toast(err.message || 'Failed to create component', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSalary = async (e) => {
    e.preventDefault();
    if (!selectedEmpId || !assignForm.salaryStructureId || !assignForm.ctcAnnual) {
      toast('Please fill all required assignment fields', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/compensation/assign`, {
        ...assignForm,
        employeeProfileId: selectedEmpId,
      });
      if (res?.success) {
        toast('CTC assigned and breakdown calculated with Decimal precision');
        setShowAssignModal(false);
        loadHistory();
      }
    } catch (err) {
      toast(err.message || 'Failed to assign CTC', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Salary Components & CTC Structure Templates</h2>
          <p>Earnings, deductions, formula-based CTC templates and effective-dated salary assignments</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAssignModal(true)}>
              + Assign / Revise CTC
            </button>
            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowCompModal(true)}>
              + New Component
            </button>
          </div>
        )}
      </div>

      {/* Components Table */}
      <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.25rem 0 0.5rem' }}>Salary Components Registry</h3>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Component Code</th>
              <th>Component Name</th>
              <th>Type</th>
              <th>Calculation</th>
              <th>Taxable?</th>
              <th>Statutory?</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {components.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                  No components registered yet.
                </td>
              </tr>
            ) : (
              components.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 'bold' }}>{c.code}</td>
                  <td>{c.name}</td>
                  <td>
                    <span className={`${styles.badge} ${c.type === 'EARNING' ? styles.badgeSuccess : styles.badgeWarning}`}>
                      {c.type}
                    </span>
                  </td>
                  <td>{c.calculationType}</td>
                  <td>{c.isTaxable ? 'YES' : 'NO'}</td>
                  <td>{c.isStatutory ? 'YES' : 'NO'}</td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeSuccess}`}>{c.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Salary Assignment History */}
      <div style={{ marginTop: '1.5rem' }}>
        <div className={styles.filterBar}>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Employee Salary Revision History</h3>
          <select
            className={styles.selectInput}
            value={selectedEmpId}
            onChange={(e) => setSelectedEmpId(e.target.value)}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName} ({e.employeeCode})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Structure</th>
                <th>Annual CTC</th>
                <th>Monthly Gross</th>
                <th>Revision Reason</th>
                <th>Assignment Status</th>
              </tr>
            </thead>
            <tbody>
              {salaryHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                    No salary assignments on file for this employee.
                  </td>
                </tr>
              ) : (
                salaryHistory.map((h) => (
                  <tr key={h.id}>
                    <td style={{ fontWeight: 'bold' }}>{new Date(h.effectiveFrom).toLocaleDateString()}</td>
                    <td>{h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : 'Current (Active)'}</td>
                    <td>{h.structure?.name || 'Standard'}</td>
                    <td>₹{Number(h.ctcAnnual).toLocaleString()}</td>
                    <td>₹{Number(h.ctcMonthly).toLocaleString()}</td>
                    <td>{h.revisionReason || '—'}</td>
                    <td>
                      <span className={`${styles.badge} ${h.status === 'ACTIVE' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Component Modal */}
      {showCompModal && (
        <Modal isOpen={showCompModal} onClose={() => setShowCompModal(false)} title="New Salary Component">
          <form onSubmit={handleCreateComponent} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Component Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Travel Allowance"
                value={compForm.name}
                onChange={(e) => setCompForm({ ...compForm, name: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Component Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. TRAVEL_ALLOW"
                value={compForm.code}
                onChange={(e) => setCompForm({ ...compForm, code: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Component Type</label>
                <select
                  value={compForm.type}
                  onChange={(e) => setCompForm({ ...compForm, type: e.target.value })}
                >
                  <option value="EARNING">EARNING</option>
                  <option value="DEDUCTION">DEDUCTION</option>
                  <option value="REIMBURSEMENT">REIMBURSEMENT</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Calculation Method</label>
                <select
                  value={compForm.calculationType}
                  onChange={(e) => setCompForm({ ...compForm, calculationType: e.target.value })}
                >
                  <option value="FLAT">Flat Amount</option>
                  <option value="PERCENTAGE">Formula / Percentage</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={compForm.isTaxable}
                  onChange={(e) => setCompForm({ ...compForm, isTaxable: e.target.checked })}
                />
                Subject to Income Tax
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={compForm.isStatutory}
                  onChange={(e) => setCompForm({ ...compForm, isStatutory: e.target.checked })}
                />
                Statutory Deduction
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowCompModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                Create Component
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Assign Salary Modal */}
      {showAssignModal && (
        <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign / Revise Employee CTC">
          <form onSubmit={handleAssignSalary} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Select Employee *</label>
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
              <label>Salary Structure Template *</label>
              <select
                value={assignForm.salaryStructureId}
                onChange={(e) => setAssignForm({ ...assignForm, salaryStructureId: e.target.value })}
                required
              >
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Annual CTC Amount (₹) *</label>
              <input
                type="number"
                required
                placeholder="e.g. 1200000"
                value={assignForm.ctcAnnual}
                onChange={(e) => setAssignForm({ ...assignForm, ctcAnnual: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Effective Date *</label>
              <input
                type="date"
                required
                value={assignForm.effectiveFrom}
                onChange={(e) => setAssignForm({ ...assignForm, effectiveFrom: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Revision / Assignment Reason</label>
              <input
                type="text"
                value={assignForm.revisionReason}
                onChange={(e) => setAssignForm({ ...assignForm, revisionReason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                Save CTC Assignment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

