import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Payroll & Compensation — AZZUNIQUE Company Admin',
  description: 'Salary calculation, statutory deductions and employee payslips',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:payroll" initialSubTab="payroll" />;
}
