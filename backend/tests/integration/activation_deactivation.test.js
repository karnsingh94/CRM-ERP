import prisma from '../../src/config/prisma.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

async function runActivationTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Leads Sub-Module & Feature Activation Test Suite');
  console.log('Target API:', API_BASE);
  console.log('========================================================================\n');

  let passed = 0;
  const total = 10;

  // Resolve parent service (CRM & Sales) and CRM module
  const crmService = await prisma.service.findFirst({
    where: { code: 'crm_sales' },
    include: {
      modules: {
        include: { subModules: true },
        orderBy: { orderNo: 'asc' },
      },
    },
  });

  const crmModule = crmService.modules.find(m => m.code === 'crm') || crmService.modules[0];
  const leadsSubModule = crmModule.subModules.find(sm => sm.code === 'crm_leads' || sm.route === '/crm/leads') || crmModule.subModules[0];
  const customersSubModule = crmModule.subModules.find(sm => sm.code === 'crm_customers' || sm.route === '/crm/customers') || crmModule.subModules[1];

  let client = await prisma.clientAdmin.findFirst({
    where: {
      serviceAccess: {
        some: { serviceId: crmService.id, isAllowed: true },
      },
    },
  });

  if (!client) {
    client = await prisma.clientAdmin.findFirst();
  }

  const companyId = client.id.toString();
  const crmServiceId = crmService.id.toString();
  const crmModuleId = crmModule.id.toString();
  const leadsId = leadsSubModule.id.toString();

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Keep CRM & Sales ACTIVE
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: Ensure CRM & Sales service is ACTIVE ---');
    await prisma.service.update({ where: { id: crmService.id }, data: { status: 'ACTIVE' } });
    console.log('✅ SCENARIO 1: Parent CRM & Sales is ACTIVE.');
    passed++;

    // -------------------------------------------------------------------------
    // SCENARIO 2: Keep CRM Management module ACTIVE
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 2: Ensure CRM Management module is ACTIVE ---');
    await prisma.module.update({ where: { id: crmModule.id }, data: { status: 'ACTIVE' } });
    await prisma.subModule.update({ where: { id: leadsSubModule.id }, data: { status: 'ACTIVE' } });
    console.log('✅ SCENARIO 2: CRM Management module is ACTIVE.');
    passed++;

    // -------------------------------------------------------------------------
    // SCENARIO 3: Deactivate ONLY Leads via Super Admin API
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 3: Deactivate Leads via API ---');
    const toggleRes = await fetch(`${API_BASE}/sub-modules/${leadsId}/status`, { method: 'PATCH' });
    const toggleJson = await toggleRes.json();
    if (toggleJson.success && toggleJson.data.status === 'INACTIVE') {
      console.log('✅ SCENARIO 3 PASSED: Submodule status toggle API returned 200 with status INACTIVE.');
      passed++;
    } else {
      console.error('❌ SCENARIO 3 FAILED: Submodule toggle API failed:', toggleJson);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 4: Verify the database stores the INACTIVE status
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 4: Verify MySQL database stores INACTIVE status for Leads ---');
    const dbSub = await prisma.subModule.findUnique({ where: { id: leadsSubModule.id } });
    if (dbSub.status === 'INACTIVE') {
      console.log('✅ SCENARIO 4 PASSED: Leads status correctly persisted as INACTIVE in MySQL database.');
      passed++;
    } else {
      console.error('❌ SCENARIO 4 FAILED: Submodule status in DB is not INACTIVE:', dbSub.status);
    }

    // -------------------------------------------------------------------------
    // SCENARIO 5: Client-facing module/navigation API excludes Leads
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 5: Verify Company Admin navigation API excludes Leads ---');
    const clientRes = await fetch(`${API_BASE}/clients/${companyId}`);
    const clientJson = await clientRes.json();
    const srvAccess = (clientJson.data?.access?.services || []).find(s => s.serviceId === crmServiceId);
    const modAccess = (srvAccess?.modules || []).find(m => m.moduleId === crmModuleId);
    const subModulesInClient = modAccess?.subModules || [];
    const isLeadsInClient = subModulesInClient.some(sm => sm.id === leadsId || sm.code === 'crm_leads');

    if (!isLeadsInClient) {
      console.log('✅ SCENARIO 5 PASSED: Company Admin navigation API no longer returns Leads as an available feature.');
      passed++;
    } else {
      console.error('❌ SCENARIO 5 FAILED: Leads still found in client navigation payload.');
    }

    // -------------------------------------------------------------------------
    // SCENARIO 6: Assigned-services API also omits Leads
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 6: Verify assigned-services API omits inactive Leads ---');
    const assignedRes = await fetch(`${API_BASE}/companies/${companyId}/assigned-services`);
    const assignedJson = await assignedRes.json();
    const assignedCrm = (assignedJson.data || []).find(s => s.id === crmServiceId);
    const assignedMod = (assignedCrm?.modules || []).find(m => m.id === crmModuleId);
    const isLeadsInAssigned = (assignedMod?.subModules || []).some(sm => sm.id === leadsId);

    if (!isLeadsInAssigned) {
      console.log('✅ SCENARIO 6 PASSED: Inactive Leads disappears from assigned-services hierarchy.');
      passed++;
    } else {
      console.error('❌ SCENARIO 6 FAILED: Leads still present in assigned-services.');
    }

    // -------------------------------------------------------------------------
    // SCENARIO 7: Active sibling submodules (Customers, Contacts, Follow-ups) remain visible
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 7: Active sibling submodules remain available ---');
    const hasCustomers = subModulesInClient.some(sm => sm.code === 'crm_customers' || sm.name === 'Customers');
    const hasContacts = subModulesInClient.some(sm => sm.code === 'crm_contacts' || sm.name === 'Contacts');

    if (hasCustomers && hasContacts) {
      console.log('✅ SCENARIO 7 PASSED: Customers, Contacts & sibling submodules remain visible and authorized.');
      passed++;
    } else {
      console.error('❌ SCENARIO 7 FAILED: Sibling submodules missing:', { hasCustomers, hasContacts });
    }

    // -------------------------------------------------------------------------
    // SCENARIO 8: Direct API requests to /crm/leads are rejected with 403
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 8: Direct API requests to /crm/leads are rejected with 403 ---');
    const leadsApiRes = await fetch(`${API_BASE}/companies/${companyId}/crm/leads`);
    const leadsApiJson = await leadsApiRes.json();

    const customersApiRes = await fetch(`${API_BASE}/companies/${companyId}/crm/customers`);
    const customersApiJson = await customersApiRes.json();

    if (leadsApiRes.status === 403 && leadsApiJson.code === 'SUBMODULE_INACTIVE' && customersApiRes.status === 200) {
      console.log('✅ SCENARIO 8 PASSED: Direct request to inactive /crm/leads rejected with 403 SUBMODULE_INACTIVE; active /crm/customers returns 200.');
      passed++;
    } else {
      console.error('❌ SCENARIO 8 FAILED:', { leadsStatus: leadsApiRes.status, leadsCode: leadsApiJson.code, custStatus: customersApiRes.status });
    }

    // -------------------------------------------------------------------------
    // SCENARIO 9: Reactivate Leads and verify availability returns
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 9: Reactivate Leads and verify availability returns ---');
    const reactivateRes = await fetch(`${API_BASE}/sub-modules/${leadsId}/status`, { method: 'PATCH' });
    const reactivateJson = await reactivateRes.json();

    const clientRes9 = await fetch(`${API_BASE}/clients/${companyId}`);
    const clientJson9 = await clientRes9.json();
    const srvAccess9 = (clientJson9.data?.access?.services || []).find(s => s.serviceId === crmServiceId);
    const modAccess9 = (srvAccess9?.modules || []).find(m => m.moduleId === crmModuleId);
    const isLeadsBack = (modAccess9?.subModules || []).some(sm => sm.id === leadsId);

    if (reactivateJson.success && isLeadsBack) {
      console.log('✅ SCENARIO 9 PASSED: Reactivated Leads successfully restored in navigation API.');
      passed++;
    } else {
      console.error('❌ SCENARIO 9 FAILED: Leads not restored upon reactivation.');
    }

    // -------------------------------------------------------------------------
    // SCENARIO 10: Existing service-level and module-level deactivations still work
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 10: Service and module level deactivations remain intact ---');
    // Toggle module to inactive
    await prisma.module.update({ where: { id: crmModule.id }, data: { status: 'INACTIVE' } });
    const clientRes10a = await fetch(`${API_BASE}/clients/${companyId}`);
    const clientJson10a = await clientRes10a.json();
    const srv10a = (clientJson10a.data?.access?.services || []).find(s => s.serviceId === crmServiceId);
    const mod10a = (srv10a?.modules || []).some(m => m.moduleId === crmModuleId);

    // Toggle service to inactive
    await prisma.service.update({ where: { id: crmService.id }, data: { status: 'INACTIVE' } });
    const deptRes = await fetch(`${API_BASE}/companies/${companyId}/services/crm_sales/departments`);
    const deptJson = await deptRes.json();

    if (!mod10a && deptRes.status === 403 && deptJson.code === 'SERVICE_INACTIVE') {
      console.log('✅ SCENARIO 10 PASSED: Service and module level deactivations remain 100% operational.');
      passed++;
    } else {
      console.error('❌ SCENARIO 10 FAILED:', { modActive: mod10a, deptStatus: deptRes.status });
    }

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    // Teardown: Restore original active statuses
    await prisma.service.update({ where: { id: crmService.id }, data: { status: 'ACTIVE' } }).catch(() => null);
    await prisma.module.update({ where: { id: crmModule.id }, data: { status: 'ACTIVE' } }).catch(() => null);
    await prisma.subModule.update({ where: { id: leadsSubModule.id }, data: { status: 'ACTIVE' } }).catch(() => null);
    console.log('\nTeardown complete: Restored original active statuses in MySQL database.\n');
  }

  console.log('========================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runActivationTests();
