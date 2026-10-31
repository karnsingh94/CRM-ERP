import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Inverter Alarms — AZZUNIQE Company Admin',
  description: 'Grid dropouts, inverter faults and telemetry alerts',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_generation" initialSubTab="telemetry" />;
}
