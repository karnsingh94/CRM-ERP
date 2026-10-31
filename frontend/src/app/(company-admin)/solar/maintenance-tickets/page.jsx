import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Maintenance Tickets — AZZUNIQE Company Admin',
  description: 'O&M breakdown and preventive work orders',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_maintenance" initialSubTab="maintenance" />;
}
