import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Delivery Challans & Packing Lists — AZZUNIQE Company Admin',
  description: 'Official transport delivery challans, package counts, and gross shipping weights',
};

export default function DispatchChallansPage() {
  return <CompanyAdminPortal initialTab="dispatch_returns:dispatch" />;
}
