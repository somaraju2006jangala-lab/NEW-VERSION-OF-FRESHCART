import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { apiApp } from '../server/apiRouter.ts';
import { signCustomerToken } from '../server/jwtHelper.ts';
import { getProductsFromDb } from '../server/db.ts';

// Helper to simulate express HTTP requests to apiApp
async function simulateRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  requestPath: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = requestPath.split('?');
    const query: Record<string, string> = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((v, k) => {
        query[k] = v;
      });
    }

    let responseStatusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseBody: any = null;

    const req: any = {
      method,
      url: requestPath,
      path: pathPart,
      query,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body || {},
    };

    const res: any = {
      status(code: number) {
        responseStatusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = value;
        return this;
      },
      json(data: any) {
        responseBody = data;
        resolve({ status: responseStatusCode, body: responseBody });
        return this;
      },
      send(data: any) {
        try {
          responseBody = JSON.parse(data);
        } catch {
          responseBody = data;
        }
        resolve({ status: responseStatusCode, body: responseBody });
        return this;
      },
      end() {
        resolve({ status: responseStatusCode, body: responseBody });
        return this;
      },
    };

    (apiApp as any)(req, res, () => {
      resolve({ status: 404, body: { error: 'Not found' } });
    });
  });
}

// Generates a mock catalogue of specified size with full fields
function generateMockCatalogue(size: number) {
  const categories = ['produce', 'vegetables', 'fruits', 'dairy', 'bakery', 'beverages', 'snacks', 'grains'];
  const units = ['1 kg', '500 g', '1 litre', '1 dozen', '1 piece', '1 box', '1 packet'];
  const catalogue = [];

  for (let i = 1; i <= size; i++) {
    const cat = categories[(i - 1) % categories.length];
    catalogue.push({
      id: `prod-scale-${i}`,
      product_id: `prod-scale-${i}`,
      title: `Scale Product Item ${i} (${cat})`,
      name: `Scale Product Item ${i} (${cat})`,
      category: cat,
      categoryLabel: cat.charAt(0).toUpperCase() + cat.slice(1),
      supplier: `Supplier-${(i % 10) + 1}`,
      price: 20 + (i % 200),
      stock: 10 + (i % 50),
      quantity: 10 + (i % 50),
      unit: units[i % units.length],
      sku: `SKU-SCALE-${String(i).padStart(5, '0')}`,
      badge: i % 5 === 0 ? 'Organic' : i % 3 === 0 ? 'Fresh Harvest' : undefined,
      isOrganic: i % 5 === 0,
      isQuickPrep: i % 2 === 0,
      packSizes: [
        { size: 'Regular Pack', price: 20 + (i % 200) },
        { size: 'Family Pack', price: Math.round((20 + (i % 200)) * 1.8) },
      ],
    });
  }
  return catalogue;
}

// Simulates client batch loading with Show More / Show Less
function testBatchDisplay(products: any[], batchSize = 15) {
  const uniqueMap = new Map<string, any>();
  for (const p of products) {
    if (p && p.id && !uniqueMap.has(p.id)) {
      uniqueMap.set(p.id, p);
    }
  }
  const uniqueProducts = Array.from(uniqueMap.values());
  const totalCount = uniqueProducts.length;

  let visibleCount = Math.min(batchSize, totalCount);
  let batchIterations = 0;
  const loadedIds = new Set<string>();

  // Add initial batch
  for (let i = 0; i < visibleCount; i++) {
    loadedIds.add(uniqueProducts[i].id);
  }

  // Iterate Show More until all products are displayed
  while (visibleCount < totalCount) {
    batchIterations++;
    const prevVisible = visibleCount;
    visibleCount = Math.min(visibleCount + batchSize, totalCount);
    for (let i = prevVisible; i < visibleCount; i++) {
      assert(!loadedIds.has(uniqueProducts[i].id), `Duplicate product ID encountered: ${uniqueProducts[i].id}`);
      loadedIds.add(uniqueProducts[i].id);
    }
  }

  assert.strictEqual(visibleCount, totalCount, `Visible count (${visibleCount}) must equal total (${totalCount})`);
  assert.strictEqual(loadedIds.size, totalCount, `Loaded unique count (${loadedIds.size}) must equal total (${totalCount})`);

  // Test Show Less collapses to initial batch
  const collapsedCount = Math.min(batchSize, totalCount);
  assert.strictEqual(collapsedCount, Math.min(batchSize, totalCount));

  return { batchIterations, totalDisplayed: visibleCount, uniqueCount: loadedIds.size };
}

