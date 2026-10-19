/**
 * AZZUNIQE CRM & ERP — Super Admin Route Configuration & Metadata
 * Centralized, scalable route directory for Platform Super Admin.
 */

export const SUPER_ADMIN_ROUTES = [
  {
    path: '/super-admin/dashboard',
    tab: 'dashboard',
    label: 'Dashboard',
    title: 'Super Admin Overview',
    description: 'System health, global KPI metrics, and tenant distribution overview',
    parent: null,
    icon: 'IconDashboard',
    isNav: true,
    section: 'Navigation',
  },
  {
    path: '/super-admin/services',
    tab: 'services',
    label: 'Services Catalog',
    title: 'Services Catalog Management',
    description: 'Management of the fixed 7 enterprise core services, modules, and sub-modules',
    parent: '/super-admin/dashboard',
    icon: 'IconGrid',
    isNav: true,
    section: 'Navigation',
  },
  {
    path: '/super-admin/services/[id]',
    tab: 'service-detail',
    label: 'Service Detail',
    title: 'Service & Module Hierarchy',
    description: 'Detailed module and feature screen hierarchy for selected service',
    parent: '/super-admin/services',
    icon: 'IconLayers',
    isNav: false,
    section: 'Navigation',
  },
  {
    path: '/super-admin/clients',
    tab: 'clients',
    label: 'Admins & Clients',
    title: 'Admin & Client Panels Management',
    description: 'Tenant company provisioning and dynamic permission tree assignments',
    parent: '/super-admin/dashboard',
    icon: 'IconUsers',
    isNav: true,
    section: 'Navigation',
  },
  {
    path: '/super-admin/audit-logs',
    tab: 'audit-logs',
    label: 'Audit Logs',
    title: 'System Audit Logs',
    description: 'Platform-wide security audit trail and administrative activity tracking',
    parent: '/super-admin/dashboard',
    icon: 'IconClipboardList',
    isNav: true,
    section: 'System & Security',
  },
  {
    path: '/super-admin/settings',
    tab: 'settings',
    label: 'Settings',
    title: 'System Settings',
    description: 'Platform configuration, database parameters, and maintenance controls',
    parent: '/super-admin/dashboard',
    icon: 'IconSettings',
    isNav: true,
    section: 'System & Security',
  },
];

/**
 * Find route definition by exact pathname or path template
 */
export function getSuperAdminRoute(pathname) {
  if (!pathname || pathname === '/super-admin' || pathname === '/super-admin/dashboard') {
    return SUPER_ADMIN_ROUTES[0];
  }
  
  // Exact match
  const exact = SUPER_ADMIN_ROUTES.find(r => r.path === pathname);
  if (exact) return exact;

  // Dynamic service detail match (/services/1, /services/2)
  if (pathname.startsWith('/super-admin/services/')) {
    return SUPER_ADMIN_ROUTES.find(r => r.path === '/super-admin/services/[id]');
  }

  return null;
}

/**
 * Generate hierarchical breadcrumbs for a given pathname
 */
export function getSuperAdminBreadcrumbs(pathname, customLabels = {}) {
  const currentRoute = getSuperAdminRoute(pathname);
  
  if (!currentRoute || currentRoute.path === '/super-admin/dashboard') {
    return [
      { label: 'Super Admin', path: '/super-admin', isCurrent: false },
      { label: 'Dashboard', path: '/super-admin/dashboard', isCurrent: true },
    ];
  }

  const crumbs = [];

  // Always start with Dashboard as root parent
  crumbs.push({ label: 'Dashboard', path: '/super-admin/dashboard', isCurrent: false });

  if (currentRoute.parent && currentRoute.parent !== '/super-admin/dashboard') {
    const parentRoute = SUPER_ADMIN_ROUTES.find(r => r.path === currentRoute.parent);
    if (parentRoute) {
      crumbs.push({
        label: parentRoute.label,
        path: parentRoute.path,
        isCurrent: false,
      });
    }
  }

  // Current item
  let leafLabel = currentRoute.label;
  if (customLabels.serviceName && currentRoute.tab === 'service-detail') {
    leafLabel = customLabels.serviceName;
  }

  crumbs.push({
    label: leafLabel,
    path: pathname,
    isCurrent: true,
  });

  return crumbs;
}
