import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Bin Locations — AZZUNIQE Company Admin',
  description: 'Warehouse rack, aisle, and bin location configuration',
};

export default function BinLocationsPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_warehouse_mod" initialSubTab="bins" />;
}