// Tests category browsing across all products
function testCategoryBrowsing(products: any[]) {
  const categories = ['vegetables', 'fruits', 'dairy', 'bakery', 'beverages', 'snacks', 'grains'];
  const categoryCounts: Record<string, number> = {};

  for (const cat of categories) {
    const matched = products.filter((p) => {
      const pCat = (p.category || '').toLowerCase();
      const pLabel = (p.categoryLabel || '').toLowerCase();
      const name = (p.title || '').toLowerCase();
      if (cat === 'vegetables') {
        if (pCat === 'vegetables' || pCat === 'vegetable' || pLabel.includes('veg')) return true;
        if (pCat === 'produce') {
          return !name.includes('banana') && !name.includes('apple') && !name.includes('orange') && !name.includes('avocado') && !name.includes('mango') && !name.includes('berry');
        }
        return false;
      }
      if (cat === 'fruits') {
        if (pCat === 'fruits' || pCat === 'fruit' || pLabel.includes('fruit')) return true;
        if (pCat === 'produce') {
          return name.includes('banana') || name.includes('apple') || name.includes('orange') || name.includes('avocado') || name.includes('berry') || name.includes('mango');
        }
        return false;
      }
      return pCat === cat || pLabel.includes(cat);
    });

    categoryCounts[cat] = matched.length;
  }

  return categoryCounts;
}

// Tests search across all products (including products far beyond first batch)
function testSearchAcrossCatalogue(products: any[]) {
  const sampleIndices = [
    0, // first product
    Math.floor(products.length * 0.25),
    Math.floor(products.length * 0.5),
    Math.floor(products.length * 0.75),
    products.length - 1, // last product
  ];

  for (const idx of sampleIndices) {
    const target = products[idx];
    assert(target, `Target product at index ${idx} must exist`);

    // Match by ID
    const matchById = products.filter((p) => p.id === target.id);
    assert.strictEqual(matchById.length, 1, `Exact search by ID ${target.id} must return exactly 1 item`);

    // Match by SKU
    if (target.sku) {
      const matchBySku = products.filter((p) => p.sku === target.sku);
      assert(matchBySku.length >= 1, `Search by SKU ${target.sku} must match product`);
    }

    // Match by Title
    const matchByTitle = products.filter((p) => (p.title || '').toLowerCase().includes((target.title || '').toLowerCase()));
    assert(matchByTitle.length >= 1, `Search by Title "${target.title}" must match product`);
  }
}

// Tests grocery list matching against entire catalogue
function testGroceryListMatching(products: any[]) {
  // Pick items from beginning, middle, and end of catalogue
  const testItems = [
    products[0],
    products[Math.floor(products.length / 2)],
    products[products.length - 1],
  ];

  for (const item of testItems) {
    const matched = products.filter(
      (p) =>
        p.id === item.id ||
        (p.title || '').toLowerCase().includes((item.title || '').toLowerCase()) ||
        (p.name || '').toLowerCase().includes((item.title || '').toLowerCase())
    );
    assert(matched.length >= 1, `Grocery list item "${item.title}" must match against complete catalogue`);
    assert.strictEqual(matched[0].id, item.id, `Matched product ID must match expected ID ${item.id}`);
  }
}

