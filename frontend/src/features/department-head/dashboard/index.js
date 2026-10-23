'use client';

import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import Card from '@/components/ui/Card';
import StaffPasswordForm from '@/components/modules/StaffPasswordForm';
import ServiceDepartments from '@/components/departments/ServiceDepartments';

export default function DepartmentHeadDashboardFeature() {
  const { currentUser, activeCompany } = useCompanyAuthContext();
  const service = activeCompany?.access?.services?.[0];
  const modules = service?.modules || [];
  const subModuleCount = modules.reduce((total, module) => total + (module.subModules || module.sub_modules || []).length, 0);
  const serviceName = currentUser?.serviceName || service?.name || 'Assigned Department';
  const canManageTeam = currentUser?.permissions?.manageMembers === true || currentUser?.permissions?.manageTeams === true;
  const canManageWork = currentUser?.permissions?.assignWork === true || currentUser?.permissions?.updateWork === true;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', padding: '2rem', color: '#fff' }}>
        <span style={{ color: '#c4b5fd', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em' }}>DEPARTMENT HEAD</span>
        <h1 style={{ margin: '0.45rem 0', fontSize: '1.65rem', fontWeight: 800 }}>{serviceName} Department</h1>
        <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.88rem' }}>
          Welcome, {currentUser?.name || 'Department Head'}. This workspace is limited to modules approved for your department.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <Card title="Assigned Department" subtitle="Your department scope">
          <strong style={{ color: '#7f22fe', fontSize: '1.05rem' }}>{serviceName}</strong>
        </Card>
        <Card title="Accessible Modules" subtitle="Company-approved">
          <strong style={{ color: '#7f22fe', fontSize: '1.6rem' }}>{modules.length}</strong>
        </Card>
        <Card title="Accessible Screens" subtitle="Active sub-modules">
          <strong style={{ color: '#7f22fe', fontSize: '1.6rem' }}>{subModuleCount}</strong>
        </Card>
      </div>

      <Card title="Your Department Modules" subtitle="Only modules and sub-modules assigned to your role are shown">
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
          <p style={{ margin: 0, color: '#64748b' }}>No active modules are currently assigned to this department.</p>
        )}
      </Card>

      {(canManageTeam || canManageWork) && (
        <Card title="Department Workspace" subtitle="Manage department heads, teams, members, and work using granted permissions">
          <ServiceDepartments
            activeCompany={activeCompany}
            serviceCode={currentUser?.serviceCode || service?.code}
            currentUser={currentUser}
          />
        </Card>
      )}

      <StaffPasswordForm />
    </div>
  );
}
