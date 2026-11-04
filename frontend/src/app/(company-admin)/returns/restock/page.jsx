import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Return Restocking Ledger — AZZUNIQUE Company Admin',
  description: 'QC return disposition, warehouse restocking, and credit note issuance',
};

export default function ReturnsRestockPage() {
  return <CompanyAdminPortal initialTab="dispatch_returns:returns" />;
}
