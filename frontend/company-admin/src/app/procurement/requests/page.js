import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Purchase Requests (PR) — AZZUNIQE Company Admin',
  description: 'Internal purchase requisitions awaiting management authorization',
};

export default function ProcurementRequestsPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:procurement" />;
}
