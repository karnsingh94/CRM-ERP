import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Price Lists & Management — AZZUNIQE Company Admin',
  description: 'Wholesale tiers, currency catalogs, and retail pricing schedules',
};

export default function ProductPricingPage() {
  return <CompanyAdminPortal initialTab="crm_sales:product" initialSubTab="pricing" />;
}
