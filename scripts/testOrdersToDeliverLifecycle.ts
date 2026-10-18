import assert from 'node:assert';
import { connectMySql, findOrdersForCustomerInDb, getPool } from '../server/db.ts';
import { generateOrderOtp, verifyOrderOtp } from '../server/otpService.ts';

// Reusable counting function matching the exact AdminPortal.tsx and apiRouter.ts logic
function calculateOrdersToDeliver(orders: any[]): number {
  if (!orders || orders.length === 0) return 0;
  const seenOrderIds = new Set<string>();
  let count = 0;

  for (const order of orders) {
    if (!order || !order.id) continue;
    const cleanId = String(order.id).replace(/^#/, '').trim().toLowerCase();
    if (!cleanId || seenOrderIds.has(cleanId)) continue;
    seenOrderIds.add(cleanId);

    // Exclude terminal statuses
    const deliveryStatus = String(order.status || '').trim().toUpperCase();
    const terminalStatuses = ['DELIVERED', 'CANCELLED', 'CANCELED', 'RETURNED', 'REFUNDED'];
    if (terminalStatuses.includes(deliveryStatus)) continue;
    if (order.handoverReleased === true) continue;

    // Exclude unconfirmed, rejected, or draft payments
    const paymentStatus = String(order.paymentStatus || '').trim().toUpperCase();
    if (paymentStatus === 'REJECTED' || paymentStatus === 'FAILED' || paymentStatus === 'INITIATED') continue;

    count++;
  }

  return count;
}

async function runLifecycleTests() {
  console.log('================================================================');
  console.log('TESTING "ORDERS TO DELIVER" COUNT AFTER OTP & COD LIFECYCLE');
  console.log('================================================================\n');

  // Connect to MySQL
  await connectMySql();
  const pool = getPool();

  const timestamp = Date.now();
  const upiOrderId = `FC-TEST-UPI-${timestamp}`;
  const codOrderId = `FC-TEST-COD-${timestamp}`;

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: OTP DELIVERY WORKFLOW & ORDERS TO DELIVER COUNT
    // -------------------------------------------------------------------------
    console.log('[Suite 1] OTP Delivery Lifecycle and Real-Time Count Updates');

    // 1.1 Insert a confirmed UPI order awaiting delivery
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, subtotal, payment_method, payment_status, status)
       VALUES (?, 'test_cust_otp', 'Test OTP User', 'test.otp@freshcart.com', '+91 9876543210', '123 Market St', 450.00, 450.00, 'UPI', 'COMPLETED', 'Picking')`,
      [upiOrderId]
    );

    let dbOrders = await findOrdersForCustomerInDb();
    let initialCount = calculateOrdersToDeliver(dbOrders);
    console.log(`  ✓ Confirmed UPI order ${upiOrderId} created. Current Orders to Deliver count: ${initialCount}`);

    // Generate valid 6-digit OTP for this order
    const otpRes = await generateOrderOtp(upiOrderId, 'test_cust_otp', '+91 9876543210');
    assert(otpRes.success, 'OTP generation should succeed for approved UPI order');
    const correctOtp = otpRes.otp;
    console.log(`  ✓ Handover OTP generated: ${correctOtp}`);

    // 1.2 Test Invalid OTP: Count MUST NOT change
    console.log('\n  [1.2] Testing Invalid OTP Submission...');
    const invalidVerifyRes = await verifyOrderOtp(upiOrderId, '000000');
    assert.strictEqual(invalidVerifyRes.success, false, 'Invalid OTP must fail verification');
    assert.strictEqual(invalidVerifyRes.status, 'Picking', 'Status must remain Picking after invalid OTP');

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterInvalidOtp = calculateOrdersToDeliver(dbOrders);
    assert.strictEqual(countAfterInvalidOtp, initialCount, 'Invalid OTP must NOT change Orders to Deliver count');
    console.log(`  ✓ PASS: Invalid OTP rejected. Orders to Deliver count unchanged (${countAfterInvalidOtp})`);

    // 1.3 Test Successful OTP Delivery: Count MUST decrease by exactly 1
    console.log('\n  [1.3] Testing Valid OTP Verification and Delivery Handover...');
    const validVerifyRes = await verifyOrderOtp(upiOrderId, correctOtp);
    assert.strictEqual(validVerifyRes.success, true, 'Valid OTP must succeed');
    assert.strictEqual(validVerifyRes.status, 'Delivered', 'Order status must be updated to Delivered in DB');

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterValidOtp = calculateOrdersToDeliver(dbOrders);
    assert.strictEqual(countAfterValidOtp, initialCount - 1, 'Orders to Deliver count must decrease by 1 upon valid OTP delivery');
    console.log(`  ✓ PASS: Valid OTP confirmed. Delivery status saved to MySQL. Count decreased by 1: ${initialCount} -> ${countAfterValidOtp}`);

    // 1.4 Test Repeated OTP Submission for Already Delivered Order: Count MUST NOT decrease again
    console.log('\n  [1.4] Testing Repeated OTP Submission on Delivered Order...');
    const repeatVerifyRes = await verifyOrderOtp(upiOrderId, correctOtp);
    assert.strictEqual(repeatVerifyRes.success, false, 'Repeated OTP verification must be rejected');
    assert(
      repeatVerifyRes.error?.includes('already been verified'),
      `Expected already verified error, got: ${repeatVerifyRes.error}`
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterRepeat = calculateOrdersToDeliver(dbOrders);
    assert.strictEqual(countAfterRepeat, countAfterValidOtp, 'Repeated OTP must NOT decrement Orders to Deliver count again');
    console.log(`  ✓ PASS: Repeated OTP rejected. Orders to Deliver count remained strictly at ${countAfterRepeat}`);

    // -------------------------------------------------------------------------
    // TEST SUITE 2: COD CASH COLLECTION & DELIVERY LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n[Suite 2] COD Cash Collection & Delivery Separation');

    // 2.1 Insert a pending COD order
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, subtotal, payment_method, payment_status, status)
       VALUES (?, 'test_cust_cod', 'Test COD User', 'test.cod@freshcart.com', '+91 9123456789', '456 Commercial St', 350.00, 350.00, 'Cash on Delivery', 'PENDING_COLLECTION', 'Picking')`,
      [codOrderId]
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countBeforeCod = calculateOrdersToDeliver(dbOrders);
    console.log(`  ✓ COD order ${codOrderId} created. Orders to Deliver count: ${countBeforeCod}`);

    // 2.2 Confirm Cash Collection while order is still awaiting delivery: Count MUST NOT decrease!
    console.log('\n  [2.2] Testing Confirm Cash Collection while order is awaiting delivery...');
    await pool.query(
      `UPDATE orders SET payment_status = 'COLLECTED', verified_at = NOW(), verified_by = 'Staff Admin' WHERE order_id = ?`,
      [codOrderId]
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterCashCollected = calculateOrdersToDeliver(dbOrders);
    assert.strictEqual(
      countAfterCashCollected,
      countBeforeCod,
      'Confirming Cash Collection must NOT decrease count while order is still awaiting delivery'
    );
    console.log(`  ✓ PASS: Cash collected (COLLECTED recorded in MySQL), order status remains "Picking". Count kept in Orders to Deliver: ${countAfterCashCollected}`);

    // 2.3 Delivery Workflow completes and marks order as DELIVERED: Count MUST now decrease by 1!
    console.log('\n  [2.3] Testing Delivery Completion for COD order...');
    await pool.query(
      `UPDATE orders SET status = 'Delivered' WHERE order_id = ?`,
      [codOrderId]
    );

    dbOrders = await findOrdersForCustomerInDb();
    const countAfterCodDelivered = calculateOrdersToDeliver(dbOrders);
    assert.strictEqual(
      countAfterCodDelivered,
      countBeforeCod - 1,
      'Orders to Deliver count must decrease by 1 once COD order is marked Delivered in MySQL'
    );
    console.log(`  ✓ PASS: COD order marked "Delivered" in MySQL. Orders to Deliver count decreased by 1: ${countBeforeCod} -> ${countAfterCodDelivered}`);

    // -------------------------------------------------------------------------
    // TEST SUITE 3: EDGE CASES & ZERO COUNT
    // -------------------------------------------------------------------------
    console.log('\n[Suite 3] Edge Cases, Deduplication & Zero Count Display');

    // 3.1 All orders delivered or cancelled -> returns 0
    const allTerminalOrders = [
      { id: '#FC-1', status: 'Delivered', paymentStatus: 'COMPLETED' },
      { id: '#FC-2', status: 'DELIVERED', paymentStatus: 'COLLECTED' },
      { id: '#FC-3', status: 'Cancelled', paymentStatus: 'COLLECTED' },
      { id: '#FC-4', status: 'Picking', paymentStatus: 'COLLECTED', handoverReleased: true },
    ];
    assert.strictEqual(calculateOrdersToDeliver(allTerminalOrders), 0, 'Must return 0 when all orders terminal');
    console.log('  ✓ PASS: Returns 0 when no eligible orders remain');

    // 3.2 Empty orders array
    assert.strictEqual(calculateOrdersToDeliver([]), 0, 'Must return 0 for empty array');
    console.log('  ✓ PASS: Returns 0 for empty list');

    // 3.3 Duplicate orders with same ID
    const duplicateList = [
      { id: '#FC-10', status: 'Picking', paymentStatus: 'COMPLETED' },
      { id: 'FC-10', status: 'Picking', paymentStatus: 'COMPLETED' },
      { id: '#fc-10', status: 'Picking', paymentStatus: 'COMPLETED' },
    ];
    assert.strictEqual(calculateOrdersToDeliver(duplicateList), 1, 'Duplicate IDs must be counted strictly once');
    console.log('  ✓ PASS: Duplicate IDs deduplicated (counted exactly once)');

    console.log('\n================================================================');
    console.log('🎉 ALL LIFECYCLE, OTP, COD, AND COUNT TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Exception in test:', err);
    throw err;
  } finally {
    // Clean up temporary test orders
    try {
      await pool.query('DELETE FROM otp_records WHERE order_id IN (?, ?)', [upiOrderId, codOrderId]);
      await pool.query('DELETE FROM orders WHERE order_id IN (?, ?)', [upiOrderId, codOrderId]);
    } catch {
      // Ignore cleanup error
    }
  }
}

runLifecycleTests().catch((err) => {
  console.error('\n❌ Test run failed:', err);
  process.exit(1);
});
