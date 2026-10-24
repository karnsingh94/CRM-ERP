import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Department Head Dashboard — AZZUNIQE CRM & ERP',
  description: 'Department overview, access, and workspace summary',
};

export default function DepartmentHeadDashboardPage() {
  return <DepartmentHeadDashboardFeature view="dashboard" />;
}
