import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Vendor Invoices & Bills — AZZUNIQE Company Admin',
  description: 'Supplier invoice matching, three-way GRN match, and accounts payable queue',
};

export default function AccountsBillsPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" />;
}
