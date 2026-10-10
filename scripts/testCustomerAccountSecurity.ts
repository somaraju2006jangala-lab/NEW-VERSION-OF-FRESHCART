import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';

try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {
  // ignore
}

import { apiApp } from '../server/apiRouter.ts';
import { connectMySql, getPool, findCustomerInDb } from '../server/db.ts';

function simulateRequest(
  method: string,
  requestUrl: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = requestUrl.split('?');
    const query: Record<string, string> = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((v, k) => {
        query[k] = v;
      });
    }

    let responseStatusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseBody: any = null;
    let resolved = false;

    const finish = () => {
      if (!resolved) {
        resolved = true;
        resolve({ status: responseStatusCode, body: responseBody, headers: responseHeaders });
      }
    };

    const req: any = {
      method: method.toUpperCase(),
      url: requestUrl,
      path: pathPart,
      query,
      headers: (() => {
        const h: Record<string, string> = { 'content-type': 'application/json' };
        for (const [k, v] of Object.entries(headers)) {
          h[k.toLowerCase()] = v;
        }
        return h;
      })(),
      body: body || {},
    };

    const res: any = {
      statusCode: 200,
      setHeader: (name: string, value: string) => {
        responseHeaders[name.toLowerCase()] = String(value);
      },
      getHeader: (name: string) => responseHeaders[name.toLowerCase()],
      status: (code: number) => {
        responseStatusCode = code;
        res.statusCode = code;
        return res;
      },
      json: (data: any) => {
        responseBody = data;
        finish();
        return res;
      },
      send: (data: any) => {
        if (typeof data === 'string') {
          try {
            responseBody = JSON.parse(data);
          } catch {
            responseBody = data;
          }
        } else {
          responseBody = data;
        }
        finish();
        return res;
      },
      end: (data?: any) => {
        if (data && !responseBody) {
          try {
            responseBody = JSON.parse(data.toString());
          } catch {
            responseBody = data.toString();
          }
        }
        finish();
      },
    };

    try {
      (apiApp as any)(req, res, () => {
        responseStatusCode = 404;
        responseBody = { error: 'Not found' };
        finish();
      });
    } catch (err: any) {
      responseStatusCode = 500;
      responseBody = { error: err?.message };
      finish();
    }
  });
}

