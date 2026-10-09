import React, { useState } from "react";
import type { AuditLogItem, TelemetryEventItem } from "../types";

interface LogsPageProps {
  auditLogs: AuditLogItem[];
  telemetryEvents: TelemetryEventItem[];
  isLoading: boolean;
}

export const LogsPage: React.FC<LogsPageProps> = ({ auditLogs, telemetryEvents, isLoading }) => {
  const [activeSubTab, setActiveSubTab] = useState<"audit" | "telemetry">("audit");

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          className={`btn ${activeSubTab === "audit" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveSubTab("audit")}
        >
          Nhật ký Kiểm toán (Audit Trail) ({auditLogs.length})
        </button>
        <button
          className={`btn ${activeSubTab === "telemetry" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setActiveSubTab("telemetry")}
        >
          Nhật ký Cuộc gọi & Lỗi (Telemetry) ({telemetryEvents.length})
        </button>
      </div>

      {activeSubTab === "audit" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Nhật ký Thao tác Quản trị (Admin Audit Logs)</h2>
          </div>
          {isLoading ? (
            <div className="empty-state">Đang tải nhật ký...</div>
          ) : auditLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Chưa có bản ghi kiểm toán nào</div>
              <p>Mọi hành động tạo, cập nhật, kích hoạt và rollback profile sẽ được ghi nhận tại đây.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Thao tác</th>
                    <th>Người thực hiện</th>
                    <th>Chi tiết sự kiện</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td>
                        <span className="badge badge-active">{log.action}</span>
                      </td>
                      <td>
                        <code>{log.actor}</code>
                      </td>
                      <td>
                        <pre style={{ fontSize: 11, background: "var(--bg)", padding: "4px 8px", borderRadius: 4, overflowX: "auto" }}>
                          {log.detailsJson || "—"}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "telemetry" && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Thống kê Cuộc gọi & Sự cố (Telemetry Events)</h2>
          </div>
          {isLoading ? (
            <div className="empty-state">Đang tải sự kiện telemetry...</div>
          ) : telemetryEvents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Chưa có sự kiện telemetry nào được thu thập</div>
              <p>Hệ thống chỉ lưu số liệu khi telemetry được kích hoạt. Không lưu nội dung chat hay PII người dùng.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Loại sự kiện</th>
                    <th>Mã HTTP</th>
                    <th>Thời gian xử lý</th>
                    <th>Mã lỗi</th>
                    <th>Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetryEvents.map((t) => (
                    <tr key={t.id}>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(t.createdAt).toLocaleString("vi-VN")}
                      </td>
                      <td>
                        <code>{t.eventType}</code>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            t.statusCode >= 200 && t.statusCode < 300
                              ? "badge-success"
                              : t.statusCode === 429
                              ? "badge-warning"
                              : "badge-danger"
                          }`}
                        >
                          {t.statusCode}
                        </span>
                      </td>
                      <td>{t.durationMs}ms</td>
                      <td>{t.errorType ? <code>{t.errorType}</code> : "—"}</td>
                      <td>{t.tokensUsed != null ? t.tokensUsed : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

