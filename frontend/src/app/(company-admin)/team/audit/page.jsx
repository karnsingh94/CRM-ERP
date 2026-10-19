import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Activity Audit Trail — AZZUNIQE Company Admin',
  description: 'Tenant staff operational audit trail and security timestamp logs',
};

export default function TeamAuditPage() {
  return <CompanyAdminPortal initialTab="permission_controls:permission_controls" initialSubTab="members" />;
}
