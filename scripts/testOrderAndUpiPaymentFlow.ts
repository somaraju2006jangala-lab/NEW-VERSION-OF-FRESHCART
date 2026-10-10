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
  getAllUpiPaymentsForVerification,
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

// 1x1 Transparent PNG in Base64 (valid magic bytes)
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING FRESHCART MYSQL FOREIGN-KEY & PAYMENT TESTS');
  console.log('====================================================\n');

  await connectMySql();
  const pool = getPool();

  // STEP 0: Verify foreign-key constraints exist in MySQL schema
  console.log('Step 0: Verifying foreign-key constraints are enforced in MySQL...');
  const [fkRows]: any = await pool.query(`
    SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'payments'
      AND CONSTRAINT_NAME IN ('fk_payments_order', 'fk_payments_customer')
  `);
  console.log('Found payments table foreign keys:', fkRows.map((r: any) => `${r.CONSTRAINT_NAME}: ${r.COLUMN_NAME} -> ${r.REFERENCED_TABLE_NAME}.${r.REFERENCED_COLUMN_NAME}`));
  assert.strictEqual(fkRows.length, 2, 'Both fk_payments_order and fk_payments_customer must be present in MySQL!');
  console.log('✓ Foreign keys fk_payments_order and fk_payments_customer are active and strictly enforced.\n');

  // STEP 1: Guest UPI Checkout Flow (Without pre-existing user or order)
  console.log('Step 1: Testing Guest UPI order creation & payment attempt...');
  const testOrderNum1 = Math.floor(100000 + Math.random() * 900000);
  const guestOrderId = `#FC-${testOrderNum1}`;
  const guestTxRef = `FC-${testOrderNum1}-TX1`;

  // 1a. Call POST /api/orders for guest
  const createGuestOrderRes = await simulateRequest('POST', '/api/orders', {}, {
    id: guestOrderId,
    customerId: 'guest',
    customerName: 'Guest Shopper',
    customerEmail: 'guest.shopper@example.com',
    customerPhone: '+919988776655',
    deliveryAddress: 'Walk-in Address, MG Road, Bengaluru',
    items: [
      {
        product: { id: 'prod-1', title: 'Organic Alphonso Mangoes', price: 299, unit: '1 kg' },
        quantity: 1,
      },
    ],
    subtotal: 299,
    discount: 0,
    total: 339,
    status: 'Pending',
    paymentMethod: 'UPI',
    paymentStatus: 'INITIATED',
  });

  assert.strictEqual(createGuestOrderRes.status, 200, `Expected 200 for guest order, got: ${JSON.stringify(createGuestOrderRes.body)}`);
  console.log('✓ Guest order created successfully in orders table.');

  // 1b. Call POST /api/payments/initiate-upi for the guest order
  const initiateGuestUpiRes = await simulateRequest('POST', '/api/payments/initiate-upi', {}, {
    orderId: guestOrderId,
    customerId: 'guest',
    amount: 339,
    upiId: 'freshcart@okicici',
    merchantName: 'FreshCart Store',
    transactionRef: guestTxRef,
  });

  assert.strictEqual(initiateGuestUpiRes.status, 200, `Expected 200 for UPI initiation, got: ${JSON.stringify(initiateGuestUpiRes.body)}`);
  assert.ok(initiateGuestUpiRes.body.success, 'Payment initiation must succeed');
  assert.ok(initiateGuestUpiRes.body.upiUri.includes('freshcart%40okicici'), 'UPI URI must be formed');
  console.log('✓ Guest payment attempt created successfully in payments table without foreign key violation.');

  // Verify in MySQL database that foreign key rows exist
  const [guestPaymentRows]: any = await pool.query(
    'SELECT payment_id, order_id, customer_id, amount, payment_status FROM payments WHERE order_id = ?',
    [guestOrderId]
  );
  assert.strictEqual(guestPaymentRows.length, 1, 'Exactly one payment record must exist');
  assert.strictEqual(guestPaymentRows[0].order_id, guestOrderId, 'payment.order_id must match actual order_id');
  assert.strictEqual(guestPaymentRows[0].customer_id, 'guest', 'payment.customer_id must match customers.customer_id');
  console.log('✓ Verified MySQL payments row references valid order and customer with 0 FK errors.\n');

  // STEP 2: Repeated payment attempt / retry (Zero duplicate records)
  console.log('Step 2: Testing repeated payment attempts for same order (duplicate prevention)...');
  const retryGuestUpiRes = await simulateRequest('POST', '/api/payments/initiate-upi', {}, {
    orderId: guestOrderId,
    customerId: 'guest',
    amount: 339,
    upiId: 'freshcart@okicici',
    merchantName: 'FreshCart Store',
    transactionRef: guestTxRef + '-RETRY',
  });

  assert.strictEqual(retryGuestUpiRes.status, 200, 'Retry must return HTTP 200');
  const [retryPaymentRows]: any = await pool.query(
    'SELECT COUNT(*) as count FROM payments WHERE order_id = ?',
    [guestOrderId]
  );
  assert.strictEqual(retryPaymentRows[0].count, 1, 'Retrying payment MUST NOT create duplicate payment records!');
  console.log('✓ Repeated payment attempt updated existing record with zero duplicate rows.\n');

  // STEP 3: Registered customer checkout with UPI screenshot upload
  console.log('Step 3: Testing Registered Customer UPI Order & Payment-proof upload...');
  const regEmail = `test_${Date.now()}@example.com`;
  const regPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const regRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Ananya Roy',
    email: regEmail,
    phone: regPhone,
    password: 'password123',
  });
  assert.strictEqual(regRes.status, 201, 'Customer registration must succeed');
  const customerId = regRes.body.customer.id;
  const customerToken = regRes.body.token;

  const custOrderNum = Math.floor(100000 + Math.random() * 900000);
  const custOrderId = `#FC-${custOrderNum}`;
  const custTxRef = `FC-${custOrderNum}-REF`;

  // 3a. Customer creates order
  const custOrderRes = await simulateRequest('POST', '/api/orders', { Authorization: `Bearer ${customerToken}` }, {
    id: custOrderId,
    customerId,
    customerName: 'Ananya Roy',
    customerEmail: regEmail,
    customerPhone: regPhone,
    deliveryAddress: 'Flat 101, Indiranagar, Bengaluru',
    items: [
      {
        product: { id: 'prod-2', title: 'Farm Fresh Avocados', price: 249, unit: '500 g' },
        quantity: 2,
      },
    ],
    subtotal: 498,
    discount: 50,
    total: 488,
    status: 'Pending',
    paymentMethod: 'UPI',
    paymentStatus: 'INITIATED',
  });
  assert.strictEqual(custOrderRes.status, 200, 'Customer order save must return 200');

  // 3b. Customer initiates payment
  const custUpiRes = await simulateRequest('POST', '/api/payments/initiate-upi', {}, {
    orderId: custOrderId,
    customerId,
    amount: 488,
    upiId: 'freshcart@okicici',
    merchantName: 'FreshCart Store',
    transactionRef: custTxRef,
  });
  assert.strictEqual(custUpiRes.status, 200, 'UPI initiation must return 200');

  // 3c. Customer uploads payment screenshot proof
  const uploadRes = await simulateRequest('POST', '/api/payments/screenshot/upload', { Authorization: `Bearer ${customerToken}` }, {
    orderId: custOrderId,
    screenshot: VALID_PNG_BASE64,
  });
  assert.strictEqual(uploadRes.status, 200, `Upload must return 200, got: ${JSON.stringify(uploadRes.body)}`);
  assert.strictEqual(uploadRes.body.success, true, 'Screenshot upload must succeed');
  assert.ok(uploadRes.body.screenshotUrl, 'Screenshot URL must be returned');

  // Verify DB payment status updated to PENDING_VERIFICATION
  const dbOrder = await findOrderInDb(custOrderId);
  const dbPayment = await getPaymentRecordByOrderId(custOrderId);
  assert.strictEqual(dbOrder.paymentStatus, 'PENDING_VERIFICATION');
  assert.strictEqual(dbPayment.paymentStatus, 'PENDING_VERIFICATION');
  console.log('✓ Customer proof uploaded and linked: status is PENDING_VERIFICATION.\n');

  // STEP 4: Admin Payment Verification Queue query
  console.log('Step 4: Querying Admin Payment Verification Queue...');
  const queueOrders = await getAllUpiPaymentsForVerification();
  const queueItem = queueOrders.find((o: any) => o.orderId === custOrderId || o.orderId === custOrderId.slice(1));
  assert.ok(queueItem, 'Customer order must appear in admin verification queue');
  assert.strictEqual(Number(queueItem.amount), 488, 'Amount in admin queue must match order total (₹488)');
  assert.strictEqual(queueItem.customerName, 'Ananya Roy', 'Customer name must match');
  console.log(`✓ Admin queue correctly displays order ${custOrderId}: Amount ₹${queueItem.amount}, Name: ${queueItem.customerName}.\n`);

  // STEP 5: Admin Payment Rejection & Customer Proof Re-upload
  console.log('Step 5: Testing Admin Rejection and Customer Proof Re-upload...');
  const rejectRes = await simulateRequest('POST', '/api/admin/payments/verify', { 'X-Admin-Role': 'admin' }, {
    orderId: custOrderId,
    action: 'REJECT',
    notes: 'Reference number unreadable. Please upload clearer screenshot.',
    adminUsername: 'AdminSupervisor',
  });
  assert.strictEqual(rejectRes.status, 200, `Admin rejection must return 200, got ${rejectRes.status}: ${JSON.stringify(rejectRes.body)}`);
  assert.strictEqual(rejectRes.body.success, true, 'Admin rejection must succeed');

  const afterRejectOrder = await findOrderInDb(custOrderId);
  assert.strictEqual(afterRejectOrder.paymentStatus, 'REJECTED');
  console.log('✓ Order marked REJECTED by admin.');

  // Customer re-uploads new proof
  const reuploadRes = await simulateRequest('POST', '/api/payments/screenshot/upload', { Authorization: `Bearer ${customerToken}` }, {
    orderId: custOrderId,
    screenshot: VALID_PNG_BASE64,
  });
  assert.strictEqual(reuploadRes.status, 200, 'Re-upload after rejection must succeed');
  const afterReuploadOrder = await findOrderInDb(custOrderId);
  assert.strictEqual(afterReuploadOrder.paymentStatus, 'PENDING_VERIFICATION');
  console.log('✓ Customer successfully re-uploaded payment proof: status back to PENDING_VERIFICATION.\n');

  // STEP 6: Admin Verification Approval (Mark as PAID) & Delivery OTP
  console.log('Step 6: Testing Admin Verification Approval & OTP generation...');
  const approveRes = await simulateRequest('POST', '/api/admin/payments/verify', { 'X-Admin-Role': 'admin' }, {
    orderId: custOrderId,
    action: 'APPROVE',
    adminUsername: 'AdminSupervisor',
  });
  assert.strictEqual(approveRes.status, 200, 'Admin approval must return 200');
  assert.strictEqual(approveRes.body.success, true, 'Admin approval must succeed');

  const approvedOrder = await findOrderInDb(custOrderId);
  const approvedPayment = await getPaymentRecordByOrderId(custOrderId);
  assert.strictEqual(approvedOrder.paymentStatus, 'PAID');
  assert.strictEqual(approvedPayment.paymentStatus, 'PAID');
  assert.strictEqual(Number(approvedPayment.otpSent), 1, 'OTP must be marked as sent');
  console.log('✓ Order and payment marked PAID in MySQL. Delivery OTP successfully issued.\n');

  // STEP 7: Cash on Delivery (COD) Flow
  console.log('Step 7: Testing Cash on Delivery (COD) order flow...');
  const codOrderNum = Math.floor(100000 + Math.random() * 900000);
  const codOrderId = `#FC-${codOrderNum}`;

  const codRes = await simulateRequest('POST', '/api/orders', { Authorization: `Bearer ${customerToken}` }, {
    id: codOrderId,
    customerId,
    customerName: 'Ananya Roy',
    deliveryAddress: 'Flat 101, Indiranagar, Bengaluru',
    items: [
      {
        product: { id: 'prod-1', title: 'Organic Alphonso Mangoes', price: 299, unit: '1 kg' },
        quantity: 2,
      },
    ],
    subtotal: 598,
    discount: 0,
    total: 638,
    status: 'CONFIRMED',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Pending',
  });

  assert.strictEqual(codRes.status, 200, 'COD order save must return 200');
  const codOrder = await findOrderInDb(codOrderId);
  const codPayment = await getPaymentRecordByOrderId(codOrderId);
  assert.strictEqual(codOrder.paymentMethod, 'Cash on Delivery');
  assert.strictEqual(codPayment.paymentMethod, 'COD');
  assert.strictEqual(Number(codPayment.amount), 638);
  assert.strictEqual(Number(codPayment.otpSent), 0, 'COD orders must not send OTP');
  console.log('✓ COD order created and saved successfully in orders & payments with zero FK errors.\n');

  console.log('====================================================');
  console.log('ALL MYSQL FOREIGN KEY & ORDER/PAYMENT TESTS PASSED! ');
  console.log('====================================================');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
