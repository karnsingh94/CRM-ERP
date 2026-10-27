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
          { code: 'crm_leads', name: 'Leads Pipeline', route: '/crm/leads', alias: 'leads' },
          { code: 'crm_customers', name: 'Customer Directory', route: '/crm/customers', alias: 'customers' },
          { code: 'crm_contacts', name: 'Contact Persons', route: '/crm/contacts', alias: 'contacts' },
          { code: 'crm_followups', name: 'Deal Opportunities', route: '/crm/opportunities', alias: 'opportunities' },
        ],
      },
      {
        code: 'product',
        name: 'Products & Catalogue',
        icon: 'IconBox',
        subModules: [
          { code: 'product_master', name: 'Product Directory', route: '/products', alias: 'product_list' },
          { code: 'categories', name: 'Categories & Types', route: '/products/categories' },
          { code: 'price_management', name: 'Price Management', route: '/products/pricing', alias: 'price_list' },
        ],
      },
      {
        code: 'sales',
        name: 'Sales Operations',
        icon: 'IconShoppingBag',
        subModules: [
          { code: 'sales_quotations', name: 'Quotations', route: '/sales/quotations', alias: 'quotations' },
          { code: 'sales_proforma_invoices', name: 'Proforma Invoices (PI)', route: '/sales/proforma', alias: 'proforma_invoice' },
          { code: 'sales_orders', name: 'Sales Orders', route: '/sales/orders' },
          { code: 'sales_reports', name: 'Sales Reports', route: '/sales/reports' },
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
          { code: 'vendor_documents', name: 'Supplier Documents', route: '/vendors/evaluation', alias: 'vendor_eval' },
        ],
      },
      {
        code: 'procurement',
        name: 'Procurement & Orders',
        icon: 'IconFileText',
        subModules: [
          { code: 'procurement_requests', name: 'Purchase Requests', route: '/procurement/requests', alias: 'purchase_requests' },
          { code: 'supplier_quotations', name: 'Supplier Quotations (RFQ)', route: '/procurement/rfq', alias: 'rfq' },
          { code: 'quotation_comparison', name: 'Quotation Comparison', route: '/procurement/comparison' },
          { code: 'purchase_orders', name: 'Purchase Orders (PO)', route: '/procurement/orders' },
        ],
      },
      {
        code: 'grn',
        name: 'Goods Receipt Note (GRN)',
        icon: 'IconClipboardCheck',
        subModules: [
          { code: 'grn_receipts', name: 'Goods Receipt Notes', route: '/grn', alias: 'grn_list' },
          { code: 'grn_inspection', name: 'Quality Inspection (QC)', route: '/grn/inspection', alias: 'quality_inspection' },
          { code: 'grn_deviation', name: 'Discrepancy / Deviations', route: '/grn/deviation' },
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
        code: 'inventory_warehouse_mod',
        alias: 'inventory_mgmt',
        name: 'Inventory & Stock',
        icon: 'IconLayers',
        subModules: [
          { code: 'stock_current', name: 'Current Stock', route: '/inventory/stock', alias: 'stock_summary' },
          { code: 'stock_transfers', name: 'Stock Transfers', route: '/inventory/transfers', alias: 'stock_adjustments' },
          { code: 'bin_locations', name: 'Bin Locations', route: '/inventory/bins', alias: 'warehouse_locations' },
          { code: 'stock_valuations', name: 'Stock Valuations', route: '/inventory/valuations', alias: 'movements' },
        ],
      },
      {
        code: 'gate_pass',
        name: 'Gate Pass Management',
        icon: 'IconShield',
        subModules: [
          { code: 'gate_pass_inward', name: 'Inward Gate Pass', route: '/gate-pass/inward', alias: 'inward_pass' },
          { code: 'gate_pass_outward', name: 'Outward Gate Pass', route: '/gate-pass/outward', alias: 'outward_pass' },
          { code: 'gate_pass_register', name: 'Gate Pass Register', route: '/gate-pass/register', alias: 'returnable_tracking' },
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
        code: 'formula_bom',
        alias: 'bom',
        name: 'Formula / BOM',
        icon: 'IconLayers',
        subModules: [
          { code: 'bom_master', name: 'Bill of Materials (BOM)', route: '/bom', alias: 'bom_list' },
          { code: 'formulation_recipes', name: 'Formulation Recipes', route: '/bom/costing', alias: 'costing' },
          { code: 'manufacturing_routing', name: 'Standard Routing', route: '/manufacturing/routing' },
        ],
      },
      {
        code: 'production',
        name: 'Production Operations',
        icon: 'IconActivity',
        subModules: [
          { code: 'production_work_orders', name: 'Work Orders', route: '/production/work-orders', alias: 'work_orders' },
          { code: 'production_batching', name: 'Production Batching', route: '/production/orders', alias: 'production_orders' },
          { code: 'yield_tracking', name: 'Yield Tracking', route: '/production/consumption', alias: 'material_consumption' },
          { code: 'machine_logs', name: 'Machine Logs', route: '/production/machines' },
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
          { code: 'dispatch_planning', name: 'Dispatch Planning', route: '/dispatch', alias: 'dispatch_orders' },
          { code: 'delivery_challans', name: 'Delivery Challans', route: '/dispatch/challans', alias: 'packing_slips' },
          { code: 'shipment_tracking', name: 'Shipment Tracking', route: '/dispatch/tracking' },
        ],
      },
      {
        code: 'returns',
        name: 'Customer Returns (RMA)',
        icon: 'IconCornerDownLeft',
        subModules: [
          { code: 'customer_returns', name: 'Customer Returns', route: '/returns', alias: 'sales_returns' },
          { code: 'supplier_returns', name: 'Supplier Returns', route: '/returns/restock', alias: 'credit_notes' },
          { code: 'rma_management', name: 'RMA Management', route: '/returns/rma' },
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
        code: 'accounts_banking_mod',
        alias: 'accounts_banking',
        name: 'Financial Ledger',
        icon: 'IconCreditCard',
        subModules: [
          { code: 'accounts_invoicing', name: 'Invoicing', route: '/accounts/invoices', alias: 'invoices' },
          { code: 'credit_debit_notes', name: 'Credit & Debit Notes', route: '/accounts/bills', alias: 'bills' },
          { code: 'general_ledger', name: 'General Ledger', route: '/accounts/ledger', alias: 'receivables_payables' },
          { code: 'chart_of_accounts', name: 'Chart of Accounts', route: '/accounts/coa' },
          { code: 'bank_reconciliation', name: 'Bank Reconciliation', route: '/accounts/payments', alias: 'payments' },
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
        code: 'system_control',
        alias: 'permission_controls',
        name: 'Company Team & Access',
        icon: 'IconUsers',
        subModules: [
          { code: 'rbac_configuration', name: 'RBAC Configuration', route: '/team', alias: 'team_users' },
          { code: 'global_feature_toggles', name: 'Global Feature Toggles', route: '/team/roles', alias: 'role_assignment' },
          { code: 'security_profiles', name: 'Security Profiles', route: '/team/audit', alias: 'audit_trail' },
        ],
      },
    ],
  },
];
