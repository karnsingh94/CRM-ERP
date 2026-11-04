'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import styles from '../HrmsModule.module.css';

export default function DocumentVaultTab({ companyId, toast, userRole }) {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [uploadForm, setUploadForm] = useState({
    documentType: 'ID_PROOF',
    title: '',
    documentNumber: '',
    expiryDate: '',
    file: null,
  });

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/hrms/employees?limit=100`);
      if (res?.success) {
        const items = res.data.items || [];
        setEmployees(items);
        if (items.length > 0 && !selectedEmployeeId) {
          setSelectedEmployeeId(items[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [companyId, selectedEmployeeId]);

  const loadDocuments = useCallback(async () => {
    if (!companyId || !selectedEmployeeId) return;
    try {
      setLoading(true);
      const res = await api.get(`/companies/${companyId}/hrms/employees/${selectedEmployeeId}/documents`);
      if (res?.success) {
        setDocuments(res.data || []);
      }
    } catch (err) {
      toast(err.message || 'Failed to load employee documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedEmployeeId, toast]);

  const loadExpiringDocs = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/hrms/documents/expiring?days=60`);
      if (res?.success) {
        setExpiringDocs(res.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [companyId]);

  useEffect(() => {
    loadEmployees();
    loadExpiringDocs();
  }, [loadEmployees, loadExpiringDocs]);

  useEffect(() => {
    if (selectedEmployeeId) {
      loadDocuments();
    }
  }, [selectedEmployeeId, loadDocuments]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.title || !selectedEmployeeId) {
      toast('Title and employee are required', 'error');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        documentType: uploadForm.documentType,
        title: uploadForm.title,
        documentNumber: uploadForm.documentNumber || undefined,
        expiryDate: uploadForm.expiryDate || undefined,
        fileName: uploadForm.file ? uploadForm.file.name : `${uploadForm.title.replace(/\s+/g, '_')}.pdf`,
      };

      const res = await api.post(`/companies/${companyId}/hrms/employees/${selectedEmployeeId}/documents`, payload);
      if (res?.success) {
        toast('Document uploaded to vault');
        setShowUploadModal(false);
        setUploadForm({
          documentType: 'ID_PROOF',
          title: '',
          documentNumber: '',
          expiryDate: '',
          file: null,
        });
        loadDocuments();
        loadExpiringDocs();
      }
    } catch (err) {
      toast(err.message || 'Failed to upload document', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (docId, isVerified) => {
    try {
      setLoading(true);
      const res = await api.patch(`/companies/${companyId}/hrms/documents/${docId}/verify`, { isVerified });
      if (res?.success) {
        toast(`Document marked as ${isVerified ? 'VERIFIED' : 'REJECTED'}`);
        loadDocuments();
      }
    } catch (err) {
      toast(err.message || 'Failed to update verification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!confirm('Delete this document from the vault?')) return;
    try {
      setLoading(true);
      const res = await api.delete(`/companies/${companyId}/hrms/documents/${docId}`);
      if (res?.success) {
        toast('Document deleted');
        loadDocuments();
        loadExpiringDocs();
      }
    } catch (err) {
      toast(err.message || 'Failed to delete document', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Employee Document Vault</h2>
          <p>Categorized HR document storage, verification status & expiry tracking</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowUploadModal(true)}>
            + Upload Document
          </button>
        )}
      </div>

      {expiringDocs.length > 0 && (
        <div className={styles.disclaimerBox} style={{ marginTop: '1rem', background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
          ⏳ <strong>Expiring Documents Warning:</strong> {expiringDocs.length} document(s) expiring within the next 60 days.
        </div>
      )}

      <div className={styles.filterBar} style={{ marginTop: '1rem' }}>
        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Select Employee:</label>
        <select
          className={styles.selectInput}
          style={{ minWidth: '260px' }}
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.displayName} ({emp.employeeCode})
            </option>
          ))}
        </select>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadDocuments}>
          Refresh
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Document Type</th>
              <th>Title</th>
              <th>Document Number</th>
              <th>Expiry Date</th>
              <th>Verification Status</th>
              <th>Uploaded At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No documents uploaded for this employee yet.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeInfo}`}>{doc.documentType}</span>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>{doc.title}</td>
                  <td>{doc.documentNumber || '—'}</td>
                  <td>
                    {doc.expiryDate ? (
                      new Date(doc.expiryDate) < new Date() ? (
                        <span style={{ color: '#dc2626', fontWeight: 'bold' }}>
                          Expired ({new Date(doc.expiryDate).toLocaleDateString()})
                        </span>
                      ) : (
                        new Date(doc.expiryDate).toLocaleDateString()
                      )
                    ) : (
                      'No Expiry'
                    )}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${doc.isVerified ? styles.badgeSuccess : styles.badgeWarning}`}>
                      {doc.isVerified ? 'VERIFIED' : 'PENDING'}
                    </span>
                  </td>
                  <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {userRole !== 'EMPLOYEE' && (
                        doc.isVerified ? (
                          <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', color: '#dc2626' }}
                            onClick={() => handleVerify(doc.id, false)}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            className={`${styles.btn} ${styles.btnSuccess}`}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                            onClick={() => handleVerify(doc.id, true)}
                          >
                            Verify
                          </button>
                        )
                      )}
                      {userRole !== 'EMPLOYEE' && (
                        <button
                          className={`${styles.btn} ${styles.btnDanger}`}
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => handleDelete(doc.id)}
                        >
                          Delete
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

      {/* Upload Document Modal */}
      {showUploadModal && (
        <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload Document to Vault">
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGroup}>
              <label>Target Employee</label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                required
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.displayName} ({emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Document Category *</label>
              <select
                value={uploadForm.documentType}
                onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}
              >
                <option value="ID_PROOF">ID Proof (Passport, Driving License, Voter ID)</option>
                <option value="ADDRESS_PROOF">Address Proof</option>
                <option value="OFFER_LETTER">Offer Letter</option>
                <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                <option value="DEGREE_CERTIFICATE">Degree / Educational Certificate</option>
                <option value="EXPERIENCE_LETTER">Relieving / Experience Certificate</option>
                <option value="PAYSLIP_PREVIOUS">Previous Employment Payslip</option>
                <option value="OTHER">Other Compliance Document</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Document Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Passport Copy"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Document Identifier / Number</label>
              <input
                type="text"
                placeholder="e.g. Z1234567"
                value={uploadForm.documentNumber}
                onChange={(e) => setUploadForm({ ...uploadForm, documentNumber: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Expiry Date (if applicable)</label>
              <input
                type="date"
                value={uploadForm.expiryDate}
                onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Select File (PDF, PNG, JPG)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files[0] })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={loading}>
                {loading ? 'Uploading...' : 'Save to Vault'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

