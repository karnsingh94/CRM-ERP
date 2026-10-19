'use client';

import { useCompanyAuthContext } from '@/context/CompanyAuthContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function CompanyProfilePage() {
  const { activeCompany, currentUser } = useCompanyAuthContext();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
          borderRadius: '16px',
          padding: '2rem',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <Badge variant="primary">COMPANY PROFILE</Badge>
            <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>
              Tenant ID: {activeCompany?.id || 'N/A'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0 }}>
            {activeCompany?.name || 'Company Workspace'}
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#d4d4d8', margin: '0.4rem 0 0 0' }}>
            Registered Tenant Profile, branding parameters, and active business subscriptions.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        <Card title="Organization Details" subtitle="Primary company registration data">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Organization Name:</span>
              <strong style={{ color: '#1e293b' }}>{activeCompany?.name || 'N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Admin Contact Email:</span>
              <strong style={{ color: '#1e293b' }}>{activeCompany?.email || currentUser?.email || 'N/A'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Account Status:</span>
              <Badge variant={activeCompany?.status === 'ACTIVE' ? 'success' : 'warning'}>
                {activeCompany?.status || 'ACTIVE'}
              </Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Theme Accent:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: activeCompany?.themeColor || '#7f22fe',
                  }}
                />
                <code style={{ fontSize: '0.8rem' }}>{activeCompany?.themeColor || '#7f22fe'}</code>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Active Subscriptions" subtitle="Enterprise modules provisioned">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {activeCompany?.access?.services?.length > 0 ? (
              activeCompany.access.services.map((srv) => (
                <Badge key={srv.serviceId || srv.code} variant="primary">
                  {srv.name || srv.code}
                </Badge>
              ))
            ) : (
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                All 7 Enterprise services active
              </span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
