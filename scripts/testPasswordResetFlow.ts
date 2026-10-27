import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';
import crypto from 'crypto';

try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {
  // ignore
}

import { apiApp } from '../server/apiRouter.ts';
import { connectMySql, getPool } from '../server/db.ts';

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
      get: (headerName: string) => {
        const lower = headerName.toLowerCase();
        return req.headers[lower] || undefined;
      },
      headers: (() => {
        const h: Record<string, string> = {
          'content-type': 'application/json',
          'origin': 'http://localhost:3000',
          'host': 'localhost:3000',
        };
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
      end: () => finish(),
    };

    try {
      apiApp(req, res, () => {
        finish();
      });
    } catch (err: any) {
      responseStatusCode = 500;
      responseBody = { success: false, error: err?.message };
      finish();
    }
  });
}

async function runPasswordResetSuite() {
  console.log('====================================================');
  console.log('  FreshCart Password Reset Flow & Security Test Suite');
  console.log('====================================================\n');

  console.log('[Setup] Connecting to MySQL database...');
  const connected = await connectMySql();
  assert.strictEqual(connected, true, 'Must connect to MySQL database');
  console.log('✔ Connected to MySQL successfully.\n');

  const testTimestamp = Date.now();
  const testEmail = `test_reset_user_${testTimestamp}@freshcart.com`;
  const initialPassword = 'InitialSecretPass2026!';
  const updatedPassword = 'NewFreshCartPass2026!';
  let customerId = '';

  // STEP 1: Create a test customer account
  console.log('▶ [Step 1] Registering test customer account...');
  const regRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Reset Flow Test User',
    email: testEmail,
    mobile: `9${String(testTimestamp).slice(-9)}`,
    password: initialPassword,
    address: '42 Organic Avenue, Suite 100',
  });
  assert.ok(regRes.status === 200 || regRes.status === 201, `Registration must return 200 or 201, got ${regRes.status}`);
  assert.strictEqual(regRes.body?.success, true, 'Registration must succeed');
  customerId = regRes.body?.customer?.id;
  assert.ok(customerId, 'Customer ID must be returned');
  console.log(`  ✔ Customer registered with ID: ${customerId} and email: ${testEmail}\n`);

  // STEP 2: Request Password Reset via POST /api/auth/forgot-password
  console.log('▶ [Step 2] Requesting password reset link via POST /api/auth/forgot-password...');
  const forgotRes = await simulateRequest('POST', '/api/auth/forgot-password', {
    origin: 'http://localhost:3000',
  }, {
    email: testEmail,
  });
  assert.strictEqual(forgotRes.status, 200, 'Forgot password must return 200');
  assert.strictEqual(forgotRes.body?.success, true, 'Forgot password response must be successful');
  assert.ok(forgotRes.body?.message, 'Message must be present');
  console.log(`  Message returned: "${forgotRes.body.message}"`);

  const resetToken = forgotRes.body?.resetToken;
  const resetUrl = forgotRes.body?.resetUrl;
  assert.ok(resetToken, 'Must generate and return raw resetToken');
  assert.strictEqual(resetToken.length, 64, 'Reset token must be a secure 32-byte (64 hex chars) token');
  assert.ok(resetUrl, 'Must return resetUrl');
  assert.ok(resetUrl.includes('#/reset-password?token='), `Reset URL must link to frontend route: ${resetUrl}`);
  console.log(`  ✔ Raw resetToken: ${resetToken.slice(0, 12)}... (64 hex characters)`);
  console.log(`  ✔ Generated resetUrl: ${resetUrl}\n`);

  // STEP 3: Verify Valid Reset Token via GET /api/auth/verify-reset-token
  console.log('▶ [Step 3] Verifying valid reset token via GET /api/auth/verify-reset-token...');
  const verifyValidRes = await simulateRequest('GET', `/api/auth/verify-reset-token?token=${resetToken}`);
  assert.strictEqual(verifyValidRes.status, 200, 'Verify token must return 200');
  assert.strictEqual(verifyValidRes.body?.success, true, 'Verify token response must have success: true');
  assert.strictEqual(verifyValidRes.body?.valid, true, 'Verify token must indicate valid: true');
  console.log(`  ✔ Valid reset token verified successfully. Masked email: ${verifyValidRes.body?.email}\n`);

  // STEP 4: Test Invalid and Missing Tokens
  console.log('▶ [Step 4] Testing invalid and missing reset tokens...');
  const verifyMissingRes = await simulateRequest('GET', '/api/auth/verify-reset-token');
  assert.strictEqual(verifyMissingRes.status, 400, 'Missing token must be rejected with 400');
  assert.strictEqual(verifyMissingRes.body?.valid, false, 'Missing token must return valid: false');

  const verifyFakeRes = await simulateRequest('GET', '/api/auth/verify-reset-token?token=deadbeefcafebabe1234567890');
  assert.strictEqual(verifyFakeRes.status, 400, 'Non-existent token must be rejected with 400');
  assert.strictEqual(verifyFakeRes.body?.valid, false, 'Non-existent token must return valid: false');
  console.log('  ✔ Non-existent and missing tokens correctly rejected with 400.\n');

  // STEP 5: Test Password Constraints (< 6 characters)
  console.log('▶ [Step 5] Testing password validation constraints (password < 6 chars)...');
  const shortPassRes = await simulateRequest('POST', '/api/auth/reset-password', {}, {
    resetToken,
    newPassword: '123',
  });
  assert.strictEqual(shortPassRes.status, 400, 'Short password must return 400');
  assert.strictEqual(shortPassRes.body?.success, false);
  console.log(`  ✔ Short password rejected with error: "${shortPassRes.body?.error}"\n`);

  // STEP 6: Complete Password Reset with Valid Token
  console.log('▶ [Step 6] Submitting valid password reset via POST /api/auth/reset-password...');
  const resetRes = await simulateRequest('POST', '/api/auth/reset-password', {}, {
    resetToken,
    newPassword: updatedPassword,
  });
  assert.strictEqual(resetRes.status, 200, 'Password reset must return 200');
  assert.strictEqual(resetRes.body?.success, true, 'Password reset must succeed');
  console.log(`  ✔ Password reset succeeded: "${resetRes.body?.message}"\n`);

  // STEP 7: Test Single-Use Token Enforcement (Reuse Prevention)
  console.log('▶ [Step 7] Testing single-use token enforcement (attempting reuse)...');
  const reuseVerifyRes = await simulateRequest('GET', `/api/auth/verify-reset-token?token=${resetToken}`);
  assert.strictEqual(reuseVerifyRes.status, 400, 'Reused token verification must return 400');
  assert.strictEqual(reuseVerifyRes.body?.valid, false, 'Reused token must return valid: false');
  assert.ok(reuseVerifyRes.body?.error?.toLowerCase().includes('already been used'), 'Must report token already used');

  const reuseSubmitRes = await simulateRequest('POST', '/api/auth/reset-password', {}, {
    resetToken,
    newPassword: 'AnotherPassword2026!',
  });
  assert.strictEqual(reuseSubmitRes.status, 400, 'Reused token reset must return 400');
  assert.strictEqual(reuseSubmitRes.body?.success, false);
  assert.ok(reuseSubmitRes.body?.error?.toLowerCase().includes('already been used'), 'Must report token already used');
  console.log('  ✔ Token reuse strictly prevented: token marked as used and rejected.\n');

  // STEP 8: Test Login with New Password
  console.log('▶ [Step 8] Testing customer sign-in with the NEW password...');
  const newLoginRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: updatedPassword,
  });
  assert.strictEqual(newLoginRes.status, 200, 'Sign in with new password must return 200');
  assert.strictEqual(newLoginRes.body?.success, true, 'Sign in with new password must succeed');
  assert.ok(newLoginRes.body?.token, 'Sign in must return authenticated JWT token');
  console.log('  ✔ Customer signed in successfully with updated password.\n');

  // STEP 9: Test Login with Old Password (Must Fail)
  console.log('▶ [Step 9] Confirming OLD password is now invalid...');
  const oldLoginRes = await simulateRequest('POST', '/api/auth/login', {}, {
    identifier: testEmail,
    password: initialPassword,
  });
  assert.strictEqual(oldLoginRes.status, 401, 'Old password must be rejected with 401');
  assert.strictEqual(oldLoginRes.body?.success, false);
  console.log('  ✔ Old password rejected with 401 Unauthorized.\n');

  // STEP 10: Database Security Verification
  console.log('▶ [Step 10] Verifying database password hashing and token storage...');
  const pool = getPool();
  const [custRows] = await pool.query<any[]>(
    'SELECT customer_id, password_hash FROM customers WHERE customer_id = ?',
    [customerId]
  );
  assert.strictEqual(custRows.length, 1);
  const dbHash = custRows[0].password_hash;
  assert.ok(dbHash.startsWith('$2a$') || dbHash.startsWith('$2b$'), 'Password must be hashed with salted bcrypt');
  assert.notStrictEqual(dbHash, updatedPassword, 'Plaintext password must NEVER be in database');

  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const [resetRows] = await pool.query<any[]>(
    'SELECT token_hash, used FROM password_resets WHERE token_hash = ?',
    [tokenHash]
  );
  assert.strictEqual(resetRows.length, 1, 'Token hash record must exist in password_resets table');
  assert.strictEqual(Boolean(resetRows[0].used), true, 'Token must be marked as used (used = 1)');
  console.log(`  ✔ Customer password hash in MySQL: ${dbHash.slice(0, 16)}... (salted bcrypt)`);
  console.log(`  ✔ Token record in password_resets: ${tokenHash.slice(0, 16)}... (SHA-256 hashed, used: true)\n`);

  // STEP 11: Verify Existing Admin and Employee Logins Remain Intact
  console.log('▶ [Step 11] Verifying existing Admin and Employee logins remain intact...');
  const adminLoginRes = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: 'owner@freshcart.com',
    email: 'owner@freshcart.com',
    password: 'FreshCartOwner2026!',
  });
  assert.strictEqual(adminLoginRes.status, 200, `Admin login must succeed, got status: ${adminLoginRes.status}`);
  assert.strictEqual(adminLoginRes.body?.success, true);
  assert.ok(
    adminLoginRes.body?.admin?.role === 'admin' || adminLoginRes.body?.admin?.role === 'owner',
    `Role must be admin or owner, got ${adminLoginRes.body?.admin?.role}`
  );
  console.log(`  ✔ Owner/Admin login confirmed working (role: ${adminLoginRes.body?.admin?.role}).`);

  const empLoginRes = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: 'employee@freshcart.com',
    email: 'employee@freshcart.com',
    password: 'FreshCartEmployee2026!',
  });
  assert.strictEqual(empLoginRes.status, 200, `Employee login must succeed, got status: ${empLoginRes.status}`);
  assert.strictEqual(empLoginRes.body?.success, true);
  assert.strictEqual(empLoginRes.body?.admin?.role, 'employee');
  console.log('  ✔ Staff/Employee login confirmed working.\n');

  console.log('====================================================');
  console.log('  🎉 All 11 Password Reset & Security Tests Passed!');
  console.log('====================================================');
  process.exit(0);
}

runPasswordResetSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
