import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Contract Manufacturing — AZZUNIQUE Company Admin',
  description: 'Subcontracting, Job Work Orders, Rule 55 Delivery Challans, and Material Reconciliation',
};

export default function ProductionContractManufacturingPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:contract_manufacturing" />;
}

