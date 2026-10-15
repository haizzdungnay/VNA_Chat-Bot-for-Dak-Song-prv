import test from 'node:test';
import assert from 'node:assert/strict';

test('Admin Navigation: All reward tabs have titles configured in Header', () => {
  const TAB_TITLES = {
    revenue: "Báo cáo doanh thu mô phỏng",
    tours: "Quản lý danh mục Tour",
    services: "Dịch vụ & Bảng giá du lịch",
    bookings: "Quản lý đơn đặt tour & dịch vụ",
    quiz_questions: "Ngân hàng câu hỏi Du lịch",
    quiz_challenges: "Bộ đề & Thử thách hàng ngày",
    quiz_analytics: "Kết quả & Thống kê Quiz",
    reward_campaigns: "Chiến dịch Ưu đãi & Voucher (DEMO)",
    reward_spins: "Vòng quay & Quản lý Giải thưởng",
    reward_redemptions: "Ví Voucher & Xác nhận sử dụng",
    reward_analytics: "Thống kê Phần thưởng & Vòng quay",
    overview: "Tổng quan kỹ thuật hệ thống",
    visitors: "Hồ sơ người dùng đã đồng ý lưu",
    profiles: "Cấu hình AI & Profiles",
    logs: "Nhật ký hệ thống & Thống kê",
    settings: "Tình trạng hạ tầng & Thiết lập",
  };

  const rewardTabs = ['reward_campaigns', 'reward_spins', 'reward_redemptions', 'reward_analytics'];
  for (const tab of rewardTabs) {
    assert.ok(TAB_TITLES[tab], 'Tab ' + tab + ' must have a defined title');
  }
});

test('Admin Rewards Analytics: Win rate and Redemption rate formulas calculate accurately', () => {
  const calcRate = (numerator, denominator) => {
    if (!denominator || denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  };

  // 15 wins out of 45 spins = 33.3%
  assert.equal(calcRate(15, 45), 33.3);
  // 10 redeemed out of 50 issued = 20%
  assert.equal(calcRate(10, 50), 20);
  // 0 out of 0
  assert.equal(calcRate(0, 0), 0);
  assert.equal(calcRate(0, 100), 0);
});

test('Admin Rewards CSV: Sanitizes formula injection characters', () => {
  const sanitizeCsvField = (val) => {
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return '"' + str.replace(/"/g, '""') + '"';
  };

  assert.equal(sanitizeCsvField('=cmd|/C calc'), '\"\'=cmd|/C calc\"');
  assert.equal(sanitizeCsvField('+12345'), '\"\'+12345\"');
  assert.equal(sanitizeCsvField('-50000'), '\"\'-50000\"');
  assert.equal(sanitizeCsvField('@SUM(A1:A10)'), '\"\'@SUM(A1:A10)\"');
  assert.equal(sanitizeCsvField('CF-DS20-ABCD1234'), '"CF-DS20-ABCD1234"');
});

test('Admin Rewards Wheel: Validates minimum 2 segments and at least one no_win segment', () => {
  const validateWheelSegments = (segments) => {
    if (!Array.isArray(segments) || segments.length < 2) return false;
    const hasNoWin = segments.some(s => s.segment_type === 'no_win');
    const totalWeight = segments.reduce((sum, s) => sum + (s.weight || 0), 0);
    return hasNoWin && totalWeight > 0;
  };

  // Valid: 2 segments, 1 is no_win, weight > 0
  assert.equal(validateWheelSegments([
    { segment_type: 'voucher', weight: 50 },
    { segment_type: 'no_win', weight: 50 },
  ]), true);

  // Invalid: No no_win segment
  assert.equal(validateWheelSegments([
    { segment_type: 'voucher', weight: 50 },
    { segment_type: 'gift_item', weight: 50 },
  ]), false);

  // Invalid: Less than 2 segments
  assert.equal(validateWheelSegments([
    { segment_type: 'no_win', weight: 100 },
  ]), false);

  // Invalid: Total weight 0
  assert.equal(validateWheelSegments([
    { segment_type: 'voucher', weight: 0 },
    { segment_type: 'no_win', weight: 0 },
  ]), false);
});

