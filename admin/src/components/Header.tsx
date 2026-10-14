import React from "react";
import type { AdminTab } from "../types";

interface HeaderProps {
  currentTab: AdminTab;
  onRefresh: () => void;
  isLoading: boolean;
  adminEmail?: string;
  isDevMock?: boolean;
}

const TAB_TITLES: Record<AdminTab, string> = {
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
  operations: "Vận hành & Nghiệm thu tích hợp",
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onRefresh,
  isLoading,
  adminEmail = "admin@daksong.vn",
  isDevMock = false,
}) => {
  return (
    <header className="topbar">
      <div>
        <h1 className="page-title">{TAB_TITLES[currentTab]}</h1>
      </div>
      <div className="topbar-right">
        {isDevMock ? (
          <div className="badge badge-warning" title="Chế độ giả lập dành riêng cho môi trường kiểm thử local">
            Mock Mode (Dev)
          </div>
        ) : (
          <div className="badge badge-success" title="Xác thực qua Cloudflare Access">
            Cloudflare Access
          </div>
        )}
        <div className="admin-tag">
          <span className="status-dot"></span>
          <span>{adminEmail}</span>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={onRefresh}
          disabled={isLoading}
          title="Tải lại dữ liệu"
        >
          {isLoading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>
    </header>
  );
};
