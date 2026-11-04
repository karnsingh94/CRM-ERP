import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Reports & Intelligence Portal — AZZUNIQE Company Admin',
  description: 'Enterprise financial statements, operational reports, and cross-module flow tracking',
};

export default function Page() {
  return <CompanyAdminPortal initialTab="reports" />;
}

