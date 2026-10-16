import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Product Categories — AZZUNIQE Company Admin',
  description: 'Classification hierarchy and category taxonomies',
};

export default function ProductCategoriesPage() {
  return <CompanyAdminPortal initialTab="crm_sales:product" />;
}
