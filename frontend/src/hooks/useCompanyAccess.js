'use client';

import { useMemo } from 'react';
import { CORE_SERVICES } from '../constants/services.js';

const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const MODULE_ALIASES = {
  // Service 1: CRM & Sales
  crm: 'crm',
  product: 'product',
  sales: 'sales',

  // Service 2: Purchase & Vendor
  vendor: 'vendor',
  procurement: 'procurement',
  purchase: 'procurement',
  grn: 'grn',

  // Service 3: Inventory & Warehouse
  inventory: 'inventory_warehouse_mod',
  inventory_mgmt: 'inventory_warehouse_mod',
  inventory_warehouse_mod: 'inventory_mgmt',
  gate_pass: 'gate_pass',

  // Service 4: Manufacturing & Production
  bom: 'formula_bom',
  formula_bom: 'bom',
  production: 'production',
  manufacturing: 'production',

  // Service 5: Dispatch & Returns
  dispatch: 'dispatch',
  returns: 'returns',

  // Service 6: Accounts & Banking
  accounts: 'accounts_banking_mod',
  banking: 'accounts_banking_mod',
  accounts_banking: 'accounts_banking_mod',
  accounts_banking_mod: 'accounts_banking',

  // Service 7: Permission Controls
  team: 'system_control',
  permission_controls: 'system_control',
  system_control: 'permission_controls',
};

export const SUBMODULE_ALIASES = {
  // Service 1: CRM & Sales
  crm_leads: 'leads',
  leads: 'crm_leads',
  crm_customers: 'customers',
  customers: 'crm_customers',
  crm_contacts: 'contacts',
  contacts: 'crm_contacts',
  crm_followups: 'opportunities',
  opportunities: 'crm_followups',
  followups: 'opportunities',
  follow_ups: 'opportunities',
  product_master: 'product_list',
  product_list: 'product_master',
  price_management: 'price_list',
  price_list: 'price_management',
  categories: 'categories',
  sales_quotations: 'quotations',
  quotations: 'sales_quotations',
  sales_orders: 'sales_orders',
  orders: 'sales_orders',
  sales_proforma_invoices: 'proforma_invoice',
  proforma_invoice: 'sales_proforma_invoices',
  proforma: 'sales_proforma_invoices',
  sales_reports: 'sales_reports',

  // Service 2: Purchase & Vendor
  vendor_master: 'vendor_master',
  vendor_documents: 'vendor_eval',
  vendor_eval: 'vendor_documents',
  procurement_requests: 'purchase_requests',
  purchase_requests: 'procurement_requests',
  supplier_quotations: 'rfq',
  rfq: 'supplier_quotations',
  quotation_comparison: 'quotation_comparison',
  purchase_orders: 'purchase_orders',
  grn_receipts: 'grn_list',
  grn_list: 'grn_receipts',
  grn_inspection: 'quality_inspection',
  quality_inspection: 'grn_inspection',
  grn_deviation: 'grn_deviation',

  // Service 3: Inventory & Warehouse
  stock_current: 'stock_summary',
  stock_summary: 'stock_current',
  stock_transfers: 'stock_adjustments',
  stock_adjustments: 'stock_transfers',
  bin_locations: 'warehouse_locations',
  warehouse_locations: 'bin_locations',
  stock_valuations: 'movements',
  movements: 'stock_valuations',

  // Gate Pass
  gate_pass_inward: 'inward_pass',
  inward_pass: 'gate_pass_inward',
  gate_pass_outward: 'outward_pass',
  outward_pass: 'gate_pass_outward',
  gate_pass_register: 'returnable_tracking',
  returnable_tracking: 'gate_pass_register',

  // Service 4: Manufacturing & Production
  bom_master: 'bom_list',
  bom_list: 'bom_master',
  formulation_recipes: 'costing',
  costing: 'formulation_recipes',
  manufacturing_routing: 'manufacturing_routing',
  production_work_orders: 'work_orders',
  work_orders: 'production_work_orders',
  production_batching: 'production_orders',
  production_orders: 'production_batching',
  yield_tracking: 'material_consumption',
  material_consumption: 'yield_tracking',
  machine_logs: 'machine_logs',

  // Service 5: Dispatch & Returns
  dispatch_planning: 'dispatch_orders',
  dispatch_orders: 'dispatch_planning',
  delivery_challans: 'packing_slips',
  packing_slips: 'delivery_challans',
  shipment_tracking: 'shipment_tracking',
  customer_returns: 'sales_returns',
  sales_returns: 'customer_returns',
  supplier_returns: 'credit_notes',
  credit_notes: 'supplier_returns',
  rma_management: 'rma_management',

  // Service 6: Accounts & Banking
  accounts_invoicing: 'invoices',
  invoices: 'accounts_invoicing',
  credit_debit_notes: 'bills',
  bills: 'credit_debit_notes',
  general_ledger: 'receivables_payables',
  receivables_payables: 'general_ledger',
  chart_of_accounts: 'chart_of_accounts',
  bank_reconciliation: 'payments',
  payments: 'bank_reconciliation',

  // Service 7: Permission Controls
  rbac_configuration: 'team_users',
  team_users: 'rbac_configuration',
  global_feature_toggles: 'role_assignment',
  role_assignment: 'global_feature_toggles',
  security_profiles: 'audit_trail',
  audit_trail: 'security_profiles',
};

