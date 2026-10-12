import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { apiApp } from '../server/apiRouter.ts';
import { signCustomerToken } from '../server/jwtHelper.ts';
import {
  connectMySql,
  getPool,
  findOrderInDb,
  getPaymentRecordByOrderId,
} from '../server/db.ts';

// Helper to simulate express HTTP requests to apiApp
async function simulateRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  requestUrl: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = requestUrl.split('?');
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
      url: requestUrl,
      path: pathPart,
      query,
      headers: (() => {
        const h: Record<string, string> = { 'content-type': 'application/json' };
        for (const [k, v] of Object.entries(headers)) {
          h[k.toLowerCase()] = v;
        }
        return h;
      })(),
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
        resolve({ status: responseStatusCode, body: responseBody, headers: responseHeaders });
        return this;
      },
      send(data: any) {
        responseBody = data;
        resolve({ status: responseStatusCode, body: responseBody, headers: responseHeaders });
        return this;
      },
      end(data?: any) {
        if (data !== undefined && responseBody === null) responseBody = data;
        resolve({ status: responseStatusCode, body: responseBody, headers: responseHeaders });
      },
    };

    apiApp(req, res, (err: any) => {
      if (err) {
        resolve({ status: 500, body: { error: err.message }, headers: responseHeaders });
      } else {
        resolve({ status: responseStatusCode, body: responseBody, headers: responseHeaders });
      }
    });
  });
}

// 1x1 Transparent PNG in Base64 (valid magic bytes: 89 50 4E 47 0D 0A 1A 0A)
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Disguised non-image file
const INVALID_TEXT_FILE_BASE64 =
  'data:image/png;base64,' + Buffer.from('NOT_AN_IMAGE_FILE_JUST_PLAIN_TEXT').toString('base64');

