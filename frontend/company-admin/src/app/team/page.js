import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Company Employees & Staff — AZZUNIQE Company Admin',
  description: 'Internal employees, department allocations, and staff user accounts',
};

export default function TeamPage() {
  return <CompanyAdminPortal initialTab="permission_controls:permission_controls" />;
}
