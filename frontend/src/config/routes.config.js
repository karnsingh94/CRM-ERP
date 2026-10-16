/**
 * AZZUNIQE CRM & ERP — Company Admin Route Configuration & Metadata
 * Centralized, scalable route directory for Company Admin tenant workspaces.
 * Synchronized with the fixed 7 enterprise core services and implemented feature screens.
 */

export const COMPANY_ADMIN_ROUTES = [
  // 1. Core Overview & Settings
  {
    path: '/dashboard',
    label: 'Dashboard',
    title: 'Operational Dashboard',
    description: 'Overview of permitted enterprise operations and real company performance metrics',
    parent: null,
    serviceCode: null,
    moduleCode: null,
    icon: 'IconDashboard',
    isNav: true,
  },
  {
    path: '/settings',
    label: 'Company Profile & Preferences',
    title: 'Company Profile & Preferences',
    description: 'Registered organization information and tenant credentials',
    parent: '/dashboard',
    serviceCode: null,
    moduleCode: null,
    icon: 'IconSettings',
    isNav: true,
  },

  // 2. CRM & Sales (crm_sales)
  // 2.1 CRM Management (crm)
  {
    path: '/crm/leads',
    label: 'Leads Pipeline',
    title: 'Leads Pipeline Management',
    description: 'Customer inquiry capture, qualification stages, and deal conversion',
    parent: '/crm',
    serviceCode: 'crm_sales',
    moduleCode: 'crm',
    subModuleCode: 'leads',
    icon: 'IconUsers',
    isNav: true,
  },
  {
    path: '/crm/customers',
    label: 'Customer Directory',
    title: 'Customer Directory',
    description: 'Verified enterprise clients, tax IDs, and billing contact management',
    parent: '/crm',
    serviceCode: 'crm_sales',
    moduleCode: 'crm',
    subModuleCode: 'customers',
    icon: 'IconUsers',
    isNav: true,
  },
  {
    path: '/crm/contacts',
    label: 'Contact Persons',
    title: 'Contact Persons Directory',
    description: 'Direct stakeholder directory, phone numbers, and communication logs',
    parent: '/crm',
    serviceCode: 'crm_sales',
    moduleCode: 'crm',
    subModuleCode: 'contacts',
    icon: 'IconUsers',
    isNav: true,
  },
  {
    path: '/crm/opportunities',
    label: 'Deal Opportunities',
    title: 'Deal Opportunities Pipeline',
    description: 'High-value enterprise sales pipelines and win-rate forecasting',
    parent: '/crm',
    serviceCode: 'crm_sales',
    moduleCode: 'crm',
    subModuleCode: 'opportunities',
    icon: 'IconTrendingUp',
    isNav: true,
  },

  // 2.2 Products & Catalogue (product)
  {
    path: '/products',
    label: 'Product Directory',
    title: 'Product Directory & Catalogue',
    description: 'Finished goods, raw materials, SKUs, and pricing specifications',
    parent: '/products',
    serviceCode: 'crm_sales',
    moduleCode: 'product',
    subModuleCode: 'product_list',
    icon: 'IconBox',
    isNav: true,
  },
  {
    path: '/products/categories',
    label: 'Categories & Types',
    title: 'Product Categories & Classification',
    description: 'Hierarchy classification for product categorization and filtering',
    parent: '/products',
    serviceCode: 'crm_sales',
    moduleCode: 'product',
    subModuleCode: 'categories',
    icon: 'IconLayers',
    isNav: true,
  },
  {
    path: '/products/pricing',
    label: 'Price Management',
    title: 'Price Lists & Volume Tiers',
    description: 'Wholesale, distributor, and retail pricing schedules',
    parent: '/products',
    serviceCode: 'crm_sales',
    moduleCode: 'product',
    subModuleCode: 'price_list',
    icon: 'IconCreditCard',
    isNav: true,
  },

  // 2.3 Sales Operations (sales)
  {
    path: '/sales/quotations',
    label: 'Quotations',
    title: 'Sales Quotations Drafts',
    description: 'Formal commercial quotations and client proposal documents',
    parent: '/sales',
    serviceCode: 'crm_sales',
    moduleCode: 'sales',
    subModuleCode: 'quotations',
    icon: 'IconShoppingBag',
    isNav: true,
  },
  {
    path: '/sales/proforma',
    label: 'Proforma Invoices (PI)',
    title: 'Proforma Invoices (PI)',
    description: 'Advance payment notices and proforma commercial invoices',
    parent: '/sales',
    serviceCode: 'crm_sales',
    moduleCode: 'sales',
    subModuleCode: 'proforma_invoice',
    icon: 'IconFileText',
    isNav: true,
  },
  {
    path: '/sales/orders',
    label: 'Sales Orders',
    title: 'Confirmed Sales Orders',
    description: 'Customer purchase agreements and fulfillment processing queue',
    parent: '/sales',
    serviceCode: 'crm_sales',
    moduleCode: 'sales',
    subModuleCode: 'sales_orders',
    icon: 'IconShoppingBag',
    isNav: true,
  },

  // 3. Purchase & Vendor (purchase_vendor)
  // 3.1 Vendor Directory (vendor)
  {
    path: '/vendors',
    label: 'Vendor Directory',
    title: 'Vendor Master Directory',
    description: 'Approved suppliers, procurement partners, and banking details',
    parent: '/vendors',
    serviceCode: 'purchase_vendor',
    moduleCode: 'vendor',
    subModuleCode: 'vendor_master',
    icon: 'IconTruck',
    isNav: true,
  },
  {
    path: '/vendors/evaluation',
    label: 'Supplier Ratings',
    title: 'Vendor Performance & QC Ratings',
    description: 'On-time delivery, quality audit scores, and supplier ratings',
    parent: '/vendors',
    serviceCode: 'purchase_vendor',
    moduleCode: 'vendor',
    subModuleCode: 'vendor_eval',
    icon: 'IconClipboardCheck',
    isNav: true,
  },

  // 3.2 Procurement & Orders (procurement)
  {
    path: '/procurement/requests',
    label: 'Purchase Requests',
    title: 'Purchase Requisitions (PR)',
    description: 'Internal departmental purchase requests awaiting approval',
    parent: '/procurement',
    serviceCode: 'purchase_vendor',
    moduleCode: 'procurement',
    subModuleCode: 'purchase_requests',
    icon: 'IconFileText',
    isNav: true,
  },
  {
    path: '/procurement/rfq',
    label: 'Request for Quotation (RFQ)',
    title: 'Vendor RFQs & Price Comparisons',
    description: 'Multi-supplier price inquiries and quotation comparison matrix',
    parent: '/procurement',
    serviceCode: 'purchase_vendor',
    moduleCode: 'procurement',
    subModuleCode: 'rfq',
    icon: 'IconFileText',
    isNav: true,
  },
  {
    path: '/procurement/orders',
    label: 'Purchase Orders (PO)',
    title: 'Purchase Orders (PO) Register',
    description: 'Legally binding purchase contracts issued to authorized suppliers',
    parent: '/procurement',
    serviceCode: 'purchase_vendor',
    moduleCode: 'procurement',
    subModuleCode: 'purchase_orders',
    icon: 'IconFileText',
    isNav: true,
  },

  // 3.3 Goods Receipt Note (grn)
  {
    path: '/grn',
    label: 'Goods Receipt Note (GRN)',
    title: 'Inward Goods Receipts (GRN)',
    description: 'Warehouse inward consignment inspection and receipt register',
    parent: '/grn',
    serviceCode: 'purchase_vendor',
    moduleCode: 'grn',
    subModuleCode: 'grn_list',
    icon: 'IconClipboardCheck',
    isNav: true,
  },
  {
    path: '/grn/inspection',
    label: 'Quality Inspection (QC)',
    title: 'GRN Quality Control & Lab Testing',
    description: 'Material acceptance sampling, batch verification, and rejection reports',
    parent: '/grn',
    serviceCode: 'purchase_vendor',
    moduleCode: 'grn',
    subModuleCode: 'quality_inspection',
    icon: 'IconClipboardCheck',
    isNav: true,
  },

  // 4. Inventory & Warehouse (inventory_warehouse)
  // 4.1 Stock Management (inventory_mgmt)
  {
    path: '/inventory',
    label: 'Stock Overview',
    title: 'Real-Time Inventory & Stock Overview',
    description: 'On-hand quantity balances, bin locations, and re-order thresholds',
    parent: '/inventory',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'inventory_mgmt',
    subModuleCode: 'stock_summary',
    icon: 'IconLayers',
    isNav: true,
  },
  {
    path: '/inventory/warehouses',
    label: 'Warehouse Locations',
    title: 'Warehouse & Storage Locations',
    description: 'Physical warehouse godowns, aisle numbers, and rack allocations',
    parent: '/inventory',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'inventory_mgmt',
    subModuleCode: 'warehouse_locations',
    icon: 'IconBuilding',
    isNav: true,
  },
  {
    path: '/inventory/adjustments',
    label: 'Stock Adjustments',
    title: 'Stock Reconciliation & Adjustments',
    description: 'Physical audit write-offs, variance logs, and count adjustments',
    parent: '/inventory',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'inventory_mgmt',
    subModuleCode: 'stock_adjustments',
    icon: 'IconLayers',
    isNav: true,
  },
  {
    path: '/inventory/movements',
    label: 'Stock Movement Ledger',
    title: 'Stock Movement Ledger (Bin Card)',
    description: 'Full chronological transaction ledger of all stock in/out events',
    parent: '/inventory',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'inventory_mgmt',
    subModuleCode: 'movements',
    icon: 'IconActivity',
    isNav: true,
  },

  // 4.2 Gate Pass Management (gate_pass)
  {
    path: '/gate-pass/inward',
    label: 'Inward Gate Passes',
    title: 'Security Inward Gate Pass Register',
    description: 'Factory gate inward verification for delivery trucks and couriers',
    parent: '/gate-pass',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'gate_pass',
    subModuleCode: 'inward_pass',
    icon: 'IconShield',
    isNav: true,
  },
  {
    path: '/gate-pass/outward',
    label: 'Outward Gate Passes',
    title: 'Security Outward Gate Pass Register',
    description: 'Material dispatch clearance and outward vehicle exit tracking',
    parent: '/gate-pass',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'gate_pass',
    subModuleCode: 'outward_pass',
    icon: 'IconShield',
    isNav: true,
  },
  {
    path: '/gate-pass/returnable',
    label: 'Returnable Asset Tracking',
    title: 'Returnable Gate Pass & Asset Ledger',
    description: 'Sub-contracting tools, calibration instruments, and return tracking',
    parent: '/gate-pass',
    serviceCode: 'inventory_warehouse',
    moduleCode: 'gate_pass',
    subModuleCode: 'returnable_tracking',
    icon: 'IconShield',
    isNav: true,
  },

  // 5. Manufacturing & Production (manufacturing_production)
  {
    path: '/bom',
    label: 'Bill of Materials',
    title: 'Formula & Bill of Materials (BOM)',
    description: 'Engineering recipe structures, child components, and raw material formulas',
    parent: '/bom',
    serviceCode: 'manufacturing_production',
    moduleCode: 'bom',
    subModuleCode: 'bom_list',
    icon: 'IconCpu',
    isNav: true,
  },
  {
    path: '/bom/costing',
    label: 'Recipe Cost Estimator',
    title: 'BOM Production Cost Estimator',
    description: 'Direct material, overhead allocation, and batch unit costing calculations',
    parent: '/bom',
    serviceCode: 'manufacturing_production',
    moduleCode: 'bom',
    subModuleCode: 'costing',
    icon: 'IconCreditCard',
    isNav: true,
  },
  {
    path: '/production/orders',
    label: 'Production Orders',
    title: 'Shopfloor Production Orders',
    description: 'Manufacturing work releases, target quantities, and scheduled completion dates',
    parent: '/production',
    serviceCode: 'manufacturing_production',
    moduleCode: 'production',
    subModuleCode: 'production_orders',
    icon: 'IconCpu',
    isNav: true,
  },
  {
    path: '/production/work-orders',
    label: 'Shopfloor Work Orders',
    title: 'Station Work Orders & Routing',
    description: 'Stage-by-stage assembly lines, machine schedules, and operator assignments',
    parent: '/production',
    serviceCode: 'manufacturing_production',
    moduleCode: 'production',
    subModuleCode: 'work_orders',
    icon: 'IconCpu',
    isNav: true,
  },
  {
    path: '/production/consumption',
    label: 'Material Consumption',
    title: 'Production Raw Material Consumption',
    description: 'Batch scrap tracking, yield variance, and raw material reconciliation',
    parent: '/production',
    serviceCode: 'manufacturing_production',
    moduleCode: 'production',
    subModuleCode: 'material_consumption',
    icon: 'IconActivity',
    isNav: true,
  },

  // 6. Dispatch & Returns (dispatch_returns)
  {
    path: '/dispatch',
    label: 'Dispatch Queue',
    title: 'Outward Dispatch Queue',
    description: 'Ready-to-ship order staging, courier assignment, and shipping labels',
    parent: '/dispatch',
    serviceCode: 'dispatch_returns',
    moduleCode: 'dispatch',
    subModuleCode: 'dispatch_orders',
    icon: 'IconPackage',
    isNav: true,
  },
  {
    path: '/dispatch/challans',
    label: 'Delivery Challans & Packing',
    title: 'Delivery Challans & Packing Lists',
    description: 'Official transport challans, package counts, and gross shipping weights',
    parent: '/dispatch',
    serviceCode: 'dispatch_returns',
    moduleCode: 'dispatch',
    subModuleCode: 'packing_slips',
    icon: 'IconTruck',
    isNav: true,
  },
  {
    path: '/returns',
    label: 'Return Authorizations (RMA)',
    title: 'Customer Sales Returns (RMA)',
    description: 'Inbound customer returns, RMA approvals, and defect analysis',
    parent: '/returns',
    serviceCode: 'dispatch_returns',
    moduleCode: 'returns',
    subModuleCode: 'sales_returns',
    icon: 'IconCornerDownLeft',
    isNav: true,
  },
  {
    path: '/returns/restock',
    label: 'Return Restocking Ledger',
    title: 'Restocking & Credit Authorization',
    description: 'QC return disposition, warehouse restocking, and credit note issuance',
    parent: '/returns',
    serviceCode: 'dispatch_returns',
    moduleCode: 'returns',
    subModuleCode: 'credit_notes',
    icon: 'IconLayers',
    isNav: true,
  },

  // 7. Accounts & Banking (accounts_banking)
  {
    path: '/accounts/invoices',
    label: 'Tax Invoices',
    title: 'Commercial Tax Invoices (GST)',
    description: 'Final sales invoices, tax breakdown schedules, and payment links',
    parent: '/accounts',
    serviceCode: 'accounts_banking',
    moduleCode: 'accounts_banking',
    subModuleCode: 'invoices',
    icon: 'IconCreditCard',
    isNav: true,
  },
  {
    path: '/accounts/bills',
    label: 'Vendor Bills',
    title: 'Vendor Invoices & Bills Payable',
    description: 'Supplier invoice matching, three-way GRN match, and approval queues',
    parent: '/accounts',
    serviceCode: 'accounts_banking',
    moduleCode: 'accounts_banking',
    subModuleCode: 'bills',
    icon: 'IconFileText',
    isNav: true,
  },
  {
    path: '/accounts/payments',
    label: 'Payment Receipts',
    title: 'Payment Inward & Outward Vouchers',
    description: 'Bank transfers, NEFT/RTGS receipts, and reconciliation vouchers',
    parent: '/accounts',
    serviceCode: 'accounts_banking',
    moduleCode: 'accounts_banking',
    subModuleCode: 'payments',
    icon: 'IconCreditCard',
    isNav: true,
  },
  {
    path: '/accounts/ledger',
    label: 'Receivables & Payables Ledger',
    title: 'General Receivables & Payables Ledger',
    description: 'Aging analysis, party ledgers, and financial cashflow positions',
    parent: '/accounts',
    serviceCode: 'accounts_banking',
    moduleCode: 'accounts_banking',
    subModuleCode: 'receivables_payables',
    icon: 'IconTrendingUp',
    isNav: true,
  },

  // 8. Permission Controls & Team (permission_controls)
  {
    path: '/team',
    label: 'Company Employees',
    title: 'Company Staff & Users Directory',
    description: 'Internal employees, department allocations, and login credential management',
    parent: '/team',
    serviceCode: 'permission_controls',
    moduleCode: 'permission_controls',
    subModuleCode: 'team_users',
    icon: 'IconUsers',
    isNav: true,
  },
  {
    path: '/team/roles',
    label: 'Department Roles',
    title: 'Role-Based Access Control (RBAC)',
    description: 'Custom internal permission templates and feature privilege sets',
    parent: '/team',
    serviceCode: 'permission_controls',
    moduleCode: 'permission_controls',
    subModuleCode: 'role_assignment',
    icon: 'IconShield',
    isNav: true,
  },
  {
    path: '/team/audit',
    label: 'Activity Audit Trail',
    title: 'Tenant Operational Audit Trail',
    description: 'Staff action logs, data update histories, and security timestamps',
    parent: '/team',
    serviceCode: 'permission_controls',
    moduleCode: 'permission_controls',
    subModuleCode: 'audit_trail',
    icon: 'IconClipboardCheck',
    isNav: true,
  },
];

