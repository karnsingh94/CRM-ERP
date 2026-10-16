/**
 * Fixed 7-Service Catalogue Definition
 * Synchronized with AZZUNIQE Backend Catalogue Specification & Prisma Models.
 */

export const CORE_SERVICES = [
  {
    id: 1,
    code: 'crm_sales',
    name: 'CRM & Sales',
    icon: 'IconCRM',
    description: 'Leads, Customers, Contacts, Quotations, Proforma Invoices, Sales Orders & Pricing',
    modules: [
      {
        code: 'crm',
        name: 'CRM Management',
        icon: 'IconUsers',
        subModules: [
          { code: 'leads', name: 'Leads Pipeline', route: '/crm/leads' },
          { code: 'customers', name: 'Customer Directory', route: '/crm/customers' },
          { code: 'contacts', name: 'Contact Persons', route: '/crm/contacts' },
          { code: 'opportunities', name: 'Deal Opportunities', route: '/crm/opportunities' },
        ],
      },
      {
        code: 'product',
        name: 'Products & Catalogue',
        icon: 'IconBox',
        subModules: [
          { code: 'product_list', name: 'Product Directory', route: '/products' },
          { code: 'categories', name: 'Categories & Types', route: '/products/categories' },
          { code: 'price_list', name: 'Price Management', route: '/products/pricing' },
        ],
      },
      {
        code: 'sales',
        name: 'Sales Operations',
        icon: 'IconShoppingBag',
        subModules: [
          { code: 'quotations', name: 'Quotations', route: '/sales/quotations' },
          { code: 'proforma_invoice', name: 'Proforma Invoices (PI)', route: '/sales/proforma' },
          { code: 'sales_orders', name: 'Sales Orders', route: '/sales/orders' },
        ],
      },
    ],
  },
  {
    id: 2,
    code: 'purchase_vendor',
    name: 'Purchase & Vendor',
    icon: 'IconTruck',
    description: 'Vendor Directory, Purchase Requests, Supplier RFQs, POs, and Goods Receipt Notes',
    modules: [
      {
        code: 'vendor',
        name: 'Vendor Directory',
        icon: 'IconUsers',
        subModules: [
          { code: 'vendor_master', name: 'Vendor Directory', route: '/vendors' },
          { code: 'vendor_eval', name: 'Supplier Ratings', route: '/vendors/evaluation' },
        ],
      },
      {
        code: 'procurement',
        name: 'Procurement & Orders',
        icon: 'IconFileText',
        subModules: [
          { code: 'purchase_requests', name: 'Purchase Requests', route: '/procurement/requests' },
          { code: 'rfq', name: 'Request for Quotation (RFQ)', route: '/procurement/rfq' },
          { code: 'purchase_orders', name: 'Purchase Orders (PO)', route: '/procurement/orders' },
        ],
      },
      {
        code: 'grn',
        name: 'Goods Receipt Note (GRN)',
        icon: 'IconClipboardCheck',
        subModules: [
          { code: 'grn_list', name: 'Inward Receipts', route: '/grn' },
          { code: 'quality_inspection', name: 'Quality Inspection (QC)', route: '/grn/inspection' },
        ],
      },
    ],
  },
  {
    id: 3,
    code: 'inventory_warehouse',
    name: 'Inventory & Warehouse',
    icon: 'IconLayers',
    description: 'Stock Management, Warehouses, Stock Adjustments, Movements & Gate Passes',
    modules: [
      {
        code: 'inventory_mgmt',
        name: 'Inventory & Stock',
        icon: 'IconLayers',
        subModules: [
          { code: 'stock_summary', name: 'Stock Overview', route: '/inventory' },
          { code: 'warehouse_locations', name: 'Warehouse Locations', route: '/inventory/warehouses' },
          { code: 'stock_adjustments', name: 'Stock Adjustments', route: '/inventory/adjustments' },
          { code: 'movements', name: 'Stock Movement Ledger', route: '/inventory/movements' },
        ],
      },
      {
        code: 'gate_pass',
        name: 'Gate Pass Management',
        icon: 'IconShield',
        subModules: [
          { code: 'inward_pass', name: 'Inward Gate Passes', route: '/gate-pass/inward' },
          { code: 'outward_pass', name: 'Outward Gate Passes', route: '/gate-pass/outward' },
          { code: 'returnable_tracking', name: 'Returnable Asset Tracking', route: '/gate-pass/returnable' },
        ],
      },
    ],
  },
  {
    id: 4,
    code: 'manufacturing_production',
    name: 'Manufacturing & Production',
    icon: 'IconCpu',
    description: 'Bill of Materials (BOM), Production Orders, Batch Tracking & Work Orders',
    modules: [
      {
        code: 'bom',
        name: 'Formula / BOM',
        icon: 'IconLayers',
        subModules: [
          { code: 'bom_list', name: 'Bill of Materials', route: '/bom' },
          { code: 'costing', name: 'Recipe Cost Estimator', route: '/bom/costing' },
        ],
      },
      {
        code: 'production',
        name: 'Production Operations',
        icon: 'IconActivity',
        subModules: [
          { code: 'production_orders', name: 'Production Orders', route: '/production/orders' },
          { code: 'work_orders', name: 'Shopfloor Work Orders', route: '/production/work-orders' },
          { code: 'material_consumption', name: 'Material Consumption', route: '/production/consumption' },
        ],
      },
    ],
  },
  {
    id: 5,
    code: 'dispatch_returns',
    name: 'Dispatch & Returns',
    icon: 'IconPackage',
    description: 'Outward Shipment Packing, Dispatch Advice, Logistics Tracking & Sales Returns',
    modules: [
      {
        code: 'dispatch',
        name: 'Dispatch Orders',
        icon: 'IconTruck',
        subModules: [
          { code: 'dispatch_orders', name: 'Dispatch Queue', route: '/dispatch' },
          { code: 'packing_slips', name: 'Delivery Challans & Packing', route: '/dispatch/challans' },
        ],
      },
      {
        code: 'returns',
        name: 'Customer Returns (RMA)',
        icon: 'IconCornerDownLeft',
        subModules: [
          { code: 'sales_returns', name: 'Return Authorizations', route: '/returns' },
          { code: 'credit_notes', name: 'Return Stock Restocking', route: '/returns/restock' },
        ],
      },
    ],
  },
  {
    id: 6,
    code: 'accounts_banking',
    name: 'Accounts & Banking',
    icon: 'IconCreditCard',
    description: 'Sales Invoicing, Vendor Bills, Payment Vouchers, Bank Entries & Receivables',
    modules: [
      {
        code: 'accounts_banking',
        name: 'Financial Ledger',
        icon: 'IconCreditCard',
        subModules: [
          { code: 'invoices', name: 'Tax Invoices', route: '/accounts/invoices' },
          { code: 'bills', name: 'Vendor Bills', route: '/accounts/bills' },
          { code: 'payments', name: 'Payment Receipts', route: '/accounts/payments' },
          { code: 'receivables_payables', name: 'Receivables & Payables', route: '/accounts/ledger' },
        ],
      },
    ],
  },
  {
    id: 7,
    code: 'permission_controls',
    name: 'Permission Controls',
    icon: 'IconShield',
    description: 'Internal Company Staff Management, Department Roles & Access Scopes',
    modules: [
      {
        code: 'permission_controls',
        name: 'Company Team & Access',
        icon: 'IconUsers',
        subModules: [
          { code: 'team_users', name: 'Company Employees', route: '/team' },
          { code: 'role_assignment', name: 'Department Roles', route: '/team/roles' },
          { code: 'audit_trail', name: 'Activity Audit Trail', route: '/team/audit' },
        ],
      },
    ],
  },
];
