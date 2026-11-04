import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Inward Gate Passes — AZZUNIQUE Company Admin',
  description: 'Factory gate inward verification for delivery trucks and inward shipments',
};

export default function GatePassInwardPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:gate_pass" initialSubTab="inward" />;
}
