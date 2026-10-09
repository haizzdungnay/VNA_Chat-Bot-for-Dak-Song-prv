import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { encryptApiKey, decryptApiKey } from '../src/utils/crypto.ts';
import { validateAiEndpoint } from '../src/utils/security-guards.ts';
import { authenticateAdmin } from '../src/services/admin-auth.service.ts';
import { AdminService } from '../src/services/admin.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createAdminTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  const m1 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0001_initial.sql'), 'utf8');
  const m2 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql'), 'utf8');
  const m3 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0003_schema_update.sql'), 'utf8');
  const m4 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0004_admin_extension.sql'), 'utf8');

  db.exec(m1);
  db.exec(m2);
  db.exec(m3);
  db.exec(m4);

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
      return stmt.run(...params);
    },
    _sql: sql,
    _params: params,
  });

  const d1Mock = {
    prepare(sql) {
      return makeStmt(sql);
    },
    async batch(statements) {
      for (const s of statements) {
        const stmt = db.prepare(s._sql);
        stmt.run(...s._params);
      }
    },
  };

  return {
    DB: d1Mock,
    ADMIN_ENCRYPTION_KEY: 'test-master-encryption-key-32-chars-long!',
    ADMIN_EMAIL_ALLOWLIST: 'owner@daksong.vn,lead@daksong.vn',
    CF_ACCESS_TEAM_NAME: 'vna-tourism',
    CF_ACCESS_AUD: 'aud-test-secret-1234',
    ...overrides,
  };
}

