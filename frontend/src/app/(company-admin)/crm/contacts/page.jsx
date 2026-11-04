import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Contact Persons — AZZUNIQUE Company Admin',
  description: 'Direct stakeholder directory and communication channels',
};

export default function CrmContactsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" initialSubTab="contacts" />;
}
