import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Goods Receipt Note (GRN) — AZZUNIQE Company Admin',
  description: 'Warehouse inward consignment inspection and receipt register',
};

export default function GrnPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:grn" />;
}
