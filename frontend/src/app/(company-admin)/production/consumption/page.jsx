import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Material Consumption — AZZUNIQUE Company Admin',
  description: 'Batch scrap tracking, yield variance, and raw material reconciliation',
};

export default function ProductionConsumptionPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:production" />;
}
