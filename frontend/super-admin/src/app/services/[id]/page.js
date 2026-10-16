import SuperAdminPortal from '../../page';

export function generateStaticParams() {
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
    { id: '5' },
    { id: '6' },
    { id: '7' },
  ];
}

export default async function ServiceDetailPage({ params }) {
  const resolvedParams = await params;
  return (
    <SuperAdminPortal
      initialTab="service-detail"
      initialServiceId={resolvedParams?.id}
    />
  );
}
