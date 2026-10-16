import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Support BigInt serialization
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export const SEED_CATALOG = [
  {
    name: 'CRM & Sales',
    code: 'crm_sales',
    description: 'Leads, customers, contacts, quotations, proforma invoices, sales orders and price management.',
    orderNo: 1,
    status: 'ACTIVE',
    modules: [
      {
        name: 'CRM',
        code: 'crm',
        icon: 'users',
        description: 'Lead generation, customer management, contacts, and interaction tracking.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'Leads', code: 'crm_leads', route: '/crm/leads', orderNo: 1 },
          { name: 'Customers', code: 'crm_customers', route: '/crm/customers', orderNo: 2 },
          { name: 'Contacts', code: 'crm_contacts', route: '/crm/contacts', orderNo: 3 },
          { name: 'Follow-ups', code: 'crm_followups', route: '/crm/followups', orderNo: 4 },
        ]
      },
      {
        name: 'Product',
        code: 'product',
        icon: 'package',
        description: 'Product catalogue, specifications, categories, and price management.',
        orderNo: 2,
        status: 'ACTIVE',
        subModules: [
          { name: 'Product Master', code: 'product_master', route: '/product/master', orderNo: 1 },
          { name: 'Price Management', code: 'price_management', route: '/product/pricing', orderNo: 2 },
        ]
      },
      {
        name: 'Sales',
        code: 'sales',
        icon: 'dollar-sign',
        description: 'Sales pipelines, quotations, proforma invoices, sales orders, and reports.',
        orderNo: 3,
        status: 'ACTIVE',
        subModules: [
          { name: 'Quotations', code: 'sales_quotations', route: '/sales/quotations', orderNo: 1 },
          { name: 'Proforma Invoices', code: 'sales_proforma_invoices', route: '/sales/proforma-invoices', orderNo: 2 },
          { name: 'Sales Orders', code: 'sales_orders', route: '/sales/orders', orderNo: 3 },
          { name: 'Sales Reports', code: 'sales_reports', route: '/sales/reports', orderNo: 4 },
        ]
      }
    ]
  },
  {
    name: 'Purchase & Vendor',
    code: 'purchase_vendor',
    description: 'Vendor master, purchase requests, supplier quotations, purchase orders, goods receipt notes and quality inspection.',
    orderNo: 2,
    status: 'ACTIVE',
    modules: [
      {
        name: 'Vendor',
        code: 'vendor',
        icon: 'briefcase',
        description: 'Vendor onboarding, compliance documentation, and supplier profiles.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'Vendor Master', code: 'vendor_master', route: '/vendor/master', orderNo: 1 },
          { name: 'Vendor Documents', code: 'vendor_documents', route: '/vendor/documents', orderNo: 2 },
        ]
      },
      {
        name: 'Procurement',
        code: 'procurement',
        icon: 'shopping-cart',
        description: 'Purchase requests, supplier quotations, comparisons, and purchase orders.',
        orderNo: 2,
        status: 'ACTIVE',
        subModules: [
          { name: 'Purchase Requests', code: 'procurement_requests', route: '/procurement/requests', orderNo: 1 },
          { name: 'Supplier Quotations', code: 'supplier_quotations', route: '/procurement/quotes', orderNo: 2 },
          { name: 'Quotation Comparison', code: 'quotation_comparison', route: '/procurement/comparison', orderNo: 3 },
          { name: 'Purchase Orders', code: 'purchase_orders', route: '/procurement/orders', orderNo: 4 },
        ]
      },
      {
        name: 'GRN',
        code: 'grn',
        icon: 'clipboard-check',
        description: 'Goods receipt notes, inbound shipments, and quality inspections.',
        orderNo: 3,
        status: 'ACTIVE',
        subModules: [
          { name: 'Goods Receipt Notes', code: 'grn_receipts', route: '/grn/receipts', orderNo: 1 },
          { name: 'Quality Inspection', code: 'grn_inspection', route: '/grn/inspection', orderNo: 2 },
          { name: 'Deviation / Discrepancy', code: 'grn_deviation', route: '/grn/deviation', orderNo: 3 },
        ]
      }
    ]
  },
  {
    name: 'Inventory & Warehouse',
    code: 'inventory_warehouse',
    description: 'Stock, stock transfers, bin locations, gate passes and valuations.',
    orderNo: 3,
    status: 'ACTIVE',
    modules: [
      {
        name: 'Inventory & Warehouse',
        code: 'inventory_warehouse_mod',
        icon: 'archive',
        description: 'Real-time stock tracking, bin locations, transfers, and inventory valuation.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'Current Stock', code: 'stock_current', route: '/inventory/stock', orderNo: 1 },
          { name: 'Stock Transfers', code: 'stock_transfers', route: '/inventory/transfers', orderNo: 2 },
          { name: 'Bin Locations', code: 'bin_locations', route: '/inventory/bins', orderNo: 3 },
          { name: 'Stock Valuations', code: 'stock_valuations', route: '/inventory/valuations', orderNo: 4 },
        ]
      },
      {
        name: 'Gate Pass',
        code: 'gate_pass',
        icon: 'truck',
        description: 'Inward and outward physical material movement gate passes.',
        orderNo: 2,
        status: 'ACTIVE',
        subModules: [
          { name: 'Inward Gate Pass', code: 'gate_pass_inward', route: '/gate-pass/inward', orderNo: 1 },
          { name: 'Outward Gate Pass', code: 'gate_pass_outward', route: '/gate-pass/outward', orderNo: 2 },
          { name: 'Gate Pass Register', code: 'gate_pass_register', route: '/gate-pass/register', orderNo: 3 },
        ]
      }
    ]
  },
  {
    name: 'Manufacturing & Production',
    code: 'manufacturing_production',
    description: 'BOM, production batching, work orders and yield tracking.',
    orderNo: 4,
    status: 'ACTIVE',
    modules: [
      {
        name: 'Formula / BOM',
        code: 'formula_bom',
        icon: 'layers',
        description: 'Standard formulations, multi-level bills of materials, and recipe versions.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'Bill of Materials (BOM)', code: 'bom_master', route: '/manufacturing/bom', orderNo: 1 },
          { name: 'Formulation Recipes', code: 'formulation_recipes', route: '/manufacturing/recipes', orderNo: 2 },
          { name: 'Standard Routing', code: 'manufacturing_routing', route: '/manufacturing/routing', orderNo: 3 },
        ]
      },
      {
        name: 'Production',
        code: 'production',
        icon: 'cpu',
        description: 'Work order execution, batch scheduling, shop floor tracking, and yield analysis.',
        orderNo: 2,
        status: 'ACTIVE',
        subModules: [
          { name: 'Work Orders', code: 'production_work_orders', route: '/manufacturing/work-orders', orderNo: 1 },
          { name: 'Production Batching', code: 'production_batching', route: '/manufacturing/batching', orderNo: 2 },
          { name: 'Yield Tracking', code: 'yield_tracking', route: '/manufacturing/yield', orderNo: 3 },
          { name: 'Machine Logs', code: 'machine_logs', route: '/manufacturing/machines', orderNo: 4 },
        ]
      }
    ]
  },
  {
    name: 'Dispatch & Returns',
    code: 'dispatch_returns',
    description: 'Dispatch planning, delivery challans and customer/supplier returns.',
    orderNo: 5,
    status: 'ACTIVE',
    modules: [
      {
        name: 'Dispatch',
        code: 'dispatch',
        icon: 'send',
        description: 'Outbound dispatch planning, packing slips, carrier assignment, and delivery challans.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'Dispatch Planning', code: 'dispatch_planning', route: '/dispatch/planning', orderNo: 1 },
          { name: 'Delivery Challans', code: 'delivery_challans', route: '/dispatch/challans', orderNo: 2 },
          { name: 'Shipment Tracking', code: 'shipment_tracking', route: '/dispatch/tracking', orderNo: 3 },
        ]
      },
      {
        name: 'Returns',
        code: 'returns',
        icon: 'rotate-ccw',
        description: 'Customer returns (sales return), supplier returns (debit notes), and RMA processing.',
        orderNo: 2,
        status: 'ACTIVE',
        subModules: [
          { name: 'Customer Returns', code: 'customer_returns', route: '/returns/customer', orderNo: 1 },
          { name: 'Supplier Returns', code: 'supplier_returns', route: '/returns/supplier', orderNo: 2 },
          { name: 'RMA Management', code: 'rma_management', route: '/returns/rma', orderNo: 3 },
        ]
      }
    ]
  },
  {
    name: 'Accounts & Banking',
    code: 'accounts_banking',
    description: 'Invoicing, credit/debit notes, general ledger, chart of accounts and bank reconciliation.',
    orderNo: 6,
    status: 'ACTIVE',
    modules: [
      {
        name: 'Accounts & Banking',
        code: 'accounts_banking_mod',
        icon: 'file-text',
        description: 'Invoicing, credit & debit notes, general ledger, chart of accounts, and bank reconciliation.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'Invoicing', code: 'accounts_invoicing', route: '/accounts/invoices', orderNo: 1 },
          { name: 'Credit & Debit Notes', code: 'credit_debit_notes', route: '/accounts/credit-debit-notes', orderNo: 2 },
          { name: 'General Ledger', code: 'general_ledger', route: '/accounts/ledger', orderNo: 3 },
          { name: 'Chart of Accounts', code: 'chart_of_accounts', route: '/accounts/coa', orderNo: 4 },
          { name: 'Bank Reconciliation', code: 'bank_reconciliation', route: '/accounts/bank-reconciliation', orderNo: 5 },
        ]
      }
    ]
  },
  {
    name: 'Permission Controls',
    code: 'permission_controls',
    description: 'RBAC configuration, global feature toggles and security profiles.',
    orderNo: 7,
    status: 'ACTIVE',
    modules: [
      {
        name: 'System Control',
        code: 'system_control',
        icon: 'shield',
        description: 'Role-based access control, security policies, and platform feature flags.',
        orderNo: 1,
        status: 'ACTIVE',
        subModules: [
          { name: 'RBAC Configuration', code: 'rbac_configuration', route: '/permission-control/rbac', orderNo: 1 },
          { name: 'Global Feature Toggles', code: 'global_feature_toggles', route: '/permission-control/toggles', orderNo: 2 },
          { name: 'Security Profiles', code: 'security_profiles', route: '/permission-control/security', orderNo: 3 },
        ]
      }
    ]
  }
];

