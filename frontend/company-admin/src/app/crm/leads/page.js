import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Leads Pipeline — AZZUNIQE Company Admin',
  description: 'Inquiry capture, qualification stages, and lead conversion pipeline',
};

export default function CrmLeadsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" />;
}
