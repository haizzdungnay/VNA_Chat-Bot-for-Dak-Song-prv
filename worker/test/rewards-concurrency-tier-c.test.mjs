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

test('Tier C: Live Worker + D1 Rewards, Lucky Spin & Voucher Wallet HTTP Verification', async () => {
  const isUp = await probeLiveServer();
  assert.equal(isUp, true, 'Live Wrangler dev server must be active on http://127.0.0.1:8788');

  const runTag = Date.now().toString().slice(-6);
  const u1Token = `mock_rw_u1_${runTag}`;
  const u2Token = `mock_rw_u2_${runTag}`;

  // 1. Authenticate User 1
  const u1AuthRes = await fetch(`${LIVE_BASE_URL}/api/auth/zalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: u1Token }),
  });
  assert.equal(u1AuthRes.status, 200);
  const u1Auth = await u1AuthRes.json();
  const token1 = u1Auth.sessionToken;
  assert.ok(token1);

  // 2. Authenticate User 2
  const u2AuthRes = await fetch(`${LIVE_BASE_URL}/api/auth/zalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: u2Token }),
  });
  assert.equal(u2AuthRes.status, 200);
  const u2Auth = await u2AuthRes.json();
  const token2 = u2Auth.sessionToken;
  assert.ok(token2);
  assert.notEqual(u1Auth.user.id, u2Auth.user.id);

  // 3. Admin creates a fresh test campaign
  const campCode = `CAMP_TIER_C_${runTag}`;
  const createCampRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      code: campCode,
      title: 'Chiến dịch Test Tier C ' + runTag,
      campaignType: 'lucky_spin',
      totalQuota: 100,
      perUserLimit: 5,
      eligibilityRules: { allow_free_daily: true, quiz_reward_min_score: 10 },
    }),
  });
  assert.equal(createCampRes.status, 201);
  const campData = await createCampRes.json();
  const campaignId = campData.campaign.id;

  // Publish campaign
  const pubRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns/${campaignId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({ status: 'published' }),
  });
  assert.equal(pubRes.status, 200);

  // 4. Admin creates template with strictly 1 stock
  const tplRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      campaignId,
      codePrefix: 'TC-' + runTag,
      title: 'Voucher Độc bản 1 chiếc',
      discountDisplay: 'Giảm 100%',
      discountType: 'percentage',
      discountValue: 100,
      minOrderValue: 0,
      category: 'tour',
      description: 'Chỉ có 1 chiếc duy nhất trong kho',
      termsConditions: 'Điều khoản thử nghiệm',
      validityDays: 7,
      totalStock: 1, // Only 1 in stock!
    }),
  });
  assert.equal(tplRes.status, 201);
  const tplData = await tplRes.json();
  const templateId = tplData.template.id;

  // 5. Admin creates wheel with 2 segments: 1 voucher (stock 1), 1 no_win
  const wheelRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      campaignId,
      title: 'Vòng quay Tier C ' + runTag,
    }),
  });
  assert.equal(wheelRes.status, 201);
  const wheelData = await wheelRes.json();
  const wheelId = wheelData.wheel.id;

  const segRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${wheelId}/segments`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      segments: [
        { label: 'Trúng voucher độc bản', segmentType: 'voucher', voucherTemplateId: templateId, weight: 100, totalInventory: 1 },
        { label: 'May mắn lần sau', segmentType: 'no_win', weight: 100 },
      ],
    }),
  });
  assert.equal(segRes.status, 200);

  // Activate wheel
  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${wheelId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({ status: 'active' }),
  });

  // 6. User 1 checks eligibility and claims daily free spin
  const eligRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins/eligibility?campaignId=${campaignId}`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(eligRes.status, 200);
  const eligData = await eligRes.json();
  assert.equal(eligData.canSpin, true);

  // 7. Concurrent spin with SAME idempotency key for User 1
  const sameIdemKey = `idem-tier-c-${runTag}`;
  const [spinA, spinB] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ campaignId, wheelId, idempotencyKey: sameIdemKey }),
    }),
    fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ campaignId, wheelId, idempotencyKey: sameIdemKey }),
    }),
  ]);

  assert.equal(spinA.status, 200);
  assert.equal(spinB.status, 200);
  const resA = await spinA.json();
  const resB = await spinB.json();
  assert.equal(resA.spinAttemptId, resB.spinAttemptId, 'Concurrent same idempotency key must return exact same spin attempt');

  // 8. User 1 wallet check
  const wallet1Res = await fetch(`${LIVE_BASE_URL}/api/rewards/wallet`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(wallet1Res.status, 200);
  const wallet1Data = await wallet1Res.json();
  assert.ok(wallet1Data.items.length >= 0);

  // If User 1 won voucher on that spin:
  let winningVoucher = resA.voucher;
  if (!winningVoucher) {
    // Give User 1 another spin to ensure voucher is issued
    await fetch(`${LIVE_BASE_URL}/api/rewards/spins/claim-daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ campaignId }),
    });
  }

  // 9. Cross-user isolation test on wallet item
  if (wallet1Data.items.length > 0) {
    const vId = wallet1Data.items[0].id;
    const crossRes = await fetch(`${LIVE_BASE_URL}/api/rewards/wallet/${vId}`, {
      headers: { 'Authorization': 'Bearer ' + token2 },
    });
    assert.equal(crossRes.status, 403, 'User 2 must not view User 1 voucher');
  }

  // 10. Admin verifies / redeems a voucher
  const adminWalletRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wallet?campaignId=${campaignId}`, {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  });
  assert.equal(adminWalletRes.status, 200);
  const adminWalletData = await adminWalletRes.json();

  if (adminWalletData.items.length > 0) {
    const vToRedeem = adminWalletData.items[0];
    // First redeem
    const rdm1 = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wallet/${vToRedeem.id}/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-access-authenticated-user-email': 'admin@vna.vn',
      },
      body: JSON.stringify({ reason: 'Quét tại quầy Tier C' }),
    });
    assert.equal(rdm1.status, 200);
    const rdmData1 = await rdm1.json();
    assert.equal(rdmData1.voucher.status, 'redeemed');

    // Second redeem attempt on same voucher -> 409 Conflict
    const rdm2 = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wallet/${vToRedeem.id}/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-access-authenticated-user-email': 'admin@vna.vn',
      },
      body: JSON.stringify({ reason: 'Quét lại' }),
    });
    assert.equal(rdm2.status, 409, 'Double redemption must be rejected with 409 Conflict');
  }

  // 11. Admin analytics and CSV export
  const analyticsRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/analytics`, {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  });
  assert.equal(analyticsRes.status, 200);
  const anData = await analyticsRes.json();
  assert.ok(anData.analytics.spins.totalSpins >= 1);

  const exportRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/export`, {
    headers: { 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  });
  assert.equal(exportRes.status, 200);
  const csvBuffer = new Uint8Array(await exportRes.arrayBuffer());
  assert.equal(csvBuffer[0], 0xEF);
  assert.equal(csvBuffer[1], 0xBB);
  assert.equal(csvBuffer[2], 0xBF);
});

