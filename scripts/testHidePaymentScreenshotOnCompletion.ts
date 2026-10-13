import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { CustomerOrder } from '../src/types';
import {
  getPool,
  verifyUpiPaymentInDb,
  findOrdersForCustomerInDb,
  findOrderInDb,
  upsertOrderInDb,
  savePaymentScreenshotInDb,
} from '../server/db';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Pure helper mirroring CustomerDashboard's upload screenshot section logic
 */
function shouldRenderCustomerUploadSection(order: CustomerOrder): boolean {
  const isUpi =
    order.paymentMethod === 'UPI' ||
    order.paymentMethod?.toLowerCase().includes('upi') ||
    order.paymentMethod?.toLowerCase().includes('phonepe') ||
    order.paymentMethod?.toLowerCase().includes('google pay') ||
    order.paymentMethod?.toLowerCase().includes('gpay') ||
    order.paymentMethod?.toLowerCase().includes('paytm') ||
    order.paymentMethod?.toLowerCase().includes('online');

  const isCompleted =
    order.paymentStatus?.toUpperCase() === 'COMPLETED' ||
    order.paymentStatus?.toUpperCase() === 'PAID';

  // When online payment is COMPLETED, automatically remove the entire Upload Payment Screenshot section
  if (!isUpi || isCompleted) return false;
  return true;
}

/**
 * Pure helper mirroring CustomerDashboard's payment status badge logic
 */
function getCustomerPaymentStatusDisplay(order: CustomerOrder): {
  paymentMethod: string;
  paymentStatus: string;
} {
  const paymentMethod = order.paymentMethod || 'Online';
  const paymentStatus =
    order.paymentStatus?.toUpperCase() === 'COMPLETED' || order.paymentStatus?.toUpperCase() === 'PAID'
      ? 'COMPLETED'
      : order.paymentStatus === 'PENDING_VERIFICATION' || order.paymentStatus === 'PENDING VERIFICATION'
      ? 'PENDING VERIFICATION'
      : order.paymentStatus === 'REJECTED'
      ? 'REJECTED'
      : (order.paymentStatus || 'PENDING');

  return { paymentMethod, paymentStatus };
}