// Map of canonical service metadata
export const SERVICE_TITLES = {
  crm_sales: 'CRM & Sales',
  purchase_vendor: 'Purchase & Vendor',
  inventory_warehouse: 'Inventory & Warehouse',
  manufacturing_production: 'Manufacturing & Production',
  dispatch_returns: 'Dispatch & Returns',
  accounts_banking: 'Accounts & Banking',
  permission_controls: 'Permission Controls',
};

// Map of canonical module metadata
export const MODULE_TITLES = {
  crm: 'CRM Management',
  product: 'Products & Catalogue',
  sales: 'Sales Operations',
  vendor: 'Vendor Directory',
  procurement: 'Procurement & Orders',
  grn: 'Goods Receipt Note (GRN)',
  inventory_mgmt: 'Inventory & Stock',
  gate_pass: 'Gate Pass Management',
  bom: 'Formula / BOM',
  production: 'Production Operations',
  dispatch: 'Dispatch Orders',
  returns: 'Customer Returns (RMA)',
  accounts_banking: 'Financial Ledger',
  permission_controls: 'Company Team & Access',
};

/**
 * Find route definition by exact pathname or dynamic pattern
 */
export function getCompanyAdminRoute(pathname) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return COMPANY_ADMIN_ROUTES[0];
  }

  // Dynamic Service-Based Department Routes & Landing
  const serviceMatch = pathname.match(/^\/services\/([^\/]+)(\/departments)?$/);
  if (serviceMatch) {
    const rawSlug = serviceMatch[1];
    const isDeptSubpath = Boolean(serviceMatch[2]);
    const serviceCode = rawSlug.replace(/-/g, '_');
    const serviceName = SERVICE_TITLES[serviceCode] || serviceCode;
    return {
      path: pathname,
      label: isDeptSubpath ? 'Departments' : serviceName,
      title: `${serviceName} Departments`,
      description: `Service-based department management and staff allocations for ${serviceName}`,
      serviceCode,
      moduleCode: null,
      isNav: true,
    };
  }

  return COMPANY_ADMIN_ROUTES.find(r => r.path === pathname) || null;
}

