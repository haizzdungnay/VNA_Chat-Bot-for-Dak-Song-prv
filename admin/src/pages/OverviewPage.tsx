import React from "react";
import type { SystemOverview } from "../types";

interface OverviewPageProps {
  overview: SystemOverview | null;
  onNavigateTab: (tab: any) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ overview, onNavigateTab }) => {
  return (
    <div>
      {/* Privacy & Truth in Data Banner */}
      <div className="notice-box notice-info">
        <div>
          <strong>Nguyên tắc minh bạch dữ liệu:</strong> Toàn bộ số liệu trên bảng điều khiển được thống kê từ dữ liệu THẬT trong hệ thống. Nếu một chỉ số chưa bật thu thập hoặc chưa có bản ghi, hệ thống sẽ hiển thị trung thực trạng thái thay vì hiển thị dữ liệu giả lập.
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-kpi">
        <div className="kpi-card">
          <div className="kpi-label">Hồ sơ người dùng lưu</div>
          <div className="kpi-value">{overview ? overview.visitorConsentCount : "..."}</div>
          <div className="kpi-hint">Đã đồng ý lưu server hợp lệ</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Tổng lượt gọi Chat</div>
          <div className="kpi-value">
            {overview?.telemetryActive ? overview.totalChatRequests : "Chưa bật"}
          </div>
          <div className="kpi-hint">
            {overview?.telemetryActive ? "Ghi nhận từ lúc bật telemetry" : "Telemetry đang tắt"}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Lỗi 429 / 503 Upstream</div>
          <div className="kpi-value">
            {overview?.telemetryActive
              ? `${overview.rateLimit429Count} / ${overview.upstream503Count}`
              : "0"}
          </div>
          <div className="kpi-hint">Rate limit & quá tải upstream</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Độ trễ trung bình</div>
          <div className="kpi-value">
            {overview?.telemetryActive && overview.averageLatencyMs > 0
              ? `${overview.averageLatencyMs}ms`
              : "—"}
          </div>
          <div className="kpi-hint">Thời gian phản hồi AI upstream</div>
        </div>
      </div>

      {/* Active AI Runtime Profile Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Cấu hình AI đang phục vụ người dùng</h2>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigateTab("profiles")}>
            Quản lý profiles
          </button>
        </div>
        {overview?.activeProfile ? (
          <div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <span className="badge badge-active">Đang hoạt động</span>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{overview.activeProfile.name}</span>
              <span className="badge badge-neutral">
                Nguồn: {overview.activeProfile.source === "database" ? "D1 Database Profile" : "Worker Env (Cố định)"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, fontSize: 13 }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Model AI: </span>
                <code>{overview.activeProfile.model}</code>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Endpoint Base URL: </span>
                <code>{overview.activeProfile.baseUrl}</code>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Đang sử dụng cấu hình mặc định từ Worker Environment Variables.
          </div>
        )}
      </div>

      {/* System Infrastructure Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Tình trạng bảo mật & hạ tầng</h2>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigateTab("settings")}>
            Xem chi tiết
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Cloudflare Access</div>
            <div style={{ fontWeight: 600, color: overview?.accessConfigured ? "var(--success)" : "var(--warning)" }}>
              {overview?.accessConfigured ? "Đã bật & Bảo vệ Fail-Closed" : "Chưa cấu hình (Mock local dev)"}
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Master Encryption Key</div>
            <div style={{ fontWeight: 600, color: overview?.encryptionKeyConfigured ? "var(--success)" : "var(--danger)" }}>
              {overview?.encryptionKeyConfigured ? "AES-256-GCM Sẵn sàng" : "Chưa thiết lập ADMIN_ENCRYPTION_KEY"}
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Dynamic AI Feature Flag</div>
            <div style={{ fontWeight: 600, color: overview?.featureFlagActive ? "var(--success)" : "var(--text-muted)" }}>
              {overview?.featureFlagActive ? "Đang bật (D1 Active)" : "Đang tắt (Worker Env Safe Baseline)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

