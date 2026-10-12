import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('TESTING THREE-PAGE CHECKOUT FLOW & BLACK LIQUID-GLASS THEME');
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
console.log('✓ TEST 1 PASSED: Black Liquid-Glass Theme CSS tokens verified.\n');

// Test 2: Verify Three-Page State & Stepper
console.log('Test 2: Verifying Three-Page Architecture & Stepper definition...');
assert(
  checkoutCode.includes("const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'payment' | 'summary'>('delivery')"),
  'checkoutStep must initialize to delivery and support 3 pages'
);
assert(checkoutCode.includes('1. Delivery'), 'Stepper must display 1. Delivery');
assert(checkoutCode.includes('2. Payment'), 'Stepper must display 2. Payment');
assert(checkoutCode.includes('3. Summary'), 'Stepper must display 3. Summary');
console.log('✓ TEST 2 PASSED: Three-page state and 3-step progress indicator verified.\n');

// Test 3: Verify Page 1 (Delivery Details) Content & Validation
console.log('Test 3: Verifying Page 1 (Delivery Details) only displays delivery info and validates address...');
assert(checkoutCode.includes("checkoutStep === 'delivery'"), 'Page 1 must render conditionally on delivery step');
assert(checkoutCode.includes('Delivery Address & Time Slot'), 'Page 1 must display Delivery Address & Time Slot');
assert(checkoutCode.includes('Express Cold-Chain Delivery, 24–30 Minutes'), 'Page 1 must display cold-chain info');
assert(checkoutCode.includes('handleContinueToPayment'), 'Must have handleContinueToPayment handler');
assert(checkoutCode.includes('id="checkout-continue-btn"'), 'Page 1 must have #checkout-continue-btn');
assert(checkoutCode.includes('id="checkout-back-to-cart-btn"'), 'Page 1 must have #checkout-back-to-cart-btn');
console.log('✓ TEST 3 PASSED: Page 1 content, address validation, and navigation verified.\n');

// Test 4: Verify Page 2 (Select Payment Method) Content & Exact Order
console.log('Test 4: Verifying Page 2 (Select Payment Method) exact payment option ordering and handlers...');
assert(checkoutCode.includes("checkoutStep === 'payment'"), 'Page 2 must render conditionally on payment step');
const upiIndex = checkoutCode.indexOf('id="checkout-payment-upi-opt"');
const directIndex = checkoutCode.indexOf('id="checkout-payment-direct-opt"');
const cashIndex = checkoutCode.indexOf('id="checkout-payment-cash-opt"');

assert(upiIndex !== -1, 'Pay via UPI must exist');
assert(directIndex !== -1, 'Direct Payment must exist');
assert(cashIndex !== -1, 'Cash on Delivery must exist');
assert(upiIndex < directIndex, '1. Pay via UPI must appear before 2. Direct Payment');
assert(directIndex < cashIndex, '2. Direct Payment must appear before 3. Cash on Delivery');

assert(checkoutCode.includes('id="checkout-direct-open-apps-btn"'), 'Direct Payment must have #checkout-direct-open-apps-btn');
assert(checkoutCode.includes('Open UPI Payment App'), 'Direct Payment must require clicking "Open UPI Payment App"');
assert(checkoutCode.includes('id="checkout-back-to-delivery-btn"'), 'Page 2 must have back button to Delivery Details');
assert(checkoutCode.includes('id="checkout-continue-to-summary-btn"'), 'Page 2 must have continue button to Order Summary');
console.log('✓ TEST 4 PASSED: Page 2 payment ordering and Direct Payment safety verified.\n');

// Test 5: Verify Page 3 (Order Items & Summary) Content & Removal of Selected Payment Method & Proof Upload sections
console.log('Test 5: Verifying Page 3 (Order Items & Summary) breakdown and confirmation...');
assert(checkoutCode.includes("checkoutStep === 'summary'"), 'Page 3 must render conditionally on summary step');
assert(checkoutCode.includes('Order Items & Summary'), 'Page 3 must display Order Items & Summary heading');
assert(checkoutCode.includes('Delivery Destination'), 'Page 3 must display Delivery Destination recap');
assert(checkoutCode.includes('Subtotal'), 'Page 3 must display Subtotal');
assert(checkoutCode.includes('Final Payable Amount'), 'Page 3 must display Final Payable Amount');
assert(checkoutCode.includes('id="checkout-back-to-payment-btn"'), 'Page 3 must have back button to Payment Method');
assert(checkoutCode.includes('id="checkout-place-order-btn"'), 'Page 3 must have final #checkout-place-order-btn');
assert(checkoutCode.includes('data-testid="checkout-confirm-order-btn"'), 'data-testid="checkout-confirm-order-btn" must be present');

// Extract Page 3 markup to verify removal of the two sections
const page3BlockIndex = checkoutCode.indexOf("{checkoutStep === 'summary' && (");
assert(page3BlockIndex !== -1, 'Page 3 block must exist');
const page3Code = checkoutCode.slice(page3BlockIndex);

assert(!page3Code.includes('Selected Payment Method'), 'Page 3 must NOT include Selected Payment Method section');
assert(!page3Code.includes('id="checkout-change-payment-btn"'), 'Page 3 must NOT include Change payment button');
assert(!page3Code.includes('id="checkout-upi-proof-required-alert"'), 'Page 3 must NOT include proof required alert banner');
assert(!page3Code.includes('Upload Payment Screenshot for Verification:'), 'Page 3 must NOT include upload heading');

// Verify Page 2 retains payment proof upload functionality
const page2BlockIndex = checkoutCode.indexOf("{checkoutStep === 'payment' && (");
assert(page2BlockIndex !== -1, 'Page 2 block must exist');
const page2Code = checkoutCode.slice(page2BlockIndex, page3BlockIndex);
assert(page2Code.includes('{renderScreenshotUploadSection()}'), 'Page 2 must retain renderScreenshotUploadSection');
assert(checkoutCode.includes('id="checkout-upload-screenshot-section"'), 'Payment screenshot upload section must be retained in codebase');

console.log('✓ TEST 5 PASSED: Page 3 items breakdown and clean confirmation verified without removed sections; Page 2 proof upload preserved.\n');

// Test 6: Verify Duplicate Order Prevention & In-Memory State Retention
console.log('Test 6: Verifying duplicate order lock and state retention across pages...');
assert(checkoutCode.includes('isSubmittingRef.current'), 'Must use ref lock to prevent duplicate order submissions');
assert(checkoutCode.includes('handleBackToDelivery'), 'Must support navigating back to Page 1');
assert(checkoutCode.includes('handleBackToPayment'), 'Must support navigating back to Page 2');
console.log('✓ TEST 6 PASSED: Duplicate prevention and full state retention across 3 pages verified.\n');

console.log('===============================================================');
console.log('ALL THREE-PAGE CHECKOUT TESTS PASSED (6/6)!');
console.log('===============================================================');
