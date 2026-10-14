import React from "react";
import type { AdminTab } from "../types";

interface SidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  activeProfileName?: string;
  visitorsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeProfileName,
  visitorsCount = 0,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-badge">Quản trị Đắk Song</div>
        <div className="brand-title">Admin Dashboard</div>
        <div className="brand-sub">Hệ thống Du lịch thông minh VNA</div>
      </div>

      <nav className="sidebar-nav">
        <div
          style={{
            padding: "8px 16px 4px",
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          VẬN HÀNH DU LỊCH
        </div>

        <button
          className={`nav-item ${currentTab === "revenue" ? "active" : ""}`}
          onClick={() => onSelectTab("revenue")}
        >
          <span>Doanh thu mô phỏng</span>
        </button>

        <button
          className={`nav-item ${currentTab === "tours" ? "active" : ""}`}
          onClick={() => onSelectTab("tours")}
        >
          <span>Quản lý Tour</span>
        </button>

        <button
          className={`nav-item ${currentTab === "services" ? "active" : ""}`}
          onClick={() => onSelectTab("services")}
        >
          <span>Dịch vụ & Bảng giá</span>
        </button>

        <button
          className={`nav-item ${currentTab === "bookings" ? "active" : ""}`}
          onClick={() => onSelectTab("bookings")}
        >
          <span>Quản lý Đơn đặt</span>
        </button>

        
        <div
          style={{
            padding: "16px 16px 4px",
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          TRÒ CHƠI & TƯƠNG TÁC
        </div>

        <button
          className={"nav-item " + (currentTab === "quiz_questions" ? "active" : "")}
          onClick={() => onSelectTab("quiz_questions")}
        >
          <span>Ngân hàng câu hỏi</span>
        </button>

        <button
          className={"nav-item " + (currentTab === "quiz_challenges" ? "active" : "")}
          onClick={() => onSelectTab("quiz_challenges")}
        >
          <span>Bộ đề & Thử thách</span>
        </button>

        <button
          className={"nav-item " + (currentTab === "quiz_analytics" ? "active" : "")}
          onClick={() => onSelectTab("quiz_analytics")}
        >
          <span>Kết quả & Thống kê</span>
        </button>

        <div
          style={{
            padding: "16px 16px 4px",
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          ƯU ĐÃI & PHẦN THƯỞNG
        </div>

        <button
          className={"nav-item " + (currentTab === "reward_campaigns" ? "active" : "")}
          onClick={() => onSelectTab("reward_campaigns")}
        >
          <span>Chiến dịch & Voucher</span>
        </button>

        <button
          className={"nav-item " + (currentTab === "reward_spins" ? "active" : "")}
          onClick={() => onSelectTab("reward_spins")}
        >
          <span>Vòng quay may mắn</span>
        </button>

        <button
          className={"nav-item " + (currentTab === "reward_redemptions" ? "active" : "")}
          onClick={() => onSelectTab("reward_redemptions")}
        >
          <span>Ví & Quét xác nhận</span>
        </button>

        <button
          className={"nav-item " + (currentTab === "reward_analytics" ? "active" : "")}
          onClick={() => onSelectTab("reward_analytics")}
        >
          <span>Thống kê phần thưởng</span>
        </button>

        <div
          style={{
            padding: "16px 16px 4px",
            fontSize: 11,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          HỆ THỐNG & AI
        </div>

        <button
          className={`nav-item ${currentTab === "overview" ? "active" : ""}`}
          onClick={() => onSelectTab("overview")}
        >
          <span>Tổng quan kỹ thuật</span>
        </button>

        <button
          className={`nav-item ${currentTab === "visitors" ? "active" : ""}`}
          onClick={() => onSelectTab("visitors")}
        >
          <span>Người dùng lưu</span>
          {visitorsCount > 0 && <span className="nav-badge">{visitorsCount}</span>}
        </button>

        <button
          className={`nav-item ${currentTab === "profiles" ? "active" : ""}`}
          onClick={() => onSelectTab("profiles")}
        >
          <span>Cấu hình AI</span>
          {activeProfileName && <span className="nav-badge" title="Profile đang kích hoạt">Active</span>}
        </button>

        <button
          className={`nav-item ${currentTab === "logs" ? "active" : ""}`}
          onClick={() => onSelectTab("logs")}
        >
          <span>Nhật ký & Thống kê</span>
        </button>

        <button
          className={`nav-item ${currentTab === "settings" ? "active" : ""}`}
          onClick={() => onSelectTab("settings")}
        >
          <span>Hạ tầng & Cài đặt</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div><strong>Phase 8.4</strong> — Tourism Quiz & Daily Challenge</div>
        <div style={{ marginTop: 4, color: "#64748b" }}>Single-Admin Protected</div>
      </div>
    </aside>
  );
};
