import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Assigned Team Modules — AZZUNIQE CRM & ERP',
  description: 'Modules and screens assigned to the Team Leader',
};

export default function TeamLeaderModulesPage() {
  return <DepartmentHeadDashboardFeature view="modules" portalRole="team-leader" />;
}
