import 'dotenv/config';
import { CONSISTENT_QUICK_ACTIONS, CATEGORY_ACTION_MAP, deriveAvailableCategories, getCanonicalCategoryInfo } from '../src/components/AssistantChatModal';
import { CONSISTENT_QUICK_ACTIONS as BACKEND_ACTIONS } from '../server/assistantService';
import { INITIAL_PRODUCTS } from '../src/data/products';
import { signCustomerToken } from '../server/jwtHelper';

const BASE_URL = 'http://localhost:3000';

const EXPECTED_9_BUTTONS = [
  'Show All Products',
  'Produce & Fruit',
  'Dairy & Eggs',
  'Bakery',
  'Beverages',
  'Snacks',
  'Rice & Grains',
  'Pantry',
  'View Cart',
];

const FORBIDDEN_OLD_BUTTONS = [
  'View Vegetables',
  'View Fruits',
  'View Deals',
];

async function runTests() {
  console.log('========================================================================');
  console.log('TEST SUITE: FreshCart AI Assistant Consistent Quick-Action Buttons');
  console.log('========================================================================\n');

  // 1. Verify Constants Definition
  console.log('[Test 1] Verifying CONSISTENT_QUICK_ACTIONS Constant:');
  console.log('  Frontend buttons:', CONSISTENT_QUICK_ACTIONS);
  console.log('  Backend buttons: ', BACKEND_ACTIONS);
  
  if (JSON.stringify(CONSISTENT_QUICK_ACTIONS) !== JSON.stringify(EXPECTED_9_BUTTONS)) {
    throw new Error(`Frontend buttons do not match expected 9 buttons!\nExpected: ${JSON.stringify(EXPECTED_9_BUTTONS)}\nGot: ${JSON.stringify(CONSISTENT_QUICK_ACTIONS)}`);
  }
  if (JSON.stringify(BACKEND_ACTIONS) !== JSON.stringify(EXPECTED_9_BUTTONS)) {
    throw new Error(`Backend buttons do not match expected 9 buttons!\nExpected: ${JSON.stringify(EXPECTED_9_BUTTONS)}\nGot: ${JSON.stringify(BACKEND_ACTIONS)}`);
  }
  console.log('  ✓ PASSED: Both frontend and backend export exact 9 buttons in exact specified order.\n');

  // 2. Verify Old Buttons Absence in Constants
  console.log('[Test 2] Verifying Old Buttons Removal:');
  for (const oldBtn of FORBIDDEN_OLD_BUTTONS) {
    if (CONSISTENT_QUICK_ACTIONS.includes(oldBtn as any)) {
      throw new Error(`Forbidden old button "${oldBtn}" found in CONSISTENT_QUICK_ACTIONS!`);
    }
  }
  console.log('  ✓ PASSED: Old buttons (View Vegetables, View Fruits, View Deals) are completely removed.\n');

  // 3. Verify Categories in Catalogue & deriveAvailableCategories
  console.log('[Test 3] Verifying Catalogue Categories & deriveAvailableCategories:');
  const derivedCats = deriveAvailableCategories(INITIAL_PRODUCTS);
  console.log('  Derived Categories:', derivedCats.map(c => `${c.label} (${c.id})`));
  
  const expectedCategoryOrder = [
    'Produce & Fruit',
    'Dairy & Eggs',
    'Bakery',
    'Beverages',
    'Snacks',
    'Rice & Grains',
    'Pantry',
  ];
  for (let i = 0; i < expectedCategoryOrder.length; i++) {
    const expected = expectedCategoryOrder[i];
    const actual = derivedCats[i]?.label;
    if (actual !== expected) {
      throw new Error(`Category at index ${i} is "${actual}", expected "${expected}"!`);
    }
  }
  console.log('  ✓ PASSED: All 7 categories present in exact canonical order.\n');

  // 4. Test Customer Authentication Token for live HTTP requests
  const customerToken = signCustomerToken({
    id: 'cust_test_consist_01',
    customerId: 'cust_test_consist_01',
    mobile: '9876543210',
    name: 'Priya Sharma',
  });

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${customerToken}`,
  };

  // Helper function to verify response has exact 9 buttons and no forbidden buttons
  function verifyButtonsInResponse(resData: any, queryName: string) {
    const replies: string[] = resData.quickReplies || [];
    console.log(`  -> Response intent: ${resData.intent}`);
    console.log(`  -> Quick replies count: ${replies.length}`);
    console.log(`  -> Quick replies: ${JSON.stringify(replies)}`);

    if (replies.length !== 9) {
      throw new Error(`[${queryName}] Expected 9 buttons, but received ${replies.length}: ${JSON.stringify(replies)}`);
    }

    for (let i = 0; i < EXPECTED_9_BUTTONS.length; i++) {
      if (replies[i] !== EXPECTED_9_BUTTONS[i]) {
        throw new Error(`[${queryName}] Button at index ${i} is "${replies[i]}", expected "${EXPECTED_9_BUTTONS[i]}"!`);
      }
    }

    for (const oldBtn of FORBIDDEN_OLD_BUTTONS) {
      if (replies.includes(oldBtn)) {
        throw new Error(`[${queryName}] Forbidden old button "${oldBtn}" appeared in quick replies!`);
      }
    }

    if (replies[replies.length - 1] !== 'View Cart') {
      throw new Error(`[${queryName}] Final button must be "View Cart", got "${replies[replies.length - 1]}"!`);
    }

    console.log(`  ✓ PASSED: All 9 buttons appear in exact order after "${queryName}"\n`);
  }

  // 5. Test Multiple Consecutive Customer Questions
  console.log('[Test 4] Testing Multiple Consecutive Customer Questions via Assistant API:');

  const consecutiveQueries = [
    { name: 'Welcome / Initial query', body: { message: 'Hello assistant!' } },
    { name: 'Product search (Tomatoes)', body: { message: 'Search for tomatoes' } },
    { name: 'Product search (Milk)', body: { message: 'Show milk' } },
    { name: 'Category: Produce & Fruit', body: { message: 'Produce & Fruit', intent: 'SHOW_CATEGORY', category: 'produce', categoryLabel: 'Produce & Fruit' } },
    { name: 'Category: Dairy & Eggs', body: { message: 'Dairy & Eggs', intent: 'SHOW_CATEGORY', category: 'dairy', categoryLabel: 'Dairy & Eggs' } },
    { name: 'Category: Bakery', body: { message: 'Bakery', intent: 'SHOW_CATEGORY', category: 'bakery', categoryLabel: 'Bakery' } },
    { name: 'Category: Beverages', body: { message: 'Beverages', intent: 'SHOW_CATEGORY', category: 'beverages', categoryLabel: 'Beverages' } },
    { name: 'Category: Snacks', body: { message: 'Snacks', intent: 'SHOW_CATEGORY', category: 'snacks', categoryLabel: 'Snacks' } },
    { name: 'Category: Rice & Grains', body: { message: 'Rice & Grains', intent: 'SHOW_CATEGORY', category: 'grains', categoryLabel: 'Rice & Grains' } },
    { name: 'Category: Pantry', body: { message: 'Pantry', intent: 'SHOW_CATEGORY', category: 'pantry', categoryLabel: 'Pantry' } },
    { name: 'Show All Products action', body: { message: 'Show All Products', intent: 'SHOW_ALL_PRODUCTS' } },
    { name: 'Show More batch', body: { message: 'Show more products', intent: 'SHOW_MORE', offset: 0, batchSize: 15 } },
    { name: 'View Cart query', body: { message: 'View my cart' } },
    { name: 'Calculate cart total', body: { message: 'Calculate my cart total' } },
    { name: 'Grocery list recommendation under ₹500', body: { message: 'Prepare grocery list under ₹500' } },
    { name: 'Deals & coupons question', body: { message: 'Show available coupons' } },
    { name: 'General query', body: { message: 'How do you operate and what are store hours?' } },
  ];

  for (let idx = 0; idx < consecutiveQueries.length; idx++) {
    const q = consecutiveQueries[idx];
    console.log(`[Step 4.${idx + 1}] Sending: "${q.name}"...`);
    const res = await fetch(`${BASE_URL}/api/assistant/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(q.body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed request for "${q.name}" (Status ${res.status}): ${errText}`);
    }

    const data = await res.json();
    verifyButtonsInResponse(data, q.name);

    // Verify category products filtering
    if (q.body.intent === 'SHOW_CATEGORY') {
      const products = data.products || [];
      console.log(`  -> Found ${products.length} products for category "${q.body.categoryLabel}"`);
      if (products.length === 0) {
        throw new Error(`Category "${q.body.categoryLabel}" returned 0 products!`);
      }
      for (const p of products) {
        console.log(`     • ${p.title} (₹${p.price}, cat: ${p.category})`);
      }
      console.log(`  ✓ Category filtering verified successfully.\n`);
    }

    // Verify Show All Products returns all products
    if (q.body.intent === 'SHOW_ALL_PRODUCTS') {
      const products = data.products || [];
      console.log(`  -> Total products in catalogue: ${products.length}`);
      if (products.length < 14) {
        throw new Error(`Show All Products returned only ${products.length} products!`);
      }
      console.log(`  ✓ Show All Products verified successfully (${products.length} products).\n`);
    }
  }

  console.log('========================================================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100%)');
  console.log('========================================================================');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
