import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Employee Payslips — AZZUNIQE Company Admin',
  description: 'Monthly payslip distribution and downloads',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:payroll" initialSubTab="payroll" />;
}
