import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { apiApp } from '../server/apiRouter.ts';
import { signCustomerToken, signAdminToken } from '../server/jwtHelper.ts';
import {
  connectMySql,
  getPool,
  findOrderInDb,
  getPaymentRecordByOrderId,
  getAllUpiPaymentsForVerification,
  upsertOrderInDb,
  savePaymentScreenshotInDb,
  verifyUpiPaymentInDb,
  getAdminsFromDb,
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

const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runTests() {
  console.log('========================================================================');
  console.log('TESTING: DELETE VERIFIED-AND-PAID & REJECTED ORDERS (PAYMENT VERIFICATION)');
  console.log('========================================================================\n');

  await connectMySql();
  const pool = getPool();

  // Find or use active admin
  const admins = await getAdminsFromDb();
  const activeAdmin = admins.find((a) => a.status === 'active') || admins[0];
  assert(activeAdmin, 'Must have at least one admin in database for test.');

  const adminToken = signAdminToken({
    adminId: activeAdmin.admin_id,
    email: activeAdmin.email,
    role: activeAdmin.role || 'admin',
    tokenVersion: activeAdmin.token_version || 1,
  });

  const customerToken = signCustomerToken({
    id: 'cust_test_del_123',
    email: 'testcustomer@example.com',
    name: 'Test Customer',
  });

  const timestamp = Date.now();
  const verifiedOrderId = `FC-TEST-PAID-${timestamp}`;
  const rejectedOrderId = `FC-TEST-REJ-${timestamp}`;

  console.log(`[Setup] Using active admin: ${activeAdmin.admin_id} (${activeAdmin.email})`);
  console.log(`[Setup] Verified test order ID: #${verifiedOrderId}`);
  console.log(`[Setup] Rejected test order ID: #${rejectedOrderId}\n`);

  // -------------------------------------------------------------------------
  // TEST 1: CREATE AND DELETE A VERIFIED & PAID ORDER
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Verified & Paid Order Deletion & Financial Archival ---');

  // Create order in DB
  await upsertOrderInDb({
    id: verifiedOrderId,
    customerId: 'cust_test_del_123',
    customerName: 'Verified Test Customer',
    customerEmail: 'paid@example.com',
    customerPhone: '+919876543210',
    deliveryAddress: '123 Verified Lane, City',
    deliveryTimeSlot: '10:00 AM - 12:00 PM',
    items: [
      {
        product: { id: 'prod_1', title: 'Fresh Apples', price: 150, unit: '1 kg' },
        quantity: 2,
      },
    ],
    subtotal: 300,
    discount: 0,
    total: 300,
    paymentMethod: 'UPI',
    paymentStatus: 'PENDING_VERIFICATION',
    status: 'Confirmed',
  });

  // Verify payment as APPROVE -> PAID
  const approveResult = await verifyUpiPaymentInDb({
    orderId: verifiedOrderId,
    adminUsername: activeAdmin.admin_id,
    action: 'APPROVE',
  });
  assert(approveResult.success, 'Failed to set order to PAID in DB');

  // Verify queue query returns this paid order
  let queue = await getAllUpiPaymentsForVerification();
  let paidItemInQueue = queue.find((q) => q.orderId === verifiedOrderId);
  assert(paidItemInQueue, 'Order must appear in verification queue');
  assert.strictEqual(paidItemInQueue.paymentStatus, 'PAID', 'Order paymentStatus must be PAID');
  console.log(`✓ Verified order #${verifiedOrderId} successfully seeded with status PAID.`);

  // Test deletion via DELETE /api/admin/payments/order/:orderId
  console.log(`[Action] Admin deleting verified-and-paid order #${verifiedOrderId}...`);
  const delPaidRes = await simulateRequest(
    'DELETE',
    `/api/admin/payments/order/${verifiedOrderId}`,
    { authorization: `Bearer ${adminToken}` }
  );

  assert.strictEqual(delPaidRes.status, 200, `Expected 200 OK from delete, got ${delPaidRes.status}`);
  assert.strictEqual(delPaidRes.body.success, true, 'Delete response must report success');
  console.log(`✓ Delete API returned 200 OK: ${delPaidRes.body.message}`);

  // Verify database consistency: order deleted from orders & payments
  const dbOrderCheck = await findOrderInDb(verifiedOrderId);
  assert.strictEqual(dbOrderCheck, null, 'Order must be deleted from orders table');

  const [paymentRows] = await pool.query<any[]>(
    'SELECT * FROM payments WHERE order_id IN (?, ?)',
    [verifiedOrderId, `#${verifiedOrderId}`]
  );
  assert.strictEqual(paymentRows.length, 0, 'Payment record must be deleted from payments table');

  // Verify database consistency: page refresh from database queue query
  queue = await getAllUpiPaymentsForVerification();
  paidItemInQueue = queue.find((q) => q.orderId === verifiedOrderId);
  assert.strictEqual(paidItemInQueue, undefined, 'Order must NOT reappear after database refresh');
  console.log(`✓ Verified order #${verifiedOrderId} does not appear in refreshed verification queue.`);

  // Verify financial audit preservation in payment_audit_archive
  const [archiveRows] = await pool.query<any[]>(
    'SELECT * FROM payment_audit_archive WHERE order_id = ?',
    [verifiedOrderId]
  );
  assert.strictEqual(archiveRows.length, 1, 'Must have 1 record in payment_audit_archive');
  assert.strictEqual(archiveRows[0].payment_status, 'PAID', 'Archived record must retain PAID status');
  assert.strictEqual(Number(archiveRows[0].amount), 300, 'Archived record must retain amount 300');
  assert.strictEqual(archiveRows[0].archived_by, activeAdmin.full_name || activeAdmin.admin_id, 'Archived record must record admin');
  console.log(`✓ Financial audit trail preserved in payment_audit_archive (Amount: ₹${archiveRows[0].amount}, Status: ${archiveRows[0].payment_status}, Archived By: ${archiveRows[0].archived_by}).`);
  console.log('--- TEST 1 PASSED ---\n');

  // -------------------------------------------------------------------------
  // TEST 2: CREATE AND DELETE A REJECTED ORDER & SCREENSHOT FILE
  // -------------------------------------------------------------------------
  console.log('--- TEST 2: Rejected Order Deletion & Proof File Cleanup ---');

  // Create order
  await upsertOrderInDb({
    id: rejectedOrderId,
    customerId: 'cust_test_del_123',
    customerName: 'Rejected Test Customer',
    customerEmail: 'rejected@example.com',
    customerPhone: '+919876543211',
    deliveryAddress: '456 Rejected Lane, City',
    items: [
      {
        product: { id: 'prod_2', title: 'Organic Milk', price: 80, unit: '1 L' },
        quantity: 1,
      },
    ],
    subtotal: 80,
    discount: 0,
    total: 80,
    paymentMethod: 'UPI',
    paymentStatus: 'PENDING_VERIFICATION',
    status: 'Confirmed',
  });

  // Save screenshot file
  const saveProofRes = await savePaymentScreenshotInDb({
    orderId: rejectedOrderId,
    customerId: 'cust_test_del_123',
    base64Data: VALID_PNG_BASE64,
  });
  assert(saveProofRes.success, 'Failed to save screenshot proof');

  // Verify screenshot exists on disk if path returned
  if (saveProofRes.screenshotPath) {
    assert(fs.existsSync(saveProofRes.screenshotPath), 'Screenshot proof file must exist on disk before deletion');
    console.log(`✓ Proof file verified on disk: ${saveProofRes.screenshotPath}`);
  }

  // Reject payment proof
  const rejectResult = await verifyUpiPaymentInDb({
    orderId: rejectedOrderId,
    adminUsername: activeAdmin.admin_id,
    action: 'REJECT',
    notes: 'Invalid UTR test rejection',
  });
  assert(rejectResult.success, 'Failed to reject order in DB');

  // Verify queue returns rejected order
  queue = await getAllUpiPaymentsForVerification();
  let rejItemInQueue = queue.find((q) => q.orderId === rejectedOrderId);
  assert(rejItemInQueue, 'Rejected order must appear in verification queue');
  assert.strictEqual(rejItemInQueue.paymentStatus, 'REJECTED', 'Order status must be REJECTED');
  console.log(`✓ Rejected order #${rejectedOrderId} seeded with status REJECTED.`);

  // Test deletion via POST /api/admin/payments/delete-order
  console.log(`[Action] Admin deleting rejected order #${rejectedOrderId}...`);
  const delRejRes = await simulateRequest(
    'POST',
    '/api/admin/payments/delete-order',
    { authorization: `Bearer ${adminToken}` },
    { orderId: rejectedOrderId }
  );

  assert.strictEqual(delRejRes.status, 200, `Expected 200 OK from delete, got ${delRejRes.status}`);
  assert.strictEqual(delRejRes.body.success, true, 'Delete response must report success');
  console.log(`✓ Delete API returned 200 OK: ${delRejRes.body.message}`);

  // Verify database consistency: order deleted from orders & payments
  const dbRejOrderCheck = await findOrderInDb(rejectedOrderId);
  assert.strictEqual(dbRejOrderCheck, null, 'Rejected order must be deleted from orders table');

  const [rejPaymentRows] = await pool.query<any[]>(
    'SELECT * FROM payments WHERE order_id IN (?, ?)',
    [rejectedOrderId, `#${rejectedOrderId}`]
  );
  assert.strictEqual(rejPaymentRows.length, 0, 'Payment record must be deleted from payments table');

  // Verify screenshot was deleted from disk (no orphan files)
  if (saveProofRes.screenshotPath) {
    assert(!fs.existsSync(saveProofRes.screenshotPath), 'Screenshot proof file must be deleted from disk');
    console.log(`✓ Proof file cleanly unlinked from disk (no orphan file).`);
  }

  // Verify page refresh from database queue query
  queue = await getAllUpiPaymentsForVerification();
  rejItemInQueue = queue.find((q) => q.orderId === rejectedOrderId);
  assert.strictEqual(rejItemInQueue, undefined, 'Rejected order must NOT reappear after database refresh');
  console.log(`✓ Rejected order #${rejectedOrderId} does not appear in refreshed verification queue.`);

  // Verify audit archive was created
  const [rejArchiveRows] = await pool.query<any[]>(
    'SELECT * FROM payment_audit_archive WHERE order_id = ?',
    [rejectedOrderId]
  );
  assert.strictEqual(rejArchiveRows.length, 1, 'Must have 1 record in payment_audit_archive for rejected order');
  assert.strictEqual(rejArchiveRows[0].payment_status, 'REJECTED');
  console.log(`✓ Audit trail preserved in payment_audit_archive for rejected order.`);
  console.log('--- TEST 2 PASSED ---\n');

  // -------------------------------------------------------------------------
  // TEST 3: UNAUTHORIZED / CUSTOMER DELETION PREVENTION
  // -------------------------------------------------------------------------
  console.log('--- TEST 3: Customer & Unauthorized Deletion Prevention ---');

  // 1. Without any token
  const noAuthRes = await simulateRequest(
    'DELETE',
    `/api/admin/payments/order/FC-SOME-ORDER`,
    {}
  );
  assert([401, 403].includes(noAuthRes.status), `Expected 401/403 without admin token, got ${noAuthRes.status}`);
  console.log(`✓ Request without admin token correctly blocked with ${noAuthRes.status} Unauthorized.`);

  // 2. With customer token
  const custAuthRes = await simulateRequest(
    'DELETE',
    `/api/admin/payments/order/FC-SOME-ORDER`,
    { authorization: `Bearer ${customerToken}` }
  );
  assert([401, 403].includes(custAuthRes.status), `Expected 401/403 with customer token, got ${custAuthRes.status}`);
  console.log(`✓ Customer token attempt correctly blocked with ${custAuthRes.status} Unauthorized.`);

  // 3. Customer attempting DELETE /api/orders/:id
  const custOrdersDeleteRes = await simulateRequest(
    'DELETE',
    `/api/orders/FC-SOME-ORDER`,
    { authorization: `Bearer ${customerToken}` }
  );
  assert([401, 403].includes(custOrdersDeleteRes.status), `Expected 401/403 from customer DELETE /api/orders, got ${custOrdersDeleteRes.status}`);
  console.log(`✓ Customer attempt on DELETE /api/orders/:id correctly blocked with ${custOrdersDeleteRes.status} Unauthorized.`);
  console.log('--- TEST 3 PASSED ---\n');

  console.log('========================================================================');
  console.log('ALL TESTS PASSED: ORDER DELETION, AUDIT ARCHIVE & REFRESH VERIFIED!');
  console.log('========================================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('TEST RUNNER FAILED:', err);
    process.exit(1);
  });
