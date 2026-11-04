import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Company Employees & Staff — AZZUNIQUE Company Admin',
  description: 'Internal employees, department allocations, and staff user accounts',
};

export default function TeamPage() {
  return <CompanyAdminPortal initialTab="permission_controls:permission_controls" initialSubTab="members" />;
}
