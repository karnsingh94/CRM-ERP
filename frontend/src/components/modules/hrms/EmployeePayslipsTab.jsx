'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function EmployeePayslipsTab({ companyId, toast, userRole, currentUserId }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [htmlModal, setHtmlModal] = useState({ open: false, html: '' });

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/hrms/employees?limit=100`);
      if (res?.success) {
        const items = res.data.items || [];
        setEmployees(items);
        // If employee role, find matching profile
        if (userRole === 'EMPLOYEE' && currentUserId) {
          const myProfile = items.find((emp) => emp.employeeId === currentUserId);
          if (myProfile) {
            setSelectedEmpId(myProfile.id);
            return;
          }
        }
        if (items.length > 0 && !selectedEmpId) {
          setSelectedEmpId(items[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [companyId, userRole, currentUserId, selectedEmpId]);

  const loadPayslips = useCallback(async () => {
    if (!companyId || !selectedEmpId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/employees/${selectedEmpId}/payslips`);
      if (res?.success) {
        setPayslips(res.data || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load employee payslips', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmpId, toast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (selectedEmpId) {
      loadPayslips();
    }
  }, [selectedEmpId, loadPayslips]);

  const viewPrintablePayslip = async (payslipId) => {
    try {
      setLoading(true);
      // Fetch payslip HTML
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/companies/${companyId}/hrms/payslips/${payslipId}/html`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const htmlText = await response.text();
      setHtmlModal({ open: true, html: htmlText });
    } catch (err) {
      toast('Failed to load printable payslip', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyPublicLink = (downloadToken) => {
    const url = `${window.location.origin}/hrms/payslips/token/${downloadToken}`;
    navigator.clipboard.writeText(url);
    toast('Secure download token link copied to clipboard!');
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Employee Salary Payslips (ESS & Downloads)</h2>
          <p>Immutable earnings snapshots, printable payslips and secure expiring token access</p>
        </div>
      </div>

      {userRole !== 'EMPLOYEE' && (
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
          <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadPayslips}>
            Refresh
          </button>
        </div>
      )}

      <div className={styles.tableContainer} style={{ marginTop: '1rem' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Payslip Number</th>
              <th>Month / Year</th>
              <th>Gross Salary</th>
              <th>Total Deductions</th>
              <th>Net Salary</th>
              <th>Published Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payslips.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No published payslips found for this employee.
                </td>
              </tr>
            ) : (
              payslips.map((ps) => (
                <tr key={ps.id}>
                  <td style={{ fontWeight: 'bold' }}>{ps.payslipNumber}</td>
                  <td>{ps.month} / {ps.year}</td>
                  <td>₹{Number(ps.grossAmount).toLocaleString()}</td>
                  <td>₹{Number(ps.deductionsAmount).toLocaleString()}</td>
                  <td style={{ fontWeight: 'bold', color: '#0284c7' }}>₹{Number(ps.netAmount).toLocaleString()}</td>
                  <td>{ps.publishedAt ? new Date(ps.publishedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => viewPrintablePayslip(ps.id)}
                      >
                        Print / View
                      </button>
                      <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => copyPublicLink(ps.downloadToken)}
                        title="Copy secure public download link"
                      >
                        Copy Link
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* HTML Payslip Modal */}
      {htmlModal.open && (
        <Modal isOpen={htmlModal.open} onClose={() => setHtmlModal({ open: false, html: '' })} title="Payslip Document" maxWidth="880px">
          <div>
            <iframe
              srcDoc={htmlModal.html}
              style={{ width: '100%', height: '580px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              title="Printable Payslip"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  const printWin = window.open('', '_blank');
                  printWin.document.write(htmlModal.html);
                  printWin.document.close();
                  printWin.focus();
                  printWin.print();
                }}
              >
                Print to PDF
              </button>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setHtmlModal({ open: false, html: '' })}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

