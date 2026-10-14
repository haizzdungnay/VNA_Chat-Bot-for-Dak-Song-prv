import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/api";
import type { AdminRewardAnalytics } from "../types";

interface Props {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const RewardAnalyticsPage: React.FC<Props> = ({ onNotify }) => {
  const [analytics, setAnalytics] = useState<AdminRewardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getRewardAnalytics();
      setAnalytics(res.analytics);
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải thống kê phần thưởng");
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = () => {
    window.open(adminApi.getRewardExportUrl(), "_blank");
    onNotify?.("info", "Đang tải xuống báo cáo voucher CSV...");
  };

  if (loading || !analytics) {
    return <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Đang tải số liệu D1...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 4px 0" }}>
            Thống kê Phần thưởng & Vòng quay May mắn
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
            Dữ liệu kết xuất trực tiếp từ SQLite / D1 database.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={handleExportCsv}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            download
          </span>
          Xuất báo cáo Voucher (CSV UTF-8 BOM)
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {/* Total Spins */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TỔNG LƯỢT QUAY MAY MẮN</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "6px 0 2px 0" }}>
            {analytics.spins.totalSpins}
          </div>
          <div style={{ fontSize: 11, color: "#16a34a" }}>
            {analytics.spins.uniqueSpinners} người dùng đã tham gia
          </div>
        </div>

        {/* Win Rate */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TỶ LỆ TRÚNG QUÀ / VOUCHER</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--color-primary)", margin: "6px 0 2px 0" }}>
            {analytics.spins.winRate}%
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {analytics.spins.totalWins} trúng / {analytics.spins.totalNoWins} may mắn lần sau
          </div>
        </div>

        {/* Total Vouchers Issued */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TỔNG VOUCHER ĐÃ CẤP VÍ</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: "6px 0 2px 0" }}>
            {analytics.vouchers.totalIssued}
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {analytics.vouchers.uniqueHolders} người sở hữu voucher
          </div>
        </div>

        {/* Redemption Rate */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>TỶ LỆ SỬ DỤNG (REDEMPTION RATE)</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#7c3aed", margin: "6px 0 2px 0" }}>
            {analytics.vouchers.redemptionRate}%
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }}>
            {analytics.vouchers.totalRedeemed} voucher đã xác minh tại quầy
          </div>
        </div>
      </div>

      {/* Summary Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px 0" }}>Tình trạng Ví Voucher</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Tổng số đã phát hành:</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>{analytics.vouchers.totalIssued}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Đã sử dụng (Redeemed):</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>
                  {analytics.vouchers.totalRedeemed}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Đã thu hồi (Revoked):</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "#dc2626" }}>
                  {analytics.vouchers.totalRevoked}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Đã hết hạn (Expired):</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "#64748b" }}>
                  {analytics.vouchers.totalExpired}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px 0" }}>Tổng quan Chiến dịch</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Tổng số chiến dịch:</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>{analytics.campaigns.total}</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Chiến dịch đang mở (Published):</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>
                  {analytics.campaigns.published}
                </td>
              </tr>
              <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Tổng người quay duy nhất:</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>{analytics.spins.uniqueSpinners}</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0", color: "#64748b" }}>Tỷ lệ trúng thưởng:</td>
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: "var(--color-primary)" }}>
                  {analytics.spins.winRate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

