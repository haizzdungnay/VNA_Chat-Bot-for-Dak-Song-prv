import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { RewardService } from '../src/services/reward.service.ts';
import { AdminRewardService } from '../src/services/admin-reward.service.ts';
import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createRewardTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  const migrationFiles = fs.readdirSync(path.join(REPO_ROOT, 'worker/migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations', file), 'utf8');
    db.exec(sql);
  }

  // Seed test users
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-alice', 'alice@example.com', 'Alice Dang', 'active');");
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-bob', 'bob@example.com', 'Bob Tran', 'active');");

  // Auth sessions
  db.exec("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-alice', 'user-alice', '676a5ea41393fe0ca5a5d3f81601a3fd918667a013e6bca865baeddae6f271dd', datetime('now', '+1 day'));");
  db.exec("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES ('sess-bob', 'user-bob', 'hash-bob-token', datetime('now', '+1 day'));");

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
    _runSync() {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return { meta: { changes: info.changes, last_row_id: info.lastInsertRowid } };
    },
  });

  let batchLock = Promise.resolve();

  return {
    DB: {
      prepare(sql) {
        return makeStmt(sql);
      },
      async batch(statements) {
        const runBatch = () => {
          db.exec('BEGIN IMMEDIATE');
          try {
            const results = [];
            for (const s of statements) {
              results.push(s._runSync ? s._runSync() : { meta: { changes: 1 } });
            }
            db.exec('COMMIT');
            return results;
          } catch (err) {
            try { db.exec('ROLLBACK'); } catch {}
            throw err;
          }
        };

        const prev = batchLock;
        let resolveLock;
        batchLock = new Promise((resolve) => {
          resolveLock = resolve;
        });

        await prev;
        try {
          return runBatch();
        } finally {
          resolveLock();
        }
      },
    },
    ADMIN_DEV_MOCK_AUTH: 'true',
    ENVIRONMENT: 'development',
    CORS_ALLOW_ORIGIN: '*',
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// 1. ADMIN CAMPAIGN & VOUCHER TEMPLATE CRUD
// -----------------------------------------------------------------------------
test('Admin Reward: Creates campaign, validates status transition, and manages templates', async () => {
  const env = createRewardTestEnv();
  const adminService = new AdminRewardService(env);

  // 1. Create campaign
  const campaign = await adminService.createCampaign({
    code: 'TEST_CAMP_01',
    title: 'Chiến dịch Test 01',
    description: 'Mô tả thử nghiệm',
    campaignType: 'lucky_spin',
    totalQuota: 500,
    perUserLimit: 3,
    eligibilityRules: { allow_free_daily: true, quiz_reward_min_score: 20 },
  });

  assert.ok(campaign.id);
  assert.equal(campaign.code, 'TEST_CAMP_01');
  assert.equal(campaign.status, 'draft');

  // 2. Publish campaign
  const published = await adminService.setCampaignStatus(campaign.id, 'published');
  assert.equal(published.status, 'published');

  // 3. Create voucher template linked to campaign
  const template = await adminService.createTemplate({
    campaignId: campaign.id,
    codePrefix: 'TEST-VOUCH',
    title: 'Voucher 50K Ẩm thực (DEMO)',
    discountDisplay: 'Giảm 50K',
    discountType: 'fixed_amount',
    discountValue: 50000,
    minOrderValue: 200000,
    category: 'food',
    description: 'Áp dụng cho ẩm thực',
    termsConditions: 'Điều khoản thử nghiệm',
    validityDays: 14,
    totalStock: 50,
  });

  assert.ok(template.id);
  assert.equal(template.code_prefix, 'TEST-VOUCH');
  assert.equal(template.issued_count, 0);

  // 4. List templates
  const list = await adminService.listTemplates(campaign.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, template.id);
});

// -----------------------------------------------------------------------------
// 2. WHEEL & SEGMENTS CONFIGURATION
// -----------------------------------------------------------------------------
test('Admin Reward: Configures wheel segments, enforces no_win and minimum 2 segments', async () => {
  const env = createRewardTestEnv();
  const adminService = new AdminRewardService(env);

  const wheel = await adminService.createWheel({
    campaignId: 'cmp-dak-song-2026',
    title: 'Vòng quay thử nghiệm',
  });

  // Rejects if less than 2 segments
  await assert.rejects(
    adminService.setWheelSegments(wheel.id, [{ label: 'Giải nhất', segmentType: 'voucher', weight: 10 }]),
    /tối thiểu 2 ô thưởng/
  );

  // Rejects if no no_win segment
  await assert.rejects(
    adminService.setWheelSegments(wheel.id, [
      { label: 'Giải nhất', segmentType: 'voucher', weight: 10 },
      { label: 'Giải nhì', segmentType: 'voucher', weight: 20 },
    ]),
    /no_win/
  );

  // Rejects if total weight <= 0
  await assert.rejects(
    adminService.setWheelSegments(wheel.id, [
      { label: 'Chúc may mắn', segmentType: 'no_win', weight: 0 },
      { label: 'Giải nhì', segmentType: 'voucher', weight: 0 },
    ]),
    /lớn hơn 0/
  );

  // Valid configuration
  const config = await adminService.setWheelSegments(wheel.id, [
    { label: 'Cà phê Giảm 20%', segmentType: 'voucher', voucherTemplateId: 'tpl-coffee-20', weight: 30 },
    { label: 'Chúc may mắn lần sau', segmentType: 'no_win', weight: 70 },
  ]);

  assert.equal(config.segments.length, 2);
  assert.equal(config.wheel.version, 2);
});

// -----------------------------------------------------------------------------
// 3. DAILY FREE SPIN ELIGIBILITY & IDEMPOTENCY
// -----------------------------------------------------------------------------
test('Reward Engine: Daily free spin claiming enforces exactly 1 entitlement per day', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  // Check initial eligibility
  const eligBefore = await service.getUserSpinEligibility('user-alice', 'cmp-dak-song-2026');
  assert.equal(eligBefore.canSpin, true);
  assert.equal(eligBefore.availableTurns, 0);
  assert.equal(eligBefore.dailyFreeEligible, true);

  // Claim daily free spin
  const claim1 = await service.claimDailySpin('user-alice', 'cmp-dak-song-2026');
  assert.equal(claim1.success, true);
  assert.equal(claim1.availableTurns, 1);

  // Idempotent duplicate claim on same day
  const claim2 = await service.claimDailySpin('user-alice', 'cmp-dak-song-2026');
  assert.equal(claim2.success, true);
  assert.equal(claim2.entitlementId, claim1.entitlementId, 'Must return same entitlement ID');
  assert.equal(claim2.availableTurns, 1, 'Must not duplicate turn');

  // Verify DB rows: exactly 1 entitlement
  const count = await env.DB.prepare(
    "SELECT count(*) as c FROM reward_entitlements WHERE user_id = 'user-alice' AND grant_type = 'free_daily'"
  ).first();
  assert.equal(count.c, 1);
});

