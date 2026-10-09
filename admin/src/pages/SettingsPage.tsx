import React from "react";
import type { SystemOverview } from "../types";

interface SettingsPageProps {
  overview: SystemOverview | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ overview }) => {
  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Cấu hình Bảo mật Cloudflare Access & Fail-Closed</h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-main)", marginBottom: 16 }}>
          Hệ thống quản trị áp dụng mô hình Zero Trust. Toàn bộ endpoint <code>/api/admin/*</code> được bảo vệ bởi Cloudflare Access JWT validation server-side với chính sách allowlist nghiêm ngặt chỉ 01 quản trị viên duy nhất.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
          <div style={{ padding: 14, background: "var(--bg)", borderRadius: "var(--radius)" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Biến môi trường Cloudflare Access</div>
            <div><code>CF_ACCESS_TEAM_NAME</code>: Tên Team Cloudflare Zero Trust</div>
            <div><code>CF_ACCESS_AUD</code>: Application Audience Tag (AUD)</div>
            <div><code>ADMIN_EMAIL_ALLOWLIST</code>: Email duy nhất của chủ dự án</div>
            <div style={{ marginTop: 8, color: overview?.accessConfigured ? "var(--success)" : "var(--warning)", fontWeight: 600 }}>
              Trạng thái: {overview?.accessConfigured ? "Đang bảo vệ" : "Chưa cấu hình (Mock local dev)"}
            </div>
          </div>

          <div style={{ padding: 14, background: "var(--bg)", borderRadius: "var(--radius)" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Nguyên tắc Fail-Closed</div>
            <div>Nếu thiếu token Cloudflare Access hoặc thông tin xác thực sai lệch, Worker lập tức trả về mã <code>401 Unauthorized</code> hoặc <code>403 Forbidden</code>. Tuyệt đối không mở cổng cho public.</div>
            <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
              Chế độ vận hành: Single-Admin allowlist
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Khóa Mã hóa Bí mật (ADMIN_ENCRYPTION_KEY)</h2>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-main)", marginBottom: 16 }}>
          Khóa chủ được sử dụng bởi Web Crypto API để mã hóa AES-256-GCM các khóa API trước khi lưu vào D1 Database. Khóa này chỉ tồn tại trong Cloudflare Worker Secrets hoặc file <code>.dev.vars</code> local.
        </p>

        <div className="notice-box notice-info">
          <div>
            <strong>Hướng dẫn tạo khóa bí mật độ dài 256-bit (32 bytes):</strong>
            <pre style={{ marginTop: 8, background: "rgba(0,0,0,0.05)", padding: "8px 12px", borderRadius: 4 }}>
openssl rand -hex 32
            </pre>
            <div style={{ marginTop: 8 }}>
              Nạp vào Worker thông qua lệnh: <code>npx wrangler secret put ADMIN_ENCRYPTION_KEY</code>.
            </div>
            <div style={{ marginTop: 8, fontWeight: 600, color: overview?.encryptionKeyConfigured ? "var(--success)" : "var(--danger)" }}>
              Khóa chủ trên máy chủ: {overview?.encryptionKeyConfigured ? "Đã nạp" : "Chưa phát hiện"}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Cơ chế Cứu hộ Khẩn cấp Demo</h2>
        </div>
        <div style={{ fontSize: 14, color: "var(--text-main)" }}>
          <p style={{ marginBottom: 12 }}>
            Nếu có bất kỳ sự cố nào xảy ra trong quá trình cấu hình dynamic:
          </p>
          <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <li>
              Giữ nguyên biến môi trường <code>ADMIN_AI_CONFIG_ENABLED=false</code> trong Worker.
            </li>
            <li>
              Worker sẽ tự động bỏ qua toàn bộ profile động trong D1 và chạy 100% bằng cấu hình tĩnh của hệ thống demo gốc.
            </li>
            <li>
              Mini App Zalo không bị ảnh hưởng và hoạt động hoàn toàn bình thường.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};

