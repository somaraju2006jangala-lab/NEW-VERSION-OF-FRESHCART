/**
 * Automated Verification Script for FreshCart Employee Portal & Unified Sign-In
 * Tests:
 * 1. Customer credentials authentication
 * 2. Employee credentials authentication
 * 3. Admin credentials authentication
 * 4. Invalid credentials rejection
 * 5. Employee access to Customer Orders Ledger API (/api/orders)
 * 6. Server-side RBAC: Employee blocked from Admin-only APIs (/api/admin/me, /api/admin/users, /api/admin/customers, /api/settings)
 * 7. Server-side RBAC: Customer blocked from Employee/Admin APIs (/api/employee/me, /api/admin/me)
 * 8. Admin full permissions preserved
 * 9. Token verification and session preservation
 */

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('Starting FreshCart Unified Auth & RBAC Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${details ? ` - ${details}` : ''}`);
      failed++;
    }
  }

  // 1. Customer Authentication Test
  console.log('--- Test 1: Customer Unified Sign-In ---');
  const custRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'customer@freshcart.com', password: 'FreshCart2026!' }),
  });
  const custData = await custRes.json();
  assert(custRes.status === 200 && custData.success === true, 'Customer login HTTP 200');
  assert(custData.role === 'customer' && custData.userRole === 'CUSTOMER', 'Customer role returned as CUSTOMER', JSON.stringify(custData));
  assert(Boolean(custData.token), 'Customer receives JWT auth token');

  // 2. Employee Authentication Test
  console.log('\n--- Test 2: Employee Unified Sign-In ---');
  const empRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'employee@freshcart.com', password: 'FreshCartEmployee2026!' }),
  });
  const empData = await empRes.json();
  assert(empRes.status === 200 && empData.success === true, 'Employee login HTTP 200');
  assert(empData.role === 'employee' && empData.userRole === 'EMPLOYEE', 'Employee role returned as EMPLOYEE', JSON.stringify(empData));
  assert(Boolean(empData.employee && empData.employee.role === 'employee'), 'Employee payload returned');
  assert(Boolean(empData.token), 'Employee receives authorized staff token');
  const employeeToken = empData.token;

  // 3. Admin Authentication Test
  console.log('\n--- Test 3: Admin Unified Sign-In ---');
  const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'owner@freshcart.com', password: 'FreshCartOwner2026!' }),
  });
  const adminData = await adminRes.json();
  assert(adminRes.status === 200 && adminData.success === true, 'Admin login HTTP 200');
  assert(adminData.role === 'admin' && adminData.userRole === 'ADMIN', 'Admin role returned as ADMIN', JSON.stringify(adminData));
  assert(Boolean(adminData.admin && (adminData.admin.role === 'owner' || adminData.admin.role === 'admin')), 'Admin payload returned');
  assert(Boolean(adminData.token), 'Admin receives admin JWT token');
  const adminToken = adminData.token;

  // 4. Invalid Credentials Test
  console.log('\n--- Test 4: Invalid Credentials Rejection ---');
  const invalidRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'employee@freshcart.com', password: 'WrongPassword999!' }),
  });
  const invalidData = await invalidRes.json();
  assert(invalidRes.status === 401 && invalidData.success === false, 'Invalid credentials rejected with HTTP 401');

  // 5. Employee Session Verification (/api/employee/me)
  console.log('\n--- Test 5: Employee Session Verification ---');
  const empMeRes = await fetch(`${BASE_URL}/api/employee/me`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  const empMeData = await empMeRes.json();
  assert(empMeRes.status === 200 && empMeData.success === true, 'Employee /api/employee/me returned HTTP 200');
  assert(empMeData.employee?.role === 'employee', 'Employee identity verified in server-side session');

  // 6. Employee Orders Access (/api/orders)
  console.log('\n--- Test 6: Employee Orders Ledger Access ---');
  const empOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  const empOrdersData = await empOrdersRes.json();
  assert(empOrdersRes.status === 200 && Array.isArray(empOrdersData.orders), 'Employee can access /api/orders Customer Orders Ledger');

  // 7. Server-side RBAC: Employee Blocked from Admin-only APIs
  console.log('\n--- Test 7: Employee Blocked From Admin APIs ---');
  
  // 7a. /api/admin/me
  const empAdminMeRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  assert(empAdminMeRes.status === 403, 'Employee blocked from GET /api/admin/me with 403 Forbidden');

  // 7b. /api/admin/users
  const empUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  assert(empUsersRes.status === 403, 'Employee blocked from GET /api/admin/users with 403 Forbidden');

  // 7c. /api/admin/customers
  const empCustRes = await fetch(`${BASE_URL}/api/admin/customers`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  assert(empCustRes.status === 403, 'Employee blocked from GET /api/admin/customers with 403 Forbidden');

  // 7d. /api/settings (Delivery charges update)
  const empSettingsRes = await fetch(`${BASE_URL}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${employeeToken}` },
    body: JSON.stringify({ deliveryCharges: 0 }),
  });
  assert(empSettingsRes.status === 403, 'Employee blocked from POST /api/settings with 403 Forbidden');

  // 7e. /api/payment-settings/upi
  const empUpiRes = await fetch(`${BASE_URL}/api/payment-settings/upi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${employeeToken}` },
    body: JSON.stringify({ upiId: 'hacker@upi' }),
  });
  assert(empUpiRes.status === 403, 'Employee blocked from POST /api/payment-settings/upi with 403 Forbidden');

  // 8. Server-side RBAC: Customer Blocked from Staff/Admin APIs
  console.log('\n--- Test 8: Customer Blocked From Employee & Admin APIs ---');
  const customerToken = custData.token;

  const custEmpMeRes = await fetch(`${BASE_URL}/api/employee/me`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(custEmpMeRes.status === 401 || custEmpMeRes.status === 403, 'Customer blocked from /api/employee/me with 401/403');

  const custAdminMeRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert(custAdminMeRes.status === 401 || custAdminMeRes.status === 403, 'Customer blocked from /api/admin/me with 401/403');

  // 9. Admin Permissions Intact
  console.log('\n--- Test 9: Admin Permissions Intact ---');
  const adminMeRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminMeData = await adminMeRes.json();
  assert(adminMeRes.status === 200 && adminMeData.success === true, 'Admin can access GET /api/admin/me with 200 OK');

  const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminUsersRes.status === 200, 'Admin can access GET /api/admin/users with 200 OK');

  const adminOverviewRes = await fetch(`${BASE_URL}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminOverviewRes.status === 200, 'Admin can access GET /api/admin/overview with 200 OK');

  console.log('\n====================================================');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
