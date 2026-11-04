'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import styles from '../HrmsModule.module.css';

export default function EmployeeMasterTab({ companyId, toast, userRole }) {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [designations, setDesignations] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkEmployeeId, setLinkEmployeeId] = useState('');
  const [companyUsers, setCompanyUsers] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    workEmail: '',
    phone: '',
    dateOfJoining: new Date().toISOString().split('T')[0],
    designationId: '',
    employmentStatus: 'ACTIVE',
    employmentType: 'FULL_TIME',
    pan: '',
    aadhaar: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
  });

  const loadDesignations = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await api.get(`/companies/${companyId}/hrms/designations`);
      if (res?.success) setDesignations(res.data || []);
    } catch (e) {
      console.error('Failed to load designations', e);
    }
  }, [companyId]);

  const loadEmployees = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const query = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(search ? { search } : {}),
        ...(statusFilter ? { employmentStatus: statusFilter } : {}),
      }).toString();

      const res = await api.get(`/companies/${companyId}/hrms/employees?${query}`);
      if (res?.success) {
        setEmployees(res.data.items || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      toast(err.message || 'Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [companyId, page, search, statusFilter, toast]);

  useEffect(() => {
    loadDesignations();
  }, [loadDesignations]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.dateOfJoining) {
      toast('First name and joining date are required', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/employees`, formData);
      if (res?.success) {
        toast('Employee profile created successfully');
        setShowCreateModal(false);
        setFormData({
          firstName: '',
          lastName: '',
          workEmail: '',
          phone: '',
          dateOfJoining: new Date().toISOString().split('T')[0],
          designationId: '',
          employmentStatus: 'ACTIVE',
          employmentType: 'FULL_TIME',
          pan: '',
          aadhaar: '',
          bankName: '',
          bankAccount: '',
          bankIfsc: '',
        });
        loadEmployees();
      }
    } catch (err) {
      toast(err.message || 'Failed to create employee', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openLinkModal = async (profile) => {
    setSelectedProfile(profile);
    setShowLinkModal(true);
    try {
      const res = await api.get(`/companies/${companyId}/employees`);
      if (res?.success || Array.isArray(res)) {
        setCompanyUsers(res?.data || res || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLinkUser = async () => {
    if (!selectedProfile || !linkEmployeeId) return;
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/employees/${selectedProfile.id}/link-user`, {
        employeeId: linkEmployeeId,
      });
      if (res?.success) {
        toast('Login account linked successfully');
        setShowLinkModal(false);
        loadEmployees();
      }
    } catch (err) {
      toast(err.message || 'Failed to link account', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkUser = async (profileId) => {
    if (!confirm('Unlink application login account from this profile?')) return;
    try {
      setLoading(true);
      const res = await api.post(`/companies/${companyId}/hrms/employees/${profileId}/unlink-user`);
      if (res?.success) {
        toast('Account unlinked successfully');
        loadEmployees();
      }
    } catch (err) {
      toast(err.message || 'Failed to unlink account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Employee Master & Staff Directory</h2>
          <p>Decoupled HR master profiles, statutory identity & login account linking</p>
        </div>
        {userRole !== 'EMPLOYEE' && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreateModal(true)}>
            + Add New Employee
          </button>
        )}
      </div>

      <div className={styles.filterBar} style={{ marginTop: '1rem' }}>
        <input
          type="text"
          placeholder="Search by code, name, email, phone..."
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={styles.selectInput}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PROBATION">PROBATION</option>
          <option value="NOTICE_PERIOD">NOTICE_PERIOD</option>
          <option value="RESIGNED">RESIGNED</option>
          <option value="TERMINATED">TERMINATED</option>
        </select>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={loadEmployees}>
          Refresh
        </button>
      </div>

      {loading && employees.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading employees...</p>
      ) : employees.length === 0 ? (
        <EmptyState
          title="No Employee Records Found"
          description="Create your first employee profile to start tracking HR records and attendance."
        />
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Full Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Work Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Login Account</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 'bold' }}>{emp.employeeCode}</td>
                  <td>{emp.displayName}</td>
                  <td>{emp.designation?.title || '—'}</td>
                  <td>{emp.department?.name || '—'}</td>
                  <td>{emp.workEmail || '—'}</td>
                  <td>{emp.phone || '—'}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        emp.employmentStatus === 'ACTIVE'
                          ? styles.badgeSuccess
                          : emp.employmentStatus === 'PROBATION'
                          ? styles.badgeWarning
                          : styles.badgeNeutral
                      }`}
                    >
                      {emp.employmentStatus}
                    </span>
                  </td>
                  <td>
                    {emp.employee ? (
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>Linked ({emp.employee.email})</span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeNeutral}`}>No Account</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className={`${styles.btn} ${styles.btnSecondary}`}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => setSelectedProfile(emp)}
                      >
                        View
                      </button>
                      {userRole !== 'EMPLOYEE' && (
                        emp.employee ? (
                          <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626' }}
                            onClick={() => handleUnlinkUser(emp.id)}
                          >
                            Unlink
                          </button>
                        ) : (
                          <button
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => openLinkModal(emp)}
                          >
                            Link User
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className={styles.pagination}>
        <span>Total Records: {total}</span>
        <div className={styles.paginationBtns}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontWeight: 'bold' }}>Page {page}</span>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            disabled={employees.length < 15}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* Profile Detail Modal */}
      {selectedProfile && !showLinkModal && (
        <Modal isOpen={Boolean(selectedProfile)} onClose={() => setSelectedProfile(null)} title={`Profile: ${selectedProfile.displayName}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.statGrid}>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Employee Code</div>
                <div className={styles.metricValue} style={{ fontSize: '1.1rem' }}>{selectedProfile.employeeCode}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Employment Status</div>
                <div className={styles.metricValue} style={{ fontSize: '1.1rem' }}>{selectedProfile.employmentStatus}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.metricTitle}>Joining Date</div>
                <div className={styles.metricValue} style={{ fontSize: '1.1rem' }}>
                  {new Date(selectedProfile.dateOfJoining).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <p><strong>Designation:</strong> {selectedProfile.designation?.title || '—'}</p>
                <p><strong>Department:</strong> {selectedProfile.department?.name || '—'}</p>
                <p><strong>Work Email:</strong> {selectedProfile.workEmail || '—'}</p>
                <p><strong>Phone:</strong> {selectedProfile.phone || '—'}</p>
              </div>
              <div>
                <p><strong>PAN (Masked):</strong> {selectedProfile.panMasked || 'Not Provided'}</p>
                <p><strong>Aadhaar (Masked):</strong> {selectedProfile.aadhaarMasked || 'Not Provided'}</p>
                <p><strong>Bank Account:</strong> {selectedProfile.bankAccountMasked || 'Not Provided'}</p>
                <p><strong>Bank IFSC:</strong> {selectedProfile.bankIfsc || '—'}</p>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '1rem' }}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setSelectedProfile(null)}>
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Employee Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Employee Profile">
          <form onSubmit={handleCreateEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Work Email</label>
                <input
                  type="email"
                  value={formData.workEmail}
                  onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Phone Number</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Date of Joining *</label>
                <input
                  type="date"
                  required
                  value={formData.dateOfJoining}
                  onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Designation</label>
                <select
                  value={formData.designationId}
                  onChange={(e) => setFormData({ ...formData, designationId: e.target.value })}
                >
                  <option value="">Select Designation</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} (Level {d.level})
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>PAN Number</label>
                <input
                  type="text"
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  value={formData.pan}
                  onChange={(e) => setFormData({ ...formData, pan: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Aadhaar Number</label>
                <input
                  type="text"
                  placeholder="12 digits"
                  maxLength={12}
                  value={formData.aadhaar}
                  onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Bank"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Bank Account Number</label>
                <input
                  type="text"
                  value={formData.bankAccount}
                  onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Bank IFSC Code</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC0001234"
                  value={formData.bankIfsc}
                  onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value })}
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
                {loading ? 'Creating...' : 'Create Employee Profile'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Link User Modal */}
      {showLinkModal && selectedProfile && (
        <Modal isOpen={showLinkModal} onClose={() => setShowLinkModal(false)} title={`Link Login Account: ${selectedProfile.displayName}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#475569' }}>
              Select a company user account to link to this HR profile. This grants the employee application login privileges.
            </p>
            <div className={styles.formGroup}>
              <label>Select User Account</label>
              <select value={linkEmployeeId} onChange={(e) => setLinkEmployeeId(e.target.value)}>
                <option value="">Select a user account...</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) - {u.accessRole}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setShowLinkModal(false)}>
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleLinkUser} disabled={!linkEmployeeId || loading}>
                Link Account
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

