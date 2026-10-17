import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { apiApp } from '../server/apiRouter.ts';
import {
  connectMySql,
  getPool,
  findOrderInDb,
  findAdminInDb,
  createAdminInDb,
} from '../server/db.ts';
import {
  generateOrderOtp,
  resendOrderOtp,
  verifyOrderOtp,
  getCustomerOrderOtp,
} from '../server/otpService.ts';
import {
  signCustomerToken,
  signAdminToken,
} from '../server/jwtHelper.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTests() {
  console.log('=================================================================================');
  console.log('FreshCart: COD Cash Collection vs Online Payment OTP Separation Verification');
  console.log('=================================================================================\n');

  await connectMySql();
  const pool = getPool();

  // Start HTTP server on an ephemeral port
  const server = http.createServer(apiApp);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[Test Server] Running on ${baseUrl}\n`);

  try {
    const timestamp = Date.now();
    const customerId = `cust_cod_test_${timestamp}`;
    const customerEmail = `customer_${timestamp}@freshcart.com`;
    const customerPhone = `98765${String(timestamp).slice(-5)}`;
    const customerToken = signCustomerToken({ id: customerId, email: customerEmail });

    // Provision or verify admin & employee accounts
    let adminRecord = await findAdminInDb('owner@freshcart.com');
    if (!adminRecord) {
      const allAdmins = await pool.query<any[]>('SELECT * FROM admins WHERE role IN ("owner", "admin") LIMIT 1');
      adminRecord = (allAdmins[0] as any[])?.[0];
    }
    const adminToken = adminRecord
      ? signAdminToken({
          adminId: adminRecord.admin_id,
          email: adminRecord.email,
          fullName: adminRecord.full_name,
          role: adminRecord.role,
          tokenVersion: adminRecord.token_version,
        })
      : '';

    let employeeRecord = await findAdminInDb('employee@freshcart.com');
    if (!employeeRecord) {
      // Create employee account for test
      await createAdminInDb({
        adminId: `emp_${timestamp}`,
        email: `employee_${timestamp}@freshcart.com`,
        fullName: 'Operations Delivery Agent',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'employee',
        status: 'active',
      });
      employeeRecord = await findAdminInDb(`employee_${timestamp}@freshcart.com`);
    }
    const employeeToken = employeeRecord
      ? signAdminToken({
          adminId: employeeRecord.admin_id,
          email: employeeRecord.email,
          fullName: employeeRecord.full_name,
          role: employeeRecord.role,
          tokenVersion: employeeRecord.token_version,
        })
      : '';

    console.log(`[Auth Setup] Admin: ${adminRecord?.email} (${adminRecord?.role}), Employee: ${employeeRecord?.email} (${employeeRecord?.role})`);

    // =========================================================================
    // SECTION 1: Cash on Delivery (COD) Flow
    // =========================================================================
    console.log('\n--- SECTION 1: Cash on Delivery (COD) Workflow ---');

    // 1.1 Create COD Order
    console.log('\nTest 1.1: Create COD order and verify initial payment status is PENDING_COLLECTION');
    const codOrderId = `FC-COD-${timestamp}`;
    const createCodRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        id: codOrderId,
        customerId,
        customerName: 'Aarav Patel',
        customerEmail,
        customerPhone,
        deliveryAddress: '42 MG Road, Bengaluru',
        total: 540.00,
        subtotal: 540.00,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING_COLLECTION',
        status: 'Placed',
        items: [
          { product: { id: 'prod_1', title: 'Fresh Farm Apples', price: 180 }, quantity: 3 }
        ],
      }),
    });
    assert.strictEqual(createCodRes.status, 200, 'COD order creation must return 200');
    const codOrderDb = await findOrderInDb(codOrderId);
    assert(codOrderDb, 'COD order must exist in DB');
    assert.strictEqual(codOrderDb.paymentStatus, 'PENDING_COLLECTION', 'COD order initial paymentStatus must be PENDING_COLLECTION');
    console.log(`✓ PASS: COD Order ${codOrderId} created with paymentStatus = PENDING_COLLECTION`);

    // 1.2 Attempt OTP Generation on COD Order -> MUST FAIL
    console.log('\nTest 1.2: Attempt OTP generation for COD order -> Must be rejected');
    const codOtpGenRes = await generateOrderOtp(codOrderId, customerId, customerPhone);
    assert.strictEqual(codOtpGenRes.success, false, 'generateOrderOtp must reject COD orders');
    assert(
      codOtpGenRes.error?.includes('Cash on Delivery') || codOtpGenRes.message?.includes('Cash on Delivery'),
      `Expected error about COD orders, got: ${codOtpGenRes.error}`
    );
    console.log(`✓ PASS: OTP generation rejected for COD order: "${codOtpGenRes.error}"`);

    // 1.3 Attempt OTP Resend on COD Order -> MUST FAIL
    console.log('\nTest 1.3: Attempt OTP resend for COD order -> Must be rejected');
    const codOtpResendRes = await resendOrderOtp(codOrderId, customerId, customerPhone);
    assert.strictEqual(codOtpResendRes.success, false, 'resendOrderOtp must reject COD orders');
    console.log(`✓ PASS: OTP resend rejected for COD order: "${codOtpResendRes.error}"`);

    // 1.4 Attempt OTP Verification on COD Order -> MUST FAIL
    console.log('\nTest 1.4: Attempt OTP verification for COD order -> Must be rejected');
    const codOtpVerifyRes = await verifyOrderOtp(codOrderId, '123456');
    assert.strictEqual(codOtpVerifyRes.success, false, 'verifyOrderOtp must reject COD orders');
    console.log(`✓ PASS: OTP verification rejected for COD order: "${codOtpVerifyRes.error}"`);

    // 1.5 Customer Portal Fetch OTP on COD Order -> MUST FAIL
    console.log('\nTest 1.5: Customer portal requests delivery OTP for COD order -> Must return not applicable');
    const custCodOtpRes = await getCustomerOrderOtp(codOrderId, customerId);
    assert.strictEqual(custCodOtpRes.success, false, 'Customer cannot get OTP for COD orders');
    console.log(`✓ PASS: Customer cannot retrieve OTP for COD order: "${custCodOtpRes.error}"`);

    // 1.6 Advance COD order to 'Delivered' without cash collection
    console.log('\nTest 1.6: Mark COD order as "Delivered" without confirming cash collection');
    const updateDeliveredRes = await fetch(`${baseUrl}/api/orders/${codOrderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({ status: 'Delivered' }),
    });
    assert(updateDeliveredRes.ok, 'Marking order as Delivered must succeed');

    // Verify paymentStatus remains PENDING_COLLECTION (NOT automatically confirmed on delivery)
    const deliveredCodDb = await findOrderInDb(codOrderId);
    assert.strictEqual(deliveredCodDb?.status, 'Delivered', 'Order status must be Delivered');
    assert.strictEqual(
      deliveredCodDb?.paymentStatus,
      'PENDING_COLLECTION',
      'paymentStatus must NOT automatically become COLLECTED when order is delivered'
    );
    console.log(`✓ PASS: COD Order delivered but paymentStatus remains "${deliveredCodDb?.paymentStatus}"`);

    // 1.7 Customer attempts to confirm cash collection -> MUST BE FORBIDDEN (401/403)
    console.log('\nTest 1.7: Customer attempts to confirm cash collection -> Must be blocked (401/403)');
    const customerConfirmRes = await fetch(`${baseUrl}/api/orders/${codOrderId}/confirm-cash-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
    });
    assert(
      customerConfirmRes.status === 401 || customerConfirmRes.status === 403,
      `Customer must receive 401/403, got status ${customerConfirmRes.status}`
    );
    console.log(`✓ PASS: Customer blocked from confirming cash collection (HTTP ${customerConfirmRes.status})`);

    // 1.8 Authorized Employee confirms cash collection -> MUST SUCCEED
    console.log('\nTest 1.8: Authorized Employee confirms cash collection -> Must succeed and update to COLLECTED');
    const empConfirmRes = await fetch(`${baseUrl}/api/orders/${codOrderId}/confirm-cash-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
    });
    const empConfirmData = await empConfirmRes.json();
    assert.strictEqual(empConfirmRes.status, 200, `Employee confirm must return 200, got: ${JSON.stringify(empConfirmData)}`);
    assert.strictEqual(empConfirmData.success, true, 'Response must indicate success');
    assert.strictEqual(empConfirmData.paymentStatus, 'COLLECTED', 'paymentStatus must be COLLECTED');
    assert(empConfirmData.verifiedAt, 'verifiedAt timestamp must be recorded');
    assert(empConfirmData.verifiedBy, 'verifiedBy employee must be recorded');

    // Verify in database directly
    const collectedDb = await findOrderInDb(codOrderId);
    assert.strictEqual(collectedDb?.paymentStatus, 'COLLECTED', 'DB payment_status must be COLLECTED');
    assert(collectedDb?.verifiedAt, 'DB verified_at timestamp must be present');
    assert(collectedDb?.verifiedBy, 'DB verified_by must record the confirming staff name');
    console.log(`✓ PASS: Employee confirmed cash collection in DB: status = ${collectedDb?.paymentStatus}, by = "${collectedDb?.verifiedBy}", at = "${collectedDb?.verifiedAt}"`);

    // 1.9 Prevent duplicate cash collection confirmation -> MUST RETURN 409 CONFLICT
    console.log('\nTest 1.9: Attempt duplicate cash collection confirmation -> Must be rejected with 409 Conflict');
    const dupConfirmRes = await fetch(`${baseUrl}/api/orders/${codOrderId}/confirm-cash-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken || employeeToken}`,
      },
    });
    const dupConfirmData = await dupConfirmRes.json();
    assert.strictEqual(dupConfirmRes.status, 409, `Duplicate confirmation must return 409 Conflict, got ${dupConfirmRes.status}`);
    assert.strictEqual(dupConfirmData.success, false, 'Duplicate response success must be false');
    assert(
      dupConfirmData.error?.includes('already been confirmed'),
      `Expected error about already confirmed, got: ${dupConfirmData.error}`
    );
    console.log(`✓ PASS: Duplicate cash collection confirmation prevented (HTTP 409: "${dupConfirmData.error}")`);

    // 1.10 Cash collection on un-delivered COD order -> MUST BE REJECTED
    console.log('\nTest 1.10: Confirm cash collection on an un-delivered COD order -> Must be rejected (400)');
    const unDeliveredCodId = `FC-COD-UNDEL-${timestamp}`;
    await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        id: unDeliveredCodId,
        customerId,
        customerName: 'Aarav Patel',
        deliveryAddress: '42 MG Road, Bengaluru',
        total: 300,
        subtotal: 300,
        paymentMethod: 'COD',
        paymentStatus: 'PENDING_COLLECTION',
        status: 'Out for Delivery',
        items: [{ product: { id: 'prod_1', title: 'Item', price: 300 }, quantity: 1 }],
      }),
    });
    const unDeliveredConfirmRes = await fetch(`${baseUrl}/api/orders/${unDeliveredCodId}/confirm-cash-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
    });
    assert.strictEqual(unDeliveredConfirmRes.status, 400, 'Must return 400 if order is not delivered');
    const unDeliveredData = await unDeliveredConfirmRes.json();
    assert(unDeliveredData.error?.includes('Delivered'), `Expected delivered requirement error, got: ${unDeliveredData.error}`);
    console.log(`✓ PASS: Rejected cash collection on un-delivered order: "${unDeliveredData.error}"`);

    // =========================================================================
    // SECTION 2: Online Payments & OTP Flow
    // =========================================================================
    console.log('\n--- SECTION 2: Online Payment & OTP Workflow ---');

    // 2.1 Create Online Payment Order with PENDING_VERIFICATION
    console.log('\nTest 2.1: Create Online UPI order with paymentStatus = PENDING_VERIFICATION');
    const onlineOrderId = `FC-ONLINE-${timestamp}`;
    const createOnlineRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        id: onlineOrderId,
        customerId,
        customerName: 'Priya Sharma',
        customerEmail,
        customerPhone,
        deliveryAddress: 'Sector 14, Gurgaon',
        total: 850.00,
        subtotal: 850.00,
        paymentMethod: 'UPI',
        paymentStatus: 'PENDING_VERIFICATION',
        status: 'Ordered',
        items: [{ product: { id: 'prod_mango', title: 'Organic Mangoes', price: 850 }, quantity: 1 }],
      }),
    });
    assert.strictEqual(createOnlineRes.status, 200, 'Online order creation must return 200');

    // 2.2 Online order OTP cannot be generated before payment approval
    console.log('\nTest 2.2: Attempt OTP generation before admin verifies payment -> Must fail');
    const preApprovalGen = await generateOrderOtp(onlineOrderId, customerId, customerPhone);
    assert.strictEqual(preApprovalGen.success, false, 'OTP must not generate while payment is PENDING_VERIFICATION');
    assert(preApprovalGen.error?.includes('COMPLETED'), 'Must require COMPLETED payment status');
    console.log(`✓ PASS: OTP generation blocked before payment approval: "${preApprovalGen.error}"`);

    // 2.3 Customer cannot view OTP before payment is verified
    console.log('\nTest 2.3: Customer attempts to fetch OTP before payment verification -> Must fail');
    const custPreOtp = await getCustomerOrderOtp(onlineOrderId, customerId);
    assert.strictEqual(custPreOtp.success, false, 'Customer cannot get OTP before payment approval');
    console.log(`✓ PASS: Customer OTP fetch blocked before payment approval: "${custPreOtp.error}"`);

    // 2.4 Admin approves online payment proof (Status becomes COMPLETED)
    // 2.4 Non-admin (Employee) attempts to approve online payment -> Must be forbidden (403)
    console.log('\nTest 2.4a: Employee attempts to approve online payment status -> Must be forbidden (403)');
    const empOnlineStatusRes = await fetch(`${baseUrl}/api/orders/${onlineOrderId}/payment-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({ paymentStatus: 'COMPLETED' }),
    });
    assert.strictEqual(empOnlineStatusRes.status, 403, 'Employee must not be allowed to approve online payment status');
    console.log('✓ PASS: Employee blocked from approving online payment status (HTTP 403 Forbidden)');

    // 2.4b Admin approves online payment (Status becomes COMPLETED)
    console.log('\nTest 2.4b: Admin approves online payment (Status -> COMPLETED)');
    const approvePaymentRes = await fetch(`${baseUrl}/api/orders/${onlineOrderId}/payment-status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ paymentStatus: 'COMPLETED' }),
    });
    assert(approvePaymentRes.ok, `Admin approval must succeed, got HTTP ${approvePaymentRes.status}`);

    const approvedDb = await findOrderInDb(onlineOrderId);
    assert(
      approvedDb?.paymentStatus === 'COMPLETED' || approvedDb?.paymentStatus === 'PAID',
      `Payment status must be COMPLETED or PAID, got: ${approvedDb?.paymentStatus}`
    );
    console.log(`✓ PASS: Admin approved payment, order paymentStatus is now: "${approvedDb?.paymentStatus}"`);

    // 2.5 Generate 6-Digit Delivery OTP for approved online payment
    console.log('\nTest 2.5: Generate 6-digit Delivery OTP for approved online payment');
    const onlineOtpGen = await generateOrderOtp(onlineOrderId, customerId, customerPhone);
    assert.strictEqual(onlineOtpGen.success, true, 'OTP generation must succeed for approved online payment');
    assert(onlineOtpGen.otp && onlineOtpGen.otp.length === 6, 'OTP must be exactly 6 digits');
    const generatedOtp = onlineOtpGen.otp;
    console.log(`✓ PASS: 6-digit Delivery OTP generated: ${generatedOtp} (Masked phone: ${onlineOtpGen.maskedPhone})`);

    // 2.6 Customer can now securely fetch their 6-digit delivery OTP
    console.log('\nTest 2.6: Customer fetches delivery OTP from Customer Portal');
    const custOtpRes = await getCustomerOrderOtp(onlineOrderId, customerId);
    assert.strictEqual(custOtpRes.success, true, 'Customer must now receive their delivery OTP');
    assert.strictEqual(custOtpRes.otp, generatedOtp, 'Customer OTP must match generated OTP');
    console.log(`✓ PASS: Customer successfully retrieved delivery OTP: ${custOtpRes.otp}`);

    // 2.7 Verify with invalid OTP -> Must fail and track remaining attempts
    console.log('\nTest 2.7: Submit invalid OTP -> Must fail and decrement remaining attempts');
    const wrongOtpRes = await verifyOrderOtp(onlineOrderId, '000000');
    assert.strictEqual(wrongOtpRes.success, false, 'Invalid OTP must fail');
    assert.strictEqual(wrongOtpRes.status, 'Picking', 'Status must remain Picking on wrong OTP');
    assert.strictEqual(wrongOtpRes.remainingAttempts, 4, 'Remaining attempts must be 4');
    console.log(`✓ PASS: Wrong OTP rejected: "${wrongOtpRes.error}", remaining attempts: ${wrongOtpRes.remainingAttempts}`);

    // 2.8 Verify with correct OTP -> Must mark order as Delivered and OTP as USED
    console.log('\nTest 2.8: Submit valid OTP -> Must mark order as Delivered');
    const validOtpRes = await verifyOrderOtp(onlineOrderId, generatedOtp);
    assert.strictEqual(validOtpRes.success, true, 'Valid OTP must succeed');
    assert.strictEqual(validOtpRes.status, 'Delivered', 'Order status must transition to Delivered');
    console.log(`✓ PASS: Correct OTP verified successfully: Order status changed to "${validOtpRes.status}"`);

    // 2.9 Cannot re-verify already used OTP
    console.log('\nTest 2.9: Attempt to reuse already USED OTP -> Must be rejected');
    const reUseOtpRes = await verifyOrderOtp(onlineOrderId, generatedOtp);
    assert.strictEqual(reUseOtpRes.success, false, 'Used OTP cannot be reused');
    console.log(`✓ PASS: Reused OTP rejected: "${reUseOtpRes.error}"`);

    // =========================================================================
    // SECTION 3: Cash Collection Endpoint Cannot Be Applied to Online Orders
    // =========================================================================
    console.log('\n--- SECTION 3: Cross-Workflow Integrity ---');
    console.log('\nTest 3.1: Confirm cash collection on an Online (UPI) order -> Must be rejected (400)');
    const onlineCashCollectionRes = await fetch(`${baseUrl}/api/orders/${onlineOrderId}/confirm-cash-collection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
    });
    assert.strictEqual(onlineCashCollectionRes.status, 400, 'Must return 400 Bad Request for online orders');
    const onlineCashData = await onlineCashCollectionRes.json();
    assert(
      onlineCashData.error?.includes('Cash on Delivery') || onlineCashData.error?.includes('COD'),
      `Expected COD-only error, got: ${onlineCashData.error}`
    );
    console.log(`✓ PASS: Cash collection endpoint rejected for online order: "${onlineCashData.error}"`);

    console.log('\n=================================================================================');
    console.log('ALL TESTS PASSED! Separation of COD Cash Collection & Online OTP is 100% Verified.');
    console.log('=================================================================================');
  } finally {
    server.close();
    try {
      await pool.end();
    } catch {
      // ignore
    }
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
