import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Department Settings — AZZUNIQE CRM & ERP',
  description: 'Department Head appearance, account, profile, and notification preferences',
};

export default function DepartmentSettingsPage() {
  return <DepartmentHeadDashboardFeature view="settings" />;
}
