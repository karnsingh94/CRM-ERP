import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Customer Receipts & Payments — AZZUNIQE Company Admin',
  description: 'Inward cash/bank receipts, customer advance collections, and allocation matching',
};

export default function AccountsPaymentsPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="receipts" />;
}
