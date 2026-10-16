import CompanyAdminPortal from '../page';

export const metadata = {
  title: 'Customer Sales Returns (RMA) — AZZUNIQE Company Admin',
  description: 'Inbound customer returns, RMA approvals, and defect analysis',
};

export default function ReturnsPage() {
  return <CompanyAdminPortal initialTab="dispatch_returns:returns" />;
}
