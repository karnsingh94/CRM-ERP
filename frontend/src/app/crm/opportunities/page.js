import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Deal Opportunities — AZZUNIQE Company Admin',
  description: 'High-value enterprise sales pipelines and win-rate forecasting',
};

export default function CrmOpportunitiesPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" initialSubTab="opportunities" />;
}
