import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';
import companyService from '../../src/services/company.service.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runPermissionPropagationTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Full Permission Propagation & Dynamic Navigation Suite');
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

  // Find Super Admin and a test Client
  const superAdmin = await prisma.superAdmin.findFirst({ where: { status: 'ACTIVE' } });
  if (!superAdmin) throw new Error('No active Super Admin found for testing.');

  const superAdminToken = signToken({
    userId: superAdmin.id,
    email: superAdmin.email,
    role: 'SUPER_ADMIN',
    type: 'SUPER_ADMIN',
  });
  const saHeaders = {
    Authorization: `Bearer ${superAdminToken}`,
    'Content-Type': 'application/json',
  };

  // Find or create dedicated isolated test company
  const testEmail = `perm_test_${Date.now()}@azzuniqe.com`;
  let testCompany = await prisma.clientAdmin.create({
    data: {
      organizationName: 'Perm Propagation Test Co',
      name: 'Perm Admin',
      email: testEmail,
      mobile: '9876543210',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      status: 'ACTIVE',
    },
  });

  const catalog = await prisma.service.findMany({
    where: { status: 'ACTIVE' },
    include: {
      modules: {
        where: { status: 'ACTIVE' },
        include: {
          subModules: {
            where: { status: 'ACTIVE' },
            orderBy: { orderNo: 'asc' },
          },
        },
        orderBy: { orderNo: 'asc' },
      },
    },
    orderBy: { orderNo: 'asc' },
  });

  const invService = catalog.find((s) => s.code === 'inventory_warehouse');
  if (!invService) throw new Error('inventory_warehouse service missing from database.');

  const invMod = invService.modules.find((m) => m.code === 'inventory_warehouse_mod');
  const gateMod = invService.modules.find((m) => m.code === 'gate_pass');
  if (!invMod || !gateMod) throw new Error('inventory_warehouse_mod or gate_pass module missing.');

  const crmService = catalog.find((s) => s.code === 'crm_sales');

  // Test 1: Super Admin assigns all 4 Inventory & Stock screens and all 3 Gate Pass screens
  await test('Super Admin assigns all 4 Inventory screens & all 3 Gate Pass screens', async () => {
    const invSubIds = invMod.subModules.map((sm) => sm.id);
    const gateSubIds = gateMod.subModules.map((sm) => sm.id);

    if (invSubIds.length !== 4) {
      throw new Error(`Expected 4 inventory submodules, found ${invSubIds.length}`);
    }
    if (gateSubIds.length !== 3) {
      throw new Error(`Expected 3 gate pass submodules, found ${gateSubIds.length}`);
    }

    const payload = {
      access: {
        services: [
          {
            service_id: invService.id,
            full_service: false,
            modules: [
              {
                module_id: invMod.id,
                access_mode: 'CUSTOM',
                sub_module_ids: invSubIds,
              },
              {
                module_id: gateMod.id,
                access_mode: 'CUSTOM',
                sub_module_ids: gateSubIds,
              },
            ],
          },
        ],
      },
    };

    const res = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      method: 'PUT',
      headers: saHeaders,
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(`Save failed: ${json.message || res.statusText}`);
    }

    // Retrieve via GET
    const getRes = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      headers: saHeaders,
    });
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.success) {
      throw new Error(`Get access failed: ${getJson.message || getRes.statusText}`);
    }

    const savedInvSrv = getJson.data.services.find((s) => s.code === 'inventory_warehouse');
    if (!savedInvSrv) throw new Error('inventory_warehouse not found in saved access response');

    const savedInvMod = savedInvSrv.modules.find((m) => m.code === 'inventory_warehouse_mod');
    const savedGateMod = savedInvSrv.modules.find((m) => m.code === 'gate_pass');
    if (!savedInvMod) throw new Error('inventory_warehouse_mod not found in saved access');
    if (!savedGateMod) throw new Error('gate_pass not found in saved access');

    if (savedInvMod.subModules.length !== 4) {
      throw new Error(`Expected 4 subModules in inventory_warehouse_mod, got ${savedInvMod.subModules.length}`);
    }
    if (savedGateMod.subModules.length !== 3) {
      throw new Error(`Expected 3 subModules in gate_pass, got ${savedGateMod.subModules.length}`);
    }

    const hasRegister = savedGateMod.subModules.some((sm) => sm.code === 'gate_pass_register');
    if (!hasRegister) throw new Error('gate_pass_register is missing from saved gate pass submodules');
  });

  // Test 2: Custom subset selection (1 child screen)
  await test('Custom subset selection: Select exactly 1 child screen (Current Stock)', async () => {
    const currentStockSub = invMod.subModules.find((sm) => sm.code === 'stock_current');
    if (!currentStockSub) throw new Error('stock_current submodule not found');

    const payload = {
      access: {
        services: [
          {
            service_id: invService.id,
            full_service: false,
            modules: [
              {
                module_id: invMod.id,
                access_mode: 'CUSTOM',
                sub_module_ids: [currentStockSub.id],
              },
            ],
          },
        ],
      },
    };

    const res = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      method: 'PUT',
      headers: saHeaders,
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(`Save failed: ${json.message}`);

    const getRes = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, { headers: saHeaders });
    const getJson = await getRes.json();
    const savedInvSrv = getJson.data.services.find((s) => s.code === 'inventory_warehouse');
    const savedInvMod = savedInvSrv.modules.find((m) => m.code === 'inventory_warehouse_mod');

    if (savedInvMod.subModules.length !== 1) {
      throw new Error(`Expected exactly 1 submodule, found ${savedInvMod.subModules.length}`);
    }
    if (savedInvMod.subModules[0].code !== 'stock_current') {
      throw new Error(`Expected stock_current, found ${savedInvMod.subModules[0].code}`);
    }

    // Gate Pass was not selected, so it must NOT appear
    const savedGateMod = savedInvSrv.modules.find((m) => m.code === 'gate_pass');
    if (savedGateMod) throw new Error('Unselected gate_pass module should not appear in saved access');
  });

  // Test 3: None selection removes module access cleanly
  await test('None selection: Deselecting service modules cleanly removes access', async () => {
    const payload = {
      access: {
        services: [],
      },
    };

    const res = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      method: 'PUT',
      headers: saHeaders,
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(`Save failed: ${json.message}`);

    const getRes = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, { headers: saHeaders });
    const getJson = await getRes.json();
    if (getJson.data.services.length !== 0) {
      throw new Error(`Expected 0 services, found ${getJson.data.services.length}`);
    }
  });

  // Test 4: Full Service selection grants all modules and submodules
  await test('Full Service selection: Enables all modules and submodules for the service', async () => {
    const payload = {
      access: {
        services: [
          {
            service_id: invService.id,
            full_service: true,
            modules: [],
          },
        ],
      },
    };

    const res = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      method: 'PUT',
      headers: saHeaders,
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(`Save failed: ${json.message}`);

    const getRes = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, { headers: saHeaders });
    const getJson = await getRes.json();
    const savedInvSrv = getJson.data.services.find((s) => s.code === 'inventory_warehouse');
    if (!savedInvSrv) throw new Error('inventory_warehouse not found');
    if (!savedInvSrv.isFullService) throw new Error('Expected isFullService to be true');

    const invModule = savedInvSrv.modules.find((m) => m.code === 'inventory_warehouse_mod');
    const gateModule = savedInvSrv.modules.find((m) => m.code === 'gate_pass');
    if (!invModule || invModule.subModules.length !== 4) {
      throw new Error(`Expected 4 submodules in inventory_warehouse_mod, found ${invModule?.subModules?.length}`);
    }
    if (!gateModule || gateModule.subModules.length !== 3) {
      throw new Error(`Expected 3 submodules in gate_pass, found ${gateModule?.subModules?.length}`);
    }
  });

  // Test 5: Multi-tenant scoping (Updating Company A does not alter Company B)
  await test('Tenant isolation: Updating Company A permissions leaves other companies unchanged', async () => {
    // Check if second company exists or create a test one
    let secondCompany = await prisma.clientAdmin.findFirst({
      where: {
        id: { not: testCompany.id },
        deletedAt: null,
      },
    });

    if (secondCompany) {
      const bBefore = await fetch(`${API_BASE}/clients/${secondCompany.id}/access`, { headers: saHeaders });
      const bBeforeJson = await bBefore.json();
      const bBeforeServiceCount = bBeforeJson.data?.services?.length || 0;

      // Update testCompany
      await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
        method: 'PUT',
        headers: saHeaders,
        body: JSON.stringify({ access: { services: [] } }),
      });

      const bAfter = await fetch(`${API_BASE}/clients/${secondCompany.id}/access`, { headers: saHeaders });
      const bAfterJson = await bAfter.json();
      const bAfterServiceCount = bAfterJson.data?.services?.length || 0;

      if (bBeforeServiceCount !== bAfterServiceCount) {
        throw new Error('Company B permissions were unexpectedly modified when Company A was updated');
      }
    }
  });

  // Test 6: Backend Security Guard checks (validateSubModuleAccess)
  await test('Security check: Disabled screens remain blocked with 403 HTTP status', async () => {
    // Grant CRM & Sales only to testCompany
    const crmPayload = {
      access: {
        services: [
          {
            service_id: crmService.id,
            full_service: true,
            modules: [],
          },
        ],
      },
    };
    await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      method: 'PUT',
      headers: saHeaders,
      body: JSON.stringify(crmPayload),
    });

    // Make Company Admin token for testCompany
    const adminToken = signToken({
      userId: testCompany.id,
      companyId: testCompany.id,
      role: 'COMPANY_ADMIN',
      type: 'COMPANY_USER',
    });
    const adminHeaders = {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    };

    // Calling inventory stocks API when inventory_warehouse is NOT assigned
    const unauthRes = await fetch(`${API_BASE}/companies/${testCompany.id}/inventory/stocks`, {
      headers: adminHeaders,
    });

    // Expect 403 forbidden or route restricted
    if (unauthRes.status !== 403 && unauthRes.status !== 404) {
      throw new Error(`Expected 403 Forbidden for unauthorized service, got HTTP ${unauthRes.status}`);
    }
  });

  // Test 7: Restore Full CRM & Sales + Inventory & Warehouse for testCompany
  await test('Regression preservation: CRM & Sales and Inventory & Warehouse both assigned and verified', async () => {
    const invSubIds = invMod.subModules.map((sm) => sm.id);
    const gateSubIds = gateMod.subModules.map((sm) => sm.id);

    const restorePayload = {
      access: {
        services: [
          {
            service_id: crmService.id,
            full_service: true,
            modules: [],
          },
          {
            service_id: invService.id,
            full_service: false,
            modules: [
              {
                module_id: invMod.id,
                access_mode: 'CUSTOM',
                sub_module_ids: invSubIds,
              },
              {
                module_id: gateMod.id,
                access_mode: 'CUSTOM',
                sub_module_ids: gateSubIds,
              },
            ],
          },
        ],
      },
    };

    const res = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, {
      method: 'PUT',
      headers: saHeaders,
      body: JSON.stringify(restorePayload),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(`Restore failed: ${json.message}`);

    const getRes = await fetch(`${API_BASE}/clients/${testCompany.id}/access`, { headers: saHeaders });
    const getJson = await getRes.json();

    const crm = getJson.data.services.find((s) => s.code === 'crm_sales');
    const inv = getJson.data.services.find((s) => s.code === 'inventory_warehouse');
    if (!crm) throw new Error('CRM & Sales missing after restore');
    if (!inv) throw new Error('Inventory & Warehouse missing after restore');

    const invModule = inv.modules.find((m) => m.code === 'inventory_warehouse_mod');
    const gateModule = inv.modules.find((m) => m.code === 'gate_pass');
    if (invModule.subModules.length !== 4) throw new Error('Expected 4 Inventory submodules');
    if (gateModule.subModules.length !== 3) throw new Error('Expected 3 Gate Pass submodules');
    // Clean up test company
    await prisma.clientSubModuleAccess.deleteMany({ where: { adminId: testCompany.id } });
    await prisma.clientModuleAccess.deleteMany({ where: { adminId: testCompany.id } });
    await prisma.clientServiceAccess.deleteMany({ where: { adminId: testCompany.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: testCompany.id } });
    await prisma.clientAdmin.delete({ where: { id: testCompany.id } });
  });

  await prisma.$disconnect();

  console.log('\n========================================================================');
  console.log(`Permission Propagation Suite Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    throw new Error(`Permission propagation tests failed with ${failed} failures.`);
  }

  return { passed, failed };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('permission_propagation.test.js')) {
  runPermissionPropagationTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Test Suite Failed:', err);
      process.exit(1);
    });
}
