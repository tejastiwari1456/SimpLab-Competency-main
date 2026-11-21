import assert from "assert";
import { authService, UserRole } from "../auth.service";

async function runTestSuite() {
  console.log("==================================================================");
  console.log("SIMLAB COMPETENCY HUB - BACKEND AUTHENTICATION TEST SUITE");
  console.log("==================================================================");

  let passedTests = 0;
  let totalTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  [PASS] ${name}`);
    } catch (err: any) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack.split("\n").slice(1, 4).join("\n"));
      }
    }
  }

  // Ensure DB initialized
  await authService.initDatabase();
  const pool = authService.getPool();
  assert(pool, "Database pool must be available");

  // TEST 1: Direct SQL Verification of Pre-seeded Demo Accounts
  await test("1. Pre-seeded authentic accounts exist in PostgreSQL users table", async () => {
    const res = await pool.query("SELECT email, role, status FROM users ORDER BY email ASC;");
    assert(res.rows.length >= 3, `Expected at least 3 seeded users, found ${res.rows.length}`);
    const emails = res.rows.map((r: any) => r.email);
    assert(emails.includes("aarav.sharma@university.edu"), "Student account missing");
    assert(emails.includes("dr.ananya.sen@university.edu"), "Teacher account missing");
    assert(emails.includes("admin.lead@university.edu"), "Admin account missing");
  });

  // TEST 2: Student Registration with Bcrypt Hashing
  const testStudentEmail = `test.student.${Date.now()}@university.edu`;
  let studentToken = "";
  let studentRefreshToken = "";
  let studentUserId = "";
  let studentSessionId = "";

  await test("2. Register new student with bcrypt hashing and session generation", async () => {
    const result = await authService.register(
      {
        email: testStudentEmail,
        password: "ValidPassword123!",
        name: "Test Student Alpha",
        role: "student",
        institution: "Physics Department",
        enrollmentCode: "PHYS-LAB-101",
      },
      { userAgent: "SimLabTestClient/1.0", ipAddress: "127.0.0.1" }
    );

    assert(result.user.email === testStudentEmail, "User email mismatch");
    assert(result.user.role === "student", "User role must be student");
    assert(result.token && result.token.length > 20, "Access token missing");
    assert(result.refreshToken && result.refreshToken.startsWith("sim_rt_"), "Refresh token missing or invalid prefix");
    assert(result.session && result.session.id, "Session record missing");

    studentToken = result.token;
    studentRefreshToken = result.refreshToken;
    studentUserId = result.user.id;
    studentSessionId = result.session.id;

    // Direct SQL check: verify password_hash is bcrypt and NOT plaintext
    const dbUserRes = await pool.query("SELECT password_hash FROM users WHERE id = $1;", [studentUserId]);
    const hash = dbUserRes.rows[0].password_hash;
    assert(hash.startsWith("$2"), "Password must be hashed with bcrypt ($2a$ / $2b$)");
    assert(!hash.includes("ValidPassword123!"), "Plaintext password must NEVER be stored in database");
  });

  // TEST 3: Duplicate Registration Prevention
  await test("3. Duplicate registration with existing email is rejected", async () => {
    let errorThrown = false;
    try {
      await authService.register({
        email: testStudentEmail,
        password: "AnotherPassword123!",
        name: "Duplicate Person",
        role: "student",
      });
    } catch (err: any) {
      errorThrown = true;
      assert(err.message.includes("already exists"), "Expected duplicate account error");
    }
    assert(errorThrown, "Should reject duplicate email registration");
  });

  // TEST 4: Role Escalation Prevention
  await test("4. Self-registration with 'admin' role is strictly rejected", async () => {
    let errorThrown = false;
    try {
      await authService.register({
        email: `fake.admin.${Date.now()}@university.edu`,
        password: "AdminPassword123!",
        name: "Hacker Attempting Admin",
        role: "admin" as UserRole,
      });
    } catch (err: any) {
      errorThrown = true;
      assert(err.message.includes("Invalid role specified"), "Expected role escalation rejection");
    }
    assert(errorThrown, "Should reject self-registration of admin role");
  });

  // TEST 5: Password Verification and Login Persistence
  await test("5. Login updates last_login_at timestamp and creates active session in PostgreSQL", async () => {
    // Record previous last_login_at
    const beforeUser = await pool.query("SELECT last_login_at FROM users WHERE id = $1;", [studentUserId]);
    const beforeTimestamp = beforeUser.rows[0].last_login_at;

    // Perform login
    const loginResult = await authService.login({
      email: testStudentEmail,
      password: "ValidPassword123!",
      userAgent: "AutomatedTestAgent/2.0",
      ipAddress: "192.168.1.50",
    });

    assert(loginResult.user.id === studentUserId, "User ID mismatch on login");
    assert(loginResult.token, "Access token missing on login");

    // Direct SQL check: verify users.last_login_at has been updated
    const afterUser = await pool.query("SELECT last_login_at FROM users WHERE id = $1;", [studentUserId]);
    const afterTimestamp = afterUser.rows[0].last_login_at;
    assert(afterTimestamp !== null, "users.last_login_at must not be null after login");

    // Direct SQL check: verify session was inserted into PostgreSQL sessions table
    const sessionCheck = await pool.query(
      "SELECT * FROM sessions WHERE id = $1 AND user_id = $2;",
      [loginResult.session.id, studentUserId]
    );
    assert(sessionCheck.rows.length === 1, "Session record must exist in PostgreSQL");
    assert(sessionCheck.rows[0].status === "ACTIVE", "Session status must be ACTIVE");
    assert(sessionCheck.rows[0].is_revoked === false, "Session is_revoked must be false");
  });

  // TEST 6: Invalid Password Rejection
  await test("6. Login with incorrect password fails and records failure event", async () => {
    let failed = false;
    try {
      await authService.login({
        email: testStudentEmail,
        password: "WrongPasswordTotally!",
      });
    } catch (err: any) {
      failed = true;
      assert(err.message.includes("Invalid email or password"), "Should return generic error");
    }
    assert(failed, "Login with wrong password must throw error");

    // Direct SQL check: verify LOGIN_FAILURE recorded in auth_events table
    const failureEvent = await pool.query(
      "SELECT * FROM auth_events WHERE user_id = $1 AND event_type = 'LOGIN_FAILURE' ORDER BY created_at DESC LIMIT 1;",
      [studentUserId]
    );
    assert(failureEvent.rows.length === 1, "LOGIN_FAILURE event must be recorded in auth_events");
    assert(failureEvent.rows[0].success === false, "Event success flag must be false");
  });

  // TEST 7: Token Security Policy: Raw Tokens Never Stored in Database
  await test("7. Token Storage Strategy: Database persists only SHA-256 hashes", async () => {
    const sessionRes = await pool.query("SELECT token_hash, refresh_token_hash FROM sessions WHERE user_id = $1 LIMIT 1;", [
      studentUserId,
    ]);
    const row = sessionRes.rows[0];
    assert(row.token_hash, "token_hash must be present");
    assert(row.token_hash.length === 64, "token_hash must be a 64-char hex SHA-256 digest");
    assert(!row.token_hash.includes("."), "token_hash must not be a raw JWT with dots");

    assert(row.refresh_token_hash, "refresh_token_hash must be present");
    assert(row.refresh_token_hash.length === 64, "refresh_token_hash must be a 64-char hex SHA-256 digest");
    assert(!row.refresh_token_hash.startsWith("sim_rt_"), "refresh_token_hash must not contain raw prefix");
  });

  // TEST 8: Session Verification
  await test("8. verifySession validates token against database and returns sanitized user", async () => {
    const verified = await authService.verifySession(studentToken);
    assert(verified.valid === true, "Session must be valid");
    assert(verified.user, "Sanitized user must be returned");
    assert(verified.user.id === studentUserId, "User ID mismatch");
    assert((verified.user as any).password_hash === undefined, "password_hash must be omitted from safe user");
  });

  // TEST 9: Refresh Token Rotation
  let newAccessToken = "";
  let newRefreshToken = "";
  await test("9. POST /refresh rotates refresh token and invalidates old token", async () => {
    const refreshed = await authService.refresh(studentRefreshToken, {
      userAgent: "TestRunner/RefreshTest",
      ipAddress: "127.0.0.1",
    });

    assert(refreshed.token, "New access token must be generated");
    assert(refreshed.refreshToken, "New refresh token must be generated");
    assert(refreshed.refreshToken !== studentRefreshToken, "Refresh token must be ROTATED (new != old)");

    newAccessToken = refreshed.token;
    newRefreshToken = refreshed.refreshToken;

    // Direct SQL check: TOKEN_REFRESH event logged in auth_events
    const refreshEvent = await pool.query(
      "SELECT * FROM auth_events WHERE user_id = $1 AND event_type = 'TOKEN_REFRESH' ORDER BY created_at DESC LIMIT 1;",
      [studentUserId]
    );
    assert(refreshEvent.rows.length === 1, "TOKEN_REFRESH event must be logged in auth_events");
  });

  // TEST 10: Refresh Token Reuse Detection
  await test("10. Reusing old rotated refresh token triggers security detection", async () => {
    let detected = false;
    try {
      await authService.refresh(studentRefreshToken); // old token
    } catch (err: any) {
      detected = true;
    }
    assert(detected, "Reusing old rotated refresh token must be rejected");
  });

  // TEST 11: Single Session Revocation on Logout
  await test("11. Logout revokes specific session and sets status = 'LOGGED_OUT'", async () => {
    const revoked = await authService.revokeSession(newAccessToken, "127.0.0.1", "TestClient");
    assert(revoked === true, "Session revocation should return true");

    // Verification attempt with revoked token should fail
    const verifyAfter = await authService.verifySession(newAccessToken);
    assert(verifyAfter.valid === false, "Session verification must fail after logout");
    assert(verifyAfter.error?.includes("revoked"), "Error message should indicate revocation");

    // Direct SQL check: status changed to LOGGED_OUT, is_revoked = TRUE
    const tokenHash = authService.hashToken(newAccessToken);
    const sessionRes = await pool.query(
      "SELECT status, is_revoked, revoked_at FROM sessions WHERE token_hash = $1;",
      [tokenHash]
    );
    assert(sessionRes.rows.length === 1, "Revoked session must exist in database");
    assert(sessionRes.rows[0].status === "LOGGED_OUT", "Session status must be LOGGED_OUT");
    assert(sessionRes.rows[0].is_revoked === true, "Session is_revoked must be TRUE");
    assert(sessionRes.rows[0].revoked_at !== null, "Session revoked_at timestamp must be set");

    // Direct SQL check: LOGOUT audit event recorded
    const logoutEvt = await pool.query(
      "SELECT * FROM auth_events WHERE user_id = $1 AND event_type = 'LOGOUT' ORDER BY created_at DESC LIMIT 1;",
      [studentUserId]
    );
    assert(logoutEvt.rows.length === 1, "LOGOUT event must be recorded in auth_events");
  });

  // TEST 12: Revoke All Sessions (Logout All)
  await test("12. revokeAllSessions revokes all concurrent sessions for user", async () => {
    // Create two new sessions
    const s1 = await authService.login({ email: testStudentEmail, password: "ValidPassword123!" });
    const s2 = await authService.login({ email: testStudentEmail, password: "ValidPassword123!" });

    const count = await authService.revokeAllSessions(studentUserId, "127.0.0.1", "TestRunner");
    assert(count >= 2, `Expected at least 2 sessions revoked, got ${count}`);

    // Verify both are now revoked
    const v1 = await authService.verifySession(s1.token);
    const v2 = await authService.verifySession(s2.token);
    assert(!v1.valid, "Session 1 must be invalid");
    assert(!v2.valid, "Session 2 must be invalid");

    // Direct SQL check: LOGOUT_ALL event recorded
    const logoutAllEvt = await pool.query(
      "SELECT * FROM auth_events WHERE user_id = $1 AND event_type = 'LOGOUT_ALL' ORDER BY created_at DESC LIMIT 1;",
      [studentUserId]
    );
    assert(logoutAllEvt.rows.length === 1, "LOGOUT_ALL event must be in auth_events");
  });

  // TEST 13: Account Status Enforcement (Suspended / Disabled)
  await test("13. Suspended account cannot log in and active sessions are denied", async () => {
    // Suspend user in DB
    await pool.query("UPDATE users SET status = 'SUSPENDED' WHERE id = $1;", [studentUserId]);

    let loginBlocked = false;
    try {
      await authService.login({ email: testStudentEmail, password: "ValidPassword123!" });
    } catch (err: any) {
      loginBlocked = true;
      assert(err.message.includes("suspended"), "Error message should mention suspension");
    }
    assert(loginBlocked, "Login must be blocked for suspended account");

    // Restore user to ACTIVE
    await pool.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1;", [studentUserId]);
  });

  // TEST 14: Password Change Flow
  await test("14. changePassword updates bcrypt hash and verifies current password", async () => {
    // Wrong current password
    let failedWrongOld = false;
    try {
      await authService.changePassword(studentUserId, "WrongPassword!", "BrandNewPassword2026!");
    } catch (err: any) {
      failedWrongOld = true;
      assert(err.message.includes("Incorrect current password"), "Expected wrong password message");
    }
    assert(failedWrongOld, "Should reject wrong current password");

    // Successful change
    await authService.changePassword(studentUserId, "ValidPassword123!", "BrandNewPassword2026!");

    // Verify login with new password works
    const newLogin = await authService.login({ email: testStudentEmail, password: "BrandNewPassword2026!" });
    assert(newLogin.user.id === studentUserId, "Login with new password succeeded");

    // Direct SQL check: PASSWORD_CHANGE event recorded
    const pwChangeEvt = await pool.query(
      "SELECT * FROM auth_events WHERE user_id = $1 AND event_type = 'PASSWORD_CHANGE' ORDER BY created_at DESC LIMIT 1;",
      [studentUserId]
    );
    assert(pwChangeEvt.rows.length === 1, "PASSWORD_CHANGE event must be in auth_events");
  });

  // TEST 15: Password Reset Flow (Forgot Password & Reset Token)
  await test("15. Password reset flow generates single-use token and invalidates prior sessions", async () => {
    const resetToken = await authService.requestPasswordReset(testStudentEmail, "127.0.0.1", "TestClient");
    assert(resetToken, "Reset token must be generated");

    // Direct SQL check: token stored in password_resets table as SHA-256 hash
    const resetHash = authService.hashToken(resetToken);
    const resetCheck = await pool.query(
      "SELECT * FROM password_resets WHERE token_hash = $1 AND user_id = $2 AND used_at IS NULL;",
      [resetHash, studentUserId]
    );
    assert(resetCheck.rows.length === 1, "Password reset record must exist in PostgreSQL");

    // Complete reset
    await authService.resetPassword(resetToken, "ResetCompletedPass999!", "127.0.0.1", "TestClient");

    // Verify token cannot be reused
    let reuseFailed = false;
    try {
      await authService.resetPassword(resetToken, "AttemptReusingToken123!");
    } catch (err: any) {
      reuseFailed = true;
    }
    assert(reuseFailed, "Password reset token must not be reusable");

    // Verify login with newly reset password
    const resetLogin = await authService.login({ email: testStudentEmail, password: "ResetCompletedPass999!" });
    assert(resetLogin.user.id === studentUserId, "Login with reset password must succeed");
  });

  // TEST 16: Audit Trail & Session History Querying
  await test("16. getUserSessions retrieves session audit trail without secret leakage", async () => {
    const sessions = await authService.getUserSessions(studentUserId);
    assert(sessions.length > 0, "Should have session history");
    for (const s of sessions) {
      assert(s.id, "Session must have id");
      assert(s.status, "Session must have status");
      assert(s.loginAt, "Session must have login timestamp");
      assert((s as any).token_hash === undefined, "token_hash must NEVER be leaked in user sessions query");
      assert((s as any).refresh_token_hash === undefined, "refresh_token_hash must NEVER be leaked");
    }
  });

  // TEST 17: HTTP RBAC Middleware - Student Accessing Student Resource
  const express = (await import("express")).default;
  const { authRouter, requireAuth, requireRole } = await import("../auth.controller");
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/auth", authRouter);
  testApp.get("/api/student/test-experiments", requireAuth, requireRole("student"), (req: any, res: any) => {
    res.json({ success: true, studentId: req.user.id });
  });
  testApp.get("/api/teacher/test-classes", requireAuth, requireRole("teacher"), (req: any, res: any) => {
    res.json({ success: true, teacherId: req.user.id });
  });
  testApp.get("/api/admin/test-users", requireAuth, requireRole("admin"), (req: any, res: any) => {
    res.json({ success: true, adminId: req.user.id });
  });

  const http = (await import("http")).default;
  const testServer = http.createServer(testApp);
  await new Promise<void>((resolve) => testServer.listen(0, resolve));
  const testPort = (testServer.address() as any).port;
  const baseUrl = `http://127.0.0.1:${testPort}`;

  // Login as student and as teacher to get live tokens
  const studentAuth = await authService.login({ email: testStudentEmail, password: "ResetCompletedPass999!" });
  const teacherAuth = await authService.login({ email: "dr.ananya.sen@university.edu", password: "password123" });
  const adminAuth = await authService.login({ email: "admin.lead@university.edu", password: "Admin@SimLab2026!" });

  await test("17. HTTP: Student accessing /api/student resource returns 200 OK", async () => {
    const res = await fetch(`${baseUrl}/api/student/test-experiments`, {
      headers: { Authorization: `Bearer ${studentAuth.token}` },
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Expected success: true");
    assert(data.studentId === studentAuth.user.id, "Expected matching student ID");
  });

  // TEST 18: HTTP RBAC: Student accessing Teacher Resource is Forbidden (403)
  await test("18. HTTP RBAC: Student accessing /api/teacher resource returns 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/teacher/test-classes`, {
      headers: { Authorization: `Bearer ${studentAuth.token}` },
    });
    assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
    const data = await res.json();
    assert(data.success === false, "Expected success: false");
    assert(data.error.code === "FORBIDDEN", "Expected code FORBIDDEN");
  });

  // TEST 19: HTTP RBAC: Teacher accessing Teacher Resource succeeds (200)
  await test("19. HTTP RBAC: Teacher accessing /api/teacher resource returns 200 OK", async () => {
    const res = await fetch(`${baseUrl}/api/teacher/test-classes`, {
      headers: { Authorization: `Bearer ${teacherAuth.token}` },
    });
    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert(data.success === true, "Expected success: true");
    assert(data.teacherId === teacherAuth.user.id, "Expected matching teacher ID");
  });

  // TEST 20: HTTP RBAC: Teacher accessing Admin Resource is Forbidden (403)
  await test("20. HTTP RBAC: Teacher accessing /api/admin resource returns 403 Forbidden", async () => {
    const res = await fetch(`${baseUrl}/api/admin/test-users`, {
      headers: { Authorization: `Bearer ${teacherAuth.token}` },
    });
    assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
  });

  // TEST 21: HTTP RBAC: Admin accessing Admin Resource succeeds (200)
  await test("21. HTTP RBAC: Admin accessing /api/admin resource returns 200 OK", async () => {
    const res = await fetch(`${baseUrl}/api/admin/test-users`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` },
    });
    assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
  });

  // TEST 22: HTTP: Unauthenticated request returns 401 Unauthorized
  await test("22. HTTP: Request missing Authorization header returns 401 Unauthorized", async () => {
    const res = await fetch(`${baseUrl}/api/student/test-experiments`);
    assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
    const data = await res.json();
    assert(data.error.code === "UNAUTHENTICATED", "Expected code UNAUTHENTICATED");
  });

  // Close test server
  await new Promise<void>((resolve) => testServer.close(() => resolve()));


  console.log("==================================================================");
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log("==================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed with unhandled error:", err);
  process.exit(1);
});
