import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Accounts & Banking Workspace — AZZUNIQE Company Admin',
  description: 'Financial dashboard, chart of accounts, sales invoicing, receipts, payables, GL, bank reconciliation and Tally integration',
};

export default function AccountsPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="dashboard" />;
}
