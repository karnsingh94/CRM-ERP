import { redirect } from 'next/navigation';

export default async function LegacyDepartmentsPage({ params }) {
  const { serviceSlug } = await params;
  redirect(`/services/${serviceSlug}/service-team`);
}
