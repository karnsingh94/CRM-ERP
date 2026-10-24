import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Team Leader Dashboard — AZZUNIQE CRM & ERP',
  description: 'Team overview, assigned modules, screens, and work summary',
};

export default function TeamLeaderDashboardPage() {
  return <DepartmentHeadDashboardFeature view="dashboard" portalRole="team-leader" />;
}
