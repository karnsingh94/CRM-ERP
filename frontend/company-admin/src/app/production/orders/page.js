import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Production Orders — AZZUNIQE Company Admin',
  description: 'Manufacturing work releases, target quantities, and scheduled completion dates',
};

export default function ProductionOrdersPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:production" />;
}
