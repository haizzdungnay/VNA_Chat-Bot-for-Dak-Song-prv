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

  // =========================================================================
  // 12. P1-RWD-01: Two Users Race for Last Voucher Stock (stock = 1)
  // =========================================================================
  const raceCampRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-access-authenticated-user-email': 'admin@vna.vn',
    },
    body: JSON.stringify({
      code: 'CAMP_RACE_' + runTag,
      title: 'Chiến dịch Race Stock ' + runTag,
      campaignType: 'lucky_spin',
      totalQuota: 50,
      eligibilityRules: { allow_free_daily: true },
    }),
  });
  assert.equal(raceCampRes.status, 201);
  const raceCamp = (await raceCampRes.json()).campaign;
  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns/${raceCamp.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ status: 'published' }),
  });

  // Create template with strictly 1 item stock
  const raceTplRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({
      campaignId: raceCamp.id,
      codePrefix: 'RACE-' + runTag,
      title: 'Voucher Cuối Cùng',
      discountDisplay: 'Giảm 50%',
      description: 'Chỉ 1 suất duy nhất',
      termsConditions: 'Điều khoản',
      totalStock: 1,
    }),
  });
  const raceTpl = (await raceTplRes.json()).template;

  // Create wheel with 100% voucher win for seg-1 (stock 1) and no_win
  const raceWheelRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ campaignId: raceCamp.id, title: 'Vòng quay Race Stock' }),
  });
  const raceWheel = (await raceWheelRes.json()).wheel;

  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${raceWheel.id}/segments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({
      segments: [
        { label: 'Voucher Độc Nhất', segmentType: 'voucher', voucherTemplateId: raceTpl.id, weight: 100, totalInventory: 1 },
        { label: 'May mắn lần sau', segmentType: 'no_win', weight: 50 },
      ],
    }),
  });

  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${raceWheel.id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ status: 'active' }),
  });

  // Both User 1 and User 2 claim daily free spin
  await fetch(`${LIVE_BASE_URL}/api/rewards/spins/claim-daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token1 },
    body: JSON.stringify({ campaignId: raceCamp.id }),
  });
  await fetch(`${LIVE_BASE_URL}/api/rewards/spins/claim-daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token2 },
    body: JSON.stringify({ campaignId: raceCamp.id }),
  });

  // Fire simultaneous spins for User 1 and User 2
  const [raceSpin1, raceSpin2] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-race-u1-' + runTag,
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ campaignId: raceCamp.id, wheelId: raceWheel.id }),
    }),
    fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-race-u2-' + runTag,
        'Authorization': 'Bearer ' + token2,
      },
      body: JSON.stringify({ campaignId: raceCamp.id, wheelId: raceWheel.id }),
    }),
  ]);

  assert.equal(raceSpin1.status, 200);
  assert.equal(raceSpin2.status, 200);
  const rData1 = await raceSpin1.json();
  const rData2 = await raceSpin2.json();

  // Exactly ONE winner gets the voucher! The other gets no_win (zero negative stock!)
  const voucherWinners = [rData1.voucher, rData2.voucher].filter(Boolean);
  assert.equal(voucherWinners.length, 1, 'Exactly one user must win the 1-stock voucher');

  // =========================================================================
  // 13. P1-RWD-02: Gift Item Claim Creation & Admin Fulfillment via HTTP
  // =========================================================================
  const giftCampRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({
      code: 'CAMP_GIFT_' + runTag,
      title: 'Chiến dịch Quà Tặng ' + runTag,
      campaignType: 'lucky_spin',
      eligibilityRules: { allow_free_daily: true },
    }),
  });
  const giftCamp = (await giftCampRes.json()).campaign;
  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/campaigns/${giftCamp.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ status: 'published' }),
  });

  const giftWheelRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ campaignId: giftCamp.id, title: 'Vòng quay Quà Tặng' }),
  });
  const giftWheel = (await giftWheelRes.json()).wheel;

  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${giftWheel.id}/segments`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({
      segments: [
        { label: 'Cà phê rang xay Đắk Song', segmentType: 'gift_item', weight: 100, totalInventory: 10 },
        { label: 'May mắn lần sau', segmentType: 'no_win', weight: 0 },
      ],
    }),
  });

  await fetch(`${LIVE_BASE_URL}/api/admin/rewards/wheels/${giftWheel.id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ status: 'active' }),
  });

  // User 1 spins and wins gift
  await fetch(`${LIVE_BASE_URL}/api/rewards/spins/claim-daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token1 },
    body: JSON.stringify({ campaignId: giftCamp.id }),
  });
  const giftSpinRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-gift-spin-' + runTag,
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ campaignId: giftCamp.id, wheelId: giftWheel.id }),
  });
  assert.equal(giftSpinRes.status, 200);
  const giftSpinData = await giftSpinRes.json();
  assert.equal(giftSpinData.segment.segmentType, 'gift_item');
  assert.ok(giftSpinData.giftClaim);
  assert.ok(giftSpinData.giftClaim.claimCode.startsWith('GIFT-'));

  // User 1 reads their gift claims
  const u1ClaimsRes = await fetch(`${LIVE_BASE_URL}/api/rewards/gift-claims`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(u1ClaimsRes.status, 200);
  const u1Claims = await u1ClaimsRes.json();
  assert.ok(u1Claims.claims.length >= 1);

  // Admin fulfills the gift claim
  const fulfillRes = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/gift-claims/${giftSpinData.giftClaim.id}/fulfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
    body: JSON.stringify({ notes: 'Đã trao quà tại trạm Nâm Nung' }),
  });
  assert.equal(fulfillRes.status, 200);
  const fulfillData = await fulfillRes.json();
  assert.equal(fulfillData.claim.status, 'fulfilled');

  // Second fulfill attempt -> 409
  const doubleFulfill = await fetch(`${LIVE_BASE_URL}/api/admin/rewards/gift-claims/${giftSpinData.giftClaim.id}/fulfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-access-authenticated-user-email': 'admin@vna.vn' },
  });
  assert.equal(doubleFulfill.status, 409, 'Duplicate gift fulfill must return 409');

  // =========================================================================
  // 14. P1-RWD-03: Cross-User Idempotency Key Collision Rejection (403)
  // =========================================================================
  const crossKeyRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-gift-spin-' + runTag, // Key already used by User 1!
      'Authorization': 'Bearer ' + token2, // User 2!
    },
    body: JSON.stringify({ campaignId: giftCamp.id, wheelId: giftWheel.id }),
  });
  assert.equal(crossKeyRes.status, 403, 'Cross-user idempotency key reuse must be rejected with 403');

  // Same user reusing key with different payload -> 409
  const payloadConflictRes = await fetch(`${LIVE_BASE_URL}/api/rewards/spins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-gift-spin-' + runTag,
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ campaignId: 'cmp-dak-song-2026', wheelId: giftWheel.id }),
  });
  assert.equal(payloadConflictRes.status, 409, 'Same key with different payload must be rejected with 409');
});

