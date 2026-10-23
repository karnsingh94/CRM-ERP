'use client';

import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import Card from '@/components/ui/Card';
import StaffPasswordForm from '@/components/modules/StaffPasswordForm';
import ServiceWorkBoard from '@/components/departments/ServiceWorkBoard';

export default function EmployeeDashboardFeature() {
  const { currentUser, activeCompany } = useCompanyAuthContext();
  const service = activeCompany?.access?.services?.[0];
  const modules = service?.modules || [];
  const isTeamLeader = currentUser?.role === 'TEAM_LEADER';
  const serviceName = currentUser?.serviceName || service?.name || 'Assigned Service';
  const serviceCode = currentUser?.serviceCode || service?.code;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '16px', padding: '2rem', color: '#fff' }}>
        <span style={{ color: '#c7d2fe', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em' }}>
          {isTeamLeader ? 'TEAM LEADER' : 'EMPLOYEE'}
        </span>
        <h1 style={{ margin: '0.45rem 0', fontSize: '1.65rem', fontWeight: 800 }}>Welcome, {currentUser?.name || 'Employee'}</h1>
        <p style={{ margin: 0, color: '#e0e7ff', fontSize: '0.88rem' }}>
          {serviceName} team · Login ID: {currentUser?.email || currentUser?.id || '—'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Card title="Assigned Service" subtitle="Your team scope">
          <strong style={{ color: '#7f22fe', fontSize: '1.05rem' }}>{serviceName}</strong>
        </Card>
        <Card title="Accessible Modules" subtitle="Company-approved">
          <strong style={{ color: '#7f22fe', fontSize: '1.6rem' }}>{modules.length}</strong>
        </Card>
        <Card title="Team Role" subtitle="Access level">
          <strong style={{ color: '#7f22fe', fontSize: '1.05rem' }}>{isTeamLeader ? 'Team Leader' : 'Employee'}</strong>
        </Card>
      </div>

      <Card title="Your Service Modules" subtitle="Your access follows the modules approved for your assigned service">
        {modules.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {modules.map((module) => (
              <div key={module.moduleId || module.module_id || module.code} style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a', fontSize: '0.95rem' }}>{module.name}</h3>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.8rem' }}>
                  {(module.subModules || module.sub_modules || []).map((subModule) => subModule.name).join(', ') || 'No active sub-modules'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>No active modules are currently assigned to this service.</p>
        )}
      </Card>

      <Card title="Assigned Work" subtitle="Work items assigned to you by your Department Head or Team Leader">
        <ServiceWorkBoard
          activeCompany={activeCompany}
          serviceCode={serviceCode}
          currentUser={currentUser}
        />
      </Card>

      <StaffPasswordForm />
    </div>
  );
}
