import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Request for Quotation (RFQ) — AZZUNIQE Company Admin',
  description: 'Vendor RFQ records, supplier bid comparison matrix, and quotation evaluations',
};

export default function ProcurementRfqPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:procurement" />;
}
