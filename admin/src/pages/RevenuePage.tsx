import React, { useState, useEffect, useCallback } from "react";
import type { RevenueAnalyticsData } from "../types";
import { adminApi } from "../services/api";

interface RevenuePageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const RevenuePage: React.FC<RevenuePageProps> = ({ onNotify }) => {
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [data, setData] = useState<RevenueAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getRevenueAnalytics(range);
      setData(res);
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi tải báo cáo doanh thu.");
    } finally {
      setLoading(false);
    }
  }, [range, onNotify]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportCsv = () => {
    const url = adminApi.getRevenueExportUrl(range);
    window.open(url, "_blank");
  };

  return (
    <div className="tab-pane">
      {/* Mandatory Demo Banner */}
      <div
        style={{
          backgroundColor: "#fffbeb",
          border: "2px solid #f59e0b",
          borderRadius: 8,
          padding: "14px 18px",
          marginBottom: 20,
          color: "#92400e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>
              BÁO CÁO DOANH THU MÔ PHỎNG — KHÔNG PHẢI DOANH THU THỰC TẾ
            </div>
            <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>
              Tất cả số liệu, giao dịch và đơn đặt hiển thị tại đây là kết quả thử nghiệm nghiệp vụ cục bộ.
            </div>
          </div>
        </div>
        <button
          onClick={handleExportCsv}
          className="btn-primary"
          style={{ padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>📥 Xuất CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {(["today", "7d", "30d", "all"] as const).map((r) => (
            <button
              key={r}
              className={`btn-secondary ${range === r ? "active" : ""}`}
              onClick={() => setRange(r)}
              style={{
                backgroundColor: range === r ? "#0f766e" : "#f1f5f9",
                color: range === r ? "#ffffff" : "#334155",
                fontWeight: range === r ? 600 : 500,
                border: "none",
                borderRadius: 6,
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {r === "today" ? "Hôm nay" : r === "7d" ? "7 ngày qua" : r === "30d" ? "30 ngày qua" : "Tất cả"}
            </button>
          ))}
        </div>

        <button
          onClick={loadAnalytics}
          className="btn-secondary"
          style={{ fontSize: 13, padding: "8px 14px", cursor: "pointer" }}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "🔄 Làm mới"}
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="metric-card" style={{ borderLeft: "4px solid #10b981", padding: 16 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Doanh thu thuần mô phỏng</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f766e", marginTop: 4 }}>
            {formatVnd(data?.netSimulatedRevenue || 0)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Gộp: {formatVnd(data?.grossSimulatedRevenue || 0)}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #ef4444", padding: 16 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Hoàn tiền mô phỏng</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
            {formatVnd(data?.simulatedRefundedAmount || 0)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Đã trừ khỏi doanh thu thuần
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #3b82f6", padding: 16 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Tổng số đơn đặt</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e3a8a", marginTop: 4 }}>
            {data?.totalBookings || 0}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Thành công: {data?.successfulBookings || 0} | Đang chờ: {data?.pendingBookings || 0}
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: "4px solid #8b5cf6", padding: 16 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Giá trị đơn TB (AOV)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#6d28d9", marginTop: 4 }}>
            {formatVnd(data?.averageBookingValue || 0)}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Thất bại: {data?.failedPaymentAttempts || 0} lượt
          </div>
        </div>
      </div>

      {/* Grid: Charts & Top products */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Daily Revenue Trend Chart */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>
            Xu hướng doanh thu theo ngày
          </h3>
          {data?.dailyTrends && data.dailyTrends.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-end", height: 180, gap: 12, paddingTop: 20 }}>
                {data.dailyTrends.map((t, idx) => {
                  const maxRev = Math.max(...data.dailyTrends.map((d) => d.revenue), 1000000);
                  const barHeight = Math.max(12, Math.round((t.revenue / maxRev) * 140));
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 44,
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                        {t.revenue > 0 ? (t.revenue >= 1000000 ? (t.revenue / 1000000).toFixed(1) + "M" : (t.revenue / 1000).toFixed(0) + "k") : "0"}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          height: `${barHeight}px`,
                          backgroundColor: "#0d9488",
                          borderRadius: "4px 4px 0 0",
                          transition: "height 0.3s ease",
                        }}
                        title={`${t.date}: ${formatVnd(t.revenue)} (${t.bookingsCount} đơn)`}
                      />
                      <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {t.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              Chưa có dữ liệu giao dịch trong khoảng thời gian này.
            </div>
          )}
        </div>

        {/* Category distribution */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>
            Cơ cấu theo danh mục dịch vụ
          </h3>
          {data?.categoryDistribution && data.categoryDistribution.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.categoryDistribution.map((cat, idx) => {
                const totalCatRev = data.categoryDistribution.reduce((acc, c) => acc + c.totalAmount, 0) || 1;
                const pct = Math.round((cat.totalAmount / totalCatRev) * 100);
                return (
                  <div key={idx}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: "#334155" }}>{cat.category}</span>
                      <span style={{ color: "#64748b" }}>{formatVnd(cat.totalAmount)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 8, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          backgroundColor: "#14b8a6",
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              Chưa có dữ liệu danh mục.
            </div>
          )}
        </div>
      </div>

      {/* Top Products Table */}
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#1e293b" }}>
          Top sản phẩm & dịch vụ được đặt nhiều nhất
        </h3>
        {data?.topProducts && data.topProducts.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "10px 12px" }}>Tên sản phẩm / dịch vụ</th>
                <th style={{ padding: "10px 12px" }}>Phân loại</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Số lượt đặt</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Doanh số mô phỏng</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px", fontWeight: 600, color: "#1e293b" }}>{p.name}</td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        backgroundColor: p.type === "tour" ? "#e0f2fe" : "#fef3c7",
                        color: p.type === "tour" ? "#0369a1" : "#92400e",
                        fontWeight: 600,
                      }}
                    >
                      {p.type === "tour" ? "Tour trọn gói" : "Dịch vụ du lịch"}
                    </span>
                  </td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>{p.bookedCount}</td>
                  <td style={{ padding: "12px", textAlign: "right", color: "#0f766e", fontWeight: 700 }}>
                    {formatVnd(p.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>
            Chưa có sản phẩm nào được thanh toán thành công trong bộ lọc này.
          </div>
        )}
      </div>
    </div>
  );
};
