import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Outward Dispatch Queue — AZZUNIQE Company Admin',
  description: 'Ready-to-ship order staging, courier assignment, and shipping labels',
};

export default function DispatchPage() {
  return <CompanyAdminPortal initialTab="dispatch_returns:dispatch" />;
}
