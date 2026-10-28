import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Stock Movement Ledger — AZZUNIQE Company Admin',
  description: 'Chronological transaction ledger of all stock in and out events',
};

export default function StockMovementsPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_mgmt" initialSubTab="movements" />;
}
