import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Payment Receipts & Vouchers — AZZUNIQE Company Admin',
  description: 'Bank transfers, NEFT/RTGS receipts, and reconciliation vouchers',
};

export default function AccountsPaymentsPage() {
  return <CompanyAdminPortal initialTab="accounts_banking:accounts_banking" />;
}
