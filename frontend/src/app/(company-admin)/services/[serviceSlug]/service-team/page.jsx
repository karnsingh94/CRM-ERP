import { Suspense } from 'react';
import CompanyAdminPortal from '@/components/company-admin/CompanyAdminPortal';

export function generateStaticParams() {
  return [
    { serviceSlug: 'crm-sales' },
    { serviceSlug: 'purchase-vendor' },
    { serviceSlug: 'inventory-warehouse' },
    { serviceSlug: 'manufacturing-production' },
    { serviceSlug: 'dispatch-returns' },
    { serviceSlug: 'accounts-banking' },
    { serviceSlug: 'permission-controls' },
    { serviceSlug: 'crm_sales' },
    { serviceSlug: 'purchase_vendor' },
    { serviceSlug: 'inventory_warehouse' },
    { serviceSlug: 'manufacturing_production' },
    { serviceSlug: 'dispatch_returns' },
    { serviceSlug: 'accounts_banking' },
    { serviceSlug: 'permission_controls' },
  ];
}

export async function generateMetadata({ params }) {
  const { serviceSlug = 'service' } = await params;
  const formatted = serviceSlug.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  return {
    title: `${formatted} Department Head — AZZUNIQE Company Admin`,
    description: `Manage department heads, teams, and staff allocations for ${formatted}`,
  };
}

async function ServiceTeamContent({ params }) {
  const { serviceSlug = 'crm_sales' } = await params;
  const slug = serviceSlug.replace(/-/g, '_');
  return <CompanyAdminPortal initialTab={`services:${slug}:departments`} />;
}

export default function ServiceTeamPage({ params }) {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading Department Head...</div>}>
      <ServiceTeamContent params={params} />
    </Suspense>
  );
}
