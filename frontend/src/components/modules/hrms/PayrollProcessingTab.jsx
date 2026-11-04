'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import styles from '../HrmsModule.module.css';

export default function PayrollProcessingTab({ companyId, toast, userRole }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: null,
    isDanger: false,
  });

  const [createForm, setCreateForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const loadBatches = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/payroll/batches`);
      if (res?.success) {
        setBatches(res.data || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load payroll batches', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const viewBatchDetails = async (batchId) => {
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/payroll/batches/${batchId}`);
      if (res?.success) {
        setSelectedBatch(res.data);
      }
    } catch (err) {
      toast(err.message || 'Failed to load batch details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/payroll/batches`, createForm);
      if (res?.success) {
        toast(`Payroll batch ${res.data.batchNumber} created in DRAFT state`);
        setShowCreateModal(false);
        loadBatches();
      }
    } catch (err) {
      toast(err.message || 'Failed to create batch', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async (batchId) => {
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/payroll/batches/${batchId}/calculate`);
      if (res?.success) {
        toast('Payroll computed for all active employees with attendance and LOP deductions');
        loadBatches();
        if (selectedBatch?.id === batchId) viewBatchDetails(batchId);
      }
    } catch (err) {
      toast(err.message || 'Calculation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async (batchId) => {
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/payroll/batches/${batchId}/submit-approval`);
      if (res?.success) {
        toast('Payroll batch submitted to Approval Engine');
        loadBatches();
      }
    } catch (err) {
      toast(err.message || 'Submission failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const promptApprove = (batch) => {
    setConfirmDialog({
      open: true,
      title: 'Approve Payroll Batch',
      message: `Are you sure you want to approve payroll batch ${batch.batchNumber}? This will lock calculations and automatically provision immutable employee payslips.`,
      action: async () => {
        try {
          setLoading(true);
          const res = await api.post(`/companies/${companyId}/hrms/payroll/batches/${batch.id}/approve`);
          if (res?.success) {
            toast('Payroll batch APPROVED and payslips generated');
            loadBatches();
          }
        } catch (err) {
          toast(err.message || 'Approval failed', 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const promptPostGL = (batch) => {
    setConfirmDialog({
      open: true,
      title: 'Post Payroll to General Ledger',
      message: `Confirm posting ₹${Number(batch.totalGross).toLocaleString()} to Phase 8 General Ledger? A balanced double-entry Journal Voucher will be created and posted automatically (Debit Salaries & Employer Contributions, Credit Liabilities & Net Payable).`,
      action: async () => {
        try {
          setLoading(true);
          const res = await api.post(`/companies/${companyId}/hrms/payroll/batches/${batch.id}/post-gl`);
          if (res?.success) {
            toast(`Payroll batch posted to GL with Journal Voucher ${res.data.voucher?.voucherNo || 'POSTED'}`);
            loadBatches();
          }
        } catch (err) {
          toast(err.message || 'GL Posting failed', 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const promptDisburse = (batch) => {
    setConfirmDialog({
      open: true,
      title: 'Confirm Salary Disbursement',
      message: `Mark payroll batch ${batch.batchNumber} as PAID? Confirm bank transfer execution of ₹${Number(batch.totalNet).toLocaleString()} to employees.`,
      action: async () => {
        try {
          setLoading(true);
          const res = await api.post(`/companies/${companyId}/hrms/payroll/batches/${batch.id}/disburse`);
          if (res?.success) {
            toast('Payroll marked as PAID / DISBURSED');
            loadBatches();
          }
        } catch (err) {
          toast(err.message || 'Disbursement update failed', 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const downloadDisbursementCsv = (batchId, batchNo) => {
    window.open(`/api/companies/${companyId}/hrms/payroll/batches/${batchId}/disbursement-csv`, '_blank');
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Monthly Payroll Processing & GL Integration</h2>
          <p>End-to-end payroll lifecycle, attendance-based deductions, GL posting and bank disbursement</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)}>
            + Create Payroll Batch
          </button>
        )}
      </div>

      {/* Lifecycle Flow Indicator */}
      <div className={styles.flow} style={{ marginTop: '1rem' }}>
        <span>1. DRAFT</span> <b>→</b>
        <span>2. CALCULATED</span> <b>→</b>
        <span>3. PENDING_APPROVAL</span> <b>→</b>
        <span>4. APPROVED</span> <b>→</b>
        <span>5. POSTED_TO_GL</span> <b>→</b>
        <span>6. PAID</span>
      </div>

      <div className={styles.tableContainer} style={{ marginTop: '1.25rem' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Batch Number</th>
              <th>Period</th>
              <th>Employees</th>
              <th>Total Gross</th>
              <th>Total Deductions</th>
              <th>Total Net Pay</th>
              <th>GL Voucher</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No payroll batches created yet. Create a batch to calculate monthly salary.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 'bold' }}>{b.batchNumber}</td>
                  <td>{b.month}/{b.year}</td>
                  <td>{b.totalEmployees}</td>
                  <td>₹{Number(b.totalGross).toLocaleString()}</td>
                  <td>₹{Number(b.totalDeductions).toLocaleString()}</td>
                  <td style={{ fontWeight: 'bold', color: '#0f172a' }}>₹{Number(b.totalNet).toLocaleString()}</td>
                  <td>
                    {b.voucher ? (
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>{b.voucher.voucherNo}</span>
                    ) : (
                      'Unposted'
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        b.status === 'PAID'
                          ? styles.badgeSuccess
                          : b.status === 'POSTED_TO_GL'
                          ? styles.badgeInfo
                          : b.status === 'APPROVED'
                          ? styles.badgeSuccess
                          : b.status === 'CALCULATED'
                          ? styles.badgeWarning
                          : styles.badgeNeutral
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                        onClick={() => viewBatchDetails(b.id)}
                      >
                        Preview
                      </button>

                      {userRole !== 'EMPLOYEE' && (
                        <>
                          {(b.status === 'DRAFT' || b.status === 'CALCULATED') && (
                            <button
                              className={`${styles.btn} ${styles.btnPrimary}`}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => handleCalculate(b.id)}
                            >
                              Calculate
                            </button>
                          )}

                          {b.status === 'CALCULATED' && (
                            <button
                              className={`${styles.btn} ${styles.btnWarning || styles.btnSecondary}`}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => handleSubmitApproval(b.id)}
                            >
                              Submit Approval
                            </button>
                          )}

                          {b.status === 'PENDING_APPROVAL' && (
                            <button
                              className={`${styles.btn} ${styles.btnSuccess}`}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => promptApprove(b)}
                            >
                              Approve
                            </button>
                          )}

                          {b.status === 'APPROVED' && (
                            <button
                              className={`${styles.btn} ${styles.btnSuccess}`}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', background: '#7f22fe', color: '#fff' }}
                              onClick={() => promptPostGL(b)}
                            >
                              Post to GL
                            </button>
                          )}

                          {(b.status === 'POSTED_TO_GL' || b.status === 'APPROVED' || b.status === 'PAID') && (
                            <button
                              className={`${styles.btn} ${styles.btnSecondary}`}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => downloadDisbursementCsv(b.id, b.batchNumber)}
                            >
                              CSV
                            </button>
                          )}

                          {b.status === 'POSTED_TO_GL' && (
                            <button
                              className={`${styles.btn} ${styles.btnSuccess}`}
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                              onClick={() => promptDisburse(b)}
                            >
                              Mark Paid
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <Modal
          isOpen={Boolean(selectedBatch)}
          onClose={() => setSelectedBatch(null)}
          title={`Payroll Breakdown: ${selectedBatch.batchNumber} (${selectedBatch.month}/${selectedBatch.year})`}
          maxWidth="900px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Total Gross</div>
                <div className={styles.metricValue}>₹{Number(selectedBatch.totalGross).toLocaleString()}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Total Deductions</div>
                <div className={styles.metricValue}>₹{Number(selectedBatch.totalDeductions).toLocaleString()}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Total Net Payable</div>
                <div className={styles.metricValue} style={{ color: '#0284c7' }}>
                  ₹{Number(selectedBatch.totalNet).toLocaleString()}
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Employer PF + ESI</div>
                <div className={styles.metricValue} style={{ fontSize: '1.1rem' }}>
                  ₹{(Number(selectedBatch.totalEmployerPf) + Number(selectedBatch.totalEmployerEsi)).toLocaleString()}
                </div>
              </div>
            </div>

            <h4 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.9rem', fontWeight: 800 }}>Employee Compensation Line Items</h4>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Days (Worked / LOP)</th>
                    <th>Gross Earned</th>
                    <th>Deductions</th>
                    <th>Net Salary</th>
                    <th>Employer PF</th>
                    <th>Employer ESI</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBatch.items?.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 'bold' }}>{item.profile?.displayName} ({item.profile?.employeeCode})</td>
                      <td>{Number(item.paidDays)} / {Number(item.lopDays)}</td>
                      <td>₹{Number(item.grossEarned).toLocaleString()}</td>
                      <td>₹{Number(item.totalDeductions).toLocaleString()}</td>
                      <td style={{ fontWeight: 'bold' }}>₹{Number(item.netPayable).toLocaleString()}</td>
                      <td>₹{Number(item.employerPf).toLocaleString()}</td>
                      <td>₹{Number(item.employerEsi).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', marginTop: '1rem' }}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSelectedBatch(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Batch Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Monthly Payroll Run">
          <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className={styles.formGroup}>
                <label>Month (1-12) *</label>
                <select
                  value={createForm.month}
                  onChange={(e) => setCreateForm({ ...createForm, month: Number(e.target.value) })}
                >
                  <option value={1}>1 - January</option>
                  <option value={2}>2 - February</option>
                  <option value={3}>3 - March</option>
                  <option value={4}>4 - April</option>
                  <option value={5}>5 - May</option>
                  <option value={6}>6 - June</option>
                  <option value={7}>7 - July</option>
                  <option value={8}>8 - August</option>
                  <option value={9}>9 - September</option>
                  <option value={10}>10 - October</option>
                  <option value={11}>11 - November</option>
                  <option value={12}>12 - December</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Year *</label>
                <input
                  type="number"
                  required
                  value={createForm.year}
                  onChange={(e) => setCreateForm({ ...createForm, year: Number(e.target.value) })}
                />
              </div>
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
                Create Batch
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
        onConfirm={confirmDialog.action}
        isDanger={confirmDialog.isDanger}
      />
    </div>
  );
}

