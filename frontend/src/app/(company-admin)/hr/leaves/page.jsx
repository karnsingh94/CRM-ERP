import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Leave Management — AZZUNIQUE Company Admin',
  description: 'Employee leave requests, approvals and balance entitlements',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="hrms_payroll:hr_attendance" initialSubTab="attendance" />;
}
