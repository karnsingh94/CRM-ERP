import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Department Roles & Permissions — AZZUNIQUE Company Admin',
  description: 'Role-based access control templates and department permission matrices',
};

export default function TeamRolesPage() {
  return <CompanyAdminPortal initialTab="permission_controls:permission_controls" initialSubTab="departments" />;
}
