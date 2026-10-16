import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Commercial Tax Invoices — AZZUNIQE Company Admin',
  description: 'Final sales invoices, tax breakdown schedules, and client payment tracking',
};

export default function AccountsInvoicesPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" />;
}
