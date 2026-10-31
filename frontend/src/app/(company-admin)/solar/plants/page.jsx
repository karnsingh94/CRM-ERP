import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Solar Plants Master — AZZUNIQE Company Admin',
  description: 'Solar plant directory, installed capacity and grid interconnection',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_master" initialSubTab="plants" />;
}
