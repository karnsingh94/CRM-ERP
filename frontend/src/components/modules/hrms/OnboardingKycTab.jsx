'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function OnboardingKycTab({ companyId, toast, userRole }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [kycData, setKycData] = useState(null);
  const [verifyModal, setVerifyModal] = useState({ open: false, field: '', status: 'VERIFIED', remarks: '' });

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/employees?limit=50`);
      if (res?.success) {
        setEmployees(res.data.items || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load onboarding profiles', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const viewKyc = async (profile) => {
    setSelectedProfile(profile);
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/employees/${profile.id}/kyc`);
      if (res?.success) {
        setKycData(res.data);
      }
    } catch (err) {
      toast(err.message || 'Failed to fetch KYC record', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyField = async () => {
    if (!selectedProfile || !verifyModal.field) return;
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/employees/${selectedProfile.id}/kyc/verify-field`, {
        field: verifyModal.field,
        status: verifyModal.status,
        remarks: verifyModal.remarks,
      });
      if (res?.success) {
        toast(`${verifyModal.field} status updated to ${verifyModal.status}`);
        setKycData(res.data);
        setVerifyModal({ open: false, field: '', status: 'VERIFIED', remarks: '' });
        loadData();
      }
    } catch (err) {
      toast(err.message || 'Verification update failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = async (profileId) => {
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/employees/${profileId}/kyc/submit-approval`);
      if (res?.success) {
        toast('KYC submitted for manager review via Approval Engine');
        loadData();
      }
    } catch (err) {
      toast(err.message || 'Submission failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Employee Onboarding & KYC Verification</h2>
          <p>Maker-Checker verification workflow for statutory PAN, Aadhaar and Bank Accounts</p>
        </div>
      </div>

      <div className={styles.disclaimerBox} style={{ marginTop: '1rem' }}>
        ⚠️ <strong>Statutory Notice:</strong> Third-party biometric or automated NSDL/UIDAI verification requires an authorized external API gateway. Verification statuses reflect internal HR Maker-Checker approval.
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Employee Name</th>
              <th>Joining Date</th>
              <th>PAN Status</th>
              <th>Aadhaar Status</th>
              <th>Bank Status</th>
              <th>Overall Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const kyc = emp.kycRecord || {};
              return (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 'bold' }}>{emp.employeeCode}</td>
                  <td>{emp.displayName}</td>
                  <td>{new Date(emp.dateOfJoining).toLocaleDateString()}</td>
                  <td>
                    <span className={`${styles.badge} ${kyc.panStatus === 'VERIFIED' ? styles.badgeSuccess : styles.badgeWarning}`}>
                      {kyc.panStatus || 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${kyc.aadhaarStatus === 'VERIFIED' ? styles.badgeSuccess : styles.badgeWarning}`}>
                      {kyc.aadhaarStatus || 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${kyc.bankStatus === 'VERIFIED' ? styles.badgeSuccess : styles.badgeWarning}`}>
                      {kyc.bankStatus || 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        kyc.overallStatus === 'VERIFIED'
                          ? styles.badgeSuccess
                          : kyc.overallStatus === 'REJECTED'
                          ? styles.badgeDanger
                          : styles.badgeNeutral
                      }`}
                    >
                      {kyc.overallStatus || 'PENDING'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => viewKyc(emp)}
                      >
                        Review KYC
                      </button>
                      {userRole !== 'EMPLOYEE' && kyc.overallStatus !== 'VERIFIED' && (
                        <button
                          className={`${styles.btn} ${styles.btnPrimary}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleSubmitApproval(emp.id)}
                        >
                          Submit Approval
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* KYC Review Modal */}
      {selectedProfile && kycData && (
        <Modal isOpen={Boolean(selectedProfile)} onClose={() => setSelectedProfile(null)} title={`KYC Review: ${selectedProfile.displayName}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>PAN Card (Masked)</div>
                <div className={styles.metricValue} style={{ fontSize: '1rem' }}>{selectedProfile.panMasked || 'Not Submitted'}</div>
                <div className={styles.metricSub}>Status: <strong>{kycData.panStatus}</strong></div>
                {userRole !== 'EMPLOYEE' && (
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ marginTop: '0.5rem', fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => setVerifyModal({ open: true, field: 'PAN', status: 'VERIFIED', remarks: '' })}
                  >
                    Update PAN Status
                  </button>
                )}
              </div>

              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Aadhaar Card (Masked)</div>
                <div className={styles.metricValue} style={{ fontSize: '1rem' }}>{selectedProfile.aadhaarMasked || 'Not Submitted'}</div>
                <div className={styles.metricSub}>Status: <strong>{kycData.aadhaarStatus}</strong></div>
                {userRole !== 'EMPLOYEE' && (
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ marginTop: '0.5rem', fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => setVerifyModal({ open: true, field: 'AADHAAR', status: 'VERIFIED', remarks: '' })}
                  >
                    Update Aadhaar Status
                  </button>
                )}
              </div>

              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Bank Account (Masked)</div>
                <div className={styles.metricValue} style={{ fontSize: '1rem' }}>{selectedProfile.bankAccountMasked || 'Not Submitted'}</div>
                <div className={styles.metricSub}>Status: <strong>{kycData.bankStatus}</strong></div>
                {userRole !== 'EMPLOYEE' && (
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ marginTop: '0.5rem', fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => setVerifyModal({ open: true, field: 'BANK', status: 'VERIFIED', remarks: '' })}
                  >
                    Update Bank Status
                  </button>
                )}
              </div>
            </div>

            {kycData.rejectionReason && (
              <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                <strong>Rejection Reason:</strong> {kycData.rejectionReason}
              </p>
            )}

            <div style={{ textAlign: 'right', marginTop: '1rem' }}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSelectedProfile(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Field Verification Modal */}
      {verifyModal.open && (
        <Modal isOpen={verifyModal.open} onClose={() => setVerifyModal({ ...verifyModal, open: false })} title={`Verify ${verifyModal.field}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Decision</label>
              <select
                value={verifyModal.status}
                onChange={(e) => setVerifyModal({ ...verifyModal, status: e.target.value })}
              >
                <option value="VERIFIED">VERIFIED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Remarks / Notes</label>
              <textarea
                rows={3}
                placeholder="Enter verification notes or rejection reason..."
                value={verifyModal.remarks}
                onChange={(e) => setVerifyModal({ ...verifyModal, remarks: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setVerifyModal({ ...verifyModal, open: false })}
              >
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleVerifyField} disabled={loading}>
                Save Decision
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