async function runTests() {
  console.log('========================================================================');
  console.log('Testing: FreshCart Hide Payment Screenshot Upload After Admin Verification');
  console.log('========================================================================\n');

  const pool = getPool();
  const testOrderId = `FC-TEST-${Date.now()}`;
  const testCustomerId = `cust-test-${Date.now()}`;

  try {
    // ----------------------------------------------------
    // TEST 1: Initial Online Order with PENDING_VERIFICATION
    // ----------------------------------------------------
    console.log('1. Testing PENDING_VERIFICATION online payment...');
    await upsertOrderInDb({
      orderId: testOrderId,
      customerId: testCustomerId,
      customerName: 'Test Customer',
      customerEmail: 'test@freshcart.com',
      customerPhone: '9876543210',
      deliveryAddress: '123 Green Lane, Bengaluru',
      deliveryTimeSlot: 'Instant 20-min',
      items: [
        {
          product: { id: 'p1', title: 'Organic Spinach', price: 60, unit: 'bunch' },
          quantity: 2,
        },
      ],
      subtotal: 120,
      discount: 0,
      total: 120,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING_VERIFICATION',
      screenshotUrl: `/api/payments/screenshot/${testOrderId}`,
    });

    await savePaymentScreenshotInDb({
      orderId: testOrderId,
      customerId: testCustomerId,
      customerName: 'Test Customer',
      mobile: '9876543210',
      email: 'test@freshcart.com',
      total: 120,
      screenshotPath: `/tmp/fake_proof_${testOrderId}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: 1024,
    });

    // Verify DB state
    const dbOrderPending = await findOrderInDb(testOrderId);
    assert(dbOrderPending, 'Order must exist in MySQL');
    assert.strictEqual(dbOrderPending.paymentStatus, 'PENDING_VERIFICATION');

    // Customer Portal should keep upload section present (showing preview & pending state)
    const showUploadPending = shouldRenderCustomerUploadSection(dbOrderPending);
    assert.strictEqual(showUploadPending, true, 'Upload section must be present when payment is PENDING_VERIFICATION');

    const displayPending = getCustomerPaymentStatusDisplay(dbOrderPending);
    assert.strictEqual(displayPending.paymentStatus, 'PENDING VERIFICATION');
    console.log('   ✓ PENDING_VERIFICATION: Upload section is preserved, badge displays "Payment Status: PENDING VERIFICATION"');

    // ----------------------------------------------------
    // TEST 2: REJECTED Online Order
    // ----------------------------------------------------
    console.log('\n2. Testing REJECTED online payment workflow...');
    const rejectResult = await verifyUpiPaymentInDb({
      orderId: testOrderId,
      adminUsername: 'Admin',
      action: 'REJECT',
      notes: 'Screenshot blurred, please upload clear transaction receipt.',
    });
    assert.strictEqual(rejectResult.success, true, 'Rejection in MySQL must succeed');

    // Verify DB state
    const dbOrderRejected = await findOrderInDb(testOrderId);
    assert(dbOrderRejected, 'Order must exist in MySQL');
    assert.strictEqual(dbOrderRejected.paymentStatus, 'REJECTED');

    // Customer Portal should keep upload section present for retry
    const showUploadRejected = shouldRenderCustomerUploadSection(dbOrderRejected);
    assert.strictEqual(showUploadRejected, true, 'Upload section must be present when payment is REJECTED to allow retry');

    const displayRejected = getCustomerPaymentStatusDisplay(dbOrderRejected);
    assert.strictEqual(displayRejected.paymentStatus, 'REJECTED');
    console.log('   ✓ REJECTED: Upload section is preserved with retry upload workflow, badge displays "Payment Status: REJECTED"');

    // ----------------------------------------------------
    // TEST 3: Admin Approves Payment -> Saved as COMPLETED in Database
    // ----------------------------------------------------
    console.log('\n3. Testing Admin Approval -> Database saves COMPLETED & Upload Section is Removed...');
    const approveResult = await verifyUpiPaymentInDb({
      orderId: testOrderId,
      adminUsername: 'Admin',
      action: 'APPROVE',
    });
    assert.strictEqual(approveResult.success, true, 'Approval in MySQL must succeed');

    // Read authoritative persisted state from MySQL
    const dbOrderApproved = await findOrderInDb(testOrderId);
    assert(dbOrderApproved, 'Order must exist in MySQL');
    assert.strictEqual(dbOrderApproved.paymentStatus, 'COMPLETED', 'Persisted status in MySQL orders table must be COMPLETED');

    // Check payments table
    const [payRows] = await pool.query<any[]>(
      'SELECT payment_status FROM payments WHERE order_id = ?',
      [testOrderId]
    );
    assert.strictEqual(payRows[0]?.payment_status, 'COMPLETED', 'Persisted status in MySQL payments table must be COMPLETED');

    // Customer Portal: upload section MUST be completely removed!
    const showUploadCompleted = shouldRenderCustomerUploadSection(dbOrderApproved);
    assert.strictEqual(showUploadCompleted, false, 'Entire Upload Payment Screenshot section MUST be removed for COMPLETED payment');

    // Order details, payment method, Payment Status: COMPLETED, and timeline remain visible
    const displayCompleted = getCustomerPaymentStatusDisplay(dbOrderApproved);
    assert.strictEqual(displayCompleted.paymentStatus, 'COMPLETED');
    assert.strictEqual(displayCompleted.paymentMethod, 'UPI');
    assert(dbOrderApproved.items.length > 0, 'Order details/items must remain visible');
    assert(dbOrderApproved.total === 120, 'Order total must remain visible');
    console.log('   ✓ Database successfully saved payment status as COMPLETED in both orders and payments tables');
    console.log('   ✓ Upload section, buttons, controls, and instructions are completely removed from customer view');
    console.log('   ✓ Order details, items, payment method, and "Payment Status: COMPLETED" remain fully visible');

    // ----------------------------------------------------
    // TEST 4: Page Refresh / Dynamic Order Reload from MySQL
    // ----------------------------------------------------
    console.log('\n4. Testing Page Refresh / Dynamic Order Reload from MySQL...');
    // Simulate customer reloading or polling from /api/orders
    const refreshedOrders = await findOrdersForCustomerInDb(dbOrderApproved.customerId);
    assert(refreshedOrders.length > 0, 'Customer orders must be returned on reload');
    const refreshedOrder = refreshedOrders.find((o) => o.id === testOrderId || o.id === `#${testOrderId}`);
    assert(refreshedOrder, 'Target order must be present in customer orders list');
    assert.strictEqual(refreshedOrder.paymentStatus, 'COMPLETED', 'Persisted status on refresh must be COMPLETED');

    const showUploadAfterRefresh = shouldRenderCustomerUploadSection(refreshedOrder);
    assert.strictEqual(showUploadAfterRefresh, false, 'Upload section must remain hidden after page refresh / reload');
    console.log('   ✓ Page refresh / API query correctly reads persisted COMPLETED status and keeps upload section removed');

    // ----------------------------------------------------
    // TEST 5: Verify COD Order is Unaffected
    // ----------------------------------------------------
    console.log('\n5. Testing COD order behavior...');
    const codOrder: CustomerOrder = {
      id: '#FC-TEST-COD',
      customerName: 'Test COD',
      customerId: 'cod-cust',
      deliveryAddress: '456 Market St',
      deliveryTimeSlot: 'Standard',
      items: [],
      subtotal: 200,
      discount: 0,
      total: 200,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      paymentMethod: 'Cash on Delivery',
      paymentStatus: 'COD',
    };
    const showUploadCod = shouldRenderCustomerUploadSection(codOrder);
    assert.strictEqual(showUploadCod, false, 'COD orders must never render the upload screenshot section');
    console.log('   ✓ COD behavior is preserved: upload section is never displayed');

    console.log('\n========================================================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
    console.log('========================================================================\n');
  } finally {
    // Clean up test data
    try {
      await pool.query('DELETE FROM order_items WHERE order_id = ?', [testOrderId]);
      await pool.query('DELETE FROM payments WHERE order_id IN (?, ?)', [testOrderId, `#${testOrderId}`]);
      await pool.query('DELETE FROM orders WHERE order_id IN (?, ?)', [testOrderId, `#${testOrderId}`]);
      await pool.end();
    } catch {}
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
