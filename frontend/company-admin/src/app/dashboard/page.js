import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Dashboard — AZZUNIQE Company Admin',
  description: 'Operational Dashboard for AZZUNIQE CRM & ERP',
};

export default function DashboardPage() {
  return <CompanyAdminPortal initialTab="dashboard" />;
}
