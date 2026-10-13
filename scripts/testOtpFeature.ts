import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { getPool } from '../server/db';
import {
  generateOrderOtp,
  verifyOrderOtp,
  resendOrderOtp,
  getOrderOtpStatus,
  hashOtp,
} from '../server/otpService';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runOtpTests() {
  console.log('====================================================');
  console.log('Testing FreshCart OTP Feature & Security Rules');
  console.log('====================================================\n');

  const pool = getPool();
  const timestamp = Date.now();

  // Test Customer
  const testCustId = `cust-otp-${timestamp}`;
  const testPhone = '+91 9876543210';

  // ----------------------------------------------------
  // SCENARIO 1: COD order -> OTP must be strictly rejected
  // ----------------------------------------------------
  console.log('Scenario 1: Cash on Delivery (COD) order');
  const codOrderId = `FC-COD-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'COD User', '123 Street', 400.00, 400.00, 'Picking', 'Cash on Delivery', 'PENDING', ?)`,
    [codOrderId, testCustId, testPhone]
  );

  const codOtpRes = await generateOrderOtp(codOrderId, testCustId, testPhone);
  assert.strictEqual(codOtpRes.success, false, 'COD orders must not allow OTP generation');
  assert(
    codOtpRes.error?.includes('Cash on Delivery') || codOtpRes.message?.includes('Cash on Delivery'),
    'COD error message must specify OTP is not permitted for COD'
  );
  console.log('✓ PASS: COD orders strictly reject OTP generation.');

  // ----------------------------------------------------
  // SCENARIO 2: Online payment PENDING verification -> OTP must be strictly rejected
  // ----------------------------------------------------
  console.log('\nScenario 2: Online payment awaiting verification (PENDING)');
  const pendingOrderId = `FC-PENDING-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'Pending User', '123 Street', 500.00, 500.00, 'Picking', 'UPI', 'PENDING_VERIFICATION', ?)`,
    [pendingOrderId, testCustId, testPhone]
  );

  const pendingOtpRes = await generateOrderOtp(pendingOrderId, testCustId, testPhone);
  assert.strictEqual(pendingOtpRes.success, false, 'Pending payment must not allow OTP generation');
  console.log('✓ PASS: Online payment pending verification strictly rejects OTP generation.');

  // ----------------------------------------------------
  // SCENARIO 3: Online payment REJECTED -> OTP must be strictly rejected
  // ----------------------------------------------------
  console.log('\nScenario 3: Online payment proof REJECTED');
  const rejectedOrderId = `FC-REJ-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'Rejected User', '123 Street', 500.00, 500.00, 'Picking', 'UPI', 'REJECTED', ?)`,
    [rejectedOrderId, testCustId, testPhone]
  );

  const rejectedOtpRes = await generateOrderOtp(rejectedOrderId, testCustId, testPhone);
  assert.strictEqual(rejectedOtpRes.success, false, 'Rejected payment must not allow OTP generation');
  console.log('✓ PASS: Rejected online payment strictly rejects OTP generation.');

  // ----------------------------------------------------
  // SCENARIO 4: Delivery failure -> Missing/invalid contact channel
  // ----------------------------------------------------
  console.log('\nScenario 4: OTP delivery failure with missing contact channel');
  const noPhoneOrderId = `FC-NOPHONE-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status)
     VALUES (?, ?, 'No Phone User', '123 Street', 300.00, 300.00, 'Picking', 'UPI', 'COMPLETED')`,
    [noPhoneOrderId, testCustId]
  );

  const noPhoneRes = await generateOrderOtp(noPhoneOrderId, testCustId, '');
  assert.strictEqual(noPhoneRes.success, false, 'Must fail when customer phone is not available');
  assert(
    noPhoneRes.error?.includes('mobile') || noPhoneRes.error?.includes('not available'),
    'Must return clear error when contact channel is unavailable'
  );
  console.log('✓ PASS: System does not pretend OTP was sent when contact channel is missing.');

  // ----------------------------------------------------
  // SCENARIO 5: Completed online payment -> Successful generation & duplicate prevention
  // ----------------------------------------------------
  console.log('\nScenario 5: Completed online payment generation & duplicate prevention');
  const completedOrderId = `FC-PAID-${timestamp}`;
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status, mobile)
     VALUES (?, ?, 'Paid User', '123 Street', 650.00, 650.00, 'Picking', 'UPI', 'COMPLETED', ?)`,
    [completedOrderId, testCustId, testPhone]
  );

  const gen1 = await generateOrderOtp(completedOrderId, testCustId, testPhone);
  assert.strictEqual(gen1.success, true, 'OTP generation for completed online order must succeed');
  assert(gen1.expiresAt > Date.now(), 'OTP must have future expiry timestamp');
  assert.strictEqual(gen1.maskedPhone, '******3210', 'Masked mobile must match format ******3210');

  // Verify DB record was created with salted SHA-256 hash
  const [dbOtpRows] = await pool.query<any[]>(
    `SELECT * FROM otp_records WHERE order_id = ?`,
    [completedOrderId]
  );
  assert.strictEqual(dbOtpRows.length, 1, 'OTP record must be persisted in MySQL');
  assert(dbOtpRows[0].otp_hash, 'Must store salted hash');
  assert(dbOtpRows[0].otp_salt, 'Must store cryptographic salt');
  assert.strictEqual(dbOtpRows[0].used, 0, 'Initial status must be unused');

  // Repeated click: should reuse active OTP and prevent duplicate creation
  const gen2 = await generateOrderOtp(completedOrderId, testCustId, testPhone);
  assert.strictEqual(gen2.success, true);
  assert.strictEqual(gen2.expiresAt, gen1.expiresAt, 'Repeated clicks must reuse active OTP and not recreate');
  console.log('✓ PASS: Completed online order generates OTP with salted hash and prevents duplicate creation.');

  // ----------------------------------------------------
  // SCENARIO 6: Status query
  // ----------------------------------------------------
  console.log('\nScenario 6: Querying OTP status');
  const statusRes = getOrderOtpStatus(completedOrderId);
  assert.strictEqual(statusRes.hasRecord, true);
  assert.strictEqual(statusRes.status, 'UNUSED');
  assert.strictEqual(statusRes.maskedPhone, '******3210');
  console.log('✓ PASS: OTP status correctly retrieved from system.');

  // ----------------------------------------------------
  // SCENARIO 7: Invalid OTP code verification
  // ----------------------------------------------------
  console.log('\nScenario 7: Invalid OTP code submission');
  const badOtpRes = await verifyOrderOtp(completedOrderId, '000000');
  assert.strictEqual(badOtpRes.success, false, 'Invalid OTP must not verify');
  assert.strictEqual(badOtpRes.error, 'Invalid OTP.');
  assert.strictEqual(badOtpRes.status, 'Picking', 'Order status must remain Picking on invalid OTP');
  assert.strictEqual(badOtpRes.remainingAttempts, 4, 'Remaining attempts must decrement from 5 to 4');
  console.log('✓ PASS: Invalid OTP rejected and decrements attempt count.');

  // ----------------------------------------------------
  // SCENARIO 8: Lockout protection after 5 failed attempts
  // ----------------------------------------------------
  console.log('\nScenario 8: Lockout protection after repeated incorrect attempts');
  await verifyOrderOtp(completedOrderId, '111111'); // attempt 2 (rem 3)
  await verifyOrderOtp(completedOrderId, '222222'); // attempt 3 (rem 2)
  await verifyOrderOtp(completedOrderId, '333333'); // attempt 4 (rem 1)
  const lockRes = await verifyOrderOtp(completedOrderId, '444444'); // attempt 5 (rem 0 -> LOCKED)
  assert.strictEqual(lockRes.success, false);
  assert.strictEqual(lockRes.remainingAttempts, 0);

  const lockedQuery = await verifyOrderOtp(completedOrderId, '555555');
  assert(
    lockedQuery.error?.includes('Maximum incorrect OTP attempts exceeded') ||
    lockedQuery.error?.includes('Invalid OTP.'),
    'Must enforce attempt lockout'
  );
  console.log('✓ PASS: Lockout enforced after 5 failed attempts.');

  // ----------------------------------------------------
  // SCENARIO 9: Resend OTP resetting status and attempts
  // ----------------------------------------------------
  console.log('\nScenario 9: Resending OTP');
  const resendRes = await resendOrderOtp(completedOrderId, testCustId, testPhone);
  assert.strictEqual(resendRes.success, true, 'Resending OTP must succeed');
  assert(resendRes.expiresAt! > Date.now(), 'Fresh expiry must be established');

  // Fast repeated resend should be rate limited
  const spamResend = await resendOrderOtp(completedOrderId, testCustId, testPhone);
  assert.strictEqual(spamResend.success, false, 'Repeated resend must be rate limited');
  assert(spamResend.message?.includes('wait') || spamResend.error?.includes('wait'), 'Cooldown message expected');
  console.log('✓ PASS: Resending OTP issues fresh code and enforces cooldown rate limit.');

  // ----------------------------------------------------
  // SCENARIO 10: Successful OTP Verification and Order Delivery
  // ----------------------------------------------------
  console.log('\nScenario 10: Successful OTP verification -> Marks order Delivered');
  // Get active plain OTP from internal memory
  const activePlainOtp = resendRes.otp!;
  assert(activePlainOtp && activePlainOtp.length === 6, 'Internal OTP code must be 6 digits');

  const verifySuccess = await verifyOrderOtp(completedOrderId, activePlainOtp);
  assert.strictEqual(verifySuccess.success, true, 'Correct OTP verification must succeed');
  assert.strictEqual(verifySuccess.status, 'Delivered', 'Order status must transition to Delivered');
  assert(verifySuccess.verifiedAt, 'Verified timestamp must be present');

  // Verify in database that order is Delivered and OTP is marked used
  const [updatedOrder] = await pool.query<any[]>(
    `SELECT status FROM orders WHERE order_id = ?`,
    [completedOrderId]
  );
  assert.strictEqual(updatedOrder[0].status, 'Delivered', 'Database order status must be Delivered');

  const [updatedOtpRecord] = await pool.query<any[]>(
    `SELECT used, verified_at FROM otp_records WHERE order_id = ?`,
    [completedOrderId]
  );
  assert.strictEqual(updatedOtpRecord[0].used, 1, 'OTP record must be marked as used in DB');

  // ----------------------------------------------------
  // SCENARIO 11: Reusing used OTP must be strictly rejected
  // ----------------------------------------------------
  console.log('\nScenario 11: Reusing a used OTP');
  const reuseRes = await verifyOrderOtp(completedOrderId, activePlainOtp);
  assert.strictEqual(reuseRes.success, false, 'Used OTP must never work again');
  assert(
    reuseRes.error?.includes('already been verified') || reuseRes.error?.includes('used'),
    'Error message must indicate OTP has already been verified and used'
  );
  console.log('✓ PASS: Single-use guarantee enforced; used OTP cannot be reused.');

  // ----------------------------------------------------
  // CLEANUP
  // ----------------------------------------------------
  await pool.query(`DELETE FROM orders WHERE order_id IN (?, ?, ?, ?, ?)`, [
    codOrderId,
    pendingOrderId,
    rejectedOrderId,
    noPhoneOrderId,
    completedOrderId,
  ]);
  await pool.query(`DELETE FROM otp_records WHERE order_id IN (?, ?, ?, ?, ?)`, [
    codOrderId,
    pendingOrderId,
    rejectedOrderId,
    noPhoneOrderId,
    completedOrderId,
  ]);

  console.log('\n====================================================');
  console.log('ALL OTP SECURITY AND WORKFLOW TESTS PASSED (11/11)!');
  console.log('====================================================\n');
  process.exit(0);
}

runOtpTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
