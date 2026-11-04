import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Goods Receipt Note (GRN) — AZZUNIQUE Company Admin',
  description: 'Warehouse inward consignment inspection and receipt register',
};

export default function GrnPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:grn" initialSubTab="receipts" />;
}
