import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Contact Persons — AZZUNIQE Company Admin',
  description: 'Direct stakeholder directory and communication channels',
};

export default function CrmContactsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:crm" />;
}
