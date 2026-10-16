import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Recipe Cost Estimator — AZZUNIQE Company Admin',
  description: 'Direct material, overhead allocation, and batch unit costing calculations',
};

export default function BomCostingPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:bom" />;
}
