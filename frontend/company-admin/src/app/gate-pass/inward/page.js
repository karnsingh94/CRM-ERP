import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Inward Gate Passes — AZZUNIQE Company Admin',
  description: 'Factory gate inward verification for delivery trucks and inward shipments',
};

export default function GatePassInwardPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:gate_pass" />;
}
