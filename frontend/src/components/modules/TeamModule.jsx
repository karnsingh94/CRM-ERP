'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { IconPlus } from '../ui/Icons';
import Modal from '../ui/Modal';
import ServiceDepartments from '../departments/ServiceDepartments';

const ROLE_OPTIONS = [
  { value: 'SERVICE_HEAD', label: 'Service Head' },
  { value: 'TEAM_LEADER', label: 'Team Leader' },
  { value: 'EMPLOYEE', label: 'Employee' },
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map(({ value, label }) => [value, label]));
const EMPTY_EMPLOYEE = {
  name: '',
  email: '',
  role: '',
  serviceCode: '',
  accessRole: 'EMPLOYEE',
  password: '',
};

export default function TeamModule({ activeCompany, showToast, initialSubTab }) {
  const [activeTab, setActiveTab] = useState(initialSubTab === 'departments' ? 'teams' : initialSubTab || 'members');
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [employeeToAssign, setEmployeeToAssign] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEmployee, setNewEmployee] = useState(EMPTY_EMPLOYEE);
  const [assignment, setAssignment] = useState({ serviceCode: '', accessRole: 'EMPLOYEE' });
  const services = useMemo(
    () => (activeCompany?.access?.services || []).filter((service) => service.isAllowed !== false),
    [activeCompany?.access?.services]
  );
  const [selectedServiceCode, setSelectedServiceCode] = useState('');

  useEffect(() => {
    setActiveTab(initialSubTab === 'departments' ? 'teams' : initialSubTab || 'members');
  }, [initialSubTab]);

  useEffect(() => {
    if (!services.some((service) => service.code === selectedServiceCode)) {
      setSelectedServiceCode(services[0]?.code || '');
    }
  }, [services, selectedServiceCode]);

  const loadEmployees = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await api.get(`/companies/${activeCompany.id}/employees`, { noCache: true });
      setEmployees(response.data || []);
    } catch (error) {
      setLoadError(error.message || 'Could not load company employees.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleCreateEmployee = async (event) => {
    event.preventDefault();
    if (!newEmployee.name.trim() || !newEmployee.email.trim() || !newEmployee.serviceCode || newEmployee.password.length < 8) {
      showToast?.('Validation Error', 'Name, email, service, and a password of at least 8 characters are required.', 'danger');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await api.post(`/companies/${activeCompany.id}/employees`, newEmployee);
      showToast?.(
        'Employee Registered',
        `${response.data.name} can sign in using ${response.data.email} and the password you set.`,
        'success'
      );
      setShowAddModal(false);
      setNewEmployee(EMPTY_EMPLOYEE);
      await loadEmployees();
    } catch (error) {
      showToast?.('Registration Failed', error.message || 'Failed to add employee.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignEmployee = async (event) => {
    event.preventDefault();
    if (!employeeToAssign || !assignment.serviceCode) return;
    setIsSubmitting(true);
    try {
      await api.put(
        `/companies/${activeCompany.id}/employees/${employeeToAssign.id}/team`,
        assignment
      );
      showToast?.('Service Assignment Updated', `${employeeToAssign.name} is now assigned to the selected service.`, 'success');
      setEmployeeToAssign(null);
      await loadEmployees();
    } catch (error) {
      showToast?.('Assignment Failed', error.message || 'Could not update the service assignment.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.65rem 0.8rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '0.88rem',
    color: '#0f172a',
    background: '#fff',
  };
  const labelStyle = {
    display: 'block',
    marginBottom: '0.35rem',
    color: '#334155',
    fontSize: '0.84rem',
    fontWeight: 700,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Company Team &amp; Internal Staff Access</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Each assigned service is a team. Add a Service Head, optional Team Leaders, and employees for {activeCompany?.organizationName}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNewEmployee({ ...EMPTY_EMPLOYEE, serviceCode: services[0]?.code || '' });
            setShowAddModal(true);
          }}
          disabled={!services.length}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.1rem', background: services.length ? '#7f22fe' : '#94a3b8', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '0.86rem', border: 'none', cursor: services.length ? 'pointer' : 'not-allowed' }}
        >
          <IconPlus size={16} /> Add Employee
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
        {[
          ['members', `Company Employees (${employees.length})`],
          ['teams', 'Service Teams'],
        ].map(([tab, title]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{ padding: '0.65rem 1rem', fontWeight: activeTab === tab ? 800 : 600, color: activeTab === tab ? '#7f22fe' : '#64748b', borderBottom: activeTab === tab ? '2px solid #7f22fe' : '2px solid transparent', fontSize: '0.88rem', cursor: 'pointer', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
          >
            {title}
          </button>
        ))}
      </div>

      {activeTab === 'teams' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {services.length ? (
            <>
              <div style={{ maxWidth: '420px' }}>
                <label htmlFor="team-service-select" style={labelStyle}>Service team</label>
                <select
                  id="team-service-select"
                  value={selectedServiceCode}
                  onChange={(event) => setSelectedServiceCode(event.target.value)}
                  style={inputStyle}
                >
                  {services.map((service) => (
                    <option key={service.serviceId || service.id} value={service.code}>{service.name}</option>
                  ))}
                </select>
              </div>
              {selectedServiceCode && (
                <ServiceDepartments activeCompany={activeCompany} serviceCode={selectedServiceCode} showToast={showToast} />
              )}
            </>
          ) : (
            <p style={{ color: '#64748b' }}>No active services have been assigned to this company.</p>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1rem' }}>Employee Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Login ID</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Service Team</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Team Role</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Designation</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem' }} />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b' }}>Loading employees...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={7} role="alert" style={{ padding: '1.25rem', textAlign: 'center', color: '#b91c1c' }}>{loadError}</td></tr>
                ) : employees.length ? employees.map((employee) => (
                  <tr key={employee.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>{employee.name}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>{employee.email}</td>
                    <td style={{ padding: '0.85rem 1rem', color: employee.serviceName ? '#0369a1' : '#b45309', fontWeight: 600 }}>
                      {employee.serviceName || 'Needs service assignment'}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#7f22fe', fontWeight: 700 }}>
                      {ROLE_LABELS[employee.accessRole] || ROLE_LABELS.EMPLOYEE}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>{employee.role}</td>
                    <td style={{ padding: '0.85rem 1rem', color: employee.status === 'ACTIVE' ? '#047857' : '#b91c1c' }}>{employee.status}</td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEmployeeToAssign(employee);
                          setAssignment({
                            serviceCode: employee.serviceCode || services[0]?.code || '',
                            accessRole: employee.accessRole || 'EMPLOYEE',
                          });
                        }}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '7px', padding: '0.4rem 0.65rem', background: '#fff', color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Assign Service
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No employees registered yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setNewEmployee(EMPTY_EMPLOYEE); }} title="Create Service Team Member" maxWidth="520px">
        <form onSubmit={handleCreateEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <label htmlFor="employee-name" style={labelStyle}>Full Name *</label>
            <input id="employee-name" required value={newEmployee.name} onChange={(event) => setNewEmployee({ ...newEmployee, name: event.target.value })} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employee-email" style={labelStyle}>Login ID / Work Email *</label>
            <input id="employee-email" type="email" required value={newEmployee.email} onChange={(event) => setNewEmployee({ ...newEmployee, email: event.target.value })} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employee-service" style={labelStyle}>Assigned Service *</label>
            <select id="employee-service" required value={newEmployee.serviceCode} onChange={(event) => setNewEmployee({ ...newEmployee, serviceCode: event.target.value })} style={inputStyle}>
              <option value="">Select service</option>
              {services.map((service) => <option key={service.serviceId || service.id} value={service.code}>{service.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="employee-access-role" style={labelStyle}>Team Role *</label>
            <select id="employee-access-role" value={newEmployee.accessRole} onChange={(event) => setNewEmployee({ ...newEmployee, accessRole: event.target.value })} style={inputStyle}>
              {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
            <small style={{ display: 'block', marginTop: '0.3rem', color: '#64748b' }}>Each service can have only one Service Head.</small>
          </div>
          <div>
            <label htmlFor="employee-designation" style={labelStyle}>Job Designation</label>
            <input id="employee-designation" placeholder="e.g. Sales Executive" value={newEmployee.role} onChange={(event) => setNewEmployee({ ...newEmployee, role: event.target.value })} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="employee-password" style={labelStyle}>Initial Password *</label>
            <input id="employee-password" type="password" autoComplete="new-password" minLength={8} required value={newEmployee.password} onChange={(event) => setNewEmployee({ ...newEmployee, password: event.target.value })} style={inputStyle} />
            <small style={{ display: 'block', marginTop: '0.3rem', color: '#64748b' }}>Give the employee this password with their Login ID. They can change it from their dashboard.</small>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem' }}>
            <button type="button" onClick={() => setShowAddModal(false)} disabled={isSubmitting} style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={{ padding: '0.65rem 1.1rem', borderRadius: '8px', border: 'none', background: '#7f22fe', color: '#fff', fontWeight: 700 }}>
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(employeeToAssign)} onClose={() => setEmployeeToAssign(null)} title="Assign Employee to Service" maxWidth="480px">
        <form onSubmit={handleAssignEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ margin: 0, color: '#64748b' }}>Choose one service for {employeeToAssign?.name}. Their workspace will be limited to that service&apos;s company-approved modules.</p>
          <div>
            <label htmlFor="existing-employee-service" style={labelStyle}>Service *</label>
            <select id="existing-employee-service" required value={assignment.serviceCode} onChange={(event) => setAssignment({ ...assignment, serviceCode: event.target.value })} style={inputStyle}>
              {services.map((service) => <option key={service.serviceId || service.id} value={service.code}>{service.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="existing-employee-role" style={labelStyle}>Team Role *</label>
            <select id="existing-employee-role" value={assignment.accessRole} onChange={(event) => setAssignment({ ...assignment, accessRole: event.target.value })} style={inputStyle}>
              {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
            <button type="button" onClick={() => setEmployeeToAssign(null)} disabled={isSubmitting} style={{ padding: '0.65rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600 }}>Cancel</button>
            <button type="submit" disabled={isSubmitting || !services.length} style={{ padding: '0.65rem 1.1rem', borderRadius: '8px', border: 'none', background: '#7f22fe', color: '#fff', fontWeight: 700 }}>
              {isSubmitting ? 'Saving...' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
