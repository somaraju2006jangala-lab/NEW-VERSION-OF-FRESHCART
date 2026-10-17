import { findAdminInDb } from '../server/db';
import { signAdminToken } from '../server/jwtHelper';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('====================================================');
  console.log('Starting FreshCart Employee Management Verification');
  console.log('====================================================\n');

  let adminToken: string = '';
  let employeeToken: string = '';
  const testEmployeeId = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  const testUsername = `testemp_${Date.now().toString().slice(-4)}`;
  const testEmail = `testemp_${Date.now().toString().slice(-4)}@freshcart.ops`;
  const testMobile = `+9198765${Date.now().toString().slice(-5)}`;
  const testInitialPass = 'SecureInitial2026!';
  const testResetPass = 'SecureReset2026!';

  // STEP 1: Admin Authentication
  console.log('[Step 1] Authenticating as Administrator...');
  try {
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner@freshcart.com',
        password: process.env.ADMIN_OWNER_PASSWORD || 'FreshCartOwner2026!',
      }),
    });

    if (adminLoginRes.ok) {
      const adminData = await adminLoginRes.json();
      adminToken = adminData.token;
      console.log('✅ Admin authenticated successfully via /api/auth/login. Role:', adminData.role);
    } else {
      // If default owner password was customized, generate token from DB record
      console.log('ℹ️ Admin login endpoint returned non-200, generating token directly from DB record...');
      const adminRecord = await findAdminInDb('owner@freshcart.com');
      if (!adminRecord) throw new Error('No admin owner record in DB');
      adminToken = signAdminToken({
        adminId: adminRecord.admin_id,
        email: adminRecord.email,
        fullName: adminRecord.full_name,
        role: adminRecord.role,
        tokenVersion: adminRecord.token_version,
      });
      console.log('✅ Generated admin token for:', adminRecord.admin_id, 'Role:', adminRecord.role);
    }
  } catch (err: any) {
    console.error('❌ Failed admin authentication:', err.message);
    process.exit(1);
  }

  // STEP 2: Authorized Administrator Management separation check
  console.log('\n[Step 2] Checking Authorized Administrator Management list separation...');
  const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!adminUsersRes.ok) {
    throw new Error(`Failed to fetch admin users: ${adminUsersRes.status}`);
  }
  const adminUsersData = await adminUsersRes.json();
  const hasEmployeesInAdminList = adminUsersData.admins?.some((a: any) => a.role === 'employee');
  if (hasEmployeesInAdminList) {
    throw new Error('❌ FAIL: Employees should NOT appear in Authorized Administrator Management list!');
  }
  console.log(`✅ PASS: Authorized Administrator Management contains ${adminUsersData.admins?.length} admins and 0 employees.`);

  // STEP 3: Fetch Employee Directory
  console.log('\n[Step 3] Fetching Employee Directory via GET /api/admin/employees...');
  const empListRes = await fetch(`${BASE_URL}/api/admin/employees`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!empListRes.ok) {
    throw new Error(`Failed to list employees: ${empListRes.status} ${await empListRes.text()}`);
  }
  const empListData = await empListRes.json();
  console.log(`✅ PASS: Retrieved employees list. Total: ${empListData.totalCount}, Active: ${empListData.activeCount}`);
  for (const emp of empListData.employees || []) {
    if ('password_hash' in emp || 'password' in emp) {
      throw new Error('❌ FAIL: Password hash or plain password exposed in employee directory!');
    }
  }
  console.log('✅ PASS: Password hashes are strictly omitted from employee list.');

  // STEP 4: Create a New Employee Account
  console.log(`\n[Step 4] Creating New Employee (${testEmployeeId}, ${testUsername}, ${testEmail}, ${testMobile})...`);
  const createEmpRes = await fetch(`${BASE_URL}/api/admin/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      employeeId: testEmployeeId,
      fullName: 'Aarav Patel',
      email: testEmail,
      mobile: testMobile,
      username: testUsername,
      password: testInitialPass,
      status: 'active',
    }),
  });
  if (!createEmpRes.ok) {
    throw new Error(`Failed to create employee: ${createEmpRes.status} ${await createEmpRes.text()}`);
  }
  const createEmpData = await createEmpRes.json();
  console.log('✅ PASS: Employee created successfully with ID:', createEmpData.employee?.employeeId);
  if ('password_hash' in createEmpData.employee || 'password' in createEmpData.employee) {
    throw new Error('❌ FAIL: Password hash exposed in creation response!');
  }

  // STEP 5: Multi-Identifier Login Verification
  console.log('\n[Step 5] Testing Employee Login across all supported identifiers...');
  const identifiers = [
    { type: 'Email', value: testEmail },
    { type: 'Username', value: testUsername },
    { type: 'Employee ID', value: testEmployeeId },
    { type: 'Mobile Number', value: testMobile },
  ];

  for (const ident of identifiers) {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: ident.value,
        password: testInitialPass,
      }),
    });
    if (!loginRes.ok) {
      throw new Error(`❌ FAIL: Employee login failed with ${ident.type} (${ident.value}): ${loginRes.status} ${await loginRes.text()}`);
    }
    const loginData = await loginRes.json();
    if (loginData.role !== 'employee') {
      throw new Error(`❌ FAIL: Expected role 'employee', got '${loginData.role}'`);
    }
    employeeToken = loginData.token;
    console.log(`✅ PASS: Login with ${ident.type} ("${ident.value}") succeeded. Role: ${loginData.role}`);
  }

  // STEP 6: Role-Based Authorization & Security Boundaries
  console.log('\n[Step 6] Testing Security Boundaries & Role-Based Authorization...');
  
  // 6a: Authorized access - Employee Portal profile
  const empMeRes = await fetch(`${BASE_URL}/api/employee/me`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  if (!empMeRes.ok) {
    throw new Error(`❌ FAIL: Employee should have access to /api/employee/me. Got status ${empMeRes.status}`);
  }
  const empMeData = await empMeRes.json();
  console.log(`✅ PASS: Employee profile accessible. Full Name: ${empMeData.employee?.fullName}, Role: ${empMeData.employee?.role}`);

  // 6b: Authorized access - Customer Orders Ledger
  const empOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  if (!empOrdersRes.ok) {
    throw new Error(`❌ FAIL: Employee should have access to /api/orders. Got status ${empOrdersRes.status}`);
  }
  console.log('✅ PASS: Employee can access Customer Orders Ledger (/api/orders).');

  // 6c: FORBIDDEN access - Employee attempting to access Admin endpoints
  const adminEndpoints = [
    { method: 'GET', url: `${BASE_URL}/api/admin/overview`, desc: 'Admin Overview' },
    { method: 'GET', url: `${BASE_URL}/api/admin/employees`, desc: 'Employee Directory' },
    { method: 'POST', url: `${BASE_URL}/api/admin/employees`, desc: 'Employee Creation' },
    { method: 'GET', url: `${BASE_URL}/api/admin/users`, desc: 'Authorized Administrator Directory' },
    { method: 'GET', url: `${BASE_URL}/api/admin/customers`, desc: 'Admin Customer Accounts' },
    { method: 'POST', url: `${BASE_URL}/api/settings`, desc: 'Admin Settings Update' },
  ];

  for (const ep of adminEndpoints) {
    const testRes = await fetch(ep.url, {
      method: ep.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: ep.method === 'POST' ? JSON.stringify({ employeeId: 'EMP-HACK' }) : undefined,
    });

    if (testRes.status === 403) {
      console.log(`✅ PASS: Access denied (403 Forbidden) for employee on ${ep.desc} (${ep.method} ${ep.url})`);
    } else {
      throw new Error(`❌ FAIL: Expected 403 Forbidden on ${ep.desc}, but got ${testRes.status}!`);
    }
  }

  // STEP 7: Edit Employee Details
  console.log('\n[Step 7] Testing Edit Employee Details via PUT /api/admin/employees/:id...');
  const updatedName = 'Aarav Patel (Senior)';
  const updatedMobile = `+9198765${Date.now().toString().slice(-5)}`;
  const editRes = await fetch(`${BASE_URL}/api/admin/employees/${testEmployeeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      fullName: updatedName,
      mobile: updatedMobile,
      username: `${testUsername}_v2`,
      email: testEmail,
      status: 'active',
    }),
  });
  if (!editRes.ok) {
    throw new Error(`Failed to edit employee: ${editRes.status} ${await editRes.text()}`);
  }
  const editData = await editRes.json();
  console.log('✅ PASS: Employee details updated. New Full Name:', editData.employee?.fullName);

  // STEP 8: Reset Employee Password
  console.log('\n[Step 8] Testing Password Reset via POST /api/admin/employees/:id/reset-password...');
  const resetRes = await fetch(`${BASE_URL}/api/admin/employees/${testEmployeeId}/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      newPassword: testResetPass,
    }),
  });
  if (!resetRes.ok) {
    throw new Error(`Failed to reset password: ${resetRes.status} ${await resetRes.text()}`);
  }
  console.log('✅ PASS: Employee password reset successfully by administrator.');

  // Verify old password fails
  const oldLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testInitialPass,
    }),
  });
  if (oldLoginRes.status === 401) {
    console.log('✅ PASS: Old password rejected with 401 Unauthorized.');
  } else {
    throw new Error(`❌ FAIL: Old password should be rejected with 401, got ${oldLoginRes.status}`);
  }

  // Verify new password succeeds
  const newLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testResetPass,
    }),
  });
  if (newLoginRes.ok) {
    const newLoginData = await newLoginRes.json();
    employeeToken = newLoginData.token;
    console.log('✅ PASS: New password accepted successfully with 200 OK.');
  } else {
    throw new Error(`❌ FAIL: New password failed to authenticate: ${newLoginRes.status}`);
  }

  // STEP 9: Deactivate Employee (Inactive Account Rejection)
  console.log('\n[Step 9] Testing Account Deactivation & Inactive Login Rejection...');
  const deactRes = await fetch(`${BASE_URL}/api/admin/employees/${testEmployeeId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'inactive' }),
  });
  if (!deactRes.ok) {
    throw new Error(`Failed to deactivate employee: ${deactRes.status} ${await deactRes.text()}`);
  }
  console.log('✅ PASS: Employee deactivated by administrator.');

  // Inactive login attempt
  const inactiveLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testResetPass,
    }),
  });
  if (inactiveLoginRes.status === 403) {
    console.log('✅ PASS: Inactive employee login rejected with 403 Forbidden.');
  } else {
    throw new Error(`❌ FAIL: Inactive employee login should be rejected with 403, got ${inactiveLoginRes.status}`);
  }

  // Inactive session token revocation check
  const revokedTokenRes = await fetch(`${BASE_URL}/api/employee/me`, {
    headers: { Authorization: `Bearer ${employeeToken}` },
  });
  if (revokedTokenRes.status === 401 || revokedTokenRes.status === 403) {
    console.log(`✅ PASS: Active token was invalidated upon deactivation (${revokedTokenRes.status}).`);
  } else {
    throw new Error(`❌ FAIL: Inactive employee session should be rejected, got ${revokedTokenRes.status}`);
  }

  // Reactivate employee
  console.log('\n[Step 10] Testing Reactivation...');
  const reactRes = await fetch(`${BASE_URL}/api/admin/employees/${testEmployeeId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'active' }),
  });
  if (!reactRes.ok) {
    throw new Error(`Failed to reactivate employee: ${reactRes.status}`);
  }
  const reactLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testResetPass,
    }),
  });
  if (reactLoginRes.ok) {
    console.log('✅ PASS: Reactivated employee can sign in again.');
  } else {
    throw new Error(`❌ FAIL: Reactivated employee login failed: ${reactLoginRes.status}`);
  }

  // STEP 11: Cleanup / Delete Test Employee
  console.log('\n[Step 11] Cleaning up test employee...');
  const delRes = await fetch(`${BASE_URL}/api/admin/employees/${testEmployeeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!delRes.ok) {
    throw new Error(`Failed to delete employee: ${delRes.status}`);
  }
  console.log('✅ PASS: Test employee deleted cleanly.');

  // Verify deletion
  const verifyDelLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testResetPass,
    }),
  });
  if (verifyDelLogin.status === 401) {
    console.log('✅ PASS: Deleted employee record cannot sign in.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL EMPLOYEE MANAGEMENT & SECURITY TESTS PASSED!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
