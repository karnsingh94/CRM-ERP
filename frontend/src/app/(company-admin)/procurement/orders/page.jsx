import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Purchase Orders (PO) — AZZUNIQE Company Admin',
  description: 'Authorized purchase order register and supplier delivery tracking',
};

export default function ProcurementOrdersPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:procurement" />;
}