// -----------------------------------------------------------------------------
// 4. QUIZ REWARD ELIGIBILITY & REJECTION OF IN_PROGRESS / FORGED SCORES
// -----------------------------------------------------------------------------
test('Reward Engine: Quiz reward claim validates authoritative completed status and score', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  // Attempt 1: in_progress attempt
  await env.DB.prepare(`
    INSERT INTO quiz_attempts (id, user_id, attempt_type, total_questions, score, max_score, status, started_at, created_at, updated_at)
    VALUES ('att-in-prog', 'user-alice', 'practice', 5, 20, 50, 'in_progress', datetime('now'), datetime('now'), datetime('now'))
  `).run();

  await assert.rejects(
    service.claimQuizReward('user-alice', 'att-in-prog'),
    /chưa kết thúc/
  );

  // Attempt 2: Belongs to user-bob, alice tries to claim
  await env.DB.prepare(`
    INSERT INTO quiz_attempts (id, user_id, attempt_type, total_questions, score, max_score, status, completed_at, started_at, created_at, updated_at)
    VALUES ('att-bob', 'user-bob', 'practice', 5, 50, 50, 'completed', datetime('now'), datetime('now'), datetime('now'), datetime('now'))
  `).run();

  await assert.rejects(
    service.claimQuizReward('user-alice', 'att-bob'),
    /Không có quyền/
  );

  // Attempt 3: Score < threshold (threshold is 20 in demo campaign seed)
  await env.DB.prepare(`
    INSERT INTO quiz_attempts (id, user_id, attempt_type, total_questions, score, max_score, status, completed_at, started_at, created_at, updated_at)
    VALUES ('att-low-score', 'user-alice', 'practice', 5, 10, 50, 'completed', datetime('now'), datetime('now'), datetime('now'), datetime('now'))
  `).run();

  await assert.rejects(
    service.claimQuizReward('user-alice', 'att-low-score'),
    /chưa đủ ngưỡng tối thiểu/
  );

  // Attempt 4: Valid completed attempt with 30 pts
  await env.DB.prepare(`
    INSERT INTO quiz_attempts (id, user_id, attempt_type, total_questions, score, max_score, status, completed_at, started_at, created_at, updated_at)
    VALUES ('att-valid', 'user-alice', 'practice', 5, 30, 50, 'completed', datetime('now'), datetime('now'), datetime('now'), datetime('now'))
  `).run();

  const claimRes = await service.claimQuizReward('user-alice', 'att-valid');
  assert.equal(claimRes.success, true);

  // Duplicate claim on same attempt is strictly idempotent
  const claimRes2 = await service.claimQuizReward('user-alice', 'att-valid');
  assert.equal(claimRes2.success, true);
  assert.equal(claimRes2.entitlementId, claimRes.entitlementId);

  // Verify user has 1 quiz entitlement
  const entCount = await env.DB.prepare(
    "SELECT count(*) as c FROM reward_entitlements WHERE user_id = 'user-alice' AND grant_type = 'quiz_completed'"
  ).first();
  assert.equal(entCount.c, 1);
});

