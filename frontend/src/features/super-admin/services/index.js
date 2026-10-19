'use client';

import SuperAdminPortal from '../SuperAdminPortal';

export default function SuperAdminServicesFeature({ serviceId }) {
  return <SuperAdminPortal initialTab={serviceId ? 'service-detail' : 'services'} initialServiceId={serviceId} />;
}
