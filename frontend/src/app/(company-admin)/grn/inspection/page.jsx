import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Quality Inspection (QC) — AZZUNIQE Company Admin',
  description: 'Material acceptance sampling, batch verification, and rejection reports',
};

export default function GrnInspectionPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:grn" initialSubTab="receipts" />;
}
