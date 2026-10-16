import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Outward Gate Passes — AZZUNIQE Company Admin',
  description: 'Material dispatch clearance and outward vehicle security exit tracking',
};

export default function GatePassOutwardPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:gate_pass" />;
}
