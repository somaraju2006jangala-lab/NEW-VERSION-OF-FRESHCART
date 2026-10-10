import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { apiApp } from '../server/apiRouter.ts';
import { connectMySql, findCustomerInDb, getPool } from '../server/db.ts';

// Helper to simulate HTTP requests against Express apiApp
async function simulateRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  pathStr: string,
  headers: Record<string, string> = {},
  body: any = null
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const [pathPart, queryPart] = pathStr.split('?');
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
      url: pathStr,
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

    (apiApp as any)(req, res);
  });
}

// Client Device Simulator
class SimulatedDevice {
  public name: string;
  public sessionStorage: Record<string, string> = {};

  constructor(name: string) {
    this.name = name;
  }

  clearStorage() {
    this.sessionStorage = {};
  }

  setSession(key: string, value: any) {
    this.sessionStorage[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  getSession(key: string): any {
    const raw = this.sessionStorage[key];
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('   CROSS-DEVICE REGISTRATION & LOGIN VERIFICATION SUITE');
  console.log('================================================================');

  const connected = await connectMySql();
  assert.strictEqual(connected, true, 'Database must be successfully connected.');
  console.log('✓ Step 0: Connected to persistent production MySQL/TiDB database.');

  // Create two completely isolated simulated client devices
  const deviceA = new SimulatedDevice('Device A (e.g. Laptop Browser)');
  const deviceB = new SimulatedDevice('Device B (e.g. Mobile Browser)');

  const timestamp = Date.now();
  const testEmail = `cross_device_${timestamp}@freshcart-test.com`;
  const raw10DigitPhone = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
  const testPassword = `FreshCartSecurePass!${timestamp.toString().slice(-4)}`;
  const testFullName = 'Pooja Hegde';
  const testAddress = 'Flat 502, Palm Grove Heights, Indiranagar, Bengaluru';

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Register on Device A
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Register New Customer on Device A ---');
  const regRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: testFullName,
    email: testEmail,
    phone: raw10DigitPhone,
    password: testPassword,
    address: testAddress,
  });

  assert.strictEqual(regRes.status, 201, `Registration should return HTTP 201. Body: ${JSON.stringify(regRes.body)}`);
  assert.strictEqual(regRes.body.success, true);
  assert.ok(regRes.body.customer, 'Should return customer object');
  assert.ok(regRes.body.customer.id, 'Customer must have unique ID');
  assert.strictEqual(regRes.body.customer.email, testEmail);
  assert.strictEqual(regRes.body.customer.phone, `+91${raw10DigitPhone}`);
  assert.ok(regRes.body.token, 'Should return valid JWT session token');
  assert.strictEqual(regRes.body.customer.passwordHash, undefined, 'Must NEVER expose password hash');
  assert.strictEqual(regRes.body.customer.passwordSalt, undefined, 'Must NEVER expose password salt');

  const customerId = regRes.body.customer.id;

  // Store active session on Device A
  deviceA.setSession('freshcart_active_customer_session', regRes.body.customer);
  console.log(`✓ Device A registered customer: ${customerId} (${testEmail})`);
  console.log(`✓ Stored session on Device A. Token length: ${regRes.body.token.length}`);

  // Confirm persistent database insert succeeded in MySQL/TiDB
  const inDb = await findCustomerInDb(testEmail);
  assert.ok(inDb, 'Customer must exist in persistent database');
  assert.strictEqual(inDb.id, customerId);
  assert.strictEqual(inDb.phone, `+91${raw10DigitPhone}`);
  assert.ok(inDb.passwordHash.startsWith('$2a$') || inDb.passwordHash.startsWith('$2b$'), 'Password must be bcrypt hashed');
  console.log('✓ Confirmed customer record exists in persistent MySQL/TiDB database with bcrypt hash.');

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Log in on Device B using Same Credentials
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Log in on Device B using Email ---');
  assert.strictEqual(deviceB.getSession('freshcart_active_customer_session'), null, 'Device B must have independent empty storage');

  const loginResB = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });

  assert.strictEqual(loginResB.status, 200, `Login on Device B should return 200 OK. Body: ${JSON.stringify(loginResB.body)}`);
  assert.strictEqual(loginResB.body.success, true);
  assert.strictEqual(loginResB.body.customer.id, customerId, 'Device B must authenticate as the exact same customer');
  assert.strictEqual(loginResB.body.customer.email, testEmail);
  assert.strictEqual(loginResB.body.customer.name, testFullName);
  assert.ok(loginResB.body.token, 'Device B must receive valid authentication token');
  deviceB.setSession('freshcart_active_customer_session', loginResB.body.customer);
  console.log('✓ Device B logged in successfully with email across different devices.');

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Log in using Phone Number variants & Customer User ID
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Log in with Alternative Identifiers (Phone variants & ID) ---');

  // 3a: 10-digit phone
  const loginPhone10 = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: raw10DigitPhone,
    password: testPassword,
  });
  assert.strictEqual(loginPhone10.status, 200, 'Login using 10-digit mobile number must succeed');
  assert.strictEqual(loginPhone10.body.customer.id, customerId);
  console.log(`✓ Logged in using 10-digit mobile number (${raw10DigitPhone}).`);

  // 3b: +91 formatted phone
  const loginPhoneE164 = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: `+91${raw10DigitPhone}`,
    password: testPassword,
  });
  assert.strictEqual(loginPhoneE164.status, 200, 'Login using +91 mobile number must succeed');
  assert.strictEqual(loginPhoneE164.body.customer.id, customerId);
  console.log(`✓ Logged in using +91 mobile number (+91${raw10DigitPhone}).`);

  // 3c: Phone with spaces
  const loginPhoneSpaced = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: `+91 ${raw10DigitPhone.slice(0, 5)} ${raw10DigitPhone.slice(5)}`,
    password: testPassword,
  });
  assert.strictEqual(loginPhoneSpaced.status, 200, 'Login using space-formatted mobile number must succeed');
  assert.strictEqual(loginPhoneSpaced.body.customer.id, customerId);
  console.log(`✓ Logged in using space-formatted mobile (+91 ${raw10DigitPhone.slice(0, 5)} ${raw10DigitPhone.slice(5)}).`);

  // 3d: Customer ID / User ID
  const loginByCustId = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: customerId,
    password: testPassword,
  });
  assert.strictEqual(loginByCustId.status, 200, 'Login using Customer ID must succeed');
  assert.strictEqual(loginByCustId.body.customer.id, customerId);
  console.log(`✓ Logged in using Customer ID (${customerId}).`);

  // 3e: Case-insensitive email
  const loginUpperEmail = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail.toUpperCase(),
    password: testPassword,
  });
  assert.strictEqual(loginUpperEmail.status, 200, 'Login using uppercase email must succeed');
  assert.strictEqual(loginUpperEmail.body.customer.id, customerId);
  console.log('✓ Logged in using uppercase email (case-insensitivity verified).');

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Logout and Re-login on Both Devices
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Logout and Re-login on Both Devices ---');
  deviceA.clearStorage();
  deviceB.clearStorage();
  assert.strictEqual(deviceA.getSession('freshcart_active_customer_session'), null);
  assert.strictEqual(deviceB.getSession('freshcart_active_customer_session'), null);
  console.log('✓ Sessions cleared on both Device A and Device B (logged out).');

  // Re-login Device A
  const reloginA = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: testPassword,
  });
  assert.strictEqual(reloginA.status, 200);
  deviceA.setSession('freshcart_active_customer_session', reloginA.body.customer);
  console.log('✓ Re-login on Device A succeeded.');

  // Re-login Device B
  const reloginB = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: raw10DigitPhone,
    password: testPassword,
  });
  assert.strictEqual(reloginB.status, 200);
  deviceB.setSession('freshcart_active_customer_session', reloginB.body.customer);
  console.log('✓ Re-login on Device B succeeded.');

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Verify Incorrect Passwords are Rejected
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Verify Incorrect Passwords are Rejected ---');
  const badPassRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: 'CompletelyWrongPassword!123',
  });
  assert.strictEqual(badPassRes.status, 401, 'Should reject invalid password with HTTP 401');
  assert.strictEqual(badPassRes.body.success, false);
  assert.ok(badPassRes.body.error.includes('Incorrect password'), 'Should return clear incorrect password message');
  console.log('✓ Incorrect password correctly rejected with HTTP 401 and descriptive error.');

  // ---------------------------------------------------------------------------
  // SCENARIO 6: Non-Existent User Rejection
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Non-Existent User Rejection ---');
  const noUserRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: `nonexistent_${Date.now()}@example.com`,
    password: 'password123',
  });
  assert.strictEqual(noUserRes.status, 404, 'Should reject non-existent user with HTTP 404');
  assert.strictEqual(noUserRes.body.success, false);
  console.log('✓ Non-existent account correctly returns HTTP 404.');

  // ---------------------------------------------------------------------------
  // SCENARIO 7: Duplicate Email & Mobile Number Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 7: Duplicate Registration Prevention ---');
  const dupEmailRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Duplicate Email Tester',
    email: testEmail, // duplicate
    phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    password: 'AnotherPassword123!',
    address: 'Another address',
  });
  assert.strictEqual(dupEmailRes.status, 409, 'Duplicate email should return HTTP 409 Conflict');
  assert.ok(dupEmailRes.body.error.toLowerCase().includes('email already exists'));
  console.log('✓ Duplicate email registration rejected with HTTP 409 Conflict.');

  const dupPhoneRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Duplicate Phone Tester',
    email: `unique_${Date.now()}@example.com`,
    phone: raw10DigitPhone, // duplicate
    password: 'AnotherPassword123!',
    address: 'Another address',
  });
  assert.strictEqual(dupPhoneRes.status, 409, 'Duplicate phone should return HTTP 409 Conflict');
  assert.ok(dupPhoneRes.body.error.toLowerCase().includes('already registered'));
  console.log('✓ Duplicate mobile registration rejected with HTTP 409 Conflict.');

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Existing Customer Accounts Continue Working
  // ---------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Existing Customer Accounts Continue Working ---');

  // Test Demo Customer (customer@freshcart.com with FreshCart2026! and password123)
  const demoLogin1 = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'customer@freshcart.com',
    password: 'FreshCart2026!',
  });
  assert.strictEqual(demoLogin1.status, 200, 'Demo customer login with FreshCart2026! must succeed');
  assert.strictEqual(demoLogin1.body.customer.email, 'customer@freshcart.com');
  console.log('✓ Demo customer (customer@freshcart.com) logged in with FreshCart2026!.');

  const demoLogin2 = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'customer@freshcart.com',
    password: 'password123',
  });
  assert.strictEqual(demoLogin2.status, 200, 'Demo customer login with password123 must succeed');
  console.log('✓ Demo customer (customer@freshcart.com) logged in with password123.');

  // Test Rahul Customer (rahul@example.com / rahul123 / 9876543210)
  const rahulLoginEmail = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'rahul@example.com',
    password: 'password123',
  });
  assert.strictEqual(rahulLoginEmail.status, 200, 'Rahul login with email must succeed');
  assert.strictEqual(rahulLoginEmail.body.customer.id, 'rahul123');
  console.log('✓ Rahul logged in using email (rahul@example.com).');

  const rahulLoginPhone = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: '9876543210',
    password: 'password123',
  });
  assert.strictEqual(rahulLoginPhone.status, 200, 'Rahul login with 10-digit mobile must succeed');
  assert.strictEqual(rahulLoginPhone.body.customer.id, 'rahul123');
  console.log('✓ Rahul logged in using 10-digit mobile (9876543210).');

  // Test Priya Customer (priya@example.com / priya123 / 9123456789)
  const priyaLogin = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: 'priya@example.com',
    password: 'password123',
  });
  assert.strictEqual(priyaLogin.status, 200, 'Priya login must succeed');
  assert.strictEqual(priyaLogin.body.customer.id, 'priya123');
  console.log('✓ Priya logged in using email (priya@example.com).');

  console.log('\n================================================================');
  console.log('   ALL CROSS-DEVICE SCENARIOS PASSED WITH 100% SUCCESS!');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});
