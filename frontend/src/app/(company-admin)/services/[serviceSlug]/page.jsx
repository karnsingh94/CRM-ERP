import { Suspense } from 'react';
import ServicePageClient from './ServicePageClient';

export const dynamicParams = true;

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
    { serviceSlug: '1' },
    { serviceSlug: '2' },
    { serviceSlug: '3' },
    { serviceSlug: '4' },
    { serviceSlug: '5' },
    { serviceSlug: '6' },
    { serviceSlug: '7' },
  ];
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.serviceSlug || 'service';
  const formatted = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    title: `${formatted} — AZZUNIQE Workspace`,
    description: `Service management and details for ${formatted}`,
  };
}

export default async function ServicePage({ params }) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading service workspace...</div>}>
      <ServicePageClient serviceSlug={resolvedParams?.serviceSlug} />
    </Suspense>
  );
}
