import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { visitorConsentRoute } from '../src/routes/visitors.ts';
import { AdminService } from '../src/services/admin.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createConsentTestEnv() {
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
  });

  const d1Mock = {
    prepare(sql) {
      return makeStmt(sql);
    },
  };

  return { DB: d1Mock, db };
}

test('Visitor Consent: Opt-in saves record and reflects in AdminService', async () => {
  const { DB, db } = createConsentTestEnv();
  const req = new Request('https://worker.test/api/visitors/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentToken: 'anon-uuid-valid-1234',
      displayName: 'Khách Tham Quan Đắk Song',
      addressAs: 'anh',
      ageGroup: '25-34',
      consentVersion: '1.0',
      optIn: true,
    }),
  });

  const res = await visitorConsentRoute(req, {}, { DB }, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.consented, true);

  const adminService = new AdminService({ DB });
  const visitors = await adminService.getVisitors();
  assert.equal(visitors.length, 1);
  assert.equal(visitors[0].display_name, 'Khách Tham Quan Đắk Song');
  assert.equal(visitors[0].age_group, '25-34');
});

test('Visitor Consent: Opt-out (optIn: false) soft-deletes profile and excludes from active visitors', async () => {
  const { DB, db } = createConsentTestEnv();

  // First opt-in
  const reqOptIn = new Request('https://worker.test/api/visitors/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentToken: 'anon-to-delete-9999',
      displayName: 'Khách Cần Xóa',
      optIn: true,
    }),
  });
  await visitorConsentRoute(reqOptIn, {}, { DB }, {});

  // Then opt-out / delete
  const reqOptOut = new Request('https://worker.test/api/visitors/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      consentToken: 'anon-to-delete-9999',
      optIn: false,
    }),
  });
  const resOptOut = await visitorConsentRoute(reqOptOut, {}, { DB }, {});
  assert.equal(resOptOut.status, 200);

  const adminService = new AdminService({ DB });
  const visitors = await adminService.getVisitors();
  assert.equal(visitors.length, 0, 'Soft-deleted profile must be excluded from visitors');
});

test('Visitor Consent: Rejects requests missing valid consentToken', async () => {
  const { DB } = createConsentTestEnv();
  const req = new Request('https://worker.test/api/visitors/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'No Token User',
      optIn: true,
    }),
  });

  const res = await visitorConsentRoute(req, {}, { DB }, {});
  assert.equal(res.status, 400);
});




