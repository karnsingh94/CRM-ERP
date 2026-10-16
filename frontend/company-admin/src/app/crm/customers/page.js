import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Customer Directory — AZZUNIQE Company Admin',
  description: 'Verified enterprise client records and tax details',
};

export default function CrmCustomersPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" />;
}
