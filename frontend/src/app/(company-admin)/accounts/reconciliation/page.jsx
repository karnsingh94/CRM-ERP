import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Bank Reconciliation (BRS) — AZZUNIQE Company Admin',
  description: 'Electronic reconciliation matching, BRS reports, and difference adjustment vouchers',
};

export default function AccountsReconciliationPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="reconciliation" />;
}

