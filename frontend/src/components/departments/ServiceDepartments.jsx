'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  IconPlus,
  IconSearch,
  IconUsers,
  IconShield,
  IconEdit,
  IconTrash,
  IconUserCheck,
  IconCRM,
  IconTruck,
  IconLayers,
  IconCpu,
  IconPackage,
  IconCreditCard,
  IconAlertTriangle,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';

// Service metadata helper
const SERVICE_META = {
  crm_sales: { name: 'CRM & Sales', icon: IconCRM, color: '#7f22fe' },
  purchase_vendor: { name: 'Purchase & Vendor', icon: IconTruck, color: '#059669' },
  inventory_warehouse: { name: 'Inventory & Warehouse', icon: IconLayers, color: '#d97706' },
  manufacturing_production: { name: 'Manufacturing & Production', icon: IconCpu, color: '#7c3aed' },
  dispatch_returns: { name: 'Dispatch & Returns', icon: IconPackage, color: '#0891b2' },
  accounts_banking: { name: 'Accounts & Banking', icon: IconCreditCard, color: '#dc2626' },
  permission_controls: { name: 'Permission Controls', icon: IconShield, color: '#7f22fe' },
};

export default function ServiceDepartments({
  activeCompany,
  serviceCode,
  showToast,
  onNavigate,
}) {
  const normalizedCode = (serviceCode || 'crm_sales').replace(/-/g, '_');
  const serviceMeta = SERVICE_META[normalizedCode] || {
    name: normalizedCode.replace(/_/g, ' ').toUpperCase(),
    icon: IconLayers,
    color: '#7f22fe',
  };
  const ServiceIcon = serviceMeta.icon;

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessError, setAccessError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState(null);
  const [activeDept, setActiveDept] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    headId: '',
    status: 'ACTIVE',
  });
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // Fetch departments and company employees
  const loadServiceDepartments = useCallback(async () => {
    if (!activeCompany?.id) return;
    setIsLoading(true);
    setAccessError(null);

    try {
      // 1. Fetch departments under this specific assigned service
      const res = await fetch(
        `http://localhost:5000/api/companies/${activeCompany.id}/services/${normalizedCode}/departments`
      );
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setAccessError(data.message || 'Service is not assigned to this company by Super Admin.');
        } else {
          showToast?.('Error', data.message || 'Failed to load departments', 'danger');
        }
        setIsLoading(false);
        return;
      }

      setServiceInfo(data.service);
      setDepartments(data.departments || []);

      // 2. Fetch company employees for Department Head & Member allocation
      const empRes = await fetch(`http://localhost:5000/api/companies/${activeCompany.id}/employees`);
      const empData = await empRes.json();
      if (empData.success) {
        setEmployees(empData.data || []);
      }
    } catch (err) {
      setAccessError('Failed to communicate with API server. Ensure backend is running.');
    } finally {
      setIsLoading(false);
    }
  }, [activeCompany?.id, normalizedCode, showToast]);

  useEffect(() => {
    loadServiceDepartments();
  }, [loadServiceDepartments]);

  // Open Create Modal (locks service context)
  const handleOpenCreate = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      headId: '',
      status: 'ACTIVE',
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (dept) => {
    setActiveDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      headId: dept.headId || '',
      status: dept.status || 'ACTIVE',
    });
    setShowEditModal(true);
  };

  // Open Assign Employees Modal
  const handleOpenAssign = (dept) => {
    setActiveDept(dept);
    // Pre-check currently assigned employees
    const currentAssigned = employees
      .filter((emp) => emp.departmentId === dept.id)
      .map((emp) => emp.id);
    setSelectedEmployeeIds(currentAssigned);
    setShowAssignModal(true);
  };

  // Auto-generate code from department name
  const handleNameChange = (e) => {
    const val = e.target.value;
    const autoCode = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    setFormData((prev) => ({
      ...prev,
      name: val,
      code: prev.code === '' || prev.code === (prev.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) ? autoCode : prev.code,
    }));
  };

  // Save new department
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast?.('Validation Error', 'Department name is required', 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/companies/${activeCompany.id}/services/${normalizedCode}/departments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            code: formData.code.trim() || undefined,
            description: formData.description.trim() || undefined,
            headId: formData.headId || null,
            status: formData.status,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        showToast?.('Creation Denied', data.message || 'Failed to create department', 'danger');
        setIsSubmitting(false);
        return;
      }

      showToast?.(
        'Department Created! 🎉',
        `Department "${data.data.name}" successfully created under ${serviceMeta.name}.`,
        'success'
      );
      setShowCreateModal(false);
      loadServiceDepartments();
    } catch (err) {
      showToast?.('Error', 'Network error while saving department', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update department
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast?.('Validation Error', 'Department name is required', 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/companies/${activeCompany.id}/departments/${activeDept.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            headId: formData.headId || null,
            status: formData.status,
          }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        showToast?.('Update Failed', data.message || 'Could not update department', 'danger');
        setIsSubmitting(false);
        return;
      }

      showToast?.('Department Updated', `Changes to "${data.data.name}" saved.`, 'success');
      setShowEditModal(false);
      loadServiceDepartments();
    } catch (err) {
      showToast?.('Error', 'Network error updating department', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Assign staff to department
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/companies/${activeCompany.id}/departments/${activeDept.id}/employees`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeIds: selectedEmployeeIds }),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        showToast?.('Assignment Failed', data.message || 'Could not update staff', 'danger');
        setIsSubmitting(false);
        return;
      }

      showToast?.('Staff Updated', `Assigned ${selectedEmployeeIds.length} staff to "${activeDept.name}".`, 'success');
      setShowAssignModal(false);
      loadServiceDepartments();
    } catch (err) {
      showToast?.('Error', 'Network error assigning staff', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete department
  const handleDeleteConfirm = async () => {
    if (!deptToDelete) return;
    try {
      const res = await fetch(
        `http://localhost:5000/api/companies/${activeCompany.id}/departments/${deptToDelete.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        showToast?.('Deletion Failed', data.message || 'Could not delete department', 'danger');
        return;
      }

      showToast?.('Department Removed', `Department "${deptToDelete.name}" has been removed.`, 'danger');
      setDeptToDelete(null);
      loadServiceDepartments();
    } catch (err) {
      showToast?.('Error', 'Network error deleting department', 'danger');
    }
  };

  // Filtered departments
  const filteredDepartments = (departments || []).filter((dept) => {
    if (!dept) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    return (
      String(dept.name || '').toLowerCase().includes(q) ||
      String(dept.code || '').toLowerCase().includes(q) ||
      (dept.head?.name && String(dept.head.name).toLowerCase().includes(q))
    );
  });

  // Calculate statistics
  const totalDepartments = departments.length;
  const assignedHeadsCount = departments.filter((d) => d.headId).length;
  const totalEmployeesCount = departments.reduce((acc, d) => acc + (d.employeeCount || 0), 0);

  // 1. Loading State
  if (isLoading) {
    return (
      <div style={{ padding: '2rem 0' }}>
        <LoadingSkeleton rows={4} height="52px" />
      </div>
    );
  }

  // 2. Unassigned Service Error State
  if (accessError) {
    return (
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '3.5rem 2rem',
          textAlign: 'center',
          border: '1px solid #fed7aa',
          margin: '1.5rem 0',
          boxShadow: '0 4px 12px rgba(234, 88, 12, 0.05)',
        }}
      >
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: '#ffedd5',
            color: '#c2410c',
            marginBottom: '0.75rem',
          }}
        >
          Assigned-Service Restriction Enforced
        </span>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#9a3412', marginBottom: '0.65rem' }}>
          Service Not Assigned to {activeCompany?.organizationName}
        </h3>
        <p
          style={{
            fontSize: '0.9rem',
            color: '#7c2d12',
            maxWidth: '560px',
            margin: '0 auto 1.5rem auto',
            lineHeight: 1.6,
          }}
        >
          {accessError}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => onNavigate?.('dashboard')}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '8px',
              background: '#7f22fe',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Service Header & Context Banner */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem 1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              background: `${serviceMeta.color}15`,
              color: serviceMeta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ServiceIcon size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.2rem' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {serviceMeta.name} — Department Management
              </h1>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                Assigned Service
              </span>
            </div>
            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
              Company workspace:{' '}
              <strong style={{ color: '#0f172a' }}>{activeCompany?.organizationName}</strong> &bull; Service context:{' '}
              <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#475569' }}>
                {normalizedCode}
              </code>
            </p>
          </div>
        </div>

        {/* Action Button: + Create Department */}
        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.7rem 1.35rem',
            borderRadius: '9px',
            background: '#7f22fe',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(127, 34, 254, 0.25)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#6b12df';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#7f22fe';
          }}
        >
          <IconPlus size={16} />
          <span>Create Department</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Service Departments
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
            {totalDepartments}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Scoped under {serviceMeta.name}
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Department Heads
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', marginTop: '0.35rem' }}>
            {assignedHeadsCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Authorized company leaders
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Allocated Staff
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#7f22fe', marginTop: '0.35rem' }}>
            {totalEmployeesCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
            Assigned company employees
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '1.25rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
            Tenant Isolation
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginTop: '0.65rem' }}>
            100% Isolated
          </div>
          <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '0.2rem', fontWeight: 600 }}>
            ✓ Same-company verified
          </div>
        </div>
      </div>

      {/* Search and Table Container */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        {/* Table Toolbar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.5rem 0.85rem',
              width: '320px',
              maxWidth: '100%',
            }}
          >
            <span style={{ color: '#94a3b8' }}>
              <IconSearch size={16} />
            </span>
            <input
              type="text"
              placeholder={`Search ${serviceMeta.name} departments...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '0.86rem',
                color: '#0f172a',
              }}
            />
          </div>

          <div style={{ fontSize: '0.84rem', color: '#64748b', fontWeight: 600 }}>
            Showing {filteredDepartments.length} of {departments.length} departments
          </div>
        </div>

        {/* Departments Table / Empty State */}
        {departments.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <EmptyState
              icon="🏢"
              title={`No Departments in ${serviceMeta.name} Yet`}
              description={`Create your first department under ${serviceMeta.name} to organize operational workflows, assign Department Heads, and allocate staff.`}
              actionLabel="+ Create Department"
              onAction={handleOpenCreate}
            />
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            No departments match your search query &quot;{searchQuery}&quot;.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.9rem 1.5rem', minWidth: '280px', whiteSpace: 'nowrap' }}>Department Name &amp; Code</th>
                  <th style={{ padding: '0.9rem 1rem', minWidth: '160px', whiteSpace: 'nowrap' }}>Parent Service</th>
                  <th style={{ padding: '0.9rem 1rem', minWidth: '150px', whiteSpace: 'nowrap' }}>Department Head</th>
                  <th style={{ padding: '0.9rem 1rem', minWidth: '130px', whiteSpace: 'nowrap' }}>Staff Count</th>
                  <th style={{ padding: '0.9rem 1rem', minWidth: '110px', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '0.9rem 1.5rem', textAlign: 'right', minWidth: '200px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepartments.map((dept) => (
                  <tr
                    key={dept.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {/* Department Name & Code */}
                    <td style={{ padding: '1rem 1.5rem', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
                        {dept.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {dept.code}
                        </code>
                        {dept.description && (
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: '#64748b',
                              maxWidth: '300px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={dept.description}
                          >
                            &bull; {dept.description}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Service Name */}
                    <td style={{ padding: '1rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          background: `${serviceMeta.color}15`,
                          color: serviceMeta.color,
                          border: `1px solid ${serviceMeta.color}30`,
                        }}
                      >
                        <ServiceIcon size={14} style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>{serviceMeta.name}</span>
                      </span>
                    </td>

                    {/* Department Head */}
                    <td style={{ padding: '1rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      {dept.head ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#7f22fe',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {dept.head.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                              {dept.head.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {dept.head.role}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            background: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Employee Count */}
                    <td style={{ padding: '1rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenAssign(dept)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#7f22fe';
                          e.currentTarget.style.color = '#7f22fe';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#cbd5e1';
                          e.currentTarget.style.color = '#334155';
                        }}
                        title="Click to manage employees allocated to this department"
                      >
                        <IconUsers size={14} style={{ flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap' }}>{dept.employeeCount || 0} Staff</span>
                      </button>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '1rem 1rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          background: dept.status === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                          color: dept.status === 'ACTIVE' ? '#065f46' : '#64748b',
                          border: dept.status === 'ACTIVE' ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                        }}
                      >
                        {dept.status || 'ACTIVE'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenAssign(dept)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                          title="Assign Staff Members"
                        >
                          <IconUserCheck size={14} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap' }}>Staff</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(dept)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                          title="Edit Department"
                        >
                          <IconEdit size={14} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap' }}>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeptToDelete(dept)}
                          style={{
                            padding: '0.45rem 0.65rem',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            background: '#fff5f5',
                            color: '#dc2626',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                          title="Delete Department"
                        >
                          <IconTrash size={14} style={{ flexShrink: 0 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Department (Locks Parent Service Context) */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={`Create Department in ${serviceMeta.name}`}
        maxWidth="540px"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Pre-locked Service Context Indicator */}
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                Parent Service Context (Preselected &amp; Locked)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem', fontWeight: 700, color: '#0f172a' }}>
                <ServiceIcon size={16} />
                <span>{serviceMeta.name}</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#059669',
                background: '#ecfdf5',
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #a7f3d0',
              }}
            >
              ✓ Authorized Scope
            </span>
          </div>

          {/* Department Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder={`e.g. ${serviceMeta.name === 'CRM & Sales' ? 'Sales Operations' : 'Operations Team'}`}
              value={formData.name}
              onChange={handleNameChange}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Department Code */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Code
            </label>
            <input
              type="text"
              placeholder="e.g. sales_ops"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
            <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
              Unique alphanumeric slug identifying this department in {serviceMeta.name}.
            </span>
          </div>

          {/* Department Head Selector (Same Company Users Only) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Head <span style={{ fontWeight: 400, color: '#64748b' }}>(Eligible Company Members)</span>
            </label>
            <select
              value={formData.headId}
              onChange={(e) => setFormData({ ...formData, headId: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">-- Assign Department Head Later --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.role} ({emp.email})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.74rem', color: '#059669', display: 'block', marginTop: '0.25rem' }}>
              🔒 Only verified employees belonging to {activeCompany?.organizationName} are eligible.
            </span>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Description / Responsibilities
            </label>
            <textarea
              rows={3}
              placeholder="Operational responsibilities, scope, and objectives for this department..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: isSubmitting ? '#c4b5fd' : '#7f22fe',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Edit Department */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit Department: ${activeDept?.name || ''}`}
        maxWidth="540px"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Head
            </label>
            <select
              value={formData.headId}
              onChange={(e) => setFormData({ ...formData, headId: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="">-- No Department Head Assigned --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} — {emp.role} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Department Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                background: '#ffffff',
                outline: 'none',
              }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                border: 'none',
                background: isSubmitting ? '#c4b5fd' : '#7f22fe',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Assign Staff Members to Department */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title={`Allocate Staff Members — ${activeDept?.name || ''}`}
        maxWidth="580px"
      >
        <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0 }}>
            Select verified employees from <strong>{activeCompany?.organizationName}</strong> to allocate to{' '}
            <strong>{activeDept?.name}</strong> under <strong>{serviceMeta.name}</strong>.
          </p>

          <div
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            {employees.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                No employees registered for this company yet.
              </div>
            ) : (
              employees.map((emp) => {
                const isSelected = selectedEmployeeIds.includes(emp.id);
                return (
                  <label
                    key={emp.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '6px',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                        } else {
                          setSelectedEmployeeIds(selectedEmployeeIds.filter((id) => id !== emp.id));
                        }
                      }}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                        {emp.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                        {emp.role} &bull; {emp.email}
                      </div>
                    </div>
                    {isSelected && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7f22fe' }}>
                        Selected
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              {selectedEmployeeIds.length} staff selected
            </span>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '0.65rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSubmitting ? '#c4b5fd' : '#7f22fe',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? 'Saving...' : 'Update Allocation'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DIALOG: Delete Department */}
      <ConfirmDialog
        isOpen={Boolean(deptToDelete)}
        onClose={() => setDeptToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Remove Department?"
        message={`Are you sure you want to remove the department "${deptToDelete?.name}" from ${serviceMeta.name}? Assigned employees will be unlinked.`}
        confirmLabel="Delete Department"
        cancelLabel="Cancel"
        isDanger={true}
      />
    </div>
  );
}
