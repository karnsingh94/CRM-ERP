import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Products Directory — AZZUNIQUE Company Admin',
  description: 'Finished goods, raw materials, SKUs, and inventory specifications',
};

export default function ProductsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:product" />;
}