async function runCheckoutPaymentProofTests() {
  console.log('===============================================================');
  console.log('TESTING UPI PAYMENT PROOF CHECKOUT FLOW & BACKEND ENFORCEMENT');
  console.log('===============================================================\n');

  await connectMySql();
  const pool = getPool();

  const testCustomerEmail = `proof_test_${Date.now()}@example.com`;
  const testCustomerPhone = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
  const regRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Suresh Raina',
    email: testCustomerEmail,
    phone: testCustomerPhone,
    password: 'Password@123',
  });
  assert.strictEqual(regRes.status, 201, 'Customer registration must succeed');
  const customerId = regRes.body.customer.id;
  const customerToken = regRes.body.token;
  const authHeaders = { Authorization: `Bearer ${customerToken}` };

  // --------------------------------------------------------------------------
  // TEST 1: UPI Checkout with NO Screenshot -> Confirm Order BLOCKED
  // --------------------------------------------------------------------------
  console.log('Test 1: Testing UPI Checkout with NO screenshot (Confirmation blocked)...');
  const orderNum1 = Math.floor(100000 + Math.random() * 900000);
  const upiOrderNoProofId = `#FC-${orderNum1}`;

  // Create initial order draft
  const draftRes1 = await simulateRequest('POST', '/api/orders', authHeaders, {
    id: upiOrderNoProofId,
    customerId,
    customerName: 'Suresh Raina',
    customerEmail: testCustomerEmail,
    customerPhone: testCustomerPhone,
    deliveryAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
    items: [{ product: { id: 'item-1', title: 'Farm Fresh Apples', price: 180, unit: '1 kg' }, quantity: 1 }],
    subtotal: 180,
    discount: 0,
    total: 220,
    status: 'Pending',
    paymentMethod: 'UPI',
    paymentStatus: 'INITIATED',
  });
  assert.strictEqual(draftRes1.status, 200, 'Draft order creation should succeed');

  // Attempt to confirm order WITHOUT submitting screenshot proof
  const confirmWithoutProofRes = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: upiOrderNoProofId,
    paymentMethod: 'UPI',
  });
  assert.strictEqual(
    confirmWithoutProofRes.status,
    400,
    `Expected 400 when confirming UPI order without screenshot proof, got: ${confirmWithoutProofRes.status}`
  );
  assert.ok(
    confirmWithoutProofRes.body.error?.toLowerCase().includes('proof') ||
    confirmWithoutProofRes.body.error?.toLowerCase().includes('screenshot'),
    'Error message must state that payment proof screenshot is required'
  );
  console.log('✓ TEST 1 PASSED: Order confirmation without screenshot was blocked with clear error.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Failed Upload (Invalid File & Oversized) -> Order Confirmation Stays Blocked
  // --------------------------------------------------------------------------
  console.log('Test 2: Testing Failed Screenshot Uploads...');
  
  // 2a: Invalid format (disguised text file)
  const failedUploadRes1 = await simulateRequest('POST', '/api/payments/screenshot/upload', authHeaders, {
    orderId: upiOrderNoProofId,
    screenshot: INVALID_TEXT_FILE_BASE64,
  });
  assert.strictEqual(failedUploadRes1.status, 400, 'Invalid file content must be rejected with 400');
  assert.strictEqual(failedUploadRes1.body.success, false);

  // 2b: Oversized file (>10MB)
  const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0);
  const oversizedBase64 = 'data:image/png;base64,' + oversizedBuffer.toString('base64');
  const failedUploadRes2 = await simulateRequest('POST', '/api/payments/screenshot/upload', authHeaders, {
    orderId: upiOrderNoProofId,
    screenshot: oversizedBase64,
  });
  assert.strictEqual(failedUploadRes2.status, 400, 'Oversized file must be rejected with 400');

  // Verify order confirmation is STILL blocked after upload failures
  const confirmAfterFailRes = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: upiOrderNoProofId,
    paymentMethod: 'UPI',
  });
  assert.strictEqual(confirmAfterFailRes.status, 400, 'Order confirmation must remain blocked after failed uploads');
  console.log('✓ TEST 2 PASSED: Invalid and oversized files failed upload; confirmation remained blocked.\n');

  // --------------------------------------------------------------------------
  // TEST 3: Successful Screenshot Submission -> Confirm Order SUCCEEDS
  // --------------------------------------------------------------------------
  console.log('Test 3: Testing Successful Screenshot Submission & Order Confirmation...');

  // Upload valid screenshot
  const validUploadRes = await simulateRequest('POST', '/api/payments/screenshot/upload', authHeaders, {
    orderId: upiOrderNoProofId,
    screenshot: VALID_PNG_BASE64,
  });
  assert.strictEqual(validUploadRes.status, 200, `Screenshot upload must succeed, got: ${JSON.stringify(validUploadRes.body)}`);
  assert.strictEqual(validUploadRes.body.success, true);
  assert.strictEqual(validUploadRes.body.paymentStatus, 'PENDING_VERIFICATION');
  assert.ok(validUploadRes.body.screenshotUrl, 'Screenshot URL must be returned');

  // Verify screenshot is accessible persistently
  const viewProofRes = await simulateRequest('GET', validUploadRes.body.screenshotUrl, authHeaders);
  assert.strictEqual(viewProofRes.status, 200, 'Uploaded screenshot must be persistently accessible');

  // Now confirm the order
  const confirmWithProofRes = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: upiOrderNoProofId,
    paymentMethod: 'UPI',
  });
  assert.strictEqual(confirmWithProofRes.status, 200, `Confirmation must succeed after proof upload, got: ${JSON.stringify(confirmWithProofRes.body)}`);
  assert.strictEqual(confirmWithProofRes.body.success, true);

  // Check database state: Order must remain PENDING_VERIFICATION (not automatically marked PAID!)
  const dbOrder = await findOrderInDb(upiOrderNoProofId);
  const dbPayment = await getPaymentRecordByOrderId(upiOrderNoProofId);
  assert.strictEqual(dbOrder.paymentStatus, 'PENDING_VERIFICATION');
  assert.strictEqual(dbPayment.paymentStatus, 'PENDING_VERIFICATION');
  assert.notStrictEqual(dbOrder.paymentStatus, 'PAID', 'Payment must NOT be marked as PAID merely because screenshot was uploaded');
  console.log('✓ TEST 3 PASSED: Order confirmed successfully after screenshot submission. Status is PENDING_VERIFICATION.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Repeated Clicks & Duplicate Prevention
  // --------------------------------------------------------------------------
  console.log('Test 4: Testing Repeated Clicks and Duplicate Prevention...');

  // 4a: Rapid duplicate confirmation requests for same order
  const dupConfirmRes1 = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: upiOrderNoProofId,
    paymentMethod: 'UPI',
  });
  assert.strictEqual(dupConfirmRes1.status, 200, 'Duplicate confirmation should be handled idempotently');

  // Check orders table has exactly 1 row for this orderId
  const [orderRows]: any = await pool.query(
    'SELECT COUNT(*) as count FROM orders WHERE order_id = ? OR order_id = ?',
    [upiOrderNoProofId, upiOrderNoProofId.slice(1)]
  );
  assert.strictEqual(Number(orderRows[0].count), 1, 'Exactly 1 order record must exist in MySQL');

  // Check payments table has exactly 1 row for this orderId
  const [paymentRows]: any = await pool.query(
    'SELECT COUNT(*) as count FROM payments WHERE order_id = ? OR order_id = ?',
    [upiOrderNoProofId, upiOrderNoProofId.slice(1)]
  );
  assert.strictEqual(Number(paymentRows[0].count), 1, 'Exactly 1 payment record must exist in MySQL');
  console.log('✓ TEST 4 PASSED: Zero duplicate order or payment rows created upon repeated confirmations.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Cash on Delivery (COD) Checkout -> Preserved Without Screenshot
  // --------------------------------------------------------------------------
  console.log('Test 5: Testing Cash on Delivery (COD) checkout (No screenshot required)...');
  const codOrderNum = Math.floor(100000 + Math.random() * 900000);
  const codOrderId = `#FC-${codOrderNum}`;

  const codConfirmRes = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: codOrderId,
    id: codOrderId,
    customerId,
    customerName: 'Suresh Raina',
    deliveryAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
    items: [{ product: { id: 'item-2', title: 'A2 Cow Milk', price: 90, unit: '1 L' }, quantity: 2 }],
    subtotal: 180,
    total: 220,
    paymentMethod: 'Cash on Delivery',
  });
  assert.strictEqual(codConfirmRes.status, 200, `COD order confirmation must succeed without screenshot, got: ${JSON.stringify(codConfirmRes.body)}`);
  assert.strictEqual(codConfirmRes.body.success, true);

  const dbCodOrder = await findOrderInDb(codOrderId);
  assert.strictEqual(dbCodOrder.paymentMethod, 'Cash on Delivery');
  assert.strictEqual(dbCodOrder.status, 'CONFIRMED');
  console.log('✓ TEST 5 PASSED: COD checkout confirmed without screenshot proof.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Direct Payment Checkout -> Proof Required & Stays PENDING_VERIFICATION
  // --------------------------------------------------------------------------
  console.log('Test 6: Testing Direct Payment Checkout with Screenshot Proof enforcement...');
  const directOrderNum = Math.floor(100000 + Math.random() * 900000);
  const directOrderId = `#FC-${directOrderNum}`;

  // 6a: Create draft order with paymentMethod: 'Direct Payment'
  const draftDirectRes = await simulateRequest('POST', '/api/orders', authHeaders, {
    id: directOrderId,
    customerId,
    customerName: 'Suresh Raina',
    customerEmail: testCustomerEmail,
    customerPhone: testCustomerPhone,
    deliveryAddress: 'Flat 402, Green Glen Layout, Bellandur, Bengaluru',
    items: [{ product: { id: 'item-3', title: 'Organic Tomatoes', price: 60, unit: '1 kg' }, quantity: 2 }],
    subtotal: 120,
    discount: 0,
    total: 160,
    status: 'Pending',
    paymentMethod: 'Direct Payment',
    paymentStatus: 'INITIATED',
  });
  assert.strictEqual(draftDirectRes.status, 200, 'Direct Payment draft order creation must succeed');

  // 6b: Attempt to confirm Direct Payment WITHOUT proof -> Must be BLOCKED (400)
  const confirmDirectNoProofRes = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: directOrderId,
    paymentMethod: 'Direct Payment',
  });
  assert.strictEqual(
    confirmDirectNoProofRes.status,
    400,
    `Direct Payment order without screenshot proof must be blocked with 400, got: ${confirmDirectNoProofRes.status}`
  );

  // 6c: Upload valid screenshot for Direct Payment order
  const uploadDirectProofRes = await simulateRequest('POST', '/api/payments/screenshot/upload', authHeaders, {
    orderId: directOrderId,
    screenshot: VALID_PNG_BASE64,
  });
  assert.strictEqual(uploadDirectProofRes.status, 200, 'Direct Payment screenshot upload must succeed');
  assert.strictEqual(uploadDirectProofRes.body.paymentStatus, 'PENDING_VERIFICATION');

  // 6d: Confirm Direct Payment order AFTER screenshot -> Must succeed (200)
  const confirmDirectWithProofRes = await simulateRequest('POST', '/api/orders/confirm', authHeaders, {
    orderId: directOrderId,
    paymentMethod: 'Direct Payment',
  });
  assert.strictEqual(confirmDirectWithProofRes.status, 200, 'Direct Payment order confirmation must succeed with proof');
  assert.strictEqual(confirmDirectWithProofRes.body.success, true);

  // 6e: Verify MySQL state: must remain PENDING_VERIFICATION (not automatically marked PAID!)
  const dbDirectOrder = await findOrderInDb(directOrderId);
  const dbDirectPayment = await getPaymentRecordByOrderId(directOrderId);
  assert.strictEqual(dbDirectOrder.paymentStatus, 'PENDING_VERIFICATION');
  assert.strictEqual(dbDirectPayment.paymentStatus, 'PENDING_VERIFICATION');
  assert.notStrictEqual(dbDirectOrder.paymentStatus, 'PAID', 'Direct Payment must NOT be marked as PAID without admin approval');
  console.log('✓ TEST 6 PASSED: Direct Payment enforced proof requirement and confirmed with PENDING_VERIFICATION status.\n');

  console.log('===============================================================');
  console.log('ALL CHECKOUT PAYMENT PROOF & VERIFICATION TESTS PASSED (6/6)!');
  console.log('===============================================================');
}

runCheckoutPaymentProofTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
