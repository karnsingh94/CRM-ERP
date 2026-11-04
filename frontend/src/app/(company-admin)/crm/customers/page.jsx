import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Customer Directory — AZZUNIQUE Company Admin',
  description: 'Verified enterprise client records and tax details',
};

export default function CrmCustomersPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" initialSubTab="customers" />;
}
