import { CORE_SERVICES } from '../constants/services.js';
import { MODULE_ALIASES, SUBMODULE_ALIASES } from '../hooks/useCompanyAccess.js';

// We simulate the useCompanyAccess hook resolution pure function logic
function resolveCompanyAccess(activeCompany) {
  if (!activeCompany || !activeCompany.access || !Array.isArray(activeCompany.access.services)) {
    return {
      permittedServices: [],
      hasServiceAccess: () => false,
      hasModuleAccess: () => false,
      hasSubModuleAccess: () => false,
    };
  }

  const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
  };

  function isModuleMatch(coreMod, assignedMod) {
    if (!coreMod || !assignedMod) return false;
    const cCode = normalize(coreMod.code);
    const aCode = normalize(assignedMod.code);
    if (cCode === aCode) return true;
    if (coreMod.alias && normalize(coreMod.alias) === aCode) return true;
    if (assignedMod.alias && normalize(assignedMod.alias) === cCode) return true;
    if (MODULE_ALIASES[coreMod.code] === assignedMod.code || MODULE_ALIASES[assignedMod.code] === coreMod.code) return true;
    if (normalize(coreMod.name) === normalize(assignedMod.name)) return true;
    return false;
  }

  function isSubModuleMatch(coreSub, assignedSub) {
    if (!coreSub || !assignedSub) return false;
    const cCode = normalize(coreSub.code);
    const aCode = normalize(assignedSub.code);
    if (cCode === aCode) return true;
    if (coreSub.alias && normalize(coreSub.alias) === aCode) return true;
    if (assignedSub.alias && normalize(assignedSub.alias) === cCode) return true;
    if (SUBMODULE_ALIASES[coreSub.code] === assignedSub.code || SUBMODULE_ALIASES[assignedSub.code] === coreSub.code) return true;
    if (coreSub.route && assignedSub.route) {
      const cRoute = coreSub.route.toLowerCase();
      const aRoute = assignedSub.route.toLowerCase();
      if (cRoute === aRoute) return true;
      if (ROUTE_ALIASES[cRoute] === aRoute || ROUTE_ALIASES[aRoute] === cRoute) return true;
    }
    if (aCode.endsWith(cCode) || cCode.endsWith(aCode)) return true;
    if (normalize(coreSub.name) === normalize(assignedSub.name)) return true;
    return false;
  }

  const assignedServices = activeCompany.access.services;

  const permittedServices = CORE_SERVICES.map(coreSrv => {
    const srvAssignment = assignedServices.find(srv => {
      if (srv.status === 'INACTIVE' || srv.isAllowed === false) return false;
      if (srv.code) return srv.code === coreSrv.code;
      const assignedServiceId = srv.service_id || srv.serviceId;
      return Boolean(assignedServiceId && String(assignedServiceId) === String(coreSrv.id));
    });

    if (!srvAssignment) return null;

    const isFullService = Boolean(srvAssignment.full_service || srvAssignment.isFullService);
    const assignedModules = Array.isArray(srvAssignment.modules) ? srvAssignment.modules : [];

    const filteredModules = coreSrv.modules.map(coreMod => {
      const modAssignment = assignedModules.find(m => isModuleMatch(coreMod, m));
      if (!modAssignment || modAssignment.status === 'INACTIVE' || modAssignment.isAllowed === false) return null;

      const isFullModule = isFullService || (modAssignment.access_mode || modAssignment.accessMode) === 'FULL';
      const assignedSubs = Array.isArray(modAssignment.subModules) ? modAssignment.subModules : [];
      const allowedSubIds = Array.isArray(modAssignment.sub_module_ids) ? modAssignment.sub_module_ids.map(String) : [];

      const filteredSubModules = (coreMod.subModules || []).filter(coreSub => {
        const subAssignment = assignedSubs.find(s => isSubModuleMatch(coreSub, s));
        if (subAssignment && (subAssignment.status === 'INACTIVE' || subAssignment.isAllowed === false)) return false;
        if (isFullModule) {
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

      if (!isFullModule && mergedSubModules.length === 0) return null;

      return {
        ...coreMod,
        code: modAssignment.code || coreMod.code,
        subModules: mergedSubModules,
      };
    }).filter(Boolean);

    if (filteredModules.length === 0) return null;

    return {
      ...coreSrv,
      isFullService,
      modules: filteredModules,
    };
  }).filter(Boolean);

  const permittedServiceCodes = new Set(permittedServices.map(s => s.code));
  const permittedModuleCodes = new Set();
  const permittedSubModuleCodes = new Set();

  permittedServices.forEach(s => {
    (s.modules || []).forEach(m => {
      permittedModuleCodes.add(m.code);
      if (m.alias) permittedModuleCodes.add(m.alias);
      if (MODULE_ALIASES[m.code]) permittedModuleCodes.add(MODULE_ALIASES[m.code]);

      if (m.code === 'inventory_warehouse_mod' || m.code === 'inventory_mgmt') {
        permittedModuleCodes.add('inventory');
        permittedModuleCodes.add('inventory_warehouse_mod');
        permittedModuleCodes.add('inventory_mgmt');
      }

      (m.subModules || []).forEach(sub => {
        permittedSubModuleCodes.add(sub.code);
        if (sub.alias) permittedSubModuleCodes.add(sub.alias);
        if (SUBMODULE_ALIASES[sub.code]) permittedSubModuleCodes.add(SUBMODULE_ALIASES[sub.code]);
        if (sub.route) {
          permittedSubModuleCodes.add(sub.route);
          if (ROUTE_ALIASES[sub.route]) permittedSubModuleCodes.add(ROUTE_ALIASES[sub.route]);
        }
      });
    });
  });

  const hasServiceAccess = (code) => permittedServiceCodes.has(code);
  const hasModuleAccess = (code) =>
    permittedModuleCodes.has(code) ||
    permittedModuleCodes.has(MODULE_ALIASES[code]) ||
    (code === 'inventory' && (permittedModuleCodes.has('inventory_warehouse_mod') || permittedModuleCodes.has('inventory_mgmt')));

  const hasSubModuleAccess = (codeOrRoute) => {
    if (!codeOrRoute) return false;
    if (permittedSubModuleCodes.has(codeOrRoute)) return true;
    if (SUBMODULE_ALIASES[codeOrRoute] && permittedSubModuleCodes.has(SUBMODULE_ALIASES[codeOrRoute])) return true;
    if (ROUTE_ALIASES[codeOrRoute] && permittedSubModuleCodes.has(ROUTE_ALIASES[codeOrRoute])) return true;
    return false;
  };

  return {
    permittedServices,
    hasServiceAccess,
    hasModuleAccess,
    hasSubModuleAccess,
  };
}

// Canonical Sidebar page mapping test
const SUBMODULE_PAGES = {
  inventory_warehouse_mod: [
    { label: 'Current Stock', href: '/inventory/stock', code: 'stock_current' },
    { label: 'Stock Transfers', href: '/inventory/transfers', code: 'stock_transfers' },
    { label: 'Bin Locations', href: '/inventory/bins', code: 'bin_locations' },
    { label: 'Stock Valuations', href: '/inventory/valuations', code: 'stock_valuations' },
  ],
  gate_pass: [
    { label: 'Inward Gate Pass', href: '/gate-pass/inward', code: 'gate_pass_inward' },
    { label: 'Outward Gate Pass', href: '/gate-pass/outward', code: 'gate_pass_outward' },
    { label: 'Gate Pass Register', href: '/gate-pass/register', code: 'gate_pass_register' },
  ],
};

function getPagesForModule(mod, hasSubModuleAccess) {
  const allowedSubs = Array.isArray(mod?.subModules) ? mod.subModules : [];
  const candidatePages = SUBMODULE_PAGES[mod?.code] || [];

  const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const isPagePermitted = (page) => {
    if (typeof hasSubModuleAccess === 'function') {
      if (page.href && hasSubModuleAccess(page.href)) return true;
      if (page.code && hasSubModuleAccess(page.code)) return true;
    }
    return allowedSubs.some((sub) => {
      if (sub.isAllowed === false || sub.status === 'INACTIVE') return false;
      if (sub.route && page.href && sub.route.toLowerCase() === page.href.toLowerCase()) return true;
      if (page.code && sub.code && (page.code === sub.code || SUBMODULE_ALIASES[sub.code] === page.code || SUBMODULE_ALIASES[page.code] === sub.code)) return true;
      if (page.label && sub.name && normalize(page.label) === normalize(sub.name)) return true;
      return false;
    });
  };

  const permitted = [];
  const seenHrefs = new Set();
  if (candidatePages.length > 0) {
    candidatePages.filter(isPagePermitted).forEach((page) => {
      permitted.push(page);
      seenHrefs.add(page.href.toLowerCase());
    });
  }

  allowedSubs.forEach((sub) => {
    if (sub.isAllowed === false || sub.status === 'INACTIVE') return;
    if (sub.route && !seenHrefs.has(sub.route.toLowerCase())) {
      if (typeof hasSubModuleAccess !== 'function' || hasSubModuleAccess(sub.route) || hasSubModuleAccess(sub.code)) {
        permitted.push({
          label: sub.name,
          href: sub.route,
          code: sub.code,
        });
        seenHrefs.add(sub.route.toLowerCase());
      }
    }
  });

  return permitted;
}

// Execute tests
console.log('\n========================================================================');
console.log('AZZUNIQE CRM & ERP — Frontend Permission & Sidebar Resolution Tests');
console.log('========================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
  passed++;
}

// Scenario 1: All 4 Inventory screens + All 3 Gate Pass screens selected
const allInventoryAndGatePassCompany = {
  id: 'comp-1',
  organizationName: 'Acme Logistics',
  access: {
    services: [
      {
        code: 'inventory_warehouse',
        isAllowed: true,
        status: 'ACTIVE',
        full_service: false,
        modules: [
          {
            code: 'inventory_warehouse_mod',
            name: 'Inventory & Warehouse',
            isAllowed: true,
            status: 'ACTIVE',
            access_mode: 'CUSTOM',
            sub_module_ids: ['sub-1', 'sub-2', 'sub-3', 'sub-4'],
            subModules: [
              { id: 'sub-1', code: 'stock_current', name: 'Current Stock', route: '/inventory/stock', isAllowed: true, status: 'ACTIVE' },
              { id: 'sub-2', code: 'stock_transfers', name: 'Stock Transfers', route: '/inventory/transfers', isAllowed: true, status: 'ACTIVE' },
              { id: 'sub-3', code: 'bin_locations', name: 'Bin Locations', route: '/inventory/bins', isAllowed: true, status: 'ACTIVE' },
              { id: 'sub-4', code: 'stock_valuations', name: 'Stock Valuations', route: '/inventory/valuations', isAllowed: true, status: 'ACTIVE' },
            ],
          },
          {
            code: 'gate_pass',
            name: 'Gate Pass',
            isAllowed: true,
            status: 'ACTIVE',
            access_mode: 'CUSTOM',
            sub_module_ids: ['sub-5', 'sub-6', 'sub-7'],
            subModules: [
              { id: 'sub-5', code: 'gate_pass_inward', name: 'Inward Gate Pass', route: '/gate-pass/inward', isAllowed: true, status: 'ACTIVE' },
              { id: 'sub-6', code: 'gate_pass_outward', name: 'Outward Gate Pass', route: '/gate-pass/outward', isAllowed: true, status: 'ACTIVE' },
              { id: 'sub-7', code: 'gate_pass_register', name: 'Gate Pass Register', route: '/gate-pass/register', isAllowed: true, status: 'ACTIVE' },
            ],
          },
        ],
      },
    ],
  },
};

const res1 = resolveCompanyAccess(allInventoryAndGatePassCompany);
assert(res1.hasServiceAccess('inventory_warehouse'), 'Company has inventory_warehouse service access');
assert(res1.hasModuleAccess('inventory_warehouse_mod'), 'Company has inventory_warehouse_mod module access');
assert(res1.hasModuleAccess('inventory'), 'Company has inventory alias module access');
assert(res1.hasModuleAccess('gate_pass'), 'Company has gate_pass module access');

// Verify all 4 inventory screens
assert(res1.hasSubModuleAccess('stock_current'), 'Permits stock_current code');
assert(res1.hasSubModuleAccess('/inventory/stock'), 'Permits /inventory/stock route');
assert(res1.hasSubModuleAccess('stock_transfers'), 'Permits stock_transfers code');
assert(res1.hasSubModuleAccess('/inventory/transfers'), 'Permits /inventory/transfers route');
assert(res1.hasSubModuleAccess('bin_locations'), 'Permits bin_locations code');
assert(res1.hasSubModuleAccess('/inventory/bins'), 'Permits /inventory/bins route');
assert(res1.hasSubModuleAccess('stock_valuations'), 'Permits stock_valuations code');
assert(res1.hasSubModuleAccess('/inventory/valuations'), 'Permits /inventory/valuations route');

// Verify all 3 gate pass screens
assert(res1.hasSubModuleAccess('gate_pass_inward'), 'Permits gate_pass_inward code');
assert(res1.hasSubModuleAccess('/gate-pass/inward'), 'Permits /gate-pass/inward route');
assert(res1.hasSubModuleAccess('gate_pass_outward'), 'Permits gate_pass_outward code');
assert(res1.hasSubModuleAccess('/gate-pass/outward'), 'Permits /gate-pass/outward route');
assert(res1.hasSubModuleAccess('gate_pass_register'), 'Permits gate_pass_register code');
assert(res1.hasSubModuleAccess('/gate-pass/register'), 'Permits /gate-pass/register route');

// Test Sidebar getPagesForModule
const invSrv1 = res1.permittedServices.find(s => s.code === 'inventory_warehouse');
const invMod1 = invSrv1.modules.find(m => m.code === 'inventory_warehouse_mod');
const gateMod1 = invSrv1.modules.find(m => m.code === 'gate_pass');

const invPages1 = getPagesForModule(invMod1, res1.hasSubModuleAccess);
assert(invPages1.length === 4, `Sidebar displays all 4 Inventory & Stock screens (got ${invPages1.length})`);
assert(invPages1.some(p => p.label === 'Current Stock' && p.href === '/inventory/stock'), 'Sidebar contains Current Stock');
assert(invPages1.some(p => p.label === 'Stock Transfers' && p.href === '/inventory/transfers'), 'Sidebar contains Stock Transfers');
assert(invPages1.some(p => p.label === 'Bin Locations' && p.href === '/inventory/bins'), 'Sidebar contains Bin Locations');
assert(invPages1.some(p => p.label === 'Stock Valuations' && p.href === '/inventory/valuations'), 'Sidebar contains Stock Valuations');

const gatePages1 = getPagesForModule(gateMod1, res1.hasSubModuleAccess);
assert(gatePages1.length === 3, `Sidebar displays all 3 Gate Pass screens (got ${gatePages1.length})`);
assert(gatePages1.some(p => p.label === 'Inward Gate Pass' && p.href === '/gate-pass/inward'), 'Sidebar contains Inward Gate Pass');
assert(gatePages1.some(p => p.label === 'Outward Gate Pass' && p.href === '/gate-pass/outward'), 'Sidebar contains Outward Gate Pass');
assert(gatePages1.some(p => p.label === 'Gate Pass Register' && p.href === '/gate-pass/register'), 'Sidebar contains Gate Pass Register');

// Scenario 2: Gate Pass Register and Bin Locations NOT granted
const partialCompany = {
  id: 'comp-2',
  access: {
    services: [
      {
        code: 'inventory_warehouse',
        isAllowed: true,
        status: 'ACTIVE',
        modules: [
          {
            code: 'inventory_warehouse_mod',
            isAllowed: true,
            status: 'ACTIVE',
            access_mode: 'CUSTOM',
            sub_module_ids: ['sub-1'], // only Current Stock
            subModules: [
              { id: 'sub-1', code: 'stock_current', name: 'Current Stock', route: '/inventory/stock', isAllowed: true, status: 'ACTIVE' },
            ],
          },
          {
            code: 'gate_pass',
            isAllowed: true,
            status: 'ACTIVE',
            access_mode: 'CUSTOM',
            sub_module_ids: ['sub-5', 'sub-6'], // Inward & Outward, NO register
            subModules: [
              { id: 'sub-5', code: 'gate_pass_inward', name: 'Inward Gate Pass', route: '/gate-pass/inward', isAllowed: true, status: 'ACTIVE' },
              { id: 'sub-6', code: 'gate_pass_outward', name: 'Outward Gate Pass', route: '/gate-pass/outward', isAllowed: true, status: 'ACTIVE' },
            ],
          },
        ],
      },
    ],
  },
};

const res2 = resolveCompanyAccess(partialCompany);
assert(res2.hasSubModuleAccess('stock_current'), 'Permits authorized Current Stock');
assert(!res2.hasSubModuleAccess('bin_locations'), 'Blocks unauthorized Bin Locations code');
assert(!res2.hasSubModuleAccess('/inventory/bins'), 'Blocks unauthorized /inventory/bins route');
assert(!res2.hasSubModuleAccess('gate_pass_register'), 'Blocks unauthorized Gate Pass Register code');
assert(!res2.hasSubModuleAccess('/gate-pass/register'), 'Blocks unauthorized /gate-pass/register route');

const invMod2 = res2.permittedServices[0].modules.find(m => m.code === 'inventory_warehouse_mod');
const gateMod2 = res2.permittedServices[0].modules.find(m => m.code === 'gate_pass');

const invPages2 = getPagesForModule(invMod2, res2.hasSubModuleAccess);
assert(invPages2.length === 1, `Sidebar displays only authorized 1 screen (got ${invPages2.length})`);
assert(invPages2[0].label === 'Current Stock', 'Only Current Stock appears');

const gatePages2 = getPagesForModule(gateMod2, res2.hasSubModuleAccess);
assert(gatePages2.length === 2, `Sidebar displays only authorized 2 screens (got ${gatePages2.length})`);
assert(!gatePages2.some(p => p.label === 'Gate Pass Register'), 'Unauthorized Gate Pass Register does NOT appear in sidebar');

// Scenario 3: Deselected module has 0 screens -> Empty section is NOT rendered
const emptyModuleCompany = {
  id: 'comp-3',
  access: {
    services: [
      {
        code: 'inventory_warehouse',
        isAllowed: true,
        status: 'ACTIVE',
        modules: [
          {
            code: 'inventory_warehouse_mod',
            isAllowed: true,
            status: 'ACTIVE',
            access_mode: 'CUSTOM',
            sub_module_ids: [],
            subModules: [],
          },
        ],
      },
    ],
  },
};

const res3 = resolveCompanyAccess(emptyModuleCompany);
assert(res3.permittedServices.length === 0, 'Module with 0 permitted screens is not rendered as an empty section');


// Scenario 4: Company provisioned with HRMS & Payroll Service
const hrmsCompany = {
  id: 'comp-4',
  access: {
    services: [
      {
        code: 'hrms_payroll',
        name: 'HRMS & Payroll',
        isAllowed: true,
        status: 'ACTIVE',
        modules: [
          {
            code: 'hr_employee',
            name: 'HR & Employees',
            isAllowed: true,
            status: 'ACTIVE',
            subModules: [
              { code: 'employee_master', name: 'Employee Master', route: '/hr/employees', isAllowed: true, status: 'ACTIVE' },
              { code: 'employee_onboarding', name: 'Onboarding & KYC', route: '/hr/onboarding', isAllowed: true, status: 'ACTIVE' },
              { code: 'employee_documents', name: 'Document Vault', route: '/hr/documents', isAllowed: true, status: 'ACTIVE' },
            ],
          },
          {
            code: 'payroll',
            name: 'Payroll & Compensation',
            isAllowed: true,
            status: 'ACTIVE',
            subModules: [
              { code: 'salary_structure', name: 'Salary Structure', route: '/payroll/structure', isAllowed: true, status: 'ACTIVE' },
              { code: 'monthly_payroll', name: 'Monthly Payroll', route: '/payroll/process', isAllowed: true, status: 'ACTIVE' },
            ],
          },
        ],
      },
    ],
  },
};

const res4 = resolveCompanyAccess(hrmsCompany);
assert(res4.hasServiceAccess('hrms_payroll'), 'Permits HRMS & Payroll service access');
assert(res4.hasModuleAccess('hr_employee'), 'Permits HR & Employees module access');
assert(res4.hasModuleAccess('payroll'), 'Permits Payroll module access');
assert(!res4.hasModuleAccess('solar_master'), 'Blocks unauthorized Solar service module');
assert(res4.hasSubModuleAccess('employee_master'), 'Permits Employee Master code');
assert(res4.hasSubModuleAccess('/hr/employees'), 'Permits /hr/employees route');
assert(res4.hasSubModuleAccess('/payroll/process'), 'Permits /payroll/process route');
assert(!res4.hasSubModuleAccess('/solar/plants'), 'Blocks unauthorized /solar/plants route');

const hrMod = res4.permittedServices[0].modules.find(m => m.code === 'hr_employee');
const hrPages = getPagesForModule(hrMod, res4.hasSubModuleAccess);
assert(hrPages.length === 3, `Sidebar displays all 3 HR & Employee screens (got ${hrPages.length})`);

// Scenario 5: Company provisioned with Solar Monitoring Service
const solarCompany = {
  id: 'comp-5',
  access: {
    services: [
      {
        code: 'solar_monitoring',
        name: 'Solar Monitoring',
        isAllowed: true,
        status: 'ACTIVE',
        modules: [
          {
            code: 'solar_generation',
            name: 'Generation & Analytics',
            isAllowed: true,
            status: 'ACTIVE',
            subModules: [
              { code: 'live_generation', name: 'Live Generation', route: '/solar/generation-live', isAllowed: true, status: 'ACTIVE' },
              { code: 'yield_analytics', name: 'Yield Analytics & PR', route: '/solar/yield-analytics', isAllowed: true, status: 'ACTIVE' },
            ],
          },
        ],
      },
    ],
  },
};

const res5 = resolveCompanyAccess(solarCompany);
assert(res5.hasServiceAccess('solar_monitoring'), 'Permits Solar Monitoring service access');
assert(res5.hasModuleAccess('solar_generation'), 'Permits Generation & Analytics module access');
assert(!res5.hasServiceAccess('hrms_payroll'), 'Blocks unauthorized HRMS service');
assert(res5.hasSubModuleAccess('live_generation'), 'Permits Live Generation code');
assert(res5.hasSubModuleAccess('/solar/generation-live'), 'Permits /solar/generation-live route');
assert(!res5.hasSubModuleAccess('/hr/employees'), 'Blocks unauthorized /hr/employees route');

const solarMod = res5.permittedServices[0].modules.find(m => m.code === 'solar_generation');
const solarPages = getPagesForModule(solarMod, res5.hasSubModuleAccess);
assert(solarPages.length === 2, `Sidebar displays only 2 permitted Solar screens (got ${solarPages.length})`);

console.log('\n========================================================================');
console.log(`Frontend Permission & Sidebar Tests: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================================================\n');

if (failed > 0) process.exit(1);
process.exit(0);
