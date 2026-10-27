import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';

async function verify() {
  console.log('====================================================');
  console.log('Testing Removal of Demo Versions & Live Portal Integration');
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

  // 1. Check LoginPage.tsx
  console.log('--- 1. Checking LoginPage.tsx ---');
  const loginContent = fs.readFileSync(path.resolve('src/components/LoginPage.tsx'), 'utf-8');
  assert(!loginContent.includes('demo-login-customer-btn'), 'demo-login-customer-btn removed from LoginPage');
  assert(!loginContent.includes('demo-login-employee-btn'), 'demo-login-employee-btn removed from LoginPage');
  assert(!loginContent.includes('handleFillCustomerDemo'), 'handleFillCustomerDemo removed from LoginPage');
  assert(!loginContent.includes('handleFillEmployeeDemo'), 'handleFillEmployeeDemo removed from LoginPage');
  assert(!loginContent.includes('DEMO_CUSTOMER_EMAIL'), 'DEMO_CUSTOMER_EMAIL removed from LoginPage');
  assert(!loginContent.includes('DEMO_EMPLOYEE_EMAIL'), 'DEMO_EMPLOYEE_EMAIL removed from LoginPage');
  assert(loginContent.includes('demo-login-admin-btn'), 'demo-login-admin-btn preserved in LoginPage for Admin');

  // 2. Check CustomerDashboard.tsx
  console.log('--- 2. Checking CustomerDashboard.tsx ---');
  const customerContent = fs.readFileSync(path.resolve('src/components/CustomerDashboard.tsx'), 'utf-8');
  assert(!customerContent.includes("'Springfield'"), "'Springfield' placeholder removed from CustomerDashboard");
  assert(!customerContent.includes("'97477'"), "'97477' placeholder removed from CustomerDashboard");
  assert(!customerContent.includes('123 Main St, Apt 2'), "'123 Main St, Apt 2' placeholder removed from CustomerDashboard");

  // 3. Check EmployeePortal.tsx
  console.log('--- 3. Checking EmployeePortal.tsx ---');
  const employeeContent = fs.readFileSync(path.resolve('src/components/EmployeePortal.tsx'), 'utf-8');
  assert(!employeeContent.includes('emp_001'), "'emp_001' placeholder removed from EmployeePortal");

  // 4. Check Header.tsx
  console.log('--- 4. Checking Header.tsx ---');
  const headerContent = fs.readFileSync(path.resolve('src/components/Header.tsx'), 'utf-8');
  assert(headerContent.includes('header-employee-portal-btn'), 'header-employee-portal-btn added to Header navigation');
  assert(headerContent.includes('currentEmployee'), 'currentEmployee prop supported in Header');

  // 5. Test Live Backend APIs
  console.log('--- 5. Checking Live Database & API Endpoints ---');
  // Check products from MySQL
  const prodRes = await fetch(`${BASE_URL}/api/products`);
  assert(prodRes.ok, '/api/products returns HTTP 200 from backend MySQL');
  const prodData = await prodRes.json();
  assert(Array.isArray(prodData.products) && prodData.products.length > 0, `Live products returned from MySQL (${prodData.products?.length} products)`);

  // Check Employee Login against backend
  const empRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'employee@freshcart.com', password: 'FreshCartEmployee2026!' }),
  });
  assert(empRes.ok, 'Employee login succeeded via /api/auth/login');
  const empData = await empRes.json();
  assert(empData.role === 'employee', 'Employee role returned as employee');
  assert(!!empData.token, 'Employee token generated');

  // Check Employee Orders
  const empOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: {
      Authorization: `Bearer ${empData.token}`,
      'x-admin-role': 'employee',
      'x-employee-id': empData.employee?.employeeId || '',
    },
  });
  assert(empOrdersRes.ok, 'Employee can fetch assigned delivery orders from /api/orders');

  // Check Customer Login against backend
  const custRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'rahul@example.com', password: 'FreshCart2026!' }),
  });
  assert(custRes.ok, 'Customer login succeeded via /api/auth/login');
  const custData = await custRes.json();
  assert(custData.role === 'customer', 'Customer role returned as customer');
  assert(!!custData.token, 'Customer token generated');

  // Check Customer Orders Isolation
  const custOrdersRes = await fetch(`${BASE_URL}/api/orders?customerId=rahul123`, {
    headers: { Authorization: `Bearer ${custData.token}` },
  });
  assert(custOrdersRes.ok, 'Customer can fetch their own orders from /api/orders');
  const custOrdersData = await custOrdersRes.json();
  const allMatchCustomer = custOrdersData.orders?.every((o: any) => o.customerId === 'rahul123');
  assert(allMatchCustomer, 'Customer only receives their own orders (no cross-customer data leakage)');

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

verify().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
