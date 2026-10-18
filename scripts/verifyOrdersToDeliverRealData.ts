import assert from 'assert';
import { connectMySql, getPool, getOrdersToDeliverCountFromDb } from '../server/db.ts';
import { generateOrderOtp, verifyOrderOtp } from '../server/otpService.ts';

const baseUrl = 'http://localhost:3000';

async function fetchCountFromApi(): Promise<number> {
  const res = await fetch(`${baseUrl}/api/admin/orders-to-deliver-count`, {
    headers: { 'x-admin-role': 'admin' },
  });
  const data = await res.json();
  assert(data.success, `API must succeed: ${data.error}`);
  return data.count;
}

async function runRealDataVerification() {
  console.log('================================================================');
  console.log('🚀 RUNNING REAL DATA VERIFICATION FOR ORDERS TO DELIVER COUNT');
  console.log('================================================================\n');

  await connectMySql();
  const pool = getPool();

  const timestamp = Date.now();
  const testOrderId = `FC-VERIFY-REAL-${timestamp}`;
  const testCodOrderId = `FC-VERIFY-COD-${timestamp}`;
  const customerMobile = '+91 9876543210';

  try {
    // Step 1: Query initial count via API and MySQL
    console.log('[Step 1] Fetching initial count before test...');
    const initialApiCount = await fetchCountFromApi();
    const initialDbCount = await getOrdersToDeliverCountFromDb();
    console.log(`  Initial API Count: ${initialApiCount}`);
    console.log(`  Initial MySQL Count: ${initialDbCount}`);
    assert.strictEqual(initialApiCount, initialDbCount, 'API and direct MySQL count must match');

    // Step 2: Insert a verified test order eligible for delivery
    console.log('\n[Step 2] Inserting an eligible test order awaiting delivery...');
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, subtotal, payment_method, payment_status, status)
       VALUES (?, 'cust_verify_real', 'Real Verification User', 'verify.real@example.com', ?, '77 Tech Park, Bangalore', 599.00, 599.00, 'UPI', 'COMPLETED', 'Picking')`,
      [testOrderId, customerMobile]
    );

    const countWithOrder = await fetchCountFromApi();
    console.log(`  Count after inserting eligible order: ${countWithOrder}`);
    assert.strictEqual(countWithOrder, initialApiCount + 1, 'Count must increment by 1');

    // Step 3: Test invalid OTP submission
    console.log('\n[Step 3] Generating OTP & testing invalid OTP submission...');
    const otpGen = await generateOrderOtp(testOrderId, 'cust_verify_real', customerMobile);
    assert(otpGen.success, 'OTP generation must succeed');
    const validOtp = otpGen.otp;

    const invalidVerifyRes = await fetch(`${baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: testOrderId, otp: '000000' }),
    });
    const invalidData = await invalidVerifyRes.json();
    assert.strictEqual(invalidData.success, false, 'Invalid OTP must fail');

    const countAfterInvalid = await fetchCountFromApi();
    console.log(`  Count after invalid OTP: ${countAfterInvalid}`);
    assert.strictEqual(countAfterInvalid, countWithOrder, 'Count must NOT change on invalid OTP');
    console.log('  ✓ PASS: Invalid OTP rejected, count remained unchanged.');

    // Step 4: Complete delivery workflow with valid OTP
    console.log('\n[Step 4] Completing delivery workflow with valid OTP verification...');
    const validVerifyRes = await fetch(`${baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: testOrderId, otp: validOtp }),
    });
    const validData = await validVerifyRes.json();
    assert.strictEqual(validData.success, true, 'Valid OTP must succeed');
    assert.strictEqual(validData.status, 'Delivered', 'Status must be Delivered');
    console.log('  ✓ Backend returned status: Delivered');

    // Step 5: Verify persisted status in MySQL
    console.log('\n[Step 5] Checking persisted order status in MySQL...');
    const [dbRows] = await pool.query<any[]>(
      `SELECT order_id, status FROM orders WHERE order_id = ?`,
      [testOrderId]
    );
    console.log(`  MySQL record status for ${testOrderId}: "${dbRows[0]?.status}"`);
    assert.strictEqual(dbRows[0]?.status, 'Delivered', 'MySQL order status must be "Delivered"');
    console.log('  ✓ PASS: MySQL persisted status is confirmed as "Delivered".');

    // Step 6: Query count API again
    console.log('\n[Step 6] Fetching count API again after delivery confirmation...');
    const countAfterDelivery = await fetchCountFromApi();
    console.log(`  Count after delivery: ${countAfterDelivery}`);
    assert.strictEqual(
      countAfterDelivery,
      countWithOrder - 1,
      `Count must decrease by 1 from ${countWithOrder} to ${countWithOrder - 1}`
    );
    assert.strictEqual(countAfterDelivery, initialApiCount, 'Count must return to initial baseline');
    console.log(`  ✓ PASS: Count decreased by 1 (from ${countWithOrder} to ${countAfterDelivery}).`);

    // Step 7: Test repeated OTP verification
    console.log('\n[Step 7] Testing repeated OTP verification on delivered order...');
    const repeatVerifyRes = await fetch(`${baseUrl}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: testOrderId, otp: validOtp }),
    });
    const repeatData = await repeatVerifyRes.json();
    assert.strictEqual(repeatData.success, false, 'Repeated OTP verification must fail');

    const countAfterRepeat = await fetchCountFromApi();
    assert.strictEqual(countAfterRepeat, countAfterDelivery, 'Count must NOT decrease again on duplicate verify');
    console.log(`  ✓ PASS: Duplicate verification rejected, count remained at ${countAfterRepeat}.`);

    // Step 8: Test COD order: Cash collection alone vs delivery
    console.log('\n[Step 8] Testing COD workflow: Cash collection vs delivery...');
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, subtotal, payment_method, payment_status, status)
       VALUES (?, 'cust_verify_cod', 'COD Verification User', 'verify.cod@example.com', ?, '88 Park St, Bangalore', 420.00, 420.00, 'Cash on Delivery', 'PENDING_COLLECTION', 'Picking')`,
      [testCodOrderId, customerMobile]
    );

    const countWithCod = await fetchCountFromApi();
    console.log(`  Count after inserting COD order: ${countWithCod}`);
    assert.strictEqual(countWithCod, initialApiCount + 1, 'COD order awaiting delivery must increment count');

    // Confirm Cash Collection
    console.log('  Confirming COD cash collection...');
    const cashConfirmRes = await fetch(`${baseUrl}/api/orders/${testCodOrderId}/confirm-cash-collection`, {
      method: 'POST',
      headers: { 'x-admin-role': 'admin' },
    });
    const cashData = await cashConfirmRes.json();
    assert.strictEqual(cashData.success, true, 'Cash collection confirmation must succeed');

    const countAfterCash = await fetchCountFromApi();
    console.log(`  Count after cash collection (delivery still pending): ${countAfterCash}`);
    assert.strictEqual(countAfterCash, countWithCod, 'Cash collection alone MUST NOT decrease delivery count');
    console.log('  ✓ PASS: Cash collected but delivery pending -> count unchanged.');

    // Now mark COD order Delivered
    console.log('  Marking COD order as Delivered...');
    const delivRes = await fetch(`${baseUrl}/api/orders/${testCodOrderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-role': 'admin' },
      body: JSON.stringify({ status: 'Delivered' }),
    });
    const delivData = await delivRes.json();
    assert.strictEqual(delivData.success, true, 'Delivery status update must succeed');

    const countAfterCodDelivered = await fetchCountFromApi();
    console.log(`  Count after COD order delivered: ${countAfterCodDelivered}`);
    assert.strictEqual(countAfterCodDelivered, countWithCod - 1, 'Count must decrease by 1 once COD is Delivered');
    console.log('  ✓ PASS: COD delivery decrements count accurately.');

    console.log('\n================================================================');
    console.log('🎉 ALL REAL DATA WORKFLOW CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } finally {
    // Cleanup temporary test orders
    try {
      await pool.query('DELETE FROM otp_records WHERE order_id IN (?, ?)', [testOrderId, testCodOrderId]);
      await pool.query('DELETE FROM payments WHERE order_id IN (?, ?)', [testOrderId, testCodOrderId]);
      await pool.query('DELETE FROM orders WHERE order_id IN (?, ?)', [testOrderId, testCodOrderId]);
    } catch {
      // ignore
    }
  }
}

runRealDataVerification().then(() => process.exit(0)).catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
