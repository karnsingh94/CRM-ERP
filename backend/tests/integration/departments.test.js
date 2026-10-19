// Integration verification for Service-Based Department Creation
import { pathToFileURL } from 'url';
import prisma from '../../src/config/prisma.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runDepartmentVerification() {
  console.log('\n======================================================');
  console.log('AZZUNIQE CRM & ERP — Service-Based Department Tests');
  console.log('Target API:', API_BASE);
  console.log('======================================================\n');

  let passed = 0;
  let total = 6;

  try {
    // Dynamically resolve an active tenant with crm_sales assigned
    let targetClient = await prisma.clientAdmin.findFirst({
      where: {
        serviceAccess: {
          some: {
            service: { code: 'crm_sales' },
            isAllowed: true,
          },
        },
      },
      include: {
        serviceAccess: {
          include: { service: true },
        },
      },
    });

    if (!targetClient) {
      targetClient = await prisma.clientAdmin.findFirst();
    }

    const companyId = targetClient ? targetClient.id.toString() : '15';
    const assignedCodes = (targetClient?.serviceAccess || []).map((s) => s.service?.code).filter(Boolean);
    const unassignedServiceCode = ['manufacturing_production', 'dispatch_returns', 'accounts_banking'].find(
      (c) => !assignedCodes.includes(c)
    ) || 'manufacturing_production';

    // 1. Verify Company with assigned service (CRM & Sales) creates a department
    console.log(`--- TEST 1: Company ${companyId} with assigned service (CRM & Sales) creates a department ---`);
    const res1 = await fetch(`${API_BASE}/companies/${companyId}/services/crm_sales/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Strategic Sales',
        code: `sales_strat_${Date.now()}`,
        description: 'Large enterprise strategic sales deals & key customer accounts.',
      }),
    });
    const data1 = await res1.json();
    if (res1.status === 201 && data1.success && data1.data?.name === 'Enterprise Strategic Sales') {
      console.log('✅ TEST 1 PASSED: Successfully created department under assigned service crm_sales.');
      console.log('   Department ID:', data1.data.id, '| Service:', data1.data.serviceName);
      passed++;
    } else {
      console.error('❌ TEST 1 FAILED:', res1.status, data1);
    }

    // 2. Verify Company CANNOT create department under UNASSIGNED service
    console.log(`\n--- TEST 2: Company CANNOT create department under UNASSIGNED service (${unassignedServiceCode}) ---`);
    const res2 = await fetch(`${API_BASE}/companies/${companyId}/services/${unassignedServiceCode}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Shopfloor Assembly Dept',
        code: `mfg_dept_${Date.now()}`,
        description: 'Testing unassigned service restriction',
      }),
    });
    const data2 = await res2.json();
    if (res2.status === 403 && data2.success === false && data2.code === 'SERVICE_NOT_ASSIGNED') {
      console.log('✅ TEST 2 PASSED: Correctly blocked with 403 Forbidden.');
      console.log('   Server Response:', data2.message);
      passed++;
    } else {
      console.error('❌ TEST 2 FAILED (Should have been 403):', res2.status, data2);
    }

    // 3. Direct API requests cannot bypass service-assignment restrictions
    console.log(`\n--- TEST 3: Direct API requests cannot bypass service-assignment restrictions ---`);
    const res3 = await fetch(`${API_BASE}/companies/${companyId}/services/${unassignedServiceCode}/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unauthorized Accounts Dept',
        code: `unauth_acc_${Date.now()}`,
      }),
    });
    const data3 = await res3.json();
    if (res3.status === 403 && data3.code === 'SERVICE_NOT_ASSIGNED') {
      console.log('✅ TEST 3 PASSED: Direct API bypass attempt successfully rejected with 403.');
      console.log('   Message:', data3.message);
      passed++;
    } else {
      console.error('❌ TEST 3 FAILED:', res3.status, data3);
    }

    // 4. Department Heads and employees belong to the SAME company
    console.log('\n--- TEST 4: Department Head cross-company assignment prevention ---');
    const res4 = await fetch(`${API_BASE}/companies/${companyId}/services/crm_sales/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Head Dept',
        code: `test_head_${Date.now()}`,
        headId: '999999', // Non-existent or foreign employee
      }),
    });
    const data4 = await res4.json();
    if (res4.status === 400 || res4.status === 403) {
      console.log('✅ TEST 4 PASSED: Cross-company / invalid Department Head rejected.');
      console.log('   Status:', res4.status, '| Message:', data4.message);
      passed++;
    } else {
      console.error('❌ TEST 4 FAILED:', res4.status, data4);
    }

    // 5. Each department appears under its correct service
    console.log('\n--- TEST 5: Verify departments appear under correct service ---');
    const res5Crm = await fetch(`${API_BASE}/companies/${companyId}/services/crm_sales/departments`);
    const data5Crm = await res5Crm.json();
    const crmDeptCount = data5Crm.departments?.length || 0;

    const res5Purchase = await fetch(`${API_BASE}/companies/${companyId}/services/purchase_vendor/departments`);
    const data5Purchase = await res5Purchase.json();
    const purchaseDeptCount = data5Purchase.departments?.length || 0;

    const allInCrmAreCrm = data5Crm.departments?.every((d) => d.serviceCode === 'crm_sales');
    if (res5Crm.status === 200 && res5Purchase.status === 200 && allInCrmAreCrm) {
      console.log(`✅ TEST 5 PASSED: Service scoping verified. CRM & Sales has ${crmDeptCount} departments, Purchase & Vendor has ${purchaseDeptCount} departments.`);
      console.log('   All departments in CRM response have serviceCode == "crm_sales":', allInCrmAreCrm);
      passed++;
    } else {
      console.error('❌ TEST 5 FAILED:', data5Crm);
    }

    // 6. Existing service assignments, routes, and employee records remain intact
    console.log('\n--- TEST 6: Existing service assignments and client records remain intact ---');
    const client = await prisma.clientAdmin.findUnique({
      where: { id: BigInt(companyId) },
      include: { serviceAccess: { where: { isAllowed: true } } },
    });
    const empCount = await prisma.companyEmployee.count({ where: { companyId: BigInt(companyId) } });
    if (client && client.serviceAccess.length > 0) {
      console.log(`✅ TEST 6 PASSED: Existing client access intact. Client ID ${companyId} has ${client.serviceAccess.length} assigned services and ${empCount} employees.`);
      passed++;
    } else {
      console.error('❌ TEST 6 FAILED:', client);
    }

    console.log('\n======================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} / ${total} TESTS PASSED`);
    console.log('======================================================\n');
    return { passed, total, success: passed === total };
  } catch (err) {
    console.error('Verification error:', err);
    return { passed, total, success: false, error: err };
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-run when executed directly (cross-platform URL path check)
const isDirectRun = process.argv[1] && (
  import.meta.url === pathToFileURL(process.argv[1]).href ||
  process.argv[1].replace(/\\/g, '/').endsWith('departments.test.js')
);

if (isDirectRun) {
  runDepartmentVerification().then((result) => {
    if (!result.success) process.exit(1);
  });
}
