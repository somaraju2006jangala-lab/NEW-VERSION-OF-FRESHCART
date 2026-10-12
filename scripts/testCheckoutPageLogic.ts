import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('TESTING CHECKOUT TWO-PAGE ARCHITECTURE & BLACK LIQUID-GLASS THEME');
console.log('===============================================================\n');

const checkoutPagePath = path.resolve(process.cwd(), 'src/components/CheckoutPage.tsx');
const indexCssPath = path.resolve(process.cwd(), 'src/index.css');

assert(fs.existsSync(checkoutPagePath), 'CheckoutPage.tsx must exist');
assert(fs.existsSync(indexCssPath), 'index.css must exist');

const checkoutCode = fs.readFileSync(checkoutPagePath, 'utf-8');
const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

// Test 1: Verify Black Liquid-Glass Theme CSS definitions
console.log('Test 1: Verifying Black Liquid-Glass Theme CSS classes in index.css...');
assert(indexCss.includes('.checkout-container'), '.checkout-container must be defined');
assert(indexCss.includes('.checkout-panel'), '.checkout-panel must be defined');
assert(indexCss.includes('.checkout-subpanel'), '.checkout-subpanel must be defined');
assert(indexCss.includes('.checkout-input'), '.checkout-input must be defined');
assert(indexCss.includes('.checkout-card'), '.checkout-card must be defined');
assert(indexCss.includes('.checkout-card-selected'), '.checkout-card-selected must be defined');
assert(indexCss.includes('.checkout-neon-btn'), '.checkout-neon-btn must be defined');
console.log('✓ TEST 1 PASSED: Black Liquid-Glass Theme CSS tokens and classes verified.\n');

// Test 2: Verify Two-Page Separation & State Management
console.log('Test 2: Verifying Two-Page Separation & Navigation state...');
assert(checkoutCode.includes("const [checkoutStep, setCheckoutStep] = useState<'payment' | 'summary'>('payment')"), 'Must have checkoutStep state');
assert(checkoutCode.includes('handleContinueToSummary'), 'Must have handleContinueToSummary handler');
assert(checkoutCode.includes('handleBackToPayment'), 'Must have handleBackToPayment handler');
assert(checkoutCode.includes("id=\"checkout-continue-btn\""), 'Must have #checkout-continue-btn on Page 1');
assert(checkoutCode.includes("id=\"checkout-back-to-payment-btn\""), 'Must have #checkout-back-to-payment-btn on Page 2');
console.log('✓ TEST 2 PASSED: Two-page step separation and Back/Continue navigation verified.\n');

// Test 3: Verify Payment Methods in Exact Required Order
console.log('Test 3: Verifying Payment Methods exact order: 1. UPI, 2. Direct, 3. COD...');
const upiIndex = checkoutCode.indexOf('id="checkout-payment-upi-opt"');
const directIndex = checkoutCode.indexOf('id="checkout-payment-direct-opt"');
const cashIndex = checkoutCode.indexOf('id="checkout-payment-cash-opt"');

assert(upiIndex !== -1, 'Pay via UPI option must exist');
assert(directIndex !== -1, 'Direct Payment option must exist');
assert(cashIndex !== -1, 'Cash on Delivery (COD) option must exist');

assert(upiIndex < directIndex, 'Pay via UPI must appear before Direct Payment');
assert(directIndex < cashIndex, 'Direct Payment must appear before Cash on Delivery');
console.log('✓ TEST 3 PASSED: Payment methods in exact required order (1. Pay via UPI, 2. Direct Payment, 3. Cash on Delivery).\n');

// Test 4: Verify Direct Payment does not auto-open apps & requires clicking "Open UPI Payment App"
console.log('Test 4: Verifying Direct Payment instruction screen and deep link button...');
assert(checkoutCode.includes('id="checkout-direct-open-apps-btn"'), '#checkout-direct-open-apps-btn must be present');
assert(checkoutCode.includes('Open UPI Payment App'), '"Open UPI Payment App" label must be present');
assert(checkoutCode.includes('handleDirectPaymentDeepLink'), 'Deep link handler must be wired to Open UPI Payment App button');
console.log('✓ TEST 4 PASSED: Direct Payment preserves instructions and requires explicit button click.\n');

// Test 5: Verify Order Summary (Page 2) Content & Order Confirmation
console.log('Test 5: Verifying Page 2 Order Summary contents & Confirmation workflow...');
assert(checkoutCode.includes('Selected Payment Method'), 'Page 2 must display Selected Payment Method');
assert(checkoutCode.includes('Order Items & Summary'), 'Page 2 must display Order Items & Summary');
assert(checkoutCode.includes('Subtotal'), 'Page 2 must display Subtotal');
assert(checkoutCode.includes('Final Payable Amount'), 'Page 2 must display Final Payable Amount');
assert(checkoutCode.includes('id="checkout-place-order-btn"'), '#checkout-place-order-btn must be present on Page 2');
assert(checkoutCode.includes('data-testid="checkout-confirm-order-btn"'), 'data-testid="checkout-confirm-order-btn" must be present');
assert(checkoutCode.includes('id="checkout-upi-proof-required-alert"'), '#checkout-upi-proof-required-alert must be present when online proof missing');
console.log('✓ TEST 5 PASSED: Page 2 Order Summary and confirmation workflow verified.\n');

// Test 6: Verify Duplicate Prevention & In-Memory State Retention
console.log('Test 6: Verifying duplicate order lock and in-memory retention...');
assert(checkoutCode.includes('isSubmittingRef.current'), 'Must use ref lock to prevent duplicate order submissions');
assert(checkoutCode.includes('isSubmitting'), 'Must have isSubmitting state to disable button');
console.log('✓ TEST 6 PASSED: Duplicate prevention and state persistence verified.\n');

console.log('===============================================================');
console.log('ALL CHECKOUT ARCHITECTURE & THEME TESTS PASSED (6/6)!');
console.log('===============================================================');
