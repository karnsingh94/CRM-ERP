import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Solar Monitoring — AZZUNIQE Company Admin',
  description: 'Solar power plant setup, inverter telemetry and PR tracking',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_master" initialSubTab="plants" />;
}
