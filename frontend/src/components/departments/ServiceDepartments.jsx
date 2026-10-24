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

const IconEye = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = ({ size = 15, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="23" x2="23" y2="1" />
  </svg>
);

const DEPT_HEAD_PERMISSION_CONFIG = [
  {
    key: 'manageTeams',
    title: 'Teams & Team Heads',
    desc: 'Create and configure department teams, assign Team Leaders, and manage hierarchy.',
    icon: '👥',
  },
  {
    key: 'manageMembers',
    title: 'Department Employees',
    desc: 'Add, view, manage, and assign employees across all teams in this department.',
    icon: '👤',
  },
  {
    key: 'assignWork',
    title: 'Work Assignment',
    desc: 'Create, allocate, and distribute tasks and projects to department employees.',
    icon: '📋',
  },
  {
    key: 'updateWork',
    title: 'Work Tracking & Status',
    desc: 'Update progress, track milestones, and oversee execution of department work.',
    icon: '📈',
  },
  {
    key: 'manageServiceRecords',
    title: 'Module Records Access',
    desc: 'Create, edit, and update records and transactions within permitted modules.',
    icon: '⚡',
  },
];

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

function buildTreeFromEmployeePermissions(permissions, availableModules, serviceId) {
  if (!serviceId) return { services: [] };
  const featureAccess = permissions?.featureAccess || { moduleIds: [], subModuleIds: [] };
  const permittedModuleIds = new Set((featureAccess.moduleIds || []).map(String));
  const permittedSubModuleIds = new Set((featureAccess.subModuleIds || []).map(String));

  const modulesList = availableModules || [];
  const allModulesPermitted = modulesList.length > 0 && modulesList.every((m) => permittedModuleIds.has(String(m.id)));

  const modules = [];
  modulesList.forEach((m) => {
    const modId = String(m.id);
    if (permittedModuleIds.has(modId)) {
      modules.push({
        module_id: modId,
        access_mode: 'FULL',
        sub_module_ids: (m.subModules || []).map((subModule) => String(subModule.id)),
      });
    } else {
      const allowedSubs = (m.subModules || [])
        .map((subModule) => String(subModule.id))
        .filter((subId) => permittedSubModuleIds.has(subId));
      if (allowedSubs.length > 0) {
        modules.push({
          module_id: modId,
          access_mode: 'CUSTOM',
          sub_module_ids: allowedSubs,
        });
      }
    }
  });

  return {
    services: [
      {
        service_id: String(serviceId),
        full_service: allModulesPermitted,
        modules,
      },
    ],
  };
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
  const [editingDeptHeadId, setEditingDeptHeadId] = useState(null);
  const [togglingDeptHeadId, setTogglingDeptHeadId] = useState(null);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [togglingTeamId, setTogglingTeamId] = useState(null);
  const [togglingEmployeeId, setTogglingEmployeeId] = useState(null);
  const [activeTeamTab, setActiveTeamTab] = useState('members');

  // Form states
  const [teamFormData, setTeamFormData] = useState({
    name: '',
    description: '',
    headEmployeeId: '',
  });
  const [deptHeadPermissionTree, setDeptHeadPermissionTree] = useState({ services: [] });
  const [newDeptHead, setNewDeptHead] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    password: '',
    permissions: DEFAULT_DEPT_HEAD_PERMISSIONS,
  });
  const [showDeptHeadPassword, setShowDeptHeadPassword] = useState(false);

  const [employeePermissionTree, setEmployeePermissionTree] = useState({ services: [] });
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    password: '',
    isTeamLeader: false,
    permissions: EMPTY_PERMISSIONS,
  });
  const [showEmployeePassword, setShowEmployeePassword] = useState(false);

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
    setEditingDeptHeadId(null);
    setDeptHeadPermissionTree({ services: [] });
    setNewDeptHead({
      name: '',
      email: '',
      phone: '',
      role: '',
      password: '',
      permissions: DEFAULT_DEPT_HEAD_PERMISSIONS,
    });
    setShowDeptHeadPassword(false);
  };

  const resetEmployeeForm = () => {
    setEmployeePermissionTree({ services: [] });
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      role: '',
      password: '',
      isTeamLeader: false,
      permissions: EMPTY_PERMISSIONS,
    });
    setShowEmployeePassword(false);
  };

  // ==================== CREATE / UPDATE DEPARTMENT HEAD ====================
  const handleCreateDeptHead = async (event) => {
    event.preventDefault();
    setActionError('');

    if (editingDeptHeadId) {
      if (!newDeptHead.name || newDeptHead.name.trim().length < 2) {
        setActionError('Full name must be at least 2 characters.');
        return;
      }
      if (!newDeptHead.phone || newDeptHead.phone.trim().length !== 10) {
        setActionError('A valid 10-digit mobile number is required.');
        return;
      }
      if (newDeptHead.password && newDeptHead.password.trim().length < 8) {
        setActionError('New password must be at least 8 characters long.');
        return;
      }
    } else {
      const validationError = validateEmployeeForm(newDeptHead, { requirePhone: true });
      if (validationError) {
        setActionError(validationError);
        return;
      }
    }

    setIsCreatingDeptHead(true);
    try {
      if (editingDeptHeadId) {
        const payload = {
          name: newDeptHead.name.trim(),
          phone: newDeptHead.phone.trim(),
          role: newDeptHead.role.trim() || 'Department Head',
          permissions: newDeptHead.permissions,
        };
        if (newDeptHead.password && newDeptHead.password.trim().length >= 8) {
          payload.password = newDeptHead.password.trim();
        }

        const response = await api.put(
          `/companies/${activeCompany.id}/services/${normalizedCode}/department-heads/${editingDeptHeadId}`,
          payload
        );

        setTeamData((prev) => ({
          ...prev,
          departmentHeads: (prev?.departmentHeads || []).map((head) =>
            head.id === editingDeptHeadId ? { ...head, ...response.data } : head
          ),
        }));

        resetDeptHeadForm();
        setShowCreateDeptHead(false);
        showToast?.('Department Head Saved', `${response.data.name}'s permissions and profile updated.`, 'success');
      } else {
        const response = await api.post(
          `/companies/${activeCompany.id}/services/${normalizedCode}/department-heads`,
          {
            name: newDeptHead.name.trim(),
            email: newDeptHead.email.trim().toLowerCase(),
            phone: newDeptHead.phone.trim(),
            role: newDeptHead.role.trim() || 'Department Head',
            password: newDeptHead.password,
            permissions: newDeptHead.permissions,
          }
        );
        resetDeptHeadForm();
        setShowCreateDeptHead(false);
        await loadTeams();
        showToast?.('Department Head Created', `${response.data.name} is now a Department Head.`, 'success');
      }
    } catch (saveError) {
      setActionError(saveError.message || `Could not ${editingDeptHeadId ? 'update' : 'create'} Department Head.`);
      showToast?.(`Department Head Not ${editingDeptHeadId ? 'Updated' : 'Created'}`, saveError.message || 'Operation failed.', 'danger');
    } finally {
      setIsCreatingDeptHead(false);
    }
  };

  // ==================== EDIT DEPARTMENT HEAD ====================
  const handleEditDeptHead = (head) => {
    setActionError('');
    setEditingDeptHeadId(head.id);
    setNewDeptHead({
      name: head.name || '',
      email: head.email || '',
      phone: head.phone || '',
      role: head.role || '',
      password: '',
      permissions: head.permissions || DEFAULT_DEPT_HEAD_PERMISSIONS,
    });

    const tree = buildTreeFromEmployeePermissions(
      head.permissions,
      teamData?.availableModules || [],
      teamData?.service?.id
    );
    setDeptHeadPermissionTree(tree);
    setShowCreateDeptHead(true);
    setShowCreateTeam(false);
    setShowCreateEmployee(false);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  // ==================== TOGGLE DEPARTMENT HEAD STATUS ====================
  const handleToggleDeptHeadStatus = async (head) => {
    setActionError('');
    setTogglingDeptHeadId(head.id);
    const targetStatus = head.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await api.patch(
        `/companies/${activeCompany.id}/services/${normalizedCode}/department-heads/${head.id}/status`
      );
      setTeamData((prev) => ({
        ...prev,
        departmentHeads: (prev?.departmentHeads || []).map((h) =>
          h.id === head.id ? { ...h, status: response.data?.status || targetStatus } : h
        ),
      }));
      showToast?.(
        `Department Head ${targetStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'}`,
        `${head.name} is now ${targetStatus.toLowerCase()}.`,
        'success'
      );
    } catch (toggleError) {
      setActionError(toggleError.message || 'Could not change status.');
      showToast?.('Status Change Failed', toggleError.message || 'Could not change status.', 'danger');
    } finally {
      setTogglingDeptHeadId(null);
    }
  };

  // ==================== CREATE / UPDATE TEAM ====================
  const handleCreateTeam = async (event) => {
    event.preventDefault();
    setActionError('');
    if (!teamFormData.name || !teamFormData.name.trim()) {
      setActionError('Team name is required.');
      return;
    }
    setIsCreatingTeam(true);
    try {
      if (editingTeamId) {
        const response = await api.put(
          `/companies/${activeCompany.id}/services/${normalizedCode}/teams/${editingTeamId}`,
          {
            name: teamFormData.name.trim(),
            description: teamFormData.description?.trim() || null,
          }
        );
        setTeamData((prev) => ({
          ...prev,
          teams: (prev?.teams || []).map((t) => (t.id === editingTeamId ? { ...t, ...response.data } : t)),
        }));
        setEditingTeamId(null);
        setTeamFormData({ name: '', description: '', headEmployeeId: '' });
        setShowCreateTeam(false);
        showToast?.('Team Saved', `${response.data.name} details updated.`, 'success');
      } else {
        const response = await api.post(
          `/companies/${activeCompany.id}/services/${normalizedCode}/teams`,
          {
            name: teamFormData.name.trim(),
            description: teamFormData.description?.trim() || null,
            headEmployeeId: teamFormData.headEmployeeId || undefined,
          }
        );
        setTeamFormData({ name: '', description: '', headEmployeeId: '' });
        setShowCreateTeam(false);
        await loadTeams();
        setSelectedTeamId(response.data.id.toString());
        showToast?.('Team Created', `${response.data.name} has been created in ${departmentName}.`, 'success');
      }
    } catch (createError) {
      setActionError(createError.message || 'Could not save team.');
      showToast?.('Team Operation Failed', createError.message || 'Could not save team.', 'danger');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  // ==================== TOGGLE TEAM STATUS ====================
  const handleToggleTeamStatus = async (team) => {
    setActionError('');
    setTogglingTeamId(team.id);
    const targetStatus = team.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await api.patch(
        `/companies/${activeCompany.id}/services/${normalizedCode}/teams/${team.id}/status`
      );
      setTeamData((prev) => ({
        ...prev,
        teams: (prev?.teams || []).map((t) =>
          t.id === team.id ? { ...t, status: response.data?.status || targetStatus } : t
        ),
      }));
      showToast?.(
        `Team ${targetStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'}`,
        `${team.name} is now ${targetStatus.toLowerCase()}.`,
        'success'
      );
    } catch (toggleErr) {
      setActionError(toggleErr.message || 'Could not toggle team status.');
      showToast?.('Status Change Failed', toggleErr.message || 'Could not toggle team status.', 'danger');
    } finally {
      setTogglingTeamId(null);
    }
  };

  // ==================== TOGGLE EMPLOYEE STATUS ====================
  const handleToggleEmployeeStatus = async (employee) => {
    setActionError('');
    setTogglingEmployeeId(employee.id);
    const targetStatus = employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const response = await api.patch(
        `/companies/${activeCompany.id}/employees/${employee.id}/status`
      );
      setTeamData((prev) => ({
        ...prev,
        teams: (prev?.teams || []).map((t) => {
          if (!t.employees) return t;
          return {
            ...t,
            employees: t.employees.map((emp) =>
              emp.id === employee.id ? { ...emp, status: response.data?.status || targetStatus } : emp
            ),
          };
        }),
      }));
      showToast?.(
        `Employee ${targetStatus === 'ACTIVE' ? 'Activated' : 'Deactivated'}`,
        `${employee.name} is now ${targetStatus.toLowerCase()}.`,
        'success'
      );
    } catch (toggleErr) {
      setActionError(toggleErr.message || 'Could not change employee status.');
      showToast?.('Status Change Failed', toggleErr.message || 'Could not change employee status.', 'danger');
    } finally {
      setTogglingEmployeeId(null);
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
        phone: newEmployee.phone?.trim() || undefined,
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
                if (showCreateDeptHead) {
                  setShowCreateDeptHead(false);
                  resetDeptHeadForm();
                } else {
                  resetDeptHeadForm();
                  setShowCreateDeptHead(true);
                  setShowCreateTeam(false);
                }
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
              <span>{showCreateDeptHead ? (editingDeptHeadId ? 'Cancel Edit' : 'Cancel') : '+ Add Department Head'}</span>
            </button>
          )}

        </div>
      </header>

      {actionError && (
        <p role="alert" style={{ margin: 0, padding: '0.75rem 1rem', borderRadius: '8px', color: '#991b1b', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '0.85rem' }}>
          {actionError}
        </p>
      )}

      {/* ==================== CREATE / EDIT DEPARTMENT HEAD FORM ==================== */}
      {showCreateDeptHead && canManageDeptHeads && (
        <form onSubmit={handleCreateDeptHead} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem 1.5rem', border: '1px solid #ddd6fe', borderRadius: '14px', background: '#faf5ff' }}>
          <div>
            <h3 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '1.05rem', fontWeight: 800 }}>
              {editingDeptHeadId ? `Edit Department Head: ${newDeptHead.name}` : 'Create Department Head Account'}
            </h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.83rem' }}>
              {editingDeptHeadId
                ? `Update details and modular permissions for ${newDeptHead.name}.`
                : `Assign an official Department Head for ${departmentName}. They can log in with their email & password and manage approved modules & teams.`}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
            {/* Full Name */}
            <div>
              <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                Full Name *
              </label>
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
            </div>

            {/* Login Email */}
            <div>
              <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                Login ID / Work Email {editingDeptHeadId ? '(Immutable)' : '*'}
              </label>
              <input
                required
                type="email"
                disabled={Boolean(editingDeptHeadId)}
                maxLength={254}
                placeholder="e.g. anand@company.com"
                value={newDeptHead.email}
                onChange={(e) => {
                  setActionError('');
                  setNewDeptHead((prev) => ({ ...prev, email: e.target.value }));
                }}
                style={{
                  ...fieldStyle,
                  ...(editingDeptHeadId ? { background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' } : {}),
                }}
              />
            </div>

            {/* Mobile / Phone Number */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                  Mobile / Phone Number *
                </label>
                <span style={{ fontSize: '0.73rem', color: (newDeptHead.phone || '').length === 10 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                  {(newDeptHead.phone || '').length} / 10 digits
                </span>
              </div>
              <input
                required
                type="tel"
                maxLength={10}
                placeholder="e.g. 9876543210 (10 digits)"
                value={newDeptHead.phone || ''}
                onChange={(e) => {
                  setActionError('');
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setNewDeptHead((prev) => ({ ...prev, phone: val }));
                }}
                style={fieldStyle}
              />
              {newDeptHead.phone && newDeptHead.phone.length > 0 && !/^[6-9]/.test(newDeptHead.phone) && (
                <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
                  ⚠️ Must start with 6, 7, 8, or 9 (starts with 5 or below rejected)
                </div>
              )}
              {newDeptHead.phone && newDeptHead.phone.length > 0 && newDeptHead.phone.length < 10 && /^[6-9]/.test(newDeptHead.phone) && (
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Enter remaining {10 - newDeptHead.phone.length} digits
                </div>
              )}
            </div>

            {/* Designation */}
            <div>
              <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                Designation
              </label>
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
            </div>
          </div>

          {/* Password with Show/Hide and SuperAdmin Live Validation */}
          <div style={{ maxWidth: '440px' }}>
            <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
              {editingDeptHeadId ? 'New Password (leave blank to keep current)' : 'Password (8+ chars) *'}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                required={!editingDeptHeadId}
                type={showDeptHeadPassword ? 'text' : 'password'}
                minLength={editingDeptHeadId ? 0 : 8}
                maxLength={128}
                placeholder={editingDeptHeadId ? '•••••••• (leave blank to keep current)' : 'e.g. DeptHead@2026!'}
                value={newDeptHead.password}
                onChange={(e) => {
                  setActionError('');
                  setNewDeptHead((prev) => ({ ...prev, password: e.target.value }));
                }}
                style={{ ...fieldStyle, paddingRight: '4.75rem', marginTop: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowDeptHeadPassword(!showDeptHeadPassword)}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.45rem',
                  borderRadius: '6px',
                  userSelect: 'none',
                }}
                title={showDeptHeadPassword ? 'Hide password' : 'Show password'}
                aria-label={showDeptHeadPassword ? 'Hide password' : 'Show password'}
              >
                {showDeptHeadPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                <span>{showDeptHeadPassword ? 'Hide' : 'Show'}</span>
              </button>
            </div>

            {/* Live Password Rules Indicator */}
            {(!editingDeptHeadId || (newDeptHead.password && newDeptHead.password.length > 0)) && (
              <div style={{
                marginTop: '0.45rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.22rem',
                fontSize: '0.73rem',
                padding: '0.5rem 0.65rem',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}>
                <span style={{
                  color: (newDeptHead.password || '').length >= 8 ? '#16a34a' : '#64748b',
                  fontWeight: (newDeptHead.password || '').length >= 8 ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}>
                  <span>{(newDeptHead.password || '').length >= 8 ? '✅' : '○'}</span> At least 8 characters
                </span>
                <span style={{
                  color: /[A-Z]/.test(newDeptHead.password || '') ? '#16a34a' : '#64748b',
                  fontWeight: /[A-Z]/.test(newDeptHead.password || '') ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}>
                  <span>{/[A-Z]/.test(newDeptHead.password || '') ? '✅' : '○'}</span> At least 1 uppercase letter (A-Z)
                </span>
                <span style={{
                  color: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newDeptHead.password || '') ? '#16a34a' : '#64748b',
                  fontWeight: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newDeptHead.password || '') ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}>
                  <span>{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newDeptHead.password || '') ? '✅' : '○'}</span> At least 1 special character (!@#$%^&* etc.)
                </span>
              </div>
            )}
          </div>

          {/* Department Head Permissions Tree */}
          <div style={{ padding: '1.1rem 1.25rem', border: '1px solid #ebdfff', borderRadius: '12px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.35rem', color: '#0f172a', fontSize: '0.94rem', fontWeight: 800 }}>
                Module Access Permissions (Hierarchy Tree)
              </h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
                Select <strong>Full Service</strong> for all company-approved modules in {departmentName}, or choose <strong>CUSTOM</strong> to grant access to specific screens.
              </p>
            </div>

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

            {/* Department Management Permissions Cards */}
            <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <h4 style={{ margin: '0 0 0.25rem', color: '#0f172a', fontSize: '0.92rem', fontWeight: 800 }}>
                  Department Management Permissions
                </h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.81rem' }}>
                  Choose which administrative management actions this Department Head can perform in {departmentName}.
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem',
              }}>
                {DEPT_HEAD_PERMISSION_CONFIG.map(({ key, title, desc, icon }) => {
                  const isChecked = newDeptHead.permissions[key] !== false;
                  return (
                    <label
                      key={key}
                      style={{
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'flex-start',
                        padding: '0.8rem 1rem',
                        borderRadius: '10px',
                        border: isChecked ? '1px solid #c4b5fd' : '1px solid #e2e8f0',
                        background: isChecked ? '#faf5ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => setNewDeptHead((prev) => ({
                          ...prev,
                          permissions: { ...prev.permissions, [key]: e.target.checked },
                        }))}
                        style={{
                          marginTop: '0.2rem',
                          accentColor: '#7f22fe',
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '1rem' }}>{icon}</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>{title}</span>
                        </div>
                        <span style={{ fontSize: '0.76rem', color: '#64748b', lineHeight: 1.4 }}>{desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => {
                setShowCreateDeptHead(false);
                resetDeptHeadForm();
              }}
              style={{ padding: '0.62rem 1.15rem', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', background: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingDeptHead}
              style={{
                padding: '0.62rem 1.4rem',
                border: 0,
                borderRadius: '8px',
                color: '#ffffff',
                background: isCreatingDeptHead ? '#94a3b8' : '#7f22fe',
                fontWeight: 700,
                cursor: isCreatingDeptHead ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 6px rgba(127, 34, 254, 0.25)',
              }}
            >
              {isCreatingDeptHead
                ? (editingDeptHeadId ? 'Saving Changes...' : 'Creating Department Head...')
                : (editingDeptHeadId ? 'Save Department Head' : '+ Create Department Head')}
            </button>
          </div>
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
                  <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Name</th>
                  <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Login ID</th>
                  <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Designation</th>
                  <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Role</th>
                  <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Capabilities</th>
                  <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                  {canManageDeptHeads && <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {departmentHeads.map((head) => (
                  <tr key={head.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.8rem 1rem', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem' }}>👤</span>
                        <span>{head.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      <div style={{ color: '#0f172a', fontWeight: 600 }}>{head.email}</div>
                      {head.phone && (
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>📞</span> {head.phone}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.8rem 1rem', color: '#334155', whiteSpace: 'nowrap' }}>
                      {head.role || 'Department Head'}
                    </td>
                    <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                      <span style={{ padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#f5f0ff', color: '#7f22fe', border: '1px solid #ebdfff', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        Department Head
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                        {head.permissions?.manageTeams && (
                          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                            Teams
                          </span>
                        )}
                        {head.permissions?.manageMembers && (
                          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                            Members
                          </span>
                        )}
                        {head.permissions?.assignWork && (
                          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', whiteSpace: 'nowrap' }}>
                            Work
                          </span>
                        )}
                        {head.permissions?.manageServiceRecords && (
                          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600, background: '#faf5ff', color: '#6b21a8', border: '1px solid #e9d5ff', whiteSpace: 'nowrap' }}>
                            Records
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleDeptHeadStatus(head)}
                        disabled={togglingDeptHeadId === head.id}
                        title="Click to toggle Active / Inactive"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: togglingDeptHeadId === head.id ? 'wait' : 'pointer',
                          background: head.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                          color: head.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
                          border: head.status === 'ACTIVE' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontSize: '0.65rem' }}>{head.status === 'ACTIVE' ? '🟢' : '🔴'}</span>
                        <span>{togglingDeptHeadId === head.id ? 'Updating...' : head.status}</span>
                      </button>
                    </td>
                    {canManageDeptHeads && (
                      <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <button
                            type="button"
                            onClick={() => handleEditDeptHead(head)}
                            title="Edit permissions and profile"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.35rem 0.75rem',
                              border: '1px solid #c4b5fd',
                              borderRadius: '6px',
                              color: '#7f22fe',
                              background: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span>✏️</span> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleDeptHeadStatus(head)}
                            disabled={togglingDeptHeadId === head.id}
                            style={{
                              padding: '0.35rem 0.65rem',
                              border: head.status === 'ACTIVE' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                              borderRadius: '6px',
                              color: head.status === 'ACTIVE' ? '#b91c1c' : '#15803d',
                              background: '#ffffff',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              cursor: togglingDeptHeadId === head.id ? 'wait' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {head.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
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

      {/* ==================== SECTION 2: DEPARTMENT TEAMS & WORKSPACE ==================== */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.75rem' }}>
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.65rem', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>👥</span>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 800 }}>
                Department Teams ({teams.length})
              </h3>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.18rem 0.55rem', borderRadius: '9999px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                {teams.filter((t) => t.status !== 'INACTIVE').length} Active
              </span>
            </div>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.83rem' }}>
              Operational teams working inside <strong>{departmentName}</strong>. Select any team below to inspect its members, leaders, and tasks.
            </p>
          </div>

          {canManageTeams && (
            <button
              type="button"
              onClick={() => {
                setShowCreateTeam((v) => !v);
                setEditingTeamId(null);
                setTeamFormData({ name: '', description: '', headEmployeeId: '' });
                setShowCreateDeptHead(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.62rem 1.15rem',
                border: '1px solid #7f22fe',
                borderRadius: '8px',
                color: showCreateTeam ? '#7f22fe' : '#ffffff',
                background: showCreateTeam ? '#f5f0ff' : '#7f22fe',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(127, 34, 254, 0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{showCreateTeam ? '✕ Cancel' : `+ Create Team in ${departmentName}`}</span>
            </button>
          )}
        </div>

        {/* ==================== CREATE / EDIT TEAM FORM ==================== */}
        {showCreateTeam && canManageTeams && (
          <form
            onSubmit={handleCreateTeam}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '1.25rem 1.5rem',
              border: '1px solid #c4b5fd',
              borderRadius: '14px',
              background: '#faf5ff',
            }}
          >
            <div>
              <h4 style={{ margin: '0 0 0.25rem', color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>
                {editingTeamId ? `Edit Team: ${teamFormData.name}` : `Create Team inside ${departmentName}`}
              </h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
                Teams structure the employees and work items for this department. Each team can have an appointed Team Leader and assigned members.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
              <div>
                <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Team Name *
                </label>
                <input
                  required
                  maxLength={150}
                  placeholder="e.g. Sales Outreach Team"
                  value={teamFormData.name}
                  onChange={(e) => setTeamFormData((prev) => ({ ...prev, name: e.target.value }))}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Team Purpose / Description
                </label>
                <input
                  maxLength={255}
                  placeholder="e.g. Inbound leads, client calls and deals"
                  value={teamFormData.description}
                  onChange={(e) => setTeamFormData((prev) => ({ ...prev, description: e.target.value }))}
                  style={fieldStyle}
                />
              </div>

              {!editingTeamId && (
                <div>
                  <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                    Initial Team Leader (Optional)
                  </label>
                  <select
                    value={teamFormData.headEmployeeId}
                    onChange={(e) => setTeamFormData((prev) => ({ ...prev, headEmployeeId: e.target.value }))}
                    style={fieldStyle}
                  >
                    <option value="">Appoint Leader Later</option>
                    {(departmentHeads || []).map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.email}) - Department Head
                      </option>
                    ))}
                    {teams.flatMap((t) => t.employees || []).map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email}) - {emp.role || 'Employee'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCreateTeam(false);
                  setEditingTeamId(null);
                  setTeamFormData({ name: '', description: '', headEmployeeId: '' });
                }}
                style={{ padding: '0.58rem 1.1rem', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', background: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingTeam}
                style={{
                  padding: '0.58rem 1.3rem',
                  border: 0,
                  borderRadius: '8px',
                  color: '#ffffff',
                  background: isCreatingTeam ? '#94a3b8' : '#7f22fe',
                  fontWeight: 700,
                  cursor: isCreatingTeam ? 'wait' : 'pointer',
                  boxShadow: '0 2px 6px rgba(127, 34, 254, 0.25)',
                }}
              >
                {isCreatingTeam ? 'Saving Team...' : editingTeamId ? 'Save Team' : '+ Create Team'}
              </button>
            </div>
          </form>
        )}

        {/* ==================== TEAMS DIRECTORY CARDS ==================== */}
        {teams.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1rem',
          }}>
            {teams.map((team) => {
              const isSelected = team.id === selectedTeamId;
              const isInactive = team.status === 'INACTIVE';
              const memberCount = team.employees?.length || 0;
              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  style={{
                    padding: '1.1rem 1.2rem',
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #7f22fe' : '1px solid #e2e8f0',
                    background: isSelected ? '#faf5ff' : '#ffffff',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 4px 14px rgba(127, 34, 254, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    position: 'relative',
                  }}
                >
                  <div>
                    {/* Top Row: Team Name & Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '1.15rem' }}>👥</span>
                        <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1rem', fontWeight: 800 }}>
                          {team.name}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTeamStatus(team);
                        }}
                        disabled={togglingTeamId === team.id}
                        title="Click to toggle Active / Inactive"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '9999px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: togglingTeamId === team.id ? 'wait' : 'pointer',
                          background: team.status === 'ACTIVE' || !team.status ? '#f0fdf4' : '#fef2f2',
                          color: team.status === 'ACTIVE' || !team.status ? '#15803d' : '#b91c1c',
                          border: team.status === 'ACTIVE' || !team.status ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span>{team.status === 'ACTIVE' || !team.status ? '🟢' : '🔴'}</span>
                        <span>{togglingTeamId === team.id ? '...' : team.status || 'ACTIVE'}</span>
                      </button>
                    </div>

                    {/* Description if present */}
                    {team.description && (
                      <p style={{ margin: '0.4rem 0 0', color: '#64748b', fontSize: '0.79rem', lineHeight: 1.4 }}>
                        {team.description}
                      </p>
                    )}

                    {/* Team Leader & Members Meta */}
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155' }}>
                        <span style={{ color: '#7f22fe', fontWeight: 700 }}>👑 Leader:</span>
                        <span style={{ fontWeight: 600, color: team.head ? '#0f172a' : '#94a3b8' }}>
                          {team.head ? team.head.name : 'Not appointed'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
                        <span>👤 Members:</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{memberCount} employees</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.65rem',
                    borderTop: isSelected ? '1px solid #ebdfff' : '1px solid #f1f5f9',
                  }}>
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: isSelected ? '#7f22fe' : '#64748b',
                    }}>
                      {isSelected ? '✓ Viewing Team' : 'Click to inspect →'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {canManageTeams && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTeamId(team.id);
                            setTeamFormData({
                              name: team.name,
                              description: team.description || '',
                              headEmployeeId: team.head?.id || '',
                            });
                            setShowCreateTeam(true);
                          }}
                          style={{
                            padding: '0.25rem 0.55rem',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTeamStatus(team);
                        }}
                        disabled={togglingTeamId === team.id}
                        style={{
                          padding: '0.25rem 0.55rem',
                          border: team.status === 'ACTIVE' || !team.status ? '1px solid #fecaca' : '1px solid #bbf7d0',
                          borderRadius: '6px',
                          background: '#ffffff',
                          color: team.status === 'ACTIVE' || !team.status ? '#b91c1c' : '#15803d',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: togglingTeamId === team.id ? 'wait' : 'pointer',
                        }}
                      >
                        {team.status === 'ACTIVE' || !team.status ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            padding: '1.75rem',
            textAlign: 'center',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            background: '#ffffff',
          }}>
            <p style={{ margin: 0, color: '#475569', fontSize: '0.92rem', fontWeight: 600 }}>
              No teams created in {departmentName} yet.
            </p>
            <p style={{ margin: '0.3rem 0 1rem', color: '#64748b', fontSize: '0.82rem' }}>
              Create your first team to assign staff, designate a team leader, and manage tasks.
            </p>
            {canManageTeams && (
              <button
                type="button"
                onClick={() => setShowCreateTeam(true)}
                style={{
                  padding: '0.6rem 1.2rem',
                  border: 0,
                  borderRadius: '8px',
                  color: '#ffffff',
                  background: '#7f22fe',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                + Create First Team in {departmentName}
              </button>
            )}
          </div>
        )}

        {/* ==================== SELECTED TEAM WORKSPACE ==================== */}
        {selectedTeam && (
          <div style={{
            marginTop: '0.5rem',
            border: '1px solid #ddd6fe',
            borderRadius: '14px',
            background: '#ffffff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}>
            {/* Team Workspace Top Bar */}
            <div style={{
              padding: '1.1rem 1.35rem',
              background: '#fcfaff',
              borderBottom: '1px solid #ebdfff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.85rem',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h4 style={{ margin: 0, color: '#0f172a', fontSize: '1.15rem', fontWeight: 800 }}>
                    {selectedTeam.name} Workspace
                  </h4>
                  <span style={{
                    padding: '0.2rem 0.55rem',
                    borderRadius: '9999px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: selectedTeam.status === 'ACTIVE' || !selectedTeam.status ? '#ecfdf5' : '#fef2f2',
                    color: selectedTeam.status === 'ACTIVE' || !selectedTeam.status ? '#059669' : '#dc2626',
                    border: selectedTeam.status === 'ACTIVE' || !selectedTeam.status ? '1px solid #a7f3d0' : '1px solid #fecaca',
                  }}>
                    {selectedTeam.status === 'ACTIVE' || !selectedTeam.status ? '🟢 Active Team' : '🔴 Inactive Team'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem', fontSize: '0.83rem', color: '#475569' }}>
                  <span>
                    👑 <strong>Team Leader:</strong>{' '}
                    {selectedTeam.head ? (
                      <span style={{ color: '#7f22fe', fontWeight: 700 }}>
                        {selectedTeam.head.name} ({selectedTeam.head.email})
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>No leader appointed</span>
                    )}
                  </span>
                  <span>•</span>
                  <span>👥 <strong>{selectedTeam.employees?.length || 0}</strong> Team Members</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {canManageMembers && (
                  <button
                    type="button"
                    onClick={() => setShowCreateEmployee((v) => !v)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.55rem 1rem',
                      border: 0,
                      borderRadius: '8px',
                      color: '#ffffff',
                      background: '#7f22fe',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: '0 2px 5px rgba(127, 34, 254, 0.25)',
                    }}
                  >
                    <span>{showCreateEmployee ? '✕ Cancel' : `+ Add Employee to ${selectedTeam.name}`}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Form to add employee to selected team */}
            {showCreateEmployee && (
              <form onSubmit={handleCreateEmployee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', padding: '1.25rem 1.35rem', borderBottom: '1px solid #ddd6fe', background: '#faf5ff' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <h4 style={{ margin: '0 0 0.2rem', color: '#0f172a', fontSize: '0.96rem', fontWeight: 800 }}>
                    Add Employee to {selectedTeam.name}
                  </h4>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.81rem' }}>
                    Create login credentials and job details for this team member.
                  </p>
                </div>

                <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                  Employee Name *
                  <input
                    required
                    maxLength={100}
                    placeholder="e.g. Ramesh Kumar"
                    value={newEmployee.name}
                    onChange={(e) => {
                      setActionError('');
                      setNewEmployee((prev) => ({ ...prev, name: e.target.value }));
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
                    placeholder="e.g. ramesh@company.com"
                    value={newEmployee.email}
                    onChange={(e) => {
                      setActionError('');
                      setNewEmployee((prev) => ({ ...prev, email: e.target.value }));
                    }}
                    style={fieldStyle}
                  />
                </label>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                      Mobile / Phone Number
                    </label>
                    <span style={{ fontSize: '0.73rem', color: (newEmployee.phone || '').length === 10 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                      {(newEmployee.phone || '').length} / 10 digits
                    </span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210 (10 digits)"
                    value={newEmployee.phone || ''}
                    onChange={(e) => {
                      setActionError('');
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setNewEmployee((prev) => ({ ...prev, phone: val }));
                    }}
                    style={fieldStyle}
                  />
                  {newEmployee.phone && newEmployee.phone.length > 0 && !/^[6-9]/.test(newEmployee.phone) && (
                    <div style={{ fontSize: '0.74rem', color: '#ef4444', marginTop: '0.25rem', fontWeight: 600 }}>
                      ⚠️ Must start with 6, 7, 8, or 9
                    </div>
                  )}
                </div>

                <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700 }}>
                  Job Designation
                  <input
                    maxLength={100}
                    placeholder="e.g. Sales Associate"
                    value={newEmployee.role}
                    onChange={(e) => {
                      setActionError('');
                      setNewEmployee((prev) => ({ ...prev, role: e.target.value }));
                    }}
                    style={fieldStyle}
                  />
                </label>

                <div style={{ gridColumn: '1 / -1', maxWidth: '440px' }}>
                  <label style={{ color: '#334155', fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                    Initial Password (8+ chars) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      required
                      type={showEmployeePassword ? 'text' : 'password'}
                      minLength={8}
                      maxLength={128}
                      placeholder="e.g. Employee@2026!"
                      value={newEmployee.password}
                      onChange={(e) => {
                        setActionError('');
                        setNewEmployee((prev) => ({ ...prev, password: e.target.value }));
                      }}
                      style={{ ...fieldStyle, paddingRight: '4.75rem', marginTop: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmployeePassword(!showEmployeePassword)}
                      style={{
                        position: 'absolute',
                        right: '0.65rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0.45rem',
                        borderRadius: '6px',
                        userSelect: 'none',
                      }}
                      title={showEmployeePassword ? 'Hide password' : 'Show password'}
                    >
                      {showEmployeePassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                      <span>{showEmployeePassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                </div>

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

                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateEmployee(false);
                      resetEmployeeForm();
                    }}
                    style={{ padding: '0.58rem 1.1rem', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', background: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingEmployee}
                    style={{ padding: '0.58rem 1.3rem', border: 0, borderRadius: '8px', color: '#ffffff', background: isCreatingEmployee ? '#94a3b8' : '#7f22fe', fontWeight: 700, cursor: isCreatingEmployee ? 'wait' : 'pointer', boxShadow: '0 2px 6px rgba(127, 34, 254, 0.25)' }}
                  >
                    {isCreatingEmployee ? 'Adding...' : `Add to ${selectedTeam.name}`}
                  </button>
                </div>
              </form>
            )}

            {/* Workspace Navigation Tabs */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              padding: '0.65rem 1.35rem 0',
              borderBottom: '1px solid #e2e8f0',
              background: '#ffffff',
            }}>
              <button
                type="button"
                onClick={() => setActiveTeamTab('members')}
                style={{
                  padding: '0.6rem 1.1rem',
                  border: 0,
                  borderBottom: activeTeamTab === 'members' ? '3px solid #7f22fe' : '3px solid transparent',
                  background: 'none',
                  color: activeTeamTab === 'members' ? '#7f22fe' : '#64748b',
                  fontWeight: activeTeamTab === 'members' ? 800 : 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>👥 Team Members</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  background: activeTeamTab === 'members' ? '#f5f0ff' : '#f1f5f9',
                  color: activeTeamTab === 'members' ? '#7f22fe' : '#64748b',
                }}>
                  {selectedTeam.employees?.length || 0}
                </span>
              </button>

              {canUseWorkBoard && (
                <button
                  type="button"
                  onClick={() => setActiveTeamTab('tasks')}
                  style={{
                    padding: '0.6rem 1.1rem',
                    border: 0,
                    borderBottom: activeTeamTab === 'tasks' ? '3px solid #7f22fe' : '3px solid transparent',
                    background: 'none',
                    color: activeTeamTab === 'tasks' ? '#7f22fe' : '#64748b',
                    fontWeight: activeTeamTab === 'tasks' ? 800 : 600,
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>📋 Team Work &amp; Tasks</span>
                </button>
              )}
            </div>

            {/* TAB 1: MEMBERS */}
            {activeTeamTab === 'members' && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Employee Name</th>
                      <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Login ID / Phone</th>
                      <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Team Role</th>
                      <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Designation</th>
                      <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Status</th>
                      {canManageMembers && <th style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedTeam?.employees || []).map((employee) => (
                      <tr key={employee.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.8rem 1rem', color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1rem' }}>👤</span>
                            <span>{employee.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          <div style={{ color: '#0f172a', fontWeight: 600 }}>{employee.email}</div>
                          {employee.phone && (
                            <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
                              📞 {employee.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: employee.accessRole === 'TEAM_LEADER' ? '#fef3c7' : '#f1f5f9',
                            color: employee.accessRole === 'TEAM_LEADER' ? '#b45309' : '#475569',
                            border: employee.accessRole === 'TEAM_LEADER' ? '1px solid #fde68a' : '1px solid #e2e8f0',
                            whiteSpace: 'nowrap',
                          }}>
                            {employee.accessRole === 'TEAM_LEADER' ? '👑 Team Leader' : '👤 Team Member'}
                          </span>
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          {employee.role || 'Member'}
                        </td>
                        <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleToggleEmployeeStatus(employee)}
                            disabled={togglingEmployeeId === employee.id}
                            title="Click to toggle Active / Inactive"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '9999px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: togglingEmployeeId === employee.id ? 'wait' : 'pointer',
                              background: employee.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                              color: employee.status === 'ACTIVE' ? '#15803d' : '#b91c1c',
                              border: employee.status === 'ACTIVE' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ fontSize: '0.65rem' }}>{employee.status === 'ACTIVE' ? '🟢' : '🔴'}</span>
                            <span>{togglingEmployeeId === employee.id ? 'Updating...' : employee.status}</span>
                          </button>
                        </td>
                        {canManageMembers && (
                          <td style={{ padding: '0.8rem 1rem', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleEmployeeStatus(employee)}
                                disabled={togglingEmployeeId === employee.id}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  border: employee.status === 'ACTIVE' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                                  borderRadius: '6px',
                                  color: employee.status === 'ACTIVE' ? '#b91c1c' : '#15803d',
                                  background: '#ffffff',
                                  fontWeight: 600,
                                  fontSize: '0.76rem',
                                  cursor: togglingEmployeeId === employee.id ? 'wait' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {employee.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveEmployee(employee)}
                                disabled={deletingEmployeeId !== null}
                                title="Unassign this employee from this team"
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  border: '1px solid #fed7aa',
                                  borderRadius: '6px',
                                  color: '#c2410c',
                                  background: '#ffffff',
                                  fontWeight: 600,
                                  fontSize: '0.76rem',
                                  cursor: deletingEmployeeId !== null ? 'wait' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {deletingEmployeeId === employee.id ? 'Removing...' : 'Remove from Team'}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!selectedTeam?.employees?.length && (
                      <tr>
                        <td colSpan={canManageMembers ? 6 : 5} style={{ padding: '2rem', color: '#64748b', textAlign: 'center' }}>
                          No employees are assigned to {selectedTeam.name} yet. Click <strong>+ Add Employee</strong> above to add members.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: WORK BOARD */}
            {activeTeamTab === 'tasks' && canUseWorkBoard && (
              <div style={{ padding: '1.25rem 1.35rem' }}>
                <ServiceWorkBoard
                  activeCompany={activeCompany}
                  serviceCode={normalizedCode}
                  currentUser={currentUser}
                  team={selectedTeam}
                  showToast={showToast}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
