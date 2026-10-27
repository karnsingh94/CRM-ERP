import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Stock Valuations — AZZUNIQE Company Admin',
  description: 'FIFO, Weighted Average valuations and historical movement valuation ledger',
};

export default function StockValuationsPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_warehouse_mod" initialSubTab="valuations" />;
}
