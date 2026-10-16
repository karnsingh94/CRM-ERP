import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Vendor Master Directory — AZZUNIQE Company Admin',
  description: 'Approved suppliers, procurement partners, and banking details',
};

export default function VendorsPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:vendor" />;
}
