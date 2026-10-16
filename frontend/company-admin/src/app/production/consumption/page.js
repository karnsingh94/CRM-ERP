import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Material Consumption — AZZUNIQE Company Admin',
  description: 'Batch scrap tracking, yield variance, and raw material reconciliation',
};

export default function ProductionConsumptionPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:production" />;
}
