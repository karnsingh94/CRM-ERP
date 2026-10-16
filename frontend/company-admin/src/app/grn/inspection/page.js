import CompanyAdminPortal from '../../page';

export const metadata = {
  title: 'Quality Inspection (QC) — AZZUNIQE Company Admin',
  description: 'Material acceptance sampling, batch verification, and rejection reports',
};

export default function GrnInspectionPage() {
  return <CompanyAdminPortal initialTab="purchase_vendor:grn" />;
}
