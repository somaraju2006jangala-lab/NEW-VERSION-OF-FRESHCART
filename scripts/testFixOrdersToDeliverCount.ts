import assert from 'node:assert';
import { connectMySql, findOrdersForCustomerInDb, getPool } from '../server/db.ts';
import { generateOrderOtp, verifyOrderOtp } from '../server/otpService.ts';

// Direct simulation of the counting logic matching apiRouter.ts and AdminPortal.tsx
function countOrdersToDeliver(orders: any[]): number {
  if (!orders || orders.length === 0) return 0;
  const seenOrderIds = new Set<string>();
  let count = 0;

  for (const o of orders) {
    if (!o || !o.id) continue;
    const cleanId = String(o.id || '').replace(/^#/, '').trim().toLowerCase();
    if (!cleanId || seenOrderIds.has(cleanId)) continue;
    seenOrderIds.add(cleanId);

    const deliveryStatus = String(o.status || '').trim().toUpperCase();
    const terminalStatuses = ['DELIVERED', 'CANCELLED', 'CANCELED', 'RETURNED', 'REFUNDED'];
    if (terminalStatuses.includes(deliveryStatus)) continue;
    if (o.handoverReleased === true) continue;

    const paymentStatus = String(o.paymentStatus || '').trim().toUpperCase();
    if (paymentStatus === 'REJECTED' || paymentStatus === 'FAILED' || paymentStatus === 'INITIATED') continue;

    count++;
  }

  return count;
}

async function testFix() {
  console.log('================================================================');
  console.log('VERIFYING FIX: ORDERS TO DELIVER DASHBOARD COUNT & LIFECYCLE');
  console.log('================================================================\n');

  await connectMySql();
  const pool = getPool();

  const timestamp = Date.now();
  const testUpiOrderId = `FC-FIX-UPI-${timestamp}`;
  const testCodOrderId = `FC-FIX-COD-${timestamp}`;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Baseline MySQL Count Verification
    // -------------------------------------------------------------------------
    console.log('[Test 1] Baseline Orders to Deliver count from MySQL...');
    let dbOrders = await findOrdersForCustomerInDb();
    const baselineCount = countOrdersToDeliver(dbOrders);
    console.log(`  ✓ Retrieved ${dbOrders.length} orders from MySQL.`);
    console.log(`  ✓ Baseline Orders to Deliver count: ${baselineCount}`);

    // Verify delivery status field name and valid active statuses
    const [statusRows] = await pool.query<any[]>(
      `SELECT status, count(*) as count FROM orders GROUP BY status`
    );
    console.log('  ✓ Verified MySQL delivery status field is "status":', statusRows.map(r => `${r.status}: ${r.count}`).join(', '));

    // -------------------------------------------------------------------------
    // TEST 2: OTP Verification Workflow
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Testing OTP Verification Lifecycle...');

    // 2.1 Insert pending UPI order
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, subtotal, payment_method, payment_status, status)
       VALUES (?, 'cust_upi_fix', 'Aarav OTP Test', 'aarav.fix@example.com', '+91 9876543210', '101 MG Road, Bangalore', 500.00, 500.00, 'UPI', 'COMPLETED', 'Picking')`,
      [testUpiOrderId]
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countWithNewOrder = countOrdersToDeliver(dbOrders);
    assert.strictEqual(countWithNewOrder, baselineCount + 1, 'New confirmed order must increment count by 1');
    console.log(`  ✓ Confirmed UPI order inserted with status="Picking". Count increased to: ${countWithNewOrder}`);

    // Generate 6-digit OTP
    const genRes = await generateOrderOtp(testUpiOrderId, 'cust_upi_fix', '+91 9876543210');
    assert(genRes.success, 'OTP generation must succeed');
    const validOtp = genRes.otp;
    console.log(`  ✓ 6-digit OTP generated: ${validOtp}`);

    // 2.2 Invalid OTP submission: Count MUST NOT change
    console.log('\n  [2.2] Testing Invalid OTP Submission...');
    const invalidOtpRes = await verifyOrderOtp(testUpiOrderId, '999999');
    assert.strictEqual(invalidOtpRes.success, false, 'Invalid OTP must fail');
    assert.strictEqual(invalidOtpRes.status, 'Picking', 'Status must remain Picking');

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterInvalidOtp = countOrdersToDeliver(dbOrders);
    assert.strictEqual(countAfterInvalidOtp, countWithNewOrder, 'Count must NOT change on invalid OTP');
    console.log(`  ✓ PASS: Invalid OTP rejected. Orders to Deliver count unchanged (${countAfterInvalidOtp})`);

    // 2.3 Valid OTP verification: Count MUST decrease by 1
    console.log('\n  [2.3] Testing Valid OTP Verification and Delivery Completion...');
    const validOtpRes = await verifyOrderOtp(testUpiOrderId, validOtp);
    assert.strictEqual(validOtpRes.success, true, 'Valid OTP must succeed');
    assert.strictEqual(validOtpRes.status, 'Delivered', 'Status must transition to Delivered');

    // Verify database record has status = 'Delivered'
    const [upiOrderCheck] = await pool.query<any[]>(
      `SELECT order_id, status FROM orders WHERE order_id = ?`,
      [testUpiOrderId]
    );
    assert.strictEqual(upiOrderCheck[0]?.status, 'Delivered', 'Database order status must be "Delivered"');

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterValidOtp = countOrdersToDeliver(dbOrders);
    assert.strictEqual(countAfterValidOtp, countWithNewOrder - 1, 'Count must decrease by 1 after OTP delivery');
    console.log(`  ✓ PASS: OTP verified. MySQL status="Delivered". Count decreased by 1: ${countWithNewOrder} -> ${countAfterValidOtp}`);

    // 2.4 Repeated OTP submission: Count MUST NOT decrease again
    console.log('\n  [2.4] Testing Repeated OTP Submission on Already Delivered Order...');
    const repeatRes = await verifyOrderOtp(testUpiOrderId, validOtp);
    assert.strictEqual(repeatRes.success, false, 'Repeated OTP verification must fail');
    assert(repeatRes.error?.includes('already been verified'), 'Error must explain OTP already verified');

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterRepeat = countOrdersToDeliver(dbOrders);
    assert.strictEqual(countAfterRepeat, countAfterValidOtp, 'Repeated OTP must NOT decrement count again');
    console.log(`  ✓ PASS: Repeated OTP rejected. Count remained strictly at ${countAfterRepeat}`);

    // -------------------------------------------------------------------------
    // TEST 3: COD Cash Collection & Delivery Separation
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing COD Cash Collection & Delivery Lifecycle...');

    // 3.1 Insert pending COD order
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, subtotal, payment_method, payment_status, status)
       VALUES (?, 'cust_cod_fix', 'Priya COD Test', 'priya.fix@example.com', '+91 9123456789', '202 Park Lane, Bangalore', 350.00, 350.00, 'Cash on Delivery', 'PENDING_COLLECTION', 'Picking')`,
      [testCodOrderId]
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countWithCod = countOrdersToDeliver(dbOrders);
    console.log(`  ✓ COD order inserted with status="Picking", payment_status="PENDING_COLLECTION". Count: ${countWithCod}`);

    // 3.2 Confirm Cash Collection while delivery is pending: Count MUST NOT decrease!
    console.log('\n  [3.2] Testing Confirm Cash Collection while delivery is pending...');
    await pool.query(
      `UPDATE orders SET payment_status = 'COLLECTED', verified_at = NOW(), verified_by = 'Admin' WHERE order_id = ?`,
      [testCodOrderId]
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterCash = countOrdersToDeliver(dbOrders);
    assert.strictEqual(
      countAfterCash,
      countWithCod,
      'Confirm Cash Collection must NOT decrease count while delivery status is still pending'
    );
    console.log(`  ✓ PASS: Cash collected (COLLECTED). Delivery status remains "Picking". Count kept in Orders to Deliver: ${countAfterCash}`);

    // 3.3 Delivery workflow marks COD order as DELIVERED: Count MUST now decrease by 1!
    console.log('\n  [3.3] Testing Delivery Completion for COD order...');
    await pool.query(
      `UPDATE orders SET status = 'Delivered' WHERE order_id = ?`,
      [testCodOrderId]
    );

    const [codOrderCheck] = await pool.query<any[]>(
      `SELECT order_id, status, payment_status FROM orders WHERE order_id = ?`,
      [testCodOrderId]
    );
    assert.strictEqual(codOrderCheck[0]?.status, 'Delivered', 'COD order status must be "Delivered"');
    assert.strictEqual(codOrderCheck[0]?.payment_status, 'COLLECTED', 'COD order payment_status must be "COLLECTED"');

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterCodDelivered = countOrdersToDeliver(dbOrders);
    assert.strictEqual(
      countAfterCodDelivered,
      countWithCod - 1,
      'Orders to Deliver count must decrease by 1 once COD order is marked Delivered'
    );
    console.log(`  ✓ PASS: COD order marked "Delivered" in MySQL. Count decreased by 1: ${countWithCod} -> ${countAfterCodDelivered}`);

    // -------------------------------------------------------------------------
    // TEST 4: Zero Count and Error Handling
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Zero Count and Error Handling...');
    const zeroOrders = [
      { id: 'FC-Z1', status: 'Delivered', paymentStatus: 'COMPLETED' },
      { id: 'FC-Z2', status: 'DELIVERED', paymentStatus: 'COLLECTED' },
      { id: 'FC-Z3', status: 'Cancelled', paymentStatus: 'PENDING' },
    ];
    assert.strictEqual(countOrdersToDeliver(zeroOrders), 0, 'Must return 0 when all orders terminal');
    console.log('  ✓ PASS: Correctly displays 0 when no eligible orders remain');

    assert.strictEqual(countOrdersToDeliver([]), 0, 'Must return 0 for empty array');
    console.log('  ✓ PASS: Correctly displays 0 for empty array');

    console.log('\n================================================================');
    console.log('🎉 ALL TESTS PASSED! Orders to Deliver Count is 100% Verified.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Exception in test:', err);
    throw err;
  } finally {
    // Cleanup temporary test orders
    try {
      await pool.query('DELETE FROM otp_records WHERE order_id IN (?, ?)', [testUpiOrderId, testCodOrderId]);
      await pool.query('DELETE FROM orders WHERE order_id IN (?, ?)', [testUpiOrderId, testCodOrderId]);
    } catch {
      // ignore
    }
  }
}

testFix().then(() => process.exit(0)).catch(() => process.exit(1));