export async function seedDatabase() {
  console.log('🌱 Starting idempotent database seeding...');

  // 1. Seed Fixed Seven-Service Catalogue
  for (const s of SEED_CATALOG) {
    const service = await prisma.service.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
        orderNo: s.orderNo,
        status: s.status,
      },
      create: {
        name: s.name,
        code: s.code,
        description: s.description,
        orderNo: s.orderNo,
        status: s.status,
      },
    });

    for (const m of s.modules) {
      const module = await prisma.module.upsert({
        where: { code: m.code },
        update: {
          serviceId: service.id,
          name: m.name,
          description: m.description,
          icon: m.icon,
          orderNo: m.orderNo,
          status: m.status,
        },
        create: {
          serviceId: service.id,
          name: m.name,
          code: m.code,
          description: m.description,
          icon: m.icon,
          orderNo: m.orderNo,
          status: m.status,
        },
      });

      for (const sm of m.subModules) {
        await prisma.subModule.upsert({
          where: { code: sm.code },
          update: {
            moduleId: module.id,
            serviceId: service.id,
            name: sm.name,
            route: sm.route,
            orderNo: sm.orderNo,
            status: 'ACTIVE',
          },
          create: {
            moduleId: module.id,
            serviceId: service.id,
            name: sm.name,
            code: sm.code,
            route: sm.route,
            orderNo: sm.orderNo,
            status: 'ACTIVE',
          },
        });
      }
    }
  }
  console.log('✅ Seven-Service Catalogue seeded successfully.');

  // 2. Note: Tenant companies are provisioned manually by Super Admin via Super Admin portal
  console.log('ℹ️ Tenant seeding skipped: Client companies are managed manually by Super Admin.');

  // 3. Seed Initial Audit Logs if empty
  const existingAuditLogsCount = await prisma.auditLog.count();
  if (existingAuditLogsCount === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          action: 'SEED',
          entityType: 'CATALOG',
          entityId: null,
          oldValue: null,
          newValue: JSON.stringify({ services: 7 }),
          reason: 'Initial 7-service catalogue seeded into MySQL database',
          ipAddress: '127.0.0.1',
          userAgent: 'Seeder/1.0',
        },
      ],
    });
    console.log('✅ Initial audit logs seeded.');
  }

  console.log('🎉 Seeding completed successfully!');
}

// Allow direct execution
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .catch((e) => {
      console.error('Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
