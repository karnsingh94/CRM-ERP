import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Employee Master — AZZUNIQE Company Admin',
  description: 'Staff directory, designations, and employee records',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_employee" initialSubTab="employees" />;
}
