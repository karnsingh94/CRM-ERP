import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Statutory Deductions (PF/ESI/TDS) — AZZUNIQE Company Admin',
  description: 'Provident Fund, ESIC and TDS compliance reporting',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:payroll" initialSubTab="payroll" />;
}
