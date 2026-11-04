import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'General Ledger & Journal Vouchers — AZZUNIQE Company Admin',
  description: 'Authoritative double-entry vouchers, account debits, and balance records',
};

export default function AccountsLedgerPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="gl" />;
}
