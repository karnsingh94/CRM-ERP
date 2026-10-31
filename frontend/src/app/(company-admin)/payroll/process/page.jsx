import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Monthly Payroll Run — AZZUNIQE Company Admin',
  description: 'Gross-to-net salary batch calculation and disbursement',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:payroll" initialSubTab="payroll" />;
}
