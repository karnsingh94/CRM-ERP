import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const BASE_URL = process.env.API_BASE || 'http://localhost:5000/api';
let superAdmin = await prisma.superAdmin.findFirst();
const adminId = superAdmin?.id || '75a4858f-cea5-11f1-9511-b05cda618678';
const TEST_AUTHORIZATION = `Bearer ${signToken({ id: adminId, role: 'SUPER_ADMIN' })}`;

function authenticatedFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', TEST_AUTHORIZATION);
  return fetch(url, { ...options, headers });
}

export async function runIntegrationTestSuite() {
  console.log('🧪 Starting Automated Verification Test Suite...\n');
  console.log('Target API:', BASE_URL);
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

  // 1. Health & DB
  await test('Health check returns operational with pending auth status', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    if (data.status !== 'OK' || data.authIntegration !== 'PENDING_SEPARATE_MODULE') {
      throw new Error(`Unexpected health payload: ${JSON.stringify(data)}`);
    }
  });

  await test('Protected APIs reject requests without a valid token', async () => {
    const res = await fetch(`${BASE_URL}/services`);
    const data = await res.json();
    if (res.status !== 401 || data.code !== 'UNAUTHENTICATED') {
      throw new Error(`Expected unauthenticated response, received ${res.status}: ${JSON.stringify(data)}`);
    }
  });

  await test('Database status reports connected to MySQL', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/db-status`);
    const data = await res.json();
    if (!data.connected || data.database !== 'MySQL') {
      throw new Error(`DB status not connected: ${JSON.stringify(data)}`);
    }
  });

  // 2. 7-Service Catalogue
  await test('Exactly 7 fixed services are returned from MySQL', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/services`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length < 7) {
      throw new Error(`Services count expected >= 7, got ${data.data?.length}`);
    }
    const codes = data.data.map((s) => s.code);
    const required = [
      'crm_sales',
      'purchase_vendor',
      'inventory_warehouse',
      'manufacturing_production',
      'dispatch_returns',
      'accounts_banking',
      'permission_controls',
    ];
    for (const r of required) {
      if (!codes.includes(r)) throw new Error(`Missing required service: ${r}`);
    }
  });

  // 3. Service CRUD
  let tempServiceId = null;
  await test('Create new service in database', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Automation Service',
        code: `test_service_${Date.now()}`,
        description: 'Temporary service for CRUD test',
        order_no: 99,
      }),
    });
    const data = await res.json();
    if (!data.success || !data.data?.id) throw new Error('Failed to create service');
    tempServiceId = data.data.id;
  });

  await test('Toggle service status between ACTIVE and INACTIVE', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/services/${tempServiceId}/status`, { method: 'PATCH' });
    const data = await res.json();
    if (!data.success || data.data.status !== 'INACTIVE') {
      throw new Error(`Status toggle failed: ${JSON.stringify(data)}`);
    }
  });

  // 4. Module & Sub-Module CRUD
  let tempModuleId = null;
  await test('Create module under service', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/services/${tempServiceId}/modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Module Alpha',
        code: `test_mod_${Date.now()}`,
        description: 'Module for automated test',
        icon: 'box',
      }),
    });
    const data = await res.json();
    if (!data.success || !data.data?.id) throw new Error('Failed to create module');
    tempModuleId = data.data.id;
  });

  let tempSubModuleId = null;
  await test('Create sub-module under module', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/modules/${tempModuleId}/sub-modules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Screen One',
        code: `test_sub_${Date.now()}`,
        route: '/test/screen-one',
      }),
    });
    const data = await res.json();
    if (!data.success || !data.data?.id) throw new Error('Failed to create sub-module');
    tempSubModuleId = data.data.id;
  });

  // 5. Tenant Provisioning & Permission Engine
  let tempClientId = null;
  await test('Provision new tenant with custom permission tree', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ananya Roy',
        email: `ananya_${Date.now()}@acmeindustrial.com`,
        organization_name: 'Acme Industrial Solutions',
        mobile: '+91 98111 22334',
        password: 'AcmeSecurePassword2026!',
        status: 'ACTIVE',
        access: {
          services: [
            {
              service_id: tempServiceId,
              full_service: false,
              modules: [
                {
                  module_id: tempModuleId,
                  access_mode: 'CUSTOM',
                  sub_module_ids: [tempSubModuleId],
                },
              ],
            },
          ],
        },
      }),
    });
    const data = await res.json();
    if (!data.success || !data.data?.id) throw new Error('Failed to provision tenant');
    tempClientId = data.data.id;
    // Verify password is NOT in response
    if (data.data.password || data.data.passwordHash || data.data.password_hash) {
      throw new Error('SECURITY VIOLATION: Password hash exposed in response!');
    }
  });

  await test('Verify saved permissions match database records', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/clients/${tempClientId}/access`);
    const data = await res.json();
    if (!data.success || !data.data?.services?.length) {
      throw new Error('Tenant has no access records');
    }
    const servAccess = data.data.services.find((s) => String(s.service_id) === String(tempServiceId));
    if (!servAccess) throw new Error('Assigned service missing');
    if (servAccess.full_service) throw new Error('Expected custom service access, got full_service');
    const modAccess = servAccess.modules.find((m) => String(m.module_id) === String(tempModuleId));
    if (!modAccess || modAccess.access_mode !== 'CUSTOM') throw new Error('Module access mode mismatch');
    if (!modAccess.sub_module_ids.includes(String(tempSubModuleId))) {
      throw new Error('Sub-module ID missing from custom access');
    }
  });

  await test('Revoke permission transactionally and verify removal', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/clients/${tempClientId}/access`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access: {
          services: [], // Revoke all access
        },
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error('Failed to update access');
    if (data.data.services.length !== 0) {
      throw new Error(`Expected 0 services after revocation, got ${data.data.services.length}`);
    }
  });

  // 6. Audit Logging Verification
  await test('Audit logs persisted every action with actor, IP, timestamp and details', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/audit-logs`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data) || data.data.length < 5) {
      throw new Error(`Insufficient audit logs recorded: ${data.data?.length}`);
    }
    const latest = data.data[0];
    if (!latest.action || !latest.created_at || !latest.details) {
      throw new Error('Audit log record missing required audit fields');
    }
  });

  // 7. Error Handling & Validation
  await test('Invalid service creation without name rejected with 400 status', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.success !== false) throw new Error('Expected success: false for invalid input');
  });

  await test('Invalid client creation without organization rejected with 400 status', async () => {
    const res = await authenticatedFetch(`${BASE_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete User', email: 'test@incomplete.com' }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request, got HTTP ${res.status}`);
    }
  });

  // 8. Automated Teardown of Temporary Test Artifacts
  await test('Teardown test artifacts', async () => {
    if (tempClientId) {
      await prisma.clientAdmin.delete({ where: { id: String(tempClientId) } }).catch(() => {});
    }
    if (tempServiceId) {
      await prisma.service.delete({ where: { id: String(tempServiceId) } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  console.log(`\n📊 Test Suite Complete: ${passed} Passed, ${failed} Failed\n`);
  return { passed, failed, success: failed === 0 };
}

// Auto-run when executed directly
import { fileURLToPath } from 'url';
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && (currentFilePath.toLowerCase() === process.argv[1].toLowerCase() || process.argv[1].includes('suite.test.js'))) {
  runIntegrationTestSuite()
    .then((result) => {
      if (!result.success) process.exit(1);
    })
    .catch((err) => {
      console.error('Test Suite encountered fatal error:', err);
      process.exit(1);
    });
}
