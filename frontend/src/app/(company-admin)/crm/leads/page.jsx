import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Leads Pipeline — AZZUNIQUE Company Admin',
  description: 'Inquiry capture, qualification stages, and lead conversion pipeline',
};

export default function CrmLeadsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" initialSubTab="leads" />;
}
