import test from 'node:test';
import assert from 'node:assert/strict';

const LIVE_BASE_URL = 'http://127.0.0.1:8788';

async function probeLiveServer() {
  try {
    const res = await fetch(`${LIVE_BASE_URL}/api/health`);
    return res.status === 200;
  } catch {
    return false;
  }
}

test('Tier C Cross-Module: Live workerd HTTP E2E: Auth -> Quiz -> Reward Claim -> Lucky Spin -> Wallet -> Admin Readiness', async (t) => {
  const isUp = await probeLiveServer();
  if (!isUp) {
    t.skip('Live Wrangler dev server is not active on http://127.0.0.1:8788');
    return;
  }

  const runTag = Date.now().toString().slice(-6);
  const u1Token = `mock_cross_live_u1_${runTag}`;
  const u2Token = `mock_cross_live_u2_${runTag}`;

  // 1. Authenticate User 1
  const u1AuthRes = await fetch(`${LIVE_BASE_URL}/api/auth/zalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: u1Token }),
  });
  assert.equal(u1AuthRes.status, 200);
  const u1Auth = await u1AuthRes.json();
  const token1 = u1Auth.sessionToken;
  assert.ok(token1, 'User 1 must receive session token');

  // 2. Authenticate User 2
  const u2AuthRes = await fetch(`${LIVE_BASE_URL}/api/auth/zalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: u2Token }),
  });
  assert.equal(u2AuthRes.status, 200);
  const u2Auth = await u2AuthRes.json();
  const token2 = u2Auth.sessionToken;
  assert.ok(token2, 'User 2 must receive session token');
  assert.notEqual(u1Auth.user.id, u2Auth.user.id, 'User 1 and User 2 must have distinct IDs');

  // 3. Admin creates dedicated campaign via live HTTP
  const campRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      code: 'CAMP_LIVE_CROSS_' + runTag,
      title: 'Chiến dịch Live Cross Module ' + runTag,
      campaignType: 'lucky_spin',
      totalQuota: 50,
      perUserLimit: 2,
      eligibilityRules: { allow_free_daily: true, quiz_reward_min_score: 0 },
    }),
  });
  assert.equal(campRes.status, 201);
  const camp = (await campRes.json()).campaign;

  // Publish campaign
  const pubRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns/${camp.id}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({ status: 'published' }),
  });
  assert.equal(pubRes.status, 200);

  // 4. Admin creates dedicated voucher template
  const tplRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      campaignId: camp.id,
      codePrefix: 'LIVE-' + runTag,
      title: 'Voucher Live E2E ' + runTag,
      discountDisplay: 'Giảm 25%',
      description: 'Dành cho kiểm thử live socket',
      termsConditions: 'Điều khoản DEMO',
      totalStock: 5,
    }),
  });
  assert.equal(tplRes.status, 201);
  const tpl = (await tplRes.json()).template;

  // 5. Admin creates wheel with 100% deterministic voucher win
  const wheelRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      campaignId: camp.id,
      title: 'Vòng quay Live E2E ' + runTag,
    }),
  });
  assert.equal(wheelRes.status, 201);
  const wheel = (await wheelRes.json()).wheel;

  const segRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${wheel.id}/segments`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      segments: [
        { label: 'Voucher chắc chắn', segmentType: 'voucher', voucherTemplateId: tpl.id, weight: 100, totalInventory: 5 },
        { label: 'May mắn lần sau', segmentType: 'no_win', weight: 0 },
      ],
    }),
  });
  assert.equal(segRes.status, 200);

  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${wheel.id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({ status: 'active' }),
  });

  // 6. User 1 starts a Quiz practice attempt via live HTTP
  const quizStartRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ attemptType: 'practice', questionCount: 2 }),
  });
  assert.equal(quizStartRes.status, 201);
  const quizStartData = await quizStartRes.json();
  const quizAttId = quizStartData.attempt.attemptId;
  const q0 = quizStartData.attempt.questions[0];

  // In-progress anti-leak verification (P1-QZ-08)
  assert.equal(q0.correctOptionId, undefined, 'Must not leak correctOptionId while in_progress');
  assert.equal(q0.isCorrect, undefined);

  // Submit answer to question 0
  const ansRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${quizAttId}/answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ attemptQuestionId: q0.id, selectedOptionId: q0.options[0].id }),
  });
  assert.equal(ansRes.status, 200);

  // Verify in_progress attempt score is masked as null via HTTP
  const inProgRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${quizAttId}`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(inProgRes.status, 200);
  const inProgData = await inProgRes.json();
  assert.equal(inProgData.attempt.status, 'in_progress');
  assert.equal(inProgData.attempt.score, null, 'Must mask score while in_progress');

  // Finalize quiz
  const quizFinRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${quizAttId}/finish`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(quizFinRes.status, 200);
  const finData = await quizFinRes.json();
  assert.equal(finData.result.status, 'completed');

  // 7. User 1 claims Quiz reward for lucky spin
  const claimRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins/claim-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ quizAttemptId: quizAttId, campaignId: camp.id }),
  });
  assert.equal(claimRes.status, 200);
  const claimData = await claimRes.json();
  assert.equal(claimData.success, true);
  assert.ok(claimData.entitlementId);

  // 8. Security: User 2 attempts to claim User 1's quiz attempt -> 403 Forbidden
  const bobCheatRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins/claim-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token2,
    },
    body: JSON.stringify({ quizAttemptId: quizAttId, campaignId: camp.id }),
  });
  assert.equal(bobCheatRes.status, 403, 'Cross-user quiz claim must be rejected with 403');

  // 9. User 1 executes lucky spin via live HTTP
  const spinIdemKey = 'idem-live-cross-spin-' + runTag;
  const spinRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': spinIdemKey,
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ campaignId: camp.id, wheelId: wheel.id }),
  });
  assert.equal(spinRes.status, 200);
  const spinData = await spinRes.json();
  assert.equal(spinData.success, true);
  assert.ok(spinData.voucher, 'Must win voucher deterministically');
  assert.ok(spinData.voucher.code.startsWith('LIVE-' + runTag));
  const issuedVoucherCode = spinData.voucher.code;

  // 10. Idempotent replay: same key returns identical stored result
  const replayRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': spinIdemKey,
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ campaignId: camp.id, wheelId: wheel.id }),
  });
  assert.equal(replayRes.status, 200);
  const replayData = await replayRes.json();
  assert.equal(replayData.spinAttemptId, spinData.spinAttemptId, 'Idempotent replay must match exact attempt ID');
  assert.equal(replayData.voucher.code, issuedVoucherCode);

  // 11. User 1 views wallet via live HTTP
  const walletRes = await fetch(`${LIVE_BASE_URL}/api/rewards/wallet`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(walletRes.status, 200);
  const walletData = await walletRes.json();
  const userVoucher = walletData.items.find((item) => item.voucher_code === issuedVoucherCode);
  assert.ok(userVoucher, 'Issued voucher must be in User 1 wallet');
  assert.equal(userVoucher.status, 'issued');

  // 12. Security: User 2 attempts to access User 1's voucher detail -> 403 Forbidden
  const bobLeakRes = await fetch(`${LIVE_BASE_URL}/api/rewards/wallet/${userVoucher.id}`, {
    headers: { 'Authorization': 'Bearer ' + token2 },
  });
  assert.equal(bobLeakRes.status, 403, 'Cross-user wallet access must be rejected with 403');

  // 13. Admin calls GET /api/admin/operations/readiness via live HTTP
  const opsRes = await fetch(`${LIVE_BASE_URL}/api/admin/operations/readiness`, {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  });
  assert.equal(opsRes.status, 200);
  const opsData = await opsRes.json();

  assert.equal(opsData.system.databaseConnected, true, 'Database must be connected');
  assert.equal(opsData.system.migrationVerificationStatus, 'VERIFIED', 'D1 migrations must be VERIFIED on live dev server');
  assert.equal(opsData.system.verifiedAppliedMigrationsCount, 15, '15 migrations verified in D1');
  assert.equal(opsData.invariants.overallIntegrity, true, 'Overall integrity must be true');
  assert.equal(opsData.invariants.overallStatus, 'PASS', 'Overall status must be PASS');
  assert.equal(opsData.invariants.zeroGhostVoucherSpins, true);
  assert.equal(opsData.invariants.zeroOversoldTemplates, true);
  assert.equal(opsData.invariants.zeroOversoldSegments, true);
  assert.equal(opsData.invariants.quizIntegrityPassed, true);
  assert.equal(opsData.invariants.rewardIntegrityPassed, true);

  // 14. Admin calls GET /api/admin/operations/export via live HTTP
  const expRes = await fetch(`${LIVE_BASE_URL}/api/admin/operations/export`, {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  });
  assert.equal(expRes.status, 200);
  assert.ok(expRes.headers.get('Content-Type')?.includes('text/csv'));

  const csvBuffer = new Uint8Array(await expRes.arrayBuffer());
  assert.equal(csvBuffer[0], 0xEF, 'BOM byte 1 must be 0xEF');
  assert.equal(csvBuffer[1], 0xBB, 'BOM byte 2 must be 0xBB');
  assert.equal(csvBuffer[2], 0xBF, 'BOM byte 3 must be 0xBF');

  const csvContent = new TextDecoder('utf-8').decode(csvBuffer);
  assert.ok(csvContent.includes('BÁO CÁO NGHIỆM THU & VẬN HÀNH HỆ THỐNG DU LỊCH ĐẮK SONG'));
  assert.ok(csvContent.includes('PASS (100% ĐẠT CHUẨN KỸ THUẬT)'));
  assert.ok(csvContent.includes('ĐÃ XÁC MINH (15/15)'));
});