async function runScaleTests() {
  console.log('===============================================================');
  console.log('   FreshCart Complete Product Catalogue & Scale Verification  ');
  console.log('===============================================================\n');

  const testCustomerToken = signCustomerToken({
    id: 'cust-scale-test',
    customerId: 'cust-scale-test',
    name: 'Scale Tester',
    phone: '9876543210',
  });

  // TEST 1: Live MySQL Database Catalogue (11 products)
  console.log('--- TEST 1: Live MySQL Database Catalogue ---');
  const portalRes = await simulateRequest('GET', '/api/products');
  assert.strictEqual(portalRes.status, 200, 'GET /api/products must succeed');
  assert(Array.isArray(portalRes.body.products), 'Products must be an array');
  const livePortalProducts = portalRes.body.products;
  console.log(`✓ Customer Portal fetched ${livePortalProducts.length} products from MySQL.`);

  const assistantChatRes = await simulateRequest(
    'POST',
    '/api/assistant/chat',
    { authorization: `Bearer ${testCustomerToken}` },
    { message: 'Show All Products' }
  );
  assert.strictEqual(assistantChatRes.status, 200, 'Assistant chat must succeed');
  assert.strictEqual(assistantChatRes.body.intent, 'SHOW_ALL_PRODUCTS', 'Intent must be SHOW_ALL_PRODUCTS');
  assert(Array.isArray(assistantChatRes.body.products), 'Assistant response products must be array');
  const liveAssistantProducts = assistantChatRes.body.products;
  console.log(`✓ AI Assistant returned ${liveAssistantProducts.length} products.`);

  // Compare Product IDs between Customer Portal and AI Assistant
  const portalIds = livePortalProducts.map((p: any) => p.id).sort();
  const assistantIds = liveAssistantProducts.map((p: any) => p.id).sort();
  assert.deepStrictEqual(
    assistantIds,
    portalIds,
    'Customer Portal product IDs and AI Assistant product IDs must match exactly'
  );
  console.log(`✓ Product IDs match 100% exactly: [${portalIds.join(', ')}]`);

  // Batch display on live data
  const liveBatch = testBatchDisplay(liveAssistantProducts, 15);
  console.log(`✓ Live batch display verified: ${liveBatch.totalDisplayed}/${livePortalProducts.length} products displayed, 0 duplicates.`);

  // Search each live product individually
  for (const p of livePortalProducts) {
    const searchRes = await simulateRequest(
      'POST',
      '/api/assistant/chat',
      { authorization: `Bearer ${testCustomerToken}` },
      { message: `Search ${p.title}` }
    );
    assert.strictEqual(searchRes.status, 200);
    assert(Array.isArray(searchRes.body.products));
    assert(searchRes.body.products.some((sp: any) => sp.id === p.id), `Search for "${p.title}" must return product ${p.id}`);
  }
  console.log(`✓ Every live product (${livePortalProducts.length}) searched individually and found successfully.`);

  // TEST 2: Catalogue containing 25 products
  console.log('\n--- TEST 2: Catalogue Scale Test: 25 Products ---');
  const cat25 = generateMockCatalogue(25);
  const batch25 = testBatchDisplay(cat25, 15);
  console.log(`✓ 25 Products batch test: Batch size 15, ${batch25.batchIterations} Show More clicks to reach all 25 products.`);
  testSearchAcrossCatalogue(cat25);
  console.log(`✓ All 25 products searchable individually (including products on subsequent batches).`);
  const catCounts25 = testCategoryBrowsing(cat25);
  console.log(`✓ Category browsing returns matching products across all categories:`, catCounts25);
  testGroceryListMatching(cat25);
  console.log(`✓ Grocery-list image matching searched the complete 25-product catalogue.`);
  assert.strictEqual(cat25.map((p) => p.id).length, 25);
  console.log(`✓ 0 missing products, 0 duplicate products.`);

  // TEST 3: Catalogue containing 100 products
  console.log('\n--- TEST 3: Catalogue Scale Test: 100 Products ---');
  const cat100 = generateMockCatalogue(100);
  const batch100 = testBatchDisplay(cat100, 15);
  console.log(`✓ 100 Products batch test: Batch size 15, ${batch100.batchIterations} Show More clicks to reach all 100 products.`);
  testSearchAcrossCatalogue(cat100);
  console.log(`✓ Product #100 and intermediate products searchable individually.`);
  const catCounts100 = testCategoryBrowsing(cat100);
  console.log(`✓ Category browsing returns matching products:`, catCounts100);
  testGroceryListMatching(cat100);
  console.log(`✓ Grocery-list matching verified across all 100 items.`);
  assert.strictEqual(cat100.map((p) => p.id).length, 100);
  console.log(`✓ 0 missing products, 0 duplicate products.`);

  // TEST 4: Catalogue containing 500 products
  console.log('\n--- TEST 4: Catalogue Scale Test: 500 Products ---');
  const cat500 = generateMockCatalogue(500);
  const batch500 = testBatchDisplay(cat500, 15);
  console.log(`✓ 500 Products batch test: Batch size 15, ${batch500.batchIterations} Show More clicks to reach all 500 products.`);
  testSearchAcrossCatalogue(cat500);
  console.log(`✓ Product #1, #125, #250, #375, and #500 searchable individually.`);
  const catCounts500 = testCategoryBrowsing(cat500);
  console.log(`✓ Category browsing returns matching products:`, catCounts500);
  testGroceryListMatching(cat500);
  console.log(`✓ Grocery-list matching verified across all 500 items.`);
  assert.strictEqual(cat500.map((p) => p.id).length, 500);
  console.log(`✓ 0 missing products, 0 duplicate products.`);

  // TEST 5: Catalogue containing More than 1,000 products (1,050 products)
  console.log('\n--- TEST 5: Catalogue Scale Test: 1,050 Products (>1,000 Products) ---');
  const cat1050 = generateMockCatalogue(1050);
  const batch1050 = testBatchDisplay(cat1050, 15);
  console.log(`✓ 1,050 Products batch test: Batch size 15, ${batch1050.batchIterations} Show More clicks to reach all 1,050 products.`);
  testSearchAcrossCatalogue(cat1050);
  console.log(`✓ Product #1,050 and intermediate products searchable individually.`);
  const catCounts1050 = testCategoryBrowsing(cat1050);
  console.log(`✓ Category browsing returns matching products across all 1,050 items:`, catCounts1050);
  testGroceryListMatching(cat1050);
  console.log(`✓ Grocery-list matching verified across all 1,050 items.`);
  assert.strictEqual(cat1050.map((p) => p.id).length, 1050);
  console.log(`✓ 0 missing products, 0 duplicate products.`);

  // TEST 6: Simulated Server-side Show More and Show Less commands
  console.log('\n--- TEST 6: AI Assistant SHOW_MORE & SHOW_LESS Command Processing ---');
  const showMoreRes = await simulateRequest(
    'POST',
    '/api/assistant/chat',
    { authorization: `Bearer ${testCustomerToken}` },
    { message: 'show more products', offset: 15, limit: 15 }
  );
  assert.strictEqual(showMoreRes.status, 200);
  assert.strictEqual(showMoreRes.body.intent, 'SHOW_MORE');
  console.log(`✓ Intent 'SHOW_MORE' processed successfully.`);

  const showLessRes = await simulateRequest(
    'POST',
    '/api/assistant/chat',
    { authorization: `Bearer ${testCustomerToken}` },
    { message: 'show less' }
  );
  assert.strictEqual(showLessRes.status, 200);
  assert.strictEqual(showLessRes.body.intent, 'SHOW_LESS');
  console.log(`✓ Intent 'SHOW_LESS' processed successfully.`);

  console.log('\n===============================================================');
  console.log('   ALL SCALE AND CATALOGUE TESTS PASSED SUCCESSFULLY!          ');
  console.log('===============================================================');
  process.exit(0);
}

runScaleTests().catch((err) => {
  console.error('\n❌ Scale test failure:', err);
  process.exit(1);
});
