import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Returnable Asset Tracking — AZZUNIQE Company Admin',
  description: 'Sub-contracting tools, calibration instruments, and return tracking register',
};

export default function GatePassReturnablePage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:gate_pass" initialSubTab="returnable" />;
}
