import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Live Generation Telemetry — AZZUNIQE Company Admin',
  description: 'Real-time power generation (kW) and irradiation levels',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_generation" initialSubTab="telemetry" />;
}
