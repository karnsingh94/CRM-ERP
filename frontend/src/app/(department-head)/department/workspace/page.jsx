import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Department Workspace — AZZUNIQE CRM & ERP',
  description: 'Department team, member, and work management',
};

export default function DepartmentWorkspacePage() {
  return <DepartmentHeadDashboardFeature view="workspace" />;
}
