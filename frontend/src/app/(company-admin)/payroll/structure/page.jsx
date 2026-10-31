import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Salary Structure — AZZUNIQE Company Admin',
  description: 'Salary heads, basic pay, allowances and perquisites',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:payroll" initialSubTab="payroll" />;
}
