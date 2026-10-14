import test from 'node:test';
import assert from 'node:assert/strict';

test('FE Rewards: Spin action button disabled state logic', () => {
  const getSpinButtonState = (isAuthenticated, spinning, availableTurns, dailyEligible) => {
    if (!isAuthenticated) return { label: 'Đăng nhập để quay', disabled: false, action: 'login' };
    if (spinning) return { label: 'Đang quay...', disabled: true, action: 'none' };
    if (availableTurns <= 0 && !dailyEligible) return { label: 'Hết lượt quay hôm nay', disabled: true, action: 'none' };
    return { label: 'QUAY NGAY', disabled: false, action: 'spin' };
  };

  // 1. Unauthenticated -> prompt login
  assert.deepEqual(getSpinButtonState(false, false, 0, false), { label: 'Đăng nhập để quay', disabled: false, action: 'login' });

  // 2. Spinning in progress -> disabled
  assert.deepEqual(getSpinButtonState(true, true, 2, false), { label: 'Đang quay...', disabled: true, action: 'none' });

  // 3. Out of turns and no daily turn -> disabled
  assert.deepEqual(getSpinButtonState(true, false, 0, false), { label: 'Hết lượt quay hôm nay', disabled: true, action: 'none' });

  // 4. Has turns -> enabled
  assert.deepEqual(getSpinButtonState(true, false, 3, false), { label: 'QUAY NGAY', disabled: false, action: 'spin' });

  // 5. 0 regular turns but daily free turn eligible -> enabled
  assert.deepEqual(getSpinButtonState(true, false, 0, true), { label: 'QUAY NGAY', disabled: false, action: 'spin' });
});

test('FE Rewards: Wheel pointer target angle calculation aligns pointer to top', () => {
  const calculateTargetAngle = (targetIndex, totalSegments) => {
    const arcDeg = 360 / totalSegments;
    const segmentCenterDeg = (targetIndex * arcDeg) + (arcDeg / 2);
    return (270 - segmentCenterDeg + 360) % 360;
  };

  // For 6 segments (60 deg each):
  // Index 0 center is 30 deg -> target angle to bring 30 deg to top (270 deg) is 240 deg
  assert.equal(calculateTargetAngle(0, 6), 240);

  // Index 3 center is 210 deg -> target angle is 60 deg
  assert.equal(calculateTargetAngle(3, 6), 60);
});

test('FE Rewards: Voucher status classification and presentation logic', () => {
  const classifyVoucher = (status, expiresAt) => {
    const now = new Date('2026-10-14T10:00:00Z');
    const exp = new Date(expiresAt);

    if (status === 'redeemed') return { label: 'Đã sử dụng', color: '#7c3aed', usable: false };
    if (status === 'revoked') return { label: 'Đã thu hồi', color: '#64748b', usable: false };
    if (status === 'expired' || now > exp) return { label: 'Đã hết hạn', color: '#dc2626', usable: false };
    return { label: 'Khả dụng', color: '#16a34a', usable: true };
  };

  // Active / Usable
  assert.equal(classifyVoucher('issued', '2026-11-01T00:00:00Z').usable, true);
  assert.equal(classifyVoucher('issued', '2026-11-01T00:00:00Z').label, 'Khả dụng');

  // Expired by date
  assert.equal(classifyVoucher('issued', '2026-10-01T00:00:00Z').usable, false);
  assert.equal(classifyVoucher('issued', '2026-10-01T00:00:00Z').label, 'Đã hết hạn');

  // Redeemed
  assert.equal(classifyVoucher('redeemed', '2026-11-01T00:00:00Z').usable, false);
  assert.equal(classifyVoucher('redeemed', '2026-11-01T00:00:00Z').label, 'Đã sử dụng');

  // Revoked
  assert.equal(classifyVoucher('revoked', '2026-11-01T00:00:00Z').usable, false);
  assert.equal(classifyVoucher('revoked', '2026-11-01T00:00:00Z').label, 'Đã thu hồi');
});

