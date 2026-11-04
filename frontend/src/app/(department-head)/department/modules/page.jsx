import DepartmentHeadDashboardFeature from '@/features/department-head/dashboard';

export const metadata = {
  title: 'Department Modules — AZZUNIQUE CRM & ERP',
  description: 'Modules and screens assigned to the Department Head',
};

export default function DepartmentModulesPage() {
  return <DepartmentHeadDashboardFeature view="modules" />;
}
