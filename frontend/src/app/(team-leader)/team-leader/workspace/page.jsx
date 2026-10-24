import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Team Workspace — AZZUNIQE CRM & ERP',
  description: 'Team member and assigned work management',
};

export default function TeamLeaderWorkspacePage() {
  return <DepartmentHeadDashboardFeature view="workspace" portalRole="team-leader" />;
}
