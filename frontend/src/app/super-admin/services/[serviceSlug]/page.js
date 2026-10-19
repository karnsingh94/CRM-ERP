import SuperAdminPortal from '@/components/super-admin/SuperAdminPortal';

export default async function SuperAdminServiceDetailPage({ params }) {
  const resolvedParams = await params;
  const slug = resolvedParams?.serviceSlug;
  return <SuperAdminPortal initialTab="service-detail" initialServiceId={slug} />;
}
