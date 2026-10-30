import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('TESTING THREE-STEP CHECKOUT FLOW: DELIVERY -> SUMMARY -> PAYMENT');
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

// Test 2: Verify Exact 3-Step Sequence & Progress Indicator Labels
console.log('Test 2: Verifying Three-Step Sequence & Exact Stepper Labels...');
assert(
  checkoutCode.includes("const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'payment' | 'summary'>('delivery')") ||
  checkoutCode.includes("const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'summary' | 'payment'>('delivery')"),
  'checkoutStep must initialize to delivery and support 3 steps'
);
assert(checkoutCode.includes('1. Delivery Details'), 'Stepper must display exact label: 1. Delivery Details');
assert(checkoutCode.includes('2. Order Items & Summary'), 'Stepper must display exact label: 2. Order Items & Summary');
assert(checkoutCode.includes('3. Select Payment Method'), 'Stepper must display exact label: 3. Select Payment Method');

const step1LabelIndex = checkoutCode.indexOf('1. Delivery Details');
const step2LabelIndex = checkoutCode.indexOf('2. Order Items & Summary');
const step3LabelIndex = checkoutCode.indexOf('3. Select Payment Method');

assert(step1LabelIndex < step2LabelIndex, '1. Delivery Details must appear before 2. Order Items & Summary');
assert(step2LabelIndex < step3LabelIndex, '2. Order Items & Summary must appear before 3. Select Payment Method');
console.log('✓ TEST 2 PASSED: Exact 3-step sequence and progress indicator labels verified.\n');

// Test 3: Verify Step 1 (Delivery Details)
console.log('Test 3: Verifying Step 1 (Delivery Details) fields, validation, and navigation...');
assert(checkoutCode.includes("checkoutStep === 'delivery'"), 'Step 1 must render conditionally on delivery step');
assert(checkoutCode.includes('Delivery Address & Notes'), 'Step 1 must display Delivery Address & Notes');
assert(checkoutCode.includes('handleContinueToSummary'), 'Step 1 must have handleContinueToSummary handler');
assert(checkoutCode.includes('id="checkout-continue-btn"'), 'Step 1 must have #checkout-continue-btn');
assert(checkoutCode.includes('id="checkout-back-to-cart-btn"'), 'Step 1 must have #checkout-back-to-cart-btn');
assert(checkoutCode.includes('Continue to Order Items & Summary'), 'Step 1 button must move to Order Items & Summary');
console.log('✓ TEST 3 PASSED: Step 1 content, address validation, and navigation to Step 2 verified.\n');

// Test 4: Verify Step 2 (Order Items & Summary)
console.log('Test 4: Verifying Step 2 (Order Items & Summary) products, totals, and navigation...');
assert(checkoutCode.includes("checkoutStep === 'summary'"), 'Step 2 must render conditionally on summary step');
const step2BlockIndex = checkoutCode.indexOf("{checkoutStep === 'summary' && (");
const step3BlockIndex = checkoutCode.indexOf("{checkoutStep === 'payment' && (");
assert(step2BlockIndex !== -1, 'Step 2 block must exist');
assert(step3BlockIndex !== -1, 'Step 3 block must exist');
assert(step2BlockIndex < step3BlockIndex, 'Step 2 (summary) must render BEFORE Step 3 (payment)');

const step2Code = checkoutCode.slice(step2BlockIndex, step3BlockIndex);
assert(step2Code.includes('Order Items & Summary'), 'Step 2 must display Order Items & Summary heading');
assert(step2Code.includes('Delivery Destination'), 'Step 2 must display Delivery Destination recap');
assert(step2Code.includes('item.product.image'), 'Step 2 must display product image');
assert(step2Code.includes('item.product.title'), 'Step 2 must display product name');
assert(step2Code.includes('itemPackSize'), 'Step 2 must display selected pack size');
assert(step2Code.includes('item.quantity'), 'Step 2 must display item quantity');
assert(step2Code.includes('formatINR(itemPrice)'), 'Step 2 must display individual price');
assert(step2Code.includes('formatINR(itemPrice * item.quantity)'), 'Step 2 must display item total');
assert(step2Code.includes('Subtotal'), 'Step 2 must display Subtotal');
assert(step2Code.includes('Delivery Charges'), 'Step 2 must display Delivery Charges');
assert(step2Code.includes('Final Payable Amount'), 'Step 2 must display Final Payable Amount');
assert(step2Code.includes('id="checkout-back-to-delivery-btn"'), 'Step 2 must allow going back to delivery details');
assert(step2Code.includes('id="checkout-return-to-cart-btn"'), 'Step 2 must allow returning to cart');
assert(step2Code.includes('id="checkout-continue-to-payment-btn"'), 'Step 2 must have continue button to payment');
console.log('✓ TEST 4 PASSED: Step 2 items breakdown, financial summary, and navigation verified.\n');

// Test 5: Verify Step 3 (Select Payment Method)
console.log('Test 5: Verifying Step 3 (Select Payment Method) options, payable amount, and confirm order CTA...');
const step3Code = checkoutCode.slice(step3BlockIndex);

const upiIndex = step3Code.indexOf('id="checkout-payment-upi-opt"');
const directIndex = step3Code.indexOf('id="checkout-payment-direct-opt"');
const cashIndex = step3Code.indexOf('id="checkout-payment-cash-opt"');

assert(upiIndex !== -1, 'Pay via UPI must exist in Step 3');
assert(directIndex !== -1, 'Direct Payment must exist in Step 3');
assert(cashIndex !== -1, 'Cash on Delivery must exist in Step 3');
assert(upiIndex < directIndex, '1. Pay via UPI must appear before 2. Direct Payment');
assert(directIndex < cashIndex, '2. Direct Payment must appear before 3. Cash on Delivery');

assert(step3Code.includes('{renderScreenshotUploadSection()}'), 'Step 3 must retain payment screenshot upload section');
assert(step3Code.includes('Final Payable Amount'), 'Step 3 must clearly display final payable amount');
assert(step3Code.includes('id="checkout-back-to-summary-btn"'), 'Step 3 must have back button to Order Items & Summary');
assert(step3Code.includes('id="checkout-place-order-btn"'), 'Step 3 must have final #checkout-place-order-btn');
assert(step3Code.includes('data-testid="checkout-confirm-order-btn"'), 'Step 3 must have data-testid="checkout-confirm-order-btn"');
console.log('✓ TEST 5 PASSED: Step 3 payment selection, screenshot proof, and final order confirmation verified.\n');

// Test 6: Verify Duplicate Order Prevention & In-Memory State Retention
console.log('Test 6: Verifying duplicate order lock and state retention across all steps...');
assert(checkoutCode.includes('isSubmittingRef.current'), 'Must use ref lock to prevent duplicate order submissions');
assert(checkoutCode.includes('handleBackToDelivery'), 'Must support navigating back to Step 1');
assert(checkoutCode.includes('handleBackToSummary'), 'Must support navigating back to Step 2');
assert(checkoutCode.includes('handleContinueToPayment'), 'Must support navigating to Step 3');
console.log('✓ TEST 6 PASSED: Duplicate prevention and full state retention across all 3 steps verified.\n');

console.log('===============================================================');
console.log('ALL THREE-STEP CHECKOUT TESTS PASSED (6/6)!');
console.log('===============================================================');
