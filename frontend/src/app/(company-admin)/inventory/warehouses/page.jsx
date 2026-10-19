import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Warehouse Locations — AZZUNIQE Company Admin',
  description: 'Physical warehouse godowns, aisle numbers, and rack allocations',
};

export default function WarehouseLocationsPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:inventory_mgmt" />;
}
