import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Stock Adjustments — AZZUNIQE Company Admin',
  description: 'Physical audit write-offs, variance logs, and stock reconciliation',
};

export default function StockAdjustmentsPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_mgmt" />;
}
