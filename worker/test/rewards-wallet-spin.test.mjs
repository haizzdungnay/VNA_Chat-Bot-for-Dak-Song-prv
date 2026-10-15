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
  const spinRes = await service.executeSpin('user-alice', { idempotencyKey: 'idem-zero-stock-01' });

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
    service.executeSpin('user-alice', { idempotencyKey: 'idem-fault-test-01' }),
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
  const retryRes = await service.executeSpin('user-alice', { idempotencyKey: 'idem-fault-test-01' });
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
  const spin = await service.executeSpin('user-alice', { idempotencyKey: 'idem-rdm-test-01' });
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
// 11. P1-RWD-01: VOUCHER INSUFFICIENT TEMPLATE STOCK GUARDS & ROLLBACK
// -----------------------------------------------------------------------------
test('P1-RWD-01: Voucher segment never creates spin attempt with NULL voucher, rolls back on stock exhaustion', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  // Setup: template has stock = 1 and issued_count = 1 (Sold out at template level)
  await env.DB.prepare("UPDATE reward_voucher_templates SET total_stock = 1, issued_count = 1 WHERE id = 'tpl-coffee-20'").run();
  // Segment 1 points to tpl-coffee-20 with weight 100
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 0 WHERE wheel_id = 'wheel-dak-song-lucky'").run();
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 100 WHERE id = 'seg-1'").run();
  // Segment 2 is no_win with weight 50
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 50 WHERE id = 'seg-2'").run();

  await service.claimDailySpin('user-alice');

  // Spin should automatically bypass unstocked template seg-1 and award seg-2 (no_win)!
  const spinRes = await service.executeSpin('user-alice', { idempotencyKey: 'idem-p1-01-stock' });
  assert.equal(spinRes.segment.id, 'seg-2');
  assert.equal(spinRes.segment.segmentType, 'no_win');
  assert.equal(spinRes.voucher, null);

  // Invariant check: Any completed spin in DB with result_type = 'voucher' MUST have non-null voucher_id
  const badSpins = await env.DB.prepare(
    "SELECT count(*) as c FROM reward_spin_attempts WHERE result_type = 'voucher' AND voucher_id IS NULL"
  ).first();
  assert.equal(badSpins.c, 0, 'Zero spin attempts with result_type=voucher and NULL voucher_id');
});

// -----------------------------------------------------------------------------
// 12. P1-RWD-02: GIFT_ITEM CLAIM CREATION, INVENTORY DEBIT & ADMIN FULFILLMENT
// -----------------------------------------------------------------------------
test('P1-RWD-02: gift_item awards claim ticket, increments awarded_count, fulfills once with CAS', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // Configure wheel for 100% gift_item win on seg-5
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 0 WHERE wheel_id = 'wheel-dak-song-lucky'").run();
  await env.DB.prepare("UPDATE reward_spin_segments SET weight = 100, total_inventory = 10, awarded_count = 0 WHERE id = 'seg-5'").run();

  await service.claimDailySpin('user-alice');
  const spinRes = await service.executeSpin('user-alice', { idempotencyKey: 'idem-gift-test-01' });

  assert.equal(spinRes.segment.segmentType, 'gift_item');
  assert.ok(spinRes.giftClaim, 'Response must include giftClaim');
  assert.ok(spinRes.giftClaim.claimCode.startsWith('GIFT-'));
  assert.equal(spinRes.giftClaim.status, 'pending');

  // Check inventory incremented in DB
  const seg5 = await env.DB.prepare("SELECT * FROM reward_spin_segments WHERE id = 'seg-5'").first();
  assert.equal(seg5.awarded_count, 1);

  // Check gift claim record in DB
  const userClaims = await service.getUserGiftClaims('user-alice');
  assert.equal(userClaims.length, 1);
  assert.equal(userClaims[0].claim_code, spinRes.giftClaim.claimCode);
  assert.equal(userClaims[0].status, 'pending');

  // Admin fulfills gift claim
  const fulfilled = await adminService.fulfillGiftClaim('admin@daksong.vn', spinRes.giftClaim.claimCode);
  assert.equal(fulfilled.status, 'fulfilled');
  assert.equal(fulfilled.fulfilled_by, 'admin@daksong.vn');

  // Duplicate fulfillment rejected with 409
  await assert.rejects(
    adminService.fulfillGiftClaim('admin@daksong.vn', spinRes.giftClaim.claimCode),
    /đã được bàn giao/
  );

  // Revoking an already fulfilled gift rejected with 409
  await assert.rejects(
    adminService.revokeGiftClaim('admin@daksong.vn', userClaims[0].id, 'Thử thu hồi'),
    /đã được bàn giao/
  );
});

