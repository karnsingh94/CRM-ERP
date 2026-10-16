async function runTests() {
  console.log('================================================================');
  console.log('AZZUNIQE CRM & ERP — COMPLETE UNIFIED AUTHENTICATION VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}: ${details}`);
      failed++;
    }
  }

  function getCookies(res) {
    if (typeof res.headers.getSetCookie === 'function') {
      return res.headers.getSetCookie().join('; ');
    }
    return res.headers.get('set-cookie') || '';
  }

  const BASE = 'http://localhost:5000/api';

  // 1. Unified Canonical Login — Super Admin
  console.log('--- Test 1: Unified Login for Super Admin (/api/auth/login) ---');
  const res1 = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@azzuniqe.com',
      password: 'SuperAdmin@2026!',
    }),
  });
  const data1 = await res1.json();
  const superToken = data1?.token || data1?.data?.token;
  const superCookies = getCookies(res1);
  const user1Role = data1?.data?.role || data1?.data?.user?.role;
  const target1Origin = data1?.targetOrigin || data1?.data?.targetOrigin;

  assert(res1.status === 200, 'Super Admin unified login status 200', `Got ${res1.status}`);
  assert(user1Role === 'SUPER_ADMIN', 'Resolved role is SUPER_ADMIN', `Role was: ${user1Role}`);
  assert(!!superToken, 'Cryptographic Bearer token returned in response body');
  assert(superCookies.includes('azzuniqe_session='), 'HttpOnly azzuniqe_session cookie set');
  assert(target1Origin === 'http://localhost:3000', 'Target origin routes to Super Admin portal (port 3000)');

  // 2. Unified Canonical Login — Company Admin
  console.log('\n--- Test 2: Unified Login for Company Admin (/api/auth/login) ---');
  const res2 = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rajesh@apextech.com',
      password: 'Tenant@2026!',
    }),
  });
  const data2 = await res2.json();
  const clientToken = data2?.token || data2?.data?.token;
  const user2Role = data2?.data?.role || data2?.data?.user?.role;
  const user2Company = data2?.data?.companyId || data2?.data?.user?.companyId;
  const target2Origin = data2?.targetOrigin || data2?.data?.targetOrigin;

  assert(res2.status === 200, 'Company Admin login status 200', `Got ${res2.status}`);
  assert(user2Role === 'COMPANY_ADMIN', 'Resolved role is COMPANY_ADMIN', `Role was: ${user2Role}`);
  assert(String(user2Company) === '1', 'Company context resolved to ID 1');
  assert(target2Origin === 'http://localhost:3001', 'Target origin routes to Company portal (port 3001)');

  // 3. Unified Canonical Login — Department Head
  console.log('\n--- Test 3: Unified Login for Department Head (/api/auth/login) ---');
  const res3 = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'priya.sharma@apextech.com',
      password: 'Tenant@2026!',
    }),
  });
  const data3 = await res3.json();
  const user3Role = data3?.data?.role || data3?.data?.user?.role;
  const user3Dept = data3?.data?.departmentName || data3?.data?.user?.departmentName;

  assert(res3.status === 200, 'Department Head login status 200', `Got ${res3.status}`);
  assert(user3Role === 'DEPARTMENT_HEAD', 'Resolved role is DEPARTMENT_HEAD', `Role was: ${user3Role}`);
  assert(user3Dept === 'Sales & Marketing', 'Department scope resolved to Sales & Marketing');

  // 4. Unified Canonical Login — Employee
  console.log('\n--- Test 4: Unified Login for Employee (/api/auth/login) ---');
  const res4 = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'vikram.mehta@apextech.com',
      password: 'Tenant@2026!',
    }),
  });
  const data4 = await res4.json();
  const user4Role = data4?.data?.role || data4?.data?.user?.role;

  assert(res4.status === 200, 'Employee login status 200', `Got ${res4.status}`);
  assert(user4Role === 'EMPLOYEE', 'Resolved role is EMPLOYEE', `Role was: ${user4Role}`);

  // 5. Invalid Credentials Rejection
  console.log('\n--- Test 5: Safe Invalid Credentials Rejection ---');
  const res5 = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'unknown.user@company.com',
      password: 'WrongPassword123!',
    }),
  });
  assert(res5.status === 401, 'Invalid credentials safely rejected with 401', `Got ${res5.status}`);

  // 6. Super Admin Session Check via Bearer Token
  console.log('\n--- Test 6: Authenticated Session Profile Verification ---');
  const res6 = await fetch(`${BASE}/auth/me`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${superToken}` },
  });
  const data6 = await res6.json();
  assert(res6.status === 200, 'Session profile returns 200', `Got ${res6.status}`);
  assert(data6?.data?.role === 'SUPER_ADMIN', 'Verified profile identity is SUPER_ADMIN');

  // 7. Cookie-Based Authentication
  console.log('\n--- Test 7: HttpOnly Cookie-Based Session Validation ---');
  const res7 = await fetch(`${BASE}/auth/me`, {
    method: 'GET',
    headers: { 'Cookie': superCookies },
  });
  const data7 = await res7.json();
  assert(res7.status === 200, 'Cookie session returns 200', `Got ${res7.status}`);
  assert(data7?.data?.role === 'SUPER_ADMIN', 'Verified cookie session role is SUPER_ADMIN');

  // 8. Company Admin Profile Verification
  console.log('\n--- Test 8: Company Admin Session Profile Verification ---');
  const res8 = await fetch(`${BASE}/auth/me`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${clientToken}` },
  });
  const data8 = await res8.json();
  assert(res8.status === 200, 'Company Admin profile returns 200', `Got ${res8.status}`);
  assert(data8?.data?.organizationName === 'Apex Technologies Pvt Ltd', 'Organization resolved to Apex Technologies');

  // 9. Unauthenticated Access Rejection
  console.log('\n--- Test 9: Unauthenticated Route / API Rejection ---');
  const res9 = await fetch(`${BASE}/auth/me`, { method: 'GET' });
  assert(res9.status === 401, 'Unauthenticated request rejected with 401', `Got ${res9.status}`);

  // 10. Session Logout & Cookie Clearance
  console.log('\n--- Test 10: Session Logout and Cookie Invalidation ---');
  const res10 = await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${superToken}` },
  });
  assert(res10.status === 200, 'Logout status 200', `Got ${res10.status}`);
  const logoutCookies = getCookies(res10);
  assert(logoutCookies.includes('Max-Age=0') || logoutCookies.includes('Expires='), 'Cookie cleared on logout');

  // 11. Legacy Endpoint Compatibility
  console.log('\n--- Test 11: Backward Compatibility (/api/auth/super-admin/login) ---');
  const res11 = await fetch(`${BASE}/auth/super-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@azzuniqe.com',
      password: 'SuperAdmin@2026!',
    }),
  });
  assert(res11.status === 200, 'Legacy super-admin login route status 200', `Got ${res11.status}`);

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
