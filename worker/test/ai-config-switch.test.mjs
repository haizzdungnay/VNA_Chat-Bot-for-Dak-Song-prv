import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { ChatService } from '../src/services/chat.service.ts';
import { AdminService } from '../src/services/admin.service.ts';
import { encryptApiKey } from '../src/utils/crypto.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createSwitchTestEnv(overrides = {}) {
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

  let capturedConfig = null;

  const mockProvider = {
    chat: async (input) => {
      return {
        answer: 'Trợ lý phản hồi chuẩn xác',
        placeIds: ['vr360-1'],
      };
    },
  };

  const env = {
    DB: d1Mock,
    AI_PROVIDER: 'mock',
    mockProvider,
    AI_MODEL: 'baseline-gemini-model',
    AI_BASE_URL: 'https://baseline.google.com',
    AI_API_KEY: 'baseline-key',
    ADMIN_ENCRYPTION_KEY: 'test-master-encryption-key-32-chars-long!',
    ...overrides,
  };

  return { env, db };
}

test('Feature Flag OFF: Chat strictly uses baseline Worker Env, ignoring D1 profiles', async () => {
  const { env, db } = createSwitchTestEnv({
    ADMIN_AI_CONFIG_ENABLED: 'false',
  });

  // Seed an active profile into D1
  const masterKey = env.ADMIN_ENCRYPTION_KEY;
  const encryptedKey = await encryptApiKey('dynamic-active-key', masterKey);
  db.exec(`
    INSERT INTO admin_ai_profiles (id, name, provider_type, base_url, model, encrypted_api_key, key_suffix, is_active)
    VALUES ('p-active', 'Dynamic Active', 'openai-compatible', 'https://dynamic.ai.com', 'dynamic-model-xyz', '${encryptedKey}', 'yxyz', 1);
  `);

  let resolvedEnv = null;
  env.mockProvider = {
    chat: async () => {
      return { answer: 'OK', placeIds: [] };
    },
  };

  const service = new ChatService(env);
  const res = await service.handleChat({ message: 'Xin chào Đắk Song' });

  assert.equal(res.answer, 'OK');
  // Flag is OFF -> adminService.getActiveRuntimeConfig() is bypassed
  const admin = new AdminService(env);
  const runtimeConfig = await admin.getActiveRuntimeConfig();
  assert.equal(runtimeConfig, null, 'Active runtime config returns null when flag is OFF');
});

test('Feature Flag ON: Chat resolves active D1 profile and decrypts API key', async () => {
  const { env, db } = createSwitchTestEnv({
    ADMIN_AI_CONFIG_ENABLED: 'true',
  });

  // Seed active profile
  const masterKey = env.ADMIN_ENCRYPTION_KEY;
  const encryptedKey = await encryptApiKey('secret-dynamic-gemini-key', masterKey);
  db.exec(`
    INSERT INTO admin_ai_profiles (id, name, provider_type, base_url, model, encrypted_api_key, key_suffix, is_active)
    VALUES ('p-active-1', 'Active Gemini', 'mock', 'https://generativelanguage.googleapis.com/v1beta/openai', 'gemini-2.5-flash-pro', '${encryptedKey}', 'ykey', 1);
  `);

  const admin = new AdminService(env);
  const runtimeConfig = await admin.getActiveRuntimeConfig();

  assert.ok(runtimeConfig);
  assert.equal(runtimeConfig.model, 'gemini-2.5-flash-pro');
  assert.equal(runtimeConfig.apiKey, 'secret-dynamic-gemini-key');
  assert.equal(runtimeConfig.source, 'database');

  const service = new ChatService(env);
  const res = await service.handleChat({ message: 'Thời tiết Đắk Song' });
  assert.ok(res.answer);
  assert.ok(Array.isArray(res.placeIds));
});

test('Feature Flag ON: Graceful fallback to Worker Env when no profile is active or key corrupted', async () => {
  const { env, db } = createSwitchTestEnv({
    ADMIN_AI_CONFIG_ENABLED: 'true',
    ADMIN_ENCRYPTION_KEY: 'wrong-key-will-fail-decryption-256',
  });

  // Seed profile with corrupt/incompatible encryption
  db.exec(`
    INSERT INTO admin_ai_profiles (id, name, provider_type, base_url, model, encrypted_api_key, key_suffix, is_active)
    VALUES ('p-broken', 'Corrupt Profile', 'openai-compatible', 'https://api.openai.com', 'model-broken', 'not-valid-json', '1234', 1);
  `);

  const admin = new AdminService(env);
  const runtimeConfig = await admin.getActiveRuntimeConfig();
  assert.equal(runtimeConfig, null, 'Fallback to null when decryption fails');

  // Chat service handles chat cleanly without crash
  const service = new ChatService(env);
  const res = await service.handleChat({ message: 'Hồ Tây Đắk Song' });
  assert.ok(res.answer);
});

test('Telemetry: Chat requests and errors are logged to admin_telemetry_events', async () => {
  const { env, db } = createSwitchTestEnv();

  const service = new ChatService(env);
  await service.handleChat({ message: 'Giới thiệu thác Lưu Ly' });

  const telemEvents = db.prepare('SELECT * FROM admin_telemetry_events').all();
  assert.ok(telemEvents.length >= 1, 'At least 1 telemetry event logged');
  assert.equal(telemEvents[0].event_type, 'chat_request');
  assert.equal(telemEvents[0].status_code, 200);
});


