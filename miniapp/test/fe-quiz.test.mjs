import test from 'node:test';
import assert from 'node:assert/strict';

test('FE Quiz: Daily Challenge eligibility and completed state logic', () => {
  const getDailyChallengeButtonState = (daily, isAuthenticated) => {
    if (!isAuthenticated) return { label: 'Đăng nhập để tham gia', action: 'login', disabled: false };
    if (!daily || !daily.isOpen) return { label: 'Thử thách chưa mở', action: 'none', disabled: true };
    if (daily.hasAttempted) return { label: 'Xem kết quả bài thi', action: 'view_result', disabled: false };
    return { label: 'Bắt đầu Thử thách ngay', action: 'start', disabled: false };
  };

  // 1. Unauthenticated
  const res1 = getDailyChallengeButtonState({ isOpen: true, hasAttempted: false }, false);
  assert.equal(res1.action, 'login');

  // 2. Authenticated, not attempted
  const res2 = getDailyChallengeButtonState({ isOpen: true, hasAttempted: false }, true);
  assert.equal(res2.action, 'start');
  assert.equal(res2.disabled, false);

  // 3. Authenticated, already attempted
  const res3 = getDailyChallengeButtonState({ isOpen: true, hasAttempted: true, attemptId: 'att-123' }, true);
  assert.equal(res3.action, 'view_result');
  assert.equal(res3.disabled, false);

  // 4. Challenge closed
  const res4 = getDailyChallengeButtonState({ isOpen: false, hasAttempted: false }, true);
  assert.equal(res4.disabled, true);
});

test('FE Quiz: Option selection lock invariant once answer submitted', () => {
  const handleSelectOption = (currentState, newOptionId) => {
    if (currentState.isAnswered) {
      // Locked once answered, return unchanged
      return currentState.selectedOptionId;
    }
    return newOptionId;
  };

  // Before answering, selection changes
  let state = { isAnswered: false, selectedOptionId: null };
  state.selectedOptionId = handleSelectOption(state, 'opt-A');
  assert.equal(state.selectedOptionId, 'opt-A');

  state.selectedOptionId = handleSelectOption(state, 'opt-B');
  assert.equal(state.selectedOptionId, 'opt-B');

  // Once answered, selection locked
  state.isAnswered = true;
  state.selectedOptionId = handleSelectOption(state, 'opt-C');
  assert.equal(state.selectedOptionId, 'opt-B', 'Must not mutate once answered');
});

test('FE Quiz: Timer formatting and expiration countdown', () => {
  const formatTimer = (sec) => {
    if (sec === null || sec === undefined) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  };

  assert.equal(formatTimer(300), '05:00');
  assert.equal(formatTimer(65), '01:05');
  assert.equal(formatTimer(9), '00:09');
  assert.equal(formatTimer(0), '00:00');
  assert.equal(formatTimer(null), null);
});

test('FE Quiz: Score percentage and accurate calculations', () => {
  const calculatePercentage = (score, maxScore) => {
    if (!maxScore || maxScore <= 0) return 0;
    return Math.round((score / maxScore) * 100);
  };

  assert.equal(calculatePercentage(50, 50), 100);
  assert.equal(calculatePercentage(30, 50), 60);
  assert.equal(calculatePercentage(0, 50), 0);
  assert.equal(calculatePercentage(0, 0), 0);
});

test('FE Quiz: Related destination navigation mapping', () => {
  const getDestinationPath = (item) => {
    if (item.relatedPlaceId) return '/place/' + encodeURIComponent(item.relatedPlaceId);
    return null;
  };

  assert.equal(getDestinationPath({ relatedPlaceId: 'c5e658bd' }), '/place/c5e658bd');
  assert.equal(getDestinationPath({}), null);
});
