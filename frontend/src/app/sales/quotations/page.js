import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Quotations — AZZUNIQE Company Admin',
  description: 'Formal commercial quotation drafts and customer pricing proposals',
};

export default function SalesQuotationsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:sales" initialSubTab="quotes" />;
}
