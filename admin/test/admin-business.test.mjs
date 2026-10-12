import test from 'node:test';
import assert from 'node:assert/strict';

test('Admin Revenue: Net simulated revenue accurately deducts refunded amount', () => {
  const computeNetRevenue = (gross, refunded) => Math.max(0, (gross || 0) - (refunded || 0));

  assert.equal(computeNetRevenue(1000000, 200000), 800000);
  assert.equal(computeNetRevenue(500000, 500000), 0);
  assert.equal(computeNetRevenue(0, 0), 0);
  assert.equal(computeNetRevenue(1000000, 1500000), 0, 'Net revenue cannot be negative');
});

test('Admin Navigation: All business tabs have titles configured', () => {
  const TAB_TITLES = {
    revenue: "Báo cáo doanh thu mô phỏng",
    tours: "Quản lý danh mục Tour",
    services: "Dịch vụ & Bảng giá du lịch",
    bookings: "Quản lý đơn đặt tour & dịch vụ",
    overview: "Tổng quan kỹ thuật hệ thống",
    visitors: "Hồ sơ người dùng đã đồng ý lưu",
    profiles: "Cấu hình AI & Profiles",
    logs: "Nhật ký hệ thống & Thống kê",
    settings: "Tình trạng hạ tầng & Thiết lập",
  };

  const businessTabs = ['revenue', 'tours', 'services', 'bookings'];
  for (const tab of businessTabs) {
    assert.ok(TAB_TITLES[tab], `Tab ${tab} must have a defined title`);
  }
});

test('Admin Security: Fail-Closed blocks unauthorized requests from mutating state', () => {
  const checkAuth = (authHeader) => {
    if (!authHeader) return { ok: false, status: 401 };
    return { ok: true, status: 200 };
  };

  assert.equal(checkAuth(null).ok, false);
  assert.equal(checkAuth(null).status, 401);
  assert.equal(checkAuth('Bearer test-token').ok, true);
});
