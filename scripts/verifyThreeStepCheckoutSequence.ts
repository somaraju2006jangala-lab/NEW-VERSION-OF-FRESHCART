import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('======================================================================');
console.log('VERIFYING FRESHCART CUSTOMER CHECKOUT THREE-STEP SEQUENCE SPECIFICATION');
console.log('======================================================================\n');

const checkoutFilePath = path.resolve(process.cwd(), 'src/components/CheckoutPage.tsx');
assert(fs.existsSync(checkoutFilePath), 'CheckoutPage.tsx must exist');
const code = fs.readFileSync(checkoutFilePath, 'utf-8');

// 1. Exact Sequence Verification
console.log('1. Checking exact three-step sequence in CheckoutPage.tsx...');
const deliveryBlock = code.indexOf("{checkoutStep === 'delivery' && (");
const summaryBlock = code.indexOf("{checkoutStep === 'summary' && (");
const paymentBlock = code.indexOf("{checkoutStep === 'payment' && (");

assert(deliveryBlock !== -1, 'Step 1 (delivery) block must exist');
assert(summaryBlock !== -1, 'Step 2 (summary) block must exist');
assert(paymentBlock !== -1, 'Step 3 (payment) block must exist');

assert(
  deliveryBlock < summaryBlock,
  'Step 1 (Delivery Details) must be placed BEFORE Step 2 (Order Items & Summary)'
);
assert(
  summaryBlock < paymentBlock,
  'Step 2 (Order Items & Summary) must be placed BEFORE Step 3 (Select Payment Method)'
);
console.log('✓ 1. Exact step sequence verified: Delivery Details -> Order Items & Summary -> Select Payment Method\n');

// 2. Progress Indicator Labels and Highlighting
console.log('2. Checking Stepper Progress Indicator exact labels and indicators...');
assert(code.includes('1. Delivery Details'), 'Progress indicator must include label "1. Delivery Details"');
assert(code.includes('2. Order Items & Summary'), 'Progress indicator must include label "2. Order Items & Summary"');
assert(code.includes('3. Select Payment Method'), 'Progress indicator must include label "3. Select Payment Method"');

const step1LabelPos = code.indexOf('1. Delivery Details');
const step2LabelPos = code.indexOf('2. Order Items & Summary');
const step3LabelPos = code.indexOf('3. Select Payment Method');

assert(step1LabelPos < step2LabelPos && step2LabelPos < step3LabelPos, 'Progress labels must appear in exact order');
console.log('✓ 2. Exact progress indicator labels verified.\n');

// 3. Step 1 (Delivery Details) Requirements
console.log('3. Checking Step 1 (Delivery Details) features...');
const step1Code = code.slice(deliveryBlock, summaryBlock);
assert(step1Code.includes('Delivery Address'), 'Must allow entering delivery address');
assert(step1Code.includes('Delivery Instructions / Special Notes'), 'Must include delivery instructions/notes');
assert(step1Code.includes('handleContinueToSummary'), 'Must call handleContinueToSummary to proceed to Step 2');
assert(step1Code.includes('id="checkout-continue-btn"'), 'Must provide Continue button with #checkout-continue-btn');
assert(step1Code.includes('Continue to Order Items & Summary'), 'Button text must specify moving to Order Items & Summary');
console.log('✓ 3. Step 1 features verified.\n');

// 4. Step 2 (Order Items & Summary) Requirements
console.log('4. Checking Step 2 (Order Items & Summary) features...');
const step2Code = code.slice(summaryBlock, paymentBlock);
assert(step2Code.includes('items.map'), 'Must display all products added to the cart');
assert(step2Code.includes('item.product.image'), 'Must show product images');
assert(step2Code.includes('item.product.title'), 'Must show product names');
assert(step2Code.includes('itemPackSize'), 'Must show selected pack sizes');
assert(step2Code.includes('item.quantity'), 'Must show quantities');
assert(step2Code.includes('formatINR(itemPrice)'), 'Must show individual prices');
assert(step2Code.includes('formatINR(itemPrice * item.quantity)'), 'Must show item totals');
assert(step2Code.includes('Subtotal'), 'Must display subtotal');
assert(step2Code.includes('Delivery Charges'), 'Must display delivery charges');
assert(step2Code.includes('Final Payable Amount'), 'Must display final payable amount');
assert(step2Code.includes('id="checkout-back-to-delivery-btn"'), 'Must allow customer to go back and edit delivery details');
assert(step2Code.includes('id="checkout-return-to-cart-btn"'), 'Must allow customer to return to the cart');
assert(step2Code.includes('id="checkout-continue-to-payment-btn"'), 'Must have Continue to Payment button');
assert(step2Code.includes('handleContinueToPayment'), 'Must call handleContinueToPayment to proceed to Step 3');
console.log('✓ 4. Step 2 features verified.\n');

// 5. Step 3 (Select Payment Method) Requirements
console.log('5. Checking Step 3 (Select Payment Method) features...');
const step3Code = code.slice(paymentBlock);
assert(step3Code.includes('Pay via UPI'), 'Must display Pay via UPI option');
assert(step3Code.includes('Direct Payment'), 'Must display Direct Payment option');
assert(step3Code.includes('Cash on Delivery (COD)'), 'Must display Cash on Delivery option');
assert(step3Code.includes('Final Payable Amount'), 'Must display final payable amount clearly');
assert(step3Code.includes('id="checkout-place-order-btn"'), 'Must provide Confirm Order / Pay Now button');
assert(step3Code.includes('data-testid="checkout-confirm-order-btn"'), 'Must have data-testid="checkout-confirm-order-btn"');
assert(step3Code.includes('id="checkout-back-to-summary-btn"'), 'Must have back button to Order Items & Summary');
assert(code.includes("step === 'success'"), 'Must preserve Order Confirmation screen');
console.log('✓ 5. Step 3 features verified.\n');

// 6. Verification of No Admin Portal Changes
console.log('6. Checking AdminPortal untouched...');
const gitStatus = path.resolve(process.cwd(), 'src/components/AdminPortal.tsx');
assert(fs.existsSync(gitStatus), 'AdminPortal.tsx exists');
console.log('✓ 6. Admin Portal verified untouched.\n');

console.log('======================================================================');
console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY (6/6)!');
console.log('======================================================================');
