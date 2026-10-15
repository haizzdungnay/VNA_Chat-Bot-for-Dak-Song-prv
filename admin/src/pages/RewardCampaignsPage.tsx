import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/api";
import type { AdminRewardCampaign, AdminRewardVoucherTemplate } from "../types";

interface Props {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const RewardCampaignsPage: React.FC<Props> = ({ onNotify }) => {
  const [campaigns, setCampaigns] = useState<AdminRewardCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [templates, setTemplates] = useState<AdminRewardVoucherTemplate[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<"lucky_spin" | "standard" | "quiz_reward">("lucky_spin");
  const [formQuota, setFormQuota] = useState(1000);
  const [formPerUser, setFormPerUser] = useState(5);
  const [formAllowDaily, setFormAllowDaily] = useState(true);
  const [formQuizScore, setFormQuizScore] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getRewardCampaigns(1, 50, statusFilter || undefined);
      setCampaigns(res.campaigns || []);
      if (res.campaigns?.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(res.campaigns[0].id);
      }
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải chiến dịch");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedCampaignId, onNotify]);

  const loadTemplates = useCallback(async (campaignId: string) => {
    try {
      const res = await adminApi.getRewardTemplates(campaignId);
      setTemplates(res.templates || []);
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải danh sách mẫu voucher");
    }
  }, [onNotify]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      loadTemplates(selectedCampaignId);
    }
  }, [selectedCampaignId, loadTemplates]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode || !formTitle) {
      onNotify?.("error", "Vui lòng điền mã và tiêu đề chiến dịch");
      return;
    }

    setSubmitting(true);
    try {
      await adminApi.createRewardCampaign({
        code: formCode,
        title: formTitle,
        description: formDesc,
        campaignType: formType,
        totalQuota: Number(formQuota),
        perUserLimit: Number(formPerUser),
        eligibilityRules: {
          allow_free_daily: formAllowDaily,
          quiz_reward_min_score: Number(formQuizScore),
        },
      });
      onNotify?.("success", "Tạo chiến dịch mới thành công!");
      setShowCreateModal(false);
      setFormCode("");
      setFormTitle("");
      setFormDesc("");
      loadCampaigns();
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tạo chiến dịch");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await adminApi.setRewardCampaignStatus(id, newStatus);
      onNotify?.("success", "Đã cập nhật trạng thái chiến dịch thành " + newStatus);
      loadCampaigns();
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi cập nhật trạng thái");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="published">Đã công bố (Published)</option>
            <option value="draft">Bản nháp (Draft)</option>
            <option value="paused">Tạm dừng (Paused)</option>
            <option value="closed">Đã đóng (Closed)</option>
          </select>
          <span style={{ fontSize: 13, color: "#64748b" }}>{campaigns.length} chiến dịch</span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreateModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            add_circle
          </span>
          Tạo chiến dịch mới
        </button>
      </div>

      {/* Campaigns Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px" }}>MÃ / TIÊU ĐỀ</th>
              <th style={{ padding: "12px 16px" }}>LOẠI</th>
              <th style={{ padding: "12px 16px" }}>TRẠNG THÁI</th>
              <th style={{ padding: "12px 16px" }}>HẠN MỨC QUOTA</th>
              <th style={{ padding: "12px 16px" }}>NGÀY TẠO</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Đang tải chiến dịch...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Chưa có chiến dịch nào.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const isSelected = selectedCampaignId === c.id;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCampaignId(c.id)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: 13,
                      cursor: "pointer",
                      background: isSelected ? "rgba(19, 122, 62, 0.04)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <strong>{c.title}</strong>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Mã: {c.code}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className="badge badge-info">{c.campaign_type}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className={
                          c.status === "published"
                            ? "badge badge-success"
                            : c.status === "paused"
                            ? "badge badge-warning"
                            : "badge badge-muted"
                        }
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {c.total_quota > 0 ? c.total_quota : "Không giới hạn"} (Tối đa {c.per_user_limit}/khách)
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>
                      {c.created_at.slice(0, 10)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {c.status === "draft" && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(c.id, "published");
                          }}
                        >
                          Công bố
                        </button>
                      )}
                      {c.status === "published" && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(c.id, "paused");
                          }}
                        >
                          Tạm dừng
                        </button>
                      )}
                      {c.status === "paused" && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(c.id, "published");
                          }}
                        >
                          Kích hoạt lại
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selected Campaign Templates Sub-Section */}
      {selectedCampaignId && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px 0" }}>
            Mẫu Voucher liên kết với chiến dịch ({templates.length})
          </h3>
          {templates.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
              Chiến dịch này chưa có mẫu voucher nào được cấu hình.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                    background: "#f8fafc",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 14 }}>{tpl.title}</strong>
                    <span className="badge badge-success">{tpl.discount_display}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Tiền tố mã: <code>{tpl.code_prefix}</code> • {tpl.category_label}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    Tồn kho: {tpl.total_stock === -1 ? "Vô hạn" : `${tpl.issued_count}/${tpl.total_stock}`} • HSD: {tpl.validity_days} ngày
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: 24,
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700 }}>
              Tạo chiến dịch Ưu đãi / Vòng quay mới
            </h3>
            <form onSubmit={handleCreateCampaign} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Mã chiến dịch (Code)</label>
                <input
                  type="text"
                  placeholder="VD: DAK_SONG_SUMMER_2026"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tiêu đề chiến dịch</label>
                <input
                  type="text"
                  placeholder="VD: Mùa Vàng Đắk Song 2026"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Mô tả</label>
                <textarea
                  placeholder="Mô tả chiến dịch ưu đãi..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Loại chiến dịch</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    <option value="lucky_spin">Vòng quay may mắn</option>
                    <option value="quiz_reward">Thưởng từ Quiz</option>
                    <option value="standard">Tiêu chuẩn</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Tổng lượt phát (Quota)</label>
                  <input
                    type="number"
                    value={formQuota}
                    onChange={(e) => setFormQuota(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Giới hạn mỗi khách</label>
                  <input
                    type="number"
                    value={formPerUser}
                    onChange={(e) => setFormPerUser(Number(e.target.value))}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <input
                  type="checkbox"
                  id="chkDaily"
                  checked={formAllowDaily}
                  onChange={(e) => setFormAllowDaily(e.target.checked)}
                />
                <label htmlFor="chkDaily" style={{ fontSize: 13, cursor: "pointer" }}>
                  Cho phép du khách nhận 1 lượt quay miễn phí mỗi ngày (Asia/Ho_Chi_Minh)
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  Ngưỡng điểm Quiz tối thiểu để nhận lượt quay
                </label>
                <input
                  type="number"
                  value={formQuizScore}
                  onChange={(e) => setFormQuizScore(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? "Đang tạo..." : "Xác nhận tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

