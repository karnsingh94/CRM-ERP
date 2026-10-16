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
  const resolvedParams = await params;
  const slug = resolvedParams?.serviceSlug || 'service';
  const formatted = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${formatted} — AZZUNIQE Company Admin`,
    description: `Assigned service operations and department management for ${formatted}`,
  };
}

async function ServiceContent({ params }) {
  const resolvedParams = await params;
  const slug = (resolvedParams?.serviceSlug || 'crm_sales').replace(/-/g, '_');
  return <CompanyAdminPortal initialTab={`services:${slug}:departments`} />;
}

export default function ServicePage({ params }) {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading service workspace...</div>}>
      <ServiceContent params={params} />
    </Suspense>
  );
}
