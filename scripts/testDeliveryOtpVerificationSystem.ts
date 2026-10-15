import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { getPool } from '../server/db';
import {
  generateOrderOtp,
  verifyOrderOtp,
  resendOrderOtp,
  getOrderOtpStatus,
  getCustomerOrderOtp,
  resetOtpCooldownForTesting,
} from '../server/otpService';
import { signCustomerToken } from '../server/jwtHelper';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runDeliveryOtpSystemTests() {
  console.log('================================================================');
  console.log('FreshCart: Six-Digit Delivery OTP Verification System E2E Tests');
  console.log('================================================================\n');

  const pool = getPool();
  const timestamp = Date.now();
  const customerId = `cust-test-${timestamp}`;
  const customerMobile = '+91 9876543210';
  const customerToken = signCustomerToken({ id: customerId });

  // -------------------------------------------------------------------------
  // Test 1: No OTP before payment approval (Online UPI order with PENDING status)
  // -------------------------------------------------------------------------
  console.log('Test 1: Online order before payment approval (PENDING)');
  const pendingOrderId = `FC-ONLINE-PENDING-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'Priya Sharma', 'Sector 14, Gurgaon', 750.00, 750.00, 'Picking', 'UPI', 'PENDING_VERIFICATION', ?)`,
    [pendingOrderId, customerId, customerMobile]
  );

  const preApprovalCustomerFetch = await getCustomerOrderOtp(pendingOrderId, customerId);
  assert.strictEqual(
    preApprovalCustomerFetch.success,
    false,
    'OTP must not be returned before payment is approved'
  );
  console.log('✓ PASS: Customer Portal does not generate or reveal OTP while payment is pending approval.');

  // -------------------------------------------------------------------------
  // Test 2: Admin Approves Payment -> Generates 6-Digit OTP
  // -------------------------------------------------------------------------
  console.log('\nTest 2: Admin approves payment (COMPLETED) -> Generates 6-Digit OTP');
  await pool.query(
    `UPDATE orders SET payment_status = 'COMPLETED' WHERE order_id = ?`,
    [pendingOrderId]
  );

  const adminGenRes = await generateOrderOtp(pendingOrderId, customerId, customerMobile);
  assert.strictEqual(adminGenRes.success, true, 'OTP generation should succeed for COMPLETED payment');
  assert.strictEqual(typeof adminGenRes.otp, 'string', 'Generated OTP must be a string');
  assert.strictEqual(adminGenRes.otp?.length, 6, 'OTP must be exactly 6 digits');
  assert(/^\d{6}$/.test(adminGenRes.otp || ''), 'OTP must contain only digits');
  console.log(`✓ PASS: 6-Digit numeric OTP successfully generated: [ ${adminGenRes.otp} ]`);

  // -------------------------------------------------------------------------
  // Test 3: Customer Portal retrieves actual OTP with owner authorization
  // -------------------------------------------------------------------------
  console.log('\nTest 3: Customer Portal retrieves actual OTP with customer ownership check');
  const customerOtpFetch = await getCustomerOrderOtp(pendingOrderId, customerId);
  assert.strictEqual(customerOtpFetch.success, true);
  assert.strictEqual(customerOtpFetch.otp, adminGenRes.otp, 'Customer must receive the active 6-digit OTP');

  // Customer isolation test: Another customer cannot access this OTP
  const unauthorizedFetch = await getCustomerOrderOtp(pendingOrderId, 'unauthorized-hacker-123');
  assert.strictEqual(unauthorizedFetch.success, false, 'Unauthorized customer must be blocked from reading OTP');
  assert.strictEqual(unauthorizedFetch.otp, undefined, 'Plaintext OTP must never be returned to another user');
  console.log('✓ PASS: Customer owner securely retrieves the actual 6-digit OTP; unauthorized users are strictly blocked.');

  // -------------------------------------------------------------------------
  // Test 4: Database Security Check -> Only hashed OTP stored in MySQL
  // -------------------------------------------------------------------------
  console.log('\nTest 4: Database Security Check (Zero Plaintext Exposure)');
  const [rows]: any = await pool.query(
    `SELECT otp_code, otp_hash, otp_salt, attempts, used FROM otp_records WHERE order_id = ?`,
    [pendingOrderId]
  );
  assert(rows.length > 0, 'OTP record must exist in MySQL otp_records table');
  const record = rows[0];
  assert.strictEqual(record.otp_code, null, 'otp_code column in MySQL MUST be NULL (never plaintext)');
  assert(record.otp_hash && record.otp_hash.length >= 64, 'otp_hash must be a valid cryptographic hash');
  assert(record.otp_salt && record.otp_salt.length >= 16, 'otp_salt must be stored for salted verification');
  console.log('✓ PASS: MySQL database stores only salted SHA-256 hash. Plaintext otp_code column is strictly NULL.');

  // -------------------------------------------------------------------------
  // Test 5: Resend OTP -> Rate Limiting, Immediate Invalidation & New Code Generation
  // -------------------------------------------------------------------------
  console.log('\nTest 5: Resend OTP (Rate Limiting, Immediate Invalidation & New Code Generation)');
  const oldOtp = adminGenRes.otp!;

  // 5a. Immediate resend is rate-limited by server cooldown
  const immediateResend = await resendOrderOtp(pendingOrderId, customerId, customerMobile);
  assert.strictEqual(immediateResend.success, false, 'Immediate resend must be rate-limited');
  assert(immediateResend.message?.includes('wait'), 'Cooldown message must advise user to wait');
  console.log('✓ PASS: Server-side cooldown rate limiter protects against rapid resend abuse.');

  // 5b. Resend after cooldown expires
  resetOtpCooldownForTesting(pendingOrderId);
  const resendRes = await resendOrderOtp(pendingOrderId, customerId, customerMobile);
  assert.strictEqual(resendRes.success, true, 'Resend OTP must succeed after cooldown');
  assert.strictEqual(resendRes.otp?.length, 6, 'Resent OTP must be 6 digits');
  assert.notStrictEqual(resendRes.otp, oldOtp, 'Resent OTP must be freshly generated and different');
  const newOtp = resendRes.otp!;
  console.log(`✓ Generated new OTP: [ ${newOtp} ] (Old was: [ ${oldOtp} ])`);

  // Verify that OLD OTP is immediately rejected
  const oldOtpVerifyAttempt = await verifyOrderOtp(pendingOrderId, oldOtp);
  assert.strictEqual(oldOtpVerifyAttempt.success, false, 'Old OTP must be immediately rejected after resend');
  console.log('✓ PASS: Old superseded OTP was immediately rejected upon resend.');

  // -------------------------------------------------------------------------
  // Test 6: Incorrect OTP Verification & Attempt Limits
  // -------------------------------------------------------------------------
  console.log('\nTest 6: Incorrect OTP validation and attempt counting');
  const wrongOtpAttempt = await verifyOrderOtp(pendingOrderId, '000000');
  assert.strictEqual(wrongOtpAttempt.success, false, 'Invalid OTP must not verify');
  assert(typeof wrongOtpAttempt.remainingAttempts === 'number', 'Must return remaining attempts');
  console.log(`✓ PASS: Invalid OTP rejected. Remaining attempts: ${wrongOtpAttempt.remainingAttempts}`);

  // -------------------------------------------------------------------------
  // Test 7: Successful OTP Verification -> Changes status to DELIVERED atomically
  // -------------------------------------------------------------------------
  console.log('\nTest 7: Successful OTP Verification marks order DELIVERED');
  const successfulVerify = await verifyOrderOtp(pendingOrderId, newOtp);
  assert.strictEqual(successfulVerify.success, true, 'Valid new OTP must verify successfully');
  assert.strictEqual(successfulVerify.status, 'Delivered', 'Order status must be updated to Delivered');

  // Verify DB state
  const [dbOrderRows]: any = await pool.query(
    `SELECT status FROM orders WHERE order_id = ?`,
    [pendingOrderId]
  );
  assert.strictEqual(dbOrderRows[0].status, 'Delivered', 'MySQL order status must be Delivered');

  const [dbOtpRows]: any = await pool.query(
    `SELECT used, verified_at FROM otp_records WHERE order_id = ?`,
    [pendingOrderId]
  );
  assert.strictEqual(dbOtpRows[0].used, 1, 'OTP must be marked used in database');
  assert(dbOtpRows[0].verified_at, 'MySQL verified_at must be populated in otp_records');

  // Verify that REUSED OTP is rejected
  const reusedAttempt = await verifyOrderOtp(pendingOrderId, newOtp);
  assert.strictEqual(reusedAttempt.success, false, 'Reused OTP must be rejected');
  console.log('✓ PASS: Order marked DELIVERED with verification timestamp. Replay/reuse strictly prevented.');

  // -------------------------------------------------------------------------
  // Test 8: Cash on Delivery (COD) Order Verification
  // -------------------------------------------------------------------------
  console.log('\nTest 8: Cash on Delivery (COD) Order OTP Verification');
  const codOrderId = `FC-COD-FLOW-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'Amit Patel', 'MG Road, Bangalore', 450.00, 450.00, 'Picking', 'Cash on Delivery', 'COD', ?)`,
    [codOrderId, customerId, customerMobile]
  );

  // COD order can generate delivery OTP without online screenshot
  const codGenRes = await generateOrderOtp(codOrderId, customerId, customerMobile);
  assert.strictEqual(codGenRes.success, true, 'COD order must allow delivery OTP generation');
  const codOtp = codGenRes.otp!;

  // Verify COD delivery OTP
  const codVerifyRes = await verifyOrderOtp(codOrderId, codOtp);
  assert.strictEqual(codVerifyRes.success, true);
  assert.strictEqual(codVerifyRes.status, 'Delivered');

  // Payment status must remain COD until cash collection is separately confirmed
  const [codDbRows]: any = await pool.query(
    `SELECT status, payment_status FROM orders WHERE order_id = ?`,
    [codOrderId]
  );
  assert.strictEqual(codDbRows[0].status, 'Delivered', 'Order must be Delivered');
  assert.strictEqual(codDbRows[0].payment_status, 'COD', 'Payment status must remain COD until cash collection confirmed');
  console.log('✓ PASS: COD order successfully verified via delivery OTP while keeping payment status as COD.');

  // -------------------------------------------------------------------------
  // Test 9: Online UPI Order with status = 'Ordered' (not 'Picking') flow
  // -------------------------------------------------------------------------
  console.log('\nTest 9: Online UPI Order with status = \'Ordered\' (Non-Picking Status Verification)');
  const nonPickingOrderId = `FC-ORDERED-STATUS-${timestamp}`;
  const testCustomerEmail = `customer_${timestamp}@freshcart.com`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, email, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'Rahul Verma', ?, 'Cyber City, Gurgaon', 920.00, 920.00, 'Ordered', 'UPI', 'PENDING_VERIFICATION', ?)`,
    [nonPickingOrderId, customerId, testCustomerEmail, customerMobile]
  );

  // Before payment approval -> rejected
  const preApprovalFetch = await getCustomerOrderOtp(nonPickingOrderId, customerId, testCustomerEmail);
  assert.strictEqual(preApprovalFetch.success, false, 'Pre-approval must not return OTP');

  // Admin approves payment -> status remains 'Ordered', payment_status becomes 'COMPLETED'
  await pool.query(
    `UPDATE orders SET payment_status = 'COMPLETED' WHERE order_id = ?`,
    [nonPickingOrderId]
  );

  // Customer fetches OTP directly after payment approval (on-demand generation)
  const postApprovalFetch = await getCustomerOrderOtp(nonPickingOrderId, customerId, testCustomerEmail);
  assert.strictEqual(postApprovalFetch.success, true, 'OTP retrieval must succeed for COMPLETED order even if status is Ordered');
  assert.strictEqual(postApprovalFetch.otp?.length, 6, 'OTP must be 6 digits');
  assert(/^\d{6}$/.test(postApprovalFetch.otp || ''), 'OTP must be 6 numeric digits');
  console.log(`✓ PASS: Online UPI order with status 'Ordered' successfully generated and retrieved 6-digit OTP [ ${postApprovalFetch.otp} ]`);

  // Verify delivery OTP marks it Delivered
  const orderedVerifyRes = await verifyOrderOtp(nonPickingOrderId, postApprovalFetch.otp!);
  assert.strictEqual(orderedVerifyRes.success, true, 'Valid OTP must verify successfully');
  assert.strictEqual(orderedVerifyRes.status, 'Delivered', 'Order status must be updated to Delivered');
  console.log('✓ PASS: Order with original status \'Ordered\' was successfully verified and transitioned to Delivered.');

  console.log('\n================================================================');
  console.log('All 9/9 Delivery OTP Verification System Tests PASSED Successfully!');
  console.log('================================================================\n');
}

runDeliveryOtpSystemTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
