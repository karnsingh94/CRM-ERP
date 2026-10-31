import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Shift Management — AZZUNIQE Company Admin',
  description: 'Rotational shift patterns and employee rosters',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_attendance" initialSubTab="attendance" />;
}