// -----------------------------------------------------------------------------
// 5. ATOMIC SPIN EXECUTION, INVENTORY & WALLET ISSUANCE
// -----------------------------------------------------------------------------
test('Reward Engine: executeSpin consumes entitlement, issues voucher snapshot, updates stock', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  // Configure wheel with 100% voucher win for deterministic testing
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 0 WHERE wheel_id = 'wheel-dak-song-lucky'").run();
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 100 WHERE id = 'seg-1'").run();

  // Give Alice 1 turn
  await service.claimDailySpin('user-alice', 'cmp-dak-song-2026');

  // Spin with idempotency key
  const spinRes = await service.executeSpin('user-alice', {
    idempotencyKey: 'idem-spin-test-01',
  });

  assert.equal(spinRes.success, true);
  assert.equal(spinRes.segment.id, 'seg-1');
  assert.ok(spinRes.voucher);
  assert.ok(spinRes.voucher.code.startsWith('CF-DS20-'));

  // Verify entitlement consumed in DB
  const ent = await env.DB.prepare("SELECT * FROM reward_entitlements WHERE user_id = 'user-alice'").first();
  assert.equal(ent.consumed_count, 1);

  // Verify wallet item exists in DB
  const wallet = await service.getUserWallet('user-alice');
  assert.equal(wallet.total, 1);
  assert.equal(wallet.items[0].voucher_code, spinRes.voucher.code);
  assert.equal(wallet.items[0].status, 'issued');

  // Verify template stock incremented in DB
  const tpl = await env.DB.prepare("SELECT * FROM reward_voucher_templates WHERE id = 'tpl-coffee-20'").first();
  assert.equal(tpl.issued_count, 1);

  // Replay spin with same idempotency key returns identical result without consuming turn
  const replayRes = await service.executeSpin('user-alice', {
    idempotencyKey: 'idem-spin-test-01',
  });
  assert.equal(replayRes.spinAttemptId, spinRes.spinAttemptId);
  assert.equal(replayRes.voucher.code, spinRes.voucher.code);

  // Second spin without turns is rejected with 403
  await assert.rejects(
    service.executeSpin('user-alice', { idempotencyKey: 'idem-spin-test-02' }),
    /không còn lượt quay/
  );
});

// -----------------------------------------------------------------------------
// 6. IDEMPOTENCY CONFLICT & CROSS-USER ISOLATION
// -----------------------------------------------------------------------------
test('Reward Security: Idempotency conflict rejects payload changes and isolates users', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  // Alice spins with key-1
  await service.claimDailySpin('user-alice');
  await service.executeSpin('user-alice', { idempotencyKey: 'shared-key-1' });

  // Bob attempts to use Alice's idempotency key -> 403
  await service.claimDailySpin('user-bob');
  await assert.rejects(
    service.executeSpin('user-bob', { idempotencyKey: 'shared-key-1' }),
    /Không có quyền truy cập/
  );

  // Alice reuses key-1 with different payload -> 409 Conflict
  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: 'wheel-nonexistent', idempotencyKey: 'shared-key-1' }),
    /Trùng lặp Idempotency-Key/
  );
});

