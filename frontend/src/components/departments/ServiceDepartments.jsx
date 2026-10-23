'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { validateEmployeeForm } from '../../lib/employee-validation';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ServiceWorkBoard, { TeamHeadPermissions } from './ServiceWorkBoard';

const ROLE_LABELS = {
  SERVICE_HEAD: 'Service Head',
  TEAM_LEADER: 'Team Leader',
  EMPLOYEE: 'Employee',
};

const EMPTY_PERMISSIONS = {
  manageMembers: false,
  assignWork: false,
  updateWork: false,
  manageServiceRecords: false,
};

export default function ServiceDepartments({ activeCompany, serviceCode, currentUser, showToast }) {
  const normalizedCode = (serviceCode || 'crm_sales').replace(/-/g, '_');
  const [team, setTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHead, setIsSavingHead] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [headPermissions, setHeadPermissions] = useState(EMPTY_PERMISSIONS);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', role: '', password: '' });
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const isAdmin = currentUser?.role === 'COMPANY_ADMIN';
  const canManageMembers = isAdmin || (
    currentUser?.role === 'SERVICE_HEAD' && currentUser.permissions?.manageMembers === true
  );
  const canUseWorkBoard = isAdmin || (
    currentUser?.role === 'SERVICE_HEAD' && (
      currentUser.permissions?.assignWork === true || currentUser.permissions?.updateWork === true
    )
  );

  const loadTeam = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get(
        `/companies/${activeCompany.id}/services/${normalizedCode}/team`,
        { noCache: true }
      );
      setTeam(response.data);
      setHeadPermissions({ ...EMPTY_PERMISSIONS, ...(response.data?.head?.permissions || {}) });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load this service team.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.id, normalizedCode]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleHeadChange = async (event) => {
    const headId = event.target.value || null;
    setActionError('');
    setIsSavingHead(true);
    try {
      const response = await api.put(
        `/companies/${activeCompany.id}/services/${normalizedCode}/team/head`,
        { headId }
      );
      setTeam(response.data);
      setHeadPermissions({ ...EMPTY_PERMISSIONS, ...(response.data?.head?.permissions || {}) });
      showToast?.('Service Head Updated', 'Service team leadership has been saved.', 'success');
    } catch (saveError) {
      setActionError(saveError.message || 'Could not update the Service Head.');
      showToast?.('Update Failed', saveError.message || 'Could not update the Service Head.', 'danger');
    } finally {
      setIsSavingHead(false);
    }
  };

  const handleSavePermissions = async () => {
    setActionError('');
    setIsSavingPermissions(true);
    try {
      const response = await api.put(
        `/companies/${activeCompany.id}/services/${normalizedCode}/team/permissions`,
        { permissions: headPermissions }
      );
      setTeam(response.data);
      showToast?.('Permissions Saved', 'Service Head permissions have been updated.', 'success');
    } catch (saveError) {
      setActionError(saveError.message || 'Could not save Service Head permissions.');
      showToast?.('Update Failed', saveError.message || 'Could not save Service Head permissions.', 'danger');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleCreateEmployee = async (event) => {
    event.preventDefault();
    setActionError('');
    const validationError = validateEmployeeForm(newEmployee);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setIsCreatingEmployee(true);
    try {
      const response = await api.post(`/companies/${activeCompany.id}/employees`, {
        ...newEmployee,
        name: newEmployee.name.trim(),
        email: newEmployee.email.trim().toLowerCase(),
        role: newEmployee.role.trim(),
        serviceCode: normalizedCode,
        accessRole: 'EMPLOYEE',
      });
      setTeam((previous) => ({
        ...previous,
        employees: [...(previous?.employees || []), response.data],
      }));
      setNewEmployee({ name: '', email: '', role: '', password: '' });
      setShowCreateEmployee(false);
      showToast?.('Employee Added', `${response.data.name} has been added to this service team.`, 'success');
    } catch (createError) {
      setActionError(createError.message || 'Could not add this employee.');
      showToast?.('Employee Not Added', createError.message || 'Could not add this employee.', 'danger');
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  const handleRemoveEmployee = async (employee) => {
    if (!window.confirm(`Remove ${employee.name} from this service team? Their existing work history will be preserved.`)) {
      return;
    }

    setActionError('');
    setDeletingEmployeeId(employee.id);
    try {
      const response = await api.delete(
        `/companies/${activeCompany.id}/services/${normalizedCode}/team/employees/${employee.id}`
      );
      setTeam(response.data);
      if (team?.head?.id === employee.id) {
        setHeadPermissions(EMPTY_PERMISSIONS);
      }
      showToast?.('Employee Removed', `${employee.name} was removed from this service team.`, 'success');
    } catch (removeError) {
      setActionError(removeError.message || 'Could not remove this employee.');
      showToast?.('Employee Not Removed', removeError.message || 'Could not remove this employee.', 'danger');
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton rows={4} height="52px" />;
  }

  if (error) {
    return (
      <div role="alert" style={{ padding: '1.25rem', borderRadius: '10px', background: '#fff7ed', color: '#9a3412' }}>
        {error}
      </div>
    );
  }

  const employees = team?.employees || [];
  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE');

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800 }}>
              {team?.service?.name || 'Service'} Team
            </h2>
            <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.86rem' }}>
              This team is provisioned with the assigned service. Add its employees, choose a Service Head, and manage work here.
            </p>
          </div>
          {canManageMembers && (
            <button type="button" onClick={() => setShowCreateEmployee((visible) => !visible)} style={{ padding: '0.65rem 1rem', border: 0, borderRadius: '8px', color: '#fff', background: '#7f22fe', fontWeight: 700, cursor: 'pointer' }}>
              {showCreateEmployee ? 'Cancel' : '+ Add Employee'}
            </button>
          )}
        </div>
      </div>

      {showCreateEmployee && (
        <form onSubmit={handleCreateEmployee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
          {[
            ['name', 'Employee name', 'text'],
            ['email', 'Login ID / work email', 'email'],
            ['role', 'Job designation', 'text'],
            ['password', 'Initial password (8+ characters)', 'password'],
          ].map(([key, label, type]) => (
            <label key={key} style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
              {label}
              <input
                required={key !== 'role'}
                maxLength={key === 'name' ? 100 : key === 'email' ? 254 : key === 'role' ? 100 : key === 'password' ? 128 : undefined}
                minLength={key === 'password' ? 8 : undefined}
                autoComplete={key === 'name' ? 'name' : key === 'email' ? 'username' : key === 'password' ? 'new-password' : undefined}
                inputMode={key === 'email' ? 'email' : undefined}
                type={type}
                value={newEmployee[key]}
                onChange={(event) => {
                  setActionError('');
                  setNewEmployee((previous) => ({ ...previous, [key]: event.target.value }));
                }}
                style={{ display: 'block', width: '100%', marginTop: '0.3rem', padding: '0.62rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: '7px', background: '#fff', color: '#0f172a', font: 'inherit', fontSize: '0.84rem' }}
              />
            </label>
          ))}
          <button type="submit" disabled={isCreatingEmployee} style={{ alignSelf: 'end', justifySelf: 'start', padding: '0.65rem 1rem', border: 0, borderRadius: '8px', color: '#fff', background: isCreatingEmployee ? '#94a3b8' : '#7f22fe', fontWeight: 700, cursor: isCreatingEmployee ? 'wait' : 'pointer' }}>
            {isCreatingEmployee ? 'Adding...' : 'Add to Service Team'}
          </button>
        </form>
      )}
      {actionError && <p role="alert" style={{ margin: 0, padding: '0.7rem 0.9rem', borderRadius: '8px', color: '#991b1b', background: '#fef2f2', fontSize: '0.84rem' }}>{actionError}</p>}

      <div style={{ padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
        {isAdmin ? (
          <>
            <label htmlFor="service-team-head" style={{ display: 'block', marginBottom: '0.45rem', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>
              Service Head
            </label>
            <select
              id="service-team-head"
              value={team?.head?.id || ''}
              disabled={isSavingHead || activeEmployees.length === 0}
              onChange={handleHeadChange}
              style={{ width: '100%', maxWidth: '420px', padding: '0.65rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', background: '#fff' }}
            >
              <option value="">No Service Head selected</option>
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} — {employee.email}
                </option>
              ))}
            </select>
            {team?.head && (
              <>
                <h3 style={{ margin: '1rem 0 0', color: '#0f172a', fontSize: '0.9rem' }}>
                  Permissions for {team.head.name}
                </h3>
                <TeamHeadPermissions permissions={headPermissions} disabled={isSavingPermissions} onChange={setHeadPermissions} />
                <button type="button" onClick={handleSavePermissions} disabled={isSavingPermissions} style={{ marginTop: '0.8rem', padding: '0.55rem 0.9rem', border: 0, borderRadius: '7px', color: '#fff', background: isSavingPermissions ? '#94a3b8' : '#7f22fe', fontWeight: 700 }}>
                  {isSavingPermissions ? 'Saving...' : 'Save Head Permissions'}
                </button>
              </>
            )}
            {activeEmployees.length === 0 && (
              <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
                Add an employee to this service before assigning its Service Head.
              </p>
            )}
          </>
        ) : (
          <div style={{ color: '#334155', fontSize: '0.86rem', fontWeight: 700 }}>
            Service Head: {team?.head?.name || 'Not assigned'}
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', color: '#475569' }}>
              <th style={{ padding: '0.8rem 1rem' }}>Name</th>
              <th style={{ padding: '0.8rem 1rem' }}>Login ID</th>
              <th style={{ padding: '0.8rem 1rem' }}>Team Role</th>
              <th style={{ padding: '0.8rem 1rem' }}>Designation</th>
              <th style={{ padding: '0.8rem 1rem' }}>Status</th>
              {canManageMembers && <th style={{ padding: '0.8rem 1rem' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.8rem 1rem', color: '#0f172a', fontWeight: 700 }}>{employee.name}</td>
                <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{employee.email}</td>
                <td style={{ padding: '0.8rem 1rem', color: '#7f22fe', fontWeight: 700 }}>
                  {ROLE_LABELS[employee.accessRole] || ROLE_LABELS.EMPLOYEE}
                </td>
                <td style={{ padding: '0.8rem 1rem', color: '#475569' }}>{employee.role}</td>
                <td style={{ padding: '0.8rem 1rem', color: employee.status === 'ACTIVE' ? '#047857' : '#b91c1c' }}>
                  {employee.status}
                </td>
                {canManageMembers && (
                  <td style={{ padding: '0.8rem 1rem' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmployee(employee)}
                      disabled={deletingEmployeeId !== null}
                      aria-label={`Remove ${employee.name} from this service team`}
                      style={{
                        padding: '0.4rem 0.7rem',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        color: '#b91c1c',
                        background: '#fff',
                        fontWeight: 700,
                        cursor: deletingEmployeeId !== null ? 'wait' : 'pointer',
                      }}
                    >
                      {deletingEmployeeId === employee.id ? 'Removing...' : 'Delete'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={canManageMembers ? 6 : 5} style={{ padding: '1.25rem', color: '#64748b', textAlign: 'center' }}>
                  No employees are assigned to this service team yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {canUseWorkBoard && (
        <div style={{ padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
          <ServiceWorkBoard
            activeCompany={activeCompany}
            serviceCode={normalizedCode}
            currentUser={currentUser}
            employees={employees}
          />
        </div>
      )}
    </section>
  );
}
