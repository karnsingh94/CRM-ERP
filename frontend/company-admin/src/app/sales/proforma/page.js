import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Proforma Invoices — AZZUNIQE Company Admin',
  description: 'Advance payment notices and proforma commercial invoices',
};

export default function SalesProformaPage() {
  return <CompanyAdminPortal initialTab="crm_sales:sales" />;
}
