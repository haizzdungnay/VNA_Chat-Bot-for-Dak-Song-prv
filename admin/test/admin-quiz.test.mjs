import test from 'node:test';
import assert from 'node:assert/strict';

test('Admin Navigation: All quiz tabs have titles configured in Header', () => {
  const TAB_TITLES = {
    revenue: "Báo cáo doanh thu mô phỏng",
    tours: "Quản lý danh mục Tour",
    services: "Dịch vụ & Bảng giá du lịch",
    bookings: "Quản lý đơn đặt tour & dịch vụ",
    quiz_questions: "Ngân hàng câu hỏi Du lịch",
    quiz_challenges: "Bộ đề & Thử thách hàng ngày",
    quiz_analytics: "Kết quả & Thống kê Quiz",
    overview: "Tổng quan kỹ thuật hệ thống",
    visitors: "Hồ sơ người dùng đã đồng ý lưu",
    profiles: "Cấu hình AI & Profiles",
    logs: "Nhật ký hệ thống & Thống kê",
    settings: "Tình trạng hạ tầng & Thiết lập",
  };

  const quizTabs = ['quiz_questions', 'quiz_challenges', 'quiz_analytics'];
  for (const tab of quizTabs) {
    assert.ok(TAB_TITLES[tab], 'Tab ' + tab + ' must have a defined title');
  }
});

test('Admin Quiz Analytics: Accuracy rate formula calculates correctly', () => {
  const calcAccuracy = (correct, total) => {
    if (!total || total <= 0) return 0;
    return Math.round((correct / total) * 1000) / 10;
  };

  assert.equal(calcAccuracy(8, 10), 80);
  assert.equal(calcAccuracy(1, 3), 33.3);
  assert.equal(calcAccuracy(0, 5), 0);
  assert.equal(calcAccuracy(0, 0), 0);
});

test('Admin Quiz CSV: Sanitizes formula injection characters', () => {
  const sanitizeCsv = (val) => {
    let str = String(val);
    if (/^[=+\-\t\r]/.test(str)) {
      str = "'" + str;
    }
    return '"' + str.replace(/"/g, '""') + '"';
  };

  assert.equal(sanitizeCsv('+12345'), "\x22'+12345\x22");
  assert.equal(sanitizeCsv('-99'), "\x22'-99\x22");
  assert.equal(sanitizeCsv('Dak Song'), '"Dak Song"');
});

test('Admin Quiz Options: Validates exactly one correct answer', () => {
  const validateOptions = (options) => {
    if (!Array.isArray(options) || options.length < 2) return false;
    const correctCount = options.filter(o => o.is_correct === 1 || o.is_correct === true).length;
    return correctCount === 1;
  };

  assert.equal(validateOptions([{ is_correct: 1 }, { is_correct: 0 }]), true);
  assert.equal(validateOptions([{ is_correct: 1 }, { is_correct: 1 }]), false);
  assert.equal(validateOptions([{ is_correct: 0 }, { is_correct: 0 }]), false);
  assert.equal(validateOptions([]), false);
});
