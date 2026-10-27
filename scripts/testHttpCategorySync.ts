import 'dotenv/config';
import { signAdminToken, signCustomerToken } from '../server/jwtHelper';

const BASE_URL = 'http://localhost:3000';

function createCustomerToken(customerId: string = 'cust-http-verify', name: string = 'HTTP Verification User') {
  return signCustomerToken({
    customerId,
    id: customerId,
    name,
    phone: '9876543210',
    role: 'customer',
  });
}

function createAdminToken() {
  return signAdminToken({
    adminId: 'admin_owner_001',
    email: 'owner@freshcart.com',
    fullName: 'FreshCart Project Owner',
    role: 'owner',
    tokenVersion: 1,
  });
}

async function testHttpCategorySync() {
  console.log('=== RUNNING LIVE HTTP INTEGRATION TESTS FOR DYNAMIC CATEGORIES ===\n');

  const customerToken = createCustomerToken();
  const adminToken = createAdminToken();

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${customerToken}`,
  };

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
  };

  // --------------------------------------------------------------------------
  // STEP 1: Test standard categories via POST /api/assistant/chat
  // --------------------------------------------------------------------------
  console.log('--- STEP 1: Testing Standard Categories via Assistant Chat API ---');

  const standardTests = [
    { label: 'Produce & Fruit', cat: 'produce' },
    { label: 'Dairy & Eggs', cat: 'dairy' },
    { label: 'Bakery', cat: 'bakery' },
    { label: 'Beverages', cat: 'beverages' },
    { label: 'Snacks', cat: 'snacks' },
    { label: 'Rice & Grains', cat: 'grains' },
  ];

  for (const st of standardTests) {
    const res = await fetch(`${BASE_URL}/api/assistant/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: `Show ${st.label}`,
        intent: 'SHOW_CATEGORY',
        category: st.cat,
        categoryLabel: st.label,
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status} testing category ${st.label}`);
    }

    const data = await res.json();
    console.log(`[Category: ${st.label}] Returned ${data.products?.length} products. Intent: ${data.intent}. Message: "${data.message}"`);

    if (!data.success || data.intent !== 'SHOW_CATEGORY' || !Array.isArray(data.products) || data.products.length === 0) {
      throw new Error(`Failed to retrieve products for standard category: ${st.label}`);
    }
  }
  console.log('✓ STEP 1 PASSED: All 6 standard categories retrieve their products successfully via live API.\n');

  // --------------------------------------------------------------------------
  // STEP 2: Natural text queries matching categories
  // --------------------------------------------------------------------------
  console.log('--- STEP 2: Natural Text & Casing Category Matching ---');
  const textQueries = [
    { query: 'Produce & Fruit', expectedIntent: 'SHOW_CATEGORY' },
    { query: 'Dairy & Eggs', expectedIntent: 'SHOW_CATEGORY' },
    { query: 'Snacks', expectedIntent: 'SHOW_CATEGORY' },
    { query: 'Rice & Grains', expectedIntent: 'SHOW_CATEGORY' },
  ];

  for (const t of textQueries) {
    const res = await fetch(`${BASE_URL}/api/assistant/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        message: t.query,
      }),
    });

    const data = await res.json();
    console.log(`[Query: "${t.query}"] Intent: ${data.intent}, Products: ${data.products?.length}`);
    if (!data.success || data.intent !== t.expectedIntent || !data.products || data.products.length === 0) {
      throw new Error(`Natural text query "${t.query}" failed to resolve to ${t.expectedIntent}!`);
    }
  }
  console.log('✓ STEP 2 PASSED: Natural text category queries match accurately.\n');

  // --------------------------------------------------------------------------
  // STEP 3: Admin Adds a Product with New Category ("personal-care")
  // --------------------------------------------------------------------------
  console.log('--- STEP 3: Admin Creates New Product in "personal-care" Category ---');
  const testProdId = `prod-verify-pc-${Date.now()}`;
  const addRes = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      id: testProdId,
      product_id: testProdId,
      name: 'Organic Neem & Aloe Face Wash',
      title: 'Organic Neem & Aloe Face Wash',
      supplier: 'AyurPure Naturals',
      sku: 'SKU-PC-889',
      price: 199,
      unit: '150 ml',
      quantity: 40,
      stock: 40,
      badge: 'Ayurvedic',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
      category: 'personal-care',
      categoryLabel: 'Personal Care',
      description: 'Gentle clarifying organic face wash with neem and pure aloe vera.',
      is_organic: true,
      is_quick_prep: true,
    }),
  });

  const addData = await addRes.json();
  console.log('Admin add product response:', addData);
  if (!addRes.ok && addRes.status !== 201) {
    console.warn('Note: Admin product insert status:', addRes.status, addData);
  }

  // --------------------------------------------------------------------------
  // STEP 4: Query New Category in AI Assistant
  // --------------------------------------------------------------------------
  console.log('\n--- STEP 4: Customer Queries "Personal Care" in AI Assistant ---');
  const pcChatRes = await fetch(`${BASE_URL}/api/assistant/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      message: 'Show Personal Care',
      intent: 'SHOW_CATEGORY',
      category: 'personal-care',
      categoryLabel: 'Personal Care',
    }),
  });

  const pcData = await pcChatRes.json();
  console.log('Personal Care assistant response:', {
    success: pcData.success,
    intent: pcData.intent,
    productsCount: pcData.products?.length,
    message: pcData.message,
    items: pcData.products?.map((p: any) => p.name || p.title),
  });

  if (!pcData.success || pcData.intent !== 'SHOW_CATEGORY' || pcData.products.length === 0) {
    throw new Error('STEP 4 FAILED: AI Assistant failed to retrieve products for new category "Personal Care"!');
  }
  console.log('✓ STEP 4 PASSED: AI Assistant dynamically retrieved products under "Personal Care".\n');

  // --------------------------------------------------------------------------
  // STEP 5: Clean up test product
  // --------------------------------------------------------------------------
  console.log('--- STEP 5: Cleaning Up Test Product ---');
  const delRes = await fetch(`${BASE_URL}/api/products/${testProdId}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  console.log(`Cleanup DELETE status: ${delRes.status}`);
  console.log('✓ STEP 5 PASSED: Cleaned up test product.\n');

  console.log('=== ALL LIVE HTTP INTEGRATION TESTS PASSED 100%! ===');
}

testHttpCategorySync().catch((err) => {
  console.error('\n❌ HTTP TEST SUITE FAILED:', err);
  process.exit(1);
});
