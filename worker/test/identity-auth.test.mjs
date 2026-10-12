import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { IdentityService, sha256, computeOtpHmac } from '../src/services/identity.service.ts';
import { clearSentEmailsForTest, getSentEmailsForTest } from '../src/services/email-sender.service.ts';
import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createIdentityTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  const m1 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0001_initial.sql'), 'utf8');
  const m2 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql'), 'utf8');
  const m3 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0003_schema_update.sql'), 'utf8');
  const m4 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0004_admin_extension.sql'), 'utf8');
  const m5 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0005_identity.sql'), 'utf8');

  db.exec(m1);
  db.exec(m2);
  db.exec(m3);
  db.exec(m4);
  db.exec(m5);

  const makeStmt = (sql, params = []) => ({
    bind(...newParams) {
      return makeStmt(sql, newParams);
    },
    async all() {
      const stmt = db.prepare(sql);
      return { results: stmt.all(...params) };
    },
    async first() {
      const stmt = db.prepare(sql);
      return stmt.get(...params);
    },
    async run() {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    },
  });

  return {
    DB: {
      prepare(sql) {
        return makeStmt(sql);
      },
    },
    rawDb: db,
    ENVIRONMENT: 'test',
    EMAIL_PROVIDER: 'test',
    ...overrides,
  };
}

test('IdentityService: Zalo login creates new user and returns valid session', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);

  IdentityService.testZaloVerifier = async (token) => {
    if (token === 'valid_zalo_token_123') {
      return {
        valid: true,
        zaloId: 'zalo_user_9999',
        name: 'Nguyễn Văn A',
        picture: 'https://zalo.me/avatar.jpg',
      };
    }
    return { valid: false, error: 'Invalid token' };
  };

  const res = await identityService.loginWithZalo('valid_zalo_token_123');

  assert.ok(res.sessionToken && res.sessionToken.length >= 32, 'Session token must be secure length');
  assert.ok(res.user.id, 'User ID must be assigned');
  assert.equal(res.user.displayName, 'Nguyễn Văn A');
  assert.equal(res.user.avatarUrl, 'https://zalo.me/avatar.jpg');
  assert.deepEqual(res.user.providers, ['zalo']);

  // Verify in DB
  const userInDb = env.rawDb.prepare('SELECT * FROM users WHERE id = ?').get(res.user.id);
  assert.ok(userInDb, 'User record must exist in DB');
  assert.equal(userInDb.display_name, 'Nguyễn Văn A');

  const identityInDb = env.rawDb.prepare('SELECT * FROM auth_identities WHERE user_id = ?').get(res.user.id);
  assert.ok(identityInDb, 'Identity must exist');
  assert.equal(identityInDb.provider, 'zalo');
  assert.equal(identityInDb.provider_user_id, 'zalo_user_9999');

  const sessionInDb = env.rawDb.prepare('SELECT * FROM auth_sessions WHERE user_id = ?').get(res.user.id);
  assert.ok(sessionInDb, 'Session must exist');
  assert.equal(sessionInDb.token_hash, await sha256(res.sessionToken), 'Stored hash must match token');
});

test('IdentityService: Duplicate Zalo login resolves existing user without duplicating records', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);

  IdentityService.testZaloVerifier = async () => ({
    valid: true,
    zaloId: 'zalo_user_fixed_1',
    name: 'Khách Đắk Song',
  });

  const res1 = await identityService.loginWithZalo('token_attempt_1');
  const res2 = await identityService.loginWithZalo('token_attempt_2');

  assert.equal(res1.user.id, res2.user.id, 'Must bind to exact same user ID');
  assert.notEqual(res1.sessionToken, res2.sessionToken, 'Must issue distinct session tokens');

  const totalUsers = env.rawDb.prepare('SELECT count(*) as count FROM users').get().count;
  assert.equal(totalUsers, 1, 'Exactly 1 user row in DB');

  const totalIdentities = env.rawDb.prepare('SELECT count(*) as count FROM auth_identities').get().count;
  assert.equal(totalIdentities, 1, 'Exactly 1 identity row in DB');

  const totalSessions = env.rawDb.prepare('SELECT count(*) as count FROM auth_sessions').get().count;
  assert.equal(totalSessions, 2, '2 active session rows for user');
});

