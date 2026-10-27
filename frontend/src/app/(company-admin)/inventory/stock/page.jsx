import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Current Stock — AZZUNIQE Company Admin',
  description: 'Real-time on-hand stock quantities, available stock and re-order thresholds',
};

export default function CurrentStockPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_warehouse_mod" initialSubTab="stock" />;
}
