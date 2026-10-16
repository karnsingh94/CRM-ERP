import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Shopfloor Work Orders — AZZUNIQE Company Admin',
  description: 'Stage-by-stage assembly lines, machine schedules, and operator assignments',
};

export default function ProductionWorkOrdersPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:production" />;
}