const ROUTE_ALIASES = {
  '/crm/followups': '/crm/opportunities',
  '/crm/opportunities': '/crm/followups',
  '/products': '/product/master',
  '/product/master': '/products',
  '/products/pricing': '/product/pricing',
  '/product/pricing': '/products/pricing',
  '/inventory/stock': '/inventory',
  '/inventory': '/inventory/stock',
  '/inventory/transfers': '/inventory/adjustments',
  '/inventory/adjustments': '/inventory/transfers',
  '/inventory/bins': '/inventory/warehouses',
  '/inventory/warehouses': '/inventory/bins',
  '/inventory/valuations': '/inventory/movements',
  '/inventory/movements': '/inventory/valuations',
  '/gate-pass/register': '/gate-pass/returnable',
  '/gate-pass/returnable': '/gate-pass/register',
  '/procurement/requests': '/procurement/requests',
  '/procurement/rfq': '/procurement/quotes',
  '/procurement/quotes': '/procurement/rfq',
  '/bom': '/manufacturing/bom',
  '/manufacturing/bom': '/bom',
  '/production/work-orders': '/manufacturing/work-orders',
  '/manufacturing/work-orders': '/production/work-orders',
  '/accounts/invoices': '/accounts/invoices',
  '/accounts/ledger': '/accounts/ledger',
};

function isModuleMatch(coreMod, assignedMod) {
  if (!coreMod || !assignedMod) return false;
  const cCode = normalize(coreMod.code);
  const aCode = normalize(assignedMod.code);
  if (cCode === aCode) return true;
  if (coreMod.alias && normalize(coreMod.alias) === aCode) return true;
  if (assignedMod.alias && normalize(assignedMod.alias) === cCode) return true;
  if (coreMod.id && (assignedMod.moduleId || assignedMod.module_id)) {
    const aId = String(assignedMod.moduleId || assignedMod.module_id);
    if (String(coreMod.id) === aId) return true;
  }
  if (MODULE_ALIASES[coreMod.code] === assignedMod.code || MODULE_ALIASES[assignedMod.code] === coreMod.code) {
    return true;
  }
  if (normalize(coreMod.name) === normalize(assignedMod.name)) {
    return true;
  }
  return false;
}

function isSubModuleMatch(coreSub, assignedSub) {
  if (!coreSub || !assignedSub) return false;
  const cCode = normalize(coreSub.code);
  const aCode = normalize(assignedSub.code);
  if (cCode === aCode) return true;
  if (coreSub.alias && normalize(coreSub.alias) === aCode) return true;
  if (assignedSub.alias && normalize(assignedSub.alias) === cCode) return true;
  if (coreSub.id && assignedSub.id && String(coreSub.id) === String(assignedSub.id)) return true;
  if (SUBMODULE_ALIASES[coreSub.code] === assignedSub.code || SUBMODULE_ALIASES[assignedSub.code] === coreSub.code) {
    return true;
  }
  if (coreSub.route && assignedSub.route) {
    const cRoute = coreSub.route.toLowerCase();
    const aRoute = assignedSub.route.toLowerCase();
    if (cRoute === aRoute) return true;
    if (ROUTE_ALIASES[cRoute] === aRoute || ROUTE_ALIASES[aRoute] === cRoute) return true;
  }
  if (aCode.endsWith(cCode) || cCode.endsWith(aCode)) return true;
  if (normalize(coreSub.name) === normalize(assignedSub.name)) {
    return true;
  }
  return false;
}

