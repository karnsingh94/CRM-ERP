import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Receivables & Payables Ledger — AZZUNIQE Company Admin',
  description: 'Aging analysis, party financial ledgers, and cashflow positions',
};

export default function AccountsLedgerPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" />;
}
