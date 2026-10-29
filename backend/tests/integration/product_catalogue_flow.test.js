import path from 'path';
import fs from 'fs';
import prisma from '../../src/config/prisma.js';
import { signToken } from '../../src/utils/token.js';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:5000/api';

export async function runProductCatalogueFlowTests() {
  const uploadsBase = fs.existsSync(path.resolve(process.cwd(), 'backend', 'uploads')) ? path.resolve(process.cwd(), 'backend') : process.cwd();
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
  // PRODUCT IMAGE & TENANT ISOLATION TESTS
  // ===========================================================================
  const imageCatName = `Image Category ${timestamp}`;
  let imageCatId = null;
  let imageTestProdId = null;

  await test('Product Image: Create dedicated category for image tests', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/categories`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: imageCatName,
        description: 'Category for product image validation',
      }),
    });
    const json = await res.json();
    if (!json.success || !json.data?.id) throw new Error('Failed to create image test category');
    imageCatId = json.data.id;
  });
  let firstUploadedImagePath = null;
  let secondUploadedImagePath = null;

  // Minimal valid 1x1 PNG bytes
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);

  // Minimal valid JPEG bytes
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
    0xff, 0xd9
  ]);

  await test('Product Image: Reject file with invalid content or spoofed extension', async () => {
    const fd = new FormData();
    fd.append('sku', `SKU-BAD-${timestamp}`);
    fd.append('name', 'Bad Image Product');
    fd.append('category', imageCatName);
    fd.append('sellingPrice', '100');
    fd.append('purchasePrice', '50');
    // text disguised as jpg
    const fakeBlob = new Blob(['Not a real image file content text'], { type: 'image/jpeg' });
    fd.append('image', fakeBlob, 'fake.jpg');

    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${companyToken}` },
      body: fd,
    });
    const json = await res.json();
    if (res.status !== 400 || json.success) {
      throw new Error(`Expected 400 for invalid image magic bytes, got status ${res.status}: ${JSON.stringify(json)}`);
    }
  });

  await test('Product Image: Reject file exceeding 5MB limit', async () => {
    const fd = new FormData();
    fd.append('sku', `SKU-BIG-${timestamp}`);
    fd.append('name', 'Oversized Product');
    fd.append('category', imageCatName);
    // 5.5 MB buffer
    const bigBuf = Buffer.alloc(5.5 * 1024 * 1024);
    bigBuf[0] = 0xff; bigBuf[1] = 0xd8; bigBuf[2] = 0xff;
    const bigBlob = new Blob([bigBuf], { type: 'image/jpeg' });
    fd.append('image', bigBlob, 'big.jpg');

    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${companyToken}` },
      body: fd,
    });
    const json = await res.json();
    if (res.status !== 400 || json.success) {
      throw new Error(`Expected 400 for file > 5MB, got status ${res.status}: ${JSON.stringify(json)}`);
    }
  });

  await test('Product Image: Upload valid PNG on product creation', async () => {
    const fd = new FormData();
    fd.append('sku', `SKU-IMG-${timestamp}`);
    fd.append('name', 'Industrial CNC Flange with Image');
    fd.append('description', 'High precision flange with catalogue photo attached');
    fd.append('category', imageCatName);
    fd.append('sellingPrice', '2500.00');
    fd.append('purchasePrice', '1800.00');
    fd.append('taxRate', '18.0');
    fd.append('stock', '50');
    fd.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'flange.png');

    const res = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${companyToken}` },
      body: fd,
    });
    const json = await res.json();
    if (!json.success || !json.data?.id || !json.data?.imageUrl) {
      throw new Error(`Failed to create product with image: ${JSON.stringify(json)}`);
    }

    imageTestProdId = json.data.id;
    firstUploadedImagePath = json.data.imageUrl;

    if (!firstUploadedImagePath.includes('/uploads/tenants/') || !firstUploadedImagePath.includes(companyId)) {
      throw new Error(`Image URL does not contain tenant scoped path: ${firstUploadedImagePath}`);
    }

    // Verify file exists on server disk
    const normalized = firstUploadedImagePath.startsWith('/') ? firstUploadedImagePath.slice(1) : firstUploadedImagePath;
        const fullPath = path.resolve(uploadsBase, normalized);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Uploaded image file does not exist on disk: ${fullPath}`);
    }
  });

  await test('Product Image: Serve image via GET with Bearer token', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${imageTestProdId}/image`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200 for authenticated image fetch, got ${res.status}`);
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('image/png')) {
      throw new Error(`Expected image/png content type, got ${contentType}`);
    }
  });

  await test('Product Image: Serve image via query token ?token=...', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${imageTestProdId}/image?token=${companyToken}`);
    if (res.status !== 200) {
      throw new Error(`Expected 200 for query-token image fetch, got ${res.status}`);
    }
  });

  await test('Product Image: Tenant isolation rejects other company access to image', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${imageTestProdId}/image`, {
      headers: otherHeaders,
    });
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`Expected 403 or 404 for cross-tenant image access, got ${res.status}`);
    }
  });

  await test('Product Image: Replace image on update and verify previous file cleanup', async () => {
    const fd = new FormData();
    fd.append('name', 'Industrial CNC Flange Updated Image');
    fd.append('image', new Blob([validJpegBuffer], { type: 'image/jpeg' }), 'flange_updated.jpg');

    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${imageTestProdId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${companyToken}` },
      body: fd,
    });
    const json = await res.json();
    if (!json.success || !json.data?.imageUrl) {
      throw new Error(`Failed to update product with new image: ${JSON.stringify(json)}`);
    }

    secondUploadedImagePath = json.data.imageUrl;
    if (secondUploadedImagePath === firstUploadedImagePath) {
      throw new Error('Image URL was not updated to new file path');
    }

    // Verify old file was deleted from disk
    const oldNorm = firstUploadedImagePath.startsWith('/') ? firstUploadedImagePath.slice(1) : firstUploadedImagePath;
        const oldFullPath = path.resolve(uploadsBase, oldNorm);
    if (fs.existsSync(oldFullPath)) {
      throw new Error(`Old image file was NOT deleted after replacement: ${oldFullPath}`);
    }

    // Verify new file exists on disk
    const newNorm = secondUploadedImagePath.startsWith('/') ? secondUploadedImagePath.slice(1) : secondUploadedImagePath;
        const newFullPath = path.resolve(uploadsBase, newNorm);
    if (!fs.existsSync(newFullPath)) {
      throw new Error(`New replacement image file does not exist on disk: ${newFullPath}`);
    }
  });

  await test('Product Image: Updating product without image preserves existing imageUrl', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${imageTestProdId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ description: 'Preserved image description change' }),
    });
    const json = await res.json();
    if (!json.success || json.data?.imageUrl !== secondUploadedImagePath) {
      throw new Error(`Image URL was lost or mutated during non-image update: ${json.data?.imageUrl}`);
    }

    // Verify file still exists on disk
    const norm = secondUploadedImagePath.startsWith('/') ? secondUploadedImagePath.slice(1) : secondUploadedImagePath;
        if (!fs.existsSync(path.resolve(uploadsBase, norm))) {
      throw new Error('Image file on disk was unexpectedly deleted during non-image update');
    }
  });

  await test('Product Image: Remove image explicitly via removeImage: true', async () => {
    const res = await fetch(`${API_BASE}/companies/${companyId}/products/${imageTestProdId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ removeImage: true }),
    });
    const json = await res.json();
    if (!json.success || json.data?.imageUrl !== null) {
      throw new Error(`Expected imageUrl to be null after removal, got ${json.data?.imageUrl}`);
    }

    // Verify file was deleted from disk
    const norm = secondUploadedImagePath.startsWith('/') ? secondUploadedImagePath.slice(1) : secondUploadedImagePath;
        if (fs.existsSync(path.resolve(uploadsBase, norm))) {
      throw new Error('Image file on disk was NOT deleted after removeImage: true');
    }
  });

  await test('Product Image: Deleting product cleans up associated image file', async () => {
    // 1. Create temporary product with image
    const fd = new FormData();
    fd.append('sku', `SKU-DEL-${timestamp}`);
    fd.append('name', 'Delete Me Product');
    fd.append('category', imageCatName);
    fd.append('image', new Blob([validPngBuffer], { type: 'image/png' }), 'to_delete.png');

    const createRes = await fetch(`${API_BASE}/companies/${companyId}/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${companyToken}` },
      body: fd,
    });
    const createJson = await createRes.json();
    const tempProdId = createJson.data?.id;
    const tempImgPath = createJson.data?.imageUrl;

    if (!tempProdId || !tempImgPath) throw new Error('Failed to create temp product for delete test');

    const tempNorm = tempImgPath.startsWith('/') ? tempImgPath.slice(1) : tempImgPath;
        const tempFullPath = path.resolve(uploadsBase, tempNorm);
    if (!fs.existsSync(tempFullPath)) throw new Error('Temp image was not created on disk');

    // 2. Delete product
    const delRes = await fetch(`${API_BASE}/companies/${companyId}/products/${tempProdId}`, {
      method: 'DELETE',
      headers,
    });
    const delJson = await delRes.json();
    if (!delJson.success) throw new Error('Failed to delete temp product');

    // 3. Verify file deleted from disk
    if (fs.existsSync(tempFullPath)) {
      throw new Error('Associated image file was NOT deleted after product deletion');
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
    if (imageTestProdId) {
      await prisma.product.deleteMany({ where: { id: imageTestProdId } });
    }
    if (createdCatId) {
      await prisma.productCategory.deleteMany({ where: { id: createdCatId } });
    }
    if (imageCatId) {
      await prisma.productCategory.deleteMany({ where: { id: imageCatId } });
    }
  });

  console.log(`\n========================================================================`);
  console.log(`Product Catalogue Suite Complete: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================================\n`);

  if (failed > 0) {
    throw new Error(`${failed} tests failed in Product Catalogue flow.`);
  }
}