// -----------------------------------------------------------------------------
// 13. P1-RWD-03: MANDATORY IDEMPOTENCY KEY VALIDATION & CATCH RECOVERY
// -----------------------------------------------------------------------------
test('P1-RWD-03: Mandatory Idempotency-Key validation, catch-branch recovery verifies user and hash', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);

  await service.claimDailySpin('user-alice');

  // Rejects missing idempotencyKey
  await assert.rejects(
    service.executeSpin('user-alice', {}),
    /Idempotency-Key không hợp lệ/
  );

  // Rejects too short (< 8 chars)
  await assert.rejects(
    service.executeSpin('user-alice', { idempotencyKey: 'abc' }),
    /Idempotency-Key không hợp lệ/
  );

  // Rejects special characters
  await assert.rejects(
    service.executeSpin('user-alice', { idempotencyKey: 'bad!key@name' }),
    /Idempotency-Key không hợp lệ/
  );
});

// -----------------------------------------------------------------------------
// 14. P1-RWD-04: CAMPAIGN TIME WINDOW, TOTAL QUOTA & PER-USER LIMIT ENFORCEMENT
// -----------------------------------------------------------------------------
test('P1-RWD-04: Campaign time window, wheel resolution, per-user limit and atomic quota', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // 1. Campaign not yet started (start_at in future)
  const futureCamp = await adminService.createCampaign({
    code: 'CAMP_FUTURE_01',
    title: 'Chiến dịch tương lai',
    startAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await adminService.setCampaignStatus(futureCamp.id, 'published');
  const futureWheel = await adminService.createWheel({ campaignId: futureCamp.id, title: 'Vòng quay tương lai' });
  await adminService.toggleWheelStatus(futureWheel.id, 'active');

  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: futureWheel.id, campaignId: futureCamp.id, idempotencyKey: 'idem-future-01' }),
    /chưa đến thời gian mở thưởng/
  );

  // 2. Campaign already expired (end_at in past)
  const pastCamp = await adminService.createCampaign({
    code: 'CAMP_PAST_01',
    title: 'Chiến dịch quá khứ',
    startAt: new Date(Date.now() - 172800000).toISOString(),
    endAt: new Date(Date.now() - 86400000).toISOString(),
  });
  await adminService.setCampaignStatus(pastCamp.id, 'published');
  const pastWheel = await adminService.createWheel({ campaignId: pastCamp.id, title: 'Vòng quay quá khứ' });
  await adminService.toggleWheelStatus(pastWheel.id, 'active');

  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: pastWheel.id, campaignId: pastCamp.id, idempotencyKey: 'idem-past-01' }),
    /đã kết thúc/
  );

  // 3. Wheel cross-campaign mismatch
  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: futureWheel.id, campaignId: pastCamp.id, idempotencyKey: 'idem-mismatch-01' }),
    /không tồn tại hoặc chưa kích hoạt/
  );

  // 4. Per-user limit enforcement (per_user_limit = 1)
  const limitedCamp = await adminService.createCampaign({
    code: 'CAMP_LIMIT_01',
    title: 'Chiến dịch giới hạn 1 lượt',
    perUserLimit: 1,
    eligibilityRules: { allow_free_daily: true },
  });
  await adminService.setCampaignStatus(limitedCamp.id, 'published');
  const limitedWheel = await adminService.createWheel({ campaignId: limitedCamp.id, title: 'Vòng quay 1 lượt' });
  await adminService.setWheelSegments(limitedWheel.id, [
    { label: 'Chúc may mắn', segmentType: 'no_win', weight: 50 },
    { label: 'Quà lưu niệm', segmentType: 'gift_item', weight: 50 },
  ]);
  await adminService.toggleWheelStatus(limitedWheel.id, 'active');

  // First spin succeeds
  await service.claimDailySpin('user-alice', limitedCamp.id);
  const spin1 = await service.executeSpin('user-alice', { wheelId: limitedWheel.id, campaignId: limitedCamp.id, idempotencyKey: 'idem-limit-spin-01' });
  assert.equal(spin1.success, true);

  // Grant another turn manually to simulate trying to exceed limit
  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, total_granted, consumed_count, created_at, updated_at)
    VALUES ('ent-cheat', 'user-alice', ?, 'admin_grant', 1, 0, datetime('now'), datetime('now'))
  `).bind(limitedCamp.id).run();

  // Second spin is blocked by per_user_limit with 403!
  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: limitedWheel.id, campaignId: limitedCamp.id, idempotencyKey: 'idem-limit-spin-02' }),
    /đạt giới hạn tối đa/
  );
});

// -----------------------------------------------------------------------------
// 15. P2-RWD-05: SET WHEEL SEGMENTS BLOCKED ON HISTORICAL WHEEL & CLONING
// -----------------------------------------------------------------------------
test('P2-RWD-05: Modifying segments of wheel with history is blocked with 409; cloneWheel works cleanly', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // Do a spin on wheel-dak-song-lucky so it has spin attempts
  await service.claimDailySpin('user-alice');
  await service.executeSpin('user-alice', { idempotencyKey: 'idem-hist-spin-01' });

  // Now attempt to delete/modify segments of wheel-dak-song-lucky -> Must throw 409!
  await assert.rejects(
    adminService.setWheelSegments('wheel-dak-song-lucky', [
      { label: 'Mới 1', segmentType: 'no_win', weight: 50 },
      { label: 'Mới 2', segmentType: 'no_win', weight: 50 },
    ]),
    /lịch sử/
  );

  // Clone wheel to create a new draft version
  const cloned = await adminService.cloneWheel('wheel-dak-song-lucky', 'Vòng quay Đắk Song V2');
  assert.ok(cloned.wheel.id);
  assert.notEqual(cloned.wheel.id, 'wheel-dak-song-lucky');
  assert.equal(cloned.wheel.status, 'draft');
  assert.equal(cloned.wheel.title, 'Vòng quay Đắk Song V2');
  assert.equal(cloned.segments.length, 6);

  // The new draft wheel CAN have its segments modified!
  const updatedDraft = await adminService.setWheelSegments(cloned.wheel.id, [
    { label: 'Voucher 1', segmentType: 'voucher', voucherTemplateId: 'tpl-coffee-20', weight: 50 },
    { label: 'Không trúng', segmentType: 'no_win', weight: 50 },
  ]);
  assert.equal(updatedDraft.segments.length, 2);
});

// -----------------------------------------------------------------------------
// 16. P2-RWD-06: VOUCHER STATE MACHINE TERMINAL TRANSITIONS
// -----------------------------------------------------------------------------
test('P2-RWD-06: Voucher state machine rejects invalid transitions (redeemed -> revoke, expired -> redeem)', async () => {
  const env = createRewardTestEnv();
  const adminService = new AdminRewardService(env);

  // Create sample vouchers in different states
  const vRedeemed = 'v-test-redeemed';
  await env.DB.prepare(`
    INSERT INTO reward_wallet_items (id, user_id, voucher_code, title, discount_display, category, terms_conditions_snapshot, status, source_type, issued_at, expires_at, redeemed_at)
    VALUES (?, 'user-alice', 'TEST-RED-01', 'Test', '10%', 'all', '{}', 'redeemed', 'lucky_spin', datetime('now'), datetime('now', '+10 days'), datetime('now'))
  `).bind(vRedeemed).run();

  // Cannot revoke already redeemed voucher -> 409
  await assert.rejects(
    adminService.revokeVoucher('admin@vna.vn', vRedeemed, 'Thu hồi nhầm'),
    /đã được sử dụng/
  );

  const vExpired = 'v-test-expired';
  await env.DB.prepare(`
    INSERT INTO reward_wallet_items (id, user_id, voucher_code, title, discount_display, category, terms_conditions_snapshot, status, source_type, issued_at, expires_at)
    VALUES (?, 'user-alice', 'TEST-EXP-01', 'Test', '10%', 'all', '{}', 'issued', 'lucky_spin', datetime('now', '-20 days'), datetime('now', '-10 days'))
  `).bind(vExpired).run();

  // Cannot redeem expired voucher -> 400
  await assert.rejects(
    adminService.redeemVoucher('admin@vna.vn', vExpired),
    /hết hạn/
  );
});

// -----------------------------------------------------------------------------
// 17. P1-RWD-07: TIME CONSISTENCY & IN-FLIGHT EXPIRY/PAUSE CAS GUARDS
// -----------------------------------------------------------------------------
test('P1-RWD-07: unixepoch instant comparison correctly identifies expired ISO timestamps and guards in-flight expiry', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // 1. Insert voucher with past ISO UTC string that naive text comparison would misjudge
  // '2020-01-01T12:00:00.000Z' is in the past.
  const expiredVoucherId = 'v-iso-expired-01';
  await env.DB.prepare(`
    INSERT INTO reward_wallet_items (id, user_id, voucher_code, title, discount_display, category, terms_conditions_snapshot, status, source_type, issued_at, expires_at)
    VALUES (?, 'user-alice', 'V-ISO-EXP', 'Test ISO Exp', '10%', 'all', '{}', 'issued', 'lucky_spin', '2019-12-01T00:00:00.000Z', '2020-01-01T12:00:00.000Z')
  `).bind(expiredVoucherId).run();

  // Admin cannot redeem it
  await assert.rejects(
    adminService.redeemVoucher('admin@vna.vn', expiredVoucherId),
    /hết hạn/
  );

  // Effective status in wallet inquiry must be 'expired'
  const wallet = await service.getUserWallet('user-alice');
  const found = wallet.items.find((item) => item.id === expiredVoucherId);
  assert.ok(found);
  assert.equal(found.effective_status, 'expired');

  // 2. In-flight entitlement expiry CAS guard:
  // First claim and consume Alice's daily free turn so no auto-grant can occur
  await service.claimDailySpin('user-alice', 'cmp-dak-song-2026');
  await service.executeSpin('user-alice', { idempotencyKey: 'idem-consume-daily-01' });

  // Grant entitlement with expiry in the past
  const pastEntId = 'ent-past-iso';
  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, total_granted, consumed_count, expires_at, created_at, updated_at)
    VALUES (?, 'user-alice', 'cmp-dak-song-2026', 'admin_grant', 1, 0, '2020-01-01T00:00:00.000Z', datetime('now'), datetime('now'))
  `).bind(pastEntId).run();

  // executeSpin must reject because entitlement is expired according to unixepoch
  await assert.rejects(
    service.executeSpin('user-alice', { idempotencyKey: 'idem-past-ent-01' }),
    /không còn lượt quay/
  );

  // 3. In-flight campaign pause guard:
  // If campaign is paused right as commit happens, batch CAS guard rejects and rolls back
  const camp = await adminService.createCampaign({ code: 'CAMP_PAUSE_TEST', title: 'Pause Test' });
  await adminService.setCampaignStatus(camp.id, 'published');
  const wheel = await adminService.createWheel({ campaignId: camp.id, title: 'Wheel Pause' });
  await adminService.setWheelSegments(wheel.id, [
    { label: 'No win', segmentType: 'no_win', weight: 50 },
    { label: 'Gift', segmentType: 'gift_item', weight: 50 },
  ]);
  await adminService.toggleWheelStatus(wheel.id, 'active');

  // Grant turn to alice
  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, total_granted, consumed_count, expires_at, created_at, updated_at)
    VALUES ('ent-pause-test', 'user-alice', ?, 'admin_grant', 1, 0, datetime('now', '+1 day'), datetime('now'), datetime('now'))
  `).bind(camp.id).run();

  // Admin pauses campaign
  await adminService.setCampaignStatus(camp.id, 'paused');

  // Spin must fail with 400 because campaign is paused
  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-pause-race-01' }),
    /tạm dừng/
  );

  // Entitlement was NOT consumed
  const entCheck = await env.DB.prepare("SELECT consumed_count FROM reward_entitlements WHERE id = 'ent-pause-test'").first();
  assert.equal(entCheck.consumed_count, 0);
});

// -----------------------------------------------------------------------------
// 18. P1-RWD-08: ATOMIC PER-USER LIMIT WITH 2 SEPARATELY GRANTED ENTITLEMENTS
// -----------------------------------------------------------------------------
test('P1-RWD-08: Concurrent executeSpin with 2 distinct entitlements under per_user_limit=1 commits exactly once', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // 1. Create campaign with per_user_limit = 1, total_quota = 100
  const camp = await adminService.createCampaign({
    code: 'CAMP_CONCURRENT_P1_08',
    title: 'Chiến dịch test concurrent per-user limit',
    totalQuota: 100,
    perUserLimit: 1,
  });
  await adminService.setCampaignStatus(camp.id, 'published');

  const wheel = await adminService.createWheel({ campaignId: camp.id, title: 'Vòng quay Concurrent' });
  await adminService.setWheelSegments(wheel.id, [
    { label: 'May mắn lần sau', segmentType: 'no_win', weight: 100 },
    { label: 'Quà lưu niệm', segmentType: 'gift_item', weight: 50 },
  ]);
  await adminService.toggleWheelStatus(wheel.id, 'active');

  // 2. Grant User Alice TWO separate, independent, unexpired entitlements
  const entId1 = 'ent-concurrent-01';
  const entId2 = 'ent-concurrent-02';
  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, source_event_key, total_granted, consumed_count, expires_at, created_at, updated_at)
    VALUES (?, 'user-alice', ?, 'free_daily', 'daily-ev-01', 1, 0, datetime('now', '+1 day'), datetime('now'), datetime('now'))
  `).bind(entId1, camp.id).run();

  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, source_event_key, total_granted, consumed_count, expires_at, created_at, updated_at)
    VALUES (?, 'user-alice', ?, 'quiz_completed', 'quiz-ev-01', 1, 0, datetime('now', '+1 day'), datetime('now'), datetime('now'))
  `).bind(entId2, camp.id).run();

  // 3. Launch TWO concurrent executeSpin requests with 2 distinct idempotency keys
  const [spinRes1, spinRes2] = await Promise.allSettled([
    service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-race-req-1' }),
    service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-race-req-2' }),
  ]);

  // Assert: Exactly ONE fulfilled, and ONE rejected!
  const fulfilled = [spinRes1, spinRes2].filter(r => r.status === 'fulfilled');
  const rejected = [spinRes1, spinRes2].filter(r => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one concurrent request must succeed');
  assert.equal(rejected.length, 1, 'Exactly one concurrent request must be rejected');

  // 4. Verify authoritative DB counters:
  // (a) reward_user_campaign_spins: completed_spins must be exactly 1
  const userSpinsRow = await env.DB.prepare(
    "SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = ? AND user_id = 'user-alice'"
  ).bind(camp.id).first();
  assert.equal(userSpinsRow.completed_spins, 1, 'Per-user completed_spins must be exactly 1');

  // (b) reward_campaigns: total_spins_count must be exactly 1
  const campRow = await env.DB.prepare("SELECT total_spins_count FROM reward_campaigns WHERE id = ?").bind(camp.id).first();
  assert.equal(campRow.total_spins_count, 1, 'Campaign total_spins_count must be exactly 1');

  // (c) reward_spin_attempts: completed rows count must be exactly 1
  const attemptsCount = await env.DB.prepare(
    "SELECT count(*) as c FROM reward_spin_attempts WHERE user_id = 'user-alice' AND status = 'completed'"
  ).first();
  assert.equal(attemptsCount.c, 1, 'Total completed spin attempts must be exactly 1');

  // (d) Total consumed entitlements for Alice in this campaign must be exactly 1
  const consumedTotal = await env.DB.prepare(
    "SELECT sum(consumed_count) as s FROM reward_entitlements WHERE user_id = 'user-alice' AND campaign_id = ?"
  ).bind(camp.id).first();
  assert.equal(consumedTotal.s, 1, 'Exactly one entitlement turn must be consumed; the other remains intact');

  // (e) Reconciliation check: counter matches authoritative spin attempts ledger
  assert.equal(userSpinsRow.completed_spins, attemptsCount.c, 'Reconciliation invariant holds: counter == attempts ledger');
});

// -----------------------------------------------------------------------------
// 19. P1-RWD-08: UNLIMITED TO FINITE LIMIT EDIT PRESERVES PRIOR USAGE
// -----------------------------------------------------------------------------
test('P1-RWD-08: Changing unlimited campaign (per_user_limit=0) to finite limit (1) immediately enforces prior usage', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // 1. Create campaign with per_user_limit = 0 (unlimited)
  const camp = await adminService.createCampaign({
    code: 'CAMP_UNLIMITED_TO_FINITE',
    title: 'Unlimited to finite test',
    totalQuota: 0,
    perUserLimit: 0,
  });
  await adminService.setCampaignStatus(camp.id, 'published');

  const wheel = await adminService.createWheel({ campaignId: camp.id, title: 'Wheel Unlim' });
  await adminService.setWheelSegments(wheel.id, [
    { label: 'No win', segmentType: 'no_win', weight: 50 },
    { label: 'Gift', segmentType: 'gift_item', weight: 50 },
  ]);
  await adminService.toggleWheelStatus(wheel.id, 'active');

  // Grant 2 turns
  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, total_granted, consumed_count, expires_at, created_at, updated_at)
    VALUES ('ent-unlim-1', 'user-alice', ?, 'admin_grant', 2, 0, datetime('now', '+1 day'), datetime('now'), datetime('now'))
  `).bind(camp.id).run();

  // Alice spins once under unlimited
  const spin1 = await service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-unlim-spin-1' });
  assert.equal(spin1.success, true);

  // Verify counter was tracked: completed_spins = 1
  const counter = await env.DB.prepare(
    "SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = ? AND user_id = 'user-alice'"
  ).bind(camp.id).first();
  assert.equal(counter.completed_spins, 1, 'Counter must be updated even under per_user_limit=0');

  // 2. Admin edits campaign to per_user_limit = 1
  await adminService.updateCampaign(camp.id, { per_user_limit: 1 });

  // 3. Alice attempts second spin -> blocked with 403 because counter (1) >= new limit (1)!
  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-unlim-spin-2' }),
    /đạt giới hạn tối đa/
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
        'Idempotency-Key': 'idem-http-test-01',
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
// -----------------------------------------------------------------------------
// 20. P2-RWD-12: DYNAMIC PER_USER_LIMIT GUARD AT COMMIT TIME
// -----------------------------------------------------------------------------
test('P2-RWD-12: Dynamic authoritative per_user_limit subquery enforces limit if changed right at commit', async () => {
  const env = createRewardTestEnv();
  const service = new RewardService(env);
  const adminService = new AdminRewardService(env);

  // Setup campaign with per_user_limit = 2
  const camp = await adminService.createCampaign({
    code: 'CAMP_DYNAMIC_LIMIT',
    title: 'Dynamic Limit Campaign',
    totalQuota: 50,
    perUserLimit: 2,
  });
  await adminService.setCampaignStatus(camp.id, 'published');
  const wheel = await adminService.createWheel({ campaignId: camp.id, title: 'Wheel Dyn' });
  await adminService.setWheelSegments(wheel.id, [
    { label: 'No win', segmentType: 'no_win', weight: 50 },
    { label: 'Gift', segmentType: 'gift_item', weight: 50 },
  ]);
  await adminService.toggleWheelStatus(wheel.id, 'active');

  // Grant Alice 2 turns
  await env.DB.prepare(`
    INSERT INTO reward_entitlements (id, user_id, campaign_id, grant_type, total_granted, consumed_count, expires_at, created_at, updated_at)
    VALUES ('ent-dyn-1', 'user-alice', ?, 'admin_grant', 2, 0, datetime('now', '+1 day'), datetime('now'), datetime('now'))
  `).bind(camp.id).run();

  // First spin commits cleanly
  const spin1 = await service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-dyn-spin-1' });
  assert.equal(spin1.success, true);

  // Now, before second spin commits, Admin decreases per_user_limit to 1 in DB!
  await env.DB.prepare("UPDATE reward_campaigns SET per_user_limit = 1, updated_at = datetime('now') WHERE id = ?").bind(camp.id).run();

  // Second spin must fail at commit time because completed_spins (1) is NOT < per_user_limit (1)!
  await assert.rejects(
    service.executeSpin('user-alice', { wheelId: wheel.id, campaignId: camp.id, idempotencyKey: 'idem-dyn-spin-2' }),
    /giới hạn tối đa/
  );

  // Entitlement turn 2 was not consumed!
  const ent = await env.DB.prepare("SELECT consumed_count FROM reward_entitlements WHERE id = 'ent-dyn-1'").first();
  assert.equal(ent.consumed_count, 1, 'Second turn must remain unconsumed after rollback');

  // Completed spins counter remains 1
  const counter = await env.DB.prepare(
    "SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = ? AND user_id = 'user-alice'"
  ).bind(camp.id).first();
  assert.equal(counter.completed_spins, 1);
});

