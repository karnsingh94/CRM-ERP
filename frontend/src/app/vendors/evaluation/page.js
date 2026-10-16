import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Supplier Ratings & Evaluation — AZZUNIQE Company Admin',
  description: 'On-time delivery performance, quality audit scores, and supplier ratings',
};

export default function VendorEvaluationPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:vendor" initialSubTab="vendors" />;
}