/**
 * Generate hierarchical breadcrumbs for a given pathname in Company Admin
 */
export function getCompanyAdminBreadcrumbs(pathname, companyName = 'Company') {
  const currentRoute = getCompanyAdminRoute(pathname);
  const cleanCompany = companyName || 'Company';

  if (!currentRoute || currentRoute.path === '/dashboard') {
    return [
      { label: cleanCompany, path: '/dashboard', isCurrent: false },
      { label: 'Operational Dashboard', path: '/dashboard', isCurrent: true },
    ];
  }

  if (currentRoute.path === '/settings') {
    return [
      { label: cleanCompany, path: '/dashboard', isCurrent: false },
      { label: 'Settings & Profile', path: '/settings', isCurrent: true },
    ];
  }

  const crumbs = [];
  // 1. Root Company Name (Clickable link to dashboard)
  crumbs.push({ label: cleanCompany, path: '/dashboard', isCurrent: false });

  // 2. Service Level
  if (currentRoute.serviceCode) {
    const serviceName = SERVICE_TITLES[currentRoute.serviceCode] || currentRoute.serviceCode;
    crumbs.push({ label: serviceName, path: null, isCurrent: false });
  }

  // 3. Module Level
  if (currentRoute.moduleCode) {
    const moduleName = MODULE_TITLES[currentRoute.moduleCode] || currentRoute.moduleCode;
    crumbs.push({ label: moduleName, path: null, isCurrent: false });
  }

  // 4. Current Leaf Screen
  crumbs.push({
    label: currentRoute.label,
    path: currentRoute.path,
    isCurrent: true,
  });

  return crumbs;
}

