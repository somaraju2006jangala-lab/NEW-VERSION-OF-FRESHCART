import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { RowDataPacket } from 'mysql2';
import { connectMySql, getPool } from '../server/db.ts';
import { apiApp } from '../server/apiRouter.ts';
import { verifyCustomerToken, verifyAdminToken } from '../server/jwtHelper.ts';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Simulates an Express HTTP request against apiApp without needing a live network port.
 */
function simulateRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = path.split('?');
    const query: Record<string, string> = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((v, k) => {
        query[k] = v;
      });
    }

    let responseStatusCode = 200;
    const responseHeaders: Record<string, string> = {};
    let responseBody: any = null;

    const req: any = {
      method,
      url: path,
      path: pathPart,
      query,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body || {},
    };

    const res: any = {
      status(code: number) {
        responseStatusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = value;
        return this;
      },
      json(data: any) {
        responseBody = data;
        resolve({ status: responseStatusCode, body: responseBody });
        return this;
      },
      end(data?: any) {
        if (data && !responseBody) {
          try {
            responseBody = JSON.parse(data);
          } catch {
            responseBody = data;
          }
        }
        resolve({ status: responseStatusCode, body: responseBody });
        return this;
      },
    };

    (apiApp as any)(req, res, () => {
      resolve({ status: 404, body: { error: 'Route not found' } });
    });
  });
}

