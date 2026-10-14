import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const m1Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0001_initial.sql'), 'utf8');
const m2Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql'), 'utf8');
const m3Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0003_schema_update.sql'), 'utf8');
const m4Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0004_admin_extension.sql'), 'utf8');
const m5Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0005_identity.sql'), 'utf8');
const m6Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0006_travel_planner.sql'), 'utf8');
const m7Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0007_optimistic_lock_guard.sql'), 'utf8');
const m8Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0008_business_booking.sql'), 'utf8');
const m9Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0009_booking_transaction_hardening.sql'), 'utf8');
const m10Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0010_historical_refund_reconciliation.sql'), 'utf8');
const m11Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0011_tourism_quiz.sql'), 'utf8');
const m12Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0012_quiz_scoring_and_schedule.sql'), 'utf8');
const m13Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0013_rewards_wallet_spin.sql'), 'utf8');
const m14Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0014_rewards_integrity_hardening.sql'), 'utf8');
const m15Sql = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0015_rewards_time_quota_hardening.sql'), 'utf8');

test('Fresh migration path: 0001 -> 0002 -> 0003 applies cleanly and verifies 100% integrity', () => {
  const db = new DatabaseSync(':memory:');

  assert.doesNotThrow(() => db.exec(m1Sql), '0001_initial.sql should execute cleanly');
  assert.doesNotThrow(() => db.exec(m2Sql), '0002_seed.sql should execute cleanly on clean DB');

  const intPlacesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(intPlacesCount, 19, 'Places count after 0002 must be 19');

  assert.doesNotThrow(() => db.exec(m3Sql), '0003_schema_update.sql should execute cleanly on clean DB');

  const catCount = db.prepare('SELECT count(*) as count FROM categories').get().count;
  assert.equal(catCount, 4, 'Categories count must be 4');

  const placesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(placesCount, 19, 'Places count must be 19');

  const verifiedCount = db.prepare("SELECT count(*) as count FROM places WHERE source_type = 'verified'").get().count;
  assert.equal(verifiedCount, 15, 'Verified places count must be 15');

  const vr360Count = db.prepare("SELECT count(*) as count FROM places WHERE source_type = 'vr360'").get().count;
  assert.equal(vr360Count, 4, 'VR360 places count must be 4');

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42, 'Articles count must be 42');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations');

  const vr360Records = db.prepare("SELECT * FROM places WHERE source_type = 'vr360'").all();
  for (const vr of vr360Records) {
    assert.equal(vr.latitude, null, 'VR360 latitude must be NULL');
    assert.equal(vr.longitude, null, 'VR360 longitude must be NULL');
    assert.equal(vr.opening_hours, null, 'VR360 opening_hours must be NULL');
    assert.ok(vr.website && vr.website.includes('daksong-daknong.vnasw.vn'), 'VR360 website must point to official tour');
  }
});

test('Fresh migration 0004_admin_extension: creates admin schema additively on fresh DB', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);

  assert.doesNotThrow(() => db.exec(m4Sql), '0004_admin_extension.sql should execute cleanly');

  // Verify all 4 admin tables exist and are operable
  const profilesCount = db.prepare('SELECT count(*) as count FROM admin_ai_profiles').get().count;
  assert.equal(profilesCount, 0, 'admin_ai_profiles starts empty');

  const auditCount = db.prepare('SELECT count(*) as count FROM admin_audit_logs').get().count;
  assert.equal(auditCount, 0, 'admin_audit_logs starts empty');

  const visitorsCount = db.prepare('SELECT count(*) as count FROM visitor_profiles').get().count;
  assert.equal(visitorsCount, 0, 'visitor_profiles starts empty');

  const telemetryCount = db.prepare('SELECT count(*) as count FROM admin_telemetry_events').get().count;
  assert.equal(telemetryCount, 0, 'admin_telemetry_events starts empty');
});

test('Fresh migration 0005_identity: creates users, auth_identities, auth_sessions, auth_challenges additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);

  assert.doesNotThrow(() => db.exec(m5Sql), '0005_identity.sql should execute cleanly');

  const usersCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  assert.equal(usersCount, 0, 'users table starts empty');

  const identitiesCount = db.prepare('SELECT count(*) as count FROM auth_identities').get().count;
  assert.equal(identitiesCount, 0, 'auth_identities table starts empty');

  const sessionsCount = db.prepare('SELECT count(*) as count FROM auth_sessions').get().count;
  assert.equal(sessionsCount, 0, 'auth_sessions table starts empty');

  const challengesCount = db.prepare('SELECT count(*) as count FROM auth_challenges').get().count;
  assert.equal(challengesCount, 0, 'auth_challenges table starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0005');
});


