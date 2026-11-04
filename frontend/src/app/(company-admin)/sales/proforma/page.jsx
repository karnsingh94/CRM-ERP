import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Proforma Invoices — AZZUNIQUE Company Admin',
  description: 'Advance payment notices and proforma commercial invoices',
};

export default function SalesProformaPage() {
  return <CompanyAdminPortal initialTab="crm_sales:sales" initialSubTab="proforma" />;
}
