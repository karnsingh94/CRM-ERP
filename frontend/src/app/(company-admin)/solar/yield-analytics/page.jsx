import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Yield Analytics & PR — AZZUNIQUE Company Admin',
  description: 'Daily and monthly kWh yield analytics and PR benchmark',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_generation" initialSubTab="telemetry" />;
}
