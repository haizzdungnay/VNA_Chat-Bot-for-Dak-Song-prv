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

test('Tier C: Live Worker + D1 Concurrency & Anti-Cheat HTTP Verification', async () => {
  const isUp = await probeLiveServer();
  assert.equal(isUp, true, 'Live Wrangler dev server must be active on http://127.0.0.1:8788');

  // Generate unique test users per run to avoid clashes with past runs
  const runTag = Date.now().toString().slice(-6);
  const u1TokenName = `mock_tier_c_u1_${runTag}`;
  const u2TokenName = `mock_tier_c_u2_${runTag}`;

  // 1. Authenticate User 1
  const u1AuthRes = await fetch(`${LIVE_BASE_URL}/api/auth/zalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: u1TokenName }),
  });
  assert.equal(u1AuthRes.status, 200);
  const u1Auth = await u1AuthRes.json();
  const token1 = u1Auth.sessionToken;
  assert.ok(token1, 'User 1 must obtain valid session token');

  // 2. Authenticate User 2
  const u2AuthRes = await fetch(`${LIVE_BASE_URL}/api/auth/zalo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: u2TokenName }),
  });
  assert.equal(u2AuthRes.status, 200);
  const u2Auth = await u2AuthRes.json();
  const token2 = u2Auth.sessionToken;
  assert.ok(token2, 'User 2 must obtain valid session token');
  assert.notEqual(u1Auth.user.id, u2Auth.user.id, 'User 1 and User 2 must have distinct user IDs');

  // 3. Concurrent Daily Challenge Starts for User 1
  // Query today's daily challenge
  const dailyInfoRes = await fetch(`${LIVE_BASE_URL}/api/quiz/daily`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(dailyInfoRes.status, 200);
  const dailyInfo = await dailyInfoRes.json();

  if (dailyInfo.challenge && dailyInfo.challenge.isOpen) {
    const chId = dailyInfo.challenge.id;

    // Fire TWO concurrent attempts to start Daily Challenge
    const [dailyStart1, dailyStart2] = await Promise.all([
      fetch(`${LIVE_BASE_URL}/api/quiz/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token1,
        },
        body: JSON.stringify({ attemptType: 'daily_challenge', challengeId: chId }),
      }),
      fetch(`${LIVE_BASE_URL}/api/quiz/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token1,
        },
        body: JSON.stringify({ attemptType: 'daily_challenge', challengeId: chId }),
      }),
    ]);

    const dailyStatuses = [dailyStart1.status, dailyStart2.status].sort();
    assert.deepEqual(
      dailyStatuses,
      [201, 409],
      'Concurrent Daily Challenge start: exactly one 201 Created, one 409 Conflict'
    );
  }

  // 4. Concurrent Practice Starts for User 1
  const [startP1, startP2] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptType: 'practice', questionCount: 2 }),
    }),
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptType: 'practice', questionCount: 2 }),
    }),
  ]);
  assert.equal(startP1.status, 201);
  assert.equal(startP2.status, 201);
  const dataP1 = await startP1.json();
  const dataP2 = await startP2.json();
  const attId1 = dataP1.attempt.attemptId;
  const attId2 = dataP2.attempt.attemptId;
  assert.ok(attId1 !== attId2, 'Two practice attempts must have unique IDs');

  // 5. Concurrent identical answer submissions on same question
  const q1 = dataP1.attempt.questions[0];
  const optId1 = q1.options[0].id;

  const [ansRes1, ansRes2] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptQuestionId: q1.id, selectedOptionId: optId1 }),
    }),
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptQuestionId: q1.id, selectedOptionId: optId1 }),
    }),
  ]);

  assert.equal(ansRes1.status, 200);
  assert.equal(ansRes2.status, 200);

  // 6. Concurrent conflicting answer submissions on question 2
  const q2 = dataP1.attempt.questions[1];
  const optA = q2.options[0].id;
  const optB = q2.options[1].id;

  const [conflictResA, conflictResB] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptQuestionId: q2.id, selectedOptionId: optA }),
    }),
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptQuestionId: q2.id, selectedOptionId: optB }),
    }),
  ]);

  const statuses = [conflictResA.status, conflictResB.status].sort();
  assert.deepEqual(statuses, [200, 409], 'Concurrent conflicting submissions: exactly one 200, one 409 Conflict');

  // 7. Concurrent finalize on attempt 1
  const [fin1, fin2] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}/finish`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token1 },
    }),
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}/finish`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token1 },
    }),
  ]);
  assert.equal(fin1.status, 200);
  assert.equal(fin2.status, 200);
  const finData1 = await fin1.json();
  const finData2 = await fin2.json();
  assert.equal(finData1.result.status, 'completed');
  assert.equal(finData2.result.status, 'completed');
  assert.equal(finData1.result.score, finData2.result.score, 'Scores must match identically');

  // Check stats for User 1
  const statsRes = await fetch(`${LIVE_BASE_URL}/api/quiz/stats`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.ok(statsData.stats.completedAttempts >= 1);

  // 8. Security: Cross-user data isolation
  const leakGetRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId1}`, {
    headers: { 'Authorization': 'Bearer ' + token2 },
  });
  assert.equal(leakGetRes.status, 403, 'Cross-user attempt access must be rejected with 403');

  const leakAnsRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId2}/answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token2,
    },
    body: JSON.stringify({ attemptQuestionId: q1.id, selectedOptionId: optId1 }),
  });
  assert.equal(leakAnsRes.status, 403, 'Cross-user answer submission must be rejected with 403');

  const leakFinRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId2}/finish`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token2 },
  });
  assert.equal(leakFinRes.status, 403, 'Cross-user finalize must be rejected with 403');

  // 9. Zero answer leakage during in_progress
  const activeAttRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId2}`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(activeAttRes.status, 200);
  const activeAtt = await activeAttRes.json();
  assert.equal(activeAtt.attempt.status, 'in_progress');
  for (const item of activeAtt.attempt.questions) {
    assert.equal(item.correctOptionId, undefined, 'Must not expose correctOptionId while in_progress');
    assert.equal(item.explanation, undefined, 'Must not expose explanation while in_progress');
    for (const opt of item.options) {
      assert.equal(opt.is_correct, undefined, 'Option must not expose is_correct while in_progress');
    }
  }
});