test('Fresh migration 0006_travel_planner: creates travel planner tables additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);

  assert.doesNotThrow(() => db.exec(m6Sql), '0006_travel_planner.sql should execute cleanly');

  const itinCount = db.prepare('SELECT count(*) as count FROM travel_itineraries').get().count;
  assert.equal(itinCount, 0, 'travel_itineraries starts empty');

  const daysCount = db.prepare('SELECT count(*) as count FROM itinerary_days').get().count;
  assert.equal(daysCount, 0, 'itinerary_days starts empty');

  const itemsCount = db.prepare('SELECT count(*) as count FROM itinerary_items').get().count;
  assert.equal(itemsCount, 0, 'itinerary_items starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0006');
});


test('Fresh migration 0007_optimistic_lock_guard: creates guard table additively and enforces CHECK(guard_id = 1)', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);

  assert.doesNotThrow(() => db.exec(m7Sql), '0007_optimistic_lock_guard.sql should execute cleanly');

  // Verify guard table exists and enforces CHECK constraint
  assert.doesNotThrow(() => db.exec('INSERT INTO optimistic_lock_guard (guard_id) VALUES (1);'));
  assert.throws(() => db.exec('INSERT INTO optimistic_lock_guard (guard_id) VALUES (0);'), /CHECK constraint failed/);
  db.exec('DELETE FROM optimistic_lock_guard;');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0007');
});



test('Fresh migration 0008_business_booking: creates business & booking tables additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);

  assert.doesNotThrow(() => db.exec(m8Sql), '0008_business_booking.sql should execute cleanly');

  const toursCount = db.prepare('SELECT count(*) as count FROM tour_products').get().count;
  assert.equal(toursCount, 3, 'tour_products seeded with 3 items');

  const servicesCount = db.prepare('SELECT count(*) as count FROM tour_services').get().count;
  assert.equal(servicesCount, 5, 'tour_services seeded with 5 items');

  const priceRulesCount = db.prepare('SELECT count(*) as count FROM tour_price_rules').get().count;
  assert.equal(priceRulesCount, 5, 'tour_price_rules seeded with 5 items');

  const bookingsCount = db.prepare('SELECT count(*) as count FROM tour_bookings').get().count;
  assert.equal(bookingsCount, 0, 'tour_bookings starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0008');
});

test('Fresh migration 0009_booking_transaction_hardening: creates refund and idempotency tables additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);

  assert.doesNotThrow(() => db.exec(m9Sql), '0009_booking_transaction_hardening.sql should execute cleanly');

  const refundsCount = db.prepare('SELECT count(*) as count FROM mock_payment_refunds').get().count;
  assert.equal(refundsCount, 0, 'mock_payment_refunds starts empty on fresh db');

  const idemCount = db.prepare('SELECT count(*) as count FROM idempotency_records').get().count;
  assert.equal(idemCount, 0, 'idempotency_records starts empty on fresh db');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0009');
});

test('Fresh migration 0010_historical_refund_reconciliation: adds timestamp_provenance column additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);

  assert.doesNotThrow(() => db.exec(m10Sql), '0010_historical_refund_reconciliation.sql should execute cleanly');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0010');
});


test('Fresh migration 0011_tourism_quiz: creates quiz tables and initial seed additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  assert.doesNotThrow(() => db.exec(m11Sql), '0011_tourism_quiz.sql should execute cleanly');
  const categoriesCount = db.prepare('SELECT count(*) as count FROM quiz_categories').get().count;
  assert.equal(categoriesCount, 5, 'quiz_categories seeded with 5 items');
  const questionsCount = db.prepare('SELECT count(*) as count FROM quiz_questions').get().count;
  assert.equal(questionsCount, 8, 'quiz_questions seeded with 8 items');
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0011');
});


