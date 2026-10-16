import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Sales Orders — AZZUNIQE Company Admin',
  description: 'Confirmed sales orders, order fulfillment, and status tracking',
};

export default function SalesOrdersPage() {
  return <CompanyAdminPortal initialTab="crm_sales:sales" />;
}