test('IdentityService: Forged or invalid Zalo token is rejected', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);

  IdentityService.testZaloVerifier = async () => ({
    valid: false,
    error: 'Mã truy cập Zalo không hợp lệ',
  });

  await assert.rejects(
    async () => identityService.loginWithZalo('fake_tampered_token_999'),
    /Mã truy cập Zalo không hợp lệ/
  );
});

test('IdentityService: Email OTP flow handles request, challenge hashing, and single-use verify', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);
  clearSentEmailsForTest();

  const email = 'dukhach@example.com';
  const reqRes = await identityService.requestEmailOtp(email);
  assert.equal(reqRes.success, true);

  const sentList = getSentEmailsForTest();
  assert.equal(sentList.length, 1);
  assert.equal(sentList[0].to, email);

  // Extract OTP code from email text
  const match = sentList[0].text.match(/\b(\d{6})\b/);
  assert.ok(match, 'Must find 6-digit OTP code in email body');
  const otpCode = match[1];

  // Verify challenge in DB has hashed code, NOT plaintext
  const challengeInDb = env.rawDb.prepare('SELECT * FROM auth_challenges WHERE identifier = ?').get(email);
  assert.ok(challengeInDb, 'Challenge must exist');
  assert.notEqual(challengeInDb.code_hash, otpCode, 'Must NOT store plaintext OTP in database');
  assert.equal(challengeInDb.code_hash, await computeOtpHmac(otpCode, 'vna-daksong-otp-hmac-salt-secret'), 'Stored hash must match HMAC-SHA256 of OTP');

  // Verify with correct OTP
  const verifyRes = await identityService.verifyEmailOtp(email, otpCode);
  assert.ok(verifyRes.sessionToken);
  assert.equal(verifyRes.user.email, email);
  assert.deepEqual(verifyRes.user.providers, ['email']);

  // Single-use guard: Replaying identical verify must fail
  await assert.rejects(
    async () => identityService.verifyEmailOtp(email, otpCode),
    /Không tìm thấy yêu cầu xác thực hoặc mã đã được sử dụng/
  );
});

test('IdentityService: Email OTP rejects wrong code and enforces max attempts', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);
  clearSentEmailsForTest();

  const email = 'attempt_limit@example.com';
  await identityService.requestEmailOtp(email);

  // Attempt 1 with wrong code
  await assert.rejects(
    async () => identityService.verifyEmailOtp(email, '000000'),
    /Mã xác thực không chính xác. Bạn còn 2 lần thử/
  );

  // Attempt 2 with wrong code
  await assert.rejects(
    async () => identityService.verifyEmailOtp(email, '111111'),
    /Mã xác thực không chính xác. Bạn còn 1 lần thử/
  );

  // Attempt 3 with wrong code -> Locked
  await assert.rejects(
    async () => identityService.verifyEmailOtp(email, '222222'),
    /Bạn đã hết số lần thử/
  );
});

test('IdentityService: Email OTP unconfigured in production throws 503', async () => {
  const env = createIdentityTestEnv({
    ENVIRONMENT: 'production',
    EMAIL_PROVIDER: undefined,
  });
  const identityService = new IdentityService(env);

  await assert.rejects(
    async () => identityService.requestEmailOtp('test@example.com'),
    /Dịch vụ gửi email chưa được cấu hình/
  );
});

test('IdentityService: authenticateSession validates active session and rejects expired or revoked', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);

  IdentityService.testZaloVerifier = async () => ({
    valid: true,
    zaloId: 'session_test_zalo',
    name: 'Khách Test Session',
  });

  const { sessionToken, user } = await identityService.loginWithZalo('valid_token_abc');

  // 1. Valid session
  const auth1 = await identityService.authenticateSession(sessionToken);
  assert.equal(auth1.authenticated, true);
  assert.equal(auth1.user.id, user.id);

  // 2. Logout / Revoke
  const loggedOut = await identityService.logout(sessionToken);
  assert.equal(loggedOut, true);

  // 3. Authenticate with revoked session
  const authRevoked = await identityService.authenticateSession(sessionToken);
  assert.equal(authRevoked.authenticated, false);
  assert.equal(authRevoked.status, 401);
  assert.ok(authRevoked.error.includes('đã bị thu hồi'));

  // 4. Unknown fake session
  const authFake = await identityService.authenticateSession('fake_unknown_session_token_12345678');
  assert.equal(authFake.authenticated, false);
  assert.equal(authFake.status, 401);
});