/**
 * useCompanyAccess Hook
 * Dynamically resolves permitted services, modules, and sub-modules
 * from the company's real database access assignments.
 * Enforces effective availability:
 * Service is ACTIVE && Module is ACTIVE && Submodule is ACTIVE && Assigned to Company.
 */
export function useCompanyAccess(activeCompany) {
  return useMemo(() => {
    if (!activeCompany || !activeCompany.access || !Array.isArray(activeCompany.access.services)) {
      return {
        permittedServices: [],
        hasServiceAccess: () => false,
        hasModuleAccess: () => false,
        hasSubModuleAccess: () => false,
        totalPermittedServices: 0,
        totalPermittedModules: 0,
      };
    }

    const assignedServices = activeCompany.access.services;

    // Filter master CORE_SERVICES catalogue based on company's live permissions and global active status
    const permittedServices = CORE_SERVICES.map(coreSrv => {
      // Find matching assigned service by code or by numeric ID
      const srvAssignment = assignedServices.find(srv => {
        if (srv.status === 'INACTIVE' || srv.isAllowed === false) return false;
        if (srv.code) return srv.code === coreSrv.code;

        const assignedServiceId = srv.service_id || srv.serviceId;
        return Boolean(assignedServiceId && String(assignedServiceId) === String(coreSrv.id));
      });

      if (!srvAssignment) return null;

      const isFullService = Boolean(srvAssignment.full_service || srvAssignment.isFullService);
      const assignedModules = Array.isArray(srvAssignment.modules) ? srvAssignment.modules : [];

      // Filter permitted modules enforcing cascading active status
      const filteredModules = coreSrv.modules.map(coreMod => {
        // Look up module assignment in assigned active modules
        const modAssignment = assignedModules.find(m => isModuleMatch(coreMod, m));

        // If module is deactivated globally or revoked, exclude it immediately
        if (!modAssignment || modAssignment.status === 'INACTIVE' || modAssignment.isAllowed === false) {
          return null;
        }

        const isFullModule = isFullService || (modAssignment.access_mode || modAssignment.accessMode) === 'FULL';
        const assignedSubs = Array.isArray(modAssignment.subModules) ? modAssignment.subModules : [];
        const allowedSubIds = Array.isArray(modAssignment.sub_module_ids) ? modAssignment.sub_module_ids.map(String) : [];

        // Filter permitted sub-modules
        const filteredSubModules = (coreMod.subModules || []).filter(coreSub => {
          const subAssignment = assignedSubs.find(s => isSubModuleMatch(coreSub, s));

          // If submodule is inactive or explicitly disallowed, exclude it
          if (subAssignment && (subAssignment.status === 'INACTIVE' || subAssignment.isAllowed === false)) {
            return false;
          }

          if (isFullModule) {
            // Under full module grant, if backend filtered assignedSubs, respect that list
            if (assignedSubs.length > 0) {
              return Boolean(subAssignment && subAssignment.status === 'ACTIVE' && subAssignment.isAllowed !== false);
            }
            return true;
          }

          if (allowedSubIds.length > 0 && subAssignment) {
            return allowedSubIds.includes(String(subAssignment.id));
          }

          return Boolean(subAssignment && subAssignment.isAllowed !== false);
        });

        // Also merge in any assigned submodules that were returned by the backend but not explicitly in coreMod.subModules
        const mergedSubModules = [...filteredSubModules];
        assignedSubs.forEach(assignedSub => {
          if (assignedSub.status === 'INACTIVE' || assignedSub.isAllowed === false) return;
          if (!isFullModule && allowedSubIds.length > 0 && !allowedSubIds.includes(String(assignedSub.id))) return;
          const alreadyMatched = mergedSubModules.some(sm => isSubModuleMatch(sm, assignedSub));
          if (!alreadyMatched) {
            mergedSubModules.push({
              id: assignedSub.id,
              code: assignedSub.code,
              name: assignedSub.name,
              route: assignedSub.route,
              isAllowed: true,
            });
          }
        });

        // If not full module and no permitted submodules, exclude module
        if (!isFullModule && mergedSubModules.length === 0) {
          return null;
        }

        return {
          ...coreMod,
          code: modAssignment.code || coreMod.code,
          subModules: mergedSubModules,
        };
      }).filter(Boolean);

      if (filteredModules.length === 0) {
        return null;
      }

      return {
        ...coreSrv,
        isFullService,
        modules: filteredModules,
      };
    }).filter(Boolean);

    // Permission query helpers
    const permittedServiceCodes = new Set(permittedServices.map(s => s.code));
    const permittedModuleCodes = new Set();
    const permittedSubModuleCodes = new Set();

    permittedServices.forEach(s => {
      (s.modules || []).forEach(m => {
        permittedModuleCodes.add(m.code);
        if (m.alias) permittedModuleCodes.add(m.alias);
        if (MODULE_ALIASES[m.code]) permittedModuleCodes.add(MODULE_ALIASES[m.code]);

        // Specific common module identifiers
        if (m.code === 'inventory_warehouse_mod' || m.code === 'inventory_mgmt') {
          permittedModuleCodes.add('inventory');
          permittedModuleCodes.add('inventory_warehouse_mod');
          permittedModuleCodes.add('inventory_mgmt');
        }
        if (m.code === 'formula_bom' || m.code === 'bom') {
          permittedModuleCodes.add('bom');
          permittedModuleCodes.add('formula_bom');
        }
        if (m.code === 'production') {
          permittedModuleCodes.add('production');
          permittedModuleCodes.add('manufacturing');
        }
        if (m.code === 'accounts_banking_mod' || m.code === 'accounts_banking') {
          permittedModuleCodes.add('accounts');
          permittedModuleCodes.add('banking');
          permittedModuleCodes.add('accounts_banking');
          permittedModuleCodes.add('accounts_banking_mod');
        }
        if (m.code === 'system_control' || m.code === 'permission_controls') {
          permittedModuleCodes.add('team');
          permittedModuleCodes.add('permission_controls');
          permittedModuleCodes.add('system_control');
        }

        (m.subModules || []).forEach(sub => {
          permittedSubModuleCodes.add(sub.code);
          if (sub.alias) permittedSubModuleCodes.add(sub.alias);
          if (SUBMODULE_ALIASES[sub.code]) {
            permittedSubModuleCodes.add(SUBMODULE_ALIASES[sub.code]);
          }
          if (sub.route) {
            permittedSubModuleCodes.add(sub.route);
            if (ROUTE_ALIASES[sub.route]) {
              permittedSubModuleCodes.add(ROUTE_ALIASES[sub.route]);
            }
          }
        });
      });
    });

    const hasServiceAccess = (code) => permittedServiceCodes.has(code);
    const hasModuleAccess = (code) =>
      permittedModuleCodes.has(code) ||
      permittedModuleCodes.has(MODULE_ALIASES[code]) ||
      (code === 'inventory' && (permittedModuleCodes.has('inventory_warehouse_mod') || permittedModuleCodes.has('inventory_mgmt'))) ||
      (code === 'purchase' && (permittedModuleCodes.has('vendor') || permittedModuleCodes.has('procurement'))) ||
      (code === 'manufacturing' && (permittedModuleCodes.has('production') || permittedModuleCodes.has('formula_bom'))) ||
      (code === 'banking' && (permittedModuleCodes.has('accounts_banking') || permittedModuleCodes.has('accounts_banking_mod'))) ||
      (code === 'team' && (permittedModuleCodes.has('system_control') || permittedModuleCodes.has('permission_controls')));

    const hasSubModuleAccess = (codeOrRoute) => {
      if (!codeOrRoute) return false;
      if (permittedSubModuleCodes.has(codeOrRoute)) return true;
      if (SUBMODULE_ALIASES[codeOrRoute] && permittedSubModuleCodes.has(SUBMODULE_ALIASES[codeOrRoute])) return true;
      if (ROUTE_ALIASES[codeOrRoute] && permittedSubModuleCodes.has(ROUTE_ALIASES[codeOrRoute])) return true;
      return false;
    };

    let totalPermittedModules = 0;
    permittedServices.forEach(s => {
      totalPermittedModules += (s.modules?.length || 0);
    });

    return {
      permittedServices,
      hasServiceAccess,
      hasModuleAccess,
      hasSubModuleAccess,
      totalPermittedServices: permittedServices.length,
      totalPermittedModules,
    };
  }, [activeCompany]);
}
