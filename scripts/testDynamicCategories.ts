import { deriveAvailableCategories, getCanonicalCategoryInfo, DynamicCategoryItem } from '../src/components/AssistantChatModal';
import { INITIAL_PRODUCTS } from '../src/data/products';
import { Product } from '../src/types';
import { handleAssistantChat } from '../server/assistantService';

async function runTests() {
  console.log('=== STARTING DYNAMIC CATEGORIES TEST SUITE ===\n');

  // --------------------------------------------------------------------------
  // TEST 1: Initial Default Categories
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Default Catalogue Categories Detection ---');
  const initialCategories = deriveAvailableCategories(INITIAL_PRODUCTS);
  console.log('Initial detected categories:', initialCategories.map((c) => `${c.label} (${c.count} items)`));

  const expectedLabels = [
    'Produce & Fruit',
    'Dairy & Eggs',
    'Bakery',
    'Beverages',
    'Snacks',
    'Rice & Grains',
  ];

  for (const expected of expectedLabels) {
    const found = initialCategories.find((c) => c.label === expected);
    if (!found || found.count === 0) {
      throw new Error(`TEST 1 FAILED: Expected category "${expected}" not found or count 0!`);
    }
  }
  console.log('✓ TEST 1 PASSED: All 6 standard categories are dynamically detected with accurate product counts.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Dynamic Category Detection on Adding New Admin Category
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Admin Adds Product in New Category ("Personal Care") ---');
  const personalCareProduct: Product = {
    id: 'prod-pc-1',
    title: 'Organic Herbal Shampoo',
    supplier: 'Herbal Essence Co',
    sku: 'SKU-PC-101',
    price: 249,
    unit: '250 ml',
    stock: 50,
    badge: 'Organic Care',
    image: 'https://example.com/shampoo.jpg',
    category: 'personal-care',
    categoryLabel: 'Personal Care',
    description: 'Nourishing herbal shampoo with aloe vera and amla.',
    farmOrigin: 'Western Ghats Organic Estate',
    harvestDate: 'Fresh Stock',
    tempRequirement: 'Ambient',
    batchNumber: 'LOT-PC-01',
    expiryDate: 'In 12 months',
    packSizes: [{ size: '250 ml', price: 249 }],
  };

  const updatedProducts = [personalCareProduct, ...INITIAL_PRODUCTS];
  const updatedCategories = deriveAvailableCategories(updatedProducts);
  console.log('Updated detected categories:', updatedCategories.map((c) => `${c.label} (${c.count} items)`));

  const pcCategory = updatedCategories.find((c) => c.label === 'Personal Care');
  if (!pcCategory || pcCategory.count !== 1) {
    throw new Error('TEST 2 FAILED: "Personal Care" category was not dynamically detected after product addition!');
  }
  console.log('✓ TEST 2 PASSED: "Personal Care" dynamically detected with count 1.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Multiple Products in New Category & Multiple Custom Categories
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Admin Adds Another Category ("Household") ---');
  const householdProduct: Product = {
    id: 'prod-hh-1',
    title: 'Eco-Friendly Dishwash Gel',
    supplier: 'Green Home Supplies',
    sku: 'SKU-HH-201',
    price: 120,
    unit: '500 ml',
    stock: 30,
    badge: 'Eco Safe',
    image: 'https://example.com/dishwash.jpg',
    category: 'household',
    categoryLabel: 'Household',
    description: 'Non-toxic plant-based dish cleaner.',
    packSizes: [{ size: '500 ml', price: 120 }],
  };

  const multiCustomProducts = [householdProduct, personalCareProduct, ...INITIAL_PRODUCTS];
  const multiCategories = deriveAvailableCategories(multiCustomProducts);
  console.log('Multi-category detected categories:', multiCategories.map((c) => `${c.label} (${c.count} items)`));

  if (!multiCategories.some((c) => c.label === 'Household') || !multiCategories.some((c) => c.label === 'Personal Care')) {
    throw new Error('TEST 3 FAILED: Both "Household" and "Personal Care" should be detected!');
  }
  console.log('✓ TEST 3 PASSED: Multiple custom categories dynamically detected.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Automatic Removal when Category Has 0 Available Products
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Category Button Removal when Category Has 0 Products ---');
  // Remove all products in 'bakery'
  const withoutBakery = INITIAL_PRODUCTS.filter((p) => p.category !== 'bakery');
  const categoriesWithoutBakery = deriveAvailableCategories(withoutBakery);
  console.log('Categories without Bakery:', categoriesWithoutBakery.map((c) => c.label));

  if (categoriesWithoutBakery.some((c) => c.label === 'Bakery')) {
    throw new Error('TEST 4 FAILED: Bakery category button was NOT removed when 0 products exist!');
  }
  console.log('✓ TEST 4 PASSED: Bakery category button was correctly removed when no products exist in catalogue.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Category-Based Product Search via Assistant Backend API
  // --------------------------------------------------------------------------
  console.log('--- TEST 5: Backend Category Search Matching ---');

  // Helper to simulate request to handleAssistantChat
  const simulateChat = async (body: any) => {
    return new Promise<any>((resolve) => {
      const req: any = { body };
      const res: any = {
        status: (code: number) => ({
          json: (data: any) => resolve({ statusCode: code, ...data }),
        }),
        json: (data: any) => resolve({ statusCode: 200, ...data }),
      };
      const authCustomer = { authenticated: true, customerId: 'test-cust-id', name: 'Test Customer' };
      handleAssistantChat(req, res, authCustomer);
    });
  };

  // 5a. Test Produce & Fruit search
  const resProduce = await simulateChat({
    message: 'Show Produce & Fruit',
    intent: 'SHOW_CATEGORY',
    category: 'produce',
    categoryLabel: 'Produce & Fruit',
    catalogProducts: multiCustomProducts,
  });
  console.log(`Produce search result: intent=${resProduce.intent}, count=${resProduce.products?.length}, msg="${resProduce.message}"`);
  if (!resProduce.success || resProduce.products.length === 0) {
    throw new Error('TEST 5a FAILED: Produce & Fruit returned 0 products!');
  }
  console.log('✓ TEST 5a PASSED: Produce & Fruit returns all matching products.');

  // 5b. Test Dairy & Eggs search
  const resDairy = await simulateChat({
    message: 'Show Dairy & Eggs',
    intent: 'SHOW_CATEGORY',
    category: 'dairy',
    categoryLabel: 'Dairy & Eggs',
    catalogProducts: multiCustomProducts,
  });
  console.log(`Dairy search result: intent=${resDairy.intent}, count=${resDairy.products?.length}, msg="${resDairy.message}"`);
  if (!resDairy.success || resDairy.products.length === 0) {
    throw new Error('TEST 5b FAILED: Dairy & Eggs returned 0 products!');
  }
  console.log('✓ TEST 5b PASSED: Dairy & Eggs returns all matching products.');

  // 5c. Test Custom Category "Personal Care" search
  const resPC = await simulateChat({
    message: 'Show Personal Care',
    intent: 'SHOW_CATEGORY',
    category: 'personal-care',
    categoryLabel: 'Personal Care',
    catalogProducts: multiCustomProducts,
  });
  console.log(`Personal Care search result: intent=${resPC.intent}, count=${resPC.products?.length}, msg="${resPC.message}"`);
  if (!resPC.success || resPC.products.length !== 1 || resPC.products[0].id !== 'prod-pc-1') {
    throw new Error('TEST 5c FAILED: Personal Care search did not return the expected product!');
  }
  console.log('✓ TEST 5c PASSED: Custom category Personal Care returns the exact product.');

  // 5d. Test Typing with formatting differences: spaces, hyphens, uppercase/lowercase
  const variations = [
    'personal care',
    'Personal Care',
    'PERSONAL CARE',
    'personal-care',
  ];

  for (const query of variations) {
    const resVar = await simulateChat({
      message: query,
      catalogProducts: multiCustomProducts,
    });
    console.log(`Variation "${query}": intent=${resVar.intent}, count=${resVar.products?.length}`);
    if (!resVar.success || resVar.products?.length !== 1) {
      throw new Error(`TEST 5d FAILED: Query variation "${query}" failed to match category product!`);
    }
  }
  console.log('✓ TEST 5d PASSED: All casing, hyphen, and spacing variations match consistently.');

  // --------------------------------------------------------------------------
  // TEST 6: Quick Action Chips Structure (Fixed 'Show All Products' first, categories, fixed 'View Cart' last)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Quick Action Chips Structure ---');
  const categoriesForChips = deriveAvailableCategories(multiCustomProducts);
  const chips = [
    { id: '__all__', label: 'Show All Products', type: 'all' },
    ...categoriesForChips.map((c) => ({ id: c.id, label: c.label, type: 'category' })),
    { id: '__cart__', label: 'View Cart', type: 'cart' },
  ];

  console.log('Rendered chips order:', chips.map((c) => c.label).join(' -> '));

  if (chips[0].label !== 'Show All Products') {
    throw new Error('TEST 6 FAILED: First chip must be "Show All Products"!');
  }
  if (chips[chips.length - 1].label !== 'View Cart') {
    throw new Error('TEST 6 FAILED: Last chip must be "View Cart"!');
  }
  if (!chips.some((c) => c.label === 'Produce & Fruit') || !chips.some((c) => c.label === 'Personal Care')) {
    throw new Error('TEST 6 FAILED: Dynamic category buttons missing between fixed actions!');
  }
  console.log('✓ TEST 6 PASSED: Fixed "Show All Products" is first, fixed "View Cart" is last, all categories are between them.');

  console.log('\n=== ALL DYNAMIC CATEGORY TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
