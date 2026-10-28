import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Vendor Quotation Comparison — AZZUNIQE Company Admin',
  description: 'Compare supplier prices, delivery time, freight, taxes, and payment terms',
};

export default function ProcurementComparisonPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:procurement" initialSubTab="quotations" />;
}
