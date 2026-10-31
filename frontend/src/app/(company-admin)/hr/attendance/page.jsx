import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Daily Attendance — AZZUNIQE Company Admin',
  description: 'Shift punches and biometric sync attendance records',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_attendance" initialSubTab="attendance" />;
}
