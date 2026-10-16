import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Products Directory — AZZUNIQE Company Admin',
  description: 'Finished goods, raw materials, SKUs, and inventory specifications',
};

export default function ProductsPage() {
  return <CompanyAdminPortal initialTab="crm_sales:product" />;
}
