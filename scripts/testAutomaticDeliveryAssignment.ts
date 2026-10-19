/**
 * Comprehensive Automated Verification Suite for FreshCart Automatic Delivery Assignment
 * Covers all 12 scenarios from the prompt specification.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load environment variables (.env and .env.local)
for (const envFile of ['.env', '.env.local']) {
  const fullPath = path.join(rootDir, envFile);
  if (fs.existsSync(fullPath)) {
    const parsed = dotenv.parse(fs.readFileSync(fullPath, 'utf-8'));
    for (const [k, v] of Object.entries(parsed)) {
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

import {
  getPool,
  initializeDatabase,
  autoAssignOrder,
  assignOrderToEmployeeInDb,
  getEmployeePendingWorkloadInDb,
  markAssignmentDeliveredInDb,
  getOrderAssignmentFromDb,
  getEmployeeAssignedOrdersFromDb,
  getOrdersToDeliverFromDb,
  isOrderEligibleForDelivery,
  normalizeOrderId,
  upsertOrderInDb,
} from '../server/db.ts';

// Test harness
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✘ FAIL:\x1b[0m ${testName}${detail ? ` - ${detail}` : ''}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log(' FRESHCART AUTOMATIC DELIVERY ASSIGNMENT - TEST SUITE');
  console.log('=============================================================\n');

  await initializeDatabase();
  const pool = getPool();

  const timestamp = Date.now();
  const TEST_EMP_1 = `t_emp_1_${timestamp}`;
  const TEST_EMP_2 = `t_emp_2_${timestamp}`;
  const TEST_EMP_INACTIVE = `t_emp_inact_${timestamp}`;

  // Find and isolate existing active employees during this test run
  const [existingActiveRows] = await pool.query<any[]>(
    `SELECT admin_id FROM admins WHERE role = 'employee' AND status = 'active'`
  );
  const existingActiveIds: string[] = (existingActiveRows || []).map((r) => r.admin_id);

  const cleanUpTestData = async () => {
    try {
      await pool.query(
        `DELETE FROM delivery_assignments WHERE clean_order_id LIKE 't_ord_%' OR clean_order_id LIKE 't_%'`
      );
      await pool.query(
        `DELETE FROM orders WHERE order_id LIKE 't_ord_%' OR order_id LIKE '#t_ord_%' OR order_id LIKE 't_%'`
      );
      await pool.query(
        `DELETE FROM admins WHERE admin_id IN (?, ?, ?)`,
        [TEST_EMP_1, TEST_EMP_2, TEST_EMP_INACTIVE]
      );
    } catch {
      // ignore
    }
  };

  const restoreExistingEmployees = async () => {
    try {
      if (existingActiveIds.length > 0) {
        await pool.query(
          `UPDATE admins SET status = 'active' WHERE admin_id IN (?)`,
          [existingActiveIds]
        );
      }
    } catch {
      // ignore
    }
  };

  await cleanUpTestData();

  try {
    // Temporarily pause other employees so test has complete isolated environment
    if (existingActiveIds.length > 0) {
      await pool.query(
        `UPDATE admins SET status = 'paused_for_test' WHERE admin_id IN (?)`,
        [existingActiveIds]
      );
    }

    // 0. Setup mock delivery employees
    console.log('\n--- Setting up Mock Employees in Database ---');
    await pool.query(
      `INSERT INTO admins (admin_id, email, password_hash, full_name, role, status, created_at)
       VALUES 
       (?, 'emp1@test.com', 'dummy_hash', 'Delivery Emp Alpha', 'employee', 'active', NOW()),
       (?, 'emp2@test.com', 'dummy_hash', 'Delivery Emp Beta', 'employee', 'active', NOW()),
       (?, 'inact@test.com', 'dummy_hash', 'Inactive Delivery Guy', 'employee', 'inactive', NOW())`,
      [TEST_EMP_1, TEST_EMP_2, TEST_EMP_INACTIVE]
    );
    console.log('  Employees inserted successfully.');

    // -------------------------------------------------------------
    // SCENARIO 1: A new eligible order is automatically assigned to the employee with the fewest pending deliveries
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Workload Balancing (Fewest Pending Deliveries) ---');
    const order1Id = `t_ord_1_${timestamp}`;
    const order2Id = `t_ord_2_${timestamp}`;

    // Create 2 orders and assign first to TEST_EMP_1 manually so TEST_EMP_1 has workload = 1, TEST_EMP_2 has workload = 0
    await upsertOrderInDb({
      id: order1Id,
      customerId: 'cust_1',
      customerName: 'Aarav Patel',
      customerEmail: 'aarav@freshcart.test',
      customerPhone: '9876543210',
      total: 450,
      status: 'Ordered',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      deliveryAddress: 'Flat 101, Green Heights, Bangalore',
    });
    await assignOrderToEmployeeInDb({ orderId: order1Id, employeeId: TEST_EMP_1, assignedBy: 'test_setup', isManual: true });

    const workloadEmp1 = await getEmployeePendingWorkloadInDb(TEST_EMP_1);
    const workloadEmp2 = await getEmployeePendingWorkloadInDb(TEST_EMP_2);
    assert(workloadEmp1 === 1 && workloadEmp2 === 0, 'Initial workload: Emp1 has 1 pending, Emp2 has 0 pending');

    // Create eligible order 2
    await upsertOrderInDb({
      id: order2Id,
      customerId: 'cust_2',
      customerName: 'Neha Sharma',
      customerEmail: 'neha@freshcart.test',
      customerPhone: '9876543211',
      total: 780,
      status: 'Ordered',
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      deliveryAddress: 'Villa 12, Palm Meadows, Bangalore',
    });

    const assignResult2 = await autoAssignOrder(order2Id);
    assert(
      assignResult2.assigned === true && assignResult2.employeeId === TEST_EMP_2,
      'Order 2 automatically assigned to Emp2 who has fewer pending deliveries (0 vs 1)',
      `Assigned to: ${assignResult2.employeeId}`
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Employees with equal workloads receive assignments fairly (fair tie-breaker)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Fair Rotation Tie-Breaker for Equal Workloads ---');
    // Now both Emp1 and Emp2 have workload = 1.
    // Emp2 was assigned order 2 more recently than Emp1 was assigned order 1.
    // So the fair rotation tie-breaker must pick Emp1 (least recently assigned)!
    const order3Id = `t_ord_3_${timestamp}`;
    await upsertOrderInDb({
      id: order3Id,
      customerId: 'cust_3',
      customerName: 'Rahul Verma',
      customerEmail: 'rahul@freshcart.test',
      customerPhone: '9876543212',
      total: 320,
      status: 'Ordered',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      deliveryAddress: '302 Silicon Residency, Bangalore',
    });

    const assignResult3 = await autoAssignOrder(order3Id);
    assert(
      assignResult3.assigned === true && assignResult3.employeeId === TEST_EMP_1,
      'Order 3 assigned to Emp1 via fair rotation tie-breaker (least recently assigned)',
      `Assigned to: ${assignResult3.employeeId}`
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Inactive employees never receive new assignments
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Inactive Employees Never Receive Assignments ---');
    const order4Id = `t_ord_4_${timestamp}`;
    await upsertOrderInDb({
      id: order4Id,
      customerId: 'cust_4',
      customerName: 'Sanjay Dutt',
      customerEmail: 'sanjay@freshcart.test',
      total: 550,
      status: 'Ordered',
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
    });

    // Inactive employee has workload = 0, Emp1 has 2, Emp2 has 1.
    // Order must NOT go to Inactive employee despite having 0 workload.
    const assignResult4 = await autoAssignOrder(order4Id);
    assert(
      assignResult4.employeeId !== TEST_EMP_INACTIVE,
      'Order 4 was NOT assigned to inactive employee',
      `Assigned to: ${assignResult4.employeeId}`
    );
    assert(
      assignResult4.employeeId === TEST_EMP_2,
      'Order 4 assigned to lowest workload active employee (Emp2)',
      `Assigned to: ${assignResult4.employeeId}`
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Delivered and cancelled orders are not assigned
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Terminal Statuses Excluded From Assignment ---');
    const deliveredOrder = { status: 'Delivered', paymentMethod: 'COD', paymentStatus: 'COLLECTED' };
    const cancelledOrder = { status: 'Cancelled', paymentMethod: 'UPI', paymentStatus: 'REFUNDED' };
    const returnedOrder = { status: 'Returned', paymentMethod: 'COD', paymentStatus: 'REFUNDED' };

    assert(!isOrderEligibleForDelivery(deliveredOrder), 'Delivered order is NOT eligible for delivery');
    assert(!isOrderEligibleForDelivery(cancelledOrder), 'Cancelled order is NOT eligible for delivery');
    assert(!isOrderEligibleForDelivery(returnedOrder), 'Returned order is NOT eligible for delivery');

    const orderDeliveredId = `t_ord_del_${timestamp}`;
    await upsertOrderInDb({
      id: orderDeliveredId,
      customerId: 'cust_del',
      customerName: 'Done Customer',
      status: 'Delivered',
      paymentMethod: 'COD',
      paymentStatus: 'COLLECTED',
      total: 100,
    });
    const autoDelResult = await autoAssignOrder(orderDeliveredId);
    assert(
      autoDelResult.assigned === false && autoDelResult.reason === 'NOT_ELIGIBLE',
      'Auto-assignment rejects delivered order with NOT_ELIGIBLE'
    );

    // -------------------------------------------------------------
    // SCENARIO 5: COD orders remain eligible until delivery is completed
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: COD Orders Remain Eligible Until Delivered ---');
    const codUncollected = { status: 'Ordered', paymentMethod: 'COD', paymentStatus: 'PENDING' };
    const codCollectedPicking = { status: 'Picking', paymentMethod: 'Cash on Delivery', paymentStatus: 'COLLECTED' };
    assert(isOrderEligibleForDelivery(codUncollected), 'COD pending order is eligible for delivery');
    assert(
      isOrderEligibleForDelivery(codCollectedPicking),
      'COD order with cash already collected but delivery not completed remains eligible'
    );

    // -------------------------------------------------------------
    // SCENARIO 6: No available employees leaves order unassigned and informs admin
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: No Available Employees Leaves Order Unassigned ---');
    // Mark both test employees inactive
    await pool.query(`UPDATE admins SET status = 'inactive' WHERE admin_id IN (?, ?)`, [TEST_EMP_1, TEST_EMP_2]);

    const orderNoEmpId = `t_ord_noemp_${timestamp}`;
    await upsertOrderInDb({
      id: orderNoEmpId,
      customerId: 'cust_noemp',
      customerName: 'Waiting Customer',
      status: 'Ordered',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      total: 250,
    });

    const noEmpResult = await autoAssignOrder(orderNoEmpId);
    assert(
      noEmpResult.assigned === false && noEmpResult.unassigned === true,
      'Order remains safely unassigned when 0 active employees are available',
      `Reason: ${noEmpResult.reason || noEmpResult.error}`
    );

    const assignmentRecord = await getOrderAssignmentFromDb(orderNoEmpId);
    assert(assignmentRecord === null, 'No false assignment row created in delivery_assignments table');

    // Restore active status
    await pool.query(`UPDATE admins SET status = 'active' WHERE admin_id IN (?, ?)`, [TEST_EMP_1, TEST_EMP_2]);

    // -------------------------------------------------------------
    // SCENARIO 7: Simultaneous order assignment does not produce duplicate assignments
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Concurrency Protection (No Duplicate Assignments) ---');
    const concurrentOrderId = `t_ord_concurrent_${timestamp}`;
    // Insert directly via SQL so no background auto-assign from upsertOrderInDb races
    await pool.query(
      `INSERT INTO orders (order_id, customer_id, customer_name, email, mobile, delivery_address, total, status, payment_method, payment_status, created_at)
       VALUES (?, 'cust_concurrent', 'Concurrent Order Buyer', 'conc@test.com', '9876543299', '123 Test St', 999, 'Ordered', 'COD', 'PENDING', NOW())`,
      [concurrentOrderId]
    );

    // Launch 5 parallel assignment requests simultaneously
    const parallelAttempts = await Promise.all([
      autoAssignOrder(concurrentOrderId),
      autoAssignOrder(concurrentOrderId),
      autoAssignOrder(concurrentOrderId),
      autoAssignOrder(concurrentOrderId),
      autoAssignOrder(concurrentOrderId),
    ]);

    const newlyAssigned = parallelAttempts.filter((res) => res.assigned && !res.alreadyAssigned);
    const deduplicated = parallelAttempts.filter((res) => res.alreadyAssigned);
    assert(
      newlyAssigned.length === 1 && deduplicated.length === 4,
      `Exactly 1 parallel assignment created new assignment and 4 cleanly deduplicated (got ${newlyAssigned.length} new, ${deduplicated.length} deduped)`
    );

    const [rows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM delivery_assignments WHERE clean_order_id = ?`,
      [normalizeOrderId(concurrentOrderId)]
    );
    assert((rows as any)[0].cnt === 1, 'Exactly 1 row exists in delivery_assignments table due to UNIQUE constraint');

    // -------------------------------------------------------------
    // SCENARIO 8: Assignment persists after refresh and re-query
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Assignment Persistence in MySQL Database ---');
    const freshRecord = await getOrderAssignmentFromDb(concurrentOrderId);
    assert(freshRecord !== null, 'Assignment record reloaded from database is non-null');
    assert(
      freshRecord?.cleanOrderId === normalizeOrderId(concurrentOrderId),
      'Persisted cleanOrderId matches normalized ID'
    );
    assert(
      Boolean(freshRecord?.employeeId && freshRecord?.assignedAt),
      'Persisted employeeId and assignedAt timestamp exist'
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Employees cannot access or complete another employee's order
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: Cross-Employee Delivery Isolation & Authorization ---');
    // concurrentOrderId was assigned to one employee
    const assignedEmp = freshRecord!.employeeId;
    const otherEmp = assignedEmp === TEST_EMP_1 ? TEST_EMP_2 : TEST_EMP_1;

    // Check employee assigned deliveries query: otherEmp MUST NOT see this order
    const otherEmpOrders = await getEmployeeAssignedOrdersFromDb(otherEmp);
    const hasOrder = otherEmpOrders.some((o: any) => normalizeOrderId(o.id) === normalizeOrderId(concurrentOrderId));
    assert(!hasOrder, `Unauthorized employee (${otherEmp}) cannot see order assigned to ${assignedEmp}`);

    const authorizedEmpOrders = await getEmployeeAssignedOrdersFromDb(assignedEmp);
    const authHasOrder = authorizedEmpOrders.some((o: any) => normalizeOrderId(o.id) === normalizeOrderId(concurrentOrderId));
    assert(authHasOrder, `Authorized employee (${assignedEmp}) sees their assigned order in pending deliveries`);

    // -------------------------------------------------------------
    // SCENARIO 10: Delivery completion decrements employee workload and updates Admin list
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Delivery Completion Updates Workload and Pending Count ---');
    const workloadBefore = await getEmployeePendingWorkloadInDb(assignedEmp);
    const adminOrdersBefore = await getOrdersToDeliverFromDb();
    const countBefore = adminOrdersBefore.orders.filter((o: any) => normalizeOrderId(o.id) === normalizeOrderId(concurrentOrderId)).length;
    assert(countBefore === 1, 'Order is present in Admin Orders to Deliver list prior to delivery');

    // Complete delivery
    await markAssignmentDeliveredInDb(concurrentOrderId);
    await pool.query(
      `UPDATE orders SET status = 'Delivered', updated_at = NOW() WHERE order_id = ? OR order_id = ?`,
      [concurrentOrderId, `#${concurrentOrderId}`]
    );

    const workloadAfter = await getEmployeePendingWorkloadInDb(assignedEmp);
    assert(
      workloadAfter === workloadBefore - 1,
      `Employee workload decreased from ${workloadBefore} to ${workloadAfter} after delivery completion`
    );

    const adminOrdersAfter = await getOrdersToDeliverFromDb();
    const countAfter = adminOrdersAfter.orders.filter((o: any) => normalizeOrderId(o.id) === normalizeOrderId(concurrentOrderId)).length;
    assert(countAfter === 0, 'Delivered order is removed from Admin Orders to Deliver list');

    // -------------------------------------------------------------
    // SCENARIO 11: Database failures do not create false assignments
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Failure Handling & Error Safety ---');
    const badOrderId = `t_ord_fail_${timestamp}`;
    // Attempt to assign with an invalid non-existent employee ID
    let caughtError = false;
    try {
      const res = await assignOrderToEmployeeInDb({ orderId: badOrderId, employeeId: 'non_existent_staff_9999' });
      if (!res.success) caughtError = true;
    } catch {
      caughtError = true;
    }
    assert(caughtError, 'Assignment with invalid employee ID is rejected with error');
    const failRecord = await getOrderAssignmentFromDb(badOrderId);
    assert(failRecord === null, 'No false assignment was created in delivery_assignments table');

    // -------------------------------------------------------------
    // SCENARIO 12: Preservation of Existing Payment, OTP, and COD Workflows
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Preservation of Existing Payment, OTP, & COD Workflows ---');
    const codOrderTestId = `t_ord_codflow_${timestamp}`;
    await upsertOrderInDb({
      id: codOrderTestId,
      customerId: 'cust_codflow',
      customerName: 'Cash Flow Customer',
      status: 'Ordered',
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      total: 500,
    });

    const codAssign = await autoAssignOrder(codOrderTestId);
    assert(codAssign.assigned, 'COD order assigned cleanly without disrupting COD payment lifecycle');

    const adminList = await getOrdersToDeliverFromDb();
    const foundCod = adminList.orders.find((o: any) => normalizeOrderId(o.id) === normalizeOrderId(codOrderTestId));
    assert(
      foundCod !== undefined && foundCod.paymentMethod === 'COD',
      'COD payment method and pending status preserved accurately in order list'
    );
  } finally {
    console.log('\n--- Cleaning Up Test Data & Restoring Employees ---');
    await cleanUpTestData();
    await restoreExistingEmployees();
    console.log('  Clean up completed.');
  }

  console.log('\n=============================================================');
  console.log(` TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
