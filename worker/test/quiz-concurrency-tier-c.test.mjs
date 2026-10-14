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

  // 3. Mandatory Daily Challenge Setup & Concurrent Start Verification
  // Ensure today's challenge exists and is open
  let dailyInfoRes = await fetch(`${LIVE_BASE_URL}/api/quiz/daily`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(dailyInfoRes.status, 200);
  let dailyInfo = await dailyInfoRes.json();

  if (!dailyInfo.challenge || !dailyInfo.challenge.isOpen) {
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    // Call Admin API to create today's challenge if absent
    await fetch(`${LIVE_BASE_URL}/api/admin/quiz/challenges`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-access-authenticated-user-email': 'admin@vna.vn',
      },
      body: JSON.stringify({
        title: 'Thử thách Du lịch Đắk Song ngày ' + todayStr,
        business_date: todayStr,
        collection_id: 'col-dak-song-intro',
        opening_time: '00:00:00',
        closing_time: '23:59:59',
        score_per_question: 10,
        status: 'active',
      }),
    });

    dailyInfoRes = await fetch(`${LIVE_BASE_URL}/api/quiz/daily`, {
      headers: { 'Authorization': 'Bearer ' + token1 },
    });
    dailyInfo = await dailyInfoRes.json();
  }

  // Mandatory assertion: MUST NOT be skipped or undefined
  assert.ok(dailyInfo.challenge, 'Daily challenge must be configured for today');
  assert.equal(dailyInfo.challenge.isOpen, true, 'Daily challenge must be open today');
  const chId = dailyInfo.challenge.id;

  // Fire TWO concurrent HTTP requests to start Daily Challenge for User 1
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

  // Both identical retries must succeed cleanly without leaking isCorrect
  assert.equal(ansRes1.status, 200);
  assert.equal(ansRes2.status, 200);
  const ansData1 = await ansRes1.json();
  const ansData2 = await ansRes2.json();
  assert.equal(ansData1.isCorrect, undefined, 'Must not leak isCorrect during in_progress');
  assert.equal(ansData2.isCorrect, undefined, 'Must not leak isCorrect during in_progress');

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

  // Exact stats assertion for fresh User 1: exactly 1 completed attempt, exactly 1 total completed
  const statsRes = await fetch(`${LIVE_BASE_URL}/api/quiz/stats`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.equal(statsData.stats.completedAttempts, 1, 'Stats completedAttempts must be exactly 1 (no double increment)');
  assert.equal(statsData.stats.totalAttempts, 1, 'Stats totalAttempts must be exactly 1');

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

  // 9. Zero answer leakage and zero aggregate grading leakage during in_progress
  const activeAttRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId2}`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(activeAttRes.status, 200);
  const activeAtt = await activeAttRes.json();
  assert.equal(activeAtt.attempt.status, 'in_progress');
  assert.equal(activeAtt.attempt.score, null, 'Attempt score must be null while in_progress');
  assert.equal(activeAtt.attempt.correctCount, null, 'correctCount must be null while in_progress');
  assert.equal(activeAtt.attempt.incorrectCount, null, 'incorrectCount must be null while in_progress');
  assert.equal(activeAtt.attempt.percentage, null, 'percentage must be null while in_progress');

  for (const item of activeAtt.attempt.questions) {
    assert.equal(item.correctOptionId, undefined, 'Must not expose correctOptionId while in_progress');
    assert.equal(item.explanation, undefined, 'Must not expose explanation while in_progress');
    assert.equal(item.isCorrect, undefined, 'Must not expose isCorrect while in_progress');
    assert.equal(item.points, undefined, 'Must not expose points while in_progress');
    for (const opt of item.options) {
      assert.equal(opt.is_correct, undefined, 'Option must not expose is_correct while in_progress');
    }
  }

  // Submit an answer on attId2
  const att2Q1 = activeAtt.attempt.questions[0];
  await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId2}/answers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ attemptQuestionId: att2Q1.id, selectedOptionId: att2Q1.options[0].id }),
  });

  // Re-verify attempt after submitting 1 answer: Still no grading leak!
  const postAnsAttRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId2}`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(postAnsAttRes.status, 200);
  const postAnsAtt = await postAnsAttRes.json();
  assert.equal(postAnsAtt.attempt.score, null, 'Score must remain null after answer submission');
  assert.equal(postAnsAtt.attempt.correctCount, null);
  assert.equal(postAnsAtt.attempt.percentage, null);

  // Verify history route via HTTP has zero grading leak for in_progress items
  const histRes = await fetch(`${LIVE_BASE_URL}/api/quiz/history?page=1&limit=20`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(histRes.status, 200);
  const histData = await histRes.json();
  const inProgHist = histData.history.find((h) => h.id === attId2);
  assert.ok(inProgHist, 'attId2 must appear in history');
  assert.equal(inProgHist.status, 'in_progress');
  assert.equal(inProgHist.score, null, 'History score must be null for in_progress');
  assert.equal(inProgHist.correctCount, null);
  assert.equal(inProgHist.correct_count, null);
  assert.equal(inProgHist.percentage, null);

  // 10. Direct simultaneous submitAnswer-versus-finish race condition test
  const startP3 = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token1,
    },
    body: JSON.stringify({ attemptType: 'practice', questionCount: 2 }),
  });
  assert.equal(startP3.status, 201);
  const dataP3 = await startP3.json();
  const attId3 = dataP3.attempt.attemptId;
  const qRace = dataP3.attempt.questions[0];
  const optRace = qRace.options[0].id;

  // Fire simultaneously: answer submission vs finalize
  const [ansRaceRes, finRaceRes] = await Promise.all([
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId3}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token1,
      },
      body: JSON.stringify({ attemptQuestionId: qRace.id, selectedOptionId: optRace }),
    }),
    fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId3}/finish`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token1 },
    }),
  ]);

  // Finish must always succeed (status 200)
  assert.equal(finRaceRes.status, 200);

  // Answer is either 200 (won race, committed) or 400 (lost race, rejected as attempt already finished)
  assert.ok(
    ansRaceRes.status === 200 || ansRaceRes.status === 400,
    `Answer race status must be 200 or 400, got ${ansRaceRes.status}`
  );

  // Verify finalized attempt in DB matches authoritative answer state
  const checkAttRes = await fetch(`${LIVE_BASE_URL}/api/quiz/attempts/${attId3}`, {
    headers: { 'Authorization': 'Bearer ' + token1 },
  });
  assert.equal(checkAttRes.status, 200);
  const checkAtt = await checkAttRes.json();
  assert.equal(checkAtt.attempt.status, 'completed');

  if (ansRaceRes.status === 200) {
    // Answer was committed before finish CAS, so score and correct/incorrect count MUST reflect it!
    assert.ok(checkAtt.attempt.correctCount + checkAtt.attempt.incorrectCount === 1, 'Committed answer must be counted in finished attempt');
    assert.equal(checkAtt.attempt.unansweredCount, 1);
  } else {
    // Answer was rejected because finish won race, so score must be 0 and unanswered = 2!
    assert.equal(checkAtt.attempt.correctCount, 0);
    assert.equal(checkAtt.attempt.incorrectCount, 0);
    assert.equal(checkAtt.attempt.unansweredCount, 2);
    assert.equal(checkAtt.attempt.score, 0);
  }
});
