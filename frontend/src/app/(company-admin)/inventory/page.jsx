import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Stock Overview & Inventory — AZZUNIQE Company Admin',
  description: 'On-hand quantity balances, bin locations, and re-order thresholds',
};

export default function InventoryPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_mgmt" initialSubTab="dashboard" />;
}
