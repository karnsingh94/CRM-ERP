import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Purchase Deviations & Vendor Returns — AZZUNIQE Company Admin',
  description: 'Track rejected GRN quantities, quality deviations, and material returned to vendors',
};

export default function GrnDeviationPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:grn" initialSubTab="returns" />;
}
