import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Tally Prime Integration & XML Export — AZZUNIQE Company Admin',
  description: 'Tally ledger mappings, idempotent voucher exports, and XML batches',
};

export default function AccountsTallyPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="tally" />;
}

