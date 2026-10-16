import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Return Restocking Ledger — AZZUNIQE Company Admin',
  description: 'QC return disposition, warehouse restocking, and credit note issuance',
};

export default function ReturnsRestockPage() {
  return <CompanyAdminPortal initialTab="dispatch_returns:returns" />;
}
