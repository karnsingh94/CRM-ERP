import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Customer Receipts & Payments — AZZUNIQE Company Admin',
  description: 'Inward cash/bank receipts, customer advance collections, and allocation matching',
  title: 'Payment Receipts & Vouchers — AZZUNIQUE Company Admin',
  description: 'Bank transfers, NEFT/RTGS receipts, and reconciliation vouchers',
};

export default function AccountsPaymentsPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" initialSubTab="receipts" />;
}
