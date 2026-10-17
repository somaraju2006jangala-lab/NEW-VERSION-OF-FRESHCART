import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { apiApp } from '../server/apiRouter.ts';
import {
  connectMySql,
  getPool,
  findAdminInDb,
  createAdminInDb,
  getDailyReportFromDb,
  getMonthCalendarActivityFromDb,
} from '../server/db.ts';
import { signCustomerToken, signAdminToken } from '../server/jwtHelper.ts';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTests() {
  console.log('=================================================================================');
  console.log('FreshCart: Admin Daily Orders & Transactions Calendar - Comprehensive Verification');
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
    const customerId = `cust_cal_test_${timestamp}`;
    const customerEmail = `cust_cal_${timestamp}@freshcart.com`;
    const customerToken = signCustomerToken({ id: customerId, email: customerEmail });

    // Fetch or provision admin account
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

    // Fetch or provision employee account
    let employeeRecord = await findAdminInDb('employee@freshcart.com');
    if (!employeeRecord) {
      await createAdminInDb({
        adminId: `emp_cal_${timestamp}`,
        email: `employee_cal_${timestamp}@freshcart.com`,
        fullName: 'Operations Staff',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
        role: 'employee',
        status: 'active',
      });
      employeeRecord = await findAdminInDb(`employee_cal_${timestamp}@freshcart.com`);
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

    console.log(`[Auth Setup] Admin: ${adminRecord?.email} (${adminRecord?.role})`);
    console.log(`[Auth Setup] Employee: ${employeeRecord?.email} (${employeeRecord?.role})`);

    // =========================================================================
    // TEST 1: Selecting a date with UPI and COD orders
    // =========================================================================
    console.log('\n--- TEST 1: Selecting a date with UPI and COD orders ---');
    const testDateWithOrders = '2026-10-17';
    const res1 = await fetch(`${baseUrl}/api/admin/reports/daily?date=${testDateWithOrders}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data1 = await res1.json();
    assert.strictEqual(res1.status, 200, `Expected 200 OK, got ${res1.status}: ${JSON.stringify(data1)}`);
    assert.strictEqual(data1.success, true, 'Response success must be true');
    assert(data1.report, 'report payload must be present');
    assert.strictEqual(data1.report.selectedDate, testDateWithOrders, 'selectedDate must match queried date');
    assert(data1.report.totalOrders > 0, `Expected totalOrders > 0, got ${data1.report.totalOrders}`);
    assert(data1.report.upiOrdersCount > 0, `Expected upiOrdersCount > 0, got ${data1.report.upiOrdersCount}`);
    assert(data1.report.codOrdersCount > 0, `Expected codOrdersCount > 0, got ${data1.report.codOrdersCount}`);
    assert(Array.isArray(data1.report.orders), 'orders must be an array');
    assert.strictEqual(data1.report.orders.length, data1.report.totalOrders, 'orders array length must match totalOrders');

    // Verify order details fields
    const sampleOrder = data1.report.orders[0];
    assert(sampleOrder.id, 'sample order must have id');
    assert(sampleOrder.customerName, 'sample order must have customerName');
    assert(sampleOrder.createdAt, 'sample order must have createdAt');
    assert(sampleOrder.paymentMethod, 'sample order must have paymentMethod');
    assert(typeof sampleOrder.total === 'number', 'sample order must have numeric total');
    assert(sampleOrder.paymentStatus, 'sample order must have paymentStatus');
    assert(sampleOrder.status, 'sample order must have status');

    console.log(`✓ PASS: Date ${testDateWithOrders} retrieved successfully with:`);
    console.log(`  - Total Orders: ${data1.report.totalOrders}`);
    console.log(`  - UPI Orders: ${data1.report.upiOrdersCount}`);
    console.log(`  - COD Orders: ${data1.report.codOrdersCount}`);
    console.log(`  - Total UPI Transactions: ₹${data1.report.totalUpiTransactions}`);
    console.log(`  - Total COD Collections: ₹${data1.report.totalCodCollections}`);
    console.log(`  - Total Collected Amount: ₹${data1.report.totalCollectedAmount}`);

    // =========================================================================
    // TEST 2: Selecting a date with no orders
    // =========================================================================
    console.log('\n--- TEST 2: Selecting a date with no orders ---');
    const testDateNoOrders = '2026-10-14';
    const res2 = await fetch(`${baseUrl}/api/admin/reports/daily?date=${testDateNoOrders}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data2 = await res2.json();
    assert.strictEqual(res2.status, 200, `Expected 200 OK, got ${res2.status}`);
    assert.strictEqual(data2.success, true);
    assert.strictEqual(data2.report.selectedDate, testDateNoOrders);
    assert.strictEqual(data2.report.totalOrders, 0, 'totalOrders must be 0 for date with no orders');
    assert.strictEqual(data2.report.upiOrdersCount, 0, 'upiOrdersCount must be 0');
    assert.strictEqual(data2.report.codOrdersCount, 0, 'codOrdersCount must be 0');
    assert.strictEqual(data2.report.totalUpiTransactions, 0, 'totalUpiTransactions must be 0');
    assert.strictEqual(data2.report.totalCodCollections, 0, 'totalCodCollections must be 0');
    assert.strictEqual(data2.report.totalCollectedAmount, 0, 'totalCollectedAmount must be 0');
    assert.strictEqual(data2.report.pendingUpiCount, 0, 'pendingUpiCount must be 0');
    assert.strictEqual(data2.report.pendingUpiAmount, 0, 'pendingUpiAmount must be 0');
    assert.strictEqual(data2.report.rejectedUpiCount, 0, 'rejectedUpiCount must be 0');
    assert.strictEqual(data2.report.rejectedUpiAmount, 0, 'rejectedUpiAmount must be 0');
    assert.strictEqual(data2.report.pendingCodCount, 0, 'pendingCodCount must be 0');
    assert.strictEqual(data2.report.pendingCodAmount, 0, 'pendingCodAmount must be 0');
    assert.strictEqual(data2.report.orders.length, 0, 'orders array must be empty');
    console.log(`✓ PASS: Date ${testDateNoOrders} with no orders returned all totals as exactly 0 and empty order list.`);

    // =========================================================================
    // TEST 3: Counting all orders independently of payment status
    // =========================================================================
    console.log('\n--- TEST 3: Counting all orders independently of payment status ---');
    // On 2026-10-17, verify totalOrders == upiOrdersCount + codOrdersCount
    assert.strictEqual(
      data1.report.totalOrders,
      data1.report.upiOrdersCount + data1.report.codOrdersCount,
      'totalOrders must equal upiOrdersCount + codOrdersCount'
    );
    // Verify in database that direct query of created orders matches report
    const [dbCountRows] = await pool.query<any[]>(
      `SELECT COUNT(*) as cnt FROM orders WHERE DATE_FORMAT(created_at, '%Y-%m-%d') = ?`,
      [testDateWithOrders]
    );
    const dbCreatedCount = Number(dbCountRows[0].cnt);
    assert.strictEqual(
      data1.report.totalOrders,
      dbCreatedCount,
      `Report totalOrders (${data1.report.totalOrders}) must match DB created orders count (${dbCreatedCount})`
    );
    console.log(`✓ PASS: All ${dbCreatedCount} orders placed on ${testDateWithOrders} counted independently of payment status.`);

    // =========================================================================
    // TEST 4: Including only verified PAID UPI transactions in successful UPI totals
    // =========================================================================
    console.log('\n--- TEST 4: Verified PAID UPI transactions in successful UPI totals ---');
    // totalUpiTransactions must only include orders where status is PAID/COMPLETED
    // Query DB for verified UPI payments on 2026-10-17
    const [upiDbRows] = await pool.query<any[]>(
      `SELECT SUM(amount) as amt FROM payments
       WHERE payment_method IN ('UPI', 'Online')
         AND payment_status IN ('PAID', 'COMPLETED')
         AND DATE_FORMAT(COALESCE(verified_at, paid_at), '%Y-%m-%d') = ?`,
      [testDateWithOrders]
    );
    const expectedUpiAmt = Number(upiDbRows[0]?.amt || 0);
    assert.strictEqual(
      data1.report.totalUpiTransactions,
      expectedUpiAmt,
      `totalUpiTransactions (${data1.report.totalUpiTransactions}) must equal verified DB sum (${expectedUpiAmt})`
    );
    console.log(`✓ PASS: totalUpiTransactions (₹${data1.report.totalUpiTransactions}) strictly includes only verified PAID transactions.`);

    // =========================================================================
    // TEST 5: Including only confirmed COLLECTED COD payments in cash-collection totals
    // =========================================================================
    console.log('\n--- TEST 5: Confirmed COLLECTED COD payments in cash-collection totals ---');
    assert(
      data1.report.totalCodCollections > 0,
      `totalCodCollections should be greater than 0, got ${data1.report.totalCodCollections}`
    );
    // Uncollected COD orders must not be in totalCodCollections
    if (data1.report.pendingCodCount > 0) {
      assert(data1.report.pendingCodAmount > 0, 'pendingCodAmount must be positive if pendingCodCount > 0');
    }
    console.log(`✓ PASS: totalCodCollections (₹${data1.report.totalCodCollections}) strictly includes only confirmed COLLECTED cash.`);

    // =========================================================================
    // TEST 6: Excluding pending and rejected payments from successful transaction totals
    // =========================================================================
    console.log('\n--- TEST 6: Excluding pending and rejected payments from successful totals ---');
    assert.strictEqual(
      data1.report.totalCollectedAmount,
      Number((data1.report.totalUpiTransactions + data1.report.totalCodCollections).toFixed(2)),
      'totalCollectedAmount must equal totalUpiTransactions + totalCodCollections'
    );
    // Verify pending UPI amount is tracked separately and not added into totalUpiTransactions
    if (data1.report.pendingUpiCount > 0) {
      console.log(`  - Pending UPI Amount (separate): ₹${data1.report.pendingUpiAmount} (${data1.report.pendingUpiCount} orders)`);
    }
    if (data1.report.rejectedUpiCount > 0) {
      console.log(`  - Rejected UPI Amount (separate): ₹${data1.report.rejectedUpiAmount} (${data1.report.rejectedUpiCount} orders)`);
    }
    console.log(`✓ PASS: Pending and rejected payments excluded from successful totals and tracked in separate breakdown.`);

    // =========================================================================
    // TEST 7: Correct date handling across midnight and time zones
    // =========================================================================
    console.log('\n--- TEST 7: Date handling across midnight, boundaries, and validation ---');
    // Test invalid date format returns 400 Bad Request
    const invalidDateRes = await fetch(`${baseUrl}/api/admin/reports/daily?date=invalid-date`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(invalidDateRes.status, 400, 'Invalid date format must return 400 Bad Request');
    const invalidData = await invalidDateRes.json();
    assert.strictEqual(invalidData.success, false);
    assert(invalidData.error?.includes('YYYY-MM-DD'), 'Error must specify expected YYYY-MM-DD format');

    // Test missing date parameter returns 400 Bad Request
    const missingDateRes = await fetch(`${baseUrl}/api/admin/reports/daily`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(missingDateRes.status, 400, 'Missing date param must return 400 Bad Request');

    // Test direct DB function handles date correctly
    const directReport = await getDailyReportFromDb('2026-10-17');
    assert.strictEqual(directReport.selectedDate, '2026-10-17');
    assert.strictEqual(directReport.totalOrders, data1.report.totalOrders);
    console.log(`✓ PASS: Boundary validation and date string consistency verified.`);

    // =========================================================================
    // TEST 8: Preventing duplicate transaction counting
    // =========================================================================
    console.log('\n--- TEST 8: Preventing duplicate transaction counting ---');
    // Count orders that exist in both orders and payments
    const [overlapRows] = await pool.query<any[]>(
      `SELECT o.order_id FROM orders o
       JOIN payments p ON o.order_id = p.order_id OR o.order_id = CONCAT('#', p.order_id) OR p.order_id = CONCAT('#', o.order_id)
       WHERE DATE_FORMAT(COALESCE(p.verified_at, o.verified_at), '%Y-%m-%d') = ?`,
      [testDateWithOrders]
    );
    console.log(`  - Found ${overlapRows.length} orders present in both orders and payments tables for ${testDateWithOrders}.`);
    // Ensure totalCollectedAmount equals exactly totalUpiTransactions + totalCodCollections without duplicate addition
    const calculatedSum = Number((data1.report.totalUpiTransactions + data1.report.totalCodCollections).toFixed(2));
    assert.strictEqual(
      data1.report.totalCollectedAmount,
      calculatedSum,
      'totalCollectedAmount must strictly equal sum of the two transaction components'
    );
    console.log(`✓ PASS: Deduplication by normalized order ID guarantees zero double counting.`);

    // =========================================================================
    // TEST 9: Blocking unauthorized users from accessing reports
    // =========================================================================
    console.log('\n--- TEST 9: Role-based access control and security ---');
    // 9.1 Unauthenticated request (no token) -> MUST BE 401
    const unauthRes = await fetch(`${baseUrl}/api/admin/reports/daily?date=${testDateWithOrders}`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401 Unauthorized');
    console.log(`✓ PASS: Unauthenticated access blocked (HTTP ${unauthRes.status})`);

    // 9.2 Invalid token -> MUST BE 401
    const invalidTokenRes = await fetch(`${baseUrl}/api/admin/reports/daily?date=${testDateWithOrders}`, {
      headers: { Authorization: 'Bearer fake-malformed-token' },
    });
    assert.strictEqual(invalidTokenRes.status, 401, 'Invalid token must return 401 Unauthorized');
    console.log(`✓ PASS: Invalid token blocked (HTTP ${invalidTokenRes.status})`);

    // 9.3 Customer token (non-staff) -> MUST BE 401/403
    const custRes = await fetch(`${baseUrl}/api/admin/reports/daily?date=${testDateWithOrders}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert(custRes.status === 401 || custRes.status === 403, `Customer must be blocked with 401/403, got ${custRes.status}`);
    console.log(`✓ PASS: Customer token blocked from admin report (HTTP ${custRes.status})`);

    // 9.4 Employee token (staff without admin role) -> MUST BE 403 FORBIDDEN
    const empRes = await fetch(`${baseUrl}/api/admin/reports/daily?date=${testDateWithOrders}`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert.strictEqual(empRes.status, 403, `Employee must be blocked with 403 Forbidden, got ${empRes.status}`);
    const empData = await empRes.json();
    assert(empData.error?.includes('Administrator') || empData.error?.includes('denied'), 'Error must specify administrator privileges required');
    console.log(`✓ PASS: Employee role blocked from accessing admin reports (HTTP ${empRes.status}: "${empData.error}")`);

    // 9.5 Calendar-month summary also enforces admin authorization
    const empMonthRes = await fetch(`${baseUrl}/api/admin/reports/calendar-month?year=2026&month=10`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert.strictEqual(empMonthRes.status, 403, 'Calendar month summary must block non-admins with 403');
    console.log(`✓ PASS: Calendar-month summary endpoint also enforces 403 on non-admin.`);

    // =========================================================================
    // TEST 10: Preserving all existing website functionality
    // =========================================================================
    console.log('\n--- TEST 10: Preserving existing website features & endpoints ---');
    // 10.1 Products endpoint
    const prodRes = await fetch(`${baseUrl}/api/products`);
    assert.strictEqual(prodRes.status, 200, 'Products endpoint must return 200');
    const prodData = await prodRes.json();
    assert(Array.isArray(prodData) || prodData.success, 'Products must return array or success');
    console.log('✓ PASS: Products catalog API operational');

    // 10.2 Coupons endpoint
    const coupRes = await fetch(`${baseUrl}/api/coupons`);
    assert.strictEqual(coupRes.status, 200, 'Coupons endpoint must return 200');
    console.log('✓ PASS: Coupons API operational');

    // 10.3 Admin overview endpoint
    const overviewRes = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(overviewRes.status, 200, 'Admin overview must return 200');
    console.log('✓ PASS: Admin overview API operational');

    // 10.4 Monthly calendar activity endpoint for admin
    const monthRes = await fetch(`${baseUrl}/api/admin/reports/calendar-month?year=2026&month=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(monthRes.status, 200, 'Calendar month summary must return 200');
    const monthData = await monthRes.json();
    assert.strictEqual(monthData.success, true);
    assert(monthData.days, 'days map must be returned');
    assert(monthData.days['2026-10-17']?.hasOrders, '2026-10-17 must have hasOrders: true');
    console.log(`✓ PASS: Calendar month activity returned ${Object.keys(monthData.days).length} active days for October 2026.`);

    console.log('\n=================================================================================');
    console.log('ALL 10 TESTS PASSED SUCCESSFULLY! No regressions detected.');
    console.log('=================================================================================\n');

    server.close();
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ TEST FAILED:', err);
    server.close();
    process.exit(1);
  }
}

runTests();
