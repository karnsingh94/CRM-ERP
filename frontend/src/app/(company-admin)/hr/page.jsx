import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'HRMS & Staff Directory — AZZUNIQE Company Admin',
  description: 'Employee master records, onboarding documents and biometric attendance',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_employee" initialSubTab="employees" />;
}