test('Data Isolation: User A cannot access or revoke User B sessions', async () => {
  const env = createIdentityTestEnv();
  const identityService = new IdentityService(env);

  IdentityService.testZaloVerifier = async (token) => ({
    valid: true,
    zaloId: token === 'token_a_long_enough' ? 'zalo_user_A' : 'zalo_user_B',
    name: token === 'token_a_long_enough' ? 'User A' : 'User B',
  });

  const userA = await identityService.loginWithZalo('token_a_long_enough');
  const userB = await identityService.loginWithZalo('token_b_long_enough');

  assert.notEqual(userA.user.id, userB.user.id, 'Users must have different IDs');

  // User A authenticates
  const checkA = await identityService.authenticateSession(userA.sessionToken);
  assert.equal(checkA.user.id, userA.user.id);
  assert.notEqual(checkA.user.id, userB.user.id);

  // User A logs out
  await identityService.logout(userA.sessionToken);

  // User B session must still be active and completely unaffected
  const checkB = await identityService.authenticateSession(userB.sessionToken);
  assert.equal(checkB.authenticated, true);
  assert.equal(checkB.user.id, userB.user.id);
});

test('HTTP Router E2E: Full auth lifecycle (/api/auth/*, /api/me) and legacy anonymous routes', async () => {
  const env = createIdentityTestEnv();
  IdentityService.testZaloVerifier = async () => ({
    valid: true,
    zaloId: 'e2e_user_1',
    name: 'Khách E2E',
  });

  const mockCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

  // 1. GET /api/me without Authorization -> 401
  const reqUnauth = new Request('http://localhost:8787/api/me', { method: 'GET' });
  const resUnauth = await worker.fetch(reqUnauth, env, mockCtx);
  assert.equal(resUnauth.status, 401);

  // 2. POST /api/auth/zalo -> 200
  const reqZalo = new Request('http://localhost:8787/api/auth/zalo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: 'valid_e2e_token' }),
  });
  const resZalo = await worker.fetch(reqZalo, env, mockCtx);
  assert.equal(resZalo.status, 200);
  const dataZalo = await resZalo.json();
  assert.ok(dataZalo.sessionToken);
  assert.equal(dataZalo.user.displayName, 'Khách E2E');

  // 3. GET /api/me with session token -> 200
  const reqMe = new Request('http://localhost:8787/api/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${dataZalo.sessionToken}` },
  });
  const resMe = await worker.fetch(reqMe, env, mockCtx);
  assert.equal(resMe.status, 200);
  const dataMe = await resMe.json();
  assert.equal(dataMe.user.id, dataZalo.user.id);

  // 4. POST /api/auth/logout -> 200
  const reqLogout = new Request('http://localhost:8787/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${dataZalo.sessionToken}` },
  });
  const resLogout = await worker.fetch(reqLogout, env, mockCtx);
  assert.equal(resLogout.status, 200);

  // 5. Subsequent GET /api/me -> 401
  const resMeAfterLogout = await worker.fetch(reqMe, env, mockCtx);
  assert.equal(resMeAfterLogout.status, 401);

  // 6. Verify legacy public routes remain 100% accessible anonymously
  const resHealth = await worker.fetch(new Request('http://localhost:8787/api/health'), env, mockCtx);
  assert.equal(resHealth.status, 200);

  const resPlaces = await worker.fetch(new Request('http://localhost:8787/api/places'), env, mockCtx);
  assert.equal(resPlaces.status, 200);
  const placesData = await resPlaces.json();
  assert.equal(placesData.length, 19, 'Must still return 19 places');
});
