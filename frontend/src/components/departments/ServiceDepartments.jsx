'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import LoadingSkeleton from '../ui/LoadingSkeleton';

const ROLE_LABELS = {
  SERVICE_HEAD: 'Service Head',
  TEAM_LEADER: 'Team Leader',
  EMPLOYEE: 'Employee',
};

export default function ServiceDepartments({ activeCompany, serviceCode, showToast }) {
  const normalizedCode = (serviceCode || 'crm_sales').replace(/-/g, '_');
  const [team, setTeam] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingHead, setIsSavingHead] = useState(false);
  const [error, setError] = useState('');

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
    setIsSavingHead(true);
    try {
      const response = await api.put(
        `/companies/${activeCompany.id}/services/${normalizedCode}/team/head`,
        { headId }
      );
      setTeam(response.data);
      showToast?.('Service Head Updated', 'Service team leadership has been saved.', 'success');
    } catch (saveError) {
      showToast?.('Update Failed', saveError.message || 'Could not update the Service Head.', 'danger');
    } finally {
      setIsSavingHead(false);
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
        <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.2rem', fontWeight: 800 }}>
          {team?.service?.name || 'Service'} Team
        </h2>
        <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.86rem' }}>
          A service is the team. Assign its Service Head and manage team members from Company Employees.
        </p>
      </div>

      <div style={{ padding: '1.1rem 1.25rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' }}>
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
        {activeEmployees.length === 0 && (
          <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.82rem' }}>
            Add an employee to this service before assigning its Service Head.
          </p>
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
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '1.25rem', color: '#64748b', textAlign: 'center' }}>
                  No employees are assigned to this service team yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
