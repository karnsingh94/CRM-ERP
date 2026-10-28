import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runProductCatalogueFlowTests() {
  console.log('\n========================================================================');
  console.log('AZZUNIQE CRM & ERP — Product Catalogue, Categories & Pricing Test Suite');
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

  // 1. Identify primary test tenant
  const client = await prisma.clientAdmin.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!client) throw new Error('No client found for integration test.');

  const companyId = client.id;
  const companyToken = signToken({
    userId: companyId,
    companyId,
    role: 'COMPANY_ADMIN',
    type: 'COMPANY_USER',
  });
  const headers = {
    Authorization: `Bearer ${companyToken}`,
    'Content-Type': 'application/json',
  };

  // Cross-tenant tokens for testing isolation
  const otherCompanyId = '00000000-0000-0000-0000-000000000099';
  const otherCompanyToken = signToken({
    userId: otherCompanyId,
    companyId: otherCompanyId,
    role: 'COMPANY_ADMIN',
    type: 'COMPANY_USER',
  });
  const otherHeaders = {
    Authorization: `Bearer ${otherCompanyToken}`,
    'Content-Type': 'application/json',
  };

  const timestamp = Date.now();
  const testCatName = `Machinery & Tools ${timestamp}`;
  let createdCatId = null;
  let createdCat2Id = null;

  const testSku = `SKU-TST-${timestamp}`;
  let createdProductId = null;
  let createdPricingId = null;

  // ===========================================================================
  // CATEGORIES TESTS
  // ===========================================================================
  await test('Categories: Create category with name and description', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: testCatName,
        description: 'Industrial tools, milling cutters and CNC jigs',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Category creation failed: ${JSON.stringify(json)}`);
    }
    createdCatId = json.data.id;
    if (json.data.name !== testCatName) {
      throw new Error(`Expected category name "${testCatName}", got "${json.data.name}"`);
    }
  });

  await test('Categories: Reject duplicate category name in the same tenant', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: testCatName,
        description: 'Duplicate attempt',
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for duplicate category name, got ${res.status}`);
    }
  });

  await test('Categories: Create secondary category for zero-products deletion test', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Temp Category ${timestamp}`,
        description: 'Will be deleted with 0 linked products',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) throw new Error('Secondary category creation failed');
    createdCat2Id = json.data.id;
  });

  await test('Categories: List categories returns productCount', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories`, {
      headers,
    });
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) throw new Error('List categories failed');
    const found = json.data.find((c) => c.id === createdCatId);
    if (!found) throw new Error('Created category not found in list');
    if (typeof found.productCount !== 'number') throw new Error('productCount missing or invalid');
  });

  // ===========================================================================
  // PRODUCT DIRECTORY TESTS
  // ===========================================================================
  await test('Product Directory: Register a new SKU referencing the created category', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: testSku,
        name: 'Precision Milling Spindle 12000 RPM',
        description: 'High-torque water-cooled spindle motor',
        category: testCatName,
        uom: 'PCS',
        sellingPrice: '45000.00',
        purchasePrice: '32000.00',
        status: 'ACTIVE',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Product registration failed: ${JSON.stringify(json)}`);
    }
    createdProductId = json.data.id;
    if (json.data.sku !== testSku) throw new Error(`Expected SKU ${testSku}, got ${json.data.sku}`);
    if (json.data.category !== testCatName) throw new Error(`Expected category ${testCatName}, got ${json.data.category}`);
  });

  await test('Product Directory: Enforces SKU uniqueness within tenant', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: testSku,
        name: 'Duplicate Spindle',
        category: testCatName,
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for duplicate SKU, received status ${res.status}`);
    }
  });

  await test('Product Directory: Rejects invalid negative selling or purchase rates', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: `SKU-NEG-${timestamp}`,
        name: 'Negative Price Item',
        category: testCatName,
        sellingPrice: '-500',
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for negative price, received status ${res.status}`);
    }
  });

  await test('Product Directory: Rejects product registration if category does not exist', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: `SKU-NOCAT-${timestamp}`,
        name: 'No Category Item',
        category: 'NonExistentCategory999',
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for non-existent category, received status ${res.status}`);
    }
  });

  await test('Product Directory: Stores custom GST rate and initializes default pricing plan with it', async () => {
    const gstSku = `SKU-GST-${timestamp}`;
    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: gstSku,
        name: 'GST Test Item',
        category: testCatName,
        sellingPrice: '500',
        purchasePrice: '350',
        taxRate: '12.0',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) throw new Error(`Product creation with GST failed: ${JSON.stringify(json)}`);
    if (Number(json.data.taxRate) !== 12) throw new Error(`Expected taxRate 12, got ${json.data.taxRate}`);

    // Verify default pricing plan has matching 12% taxRate
    const priceRes = await fetch(`${API_BASE}/companies/${companyId}/products/pricing`, { headers });
    const priceJson = await priceRes.json();
    const plan = (priceJson.data || []).find((p) => p.productId === json.data.id && p.isDefault);
    if (!plan || Number(plan.taxRate) !== 12) {
      throw new Error(`Expected default pricing taxRate 12, got ${plan?.taxRate}`);
    }

    // Clean up temporary GST test product
    await fetch(`${API_BASE}/companies/${companyId}/products/${json.data.id}`, { method: 'DELETE', headers });
  });

  await test('Product Directory: Rejects invalid GST / Tax rate (>100% or negative)', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sku: `SKU-BADGST-${timestamp}`,
        name: 'Bad GST Item',
        category: testCatName,
        taxRate: '150.0',
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for taxRate > 100, received status ${res.status}`);
    }
  });

  await test('Product Directory: Stock display uses real InventoryStock system', async () => {
    // 1. Initial product has 0 stock if no InventoryStock registered
    const getRes = await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      headers,
    });
    const getJson = await getRes.json();
    if (!getJson.success) throw new Error('Get product failed');
    if (Number(getJson.data.stock) !== 0) {
      throw new Error(`Expected 0 initial stock from inventory system, got ${getJson.data.stock}`);
    }

    // 2. Add an InventoryStock record in inventory module for this SKU
    await prisma.inventoryStock.create({
      data: {
        companyId,
        sku: testSku,
        name: 'Precision Milling Spindle 12000 RPM',
        warehouse: 'Main Warehouse',
        stock: 55,
        reorderLevel: 10,
        uom: 'PCS',
      },
    });

    // 3. Re-query product and verify available stock accurately reflects 55
    const getRes2 = await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      headers,
    });
    const getJson2 = await getRes2.json();
    if (Number(getJson2.data.stock) !== 55) {
      throw new Error(`Expected available stock 55 from InventoryStock system, got ${getJson2.data.stock}`);
    }
  });

  await test('Product Directory: Edit existing product attributes', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Precision Milling Spindle 15000 RPM (Upgraded)',
        sellingPrice: '48000.00',
        description: 'Upgraded bearings and sensor cable included',
      }),
    });
    const json = await res.json();
    if (!json.success || json.data.name !== 'Precision Milling Spindle 15000 RPM (Upgraded)') {
      throw new Error(`Product update failed: ${JSON.stringify(json)}`);
    }
    if (parseFloat(json.data.sellingPrice) !== 48000) {
      throw new Error(`Expected updated selling price 48000, got ${json.data.sellingPrice}`);
    }
  });

  await test('Categories: Linked product count reflects registered product', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories`, {
      headers,
    });
    const json = await res.json();
    const cat = json.data.find((c) => c.id === createdCatId);
    if (!cat) throw new Error('Category not found');
    if (cat.productCount < 1) {
      throw new Error(`Expected productCount >= 1 for category with linked product, got ${cat.productCount}`);
    }
  });

  await test('Categories: Prevent unsafe deletion of category that has linked products', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories/${createdCatId}`, {
      method: 'DELETE',
      headers,
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request preventing unsafe category deletion, got status ${res.status}`);
    }
    const json = await res.json();
    if (!json.message || !json.message.includes('linked to')) {
      throw new Error(`Expected explanatory message about linked products, got: ${json.message}`);
    }
  });

  await test('Categories: Renaming category propagates to linked products without duplicating', async () => {
    const renamedCatName = `${testCatName} — Renamed`;
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories/${createdCatId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: renamedCatName }),
    });
    const json = await res.json();
    if (!json.success || json.data.name !== renamedCatName) {
      throw new Error(`Category rename failed: ${JSON.stringify(json)}`);
    }

    // Check linked product in Product Directory
    const prodRes = await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      headers,
    });
    const prodJson = await prodRes.json();
    if (prodJson.data.category !== renamedCatName) {
      throw new Error(`Expected product category to update to "${renamedCatName}", got "${prodJson.data.category}"`);
    }
  });

  await test('Categories: Successfully delete category with zero linked products', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories/${createdCat2Id}`, {
      method: 'DELETE',
      headers,
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(`Failed to delete empty category: ${JSON.stringify(json)}`);
    }
  });

  // ===========================================================================
  // PRICING & PLANS TESTS
  // ===========================================================================
  await test('Pricing & Plans: Configure price plan for existing product without creating duplicate SKU', async () => {
    const initialProductCount = await prisma.product.count({ where: { companyId } });

    const res = await fetch(`${API_BASE}/companies/${companyId}/products/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: createdProductId,
        planName: 'Enterprise Wholesale Tier',
        sellingPrice: '42000.00',
        purchasePrice: '30000.00',
        taxRate: '18.0',
        discountRate: '5.0',
        isDefault: false,
        status: 'ACTIVE',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) {
      throw new Error(`Price plan creation failed: ${JSON.stringify(json)}`);
    }
    createdPricingId = json.data.id;
    if (json.data.product?.sku !== testSku) {
      throw new Error(`Expected linked product SKU ${testSku}, got ${json.data.product?.sku}`);
    }

    // Verify product count did NOT increase
    const afterProductCount = await prisma.product.count({ where: { companyId } });
    if (afterProductCount !== initialProductCount) {
      throw new Error('Configuring pricing incorrectly created a new product record!');
    }
  });

  await test('Pricing & Plans: Reject invalid rates (tax > 100% or negative price)', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/pricing`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        productId: createdProductId,
        planName: 'Invalid Tier',
        sellingPrice: '1000',
        taxRate: '150', // Invalid > 100%
      }),
    });
    if (res.status !== 400) {
      throw new Error(`Expected 400 for invalid tax rate, got ${res.status}`);
    }
  });

  await test('Pricing & Plans: Updating default pricing synchronizes standard rates into Product Directory', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/pricing/${createdPricingId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sellingPrice: '46500.00',
        isDefault: true,
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data.isDefault) {
      throw new Error(`Pricing update failed: ${JSON.stringify(json)}`);
    }

    // Check Product Directory
    const prodRes = await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      headers,
    });
    const prodJson = await prodRes.json();
    if (parseFloat(prodJson.data.sellingPrice) !== 46500) {
      throw new Error(`Expected synced selling rate 46500 in Product Directory, got ${prodJson.data.sellingPrice}`);
    }
  });

  // ===========================================================================
  // HISTORICAL DOCUMENT SNAPSHOT SAFETY
  // ===========================================================================
  await test('Historical Document Safety: Changing catalogue price does not mutate existing sales quotations', async () => {
    // 1. Create a quotation using current catalogue price (46,500)
    const quoteRes = await fetch(`${API_BASE}/companies/${companyId}/sales/quotations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        customer: 'Alpha Precision Works',
        title: 'Quote for Spindle Unit',
        items: [
          { item: 'Precision Milling Spindle 15000 RPM (Upgraded)', sku: testSku, qty: 2, rate: 46500, total: 93000 },
        ],
        amount: 93000,
        status: 'SENT',
      }),
    });
    const quoteJson = await quoteRes.json();
    if (!quoteJson.success || !quoteJson.data?.id) throw new Error('Quotation creation failed');
    const quoteId = quoteJson.data.id;

    // 2. Change catalogue price in Product Directory to 55,000
    await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sellingPrice: '55000.00' }),
    });

    // 3. Verify quotation items still snapshot 46,500 rate and 93,000 total
    const verifiedQuote = await prisma.salesQuotation.findUnique({ where: { id: quoteId } });
    const items = verifiedQuote.items;
    if (!Array.isArray(items) || items[0].rate !== 46500) {
      throw new Error(`Historical quotation rate was mutated! Expected 46500, got ${items[0]?.rate}`);
    }
    if (parseFloat(verifiedQuote.amount) !== 93000) {
      throw new Error(`Historical quotation amount was mutated! Expected 93000, got ${verifiedQuote.amount}`);
    }

    // Cleanup quote
    await prisma.salesQuotation.delete({ where: { id: quoteId } });
  });

  // ===========================================================================
  // TENANT ISOLATION TESTS
  // ===========================================================================
  await test('Tenant Isolation: Another company cannot view or modify this company products', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${createdProductId}`, {
      headers: otherHeaders,
    });
    if (res.status !== 404 && res.status !== 403) {
      throw new Error(`Expected 404/403 cross-tenant isolation, received status ${res.status}`);
    }
  });

  await test('Tenant Isolation: Another company cannot delete this company category', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories/${createdCatId}`, {
      method: 'DELETE',
      headers: otherHeaders,
    });
    if (res.status !== 404 && res.status !== 403) {
      throw new Error(`Expected 404/403 cross-tenant isolation, received status ${res.status}`);
    }
  });

  // ===========================================================================
  // CLEANUP TEST ARTIFACTS
  // ===========================================================================
  await test('Cleanup: Remove test pricing, product, inventory stock, and category', async () => {
    if (createdPricingId) {
      await prisma.productPricing.deleteMany({ where: { id: createdPricingId } });
    }
    await prisma.inventoryStock.deleteMany({ where: { companyId, sku: testSku } });
    if (createdProductId) {
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }
    if (createdCatId) {
      await prisma.productCategory.deleteMany({ where: { id: createdCatId } });
    }
  });

  console.log(`\n========================================================================`);
  console.log(`Product Catalogue Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Product Catalogue flow.`);
  }
}