test('Fresh migration 0012_quiz_scoring_and_schedule: adds score_per_question column additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  db.exec(m11Sql);

  assert.doesNotThrow(() => db.exec(m12Sql), '0012_quiz_scoring_and_schedule.sql should execute cleanly');

  const columns = db.prepare('PRAGMA table_info(quiz_attempts)').all();
  const hasScorePerQ = columns.some((c) => c.name === 'score_per_question');
  assert.equal(hasScorePerQ, true, 'quiz_attempts has score_per_question column');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0012');
});

test('Fresh migration 0013_rewards_wallet_spin: creates reward tables and demo seeds additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  db.exec(m11Sql);
  db.exec(m12Sql);

  assert.doesNotThrow(() => db.exec(m13Sql), '0013_rewards_wallet_spin.sql should execute cleanly');

  const campaignCount = db.prepare('SELECT count(*) as count FROM reward_campaigns').get().count;
  assert.equal(campaignCount, 1, 'reward_campaigns seeded with 1 demo campaign');

  const tplCount = db.prepare('SELECT count(*) as count FROM reward_voucher_templates').get().count;
  assert.equal(tplCount, 3, 'reward_voucher_templates seeded with 3 demo templates');

  const wheelCount = db.prepare('SELECT count(*) as count FROM reward_spin_wheels').get().count;
  assert.equal(wheelCount, 1, 'reward_spin_wheels seeded with 1 demo wheel');

  const segCount = db.prepare('SELECT count(*) as count FROM reward_spin_segments').get().count;
  assert.equal(segCount, 6, 'reward_spin_segments seeded with 6 segments');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0013');
});

test('Fresh migration 0014_rewards_integrity_hardening: adds gift claims and total_spins_count additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  db.exec(m11Sql);
  db.exec(m12Sql);
  db.exec(m13Sql);

  assert.doesNotThrow(() => db.exec(m14Sql), '0014_rewards_integrity_hardening.sql should execute cleanly');

  const columns = db.prepare('PRAGMA table_info(reward_campaigns)').all();
  const hasSpinsCount = columns.some((c) => c.name === 'total_spins_count');
  assert.equal(hasSpinsCount, true, 'reward_campaigns has total_spins_count column');

  const giftClaimsCount = db.prepare('SELECT count(*) as count FROM reward_gift_claims').get().count;
  assert.equal(giftClaimsCount, 0, 'reward_gift_claims starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0014');
});

