import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDisplayPaymentInfo } from '../src/components/AdminPortal';
import { CustomerOrder } from '../src/types';
import { getPool, updateOrderPaymentStatusInDb, findOrdersForCustomerInDb } from '../server/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTests() {
  console.log('====================================================');
  console.log('Testing FreshCart Customer Orders Ledger Payment Rules');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: Online Payment - COMPLETED scenario
  // ----------------------------------------------------
  console.log('Test 1: Online payment verified & approved by admin -> COMPLETED');
  const onlineApprovedOrder: CustomerOrder = {
    id: '#FC-TEST-ONLINE-PAID',
    customerName: 'Rahul Verma',
    customerId: 'rahul123',
    deliveryAddress: 'Bengaluru',
    deliveryTimeSlot: 'Express',
    items: [],
    subtotal: 500,
    discount: 0,
    total: 500,
    status: 'Picking',
    createdAt: new Date().toISOString(),
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
  };
  const res1 = getDisplayPaymentInfo(onlineApprovedOrder);
  assert.strictEqual(res1.paymentMethod, 'Online (UPI)');
  assert.strictEqual(res1.paymentStatus, 'COMPLETED');
  assert.strictEqual(res1.badgeStyle.text, 'text-[#10b981]');
  console.log('✓ TEST 1 PASSED: Online payment approved displays "Payment Method: Online (UPI)", "Payment Status: COMPLETED" with green badge.');

  // ----------------------------------------------------
  // TEST 2: Online Payment - PENDING VERIFICATION scenario
  // ----------------------------------------------------
  console.log('\nTest 2: Online payment awaiting verification -> PENDING VERIFICATION');
  const onlinePendingProofOrder: CustomerOrder = {
    id: '#FC-TEST-ONLINE-PROOF',
    customerName: 'Rahul Verma',
    customerId: 'rahul123',
    deliveryAddress: 'Bengaluru',
    deliveryTimeSlot: 'Express',
    items: [],
    subtotal: 500,
    discount: 0,
    total: 500,
    status: 'Picking',
    createdAt: new Date().toISOString(),
    paymentMethod: 'UPI',
    paymentStatus: 'PENDING_VERIFICATION',
    screenshotUrl: '/api/payments/screenshot/FC-TEST-ONLINE-PROOF',
  };
  const res2 = getDisplayPaymentInfo(onlinePendingProofOrder);
  assert.strictEqual(res2.paymentMethod, 'Online (UPI)');
  assert.strictEqual(res2.paymentStatus, 'PENDING VERIFICATION');
  assert.notStrictEqual(res2.paymentStatus, 'COMPLETED', 'Screenshot upload must NOT mark payment as COMPLETED');
  assert.strictEqual(res2.badgeStyle.text, 'text-[#f59e0b]');
  console.log('✓ TEST 2 PASSED: Online payment with uploaded proof displays "Payment Status: PENDING VERIFICATION" (not completed).');

  // ----------------------------------------------------
  // TEST 3: Online Payment - REJECTED scenario
  // ----------------------------------------------------
  console.log('\nTest 3: Online payment proof rejected by admin -> REJECTED');
  const onlineRejectedOrder: CustomerOrder = {
    id: '#FC-TEST-ONLINE-REJ',
    customerName: 'Rahul Verma',
    customerId: 'rahul123',
    deliveryAddress: 'Bengaluru',
    deliveryTimeSlot: 'Express',
    items: [],
    subtotal: 500,
    discount: 0,
    total: 500,
    status: 'Picking',
    createdAt: new Date().toISOString(),
    paymentMethod: 'PhonePe',
    paymentStatus: 'REJECTED',
  };
  const res3 = getDisplayPaymentInfo(onlineRejectedOrder);
  assert.strictEqual(res3.paymentMethod, 'Online (PhonePe)');
  assert.strictEqual(res3.paymentStatus, 'REJECTED');
  assert.strictEqual(res3.badgeStyle.text, 'text-[#ef4444]');
  console.log('✓ TEST 3 PASSED: Rejected online payment displays "Payment Status: REJECTED" with red badge.');

  // ----------------------------------------------------
  // TEST 4: Online Payment - UNPAID scenario
  // ----------------------------------------------------
  console.log('\nTest 4: Online payment with no successful payment recorded -> UNPAID');
  const onlineUnpaidOrder: CustomerOrder = {
    id: '#FC-TEST-ONLINE-UNPAID',
    customerName: 'Rahul Verma',
    customerId: 'rahul123',
    deliveryAddress: 'Bengaluru',
    deliveryTimeSlot: 'Express',
    items: [],
    subtotal: 500,
    discount: 0,
    total: 500,
    status: 'Picking',
    createdAt: new Date().toISOString(),
    paymentMethod: 'Google Pay',
    paymentStatus: 'PENDING',
  };
  const res4 = getDisplayPaymentInfo(onlineUnpaidOrder);
  assert.strictEqual(res4.paymentMethod, 'Online (Google Pay)');
  assert.strictEqual(res4.paymentStatus, 'UNPAID');
  assert.strictEqual(res4.badgeStyle.text, 'text-[#ef4444]');
  console.log('✓ TEST 4 PASSED: Unpaid online payment displays "Payment Status: UNPAID".');

  // ----------------------------------------------------
  // TEST 5: Cash on Delivery (COD) - Before cash collected (due)
  // ----------------------------------------------------
  console.log('\nTest 5: Cash on Delivery (COD) before cash is collected -> COD');
  const codDueOrder: CustomerOrder = {
    id: '#FC-1005',
    customerName: 'Rahul',
    customerId: 'rahul123',
    deliveryAddress: 'Bengaluru',
    deliveryTimeSlot: 'Express',
    items: [],
    subtotal: 300,
    discount: 0,
    total: 300,
    status: 'Picking',
    createdAt: new Date().toISOString(),
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'PENDING',
  };
  const res5 = getDisplayPaymentInfo(codDueOrder);
  assert.strictEqual(res5.paymentMethod, 'Cash on Delivery');
  assert.strictEqual(res5.paymentStatus, 'COD');
  assert.notStrictEqual(res5.paymentStatus, 'COMPLETED', 'COD must not be marked as COMPLETED before collection');
  assert.strictEqual(res5.badgeStyle.text, 'text-[#f59e0b]');
  console.log('✓ TEST 5 PASSED: Cash on Delivery before collection displays "Payment Method: Cash on Delivery", "Payment Status: COD".');

  // ----------------------------------------------------
  // TEST 6: Cash on Delivery (COD) - Cash collection confirmed
  // ----------------------------------------------------
  console.log('\nTest 6: Cash on Delivery (COD) once cash collection is confirmed -> COMPLETED');
  const codCompletedOrder: CustomerOrder = {
    id: '#FC-1005',
    customerName: 'Rahul',
    customerId: 'rahul123',
    deliveryAddress: 'Bengaluru',
    deliveryTimeSlot: 'Express',
    items: [],
    subtotal: 300,
    discount: 0,
    total: 300,
    status: 'Delivered',
    createdAt: new Date().toISOString(),
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'COMPLETED',
  };
  const res6 = getDisplayPaymentInfo(codCompletedOrder);
  assert.strictEqual(res6.paymentMethod, 'Cash on Delivery');
  assert.strictEqual(res6.paymentStatus, 'COMPLETED');
  assert.strictEqual(res6.badgeStyle.text, 'text-[#10b981]');
  console.log('✓ TEST 6 PASSED: Confirmed Cash on Delivery displays "Payment Method: Cash on Delivery", "Payment Status: COMPLETED".');

  // ----------------------------------------------------
  // TEST 7: MySQL/TiDB Database Integration
  // ----------------------------------------------------
  console.log('\nTest 7: MySQL database persistence for payment status updates');
  const testOrderId = `FC-TEST-COD-${Date.now()}`;
  const pool = getPool();

  // Create temporary order in MySQL
  await pool.query(
    `INSERT INTO orders (order_id, customer_id, customer_name, delivery_address, total, subtotal, status, payment_method, payment_status)
     VALUES (?, 'cust-test', 'Integration Test User', '123 Test Lane', 250.00, 250.00, 'Picking', 'Cash on Delivery', 'PENDING')`,
    [testOrderId]
  );

  // Verify it reads as COD due initially
  const initialDbOrders = await findOrdersForCustomerInDb('cust-test');
  const foundOrder = initialDbOrders.find((o) => o.id === testOrderId);
  assert(foundOrder, 'Order must be found in database');
  const initialInfo = getDisplayPaymentInfo(foundOrder);
  assert.strictEqual(initialInfo.paymentMethod, 'Cash on Delivery');
  assert.strictEqual(initialInfo.paymentStatus, 'COD');
  console.log('  -> Newly inserted DB COD order resolved as "Payment Status: COD"');

  // Admin confirms cash collection in database
  const updateSuccess = await updateOrderPaymentStatusInDb(testOrderId, 'COMPLETED', 'TestAdmin');
  assert.strictEqual(updateSuccess, true, 'Database payment status update must succeed');

  // Read back from database
  const updatedDbOrders = await findOrdersForCustomerInDb('cust-test');
  const foundUpdated = updatedDbOrders.find((o) => o.id === testOrderId);
  assert(foundUpdated, 'Updated order must be found in database');
  assert.strictEqual(foundUpdated.paymentStatus, 'COMPLETED');
  const updatedInfo = getDisplayPaymentInfo(foundUpdated);
  assert.strictEqual(updatedInfo.paymentStatus, 'COMPLETED');
  console.log('  -> Database confirmed order resolved as "Payment Status: COMPLETED"');

  // Clean up test order
  await pool.query(`DELETE FROM orders WHERE order_id = ?`, [testOrderId]);
  await pool.query(`DELETE FROM payments WHERE order_id = ?`, [testOrderId]);
  console.log('✓ TEST 7 PASSED: Database integration correctly reads and persists payment method and status.');

  console.log('\n====================================================');
  console.log('ALL PAYMENT METHOD AND PAYMENT STATUS TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