// Canonical Default Routes for Services
export const SERVICE_DEFAULT_ROUTES = {
  crm_sales: '/crm/leads',
  purchase_vendor: '/procurement/orders',
  inventory_warehouse: '/inventory',
  manufacturing_production: '/production/orders',
  dispatch_returns: '/dispatch',
  accounts_banking: '/accounts/invoices',
  permission_controls: '/team',
};

// Canonical Default Routes for Submodules
export const MODULE_DEFAULT_ROUTES = {
  crm: '/crm/leads',
  product: '/products',
  sales: '/sales/orders',
  vendor: '/vendors',
  procurement: '/procurement/orders',
  grn: '/grn',
  inventory_mgmt: '/inventory',
  gate_pass: '/gate-pass/inward',
  bom: '/bom',
  production: '/production/orders',
  dispatch: '/dispatch',
  returns: '/returns',
  accounts_banking: '/accounts/invoices',
  permission_controls: '/team',
};

/**
 * Resolve hierarchical active state (service, submodule, department, page) from current pathname.
 * Used by Sidebar accordion, topbar and route sync.
 */
export function getHierarchyFromPathname(pathname) {
  if (!pathname || pathname === '/' || pathname === '/dashboard') {
    return {
      serviceCode: null,
      moduleCode: null,
      isDepartmentRoute: false,
      isDashboard: true,
      isSettings: false,
      activePath: '/dashboard',
    };
  }

  if (pathname === '/settings') {
    return {
      serviceCode: null,
      moduleCode: null,
      isDepartmentRoute: false,
      isDashboard: false,
      isSettings: true,
      activePath: '/settings',
    };
  }

  // Dynamic Service Department Routes: /services/[slug]/departments
  const serviceMatch = pathname.match(/^\/services\/([^\/]+)(\/departments)?$/);
  if (serviceMatch) {
    const rawSlug = serviceMatch[1];
    const serviceCode = rawSlug.replace(/-/g, '_');
    return {
      serviceCode,
      moduleCode: null,
      isDepartmentRoute: Boolean(serviceMatch[2]),
      isDashboard: false,
      isSettings: false,
      activePath: pathname,
    };
  }

  // Exact matching in configured routes
  const exact = COMPANY_ADMIN_ROUTES.find((r) => r.path === pathname);
  if (exact) {
    return {
      serviceCode: exact.serviceCode || null,
      moduleCode: exact.moduleCode || null,
      isDepartmentRoute: false,
      isDashboard: false,
      isSettings: false,
      activePath: exact.path,
    };
  }

  // Prefix matching in configured routes
  const prefixMatch = COMPANY_ADMIN_ROUTES.find((r) => r.path !== '/' && r.path !== '/dashboard' && pathname.startsWith(r.path));
  if (prefixMatch) {
    return {
      serviceCode: prefixMatch.serviceCode || null,
      moduleCode: prefixMatch.moduleCode || null,
      isDepartmentRoute: false,
      isDashboard: false,
      isSettings: false,
      activePath: prefixMatch.path,
    };
  }

  // Canonical service route prefixes fallback
  if (pathname.startsWith('/crm')) {
    return { serviceCode: 'crm_sales', moduleCode: 'crm', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/products')) {
    return { serviceCode: 'crm_sales', moduleCode: 'product', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/sales')) {
    return { serviceCode: 'crm_sales', moduleCode: 'sales', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/vendors')) {
    return { serviceCode: 'purchase_vendor', moduleCode: 'vendor', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/procurement')) {
    return { serviceCode: 'purchase_vendor', moduleCode: 'procurement', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/grn')) {
    return { serviceCode: 'purchase_vendor', moduleCode: 'grn', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/gate-pass')) {
    return { serviceCode: 'inventory_warehouse', moduleCode: 'gate_pass', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/inventory')) {
    return { serviceCode: 'inventory_warehouse', moduleCode: 'inventory_mgmt', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/bom')) {
    return { serviceCode: 'manufacturing_production', moduleCode: 'bom', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/production')) {
    return { serviceCode: 'manufacturing_production', moduleCode: 'production', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/dispatch')) {
    return { serviceCode: 'dispatch_returns', moduleCode: 'dispatch', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/returns')) {
    return { serviceCode: 'dispatch_returns', moduleCode: 'returns', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/accounts')) {
    return { serviceCode: 'accounts_banking', moduleCode: 'accounts_banking', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }
  if (pathname.startsWith('/team')) {
    return { serviceCode: 'permission_controls', moduleCode: 'permission_controls', isDepartmentRoute: false, isDashboard: false, isSettings: false, activePath: pathname };
  }

  return {
    serviceCode: null,
    moduleCode: null,
    isDepartmentRoute: false,
    isDashboard: false,
    isSettings: false,
    activePath: pathname,
  };
}

/**
 * Resolve target tab string or route identifier to a canonical URL.
 */
export function resolveCanonicalUrl(target) {
  if (!target || target === 'dashboard') return '/dashboard';
  if (target === 'settings') return '/settings';
  if (target.startsWith('/')) return target;

  if (target.startsWith('services:') && target.endsWith(':departments')) {
    const rawCode = target.split(':')[1];
    return `/services/${rawCode.replace(/_/g, '-')}/departments`;
  }

  if (SERVICE_DEFAULT_ROUTES[target]) {
    return SERVICE_DEFAULT_ROUTES[target];
  }

  if (target.includes(':')) {
    const parts = target.split(':');
    const mod = parts[1];
    if (MODULE_DEFAULT_ROUTES[mod]) return MODULE_DEFAULT_ROUTES[mod];
    const srv = parts[0];
    if (SERVICE_DEFAULT_ROUTES[srv]) return SERVICE_DEFAULT_ROUTES[srv];
  }

  return '/dashboard';
}

export {
  SUPER_ADMIN_ROUTES,
  getSuperAdminRoute,
  getSuperAdminBreadcrumbs,
} from './super-admin.routes.js';