// -----------------------------------------------------------------------------
// 7. INVENTORY FINITE EXHAUSTION SAFETY
// -----------------------------------------------------------------------------
test('Reward Engine: Zero stock segment is bypassed and awards no_win safely', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  // Set voucher segment inventory to 1 and awarded_count to 1 (Sold out)
  await env.DB.prepare(`
    UPDATE reward_spin_segments
    SET weight = 0
    WHERE wheel_id = 'wheel-dak-song-lucky'
  `).run();

  await env.DB.prepare(`
    UPDATE reward_spin_segments
    SET total_inventory = 1, awarded_count = 1, weight = 50
    WHERE id = 'seg-1'
  `).run();

  // Set no_win weight to 50
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 50 WHERE id = 'seg-2'").run();

  // Alice spins
  await service.claimDailySpin('user-alice');
  const spinRes = await service.executeSpin('user-alice');

  // Must NOT award seg-1 because it is exhausted! Must award seg-2 (no_win)
  assert.equal(spinRes.segment.id, 'seg-2');
  assert.equal(spinRes.segment.segmentType, 'no_win');
  assert.equal(spinRes.voucher, null);

  // Stock of seg-1 must remain 1 (not negative)
  const seg1 = await env.DB.prepare("SELECT * FROM reward_spin_segments WHERE id = 'seg-1'").first();
  assert.equal(seg1.awarded_count, 1);
});

// -----------------------------------------------------------------------------
// 8. FAULT INJECTION & TRANSACTIONAL ROLLBACK
// -----------------------------------------------------------------------------
test('Reward Engine: Mid-batch failure triggers 100% rollback of entitlement and wallet', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  await service.claimDailySpin('user-alice');

  // Deliberately trigger mid-batch failure by corrupting optimistic guard constraint
  await env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (1)").run();

  // Execute spin: guard insert (changes()) will conflict with existing 1
  await assert.rejects(
    service.executeSpin('user-alice'),
    /UNIQUE/
  );

  // Clean corrupted guard
  await env.DB.prepare("DELETE FROM optimistic_lock_guard").run();

  // Assert rollback: entitlement was NOT consumed (consumed_count = 0)
  const ent = await env.DB.prepare("SELECT * FROM reward_entitlements WHERE user_id = 'user-alice'").first();
  assert.equal(ent.consumed_count, 0, 'Entitlement must remain unconsumed after rollback');

  // Assert rollback: zero wallet items created
  const walletCount = await env.DB.prepare("SELECT count(*) as c FROM reward_wallet_items WHERE user_id = 'user-alice'").first();
  assert.equal(walletCount.c, 0, 'No wallet items should exist after rollback');

  // Now retry cleanly: succeeds exactly once!
  const retryRes = await service.executeSpin('user-alice');
  assert.equal(retryRes.success, true);
  const entAfter = await env.DB.prepare("SELECT * FROM reward_entitlements WHERE user_id = 'user-alice'").first();
  assert.equal(entAfter.consumed_count, 1);
});

// -----------------------------------------------------------------------------
// 9. ADMIN REDEMPTION & SINGLE REDEEM ENFORCEMENT
// -----------------------------------------------------------------------------
test('Admin Reward: Exactly-once redemption, rejects duplicate and revoked vouchers', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // Give Alice voucher
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 0 WHERE wheel_id = 'wheel-dak-song-lucky'").run();
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 100 WHERE id = 'seg-1'").run();
  await service.claimDailySpin('user-alice');
  const spin = await service.executeSpin('user-alice');
  const voucherId = spin.voucher.id;

  // 1. First redemption by Admin
  const rdm = await adminService.redeemVoucher('admin@daksong.vn', voucherId, {
    reason: 'Đổi tại quán cà phê bản địa',
  });
  assert.equal(rdm.status, 'redeemed');
  assert.ok(rdm.redeemed_at);

  // Verify redemption record in DB
  const rdmRecord = await env.DB.prepare("SELECT * FROM reward_redemptions WHERE voucher_id = ?").bind(voucherId).first();
  assert.equal(rdmRecord.actor, 'admin@daksong.vn');

  // 2. Duplicate redemption rejected with 409
  await assert.rejects(
    adminService.redeemVoucher('admin@daksong.vn', voucherId),
    /đã được sử dụng/
  );

  // 3. Revoked voucher cannot be redeemed
  const vouch2 = 'vouch-revoked-001';
  await env.DB.prepare(`
    INSERT INTO reward_wallet_items (id, user_id, voucher_code, title, discount_display, category, terms_conditions_snapshot, status, source_type, issued_at, expires_at)
    VALUES (?, 'user-alice', 'TEST-REVOKED', 'Test', '10%', 'all', '{}', 'revoked', 'admin_grant', datetime('now'), datetime('now', '+10 days'))
  `).bind(vouch2).run();

  await assert.rejects(
    adminService.redeemVoucher('admin@daksong.vn', vouch2),
    /bị thu hồi/
  );
});

