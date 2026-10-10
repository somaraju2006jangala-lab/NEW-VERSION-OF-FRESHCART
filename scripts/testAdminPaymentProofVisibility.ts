import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { apiApp } from '../server/apiRouter.ts';
import { signCustomerToken } from '../server/jwtHelper.ts';
import {
  connectMySql,
  upsertCustomerInDb,
  upsertOrderInDb,
  findOrderInDb,
  getPaymentRecordByOrderId,
  getAllUpiPaymentsForVerification,
  getPool,
} from '../server/db.ts';

// Helper to simulate express HTTP requests to apiApp
async function simulateRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  requestUrl: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any; headers: Record<string, string>; rawData?: Buffer }> {
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
    const chunks: Buffer[] = [];

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
        resolve({
          status: responseStatusCode,
          body: responseBody,
          headers: responseHeaders,
          rawData: Buffer.concat(chunks),
        });
        return this;
      },
      send(data: any) {
        if (Buffer.isBuffer(data)) {
          chunks.push(data);
          resolve({
            status: responseStatusCode,
            body: null,
            headers: responseHeaders,
            rawData: Buffer.concat(chunks),
          });
        } else {
          responseBody = data;
          resolve({
            status: responseStatusCode,
            body: responseBody,
            headers: responseHeaders,
            rawData: Buffer.concat(chunks),
          });
        }
        return this;
      },
      write(chunk: any) {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return true;
      },
      end(data?: any) {
        if (data) {
          chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        }
        resolve({
          status: responseStatusCode,
          body: responseBody,
          headers: responseHeaders,
          rawData: Buffer.concat(chunks),
        });
      },
    };

    apiApp(req, res, (err: any) => {
      if (err) {
        resolve({
          status: 500,
          body: { error: err.message },
          headers: responseHeaders,
          rawData: Buffer.concat(chunks),
        });
      } else {
        resolve({
          status: responseStatusCode,
          body: responseBody,
          headers: responseHeaders,
          rawData: Buffer.concat(chunks),
        });
      }
    });
  });
}

