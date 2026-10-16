'use client';

import { IconBuilding, IconShield, IconUsers } from '../ui/Icons';

export default function SettingsModule({ activeCompany, permittedServices = [] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>Company Profile &amp; Preferences</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Registered organization information and tenant credentials for {activeCompany?.organizationName}
        </p>
      </div>

      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
          Organization Identification
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
              Company / Organization Legal Name
            </label>
            <input
              type="text"
              readOnly
              value={activeCompany?.organizationName || ''}
              style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Primary Admin Full Name
              </label>
              <input
                type="text"
                readOnly
                value={activeCompany?.name || ''}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Admin Work Email
              </label>
              <input
                type="text"
                readOnly
                value={activeCompany?.email || ''}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Contact Phone / Mobile
              </label>
              <input
                type="text"
                readOnly
                value={activeCompany?.mobile || 'Not provided'}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                Tenant Panel Status
              </label>
              <input
                type="text"
                readOnly
                value={`ACTIVE (${activeCompany?.status || 'ACTIVE'})`}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#065f46', fontWeight: 800 }}
              />
            </div>
          </div>

          <div style={{ marginTop: '1rem', padding: '1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: '#166534', fontSize: '0.9rem' }}>
              <span>🛡️</span> Super Admin Provisioned Access
            </div>
            <p style={{ fontSize: '0.82rem', color: '#15803d', marginTop: '0.35rem', lineHeight: 1.5 }}>
              This company has been granted access to <strong>{permittedServices.length} Enterprise Services</strong> by Platform Super Admin. All data modifications are logged to the central system audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