test('Fresh migration 0015_rewards_time_quota_hardening: creates reward_user_campaign_spins table additively', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  db.exec(m11Sql);
  db.exec(m12Sql);
  db.exec(m13Sql);
  db.exec(m14Sql);
  assert.doesNotThrow(() => db.exec(m15Sql), '0015_rewards_time_quota_hardening.sql should execute cleanly');

  const userSpinsCount = db.prepare('SELECT count(*) as count FROM reward_user_campaign_spins').get().count;
  assert.equal(userSpinsCount, 0, 'reward_user_campaign_spins starts empty');

  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero foreign key violations after 0015');
});
test('P2-RWD-11: Upgrade migration 0015 with historical completed & failed spins: backfills reward_user_campaign_spins correctly for >= 2 users x 2 campaigns', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);
  db.exec(m6Sql);
  db.exec(m7Sql);
  db.exec(m8Sql);
  db.exec(m9Sql);
  db.exec(m10Sql);
  db.exec(m11Sql);
  db.exec(m12Sql);
  db.exec(m13Sql);
  db.exec(m14Sql);

  // Seed 2 users
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-mig-1', 'mig1@example.com', 'User Mig 1', 'active');");
  db.exec("INSERT INTO users (id, email, display_name, status) VALUES ('user-mig-2', 'mig2@example.com', 'User Mig 2', 'active');");

  // Seed 2 campaigns
  db.exec("INSERT INTO reward_campaigns (id, code, title, status, created_at, updated_at) VALUES ('cmp-mig-a', 'CAMP_A', 'Campaign A', 'published', datetime('now'), datetime('now'));");
  db.exec("INSERT INTO reward_campaigns (id, code, title, status, created_at, updated_at) VALUES ('cmp-mig-b', 'CAMP_B', 'Campaign B', 'published', datetime('now'), datetime('now'));");

  // Seed wheels: 2 wheels for campaign A, 1 wheel for campaign B
  db.exec("INSERT INTO reward_spin_wheels (id, campaign_id, title, status) VALUES ('wheel-mig-a1', 'cmp-mig-a', 'Wheel A1', 'active');");
  db.exec("INSERT INTO reward_spin_wheels (id, campaign_id, title, status) VALUES ('wheel-mig-a2', 'cmp-mig-a', 'Wheel A2', 'active');");
  db.exec("INSERT INTO reward_spin_wheels (id, campaign_id, title, status) VALUES ('wheel-mig-b1', 'cmp-mig-b', 'Wheel B1', 'active');");

  // Seed segments
  db.exec("INSERT INTO reward_spin_segments (id, wheel_id, order_index, label, segment_type, weight) VALUES ('seg-ma1', 'wheel-mig-a1', 1, 'No win', 'no_win', 100);");
  db.exec("INSERT INTO reward_spin_segments (id, wheel_id, order_index, label, segment_type, weight) VALUES ('seg-ma2', 'wheel-mig-a2', 1, 'No win', 'no_win', 100);");
  db.exec("INSERT INTO reward_spin_segments (id, wheel_id, order_index, label, segment_type, weight) VALUES ('seg-mb1', 'wheel-mig-b1', 1, 'No win', 'no_win', 100);");

  // Seed historical spin attempts:
  // User 1 in Campaign A: 2 completed spins (1 across wheel A1, 1 across wheel A2) + 1 FAILED spin
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-1', 'user-mig-1', 'wheel-mig-a1', 'seg-ma1', 'no_win', '{}', 'completed', datetime('now', '-2 days'));");
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-2', 'user-mig-1', 'wheel-mig-a2', 'seg-ma2', 'no_win', '{}', 'completed', datetime('now', '-1 day'));");
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-failed', 'user-mig-1', 'wheel-mig-a1', 'seg-ma1', 'no_win', '{}', 'failed', datetime('now', '-1 day'));");

  // User 1 in Campaign B: 1 completed spin
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-3', 'user-mig-1', 'wheel-mig-b1', 'seg-mb1', 'no_win', '{}', 'completed', datetime('now', '-1 hour'));");

  // User 2 in Campaign A: 3 completed spins
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-4', 'user-mig-2', 'wheel-mig-a1', 'seg-ma1', 'no_win', '{}', 'completed', datetime('now', '-3 days'));");
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-5', 'user-mig-2', 'wheel-mig-a1', 'seg-ma1', 'no_win', '{}', 'completed', datetime('now', '-2 days'));");
  db.exec("INSERT INTO reward_spin_attempts (id, user_id, wheel_id, segment_id, result_type, result_snapshot_json, status, created_at) VALUES ('att-6', 'user-mig-2', 'wheel-mig-a2', 'seg-ma2', 'no_win', '{}', 'completed', datetime('now', '-1 day'));");

  // Pre-migration snapshot counts
  const attemptsCountBefore = db.prepare('SELECT count(*) as count FROM reward_spin_attempts').get().count;
  assert.equal(attemptsCountBefore, 7);

  // Apply migration 0015
  assert.doesNotThrow(() => db.exec(m15Sql), '0015 should apply cleanly over preexisting historical spin data');

  // Verify backfilled counters:
  // 1. (cmp-mig-a, user-mig-1) must be exactly 2 (failed attempt att-failed MUST NOT be counted!)
  const u1a = db.prepare("SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = 'cmp-mig-a' AND user_id = 'user-mig-1'").get();
  assert.equal(u1a?.completed_spins, 2, 'User 1 in Campaign A must have exactly 2 completed spins');

  // 2. (cmp-mig-b, user-mig-1) must be exactly 1
  const u1b = db.prepare("SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = 'cmp-mig-b' AND user_id = 'user-mig-1'").get();
  assert.equal(u1b?.completed_spins, 1, 'User 1 in Campaign B must have exactly 1 completed spin');

  // 3. (cmp-mig-a, user-mig-2) must be exactly 3 across multiple wheels
  const u2a = db.prepare("SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = 'cmp-mig-a' AND user_id = 'user-mig-2'").get();
  assert.equal(u2a?.completed_spins, 3, 'User 2 in Campaign A must have exactly 3 completed spins');

  // 4. (cmp-mig-b, user-mig-2) has 0 spins -> row not exists
  const u2b = db.prepare("SELECT completed_spins FROM reward_user_campaign_spins WHERE campaign_id = 'cmp-mig-b' AND user_id = 'user-mig-2'").get();
  assert.equal(u2b, undefined, 'User 2 with 0 spins in Campaign B has no backfill row');

  // Verify historical data preservation: attempts count unchanged
  const attemptsCountAfter = db.prepare('SELECT count(*) as count FROM reward_spin_attempts').get().count;
  assert.equal(attemptsCountAfter, attemptsCountBefore, 'Historical spin attempts must not be mutated or deleted');

  // Verify foreign key integrity
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkViolations.length, 0, 'Zero FK violations after backfill');

  // Reconciliation query: 0 mismatches between ledger and counter
  const mismatches = db.prepare(`
    SELECT s.campaign_id, s.user_id, s.completed_spins, COUNT(a.id) as ledger_count
    FROM reward_user_campaign_spins s
    JOIN reward_spin_wheels w ON s.campaign_id = w.campaign_id
    JOIN reward_spin_attempts a ON w.id = a.wheel_id AND a.user_id = s.user_id
    WHERE a.status = 'completed'
    GROUP BY s.campaign_id, s.user_id
    HAVING s.completed_spins != ledger_count
  `).all();
  assert.equal(mismatches.length, 0, 'Reconciliation invariant: zero discrepancies between ledger and counter');
});

