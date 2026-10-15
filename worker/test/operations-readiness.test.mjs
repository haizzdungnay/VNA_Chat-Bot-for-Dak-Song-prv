import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { AdminService, EXPECTED_MIGRATIONS } from '../src/services/admin.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createOpsTestEnv(options = {}) {
  const db = new DatabaseSync(':memory:');
  const migrationFiles = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', file), 'utf8');
    db.exec(sql);
  }

  // Populate valid baseline data
  db.exec("INSERT INTO users (id, email) VALUES ('u1', 'u1@test.com'), ('u2', 'u2@test.com');");
  db.exec("INSERT INTO quiz_attempts (id, user_id, attempt_type, status) VALUES ('qa1', 'u1', 'practice', 'completed'), ('qa2', 'u1', 'practice', 'completed'), ('qa3', 'u2', 'practice', 'completed');");
  db.exec("INSERT INTO quiz_user_stats (user_id, completed_attempts, total_attempts) VALUES ('u1', 2, 2), ('u2', 1, 1);");

  db.exec("INSERT INTO reward_campaigns (id, code, title, status) VALUES ('cmp1', 'C1', 'Camp 1', 'published');");
  db.exec("INSERT INTO reward_spin_wheels (id, campaign_id, title) VALUES ('w1', 'cmp1', 'Wheel 1');");
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status) VALUES ('sa1', 'u1', 'w1', 'seg-1', 'no_win', '{}', 'completed'), ('sa2', 'u1', 'w1', 'seg-1', 'no_win', '{}', 'completed'), ('sa3', 'u2', 'w1', 'seg-1', 'no_win', '{}', 'completed');");
  db.exec("INSERT INTO reward_user_campaign_spins (campaign_id, user_id, completed_spins) VALUES ('cmp1', 'u1', 2), ('cmp1', 'u2', 1);");

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
    rawDb: db,
    DB: {
      prepare(sql) {
        return makeStmt(sql);
      },
    },
    ENVIRONMENT: 'development',
    MOCK_PAYMENT_ENABLED: 'true',
    ADMIN_DEV_MOCK_AUTH: 'true',
    ...options,
  };
}

// =============================================================================
// P1-OPS-01: INVARIANTS & INTEGRITY TESTS
// =============================================================================
test('P1-OPS-01: Valid baseline returns overallIntegrity = true and overallStatus = PASS', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  const res = await service.getOperationsReadiness();
  assert.equal(res.invariants.quizCompletedMatchesStats, true);
  assert.equal(res.invariants.quizUserDiscrepancyCount, 0);
  assert.equal(res.invariants.quizIntegrityPassed, true);
  assert.equal(res.invariants.rewardSpinsMatchesUserCounters, true);
  assert.equal(res.invariants.rewardUserDiscrepancyCount, 0);
  assert.equal(res.invariants.rewardIntegrityPassed, true);
  assert.equal(res.invariants.zeroOversoldTemplates, true);
  assert.equal(res.invariants.zeroOversoldSegments, true);
  assert.equal(res.invariants.zeroGhostVoucherSpins, true);
  assert.equal(res.invariants.overallIntegrity, true);
  assert.equal(res.invariants.overallStatus, 'PASS');
});

test('P1-OPS-01: Global quiz mismatch makes overallIntegrity = false and overallStatus = FAIL', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  // Corrupt quiz stats
  env.rawDb.exec("UPDATE quiz_user_stats SET completed_attempts = 99 WHERE user_id = 'u1'");

  const res = await service.getOperationsReadiness();
  assert.equal(res.invariants.quizCompletedMatchesStats, false);
  assert.equal(res.invariants.quizIntegrityPassed, false);
  assert.equal(res.invariants.overallIntegrity, false, 'overallIntegrity MUST be false when Quiz is corrupted!');
  assert.equal(res.invariants.overallStatus, 'FAIL');

  // Verify CSV export reflects FAIL, not 100% PASS!
  const csv = await service.exportOperationsCsv();
  assert.ok(csv.includes('FAIL (CÓ SAI LỆCH CẦN RÀ SOÁT)'));
  assert.ok(!csv.includes('100% ĐẠT CHUẨN KỸ THUẬT'));
});

test('P1-OPS-01: Offsetting quiz corruption between two users (sums equal) is detected at user-level and fails overall', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  // User 1 has 2 actual completed attempts, User 2 has 1 actual completed attempt (Total = 3)
  // Corrupt to: User 1 has 1, User 2 has 2 (Total = 3, global sum matches!)
  env.rawDb.exec("UPDATE quiz_user_stats SET completed_attempts = 1 WHERE user_id = 'u1';");
  env.rawDb.exec("UPDATE quiz_user_stats SET completed_attempts = 2 WHERE user_id = 'u2';");

  const res = await service.getOperationsReadiness();
  // Global sum matches 3 == 3!
  assert.equal(res.invariants.quizCompletedMatchesStats, true, 'Global sum matches due to offsetting error');
  // But user-level discrepancy is detected!
  assert.equal(res.invariants.quizUserDiscrepancyCount, 2, 'Must detect 2 user discrepancies');
  assert.equal(res.invariants.quizIntegrityPassed, false);
  assert.equal(res.invariants.overallIntegrity, false, 'overallIntegrity MUST be false when user discrepancy exists');
  assert.equal(res.invariants.overallStatus, 'FAIL');
});