async function runCompleteCustomerWorkflowVerification() {
  console.log('=============================================================================');
  console.log('FreshCart — Complete New Customer Registration & Login Workflow Verification');
  console.log('=============================================================================\n');

  // Connect to MySQL
  await connectMySql();
  const pool = getPool();

  const timestamp = Date.now();
  const testCustomerName = `Vikram Sharma ${timestamp % 10000}`;
  const testEmail = `vikram.${timestamp}@freshcart.com`;
  const rawMobile10 = `98123${String(timestamp).slice(-5)}`;
  const expectedPhoneE164 = `+91${rawMobile10}`;
  const testPassword = 'StrongPassword2026!';
  const testAddress = 'Villa 42, Palm Meadows, Whitefield, Bengaluru 560066';

  let passedTests = 0;

  // ---------------------------------------------------------------------------
  // STEP 1: Register a new customer using valid details
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 1: Registering new customer with valid details...');
  console.log(`  Name:     ${testCustomerName}`);
  console.log(`  Email:    ${testEmail}`);
  console.log(`  Mobile:   ${rawMobile10}`);
  console.log(`  Address:  ${testAddress}`);

  const regRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: testCustomerName,
    email: testEmail,
    phone: rawMobile10,
    password: testPassword,
    address: testAddress,
  });

  console.log(`  Registration API HTTP status: ${regRes.status}`);
  assert.strictEqual(regRes.status, 201, `Registration must return 201 Created, got ${regRes.status}`);
  assert.strictEqual(regRes.body?.success, true, 'Registration body must indicate success: true');
  assert.strictEqual(regRes.body?.role, 'customer', 'Registration response must contain role: customer');
  assert.strictEqual(regRes.body?.userRole, 'CUSTOMER', 'Registration response must contain userRole: CUSTOMER');
  assert.ok(regRes.body?.token, 'Registration must return a valid auth token');
  assert.ok(regRes.body?.customer?.id, 'Registration must return customer ID');
  assert.strictEqual(regRes.body?.customer?.email, testEmail);
  assert.strictEqual(regRes.body?.customer?.phone, expectedPhoneE164);
  assert.strictEqual(regRes.body?.customer?.role, 'customer');

  const newCustomerId = regRes.body.customer.id;
  const newCustomerToken = regRes.body.token;

  // Verify token contents
  const tokenCheck = verifyCustomerToken(newCustomerToken);
  assert.strictEqual(tokenCheck.valid, true, 'JWT customer token must be cryptographically valid');
  assert.strictEqual(tokenCheck.decoded?.id, newCustomerId, 'Token ID must match registered customer ID');
  console.log(`  ✔ PASS: Step 1 Registration succeeded with ID: ${newCustomerId}\n`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // STEP 2: Confirm that the customer record is saved in MySQL
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 2: Confirming customer record in MySQL database...');
  const [custRows] = await pool.query<RowDataPacket[]>(
    `SELECT customer_id, full_name, email, mobile, address, password_hash, loyalty_tier, status, created_at
     FROM customers
     WHERE customer_id = ? OR email = ?`,
    [newCustomerId, testEmail]
  );

  assert.strictEqual(custRows.length, 1, 'Exactly 1 customer record must exist in MySQL');
  const dbCustomer = custRows[0];
  assert.strictEqual(dbCustomer.customer_id, newCustomerId, 'MySQL customer_id must match registered ID');
  assert.strictEqual(dbCustomer.full_name, testCustomerName, 'MySQL full_name must match');
  assert.strictEqual(dbCustomer.email, testEmail, 'MySQL email must match');
  assert.strictEqual(dbCustomer.mobile, expectedPhoneE164, 'MySQL mobile must be standardized E.164 (+91XXXXXXXXXX)');
  assert.strictEqual(dbCustomer.status, 'Active', 'Customer account status must be Active');
  assert.ok(dbCustomer.created_at, 'MySQL created_at must be populated');

  // Verify password hash is salted bcrypt and NOT plain text
  assert.notStrictEqual(dbCustomer.password_hash, testPassword, 'MySQL password must NEVER be plain text');
  assert.ok(
    dbCustomer.password_hash.startsWith('$2a$') || dbCustomer.password_hash.startsWith('$2b$'),
    'MySQL password must be hashed with bcrypt'
  );
  const passwordValid = await bcrypt.compare(testPassword, dbCustomer.password_hash);
  assert.strictEqual(passwordValid, true, 'bcrypt must successfully verify the registered password against MySQL hash');

  // Verify saved addresses in addresses table
  const [addrRows] = await pool.query<RowDataPacket[]>(
    'SELECT address_id, full_address, city, state, pincode, is_default FROM addresses WHERE customer_id = ?',
    [newCustomerId]
  );
  assert.ok(addrRows.length >= 1, 'At least 1 address record must exist in MySQL addresses table');
  console.log(`  ✔ PASS: Step 2 Confirmed record in MySQL with secure bcrypt hash (${dbCustomer.password_hash.substring(0, 15)}...)\n`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // STEP 3 & 4: Sign in using newly registered credentials (various formats)
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 3 & 4: Testing customer login with newly registered credentials...');

  // 4a. Sign in with exact email
  console.log('  Testing login with email...');
  const loginByEmail = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });
  assert.strictEqual(loginByEmail.status, 200, 'Login by email should return HTTP 200');
  assert.strictEqual(loginByEmail.body?.success, true);
  assert.strictEqual(loginByEmail.body?.role, 'customer', 'Login role must be customer');
  assert.strictEqual(loginByEmail.body?.userRole, 'CUSTOMER', 'Login userRole must be CUSTOMER');
  assert.strictEqual(loginByEmail.body?.customer?.id, newCustomerId);
  assert.ok(loginByEmail.body?.token, 'Login must return an authentication token');
  console.log('  ✔ PASS: Login with registered email succeeded');

  // 4b. Sign in with uppercase email
  console.log('  Testing login with uppercase email...');
  const loginByUpperEmail = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail.toUpperCase(),
    password: testPassword,
  });
  assert.strictEqual(loginByUpperEmail.status, 200, 'Login by uppercase email should return HTTP 200');
  assert.strictEqual(loginByUpperEmail.body?.success, true);
  console.log('  ✔ PASS: Login with uppercase email succeeded');

  // 4c. Sign in with 10-digit mobile number
  console.log('  Testing login with 10-digit mobile number...');
  const loginByPhone10 = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: rawMobile10,
    password: testPassword,
  });
  assert.strictEqual(loginByPhone10.status, 200, 'Login by 10-digit mobile should return HTTP 200');
  assert.strictEqual(loginByPhone10.body?.success, true);
  assert.strictEqual(loginByPhone10.body?.customer?.id, newCustomerId);
  console.log('  ✔ PASS: Login with 10-digit mobile succeeded');

  // 4d. Sign in with +91 mobile number
  console.log('  Testing login with +91 mobile number...');
  const loginByPhoneE164 = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: expectedPhoneE164,
    password: testPassword,
  });
  assert.strictEqual(loginByPhoneE164.status, 200, 'Login by +91 mobile should return HTTP 200');
  assert.strictEqual(loginByPhoneE164.body?.success, true);
  console.log('  ✔ PASS: Login with +91 mobile succeeded');

  // 4e. Sign in with customer ID
  console.log('  Testing login with customer ID...');
  const loginById = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: newCustomerId,
    password: testPassword,
  });
  assert.strictEqual(loginById.status, 200, 'Login by customer ID should return HTTP 200');
  assert.strictEqual(loginById.body?.success, true);
  console.log('  ✔ PASS: Login with customer ID succeeded\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // STEP 5: Confirm that the correct Customer Portal profile is returned
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 5: Confirming Customer Portal profile API (/api/auth/me)...');
  const meRes = await simulateRequest('GET', '/api/auth/me', {
    Authorization: `Bearer ${loginByEmail.body.token}`,
  });
  assert.strictEqual(meRes.status, 200, '/api/auth/me should return HTTP 200');
  assert.strictEqual(meRes.body?.success, true);
  assert.strictEqual(meRes.body?.role, 'customer', '/api/auth/me role must be customer');
  assert.strictEqual(meRes.body?.customer?.id, newCustomerId);
  assert.strictEqual(meRes.body?.customer?.name, testCustomerName);
  assert.strictEqual(meRes.body?.customer?.email, testEmail);
  assert.strictEqual(meRes.body?.customer?.role, 'customer');
  console.log(`  ✔ PASS: Step 5 Customer Portal profile confirmed for ${meRes.body.customer.name}\n`);
  passedTests++;

  // ---------------------------------------------------------------------------
  // STEP 6: Refresh the page / session verification
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 6: Verifying login session persistence on refresh...');
  const sessionToken = loginByEmail.body.token;
  const decoded = verifyCustomerToken(sessionToken);
  assert.strictEqual(decoded.valid, true, 'Session token remains valid on reload');
  assert.strictEqual(decoded.decoded?.id, newCustomerId);

  // Second /api/auth/me request simulating page reload with stored token
  const reloadMeRes = await simulateRequest('GET', '/api/auth/me', {
    Authorization: `Bearer ${sessionToken}`,
  });
  assert.strictEqual(reloadMeRes.status, 200, 'Profile fetch on page reload must succeed');
  assert.strictEqual(reloadMeRes.body?.customer?.id, newCustomerId);
  console.log('  ✔ PASS: Step 6 Login session survives reload with active token\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // STEP 7: Test invalid passwords and duplicate registrations
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 7: Testing security edge cases (invalid passwords & duplicates)...');

  // 7a. Incorrect password
  const wrongPassRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: 'WrongPassword999!',
  });
  assert.strictEqual(wrongPassRes.status, 401, 'Incorrect password must return HTTP 401');
  assert.strictEqual(wrongPassRes.body?.success, false);
  console.log('  ✔ PASS: Incorrect password rejected with HTTP 401');

  // 7b. Non-existent identifier
  const nonExistentRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'nonexistent_user_99999@example.com',
    password: 'SomePassword123!',
  });
  assert.strictEqual(nonExistentRes.status, 401, 'Non-existent identifier must return HTTP 401');
  assert.strictEqual(nonExistentRes.body?.success, false);
  console.log('  ✔ PASS: Non-existent identifier rejected with HTTP 401');

  // 7c. Duplicate email registration
  const dupEmailRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Duplicate User',
    email: testEmail,
    phone: `98999${String(Date.now()).slice(-5)}`,
    password: 'AnotherPassword123!',
  });
  assert.strictEqual(dupEmailRes.status, 409, 'Duplicate email registration must return HTTP 409');
  assert.strictEqual(dupEmailRes.body?.success, false);
  assert.ok(
    dupEmailRes.body?.error?.toLowerCase().includes('already exists') ||
    dupEmailRes.body?.error?.toLowerCase().includes('email'),
    'Duplicate email must return clear error message'
  );
  console.log('  ✔ PASS: Duplicate email registration rejected with HTTP 409');

  // 7d. Duplicate mobile registration
  const dupPhoneRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Duplicate Phone User',
    email: `diff_email_${Date.now()}@freshcart.com`,
    phone: rawMobile10,
    password: 'AnotherPassword123!',
  });
  assert.strictEqual(dupPhoneRes.status, 409, 'Duplicate mobile number registration must return HTTP 409');
  assert.strictEqual(dupPhoneRes.body?.success, false);
  assert.ok(
    dupPhoneRes.body?.error?.toLowerCase().includes('already registered') ||
    dupPhoneRes.body?.error?.toLowerCase().includes('mobile'),
    'Duplicate mobile number must return clear error message'
  );
  console.log('  ✔ PASS: Duplicate mobile registration rejected with HTTP 409\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // STEP 8: Confirm existing customer, employee, and admin login functionality
  // ---------------------------------------------------------------------------
  console.log('▶ STEP 8: Confirming existing accounts (Admin, Employee, Customer) remain unchanged...');

  // 8a. Admin login (owner@freshcart.com)
  const adminLogin = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'owner@freshcart.com',
    password: 'FreshCartOwner2026!',
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login must return HTTP 200');
  assert.strictEqual(adminLogin.body?.role, 'admin', 'Admin role must be admin');
  assert.strictEqual(adminLogin.body?.userRole, 'ADMIN', 'Admin userRole must be ADMIN');
  assert.ok(adminLogin.body?.admin?.adminId, 'Admin payload must be returned');
  const adminTokenVerification = verifyAdminToken(adminLogin.body?.token);
  assert.strictEqual(adminTokenVerification.valid, true, 'Admin JWT token must be valid');
  console.log('  ✔ PASS: Existing Admin login working perfectly');

  // 8b. Employee login (employee@freshcart.com)
  const empLogin = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'employee@freshcart.com',
    password: 'FreshCartEmployee2026!',
  });
  assert.strictEqual(empLogin.status, 200, 'Employee login must return HTTP 200');
  assert.strictEqual(empLogin.body?.role, 'employee', 'Employee role must be employee');
  assert.strictEqual(empLogin.body?.userRole, 'EMPLOYEE', 'Employee userRole must be EMPLOYEE');
  assert.ok(empLogin.body?.employee?.employeeId, 'Employee payload must be returned');
  const empTokenVerification = verifyAdminToken(empLogin.body?.token);
  assert.strictEqual(empTokenVerification.valid, true, 'Employee token must be valid');
  console.log('  ✔ PASS: Existing Employee login working perfectly');

  // 8c. Existing Customer login (rahul@example.com)
  const rahulLogin = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'rahul@example.com',
    password: 'password123',
  });
  assert.strictEqual(rahulLogin.status, 200, 'Existing customer Rahul login must return HTTP 200');
  assert.strictEqual(rahulLogin.body?.role, 'customer', 'Role must be customer');
  assert.strictEqual(rahulLogin.body?.customer?.id, 'rahul123');
  console.log('  ✔ PASS: Existing Customer (Rahul) login working perfectly\n');
  passedTests++;

  console.log('=============================================================================');
  console.log(`🎉 ALL ${passedTests} TEST PHASES PASSED! Full Registration & Login Workflow Verified.`);
  console.log('=============================================================================');
  process.exit(0);
}

runCompleteCustomerWorkflowVerification().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED with error:', err);
  process.exit(1);
});