async function runTests() {
  console.log('=============================================================================');
  console.log('FreshCart — Testing Customer Account Details & Secure Password Protection');
  console.log('=============================================================================\n');

  await connectMySql().catch((e) => {
    console.warn('MySQL connect notice:', e?.message);
  });

  // TEST 1: Unauthorized users cannot access customer accounts
  console.log('▶ TEST 1: Verify unauthorized users CANNOT access customer accounts...');
  const unauthRes = await simulateRequest('GET', '/api/admin/customers');
  console.log(`  Response status: ${unauthRes.status}`);
  assert.strictEqual(
    unauthRes.status,
    401,
    `Expected 401 Unauthorized for unauthenticated customer accounts request, got ${unauthRes.status}`
  );
  assert.strictEqual(unauthRes.body?.success, false);
  console.log('  ✔ Passed: Access denied to unauthenticated requests without admin token.\n');

  // TEST 2: Register a new customer
  const timestamp = Date.now();
  const testEmail = `aarti.patel.${timestamp}@freshcart.com`;
  const testPhone = `98765${String(timestamp).slice(-5)}`;
  const testPassword = 'Password@2026!';
  const testName = 'Aarti Patel';

  console.log(`▶ TEST 2: Registering customer "${testName}" (${testEmail})...`);
  const regRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: testName,
    email: testEmail,
    phone: testPhone,
    password: testPassword,
    address: 'Flat 302, Lotus Towers, Whitefield, Bengaluru 560066',
  });

  console.log(`  Registration status: ${regRes.status}`);
  assert.strictEqual(regRes.status, 201, `Expected 201 Created, got ${regRes.status}`);
  assert.strictEqual(regRes.body?.success, true);
  assert.ok(regRes.body?.customer?.id, 'Expected customer ID in registration response');
  const registeredCustomerId = regRes.body.customer.id;

  // Verify registration response NEVER reveals passwords or password hashes
  assert.strictEqual(regRes.body?.customer?.password, undefined, 'Password must not be in registration response');
  assert.strictEqual(regRes.body?.customer?.password_hash, undefined, 'password_hash must not be in registration response');
  assert.strictEqual(regRes.body?.customer?.passwordHash, undefined, 'passwordHash must not be in registration response');
  console.log(`  ✔ Passed: Customer registered with ID: ${registeredCustomerId}`);
  console.log('  ✔ Passed: Passwords and hashes are NEVER returned in customer registration API.\n');

  // TEST 3: Customer Login Verification
  console.log('▶ TEST 3: Verifying customer login with correct and incorrect credentials...');
  // 3a. Correct login
  const loginSuccessRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });
  assert.strictEqual(loginSuccessRes.status, 200, `Expected 200 OK on correct login, got ${loginSuccessRes.status}`);
  assert.strictEqual(loginSuccessRes.body?.success, true);
  assert.strictEqual(loginSuccessRes.body?.customer?.password, undefined, 'Password must not be returned on login');
  assert.strictEqual(loginSuccessRes.body?.customer?.passwordHash, undefined, 'passwordHash must not be returned on login');
  console.log('  ✔ Passed: Customer logged in successfully with valid password.');

  // 3b. Incorrect login
  const loginFailRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: 'WrongPassword123!',
  });
  assert.strictEqual(loginFailRes.status, 401, `Expected 401 on incorrect password, got ${loginFailRes.status}`);
  assert.strictEqual(loginFailRes.body?.success, false);
  console.log('  ✔ Passed: Customer login rejected on invalid password.\n');

  // TEST 4: Admin Authentication & Access to Customer Accounts
  console.log('▶ TEST 4: Admin authentication & viewing Customer Accounts...');
  // Login as admin
  const ownerPassword = process.env.ADMIN_OWNER_PASSWORD || 'FreshCartOwner2026!';
  const adminLoginRes = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: 'owner@freshcart.com',
    password: ownerPassword,
  });
  let adminToken = adminLoginRes.body?.token;
  if (!adminToken) {
    // Try default admin login by ID
    const adminLoginFallback = await simulateRequest('POST', '/api/admin/login', {}, {
      identifier: 'admin_owner_001',
      password: ownerPassword,
    });
    adminToken = adminLoginFallback.body?.token;
  }
  assert.ok(adminToken, `Admin token required for authorized tests: ${adminLoginRes.body?.error}`);

  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // Fetch Customer Accounts as Admin
  const adminCustomersRes = await simulateRequest('GET', '/api/admin/customers', adminHeaders);
  console.log(`  Admin customers query status: ${adminCustomersRes.status}`);
  assert.strictEqual(adminCustomersRes.status, 200);
  assert.strictEqual(adminCustomersRes.body?.success, true);
  assert.ok(Array.isArray(adminCustomersRes.body?.customers), 'Expected customers array');

  const customersList: any[] = adminCustomersRes.body.customers;
  console.log(`  Total customers returned in Admin Portal: ${customersList.length}`);

  // Find newly registered customer in list
  const foundCustomer = customersList.find((c) => c.customerId === registeredCustomerId || c.email === testEmail);
  assert.ok(foundCustomer, `Registered customer ${testEmail} should appear in Admin Portal`);
  assert.strictEqual(foundCustomer.name, testName);
  assert.strictEqual(foundCustomer.email, testEmail);
  assert.strictEqual(foundCustomer.status, 'Active');
  assert.ok(foundCustomer.createdAt, 'Customer must have registration date');

  // Strict Password Privacy Check across ALL customers in admin response
  for (const c of customersList) {
    assert.strictEqual(c.password, undefined, `Password must NOT be present in admin response for customer ${c.customerId}`);
    assert.strictEqual(c.password_hash, undefined, `password_hash must NOT be present in admin response for customer ${c.customerId}`);
    assert.strictEqual(c.passwordHash, undefined, `passwordHash must NOT be present in admin response for customer ${c.customerId}`);
  }
  console.log('  ✔ Passed: Newly registered customer appears in Admin Portal with all details.');
  console.log('  ✔ Passed: Absolutely ZERO customer passwords or password hashes are exposed to admins.\n');

  // TEST 5: Search functionality in Admin Portal
  console.log('▶ TEST 5: Search functionality in Admin Portal...');
  // 5a. Search by Name
  const searchByName = await simulateRequest('GET', `/api/admin/customers?search=${encodeURIComponent('Aarti')}`, adminHeaders);
  assert.ok(searchByName.body?.customers?.some((c: any) => c.email === testEmail), 'Search by name should find customer');
  console.log('  ✔ Passed: Search by customer name finds the account.');

  // 5b. Search by User ID
  const searchById = await simulateRequest('GET', `/api/admin/customers?search=${encodeURIComponent(registeredCustomerId)}`, adminHeaders);
  assert.ok(searchById.body?.customers?.some((c: any) => c.customerId === registeredCustomerId), 'Search by User ID should find customer');
  console.log('  ✔ Passed: Search by User ID finds the account.');

  // 5c. Search by Email
  const searchByEmail = await simulateRequest('GET', `/api/admin/customers?search=${encodeURIComponent(testEmail)}`, adminHeaders);
  assert.ok(searchByEmail.body?.customers?.some((c: any) => c.email === testEmail), 'Search by email should find customer');
  console.log('  ✔ Passed: Search by email finds the account.');

  // 5d. Search by Phone
  const searchByPhone = await simulateRequest('GET', `/api/admin/customers?search=${encodeURIComponent(testPhone.slice(-6))}`, adminHeaders);
  assert.ok(searchByPhone.body?.customers?.some((c: any) => c.email === testEmail), 'Search by phone should find customer');
  console.log('  ✔ Passed: Search by phone number finds the account.\n');

  // TEST 6: Single Customer Details API
  console.log('▶ TEST 6: Single Customer Details API (/api/admin/customers/:id)...');
  const singleDetailRes = await simulateRequest('GET', `/api/admin/customers/${registeredCustomerId}`, adminHeaders);
  assert.strictEqual(singleDetailRes.status, 200);
  assert.strictEqual(singleDetailRes.body?.customer?.customerId, registeredCustomerId);
  assert.strictEqual(singleDetailRes.body?.customer?.password, undefined);
  assert.strictEqual(singleDetailRes.body?.customer?.password_hash, undefined);
  assert.strictEqual(singleDetailRes.body?.customer?.passwordHash, undefined);
  console.log('  ✔ Passed: Customer details retrieved securely without passwords.\n');

  // TEST 7: Account Status Suspension & Reactivation
  console.log('▶ TEST 7: Account Status Suspension & Reactivation...');
  // Suspend customer
  const suspendRes = await simulateRequest('PATCH', `/api/admin/customers/${registeredCustomerId}/status`, adminHeaders, {
    status: 'Suspended',
  });
  assert.strictEqual(suspendRes.status, 200);
  assert.strictEqual(suspendRes.body?.status, 'Suspended');

  // Customer attempts login while suspended
  const suspendedLoginRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });
  assert.strictEqual(suspendedLoginRes.status, 403, 'Suspended customer should receive 403 Forbidden');
  console.log('  ✔ Passed: Suspended customer is blocked from login.');

  // Reactivate customer
  const activateRes = await simulateRequest('PATCH', `/api/admin/customers/${registeredCustomerId}/status`, adminHeaders, {
    status: 'Active',
  });
  assert.strictEqual(activateRes.status, 200);
  assert.strictEqual(activateRes.body?.status, 'Active');

  // Customer logs in again
  const reactivatedLoginRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });
  assert.strictEqual(reactivatedLoginRes.status, 200, 'Reactivated customer should log in successfully');
  console.log('  ✔ Passed: Reactivated customer can log in again.\n');

  // TEST 8: Secure Password Reset Flow (Never reveals existing password)
  console.log('▶ TEST 8: Secure Password Reset Flow...');
  const forgotRes = await simulateRequest('POST', '/api/auth/forgot-password', {}, {
    email: testEmail,
  });
  assert.strictEqual(forgotRes.status, 200);
  assert.strictEqual(forgotRes.body?.success, true);
  const resetToken = forgotRes.body?.resetToken;
  assert.ok(resetToken, 'Reset token generated');

  const newTestPassword = 'NewSecretPassword2026!';
  const resetRes = await simulateRequest('POST', '/api/auth/reset-password', {}, {
    identifier: testEmail,
    resetToken,
    newPassword: newTestPassword,
  });
  assert.strictEqual(resetRes.status, 200);
  assert.strictEqual(resetRes.body?.success, true);

  // Verify customer can log in with new password
  const newLoginRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: newTestPassword,
  });
  assert.strictEqual(newLoginRes.status, 200, 'Customer should log in with new password');

  // Verify old password no longer works
  const oldLoginRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });
  assert.strictEqual(oldLoginRes.status, 401, 'Old password must be rejected');
  console.log('  ✔ Passed: Secure password reset succeeded without exposing original password.\n');

  // TEST 9: Database Hash Verification
  console.log('▶ TEST 9: Direct Database Password Hash Verification...');
  const pool = getPool();
  const [rows] = await pool.query<any[]>('SELECT customer_id, password_hash FROM customers WHERE customer_id = ?', [registeredCustomerId]);
  assert.strictEqual(rows.length, 1);
  const dbHash = rows[0].password_hash;
  assert.ok(dbHash.startsWith('$2a$') || dbHash.startsWith('$2b$'), `Password hash in DB must be salted bcrypt ($2a$/$2b$), got: ${dbHash.slice(0, 7)}...`);
  assert.notStrictEqual(dbHash, testPassword, 'Stored password must NOT be plain text');
  assert.notStrictEqual(dbHash, newTestPassword, 'Stored password must NOT be plain text');
  console.log(`  Stored hash format in MySQL: ${dbHash.slice(0, 15)}... (one-way salted bcrypt)`);
  console.log('  ✔ Passed: Verified MySQL database stores salted, one-way bcrypt hashes only.\n');

  console.log('=============================================================================');
  console.log('🎉 ALL TESTS PASSED! Customer Account Management & Password Security Confirmed.');
  console.log('=============================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
