import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Panel Cleaning Schedules — AZZUNIQE Company Admin',
  description: 'Solar module wash rosters and soiling loss prevention',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="solar_monitoring:solar_maintenance" initialSubTab="maintenance" />;
}
