import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'O&M Spares Tracking — AZZUNIQE Company Admin',
  description: 'Solar replacement spares and consumables inventory',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_maintenance" initialSubTab="maintenance" />;
}
