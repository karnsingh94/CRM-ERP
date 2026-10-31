import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Panel Layout — AZZUNIQE Company Admin',
  description: 'Photovoltaic panel strings and array tilt configuration',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_master" initialSubTab="plants" />;
}
