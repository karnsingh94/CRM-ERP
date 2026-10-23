'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCompanyAuthContext } from '../../context/CompanyAuthContext';
import { api } from '../../lib/api';
import { validateEmployeeForm } from '../../lib/employee-validation';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import PermissionHierarchyTree from '../permissions/PermissionHierarchyTree';
import ServiceWorkBoard from './ServiceWorkBoard';

const EMPTY_PERMISSIONS = {
  manageMembers: false,
  manageTeams: false,
  assignWork: false,
  updateWork: false,
  manageServiceRecords: false,
  featureAccess: { moduleIds: [], subModuleIds: [] },
};

const DEFAULT_DEPT_HEAD_PERMISSIONS = {
  manageMembers: true,
  manageTeams: true,
  assignWork: true,
  updateWork: true,
  manageServiceRecords: true,
  featureAccess: { moduleIds: [], subModuleIds: [] },
};

const DEPT_HEAD_PERMISSION_LABELS = [
  ['manageTeams', 'Create and configure department teams and Team Heads'],
  ['manageMembers', 'Add and manage department employees & members'],
  ['assignWork', 'Create and assign work to department employees'],
  ['updateWork', 'Update, track, and manage all department work'],
  ['manageServiceRecords', 'Create and update records in permitted modules'],
];

const TEAM_PERMISSION_LABELS = [
  ['manageMembers', 'Add and manage team members'],
  ['assignWork', 'Create and assign work to team members'],
  ['updateWork', 'Update and manage all team work'],
  ['manageServiceRecords', 'Create and update records in permitted modules'],
];

const ROLE_LABELS = {
  DEPARTMENT_HEAD: 'Department Head',
  SERVICE_HEAD: 'Department Head',
  TEAM_LEADER: 'Team Leader',
  EMPLOYEE: 'Employee',
};

const fieldStyle = {
  display: 'block',
  width: '100%',
  marginTop: '0.35rem',
  padding: '0.62rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#0f172a',
  font: 'inherit',
  fontSize: '0.84rem',
};

