import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/api";
import type { AdminRewardSpinWheel, AdminRewardSpinSegment, AdminRewardVoucherTemplate } from "../types";

interface Props {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const RewardSpinsPage: React.FC<Props> = ({ onNotify }) => {
  const [wheels, setWheels] = useState<AdminRewardSpinWheel[]>([]);
  const [selectedWheelId, setSelectedWheelId] = useState<string | null>(null);
  const [segments, setSegments] = useState<AdminRewardSpinSegment[]>([]);
  const [templates, setTemplates] = useState<AdminRewardVoucherTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadWheels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getRewardWheels();
      setWheels(res.wheels || []);
      if (res.wheels?.length > 0 && !selectedWheelId) {
        setSelectedWheelId(res.wheels[0].id);
      }

      const tplRes = await adminApi.getRewardTemplates();
      setTemplates(tplRes.templates || []);
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải danh sách vòng quay");
    } finally {
      setLoading(false);
    }
  }, [selectedWheelId, onNotify]);

  const loadWheelDetail = useCallback(async (wheelId: string) => {
    try {
      const res = await adminApi.getRewardWheelDetail(wheelId);
      setSegments(res.segments || []);
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải chi tiết vòng quay");
    }
  }, [onNotify]);

  useEffect(() => {
    loadWheels();
  }, [loadWheels]);

  useEffect(() => {
    if (selectedWheelId) {
      loadWheelDetail(selectedWheelId);
    }
  }, [selectedWheelId, loadWheelDetail]);

  const totalWeight = segments.reduce((sum, s) => sum + (Number(s.weight) || 0), 0);

  const handleUpdateSegment = (idx: number, field: keyof AdminRewardSpinSegment, val: any) => {
    const next = [...segments];
    next[idx] = { ...next[idx], [field]: val };
    setSegments(next);
  };

  const handleAddSegment = () => {
    const nextIdx = segments.length + 1;
    setSegments([
      ...segments,
      {
        id: "temp-" + Date.now(),
        wheel_id: selectedWheelId || "",
        order_index: nextIdx,
        label: "Ô quà mới " + nextIdx,
        segment_type: "voucher",
        weight: 10,
        total_inventory: -1,
        awarded_count: 0,
        color: "#3b82f6",
      },
    ]);
  };

  const handleRemoveSegment = (idx: number) => {
    if (segments.length <= 2) {
      onNotify?.("error", "Vòng quay cần có tối thiểu 2 ô thưởng");
      return;
    }
    setSegments(segments.filter((_, i) => i !== idx));
  };

  const handleSaveSegments = async () => {
    if (!selectedWheelId) return;

    const hasNoWin = segments.some((s) => s.segment_type === "no_win");
    if (!hasNoWin) {
      onNotify?.("error", "Bắt buộc phải có ít nhất 1 ô 'Chúc may mắn lần sau' (no_win)");
      return;
    }

    if (totalWeight <= 0) {
      onNotify?.("error", "Tổng trọng số xác suất phải lớn hơn 0");
      return;
    }

    setSaving(true);
    try {
      const payload = segments.map((s) => ({
        label: s.label,
        segmentType: s.segment_type,
        voucherTemplateId: s.voucher_template_id || undefined,
        weight: Number(s.weight),
        totalInventory: Number(s.total_inventory),
        color: s.color,
      }));

      const res = await adminApi.setRewardWheelSegments(selectedWheelId, payload);
      setSegments(res.segments || []);
      onNotify?.("success", "Lưu cấu hình ô thưởng vòng quay thành công!");
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi lưu cấu hình vòng quay");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (wheelId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await adminApi.toggleRewardWheelStatus(wheelId, newStatus);
      onNotify?.("success", "Đã đổi trạng thái vòng quay thành " + newStatus);
      loadWheels();
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi đổi trạng thái");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Wheels Selector Header */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px 0" }}>
              Cấu hình Vòng quay May mắn & Tỷ lệ xác suất
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
              Thuật toán Rejection-Sampling Web Crypto từ server đảm bảo tính ngẫu nhiên trung thực và không thiên lệch.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {wheels.map((w) => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                className={`btn btn-sm ${selectedWheelId === w.id ? "btn-primary" : "btn-outline"}`}
                onClick={() => setSelectedWheelId(w.id)}
              >
                {w.title} ({w.status})
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => handleToggleStatus(w.id, w.status)}
                title="Bật / Tắt trạng thái"
              >
                {w.status === "active" ? "Tạm dừng" : "Kích hoạt"}
              </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Segments Editor Table */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
              Danh sách Ô thưởng & Trọng số ({segments.length} ô)
            </h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Tổng trọng số: <strong>{totalWeight}</strong>
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleAddSegment}>
              + Thêm ô thưởng
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveSegments}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu cấu hình tỷ lệ"}
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: 24 }}>Đang tải ô thưởng...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 12px" }}>#</th>
                  <th style={{ padding: "10px 12px" }}>NHÃN HIỂN THỊ</th>
                  <th style={{ padding: "10px 12px" }}>LOẠI Ô</th>
                  <th style={{ padding: "10px 12px" }}>MẪU VOUCHER</th>
                  <th style={{ padding: "10px 12px" }}>TRỌNG SỐ</th>
                  <th style={{ padding: "10px 12px" }}>XÁC SUẤT (%)</th>
                  <th style={{ padding: "10px 12px" }}>KHO / ĐÃ CẤP</th>
                  <th style={{ padding: "10px 12px" }}>MÀU SẮC</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>XÓA</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((seg, idx) => {
                  const prob = totalWeight > 0 ? Math.round(((seg.weight || 0) / totalWeight) * 1000) / 10 : 0;
                  return (
                    <tr key={seg.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <input
                          type="text"
                          value={seg.label}
                          onChange={(e) => handleUpdateSegment(idx, "label", e.target.value)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <select
                          value={seg.segment_type}
                          onChange={(e) => handleUpdateSegment(idx, "segment_type", e.target.value)}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                        >
                          <option value="voucher">Voucher</option>
                          <option value="no_win">Không trúng (No win)</option>
                          <option value="gift_item">Quà lưu niệm</option>
                        </select>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {seg.segment_type === "voucher" ? (
                          <select
                            value={seg.voucher_template_id || ""}
                            onChange={(e) => handleUpdateSegment(idx, "voucher_template_id", e.target.value || null)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", maxWidth: 160 }}
                          >
                            <option value="">-- Chọn mẫu voucher --</option>
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.title} ({tpl.discount_display})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>--</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <input
                          type="number"
                          min={0}
                          value={seg.weight}
                          onChange={(e) => handleUpdateSegment(idx, "weight", Number(e.target.value))}
                          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", width: 64 }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: prob > 0 ? "var(--color-primary)" : "#94a3b8" }}>
                        {prob}%
                      </td>
                      <td style={{ padding: "10px 12px", fontSize: 12 }}>
                        {seg.total_inventory === -1 ? (
                          <span className="badge badge-muted">Vô hạn</span>
                        ) : (
                          <span>
                            {seg.awarded_count} / {seg.total_inventory}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <input
                          type="color"
                          value={seg.color || "#10b981"}
                          onChange={(e) => handleUpdateSegment(idx, "color", e.target.value)}
                          style={{ width: 32, height: 28, padding: 0, border: "none", cursor: "pointer" }}
                        />
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleRemoveSegment(idx)}
                          style={{ color: "#dc2626" }}
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

