import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Employee Onboarding & KYC — AZZUNIQUE Company Admin',
  description: 'Candidate onboarding workflow and KYC compliance',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_employee" initialSubTab="employees" />;
}
