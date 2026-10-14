import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/api";
import type { AdminRewardWalletItem } from "../types";

interface Props {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const RewardRedemptionsPage: React.FC<Props> = ({ onNotify }) => {
  const [items, setItems] = useState<AdminRewardWalletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getRewardWalletItems({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: 50,
      });
      setItems(res.items || []);
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải danh sách ví voucher");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, onNotify]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleRedeem = async (voucherId: string) => {
    if (!window.confirm("Xác nhận đổi và sử dụng voucher này cho du khách tại quầy (DEMO)?")) {
      return;
    }

    setRedeemingId(voucherId);
    try {
      await adminApi.redeemRewardVoucher(voucherId, {
        reason: "Xác minh trực tiếp tại quầy thông tin du lịch Đắk Song (DEMO)",
      });
      onNotify?.("success", "Xác minh đổi voucher thành công!");
      loadItems();
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi xác minh voucher");
    } finally {
      setRedeemingId(null);
    }
  };

  const handleRevoke = async (voucherId: string) => {
    const reason = window.prompt("Nhập lý do thu hồi voucher này:");
    if (!reason) return;

    try {
      await adminApi.revokeRewardVoucher(voucherId, reason);
      onNotify?.("info", "Đã thu hồi voucher");
      loadItems();
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi thu hồi voucher");
    }
  };

  const handleQuickVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;

    try {
      await adminApi.redeemRewardVoucher(verifyCode.trim(), {
        reason: "Quét mã xác nhận nhanh tại quầy (DEMO)",
      });
      onNotify?.("success", "Quét và xác minh voucher " + verifyCode + " thành công!");
      setVerifyCode("");
      loadItems();
    } catch (err: any) {
      onNotify?.("error", err?.message || "Mã voucher không hợp lệ hoặc đã sử dụng");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Quick Redeem Scanner Card */}
      <div className="card" style={{ padding: 18, background: "#f8fafc", border: "1px dashed #cbd5e1" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px 0" }}>
          Quét / Nhập mã xác nhận tại quầy (DEMO Redemption)
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px 0" }}>
          Nhập mã voucher do du khách cung cấp từ ví Mini App để xác minh và khóa lượt dùng.
        </p>
        <form onSubmit={handleQuickVerify} style={{ display: "flex", gap: 10, maxWidth: 460 }}>
          <input
            type="text"
            placeholder="VD: CF-DS20-ABC12345"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Xác minh ngay
          </button>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="text"
            placeholder="Tìm theo mã voucher, tên, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, minWidth: 260 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="issued">Khả dụng (Issued)</option>
            <option value="redeemed">Đã sử dụng (Redeemed)</option>
            <option value="expired">Đã hết hạn (Expired)</option>
            <option value="revoked">Đã thu hồi (Revoked)</option>
          </select>
          <span style={{ fontSize: 13, color: "#64748b" }}>{items.length} voucher</span>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px" }}>MÃ VOUCHER</th>
              <th style={{ padding: "12px 16px" }}>TIÊU ĐỀ / ƯU ĐÃI</th>
              <th style={{ padding: "12px 16px" }}>NGƯỜI SỞ HỮU</th>
              <th style={{ padding: "12px 16px" }}>TRẠNG THÁI</th>
              <th style={{ padding: "12px 16px" }}>HẠN DÙNG</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Đang tải danh sách voucher...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#64748b" }}>
                  Không tìm thấy voucher nào phù hợp.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isUsable = item.status === "issued" && new Date() <= new Date(item.expires_at);
                return (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <td style={{ padding: "12px 16px" }}>
                      <code style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary)" }}>
                        {item.voucher_code}
                      </code>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Nguồn: {item.source_type}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <strong>{item.title}</strong>
                      <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                        {item.discount_display} ({item.category})
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div>{item.user_name || "Du khách"}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{item.user_email || item.user_id}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        className={
                          item.status === "issued"
                            ? "badge badge-success"
                            : item.status === "redeemed"
                            ? "badge badge-info"
                            : "badge badge-muted"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#64748b", fontSize: 12 }}>
                      {item.expires_at.slice(0, 10)}
                      {item.redeemed_at && (
                        <div style={{ fontSize: 11, color: "#7c3aed" }}>
                          Dùng lúc: {item.redeemed_at.slice(0, 16)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {isUsable && (
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => handleRedeem(item.id)}
                          disabled={redeemingId === item.id}
                          style={{ marginRight: 6 }}
                        >
                          {redeemingId === item.id ? "Đang xử lý..." : "Xác nhận dùng"}
                        </button>
                      )}
                      {item.status === "issued" && (
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => handleRevoke(item.id)}
                          style={{ color: "#dc2626" }}
                        >
                          Thu hồi
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
    </div>
  );
};