test('P1-OPS-01: Offsetting reward counter corruption between two users is detected and fails overall', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  // Actual: u1 = 2, u2 = 1. Total = 3.
  // Corrupt: u1 = 3, u2 = 0. Total = 3.
  env.rawDb.exec("UPDATE reward_user_campaign_spins SET completed_spins = 3 WHERE user_id = 'u1';");
  env.rawDb.exec("UPDATE reward_user_campaign_spins SET completed_spins = 0 WHERE user_id = 'u2';");

  const res = await service.getOperationsReadiness();
  assert.equal(res.invariants.rewardSpinsMatchesUserCounters, true, 'Global sum matches');
  assert.equal(res.invariants.rewardUserDiscrepancyCount, 2, 'Must detect 2 discrepancies');
  assert.equal(res.invariants.rewardIntegrityPassed, false);
  assert.equal(res.invariants.overallIntegrity, false);
  assert.equal(res.invariants.overallStatus, 'FAIL');
});

test('P1-OPS-01: Oversold template, oversold segment, and ghost voucher each independently trigger FAIL', async () => {
  // Case A: Oversold template
  const envA = createOpsTestEnv();
  const srvA = new AdminService(envA);
  envA.rawDb.exec("INSERT INTO reward_voucher_templates (id, code_prefix, title, discount_display, description, terms_conditions, total_stock, issued_count) VALUES ('tpl-bad', 'BAD', 'Bad', '10%', 'd', 't', 5, 10);");
  const resA = await srvA.getOperationsReadiness();
  assert.equal(resA.invariants.zeroOversoldTemplates, false);
  assert.equal(resA.invariants.overallIntegrity, false);

  // Case B: Oversold segment
  const envB = createOpsTestEnv();
  const srvB = new AdminService(envB);
  envB.rawDb.exec("PRAGMA ignore_check_constraints = ON;");
  envB.rawDb.exec("INSERT INTO reward_spin_segments (id, wheel_id, order_index, label, segment_type, weight, total_inventory, awarded_count) VALUES ('seg-bad', 'w1', 99, 'Bad Seg', 'no_win', 10, 2, 5);");
  const resB = await srvB.getOperationsReadiness();
  assert.equal(resB.invariants.zeroOversoldSegments, false);
  assert.equal(resB.invariants.overallIntegrity, false);

  // Case C: Ghost voucher spin (result_type = 'voucher' but voucher_id is NULL)
  const envC = createOpsTestEnv();
  const srvC = new AdminService(envC);
  envC.rawDb.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, voucher_id, result_snapshot_json, status) VALUES ('spin-ghost', 'u1', 'w1', 'seg-1', 'voucher', NULL, '{}', 'completed');");
  const resC = await srvC.getOperationsReadiness();
  assert.equal(resC.invariants.zeroGhostVoucherSpins, false);
  assert.equal(resC.invariants.overallIntegrity, false);
});

// =============================================================================
// P2-OPS-02: MIGRATION METADATA VERIFICATION TESTS
// =============================================================================
test('P2-OPS-02: SQLite in-memory without d1_migrations table reports UNKNOWN with null count', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  // Baseline in-memory does not create d1_migrations table
  const res = await service.getOperationsReadiness();
  assert.equal(res.system.migrationVerificationStatus, 'UNKNOWN');
  assert.equal(res.system.verifiedAppliedMigrationsCount, null);
  assert.equal(res.system.expectedMigrationsCount, EXPECTED_MIGRATIONS.length);
  assert.ok(res.system.migrationDiscrepancyReason.includes('d1_migrations'));
});

test('P2-OPS-02: d1_migrations table with all 15 migrations applied reports VERIFIED', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  // Create and populate d1_migrations with all 15 expected migrations
  env.rawDb.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);");
  for (let i = 0; i < EXPECTED_MIGRATIONS.length; i++) {
    env.rawDb.prepare("INSERT INTO d1_migrations (id, name, applied_at) VALUES (?, ?, datetime('now'))")
      .run(i + 1, EXPECTED_MIGRATIONS[i]);
  }

  const res = await service.getOperationsReadiness();
  assert.equal(res.system.migrationVerificationStatus, 'VERIFIED');
  assert.equal(res.system.verifiedAppliedMigrationsCount, 15);
  assert.equal(res.system.expectedMigrationsCount, 15);
  assert.equal(res.system.migrationDiscrepancyReason, null);
});

test('P2-OPS-02: d1_migrations missing 0015 reports INCOMPLETE with discrepancy reason', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  // Populate only 14 migrations (missing 0015)
  env.rawDb.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);");
  for (let i = 0; i < EXPECTED_MIGRATIONS.length - 1; i++) {
    env.rawDb.prepare("INSERT INTO d1_migrations (id, name, applied_at) VALUES (?, ?, datetime('now'))")
      .run(i + 1, EXPECTED_MIGRATIONS[i]);
  }

  const res = await service.getOperationsReadiness();
  assert.equal(res.system.migrationVerificationStatus, 'INCOMPLETE');
  assert.equal(res.system.verifiedAppliedMigrationsCount, 14);
  assert.ok(res.system.migrationDiscrepancyReason.includes('0015_rewards_time_quota_hardening.sql'));
});

test('P2-OPS-02: d1_migrations with 15 rows but mismatched name reports INCOMPLETE', async () => {
  const env = createOpsTestEnv();
  const service = new AdminService(env);

  env.rawDb.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at TEXT);");
  for (let i = 0; i < EXPECTED_MIGRATIONS.length; i++) {
    const name = i === 14 ? '0015_wrong_name.sql' : EXPECTED_MIGRATIONS[i];
    env.rawDb.prepare("INSERT INTO d1_migrations (id, name, applied_at) VALUES (?, ?, datetime('now'))")
      .run(i + 1, name);
  }

  const res = await service.getOperationsReadiness();
  assert.equal(res.system.migrationVerificationStatus, 'INCOMPLETE');
  assert.equal(res.system.verifiedAppliedMigrationsCount, 15);
  assert.ok(res.system.migrationDiscrepancyReason.includes('0015_wrong_name.sql'));
});
