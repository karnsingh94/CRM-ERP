import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Inverter Configuration — AZZUNIQE Company Admin',
  description: 'Solar inverters, string controllers and communication setup',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_master" initialSubTab="plants" />;
}
