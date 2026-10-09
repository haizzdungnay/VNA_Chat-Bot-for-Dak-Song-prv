import React, { useState } from "react";
import type { AdminAIProfile, AdminAIProfileInput } from "../types";
import { ConfirmModal } from "../components/ConfirmModal";

interface AIProfilesPageProps {
  profiles: AdminAIProfile[];
  isLoading: boolean;
  onRefresh: () => void;
  onCreateProfile: (input: AdminAIProfileInput) => Promise<void>;
  onUpdateProfile: (id: string, input: Partial<AdminAIProfileInput>) => Promise<void>;
  onDeleteProfile: (id: string) => Promise<void>;
  onTestProfile: (id: string) => Promise<void>;
  onActivateProfile: (id: string) => Promise<void>;
  onRollbackToEnv: () => Promise<void>;
  featureFlagActive: boolean;
}

export const AIProfilesPage: React.FC<AIProfilesPageProps> = ({
  profiles,
  isLoading,
  onCreateProfile,
  onDeleteProfile,
  onTestProfile,
  onActivateProfile,
  onRollbackToEnv,
  featureFlagActive,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AdminAIProfileInput>({
    name: "",
    providerType: "openai-compatible",
    baseUrl: "https://rrdf59c.abc-tunnel.us/v1",
    model: "ag/gemini-3.8-flash-low",
    apiKey: "",
    reasoningEffort: "low",
    jsonMode: false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      providerType: "openai-compatible",
      baseUrl: "https://rrdf59c.abc-tunnel.us/v1",
      model: "ag/gemini-3.8-flash-low",
      apiKey: "",
      reasoningEffort: "low",
      jsonMode: false,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleClone = (p: AdminAIProfile) => {
    setFormData({
      name: `${p.name} (Bản sao)`,
      providerType: p.providerType,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: "", // Key requires re-input or reuse existing encrypted key if supported
      reasoningEffort: p.reasoningEffort,
      jsonMode: p.jsonMode,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError("Vui lòng nhập tên cấu hình");
      return;
    }
    if (!formData.baseUrl.startsWith("https://")) {
      setFormError("Base URL bắt buộc phải là HTTPS an toàn");
      return;
    }
    if (!formData.model.trim()) {
      setFormError("Vui lòng nhập tên model AI");
      return;
    }
    if (!formData.apiKey?.trim()) {
      setFormError("Vui lòng nhập API Key cho cấu hình này");
      return;
    }

    try {
      await onCreateProfile(formData);
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Lỗi khi lưu cấu hình");
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await onTestProfile(id);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div>
      {/* Notice Banner */}
      <div className="notice-box notice-info">
        <div>
          <strong>Quản lý Cấu hình AI Đa Profile:</strong>
          <div style={{ marginTop: 4 }}>
            Mọi API Key được mã hóa AES-256-GCM ở tầng máy chủ trước khi lưu vào D1. Khi chuyển đổi profile, hệ thống không yêu cầu nhập lại khóa. Key không bao giờ được trả về dưới dạng văn bản gốc.
          </div>
        </div>
      </div>

      {!featureFlagActive && (
        <div className="notice-box notice-warn">
          <div>
            <strong>Feature Flag ADMIN_AI_CONFIG_ENABLED đang TẮT:</strong>
            <div style={{ marginTop: 4 }}>
              Chatbot hiện tại đang được bảo vệ an toàn và sử dụng cấu hình cố định từ Worker Environment Variables. Chỉ khi flag này được bật và profile được kích hoạt, hệ thống mới chuyển sang dùng runtime profile D1.
            </div>
          </div>
        </div>
      )}

      {/* Profiles Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Danh sách cấu hình AI ({profiles.length})</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowRollbackModal(true)}
              title="Khôi phục trạng thái Worker Env gốc"
            >
              Rollback về Worker Env
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
              + Thêm cấu hình mới
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">Đang tải danh sách profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Chưa có cấu hình AI nào được lưu trong cơ sở dữ liệu</div>
            <p>Hệ thống hiện tại đang sử dụng cấu hình tĩnh từ Worker Environment Variables.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tên cấu hình</th>
                  <th>Model</th>
                  <th>Endpoint Base URL</th>
                  <th>API Key Masked</th>
                  <th>Trạng thái test</th>
                  <th>Tình trạng</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.providerType}</div>
                    </td>
                    <td>
                      <code>{p.model}</code>
                      {p.reasoningEffort && p.reasoningEffort !== "none" && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>
                          ({p.reasoningEffort})
                        </span>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: 12 }}>{p.baseUrl}</code>
                    </td>
                    <td>
                      <code>••••••••{p.keySuffix}</code>
                    </td>
                    <td>
                      {p.testStatus === "success" && (
                        <span className="badge badge-success">Thành công</span>
                      )}
                      {p.testStatus === "failed" && (
                        <span className="badge badge-danger" title={p.testError || "Lỗi kiểm tra"}>
                          Thất bại
                        </span>
                      )}
                      {p.testStatus === "degraded" && (
                        <span className="badge badge-warning" title={p.testError || "Quota/Thử lại"}>
                          429 Quota
                        </span>
                      )}
                      {p.testStatus === "untested" && (
                        <span className="badge badge-neutral">Chưa test</span>
                      )}
                    </td>
                    <td>
                      {p.isActive ? (
                        <span className="badge badge-active">ACTIVE</span>
                      ) : (
                        <span className="badge badge-neutral">SAVED</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={testingId === p.id}
                          onClick={() => handleTest(p.id)}
                          title="Kiểm tra kết nối tới AI upstream"
                        >
                          {testingId === p.id ? "Đang test..." : "Test"}
                        </button>

                        {!p.isActive && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setActivatingId(p.id)}
                            title="Kích hoạt cấu hình này làm profile chính thức"
                          >
                            Kích hoạt
                          </button>
                        )}

                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleClone(p)}
                          title="Nhân bản cấu hình"
                        >
                          Clone
                        </button>

                        {!p.isActive && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeletingId(p.id)}
                            title="Xóa cấu hình"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Profile Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Thêm Cấu hình AI Mới</h3>
              <button
                className="btn btn-outline btn-sm"
                style={{ border: "none", fontSize: 18 }}
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="notice-box notice-danger" style={{ marginBottom: 12 }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Tên cấu hình *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: Google Gemini 2.5 Flash Lite (Chính thức)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Loại Provider</label>
                  <select
                    className="form-control"
                    value={formData.providerType}
                    onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
                  >
                    <option value="openai-compatible">OpenAI-Compatible (Google/Groq/OpenAI/v.v.)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">HTTPS Base URL *</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    required
                  />
                  <div className="form-hint">
                    Bắt buộc HTTPS. Chỉ cho phép các host AI uy tín (SSRF Protection).
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Model AI *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="gemini-2.5-flash-lite hoặc gpt-4o-mini"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">API Key *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Nhập khóa API bí mật..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    required
                    autoComplete="new-password"
                  />
                  <div className="form-hint">
                    Khóa được mã hóa AES-256-GCM tại server. Không bao giờ hiển thị lại sau khi lưu.
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Reasoning Effort</label>
                    <select
                      className="form-control"
                      value={formData.reasoningEffort}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reasoningEffort: e.target.value as any,
                        })
                      }
                    >
                      <option value="low">Low (Mặc định)</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="none">None</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">JSON Mode</label>
                    <select
                      className="form-control"
                      value={formData.jsonMode ? "true" : "false"}
                      onChange={(e) =>
                        setFormData({ ...formData, jsonMode: e.target.value === "true" })
                      }
                    >
                      <option value="false">Tắt (Mặc định)</option>
                      <option value="true">Bật (json_object)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu & Mã hóa Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation: Activate Profile */}
      <ConfirmModal
        isOpen={Boolean(activatingId)}
        title="Xác nhận kích hoạt Profile AI"
        message="Hệ thống sẽ chuyển toàn bộ yêu cầu Chatbot sang cấu hình này. Thao tác này được ghi nhận vào nhật ký kiểm toán (Audit Trail)."
        confirmText="Kích hoạt ngay"
        onConfirm={async () => {
          if (activatingId) {
            await onActivateProfile(activatingId);
            setActivatingId(null);
          }
        }}
        onCancel={() => setActivatingId(null)}
      />

      {/* Confirmation: Delete Profile */}
      <ConfirmModal
        isOpen={Boolean(deletingId)}
        title="Xác nhận xóa Profile"
        message="Bạn có chắc chắn muốn xóa cấu hình này? Dữ liệu đã mã hóa và khóa liên quan sẽ bị xóa vĩnh viễn."
        confirmText="Xóa vĩnh viễn"
        isDanger={true}
        onConfirm={async () => {
          if (deletingId) {
            await onDeleteProfile(deletingId);
            setDeletingId(null);
          }
        }}
        onCancel={() => setDeletingId(null)}
      />

      {/* Confirmation: Rollback to Env */}
      <ConfirmModal
        isOpen={showRollbackModal}
        title="Xác nhận Rollback về Worker Environment Variables"
        message="Hệ thống sẽ gỡ bỏ trạng thái Active của tất cả profile D1 và chuyển 100% về cấu hình tĩnh gốc từ Worker Env. Phục vụ cứu hộ khẩn cấp trước demo."
        confirmText="Rollback ngay"
        isDanger={true}
        onConfirm={async () => {
          await onRollbackToEnv();
          setShowRollbackModal(false);
        }}
        onCancel={() => setShowRollbackModal(false)}
      />
    </div>
  );
};