function createMockJwt(payload) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64(header)}.${b64(payload)}.mock-signature`;
}

// 1. Web Crypto AES-256-GCM Tests
test('Crypto: AES-256-GCM envelope encrypts and decrypts key accurately', async () => {
  const secret = 'super-secret-master-key-with-high-entropy-256';
  const originalKey = 'sk-proj-1234567890abcdef-real-gemini-key';

  const envelope = await encryptApiKey(originalKey, secret);
  assert.ok(typeof envelope === 'string');
  const parsed = JSON.parse(envelope);
  assert.equal(parsed.v, 1);
  assert.ok(parsed.iv);
  assert.ok(parsed.data);

  const decrypted = await decryptApiKey(envelope, secret);
  assert.equal(decrypted, originalKey);
});

test('Crypto: Tampered envelope or wrong master key throws authentication failure', async () => {
  const secret = 'correct-master-key-256-bit-length-ok';
  const wrongSecret = 'wrong-master-key-which-should-fail-auth';
  const originalKey = 'sk-secret-key-12345';

  const envelope = await encryptApiKey(originalKey, secret);

  // Wrong key fails
  await assert.rejects(
    () => decryptApiKey(envelope, wrongSecret),
    /Giải mã thất bại/
  );

  // Tampered ciphertext fails AES-GCM authentication tag check
  const parsed = JSON.parse(envelope);
  const tamperedData = Buffer.from(parsed.data, 'base64');
  tamperedData[0] ^= 0xff; // flip bits
  parsed.data = tamperedData.toString('base64');

  await assert.rejects(
    () => decryptApiKey(JSON.stringify(parsed), secret),
    /Giải mã thất bại/
  );
});

test('Crypto: Short master key (< 16 chars) is rejected', async () => {
  await assert.rejects(
    () => encryptApiKey('my-key', 'short'),
    /tối thiểu 16 ký tự/
  );
});

// 2. SSRF & Endpoint Validation Tests
test('Security: validateAiEndpoint permits trusted AI providers over HTTPS', () => {
  assert.equal(validateAiEndpoint('https://generativelanguage.googleapis.com/v1beta/openai').valid, true);
  assert.equal(validateAiEndpoint('https://api.openai.com/v1').valid, true);
  assert.equal(validateAiEndpoint('https://openrouter.ai/api/v1').valid, true);
  assert.equal(validateAiEndpoint('https://api.groq.com/openai/v1').valid, true);
});

test('Security: validateAiEndpoint blocks HTTP, localhost, loopback, and private IPv4/IPv6 addresses', () => {
  assert.equal(validateAiEndpoint('http://api.openai.com/v1').valid, false);
  assert.equal(validateAiEndpoint('https://localhost/v1').valid, false);
  assert.equal(validateAiEndpoint('https://127.0.0.1:8000/v1').valid, false);
  assert.equal(validateAiEndpoint('https://10.0.1.5/v1').valid, false);
  assert.equal(validateAiEndpoint('https://192.168.1.100/v1').valid, false);
  assert.equal(validateAiEndpoint('https://172.16.0.1/v1').valid, false);
  assert.equal(validateAiEndpoint('https://169.254.169.254/latest').valid, false);
  assert.equal(validateAiEndpoint('https://internal.company.local/v1').valid, false);
  assert.equal(validateAiEndpoint('https://user:pass@api.openai.com/v1').valid, false);
});

test('Security: validateAiEndpoint enforces operational custom allowlist', () => {
  assert.equal(validateAiEndpoint('https://custom-gateway.daksong.vn/v1').valid, false);
  assert.equal(
    validateAiEndpoint('https://custom-gateway.daksong.vn/v1', 'custom-gateway.daksong.vn').valid,
    true
  );
});

// 3. Cloudflare Access Single-Admin Auth Tests
test('Auth: Fail-Closed by default when JWT is absent without dev mock flag', async () => {
  const env = createAdminTestEnv();
  const req = new Request('https://worker.test/api/admin/overview');
  const res = await authenticateAdmin(req, env);

  assert.equal(res.authenticated, false);
  assert.equal(res.status, 401);
});

test('Auth: Dev mock auth permits local testing when ADMIN_DEV_MOCK_AUTH is enabled', async () => {
  const env = createAdminTestEnv({ ADMIN_DEV_MOCK_AUTH: 'true' });
  const req = new Request('https://worker.test/api/admin/overview');
  const res = await authenticateAdmin(req, env);

  assert.equal(res.authenticated, true);
  assert.equal(res.email, 'admin@daksong.vn');
  assert.equal(res.isMock, true);
});

test('Auth: Valid JWT with matching audience, team, and allowlisted email succeeds', async () => {
  const env = createAdminTestEnv();
  const token = createMockJwt({
    iss: 'https://vna-tourism.cloudflareaccess.com',
    aud: 'aud-test-secret-1234',
    email: 'owner@daksong.vn',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const req = new Request('https://worker.test/api/admin/overview', {
    headers: { 'cf-access-jwt-assertion': token },
  });

  const res = await authenticateAdmin(req, env);
  assert.equal(res.authenticated, true);
  assert.equal(res.email, 'owner@daksong.vn');
  assert.equal(res.isMock, false);
});

test('Auth: JWT with un-allowlisted email or expired token is rejected (401/403)', async () => {
  const env = createAdminTestEnv();

  // Non-allowlisted email
  const tokenBadEmail = createMockJwt({
    iss: 'https://vna-tourism.cloudflareaccess.com',
    aud: 'aud-test-secret-1234',
    email: 'attacker@other.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const req1 = new Request('https://worker.test/api/admin/overview', {
    headers: { 'cf-access-jwt-assertion': tokenBadEmail },
  });
  const res1 = await authenticateAdmin(req1, env);
  assert.equal(res1.authenticated, false);
  assert.equal(res1.status, 403);

  // Expired token
  const tokenExpired = createMockJwt({
    iss: 'https://vna-tourism.cloudflareaccess.com',
    aud: 'aud-test-secret-1234',
    email: 'owner@daksong.vn',
    exp: Math.floor(Date.now() / 1000) - 100,
  });
  const req2 = new Request('https://worker.test/api/admin/overview', {
    headers: { 'cf-access-jwt-assertion': tokenExpired },
  });
  const res2 = await authenticateAdmin(req2, env);
  assert.equal(res2.authenticated, false);
  assert.equal(res2.status, 401);
});

// 4. AdminService CRUD, Masking, and Activation Tests
test('AdminService: CRUD profiles stores encrypted key, exposes key_suffix, never returns raw key', async () => {
  const env = createAdminTestEnv();
  const service = new AdminService(env);

  const profile = await service.createProfile(
    {
      name: 'Google Gemini 2.5 Flash Lite',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      model: 'gemini-2.5-flash-lite',
      apiKey: 'AIzaSyDemoSecretKey9876',
      reasoningEffort: 'low',
      jsonMode: false,
    },
    'owner@daksong.vn'
  );

  assert.ok(profile.id);
  assert.equal(profile.name, 'Google Gemini 2.5 Flash Lite');
  assert.equal(profile.keySuffix, '9876');
  assert.equal(profile.isActive, false);
  assert.equal(profile.encryptedApiKey, undefined); // Never exposed

  const list = await service.getProfiles();
  assert.equal(list.length, 1);
  assert.equal(list[0].keySuffix, '9876');
  assert.equal(list[0].encrypted_api_key, undefined);
  assert.equal(list[0].apiKey, undefined);

  // Update profile
  const updated = await service.updateProfile(
    profile.id,
    { name: 'Google Gemini 2.5 Flash Lite (Updated)' },
    'owner@daksong.vn'
  );
  assert.equal(updated.name, 'Google Gemini 2.5 Flash Lite (Updated)');
});

test('AdminService: Active profile activation deactivates others atomically', async () => {
  const env = createAdminTestEnv();
  const service = new AdminService(env);

  const p1 = await service.createProfile(
    {
      name: 'Profile 1',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-proj-key1',
    },
    'owner@daksong.vn'
  );

  const p2 = await service.createProfile(
    {
      name: 'Profile 2',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-proj-key2',
    },
    'owner@daksong.vn'
  );

  await service.activateProfile(p1.id, 'owner@daksong.vn');
  let list = await service.getProfiles();
  assert.equal(list.find((p) => p.id === p1.id)?.isActive, true);
  assert.equal(list.find((p) => p.id === p2.id)?.isActive, false);

  await service.activateProfile(p2.id, 'owner@daksong.vn');
  list = await service.getProfiles();
  assert.equal(list.find((p) => p.id === p1.id)?.isActive, false);
  assert.equal(list.find((p) => p.id === p2.id)?.isActive, true);
});

test('AdminService: Rollback deactivates all profiles back to Worker Env fallback', async () => {
  const env = createAdminTestEnv();
  const service = new AdminService(env);

  const p = await service.createProfile(
    {
      name: 'Active Profile',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-proj-key1',
    },
    'owner@daksong.vn'
  );

  await service.activateProfile(p.id, 'owner@daksong.vn');
  await service.rollbackToEnv('owner@daksong.vn');

  const list = await service.getProfiles();
  assert.equal(list.every((item) => !item.isActive), true);
});

test('AdminService: Deleting active profile is blocked with validation error', async () => {
  const env = createAdminTestEnv();
  const service = new AdminService(env);

  const p = await service.createProfile(
    {
      name: 'Active Profile',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-proj-key1',
    },
    'owner@daksong.vn'
  );

  await service.activateProfile(p.id, 'owner@daksong.vn');

  await assert.rejects(
    () => service.deleteProfile(p.id, 'owner@daksong.vn'),
    /Không thể xóa profile đang hoạt động/
  );
});

test('AdminService: Audit logs record actions and actor accurately', async () => {
  const env = createAdminTestEnv();
  const service = new AdminService(env);

  await service.logAuditEvent('custom_test_action', 'tester@daksong.vn', '{"detail": "ok"}');
  const logs = await service.getLogs();
  assert.ok(logs.auditLogs.length > 0);
  assert.equal(logs.auditLogs[0].action, 'custom_test_action');
  assert.equal(logs.auditLogs[0].actor, 'tester@daksong.vn');
});

test('AdminService: Overview reports truthful counts from real D1 data', async () => {
  const env = createAdminTestEnv();
  const service = new AdminService(env);

  await service.saveVisitorConsent({
    id: 'anon-user-uuid-1',
    displayName: 'Nguyễn Văn A',
    addressAs: 'anh',
    ageGroup: '25-34',
    consentVersion: '1.0',
  });

  const overview = await service.getOverview();
  assert.equal(overview.visitorConsentCount, 1);
  assert.equal(overview.totalChatRequests, 0);
  assert.equal(overview.totalChatErrors, 0);
  assert.equal(overview.encryptionKeyConfigured, true);
});


