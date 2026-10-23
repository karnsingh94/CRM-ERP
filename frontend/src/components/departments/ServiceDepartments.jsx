'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCompanyAuthContext } from '../../context/CompanyAuthContext';
import { api } from '../../lib/api';
import { validateEmployeeForm } from '../../lib/employee-validation';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import ServiceWorkBoard from './ServiceWorkBoard';

const EMPTY_PERMISSIONS = {
  manageMembers: false,
  assignWork: false,
  updateWork: false,
  manageServiceRecords: false,
  featureAccess: { moduleIds: [], subModuleIds: [] },
};

const TEAM_PERMISSION_LABELS = [
  ['manageMembers', 'Add and manage service team members'],
  ['assignWork', 'Create and assign work to team members'],
  ['updateWork', 'Update and manage all team work'],
  ['manageServiceRecords', 'Create and update records in permitted modules'],
];

const ROLE_LABELS = {
  SERVICE_HEAD: 'Team Leader',
  TEAM_LEADER: 'Team Leader',
  EMPLOYEE: 'Employee',
};

const fieldStyle = {
  display: 'block',
  width: '100%',
  marginTop: '0.3rem',
  padding: '0.62rem 0.7rem',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  background: '#fff',
  color: '#0f172a',
  font: 'inherit',
  fontSize: '0.84rem',
};