// 1x1 Transparent PNG in Base64 (valid magic bytes: 89 50 4E 47 0D 0A 1A 0A)
const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runVerificationVisibilityTest() {
  console.log('====================================================');
  console.log('RUNNING ADMIN PAYMENT PROOF VISIBILITY VERIFICATION');
  console.log('====================================================\n');

  await connectMySql();

  const timestamp = Date.now();
  const customerId = `cust_vis_${timestamp}`;
  const customerEmail = `vis_${timestamp}@example.com`;
  const customerPhone = `98765${Math.floor(100000 + Math.random() * 900000)}`;
  const customerToken = signCustomerToken({
    id: customerId,
    customerId,
    email: customerEmail,
    name: 'Somaraju Customer',
    role: 'customer',
  });

  await upsertCustomerInDb({
    id: customerId,
    customer_id: customerId,
    customerId,
    name: 'Somaraju Customer',
    email: customerEmail,
    phone: customerPhone,
    mobile: customerPhone,
  });

  const orderWithoutProofId = `FC-NO-PROOF-${timestamp}`;
  const orderWithProofId = `FC-WITH-PROOF-${timestamp}`;

  // 1. Create Order A without uploaded screenshot
  console.log('Step 1: Create Order A (Awaiting Upload)...');
  await upsertOrderInDb({
    id: orderWithoutProofId,
    orderId: orderWithoutProofId,
    customerId,
    customerName: 'Somaraju Customer',
    email: customerEmail,
    mobile: customerPhone,
    deliveryAddress: 'Flat 101, Green Meadows, Hyderabad',
    deliveryTimeSlot: 'Express Delivery',
    subtotal: 350.0,
    discount: 50.0,
    total: 300.0,
    couponCode: 'SAVE50',
    paymentMethod: 'UPI',
    paymentStatus: 'PENDING_VERIFICATION',
    items: [],
  });

  // 2. Create Order B with UPI payment, ready for screenshot upload
  console.log('Step 2: Create Order B (UPI Payment with proof upload)...');
  await upsertOrderInDb({
    id: orderWithProofId,
    orderId: orderWithProofId,
    customerId,
    customerName: 'Somaraju Customer',
    email: customerEmail,
    mobile: customerPhone,
    deliveryAddress: 'Flat 101, Green Meadows, Hyderabad',
    deliveryTimeSlot: 'Express Delivery',
    subtotal: 500.0,
    discount: 50.0,
    total: 450.0,
    couponCode: 'SAVE50',
    paymentMethod: 'UPI',
    paymentStatus: 'PENDING_VERIFICATION',
    items: [],
  });

  // Check Admin Queue before upload
  console.log('Step 3: Check Admin Verification Queue before proof upload...');
  const queueBeforeUpload = await getAllUpiPaymentsForVerification();
  const queueItemA = queueBeforeUpload.find((item) => item.orderId === orderWithoutProofId);
  const queueItemBBefore = queueBeforeUpload.find((item) => item.orderId === orderWithProofId);

  assert.ok(queueItemA, 'Order A must exist in verification queue');
  assert.strictEqual(Number(queueItemA.amount), 300, 'Order A amount must match 300');
  assert.ok(!queueItemA.screenshotUrl && !queueItemA.screenshotPath, 'Order A must not have screenshot proof yet (Awaiting upload)');
  console.log('✓ Order A correctly displays amount ₹300 and shows "Awaiting upload" (hasProof = false).');

  // 4. Customer uploads real screenshot for Order B
  console.log('\nStep 4: Customer uploads real screenshot proof for Order B...');
  const uploadRes = await simulateRequest(
    'POST',
    '/api/payments/screenshot/upload',
    { Authorization: `Bearer ${customerToken}` },
    {
      orderId: orderWithProofId,
      fileName: 'gpay_receipt_proof.png',
      fileType: 'image/png',
      fileSize: 95,
      screenshot: VALID_PNG_BASE64,
    }
  );

  assert.strictEqual(uploadRes.status, 200, 'Upload request must succeed');
  assert.strictEqual(uploadRes.body.success, true, 'Upload response must be success');
  assert.strictEqual(uploadRes.body.orderId, orderWithProofId, 'Upload response must match clean orderId');
  assert.ok(uploadRes.body.screenshotUrl, 'Upload response must return valid screenshotUrl');
  console.log(`✓ Screenshot uploaded successfully: ${uploadRes.body.screenshotUrl}`);

  // 5. Query Admin Verification Queue after upload
  console.log('\nStep 5: Query Admin Verification Queue via Admin API...');
  const adminQueueRes = await simulateRequest('GET', '/api/admin/payments/verification-queue', {
    'x-admin-role': 'admin',
  });

  assert.strictEqual(adminQueueRes.status, 200, 'Admin verification queue API must return 200');
  const payments: any[] = adminQueueRes.body.payments || [];
  const queueItemB = payments.find((p) => p.orderId === orderWithProofId);
  const queueItemANow = payments.find((p) => p.orderId === orderWithoutProofId);

  assert.ok(queueItemB, 'Order B must appear in verification queue');
  assert.strictEqual(queueItemB.orderId, orderWithProofId, 'Order B ID must match');
  assert.strictEqual(queueItemB.customerName, 'Somaraju Customer', 'Customer name must match');
  assert.strictEqual(Number(queueItemB.amount), 450, 'Payable amount must accurately match ₹450');
  assert.ok(queueItemB.screenshotUrl, 'Order B must have screenshotUrl populated');
  console.log('✓ Order B in Admin Queue: ID, Customer Name, and Amount (₹450) match.');
  console.log('✓ Order B has valid screenshotUrl -> Admin Portal will render "View Payment Proof" button & thumbnail.');

  assert.ok(queueItemANow, 'Order A must remain in queue');
  assert.ok(!queueItemANow.screenshotUrl && !queueItemANow.screenshotPath, 'Order A must still have no proof');
  console.log('✓ Order A correctly remains in "Awaiting upload" state.');

  // 6. Admin clicks "View Payment Proof" -> Fetch actual image
  console.log('\nStep 6: Admin opens screenshot via GET /api/payments/screenshot/:orderId?admin=true...');
  const viewProofRes = await simulateRequest(
    'GET',
    `/api/payments/screenshot/${orderWithProofId}?admin=true`,
    { 'x-admin-role': 'admin' }
  );

  assert.strictEqual(viewProofRes.status, 200, 'Image preview request must return 200 OK');
  assert.strictEqual(viewProofRes.headers['content-type'], 'image/png', 'Must return image/png MIME');
  assert.ok(viewProofRes.rawData && viewProofRes.rawData.length > 0, 'Binary screenshot buffer must be non-empty');
  console.log(`✓ Proof image served successfully (${viewProofRes.rawData?.length} bytes, MIME: image/png).`);

  // 7. Verify Persistence across Server Redeploy / Disk wipe
  console.log('\nStep 7: Test persistence across redeployment (simulating disk wipe)...');
  const paymentRecord = await getPaymentRecordByOrderId(orderWithProofId);
  assert.ok(paymentRecord?.screenshotPath, 'Screenshot path must be recorded in MySQL');
  assert.ok(paymentRecord?.screenshotData, 'Screenshot base64 data must be saved in MySQL screenshot_data');

  // Delete the physical file from disk to simulate a container restart or redeploy
  if (fs.existsSync(paymentRecord.screenshotPath)) {
    fs.unlinkSync(paymentRecord.screenshotPath);
    console.log('  [Simulate] Physical file deleted from disk to simulate ephemeral container restart.');
  }

  // Call the GET endpoint again - it should automatically restore and serve from MySQL screenshot_data!
  const viewProofAfterWipeRes = await simulateRequest(
    'GET',
    `/api/payments/screenshot/${orderWithProofId}?admin=true`,
    { 'x-admin-role': 'admin' }
  );

  assert.strictEqual(viewProofAfterWipeRes.status, 200, 'Image preview must recover and return 200 OK from MySQL persistence');
  assert.strictEqual(viewProofAfterWipeRes.headers['content-type'], 'image/png');
  assert.ok(viewProofAfterWipeRes.rawData && viewProofAfterWipeRes.rawData.length > 0);
  console.log('✓ Persistence verified: Screenshot was successfully retrieved and restored from MySQL screenshot_data!');

  // 8. Admin Approves Payment
  console.log('\nStep 8: Admin verifies and marks payment as PAID...');
  const approveRes = await simulateRequest('POST', '/api/admin/payments/verify', { 'x-admin-role': 'admin' }, {
    orderId: orderWithProofId,
    action: 'APPROVE',
  });

  assert.strictEqual(approveRes.status, 200, 'Admin approval must succeed');
  assert.strictEqual(approveRes.body.paymentStatus, 'PAID', 'Payment status must become PAID');
  assert.strictEqual(approveRes.body.otpSent, true, 'OTP must be dispatched to customer upon approval');

  // Verify proof is purged following approval
  const getPurgedRes = await simulateRequest(
    'GET',
    `/api/payments/screenshot/${orderWithProofId}?admin=true`,
    { 'x-admin-role': 'admin' }
  );
  assert.strictEqual(getPurgedRes.status, 404, 'Verified screenshot must return 404 once verified as PAID');
  console.log('✓ Proof securely purged following verification approval.');

  console.log('\n====================================================');
  console.log('ALL ADMIN PAYMENT PROOF VISIBILITY CHECKS PASSED (100%)');
  console.log('====================================================');
}

runVerificationVisibilityTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Visibility Test Failed:', err);
    process.exit(1);
  });
