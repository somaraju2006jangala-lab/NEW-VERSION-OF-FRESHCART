import assert from 'assert';

async function runHttpE2eTest() {
  console.log('====================================================================');
  console.log('Customer Portal Delivery OTP & Member Since HTTP Integration Tests');
  console.log('====================================================================\n');

  const baseUrl = 'http://localhost:3000';
  const timestamp = Date.now();
  const testEmail = `test_customer_${timestamp}@freshcart.com`;
  const testPhone = `98765${String(timestamp).slice(-5)}`;
  const testPassword = 'Password@123';

  // 1. Customer Registration & Login -> Check createdAt field
  console.log('Test 1: Register customer and verify createdAt is present and valid');
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sunita Rao',
      email: testEmail,
      phone: testPhone,
      password: testPassword,
      address: 'Indiranagar 100ft Road, Bengaluru',
    }),
  });

  const regData = await regRes.json();
  assert.strictEqual(regRes.status, 201, `Registration should return 201: ${JSON.stringify(regData)}`);
  assert(regData.customer?.createdAt, 'Registered customer must contain createdAt field');
  const regDate = new Date(regData.customer.createdAt);
  assert(!isNaN(regDate.getTime()), 'createdAt must parse to a valid date');
  console.log(`✓ PASS: Registration returned valid createdAt: ${regData.customer.createdAt} (Formatted: ${regDate.toLocaleDateString()})`);

  // 2. Customer Login -> Check createdAt field in sessionUser
  console.log('\nTest 2: Login customer and verify createdAt in sessionUser');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
    }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, `Login should return 200: ${JSON.stringify(loginData)}`);
  assert(loginData.customer?.createdAt, 'Logged-in customer must contain createdAt field');
  const loginDate = new Date(loginData.customer.createdAt);
  assert(!isNaN(loginDate.getTime()), 'Login createdAt must parse to a valid date, preventing "Member since Invalid Date"');
  console.log(`✓ PASS: Login returned valid createdAt: ${loginData.customer.createdAt}`);

  const customerToken = loginData.token;
  const customerId = loginData.customer.id;

  // 3. Customer Profile / Me endpoint -> Check createdAt
  console.log('\nTest 3: Fetch /api/auth/me profile and verify createdAt');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert(meData.customer?.createdAt, '/api/auth/me must return createdAt');
  console.log(`✓ PASS: Profile /api/auth/me returns valid createdAt: ${meData.customer.createdAt}`);

  // 4. Create an eligible online UPI order (Status: 'Ordered', Payment: 'PENDING_VERIFICATION')
  console.log('\nTest 4: Create online UPI order with status = "Ordered"');
  const orderId = `FC-WEB-${timestamp}`;
  const createOrderRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify({
      id: orderId,
      customerId,
      customerName: 'Sunita Rao',
      customerEmail: testEmail,
      customerPhone: testPhone,
      deliveryAddress: 'Indiranagar 100ft Road, Bengaluru',
      total: 850,
      subtotal: 850,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING_VERIFICATION',
      status: 'Ordered', // Real-world status, not 'Picking'
      items: [
        { product: { id: 'p1', title: 'Organic Alphonso Mangoes', price: 850, unit: '1 kg' }, quantity: 1 }
      ]
    }),
  });
  assert(createOrderRes.ok, 'Order creation must succeed');
  console.log(`✓ PASS: Order ${orderId} created with status "Ordered" and paymentStatus "PENDING_VERIFICATION"`);

  // 5. Try fetching OTP before payment approval -> Must fail
  console.log('\nTest 5: Customer tries to fetch OTP while payment is pending verification');
  const preApprovalOtpRes = await fetch(`${baseUrl}/api/otp/customer-order-otp/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'x-customer-id': customerId,
    },
  });
  const preApprovalOtpData = await preApprovalOtpRes.json();
  assert.strictEqual(preApprovalOtpRes.status, 400, 'Must return 400 when payment not approved');
  assert.strictEqual(preApprovalOtpData.success, false);
  assert(!preApprovalOtpData.otp, 'Must never reveal OTP before payment approval');
  console.log('✓ PASS: Delivery OTP is strictly unavailable while payment verification is pending.');

  // 6. Admin approves UPI payment
  console.log('\nTest 6: Admin approves UPI payment proof');
  const approveRes = await fetch(`${baseUrl}/api/orders/${encodeURIComponent(orderId)}/payment-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-role': 'admin',
    },
    body: JSON.stringify({
      paymentStatus: 'COMPLETED',
      adminName: 'SuperAdmin',
    }),
  });
  const approveData = await approveRes.json();
  assert.strictEqual(approveRes.status, 200, `Payment approval must succeed: ${JSON.stringify(approveData)}`);
  console.log('✓ PASS: Admin payment approval confirmed in database (paymentStatus: COMPLETED).');

  // 7. Customer Portal fetches actual 6-digit OTP after payment approval
  console.log('\nTest 7: Authenticated customer retrieves actual 6-digit Delivery OTP');
  const postApprovalOtpRes = await fetch(`${baseUrl}/api/otp/customer-order-otp/${encodeURIComponent(orderId)}`, {
    headers: {
      Authorization: `Bearer ${customerToken}`,
      'x-customer-id': customerId,
    },
  });
  const postApprovalOtpData = await postApprovalOtpRes.json();
  assert.strictEqual(postApprovalOtpRes.status, 200, `Customer OTP retrieval should return 200: ${JSON.stringify(postApprovalOtpData)}`);
  assert.strictEqual(postApprovalOtpData.success, true);
  assert(typeof postApprovalOtpData.otp === 'string', 'OTP must be returned');
  assert.strictEqual(postApprovalOtpData.otp.length, 6, 'OTP must be exactly six digits');
  assert(/^\d{6}$/.test(postApprovalOtpData.otp), 'OTP must be numeric digits');
  const initialOtp = postApprovalOtpData.otp;
  console.log(`✓ PASS: Authenticated customer successfully received actual 6-digit OTP: [ ${initialOtp} ]`);

  // 8. Unauthorized user cannot access the OTP
  console.log('\nTest 8: Unauthorized user access attempt');
  const unauthorizedRes = await fetch(`${baseUrl}/api/otp/customer-order-otp/${encodeURIComponent(orderId)}`, {
    headers: {
      'x-customer-id': 'unauthorized_attacker_999',
    },
  });
  const unauthorizedData = await unauthorizedRes.json();
  assert.strictEqual(unauthorizedRes.status, 403, 'Unauthorized access must be rejected with 403 Forbidden');
  assert(!unauthorizedData.otp, 'Plaintext OTP must not be revealed to unauthorized user');
  console.log('✓ PASS: Cross-customer isolation enforced (403 Forbidden returned).');

  // 9. Resend OTP from Customer Portal
  console.log('\nTest 9: Resend OTP from Customer Portal (waiting 15s for cooldown)');
  await new Promise((r) => setTimeout(r, 15500));

  const resendRes = await fetch(`${baseUrl}/api/otp/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerToken}`,
      'x-customer-id': customerId,
    },
    body: JSON.stringify({
      orderId,
      customerId,
      customerPhone: testPhone,
    }),
  });
  const resendData = await resendRes.json();
  assert.strictEqual(resendRes.status, 200, `Resend OTP must return 200: ${JSON.stringify(resendData)}`);
  assert.strictEqual(resendData.success, true);
  assert(typeof resendData.otp === 'string', 'Resent OTP must be a string');
  assert.strictEqual(resendData.otp.length, 6, 'Resent OTP must be 6 digits');
  assert.notStrictEqual(resendData.otp, initialOtp, 'New OTP must differ from superseded OTP');
  const newOtp = resendData.otp;
  console.log(`✓ PASS: Resend OTP generated new code [ ${newOtp} ] (Old was: [ ${initialOtp} ])`);

  // 10. Old superseded OTP is rejected
  console.log('\nTest 10: Verify old superseded OTP is immediately invalid');
  const verifyOldRes = await fetch(`${baseUrl}/api/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, otp: initialOtp }),
  });
  const verifyOldData = await verifyOldRes.json();
  assert.strictEqual(verifyOldData.success, false, 'Old OTP must fail verification');
  console.log('✓ PASS: Old OTP is immediately invalid upon resend.');

  // 11. Delivery team/admin verifies with new valid OTP -> Marks order Delivered
  console.log('\nTest 11: Verify new valid OTP marks order Delivered');
  const verifyNewRes = await fetch(`${baseUrl}/api/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, otp: newOtp }),
  });
  const verifyNewData = await verifyNewRes.json();
  assert.strictEqual(verifyNewData.success, true, `New OTP verification must succeed: ${JSON.stringify(verifyNewData)}`);
  assert.strictEqual(verifyNewData.status, 'Delivered', 'Order status must be updated to Delivered');
  console.log('✓ PASS: Valid OTP verified successfully. Order status updated to Delivered.');

  // 12. Verify replayed/reused OTP is blocked
  console.log('\nTest 12: Replay of used OTP is blocked');
  const replayRes = await fetch(`${baseUrl}/api/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, otp: newOtp }),
  });
  const replayData = await replayRes.json();
  assert.strictEqual(replayData.success, false, 'Reused OTP must be rejected');
  console.log('✓ PASS: Used OTP replay strictly blocked.');

  console.log('\n====================================================================');
  console.log('All 12 HTTP End-to-End Integration Tests PASSED Successfully!');
  console.log('====================================================================\n');
}

runHttpE2eTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