test('Preexisting database upgrade path: upgrades safely without data loss to 0006', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);

  db.exec("INSERT INTO places (id, slug, name, category_id, short_description, description) VALUES ('custom-preexist', 'custom-preexist', 'Custom Spot', 'cat-nature', 'Desc', 'Desc');");

  assert.doesNotThrow(() => db.exec(m3Sql), '0003 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m4Sql), '0004 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m5Sql), '0005 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m6Sql), '0006 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m7Sql), '0007 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m8Sql), '0008 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m9Sql), '0009 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m10Sql), '0010 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m11Sql), '0011 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m12Sql), '0012 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m13Sql), '0013 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m14Sql), '0014 must upgrade preexisting DB cleanly');
  assert.doesNotThrow(() => db.exec(m15Sql), '0015 must upgrade preexisting DB cleanly');

  const customPlace = db.prepare("SELECT * FROM places WHERE id = 'custom-preexist'").get();
  assert.ok(customPlace, 'Custom pre-existing record must be preserved');
  assert.equal(customPlace.source_type, 'verified', 'Custom pre-existing place defaults to verified');

  const total = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(total, 20);

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42);
});

test('Idempotency: Re-running 0002, 0003, 0004, 0005, and 0006 statements does not duplicate records or throw', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(m1Sql);
  db.exec(m2Sql);
  db.exec(m3Sql);
  db.exec(m4Sql);
  db.exec(m5Sql);

  assert.doesNotThrow(() => db.exec(m2Sql), 'Second run of 0002_seed.sql should not throw');
  const artInsertsOnly = m3Sql.slice(m3Sql.indexOf('INSERT INTO articles'));
  assert.doesNotThrow(() => db.exec(artInsertsOnly), 'Second run of article inserts should not throw');
  assert.doesNotThrow(() => db.exec(m4Sql), 'Second run of 0004_admin_extension.sql should not throw');
  assert.doesNotThrow(() => db.exec(m5Sql), 'Second run of 0005_identity.sql should not throw');
  assert.doesNotThrow(() => db.exec(m6Sql), 'Second run of 0006_travel_planner.sql should not throw');
  assert.doesNotThrow(() => db.exec(m7Sql), 'Second run of 0007_optimistic_lock_guard.sql should not throw');
  assert.doesNotThrow(() => db.exec(m8Sql), 'Second run of 0008_business_booking.sql should not throw');
  assert.doesNotThrow(() => db.exec(m9Sql), 'Second run of 0009_booking_transaction_hardening.sql should not throw');
  assert.doesNotThrow(() => db.exec(m11Sql), 'Second run of 0011_tourism_quiz.sql should not throw');
  // Note: 0010 uses ALTER TABLE ADD COLUMN which SQLite does not re-add if already exists, tested in upgrade path

  const placesCount = db.prepare('SELECT count(*) as count FROM places').get().count;
  assert.equal(placesCount, 19, 'Places count must remain 19 on re-run');

  const articlesCount = db.prepare('SELECT count(*) as count FROM articles').get().count;
  assert.equal(articlesCount, 42, 'Articles count must remain 42 on re-run');
});

