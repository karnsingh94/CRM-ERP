import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export const metadata = {
  title: 'Bill of Materials (BOM) — AZZUNIQE Company Admin',
  description: 'Engineering recipe structures, child components, and raw material formulas',
};

export default function BomPage() {
  return <CompanyAdminPortal initialTab="manufacturing_production:bom" />;
}