function getEmployeeFeatureAccess(tree, modules, serviceId) {
  const serviceAccess = tree?.services?.find((service) => String(service.service_id) === String(serviceId));
  if (!serviceAccess) return { moduleIds: [], subModuleIds: [] };

  const moduleIds = [];
  const subModuleIds = [];
  (modules || []).forEach((module) => {
    const id = String(module.id);
    const access = serviceAccess.modules?.find((entry) => String(entry.module_id) === id);
    if (serviceAccess.full_service && module.fullAccess) {
      moduleIds.push(id);
    } else if (access?.access_mode === 'FULL') {
      moduleIds.push(id);
    }
    if (serviceAccess.full_service && !module.fullAccess) {
      subModuleIds.push(...(module.subModules || []).map((subModule) => String(subModule.id)));
    } else if (access?.access_mode === 'CUSTOM') {
      subModuleIds.push(...(access.sub_module_ids || []).map(String));
    }
  });

  return { moduleIds, subModuleIds };
}

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

  // Modal / Form toggles
  const [showCreateDeptHead, setShowCreateDeptHead] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);

  // Operation loading flags
  const [isCreatingDeptHead, setIsCreatingDeptHead] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [deletingDeptHeadId, setDeletingDeptHeadId] = useState(null);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState(null);

  // Form states
  const [teamName, setTeamName] = useState('');
  const [deptHeadPermissionTree, setDeptHeadPermissionTree] = useState({ services: [] });
  const [newDeptHead, setNewDeptHead] = useState({
    name: '',
    email: '',
    role: '',
    password: '',
    permissions: DEFAULT_DEPT_HEAD_PERMISSIONS,
  });

  const [employeePermissionTree, setEmployeePermissionTree] = useState({ services: [] });
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

  // Access Roles
  const isAdmin = currentUser?.role === 'COMPANY_ADMIN';
  const isDeptHead = currentUser?.role === 'DEPARTMENT_HEAD' || currentUser?.role === 'SERVICE_HEAD';
  const isTeamLeader = currentUser?.role === 'TEAM_LEADER';

  const canManageDeptHeads = isAdmin;
  const canManageTeams = isAdmin || (isDeptHead && currentUser?.permissions?.manageTeams !== false);
  const canManageMembers = isAdmin || (isDeptHead && currentUser?.permissions?.manageMembers !== false) || (isTeamLeader && currentUser?.permissions?.manageMembers === true);
  const canUseWorkBoard = isAdmin || canManageMembers || currentUser?.permissions?.assignWork === true || currentUser?.permissions?.updateWork === true;

  const selectedTeam = teamData?.teams?.find((team) => team.id === selectedTeamId) || null;

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
          : (response.data?.teams?.[0]?.id || '')
      );
    } catch (loadError) {
      setError(loadError.message || 'Unable to load department data.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.id, normalizedCode]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const resetDeptHeadForm = () => {
    setDeptHeadPermissionTree({ services: [] });
    setNewDeptHead({
      name: '',
      email: '',
      role: '',
      password: '',
      permissions: DEFAULT_DEPT_HEAD_PERMISSIONS,
    });
  };

  const resetEmployeeForm = () => {
    setEmployeePermissionTree({ services: [] });
    setNewEmployee({
      name: '',
      email: '',
      role: '',
      password: '',
      isTeamLeader: false,
      permissions: EMPTY_PERMISSIONS,
    });
  };

  // ==================== CREATE DEPARTMENT HEAD ====================
  const handleCreateDeptHead = async (event) => {
    event.preventDefault();
    setActionError('');
    const validationError = validateEmployeeForm(newDeptHead);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    setIsCreatingDeptHead(true);
    try {
      const response = await api.post(
        `/companies/${activeCompany.id}/services/${normalizedCode}/department-heads`,
        {
          name: newDeptHead.name.trim(),
          email: newDeptHead.email.trim().toLowerCase(),
          role: newDeptHead.role.trim() || 'Department Head',
          password: newDeptHead.password,
          permissions: newDeptHead.permissions,
        }
      );
      resetDeptHeadForm();
      setShowCreateDeptHead(false);
      await loadTeams();
      showToast?.('Department Head Created', `${response.data.name} is now a Department Head.`, 'success');
    } catch (createError) {
      setActionError(createError.message || 'Could not create Department Head.');
      showToast?.('Department Head Not Created', createError.message || 'Could not create Department Head.', 'danger');
    } finally {
      setIsCreatingDeptHead(false);
    }
  };

  // ==================== REMOVE DEPARTMENT HEAD ====================
  const handleRemoveDeptHead = async (deptHead) => {
    if (!window.confirm(`Remove ${deptHead.name} as Department Head? This will revoke their administrative dashboard access.`)) {
      return;
    }
    setActionError('');
    setDeletingDeptHeadId(deptHead.id);
    try {
      await api.delete(
        `/companies/${activeCompany.id}/services/${normalizedCode}/department-heads/${deptHead.id}`
      );
      await loadTeams();
      showToast?.('Department Head Removed', `${deptHead.name} was removed.`, 'success');
    } catch (removeError) {
      setActionError(removeError.message || 'Could not remove Department Head.');
      showToast?.('Removal Failed', removeError.message || 'Could not remove Department Head.', 'danger');
    } finally {
      setDeletingDeptHeadId(null);
    }
  };

  // ==================== CREATE TEAM ====================
  const handleCreateTeam = async (event) => {
    event.preventDefault();
    setActionError('');
    setIsCreatingTeam(true);
    try {
      const response = await api.post(
        `/companies/${activeCompany.id}/services/${normalizedCode}/teams`,
        { name: teamName.trim() }
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

  // ==================== ADD EMPLOYEE TO TEAM ====================
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
        name: newEmployee.name.trim(),
        email: newEmployee.email.trim().toLowerCase(),
        role: newEmployee.role.trim() || 'Team Member',
        password: newEmployee.password,
        teamId: selectedTeam.id,
        serviceCode: normalizedCode,
        accessRole: newEmployee.isTeamLeader ? 'TEAM_LEADER' : 'EMPLOYEE',
        permissions: newEmployee.isTeamLeader ? newEmployee.permissions : undefined,
      });
      setTeamData((previous) => ({
        ...previous,
        teams: (previous?.teams || []).map((team) => {
          if (team.id !== selectedTeam.id) return team;
          const nextEmployees = [...(team.employees || []), response.data];
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

  // ==================== REMOVE EMPLOYEE FROM TEAM ====================
  const handleRemoveEmployee = async (employee) => {
    if (!selectedTeam || !window.confirm(`Remove ${employee.name} from ${selectedTeam.name}? Their work history will be preserved.`)) {
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

  if (isLoading) return <LoadingSkeleton rows={4} height="52px" />;
  if (error) {
    return (
      <div role="alert" style={{ padding: '1.25rem', borderRadius: '10px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>
        {error}
      </div>
    );
  }

  const teams = teamData?.teams || [];
  const departmentHeads = teamData?.departmentHeads || [];
  const availableModules = teamData?.availableModules || [];
  const departmentName = teamData?.department?.name || teamData?.service?.name || 'Department';

  const permissionCatalog = teamData?.service
    ? [{
      ...teamData.service,
      modules: availableModules.map((module) => ({
        ...module,
        sub_modules: module.subModules,
      })),
    }]
    : [];

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ==================== DEPARTMENT HEADER ==================== */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.35rem' }}>🏢</span>
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.35rem', fontWeight: 800 }}>
              {departmentName} Department
            </h2>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '9999px', background: '#f5f0ff', color: '#7f22fe', border: '1px solid #ebdfff' }}>
              Service Department
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.86rem' }}>
            Manage Department Heads with granular permissions, organize teams, add employees, and assign department work.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          {canManageDeptHeads && (
            <button
              type="button"
              onClick={() => {
                setShowCreateDeptHead((v) => !v);
                setShowCreateTeam(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.62rem 1.1rem',
                border: '1px solid #7f22fe',
                borderRadius: '8px',
                color: showCreateDeptHead ? '#7f22fe' : '#ffffff',
                background: showCreateDeptHead ? '#f5f0ff' : '#7f22fe',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{showCreateDeptHead ? 'Cancel' : '+ Add Department Head'}</span>
            </button>
          )}

          {canManageTeams && (
            <button
              type="button"
              onClick={() => {
                setShowCreateTeam((v) => !v);
                setShowCreateDeptHead(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.62rem 1rem',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#334155',
                background: showCreateTeam ? '#f1f5f9' : '#ffffff',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{showCreateTeam ? 'Cancel' : '+ Create Team'}</span>
            </button>
          )}
        </div>
      </header>

      {actionError && (
        <p role="alert" style={{ margin: 0, padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.85rem' }}>
          {actionError}
        </p>
      )}

      {/* ==================== CREATE DEPARTMENT HEAD FORM ==================== */}
      {showCreateDeptHead && canManageDeptHeads && (
        <form onSubmit={handleCreateDeptHead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #ddd6fe', borderRadius: '14px', background: '#faf5ff' }}>
          <div>
            <h3 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '1.05rem', fontWeight: 800 }}>
              Create Department Head Account
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.83rem' }}>
              Assign an official Department Head for {departmentName}. They can log in with their email &amp; password and manage approved modules &amp; teams.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
            <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
              Full Name *
              <input
                required
                maxLength={100}
                placeholder="e.g. Anand Sharma"
                value={newDeptHead.name}
                onChange={(e) => {
                  setActionError('');
                  setNewDeptHead((prev) => ({ ...prev, name: e.target.value }));
                }}
                style={fieldStyle}
              />
            </label>

            <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
              Login ID / Work Email *
              <input
                required
                type="email"
                maxLength={254}
                placeholder="e.g. anand@company.com"
                value={newDeptHead.email}
                onChange={(e) => {
                  setActionError('');
                  setNewDeptHead((prev) => ({ ...prev, email: e.target.value }));
                }}
                style={fieldStyle}
              />
            </label>

            <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
              Designation
              <input
                maxLength={100}
                placeholder="e.g. Head of Sales"
                value={newDeptHead.role}
                onChange={(e) => {
                  setActionError('');
                  setNewDeptHead((prev) => ({ ...prev, role: e.target.value }));
                }}
                style={fieldStyle}
              />
            </label>

            <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
              Password (8+ chars) *
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                placeholder="Enter login password"
                value={newDeptHead.password}
                onChange={(e) => {
                  setActionError('');
                  setNewDeptHead((prev) => ({ ...prev, password: e.target.value }));
                }}
                style={fieldStyle}
              />
            </label>
          </div>

          {/* Department Head Permissions Tree */}
          <div style={{ padding: '1rem', border: '1px solid #ebdfff', borderRadius: '10px', background: '#ffffff' }}>
            <h4 style={{ margin: '0 0 0.4rem', color: '#0f172a', fontSize: '0.92rem', fontWeight: 800 }}>
              Module Access Permissions (Hierarchy Tree)
            </h4>
            <p style={{ margin: '0 0 0.8rem', color: '#64748b', fontSize: '0.82rem' }}>
              Select <strong>Full Service</strong> for all company-approved modules in {departmentName}, or choose <strong>CUSTOM</strong> to grant access to specific screens.
            </p>

            <PermissionHierarchyTree
              catalog={permissionCatalog}
              value={deptHeadPermissionTree}
              fixedServiceId={teamData?.service?.id}
              onChange={(tree) => {
                setDeptHeadPermissionTree(tree);
                setNewDeptHead((prev) => ({
                  ...prev,
                  permissions: {
                    ...prev.permissions,
                    featureAccess: getEmployeeFeatureAccess(tree, availableModules, teamData?.service?.id),
                  },
                }));
              }}
            />

            <h4 style={{ margin: '1rem 0 0.5rem', color: '#0f172a', fontSize: '0.88rem', fontWeight: 800 }}>
              Department Management Permissions
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.45rem' }}>
              {DEPT_HEAD_PERMISSION_LABELS.map(([key, label]) => (
                <label key={key} style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', color: '#334155', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newDeptHead.permissions[key] !== false}
                    onChange={(e) => setNewDeptHead((prev) => ({
                      ...prev,
                      permissions: { ...prev.permissions, [key]: e.target.checked },
                    }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setShowCreateDeptHead(false)}
              style={{ padding: '0.62rem 1.15rem', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', background: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingDeptHead}
              style={{ padding: '0.62rem 1.35rem', border: 0, borderRadius: '8px', color: '#ffffff', background: isCreatingDeptHead ? '#94a3b8' : '#7f22fe', fontWeight: 700, cursor: isCreatingDeptHead ? 'wait' : 'pointer' }}
            >
              {isCreatingDeptHead ? 'Creating Department Head...' : 'Save Department Head'}
            </button>
          </div>
        </form>
      )}

      {/* ==================== CREATE TEAM FORM ==================== */}
      {showCreateTeam && canManageTeams && (
        <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap', padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
          <label style={{ flex: '1 1 240px', color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
            Team Name *
            <input
              required
              maxLength={150}
              placeholder="e.g. Sales Outreach Team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              style={fieldStyle}
            />
          </label>
          <button
            type="submit"
            disabled={isCreatingTeam}
            style={{ padding: '0.65rem 1.2rem', border: 0, borderRadius: '8px', color: '#ffffff', background: isCreatingTeam ? '#94a3b8' : '#7f22fe', fontWeight: 700, cursor: isCreatingTeam ? 'wait' : 'pointer' }}
          >
            {isCreatingTeam ? 'Creating...' : 'Create Team'}
          </button>
        </form>
      )}

      {/* ==================== SECTION 1: DEPARTMENT HEADS ==================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: 800 }}>
              Department Heads ({departmentHeads.length})
            </h3>
            <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
              Responsible leaders overseeing this department with modular access permissions.
            </p>
          </div>
        </div>

        {departmentHeads.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.8rem 1rem' }}>Name</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Login ID</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Designation</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Role</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Capabilities</th>
                  <th style={{ padding: '0.8rem 1rem' }}>Status</th>
                  {canManageDeptHeads && <th style={{ padding: '0.8rem 1rem' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {departmentHeads.map((head) => (
                  <tr key={head.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.8rem 1rem', color: '#0f172a', fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>👤</span>
                        <span>{head.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', color: '#64748b' }}>{head.email}</td>
                    <td style={{ padding: '0.8rem 1rem', color: '#334155' }}>{head.role || 'Department Head'}</td>
                    <td style={{ padding: '0.8rem 1rem' }}>
                      <span style={{ padding: '0.2rem 0.55rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#f5f0ff', color: '#7f22fe', border: '1px solid #ebdfff' }}>
                        Department Head
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {head.permissions?.manageTeams && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                            Teams
                          </span>
                        )}
                        {head.permissions?.manageMembers && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                            Members
                          </span>
                        )}
                        {head.permissions?.assignWork && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                            Work
                          </span>
                        )}
                        {head.permissions?.manageServiceRecords && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', background: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff' }}>
                            Records
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', color: head.status === 'ACTIVE' ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                      {head.status}
                    </td>
                    {canManageDeptHeads && (
                      <td style={{ padding: '0.8rem 1rem' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveDeptHead(head)}
                          disabled={deletingDeptHeadId !== null}
                          aria-label={`Remove ${head.name} as Department Head`}
                          style={{
                            padding: '0.35rem 0.65rem',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#b91c1c',
                            background: '#ffffff',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            cursor: deletingDeptHeadId !== null ? 'wait' : 'pointer',
                          }}
                        >
                          {deletingDeptHeadId === head.id ? 'Removing...' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>
                No Department Head assigned yet for {departmentName}.
              </p>
              <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                Create a Department Head to delegate team leadership, staff assignment, and module control.
              </p>
            </div>
            {canManageDeptHeads && (
              <button
                type="button"
                onClick={() => setShowCreateDeptHead(true)}
                style={{ padding: '0.5rem 0.9rem', border: '1px solid #7f22fe', borderRadius: '7px', color: '#7f22fe', background: '#f5f0ff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                + Add Department Head
              </button>
            )}
          </div>
        )}
      </div>

      {/* ==================== SECTION 2: DEPARTMENT TEAMS & EMPLOYEES ==================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.05rem', fontWeight: 800 }}>
              Department Teams ({teams.length})
            </h3>
            <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
              Teams working under {departmentName}. Select a team to manage members and leaders.
            </p>
          </div>
        </div>

        {teams.length > 0 ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff' }}>
              <label style={{ flex: '1 1 260px', maxWidth: '420px', color: '#334155', fontSize: '0.84rem', fontWeight: 700 }}>
                Select Team
                <select
                  value={selectedTeamId}
                  onChange={(event) => {
                    setSelectedTeamId(event.target.value);
                    resetEmployeeForm();
                  }}
                  style={fieldStyle}
                >
                  <option value="">Choose a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.employees?.length || 0} members)
                    </option>
                  ))}
                </select>
              </label>

              {canManageMembers && selectedTeam && (
                <button
                  type="button"
                  onClick={() => setShowCreateEmployee((visible) => !visible)}
                  style={{
                    padding: '0.65rem 1rem',
                    border: 0,
                    borderRadius: '8px',
                    color: '#ffffff',
                    background: '#7f22fe',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  {showCreateEmployee ? 'Cancel' : '+ Add Employee to Team'}
                </button>
              )}
            </div>

            {/* Form to add employee to team */}
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

                <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', gridColumn: '1 / -1', color: '#334155', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newEmployee.isTeamLeader}
                    disabled={Boolean(selectedTeam.head)}
                    onChange={(event) => {
                      setEmployeePermissionTree({ services: [] });
                      setNewEmployee((previous) => ({
                        ...previous,
                        isTeamLeader: event.target.checked,
                        permissions: EMPTY_PERMISSIONS,
                      }));
                    }}
                  />
                  Designate as Team Leader
                  {selectedTeam.head && (
                    <span style={{ color: '#64748b', fontWeight: 500 }}>
                      ({selectedTeam.head.name} is already this team&apos;s leader)
                    </span>
                  )}
                </label>

                {newEmployee.isTeamLeader && (
                  <div style={{ gridColumn: '1 / -1', padding: '0.9rem', border: '1px solid #ddd6fe', borderRadius: '9px', background: '#ffffff' }}>
                    <h4 style={{ margin: '0 0 0.45rem', color: '#0f172a', fontSize: '0.95rem', fontWeight: 800 }}>
                      Team Leader Permissions (Hierarchy Tree)
                    </h4>
                    <p style={{ margin: '0 0 0.75rem', color: '#64748b', fontSize: '0.82rem' }}>
                      Choose modules and screens this Team Leader can access within {departmentName}.
                    </p>
                    <PermissionHierarchyTree
                      catalog={permissionCatalog}
                      value={employeePermissionTree}
                      fixedServiceId={teamData?.service?.id}
                      onChange={(tree) => {
                        setEmployeePermissionTree(tree);
                        setNewEmployee((previous) => ({
                          ...previous,
                          permissions: {
                            ...previous.permissions,
                            featureAccess: getEmployeeFeatureAccess(
                              tree,
                              availableModules,
                              teamData?.service?.id
                            ),
                          },
                        }));
                      }}
                    />

                    <h5 style={{ margin: '0.8rem 0 0.45rem', color: '#0f172a', fontSize: '0.85rem' }}>
                      Team Action Permissions
                    </h5>
                    {TEAM_PERMISSION_LABELS.map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.4rem 0', color: '#334155', fontSize: '0.82rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newEmployee.permissions[key]}
                          onChange={(event) => setNewEmployee((previous) => ({
                            ...previous,
                            permissions: { ...previous.permissions, [key]: event.target.checked },
                          }))}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCreatingEmployee}
                  style={{ alignSelf: 'end', justifySelf: 'start', padding: '0.65rem 1.1rem', border: 0, borderRadius: '8px', color: '#ffffff', background: isCreatingEmployee ? '#94a3b8' : '#7f22fe', fontWeight: 700, cursor: isCreatingEmployee ? 'wait' : 'pointer' }}
                >
                  {isCreatingEmployee ? 'Adding...' : `Add to ${selectedTeam.name}`}
                </button>
              </form>
            )}

            {selectedTeam ? (
              <>
                <div style={{ padding: '1rem 1.1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>Team Leader:</strong>
                    <span style={{ marginLeft: '0.5rem', color: selectedTeam.head ? '#7f22fe' : '#64748b', fontWeight: 700, fontSize: '0.86rem' }}>
                      {selectedTeam?.head ? `${selectedTeam.head.name} (${selectedTeam.head.email})` : 'No Team Leader appointed yet.'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {selectedTeam?.employees?.length || 0} Total Team Members
                  </span>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
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
                          <td style={{ padding: '0.8rem 1rem', color: employee.status === 'ACTIVE' ? '#047857' : '#b91c1c', fontWeight: 600 }}>
                            {employee.status}
                          </td>
                          {canManageMembers && (
                            <td style={{ padding: '0.8rem 1rem' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveEmployee(employee)}
                                disabled={deletingEmployeeId !== null}
                                aria-label={`Remove ${employee.name} from ${selectedTeam.name}`}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  color: '#b91c1c',
                                  background: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.78rem',
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

                {/* ==================== WORK BOARD ==================== */}
                {canUseWorkBoard && (
                  <div style={{ padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff' }}>
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
              <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', background: '#ffffff' }}>
                Choose a team to view its members and work.
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.88rem', fontWeight: 600 }}>
                No teams exist for {departmentName} yet.
              </p>
              <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                Create a team to add employees and designate Team Leaders.
              </p>
            </div>
            {canManageTeams && (
              <button
                type="button"
                onClick={() => setShowCreateTeam(true)}
                style={{ padding: '0.5rem 0.9rem', border: '1px solid #7f22fe', borderRadius: '7px', color: '#7f22fe', background: '#f5f0ff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                + Create Team
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
