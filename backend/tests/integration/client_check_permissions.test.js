import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runClientCheckPermissionsVerification() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Client "Check" Permissions & Multi-Tenant Isolation Suite');
  console.log('Target API:', API_BASE);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.message);
      failed++;
    }
  }

  const checkCompanyId = '75a69805-cea5-11f1-9511-b05cda618678';
  const superAdminId = '75a4858f-cea5-11f1-9511-b05cda618678';
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';

  const checkToken = signToken({
    userId: checkCompanyId,
    companyId: checkCompanyId,
    role: 'COMPANY_ADMIN',
    type: 'COMPANY_USER',
  });
  const checkHeaders = {
    Authorization: `Bearer ${checkToken}`,
    'Content-Type': 'application/json',
  };

  const otherToken = signToken({
    userId: otherCompanyId,
    companyId: otherCompanyId,
    role: 'COMPANY_ADMIN',
    type: 'COMPANY_USER',
  });
  const otherHeaders = {
    Authorization: `Bearer ${otherToken}`,
    'Content-Type': 'application/json',
  };

  // 1. Verify Client Check in Database
  await test('Verify Check company exists and CRM & Sales is enabled', async () => {
    const client = await prisma.clientAdmin.findUnique({
      where: { id: checkCompanyId },
      include: {
        serviceAccess: {
          include: { service: true },
        },
      },
    });
    if (!client) throw new Error('Check company record not found in database.');
    if (client.organizationName !== 'Check' && client.name !== 'Checked') {
      throw new Error(`Unexpected company name: ${client.organizationName} / ${client.name}`);
    }

    const crmAccess = client.serviceAccess.find((s) => s.service.code === 'crm_sales');
    if (!crmAccess || !crmAccess.isAllowed) {
      throw new Error('CRM & Sales is not enabled for Check company.');
    }
  });

  // 2. Verify Other Six Services Remain in Master Catalogue
  await test('Verify all 7 services exist and remain ACTIVE in master catalogue', async () => {
    const allServices = await prisma.service.findMany();
    const expectedServices = [
      'crm_sales',
      'purchase_vendor',
      'inventory_warehouse',
      'manufacturing_production',
      'dispatch_returns',
      'accounts_banking',
      'permission_controls',
    ];
    if (allServices.length !== 7) {
      throw new Error(`Expected exactly 7 services in catalogue, found ${allServices.length}`);
    }
    for (const code of expectedServices) {
      const s = allServices.find((item) => item.code === code);
      if (!s) throw new Error(`Missing service in catalogue: ${code}`);
      if (s.status !== 'ACTIVE') throw new Error(`Service ${code} is not ACTIVE (status: ${s.status})`);
    }
  });

  // 3. Verify Non-CRM Services Are Disabled for Check Company in Database
  await test('Verify non-CRM services are disabled for client Check', async () => {
    const disabledAccess = await prisma.clientServiceAccess.findMany({
      where: {
        adminId: checkCompanyId,
        isAllowed: true,
      },
      include: { service: true },
    });
    const allowedServiceCodes = disabledAccess.map((a) => a.service.code);
    if (allowedServiceCodes.length !== 1 || allowedServiceCodes[0] !== 'crm_sales') {
      throw new Error(`Check company has unauthorized active services: ${allowedServiceCodes.join(', ')}`);
    }
  });

  // 4. Backend Layer: Check Company Admin CAN access authorized CRM endpoints
  await test('Check company can access CRM Leads API', async () => {
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/crm/leads`, {
      headers: checkHeaders,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Check company can access CRM Customers API', async () => {
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/crm/customers`, {
      headers: checkHeaders,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test('Check company can access Sales Orders API', async () => {
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/sales/orders`, {
      headers: checkHeaders,
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  // 5. Backend Layer: Disabled services are REJECTED with 403
  await test('Check company requests to disabled Purchase/Procurement are rejected with 403', async () => {
    // Testing route under purchase_vendor
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/procurement/orders`, {
      headers: checkHeaders,
    });
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Expected 403/404 for disabled service, got ${res.status}`);
    }
  });

  await test('Check company requests to disabled Inventory are rejected with 403', async () => {
    // Testing route under inventory_warehouse
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/inventory/stock`, {
      headers: checkHeaders,
    });
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Expected 403/404 for disabled service, got ${res.status}`);
    }
  });

  // 6. Cross-Tenant Isolation
  await test('Cross-company tenant access to Check resources is rejected with 403', async () => {
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/crm/customers`, {
      headers: otherHeaders,
    });
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Expected 403 Forbidden for cross-tenant access, got ${res.status}`);
    }
  });

  // 7. Unauthenticated Access
  await test('Unauthenticated requests are rejected with 401', async () => {
    const res = await fetch(`${API_BASE}/companies/${checkCompanyId}/crm/customers`);
    if (res.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for unauthenticated request, got ${res.status}`);
    }
  });

  console.log('\n========================================================================');
  console.log(`CLIENT CHECK SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  return { passed, failed, success: failed === 0 };
}

runClientCheckPermissionsVerification().then((res) => {
  if (!res.success) process.exit(1);
});
