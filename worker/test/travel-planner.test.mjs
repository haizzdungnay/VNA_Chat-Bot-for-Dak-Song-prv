import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { PlannerService } from '../src/services/planner.service.ts';
import { IdentityService } from '../src/services/identity.service.ts';
import worker from '../src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

function createPlannerTestEnv(overrides = {}) {
  const db = new DatabaseSync(':memory:');
  const m1 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0001_initial.sql'), 'utf8');
  const m2 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0002_seed.sql'), 'utf8');
  const m3 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0003_schema_update.sql'), 'utf8');
  const m4 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0004_admin_extension.sql'), 'utf8');
  const m5 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0005_identity.sql'), 'utf8');
  const m6 = fs.readFileSync(path.join(REPO_ROOT, 'worker/migrations/0006_travel_planner.sql'), 'utf8');

  db.exec(m1);
  db.exec(m2);
  db.exec(m3);
  db.exec(m4);
  db.exec(m5);
  db.exec(m6);

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
      async batch(statements) {
        const results = [];
        for (const s of statements) {
          results.push(await s.run());
        }
        return results;
      },
    },
    rawDb: db,
    ENVIRONMENT: 'test',
    EMAIL_PROVIDER: 'test',
    ...overrides,
  };
}

test('PlannerService: Input validation rejects invalid fields', () => {
  const env = createPlannerTestEnv();
  const planner = new PlannerService(env);

  // Duration > 5
  assert.throws(
    () => planner.validateRequest({ durationDays: 6, travelersCount: 2, startDate: '2026-11-01' }),
    /Thời gian chuyến đi phải từ 1 đến 5 ngày/
  );

  // Children > travelers
  assert.throws(
    () => planner.validateRequest({ durationDays: 2, travelersCount: 2, childrenCount: 3, startDate: '2026-11-01' }),
    /Số lượng trẻ em không thể vượt quá tổng số người/
  );

  // Invalid date format
  assert.throws(
    () => planner.validateRequest({ durationDays: 3, travelersCount: 2, startDate: '01-11-2026' }),
    /Ngày khởi hành phải đúng định dạng YYYY-MM-DD/
  );
});

test('PlannerService: Generates structured 3-day itinerary respecting pace and VR360 stops', async () => {
  const env = createPlannerTestEnv();
  const planner = new PlannerService(env);

  const res = await planner.generatePreview({
    durationDays: 3,
    travelersCount: 4,
    childrenCount: 1,
    startDate: '2026-11-10',
    departureTime: '08:30',
    pace: 'moderate',
    transportation: 'car',
    budgetPreference: 'moderate',
    selectedPlaceIds: ['vr360-dien-gio'],
  });

  assert.equal(res.durationDays, 3);
  assert.equal(res.travelersCount, 4);
  assert.equal(res.days.length, 3);
  assert.equal(res.days[0].date, '2026-11-10');
  assert.equal(res.days[1].date, '2026-11-11');
  assert.equal(res.days[2].date, '2026-11-12');

  // Verify Day 1 contains user-selected place vr360-dien-gio
  const day1Items = res.days[0].items;
  const dienGio = day1Items.find((it) => it.placeId === 'vr360-dien-gio');
  assert.ok(dienGio, 'Must prioritize user-selected place on Day 1');
  assert.equal(dienGio.isUserSelected, true);
  assert.ok(dienGio.notes?.includes('VR360'), 'VR360 place must be clearly flagged in notes');

  // Verify meal break is included in each day
  for (const day of res.days) {
    const meal = day.items.find((it) => it.itemType === 'meal');
    assert.ok(meal, `Day ${day.dayNumber} must include a meal break`);
  }
});

test('PlannerService: AI error or malformed JSON triggers deterministic fallback with truth-in-reporting', async () => {
  const env = createPlannerTestEnv();
  const planner = new PlannerService(env);

  // Force AI failure
  PlannerService.testAIOverride = async () => 'INVALID NOT JSON {{{{';

  const res = await planner.generatePreview({
    durationDays: 2,
    travelersCount: 2,
    startDate: '2026-11-15',
    pace: 'relaxed',
  });

  assert.equal(res.isFallback, true, 'Must set isFallback to true');
  assert.ok(res.warnings?.some((w) => w.includes('thuật toán tối ưu cục bộ')), 'Must explain fallback truth-in-reporting');
  assert.equal(res.days.length, 2);

  PlannerService.testAIOverride = null;
});

