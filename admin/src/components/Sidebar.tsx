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
        <button
          className={`nav-item ${currentTab === "overview" ? "active" : ""}`}
          onClick={() => onSelectTab("overview")}
        >
          <span>Tổng quan</span>
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
        <div><strong>Phase 5A</strong> — Additive Delivery</div>
        <div style={{ marginTop: 4, color: "#64748b" }}>Single-Admin Protected</div>
      </div>
    </aside>
  );
};

