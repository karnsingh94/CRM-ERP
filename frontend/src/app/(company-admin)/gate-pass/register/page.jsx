import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Gate Pass Register — AZZUNIQE Company Admin',
  description: 'Chronological inward, outward, and returnable gate pass audit registry',
};

export default function GatePassRegisterPage() {
  return <CompanyAdminPortal initialTab="inventory_warehouse:gate_pass" initialSubTab="register" />;
}
