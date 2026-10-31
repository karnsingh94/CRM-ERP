import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Document Vault — AZZUNIQE Company Admin',
  description: 'Staff document vault and compliance verifications',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_employee" initialSubTab="employees" />;
}
