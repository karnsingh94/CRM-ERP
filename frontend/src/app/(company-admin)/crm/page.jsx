import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'CRM Management — AZZUNIQE Company Admin',
  description: 'Customer relationship and sales pipeline workspace',
};

export default function CrmIndexPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" />;
}