export default function ServiceDepartments({
  activeCompany: providedCompany,
  serviceCode,
  currentUser: providedUser,
  showToast,
}) {
  const authContext = useCompanyAuthContext() || {};
  const activeCompany = providedCompany || authContext.activeCompany;
  const currentUser = providedUser || authContext.currentUser;
  const normalizedCode = (serviceCode || 'crm_sales').replace(/-/g, '_');
  const [teamData, setTeamData] = useState(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: '',
    password: '',
    isTeamLeader: false,
    permissions: EMPTY_PERMISSIONS,
  });
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const isAdmin = currentUser?.role === 'COMPANY_ADMIN';
  const isTeamLeader = ['SERVICE_HEAD', 'TEAM_LEADER'].includes(currentUser?.role);
  const selectedTeam = teamData?.teams?.find((team) => team.id === selectedTeamId) || null;
  const canManageMembers = isAdmin || (isTeamLeader && currentUser?.permissions?.manageMembers === true);
  const canUseWorkBoard = isAdmin || (
    isTeamLeader && (
      currentUser.permissions?.assignWork === true || currentUser.permissions?.updateWork === true
    )
  );

  const loadTeams = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get(
        `/companies/${activeCompany.id}/services/${normalizedCode}/teams`,
        { noCache: true }
      );
      setTeamData(response.data);
      setSelectedTeamId((previous) =>
        response.data?.teams?.some((team) => team.id === previous)
          ? previous
          : ''
      );
    } catch (loadError) {
      setError(loadError.message || 'Unable to load service teams.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.id, normalizedCode]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const resetEmployeeForm = () => {
    setNewEmployee({
      name: '',
      email: '',
      role: '',
      password: '',
      isTeamLeader: false,
      permissions: EMPTY_PERMISSIONS,
    });
  };

  const handleCreateTeam = async (event) => {
    event.preventDefault();
    setActionError('');
    setIsCreatingTeam(true);
    try {
      const response = await api.post(
        `/companies/${activeCompany.id}/services/${normalizedCode}/teams`,
        { name: teamName }
      );
      setTeamName('');
      setShowCreateTeam(false);
      await loadTeams();
      setSelectedTeamId(response.data.id.toString());
      showToast?.('Team Created', `${response.data.name} has been created.`, 'success');
    } catch (createError) {
      setActionError(createError.message || 'Could not create this team.');
      showToast?.('Team Not Created', createError.message || 'Could not create this team.', 'danger');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleCreateEmployee = async (event) => {
    event.preventDefault();
    if (!selectedTeam) return;
    setActionError('');
    const validationError = validateEmployeeForm(newEmployee);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setIsCreatingEmployee(true);
    try {
      const response = await api.post(`/companies/${activeCompany.id}/employees`, {
        name: newEmployee.name,
        email: newEmployee.email.trim().toLowerCase(),
        role: newEmployee.role.trim(),
        password: newEmployee.password,
        teamId: selectedTeam.id,
        serviceCode: normalizedCode,
        accessRole: newEmployee.isTeamLeader ? 'TEAM_LEADER' : 'EMPLOYEE',
        permissions: newEmployee.isTeamLeader ? newEmployee.permissions : undefined,
      });
      setTeamData((previous) => ({
        ...previous,
        teams: previous.teams.map((team) => {
          if (team.id !== selectedTeam.id) return team;
          const nextEmployees = [...team.employees, response.data];
          return {
            ...team,
            employees: nextEmployees,
            head: response.data.accessRole === 'TEAM_LEADER' ? response.data : team.head,
          };
        }),
      }));
      resetEmployeeForm();
      setShowCreateEmployee(false);
      showToast?.('Employee Added', `${response.data.name} has been added to ${selectedTeam.name}.`, 'success');
    } catch (createError) {
      setActionError(createError.message || 'Could not add this employee.');
      showToast?.('Employee Not Added', createError.message || 'Could not add this employee.', 'danger');
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  const handleRemoveEmployee = async (employee) => {
    if (!selectedTeam || !window.confirm(`Remove ${employee.name} from ${selectedTeam.name}? Their existing work history will be preserved.`)) {
      return;
    }

    setActionError('');
    setDeletingEmployeeId(employee.id);
    try {
      const response = await api.delete(
        `/companies/${activeCompany.id}/services/${normalizedCode}/teams/${selectedTeam.id}/employees/${employee.id}`
      );
      setTeamData(response.data);
      showToast?.('Employee Removed', `${employee.name} was removed from ${selectedTeam.name}.`, 'success');
    } catch (removeError) {
      setActionError(removeError.message || 'Could not remove this employee.');
      showToast?.('Employee Not Removed', removeError.message || 'Could not remove this employee.', 'danger');
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const toggleModule = (module) => {
    setNewEmployee((previous) => {
      const featureAccess = previous.permissions.featureAccess;
      const selected = featureAccess.moduleIds.includes(module.id);
      return {
        ...previous,
        permissions: {
          ...previous.permissions,
          featureAccess: {
            moduleIds: selected
              ? featureAccess.moduleIds.filter((id) => id !== module.id)
              : [...featureAccess.moduleIds, module.id],
            subModuleIds: featureAccess.subModuleIds.filter(
              (id) => !module.subModules.some((subModule) => subModule.id === id)
            ),
          },
        },
      };
    });
  };

  const toggleSubModule = (module, subModule) => {
    setNewEmployee((previous) => {
      const featureAccess = previous.permissions.featureAccess;
      const moduleSelected = featureAccess.moduleIds.includes(module.id);
      const currentlySelected = moduleSelected || featureAccess.subModuleIds.includes(subModule.id);
      const otherModuleSubIds = moduleSelected
        ? module.subModules.filter((entry) => entry.id !== subModule.id).map((entry) => entry.id)
        : [];
      const subModuleIds = featureAccess.subModuleIds.filter(
        (id) => !module.subModules.some((entry) => entry.id === id)
      );
      return {
        ...previous,
        permissions: {
          ...previous.permissions,
          featureAccess: {
            moduleIds: moduleSelected
              ? featureAccess.moduleIds.filter((id) => id !== module.id)
              : featureAccess.moduleIds,
            subModuleIds: currentlySelected
              ? [...subModuleIds, ...otherModuleSubIds]
              : [...subModuleIds, subModule.id],
          },
        },
      };
    });
  };

  if (isLoading) return <LoadingSkeleton rows={4} height="52px" />;
  if (error) {
    return (
      <div role="alert" style={{ padding: '1.25rem', borderRadius: '10px', background: '#fff7ed', color: '#9a3412' }}>
        {error}
      </div>
    );
  }

  const teams = teamData?.teams || [];
  const availableModules = teamData?.availableModules || [];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800 }}>
            {teamData?.service?.name || 'Service'}
          </h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.86rem' }}>
            Create teams, add employees, and assign Team Leaders access to approved service modules.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateTeam((visible) => !visible)}
            style={{ padding: '0.65rem 1rem', border: 0, borderRadius: '8px', color: '#fff', background: '#7f22fe', fontWeight: 700, cursor: 'pointer' }}
          >
            {showCreateTeam ? 'Cancel' : '+ Create Team'}
          </button>
        )}
      </header>

      {showCreateTeam && (
        <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
          <label style={{ flex: '1 1 240px', color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
            Team name
            <input required maxLength={150} value={teamName} onChange={(event) => setTeamName(event.target.value)} style={fieldStyle} />
          </label>
          <button type="submit" disabled={isCreatingTeam} style={{ padding: '0.65rem 1rem', border: 0, borderRadius: '8px', color: '#fff', background: isCreatingTeam ? '#94a3b8' : '#7f22fe', fontWeight: 700 }}>
            {isCreatingTeam ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      )}

      {actionError && <p role="alert" style={{ margin: 0, padding: '0.7rem 0.9rem', borderRadius: '8px', color: '#991b1b', background: '#fef2f2', fontSize: '0.84rem' }}>{actionError}</p>}

      {teams.length > 0 ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
            <label style={{ flex: '1 1 260px', maxWidth: '420px', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>
              Select team
              <select
                value={selectedTeamId}
                onChange={(event) => {
                  setSelectedTeamId(event.target.value);
                  setNewEmployee((previous) => ({
                    ...previous,
                    isTeamLeader: false,
                    permissions: EMPTY_PERMISSIONS,
                  }));
                }}
                style={fieldStyle}
              >
                <option value="">Choose a team</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            {canManageMembers && (
              <button
                type="button"
                disabled={!selectedTeam}
                onClick={() => setShowCreateEmployee((visible) => !visible)}
                style={{ padding: '0.65rem 1rem', border: 0, borderRadius: '8px', color: '#fff', background: selectedTeam ? '#7f22fe' : '#94a3b8', fontWeight: 700, cursor: selectedTeam ? 'pointer' : 'not-allowed' }}
              >
                {showCreateEmployee ? 'Cancel' : '+ Add Employee'}
              </button>
            )}
          </div>

          {showCreateEmployee && selectedTeam && (
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
                    style={fieldStyle}
                  />
                </label>
              ))}
              <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', gridColumn: '1 / -1', color: '#334155', fontSize: '0.85rem', fontWeight: 700 }}>
                <input
                  type="checkbox"
                  checked={newEmployee.isTeamLeader}
                  disabled={Boolean(selectedTeam.head)}
                  onChange={(event) => setNewEmployee((previous) => ({
                    ...previous,
                    isTeamLeader: event.target.checked,
                    permissions: EMPTY_PERMISSIONS,
                  }))}
                />
                Select as a Team Leader
                {selectedTeam.head && <span style={{ color: '#64748b', fontWeight: 500 }}>({selectedTeam.head.name} is already this team&apos;s leader)</span>}
              </label>

              {newEmployee.isTeamLeader && (
                <div style={{ gridColumn: '1 / -1', padding: '0.9rem', border: '1px solid #ddd6fe', borderRadius: '9px', background: '#fff' }}>
                  <h3 style={{ margin: '0 0 0.55rem', color: '#0f172a', fontSize: '0.92rem' }}>
                    Team Leader permissions — {teamData?.service?.name}
                  </h3>
                  <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.8rem' }}>
                    Select only modules or screens already approved for this company by Super Admin.
                  </p>
                  {availableModules.map((module) => {
                    const moduleSelected = newEmployee.permissions.featureAccess.moduleIds.includes(module.id);
                    return (
                      <fieldset key={module.id} style={{ margin: '0 0 0.7rem', padding: '0.65rem', border: '1px solid #e2e8f0', borderRadius: '7px' }}>
                        {module.fullAccess ? (
                          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#334155', fontWeight: 700, fontSize: '0.84rem' }}>
                            <input type="checkbox" checked={moduleSelected} onChange={() => toggleModule(module)} />
                            {module.name} — full module
                          </label>
                        ) : (
                          <strong style={{ display: 'block', color: '#334155', fontSize: '0.84rem' }}>{module.name}</strong>
                        )}
                        {!moduleSelected && module.subModules.map((subModule) => (
                          <label key={subModule.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.45rem 0 0 1.35rem', color: '#475569', fontSize: '0.82rem' }}>
                            <input
                              type="checkbox"
                              checked={newEmployee.permissions.featureAccess.subModuleIds.includes(subModule.id)}
                              onChange={() => toggleSubModule(module, subModule)}
                            />
                            {subModule.name}
                          </label>
                        ))}
                        {!module.subModules.length && <small style={{ display: 'block', margin: '0.4rem 0 0 1.35rem', color: '#64748b' }}>No active screens in this module.</small>}
                      </fieldset>
                    );
                  })}
                  {!availableModules.length && <p style={{ color: '#9a3412', fontSize: '0.82rem' }}>No Super Admin-approved modules are available for this service.</p>}

                  <h4 style={{ margin: '0.8rem 0 0.45rem', color: '#0f172a', fontSize: '0.85rem' }}>Team management permissions</h4>
                  {TEAM_PERMISSION_LABELS.map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.4rem 0', color: '#334155', fontSize: '0.82rem' }}>
                      <input
                        type="checkbox"
                        checked={newEmployee.permissions[key]}
                        onChange={(event) => setNewEmployee((previous) => ({
                          ...previous,
                          permissions: { ...previous.permissions, [key]: event.target.checked },
                        }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
              <button type="submit" disabled={isCreatingEmployee} style={{ alignSelf: 'end', justifySelf: 'start', padding: '0.65rem 1rem', border: 0, borderRadius: '8px', color: '#fff', background: isCreatingEmployee ? '#94a3b8' : '#7f22fe', fontWeight: 700, cursor: isCreatingEmployee ? 'wait' : 'pointer' }}>
                {isCreatingEmployee ? 'Adding...' : `Add to ${selectedTeam.name}`}
              </button>
            </form>
          )}

          {selectedTeam ? (
          <>
          <div style={{ padding: '1rem 1.1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
            <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>Team Leader</strong>
            <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.84rem' }}>
              {selectedTeam?.head ? `${selectedTeam.head.name} — ${selectedTeam.head.email}` : 'No Team Leader assigned yet.'}
            </p>
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
                {(selectedTeam?.employees || []).map((employee) => (
                  <tr key={employee.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.8rem 1rem', color: '#0f172a', fontWeight: 700 }}>{employee.name}</td>
                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{employee.email}</td>
                    <td style={{ padding: '0.8rem 1rem', color: '#7f22fe', fontWeight: 700 }}>
                      {ROLE_LABELS[employee.accessRole] || ROLE_LABELS.EMPLOYEE}
                    </td>
                    <td style={{ padding: '0.8rem 1rem', color: '#475569' }}>{employee.role}</td>
                    <td style={{ padding: '0.8rem 1rem', color: employee.status === 'ACTIVE' ? '#047857' : '#b91c1c' }}>{employee.status}</td>
                    {canManageMembers && (
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(employee)}
                          disabled={deletingEmployeeId !== null}
                          aria-label={`Remove ${employee.name} from ${selectedTeam.name}`}
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
                {!selectedTeam?.employees?.length && (
                  <tr>
                    <td colSpan={canManageMembers ? 6 : 5} style={{ padding: '1.25rem', color: '#64748b', textAlign: 'center' }}>
                      No employees are assigned to this team yet.
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
                employees={selectedTeam?.employees || []}
                teamId={selectedTeam?.id}
              />
            </div>
          )}
          </>
          ) : (
            <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', background: '#fff' }}>
              Choose a team to view its members and work.
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', background: '#fff' }}>
          No teams exist for this service yet. {isAdmin ? 'Create a team to start adding employees.' : ''}
        </div>
      )}
    </section>
  );
}