// -----------------------------------------------------------------------------
// 10. HTTP ROUTER E2E: TOURIST & ADMIN FLOW
// -----------------------------------------------------------------------------
test('HTTP Router E2E: Tourist spin, wallet inquiry, and admin analytics with CSV export', async () => {
  const env = createRewardTestEnv();

  // 1. GET /api/rewards/campaigns (Public)
  const cmpRes = await worker.fetch(new Request('http://localhost/api/rewards/campaigns'), env, {});
  assert.equal(cmpRes.status, 200);
  const cmpData = await cmpRes.json();
  assert.ok(cmpData.campaigns.length > 0);

  // 2. GET /api/rewards/wallet without token -> 401
  const unauthWallet = await worker.fetch(new Request('http://localhost/api/rewards/wallet'), env, {});
  assert.equal(unauthWallet.status, 401);

  // 3. POST /api/rewards/spins as Alice
  const spinHttpRes = await worker.fetch(
    new Request('http://localhost/api/rewards/spins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer alice-test-session-token-123456',
      },
      body: JSON.stringify({}),
    }),
    env,
    {}
  );
  assert.equal(spinHttpRes.status, 200);
  const spinData = await spinHttpRes.json();
  assert.equal(spinData.success, true);

  // 4. GET /api/rewards/wallet as Alice -> shows at least spin attempt history
  const walletRes = await worker.fetch(
    new Request('http://localhost/api/rewards/wallet', {
      headers: {
        'Authorization': 'Bearer alice-test-session-token-123456',
      },
    }),
    env,
    {}
  );
  assert.equal(walletRes.status, 200);

  // 5. GET /api/admin/rewards/analytics (Admin)
  const analyticsRes = await worker.fetch(
    new Request('http://localhost/api/admin/rewards/analytics', {
      headers: {
        'cf-access-authenticated-user-email': 'admin@vna.vn',
      },
    }),
    env,
    {}
  );
  assert.equal(analyticsRes.status, 200);
  const analyticsData = await analyticsRes.json();
  assert.ok(analyticsData.analytics.spins.totalSpins >= 1);

  // 6. GET /api/admin/rewards/export (CSV export with UTF-8 BOM)
  const adminService = new AdminRewardService(env);
  const directCsv = await adminService.exportVouchersCsv();
  assert.ok(directCsv.startsWith('\uFEFF'), 'Direct CSV string must start with UTF-8 BOM');

  const exportRes = await worker.fetch(
    new Request('http://localhost/api/admin/rewards/export', {
      headers: {
        'cf-access-authenticated-user-email': 'admin@vna.vn',
      },
    }),
    env,
    {}
  );
  assert.equal(exportRes.status, 200);
  assert.ok(exportRes.headers.get('Content-Type').includes('text/csv'));
  const csvBytes = new Uint8Array(await exportRes.arrayBuffer());
  assert.equal(csvBytes[0], 0xEF, 'First BOM byte must be 0xEF');
  assert.equal(csvBytes[1], 0xBB, 'Second BOM byte must be 0xBB');
  assert.equal(csvBytes[2], 0xBF, 'Third BOM byte must be 0xBF');
  const csvText = new TextDecoder('utf-8').decode(csvBytes);
  assert.ok(csvText.includes('BÁO CÁO MÃ ƯU ĐÃI & PHẦN THƯỞNG'));
});

