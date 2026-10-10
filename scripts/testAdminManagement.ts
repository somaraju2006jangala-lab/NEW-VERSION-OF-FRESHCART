import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';
import http from 'http';

try {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
} catch {
  // ignore
}

import { apiApp } from '../server/apiRouter.ts';
import {
  connectMySql,
  getPool,
  findAdminInDb,
  findAdminByIdInDb,
  getActiveAdminCount,
  deleteAdminFromDb,
} from '../server/db.ts';

/**
 * Simulates an HTTP request against Express apiApp.
 */
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
      status(code: number) {
        responseStatusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        responseHeaders[name.toLowerCase()] = value;
        return this;
      },
      getHeader(name: string) {
        return responseHeaders[name.toLowerCase()];
      },
      json(data: any) {
        responseBody = data;
        finish();
        return this;
      },
      send(data: any) {
        if (responseBody === null) {
          if (typeof data === 'string') {
            try {
              responseBody = JSON.parse(data);
            } catch {
              responseBody = data;
            }
          } else {
            responseBody = data;
          }
        }
        finish();
        return this;
      },
      end(data?: any) {
        if (data !== undefined && responseBody === null) {
          if (typeof data === 'string') {
            try {
              responseBody = JSON.parse(data);
            } catch {
              responseBody = data;
            }
          } else {
            responseBody = data;
          }
        }
        finish();
      },
    };

    (apiApp as any)(req, res, (err: any) => {
      if (err) {
        responseStatusCode = 500;
        responseBody = { error: err.message };
        finish();
      } else {
        finish();
      }
    });
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('TESTING FRESHCART AUTHORIZED ADMIN MANAGEMENT SYSTEM');
  console.log('====================================================');

  await connectMySql();
  console.log('✓ Connected to persistent MySQL/TiDB database.');

  // Clean up any old test admin accounts from prior test runs
  const testEmails = [
    'test_admin_2@freshcart.com',
    'test_admin_3@freshcart.com',
    'test_admin_4@freshcart.com',
    'test_admin_5@freshcart.com',
    'test_admin_6@freshcart.com',
  ];
  for (const em of testEmails) {
    const existing = await findAdminInDb(em);
    if (existing) {
      await deleteAdminFromDb(existing.admin_id);
    }
  }

  // ---------------------------------------------------------------------------
  // STEP 1: Verify Initial Owner Admin Login
  // ---------------------------------------------------------------------------
  console.log('\n[Step 1] Testing Authorized Admin Login with Project Owner...');
  const ownerEmail = process.env.ADMIN_OWNER_EMAIL || 'owner@freshcart.com';
  const ownerPassword = process.env.ADMIN_OWNER_PASSWORD || 'FreshCartOwner2026!';

  const ownerLoginRes = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: ownerEmail,
    password: ownerPassword,
  });

  assert.strictEqual(ownerLoginRes.status, 200, `Owner login must return 200, got ${ownerLoginRes.status}: ${JSON.stringify(ownerLoginRes.body)}`);
  assert.strictEqual(ownerLoginRes.body.success, true, 'Owner login must be successful');
  assert.ok(ownerLoginRes.body.token, 'Owner login must return JWT token');
  assert.strictEqual(ownerLoginRes.body.admin.role, 'owner', 'Owner admin role must be "owner"');
  assert.strictEqual(ownerLoginRes.body.admin.status, 'active', 'Owner admin status must be "active"');
  const ownerToken = ownerLoginRes.body.token;
  console.log(`✓ Project Owner logged in successfully. Received token with role: "${ownerLoginRes.body.admin.role}".`);

  // Verify /api/admin/me returns owner details
  const meRes = await simulateRequest('GET', '/api/admin/me', {
    Authorization: `Bearer ${ownerToken}`,
  });
  assert.strictEqual(meRes.status, 200, '/api/admin/me must return 200 for authenticated owner');
  assert.strictEqual(meRes.body.admin.email, ownerEmail, 'admin profile email must match');
  console.log('✓ Verified owner profile against /api/admin/me.');

  // ---------------------------------------------------------------------------
  // STEP 2: Customer Registration & Rejection from Admin Portal
  // ---------------------------------------------------------------------------
  console.log('\n[Step 2] Testing Customer Registration & Block from Admin Access...');
  const custEmail = `customer_${Date.now()}@example.com`;
  const custPassword = 'CustomerPass123!';

  const custRegRes = await simulateRequest('POST', '/api/auth/register', {}, {
    name: 'Normal Customer',
    email: custEmail,
    phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: custPassword,
  });
  assert.strictEqual(custRegRes.status, 201, 'Customer registration must succeed');
  const customerToken = custRegRes.body.token;
  console.log(`✓ Regular customer registered in customers table: ${custEmail}`);

  // Attempt to log into /api/admin/login with normal customer credentials
  const custAdminLoginRes = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: custEmail,
    password: custPassword,
  });
  assert.strictEqual(
    custAdminLoginRes.status,
    403,
    `Customer account must be denied admin login with HTTP 403, got ${custAdminLoginRes.status}`
  );
  assert.strictEqual(custAdminLoginRes.body.success, false, 'Admin login response success must be false');
  console.log('✓ Normal customer was strictly rejected from /api/admin/login (HTTP 403).');

  // Customer token attempting to access admin APIs
  const custAdminApiRes = await simulateRequest('GET', '/api/admin/users', {
    Authorization: `Bearer ${customerToken}`,
  });
  assert.ok(
    custAdminApiRes.status === 401 || custAdminApiRes.status === 403,
    `Customer token on /api/admin/users must return 401 or 403, got ${custAdminApiRes.status}`
  );
  console.log('✓ Customer JWT token blocked from accessing /api/admin/users.');

  // ---------------------------------------------------------------------------
  // STEP 3: Direct Access without Authentication
  // ---------------------------------------------------------------------------
  console.log('\n[Step 3] Testing Direct Access to Admin APIs without Credentials...');
  const directUsersRes = await simulateRequest('GET', '/api/admin/users', {});
  assert.strictEqual(directUsersRes.status, 401, 'Unauthenticated GET /api/admin/users must return 401');

  const directCreateRes = await simulateRequest('POST', '/api/admin/users', {}, {
    fullName: 'Intruder',
    email: 'intruder@freshcart.com',
    password: 'password123',
  });
  assert.strictEqual(directCreateRes.status, 401, 'Unauthenticated POST /api/admin/users must return 401');

  const directOverviewRes = await simulateRequest('GET', '/api/admin/overview', {});
  assert.strictEqual(directOverviewRes.status, 401, 'Unauthenticated GET /api/admin/overview must return 401');
  console.log('✓ Direct API access without credentials is fully blocked (HTTP 401).');

  // ---------------------------------------------------------------------------
  // STEP 4: Project Owner Adds an Authorized Admin
  // ---------------------------------------------------------------------------
  console.log('\n[Step 4] Testing Project Owner Adding Authorized Admin (Admin 2)...');
  const addAdmin2Res = await simulateRequest('POST', '/api/admin/users', {
    Authorization: `Bearer ${ownerToken}`,
  }, {
    fullName: 'Jane Operations',
    email: 'test_admin_2@freshcart.com',
    password: 'AdminPassword2026!',
    adminId: 'adm_jane_ops',
  });

  assert.strictEqual(addAdmin2Res.status, 201, `Owner adding admin must return 201, got ${addAdmin2Res.status}: ${JSON.stringify(addAdmin2Res.body)}`);
  assert.strictEqual(addAdmin2Res.body.success, true);
  assert.strictEqual(addAdmin2Res.body.admin.role, 'admin', 'New admin must receive "admin" role');
  assert.strictEqual(addAdmin2Res.body.admin.adminId, 'adm_jane_ops');
  console.log('✓ Owner added Admin 2 ("Jane Operations", ID: adm_jane_ops, Role: admin).');

  // Admin 2 logs in
  const admin2LoginRes = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: 'adm_jane_ops',
    password: 'AdminPassword2026!',
  });
  assert.strictEqual(admin2LoginRes.status, 200, 'Admin 2 login must return 200');
  assert.strictEqual(admin2LoginRes.body.admin.role, 'admin');
  const admin2Token = admin2LoginRes.body.token;
  console.log('✓ Admin 2 logged in successfully with unique user ID and assigned credentials.');

  // ---------------------------------------------------------------------------
  // STEP 5: Enforce Non-Owner Privilege Restrictions (No Self-Promotion)
  // ---------------------------------------------------------------------------
  console.log('\n[Step 5] Testing Non-Owner Privilege Restrictions (Admin cannot manage admins)...');
  // Admin 2 tries to add another admin
  const admin2AddRes = await simulateRequest('POST', '/api/admin/users', {
    Authorization: `Bearer ${admin2Token}`,
  }, {
    fullName: 'Rogue Admin',
    email: 'rogue@freshcart.com',
    password: 'password123',
  });
  assert.strictEqual(admin2AddRes.status, 403, 'Normal admin adding an admin must be blocked with HTTP 403');
  console.log('✓ Normal admin blocked from adding new administrators (HTTP 403).');

  // Admin 2 tries to deactivate an admin
  const admin2DeactivateRes = await simulateRequest('PATCH', '/api/admin/users/owner_primary/status', {
    Authorization: `Bearer ${admin2Token}`,
  }, { status: 'inactive' });
  assert.strictEqual(admin2DeactivateRes.status, 403, 'Normal admin modifying status must be blocked with HTTP 403');
  console.log('✓ Normal admin blocked from modifying administrator status (HTTP 403).');

  // Admin 2 tries to delete an admin
  const admin2DeleteRes = await simulateRequest('DELETE', '/api/admin/users/owner_primary', {
    Authorization: `Bearer ${admin2Token}`,
  });
  assert.strictEqual(admin2DeleteRes.status, 403, 'Normal admin deleting an admin must be blocked with HTTP 403');
  console.log('✓ Normal admin blocked from deleting administrators (HTTP 403).');

  // ---------------------------------------------------------------------------
  // STEP 6: Testing Five-Admin Quota Limit
  // ---------------------------------------------------------------------------
  console.log('\n[Step 6] Testing Five Active Admin Quota Limit...');
  // Currently we have Owner (1) and Admin 2 (2) = 2 active admins.
  // Add Admin 3, 4, 5 to reach exactly 5 active admins.
  const adminData = [
    { name: 'Admin Three', email: 'test_admin_3@freshcart.com', id: 'adm_three' },
    { name: 'Admin Four', email: 'test_admin_4@freshcart.com', id: 'adm_four' },
    { name: 'Admin Five', email: 'test_admin_5@freshcart.com', id: 'adm_five' },
  ];

  for (const a of adminData) {
    const res = await simulateRequest('POST', '/api/admin/users', {
      Authorization: `Bearer ${ownerToken}`,
    }, {
      fullName: a.name,
      email: a.email,
      password: 'AdminPassword2026!',
      adminId: a.id,
    });
    assert.strictEqual(res.status, 201, `Failed adding ${a.name}`);
  }

  const currentActive = await getActiveAdminCount();
  assert.strictEqual(currentActive, 5, `Expected 5 active admins, found ${currentActive}`);
  console.log(`✓ Reached active admin limit: ${currentActive} of 5 active admin accounts.`);

  // Attempt to add a 6th active admin -> MUST BE REJECTED
  const addAdmin6Res = await simulateRequest('POST', '/api/admin/users', {
    Authorization: `Bearer ${ownerToken}`,
  }, {
    fullName: 'Admin Six (Excess)',
    email: 'test_admin_6@freshcart.com',
    password: 'AdminPassword2026!',
  });
  assert.strictEqual(addAdmin6Res.status, 400, 'Adding 6th active admin must return 400');
  assert.ok(
    addAdmin6Res.body.error && addAdmin6Res.body.error.includes('Active admin limit reached'),
    `Expected limit error message, got: ${addAdmin6Res.body.error}`
  );
  console.log('✓ Adding 6th active admin strictly rejected with HTTP 400 (Active admin limit reached).');

  // ---------------------------------------------------------------------------
  // STEP 7: Deactivation & Active Slot Recycling
  // ---------------------------------------------------------------------------
  console.log('\n[Step 7] Testing Deactivation, Reactivation & Slot Recycling...');
  // Deactivate Admin 3
  const deactRes = await simulateRequest('PATCH', '/api/admin/users/adm_three/status', {
    Authorization: `Bearer ${ownerToken}`,
  }, { status: 'inactive' });
  assert.strictEqual(deactRes.status, 200, 'Deactivating admin must return 200');

  const countAfterDeact = await getActiveAdminCount();
  assert.strictEqual(countAfterDeact, 4, `Active count must decrease to 4, got ${countAfterDeact}`);
  console.log(`✓ Admin 3 deactivated. Active admin count reduced to ${countAfterDeact} / 5.`);

  // Now adding Admin 6 should succeed because a slot was opened
  const addAdmin6AllowedRes = await simulateRequest('POST', '/api/admin/users', {
    Authorization: `Bearer ${ownerToken}`,
  }, {
    fullName: 'Admin Six',
    email: 'test_admin_6@freshcart.com',
    password: 'AdminPassword2026!',
    adminId: 'adm_six',
  });
  assert.strictEqual(addAdmin6AllowedRes.status, 201, 'Adding admin after deactivation must succeed');
  console.log('✓ Added Admin 6 into freed active slot. Active admin count back to 5 / 5.');

  // Now reactivating Admin 3 should be rejected because active count is 5 again
  const reactivateDeniedRes = await simulateRequest('PATCH', '/api/admin/users/adm_three/status', {
    Authorization: `Bearer ${ownerToken}`,
  }, { status: 'active' });
  assert.strictEqual(reactivateDeniedRes.status, 400, 'Reactivating admin beyond 5 limit must return 400');
  console.log('✓ Reactivating inactive admin blocked when limit is full (HTTP 400).');

  // ---------------------------------------------------------------------------
  // STEP 8: Immediate Token & Session Revocation
  // ---------------------------------------------------------------------------
  console.log('\n[Step 8] Testing Immediate Token & Session Revocation...');
  // Log in as Admin 6 to acquire a valid token
  const admin6Login = await simulateRequest('POST', '/api/admin/login', {}, {
    identifier: 'adm_six',
    password: 'AdminPassword2026!',
  });
  assert.strictEqual(admin6Login.status, 200);
  const admin6Token = admin6Login.body.token;

  // Verify Admin 6 can access /api/admin/me
  const preRevocationMe = await simulateRequest('GET', '/api/admin/me', {
    Authorization: `Bearer ${admin6Token}`,
  });
  assert.strictEqual(preRevocationMe.status, 200, 'Admin 6 must be authenticated before deactivation');

  // Owner deactivates Admin 6
  await simulateRequest('PATCH', '/api/admin/users/adm_six/status', {
    Authorization: `Bearer ${ownerToken}`,
  }, { status: 'inactive' });

  // Admin 6 attempts to use the SAME token -> MUST BE REJECTED
  const postRevocationMe = await simulateRequest('GET', '/api/admin/me', {
    Authorization: `Bearer ${admin6Token}`,
  });
  assert.ok(
    postRevocationMe.status === 401 || postRevocationMe.status === 403,
    `Revoked token must return 401/403, got ${postRevocationMe.status}`
  );
  console.log('✓ Token instantly revoked upon deactivation. Subsequent request rejected.');

  // ---------------------------------------------------------------------------
  // STEP 9: Removal of Administrator
  // ---------------------------------------------------------------------------
  console.log('\n[Step 9] Testing Administrator Removal & Access Revocation...');
  // Delete Admin 6
  const deleteRes = await simulateRequest('DELETE', '/api/admin/users/adm_six', {
    Authorization: `Bearer ${ownerToken}`,
  });
  assert.strictEqual(deleteRes.status, 200, 'Deleting admin must return 200');

  const verifyDeleted = await findAdminByIdInDb('adm_six');
  assert.strictEqual(verifyDeleted, null, 'Deleted admin must no longer exist in database');

  // Attempt using deleted admin token
  const postDeleteMe = await simulateRequest('GET', '/api/admin/me', {
    Authorization: `Bearer ${admin6Token}`,
  });
  assert.strictEqual(postDeleteMe.status, 401, 'Request with deleted admin token must return 401');
  console.log('✓ Admin 6 permanently removed from MySQL. Token rejected with HTTP 401.');

  // Attempt to delete the project owner -> MUST BE REJECTED
  const ownerAdminId = ownerLoginRes.body.admin.adminId;
  const deleteOwnerRes = await simulateRequest('DELETE', `/api/admin/users/${ownerAdminId}`, {
    Authorization: `Bearer ${ownerToken}`,
  });
  assert.strictEqual(deleteOwnerRes.status, 400, 'Deleting project owner must be blocked with HTTP 400');
  console.log('✓ Project owner account is strictly protected from removal.');

  // ---------------------------------------------------------------------------
  // CLEANUP TEST DATA
  // ---------------------------------------------------------------------------
  console.log('\n[Cleanup] Cleaning up temporary test admin accounts...');
  for (const id of ['adm_jane_ops', 'adm_three', 'adm_four', 'adm_five', 'adm_six']) {
    try {
      await deleteAdminFromDb(id);
    } catch {}
  }
  console.log('✓ Temporary test admins cleaned up.');

  console.log('\n====================================================');
  console.log('ALL AUTHORIZED ADMIN MANAGEMENT TESTS PASSED (10/10)');
  console.log('====================================================');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test failure:', err);
    process.exit(1);
  });
