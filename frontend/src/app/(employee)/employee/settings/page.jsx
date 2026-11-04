import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Employee Settings — AZZUNIQUE CRM & ERP',
  description: 'Employee workspace appearance, account security, profile, and notification preferences',
};

export default function EmployeeSettingsPage() {
  return <DepartmentHeadDashboardFeature view="settings" portalRole="employee" />;
}
