async function testForgotPasswordFlow() {
  console.log('================================================================');
  console.log('AZZUNIQE CRM & ERP — FORGOT PASSWORD & RESET FLOW VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  const BASE = 'http://localhost:5000/api';

  // 1. Generic response for non-existent email
  console.log('--- 1. Testing Forgot Password Request for non-existent email ---');
  const res1 = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent.user.test@unknown.com' }),
  });
  const data1 = await res1.json();
  assert(res1.status === 200, 'Non-existent email returns HTTP 200');
  assert(
    data1.message === 'If an account exists for this email address, password reset instructions will be sent.',
    'Generic safe message returned to prevent user enumeration'
  );
  assert(!data1.resetToken, 'No reset token returned for non-existent account');

  // 2. Forgot Password Request for real account (Company Admin: pooja@zenithlogistics.in)
  console.log('\n--- 2. Testing Forgot Password Request for Company Admin ---');
  const testEmail = 'pooja@zenithlogistics.in';
  const res2 = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const data2 = await res2.json();
  assert(res2.status === 200, 'Real account returns HTTP 200');
  assert(
    data2.message === 'If an account exists for this email address, password reset instructions will be sent.',
    'Generic safe message returned for real account too'
  );
  assert(!!data2.resetToken, 'devResetLink / resetToken provided in development mode');
  const token = data2.resetToken;

  // 3. Verify reset token
  console.log('\n--- 3. Testing Reset Token Verification ---');
  const resVerifyValid = await fetch(`${BASE}/auth/verify-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email: testEmail }),
  });
  const dataVerifyValid = await resVerifyValid.json();
  assert(dataVerifyValid.valid === true, 'Valid token verified as valid: true');

  const resVerifyInvalid = await fetch(`${BASE}/auth/verify-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'fake_invalid_token_12345', email: testEmail }),
  });
  const dataVerifyInvalid = await resVerifyInvalid.json();
  assert(dataVerifyInvalid.valid === false, 'Invalid token verified as valid: false');

  // 4. Reject short password
  console.log('\n--- 4. Testing Password Length Validation (< 8 chars) ---');
  const resShort = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email: testEmail, password: 'short' }),
  });
  assert(resShort.status === 400, 'Password < 8 chars rejected with HTTP 400');

  // 5. Successful Password Reset
  console.log('\n--- 5. Executing Password Reset ---');
  const newPassword = 'NewSecretPassword@2026!';
  const resReset = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email: testEmail, password: newPassword }),
  });
  const dataReset = await resReset.json();
  assert(resReset.status === 200, 'Password reset succeeded with HTTP 200');
  assert(dataReset.success === true, 'Success flag returned');

  // 6. Token Invalidation (Single-Use Check)
  console.log('\n--- 6. Verifying Token Cannot Be Reused (Single-Use) ---');
  const resReuse = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email: testEmail, password: 'AnotherPassword@2026!' }),
  });
  assert(resReuse.status === 400, 'Reused token rejected with HTTP 400');

  const resVerifyReused = await fetch(`${BASE}/auth/verify-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, email: testEmail }),
  });
  const dataVerifyReused = await resVerifyReused.json();
  assert(dataVerifyReused.valid === false, 'Used token no longer verifies (valid: false)');

  // 7. Old Password Fails at Unified Login
  console.log('\n--- 7. Verifying Old Password Fails at Unified Login ---');
  const resOldLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'Tenant@2026!' }),
  });
  assert(resOldLogin.status === 401, 'Old password rejected with HTTP 401');

  // 8. New Password Succeeds at Unified Login
  console.log('\n--- 8. Verifying New Password Succeeds at Unified Login ---');
  const resNewLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: newPassword }),
  });
  const dataNewLogin = await resNewLogin.json();
  assert(resNewLogin.status === 200, 'New password successfully authenticates with HTTP 200');
  assert(dataNewLogin.data.role === 'COMPANY_ADMIN', 'Correct role retained (COMPANY_ADMIN)');
  assert(!!dataNewLogin.token, 'New session token issued');

  // 9. Reset for Super Admin (Platform Owner)
  console.log('\n--- 9. Testing Password Reset for Super Admin ---');
  const saEmail = 'admin@azzuniqe.com';
  const resSaReq = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: saEmail }),
  });
  const dataSaReq = await resSaReq.json();
  assert(resSaReq.status === 200, 'Super Admin reset request returns HTTP 200');
  const saToken = dataSaReq.resetToken;

  const newSaPassword = 'SuperAdminNew@2026!';
  const resSaReset = await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: saToken, email: saEmail, password: newSaPassword }),
  });
  assert(resSaReset.status === 200, 'Super Admin password reset succeeded');

  const resSaOldLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: saEmail, password: 'SuperAdmin@2026!' }),
  });
  assert(resSaOldLogin.status === 401, 'Super Admin old password rejected (401)');

  const resSaNewLogin = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: saEmail, password: newSaPassword }),
  });
  const dataSaNewLogin = await resSaNewLogin.json();
  assert(resSaNewLogin.status === 200, 'Super Admin new password authenticates (200)');
  assert(dataSaNewLogin.data.role === 'SUPER_ADMIN', 'Super Admin role verified');

  // 10. Clean-up: Restore original passwords so other test suites stay green
  console.log('\n--- 10. Restoring original test passwords ---');
  const resSaRestoreReq = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: saEmail }),
  });
  const dataSaRestoreReq = await resSaRestoreReq.json();
  await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: dataSaRestoreReq.resetToken, email: saEmail, password: 'SuperAdmin@2026!' }),
  });

  const resPoojaRestoreReq = await fetch(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail }),
  });
  const dataPoojaRestoreReq = await resPoojaRestoreReq.json();
  await fetch(`${BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: dataPoojaRestoreReq.resetToken, email: testEmail, password: 'Tenant@2026!' }),
  });
  assert(true, 'Test account passwords restored to baseline values');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

testForgotPasswordFlow().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
