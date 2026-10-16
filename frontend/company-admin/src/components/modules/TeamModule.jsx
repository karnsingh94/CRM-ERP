'use client';

import { useState, useEffect } from 'react';
import { IconUsers, IconPlus, IconShield } from '../ui/Icons';
import Modal from '../ui/Modal';
import ServiceDepartments from '../departments/ServiceDepartments';

export default function TeamModule({ activeCompany, showToast }) {
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'departments'
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: '',
  });

  const loadEmployees = async () => {
    if (!activeCompany?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/companies/${activeCompany.id}/employees`);
      const data = await res.json();
      if (data.success) {
        setEmployees(data.data || []);
      }
    } catch (_) {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [activeCompany?.id]);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!newEmployee.name || !newEmployee.email) {
      showToast?.('Validation Error', 'Employee name and email are required', 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`http://localhost:5000/api/companies/${activeCompany.id}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast?.('Registration Failed', data.message || 'Failed to add employee', 'danger');
        setIsSubmitting(false);
        return;
      }

      showToast?.('Employee Registered! 🎉', `Added ${data.data.name} to company staff.`, 'success');
      setShowAddModal(false);
      setNewEmployee({ name: '', email: '', role: '' });
      loadEmployees();
    } catch (err) {
      showToast?.('Error', 'Network error registering employee', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Company Team &amp; Internal Staff Access</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Manage employee accounts, operational roles, and service departments within {activeCompany?.organizationName}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            background: '#2563eb',
            color: '#ffffff',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.86rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(37, 99, 235, 0.25)',
          }}
        >
          <IconPlus size={16} /> Add Employee
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'members' ? 800 : 600,
            color: activeTab === 'members' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'members' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
            cursor: 'pointer',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
          }}
        >
          Company Employees ({employees.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('departments')}
          style={{
            padding: '0.65rem 1.25rem',
            fontWeight: activeTab === 'departments' ? 800 : 600,
            color: activeTab === 'departments' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'departments' ? '2px solid #2563eb' : '2px solid transparent',
            fontSize: '0.88rem',
            cursor: 'pointer',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>🏢</span>
          <span>Permission Control Departments</span>
        </button>
      </div>

      {activeTab === 'departments' ? (
        <ServiceDepartments
          activeCompany={activeCompany}
          serviceCode="permission_controls"
          showToast={showToast}
        />
      ) : (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '0.85rem 1.25rem' }}>Employee Name</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Work Email</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Department Scope</th>
                  <th style={{ padding: '0.85rem 1rem' }}>Internal Role</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#0f172a' }}>{m.name}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#64748b' }}>{m.email}</td>
                    <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                      {m.departmentName ? (
                        <span style={{ fontWeight: 600, color: '#0369a1', background: '#f0f9ff', padding: '2px 8px', borderRadius: '4px' }}>
                          {m.departmentName}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>General / Unallocated</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#2563eb' }}>{m.role}</td>
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                        {m.status || 'ACTIVE'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register Company Employee"
        maxWidth="480px"
      >
        <form onSubmit={handleCreateEmployee} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              Full Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Chandra"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
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
              Work Email <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="email"
              required
              placeholder="e.g. ramesh@company.com"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
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
              Operational Role / Designation
            </label>
            <input
              type="text"
              placeholder="e.g. Sales Executive, Quality Inspector"
              value={newEmployee.role}
              onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
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
                background: isSubmitting ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Registering...' : 'Register Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
