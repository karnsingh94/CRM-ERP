'use client';

import { useMemo } from 'react';
import { CORE_SERVICES } from '../constants/services';

const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const MODULE_ALIASES = {
  inventory_mgmt: 'inventory_warehouse_mod',
  inventory_warehouse_mod: 'inventory_mgmt',
  bom: 'formula_bom',
  formula_bom: 'bom',
  accounts: 'accounts_banking_mod',
  accounts_banking_mod: 'accounts',
  team: 'system_control',
  system_control: 'team',
};

const SUBMODULE_ALIASES = {
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
};

function isModuleMatch(coreMod, assignedMod) {
  if (!coreMod || !assignedMod) return false;
  const cCode = normalize(coreMod.code);
  const aCode = normalize(assignedMod.code);
  if (cCode === aCode) return true;
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
  if (coreSub.id && assignedSub.id && String(coreSub.id) === String(assignedSub.id)) return true;
  if (SUBMODULE_ALIASES[coreSub.code] === assignedSub.code || SUBMODULE_ALIASES[assignedSub.code] === coreSub.code) {
    return true;
  }
  if (
    (coreSub.route === '/crm/opportunities' && assignedSub.route === '/crm/followups') ||
    (coreSub.route === '/crm/followups' && assignedSub.route === '/crm/opportunities') ||
    (coreSub.route === '/products' && assignedSub.route === '/product/master') ||
    (coreSub.route === '/product/master' && assignedSub.route === '/products') ||
    (coreSub.route === '/products/pricing' && assignedSub.route === '/product/pricing') ||
    (coreSub.route === '/product/pricing' && assignedSub.route === '/products/pricing')
  ) {
    return true;
  }
  if (aCode.endsWith(cCode) || cCode.endsWith(aCode)) return true;
  if (coreSub.route && assignedSub.route && coreSub.route.toLowerCase() === assignedSub.route.toLowerCase()) {
    return true;
  }
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

        return {
          ...coreMod,
          subModules: filteredSubModules,
        };
      }).filter(Boolean);

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
        // Also register aliases so hasModuleAccess succeeds for either code format
        if (MODULE_ALIASES[m.code]) {
          permittedModuleCodes.add(MODULE_ALIASES[m.code]);
        }
        (m.subModules || []).forEach(sub => {
          permittedSubModuleCodes.add(sub.code);
          if (SUBMODULE_ALIASES[sub.code]) {
            permittedSubModuleCodes.add(SUBMODULE_ALIASES[sub.code]);
          }
          if (sub.route) {
            permittedSubModuleCodes.add(sub.route);
            if (sub.route === '/crm/followups') permittedSubModuleCodes.add('/crm/opportunities');
            if (sub.route === '/crm/opportunities') permittedSubModuleCodes.add('/crm/followups');
          }
        });
      });
    });

    const hasServiceAccess = (code) => permittedServiceCodes.has(code);
    const hasModuleAccess = (code) => permittedModuleCodes.has(code) || permittedModuleCodes.has(MODULE_ALIASES[code]);
    const hasSubModuleAccess = (codeOrRoute) => {
      if (!codeOrRoute) return false;
      if (permittedSubModuleCodes.has(codeOrRoute)) return true;
      if (SUBMODULE_ALIASES[codeOrRoute] && permittedSubModuleCodes.has(SUBMODULE_ALIASES[codeOrRoute])) return true;
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
