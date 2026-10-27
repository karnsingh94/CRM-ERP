import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Stock Transfers — AZZUNIQE Company Admin',
  description: 'Inter-warehouse transfers, bin-to-bin movements, and in-transit logs',
};

export default function StockTransfersPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_warehouse_mod" initialSubTab="transfers" />;
}