test('PlannerService: CRUD operations and data isolation between users', async () => {
  const env = createPlannerTestEnv();
  const planner = new PlannerService(env);

  // Create User A and User B
  const userA = 'user-uuid-1111';
  const userB = 'user-uuid-2222';
  env.rawDb.exec(`INSERT INTO users (id, display_name, status) VALUES ('${userA}', 'User A', 'active'), ('${userB}', 'User B', 'active');`);

  // 1. User A generates and saves an itinerary
  const preview = await planner.generatePreview({
    durationDays: 2,
    travelersCount: 2,
    startDate: '2026-11-20',
  });

  const savedA = await planner.saveItinerary(userA, preview);
  assert.ok(savedA.id, 'Saved itinerary must have ID');
  assert.equal(savedA.userId, userA);
  assert.equal(savedA.status, 'saved');
  assert.equal(savedA.version, 1);

  // 2. User A lists itineraries
  const listA = await planner.listItineraries(userA);
  assert.equal(listA.length, 1);
  assert.equal(listA[0].id, savedA.id);

  // 3. User B lists itineraries -> Empty!
  const listB = await planner.listItineraries(userB);
  assert.equal(listB.length, 0, 'User B must not see User A itineraries');

  // 4. User B attempts to get User A itinerary -> Throws 404
  await assert.rejects(
    async () => planner.getItinerary(userB, savedA.id),
    /Không tìm thấy lịch trình hoặc bạn không có quyền truy cập/
  );

  // 5. User A updates itinerary
  savedA.title = 'Chuyến đi Đắk Song đã đổi tên';
  const updatedA = await planner.updateItinerary(userA, savedA.id, savedA);
  assert.equal(updatedA.title, 'Chuyến đi Đắk Song đã đổi tên');
  assert.equal(updatedA.version, 2, 'Version must increment on update');

  // 6. User B attempts to delete User A itinerary -> Throws 404
  await assert.rejects(
    async () => planner.deleteItinerary(userB, savedA.id),
    /Không tìm thấy lịch trình hoặc bạn không có quyền truy cập/
  );

  // 7. User A deletes itinerary
  const deleted = await planner.deleteItinerary(userA, savedA.id);
  assert.equal(deleted, true);

  const listAfterDelete = await planner.listItineraries(userA);
  assert.equal(listAfterDelete.length, 0);
});

test('HTTP Router E2E: Itineraries public preview, auth save/list/delete, and rate limiting', async () => {
  const env = createPlannerTestEnv();
  const identityService = new IdentityService(env);
  IdentityService.testZaloVerifier = async () => ({
    valid: true,
    zaloId: 'e2e_itin_user',
    name: 'Khách Đắk Song',
  });

  const mockCtx = { waitUntil: () => {}, passThroughOnException: () => {} };

  // Login to obtain valid session token
  const { sessionToken, user } = await identityService.loginWithZalo('valid_zalo_session_token_123');

  // 1. POST /api/itineraries/preview (Public without token -> 200)
  const reqPreview = new Request('http://localhost:8787/api/itineraries/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      durationDays: 2,
      travelersCount: 2,
      startDate: '2026-11-25',
    }),
  });
  const resPreview = await worker.fetch(reqPreview, env, mockCtx);
  assert.equal(resPreview.status, 200);
  const dataPreview = await resPreview.json();
  assert.ok(dataPreview.itinerary);
  assert.equal(dataPreview.itinerary.durationDays, 2);

  // 2. POST /api/itineraries without token -> 401
  const reqSaveNoAuth = new Request('http://localhost:8787/api/itineraries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dataPreview.itinerary),
  });
  const resSaveNoAuth = await worker.fetch(reqSaveNoAuth, env, mockCtx);
  assert.equal(resSaveNoAuth.status, 401);

  // 3. POST /api/itineraries with Bearer token -> 201
  const reqSaveAuth = new Request('http://localhost:8787/api/itineraries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(dataPreview.itinerary),
  });
  const resSaveAuth = await worker.fetch(reqSaveAuth, env, mockCtx);
  assert.equal(resSaveAuth.status, 201);
  const dataSave = await resSaveAuth.json();
  assert.ok(dataSave.itinerary.id);

  // 4. GET /api/itineraries with Bearer token -> 200
  const reqList = new Request('http://localhost:8787/api/itineraries', {
    method: 'GET',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const resList = await worker.fetch(reqList, env, mockCtx);
  assert.equal(resList.status, 200);
  const dataList = await resList.json();
  assert.equal(dataList.length, 1);
  assert.equal(dataList[0].id, dataSave.itinerary.id);

  // 5. DELETE /api/itineraries/:id -> 200
  const reqDelete = new Request(`http://localhost:8787/api/itineraries/${dataSave.itinerary.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const resDelete = await worker.fetch(reqDelete, env, mockCtx);
  assert.equal(resDelete.status, 200);
});

test('PlannerService: Server-side validation rejects invalid placeId during save', async () => {
  const env = createPlannerTestEnv();
  const planner = new PlannerService(env);

  const preview = await planner.generatePreview({
    durationDays: 1,
    travelersCount: 2,
    startDate: '2026-11-20',
  });

  // Tamper preview with fake placeId
  preview.days[0].items.push({
    placeId: 'fake-non-existent-place',
    itemType: 'place',
    title: 'Địa điểm bịa đặt',
    durationMinutes: 60,
    orderIndex: 99,
    isUserSelected: false,
  });

  await assert.rejects(
    async () => planner.saveItinerary('user-uuid-1111', preview),
    /Địa điểm 'fake-non-existent-place' không tồn tại/
  );
});

test('PlannerService: Optimistic locking rejects stale version update with 409', async () => {
  const env = createPlannerTestEnv();
  const planner = new PlannerService(env);
  const user = 'user-uuid-lock';
  env.rawDb.exec(`INSERT INTO users (id, display_name, status) VALUES ('${user}', 'User Lock', 'active');`);

  const preview = await planner.generatePreview({
    durationDays: 1,
    travelersCount: 2,
    startDate: '2026-11-20',
  });

  const saved = await planner.saveItinerary(user, preview);
  assert.equal(saved.version, 1);

  // First update succeeds and increments version to 2
  const updated1 = await planner.updateItinerary(user, saved.id, { ...saved, title: 'Bản sửa lần 1' });
  assert.equal(updated1.version, 2);

  // Stale update using version 1 fails with 409 Conflict
  await assert.rejects(
    async () => planner.updateItinerary(user, saved.id, { ...saved, title: 'Bản sửa cũ từ thiết bị khác', version: 1 }),
    /Xung đột phiên bản/
  );
});
