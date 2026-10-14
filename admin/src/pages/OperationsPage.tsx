import React, { useState, useEffect, useCallback } from "react";
import { adminApi } from "../services/api";
import type { AdminOperationsReadiness } from "../types";

interface Props {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const OperationsPage: React.FC<Props> = ({ onNotify }) => {
  const [data, setData] = useState<AdminOperationsReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  const loadReadiness = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getOperationsReadiness();
      setData(res);
    } catch (err: any) {
      onNotify?.("error", err?.message || "Lỗi khi tải thông tin nghiệm thu & vận hành");
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  const handleExportCsv = () => {
    window.open(adminApi.getOperationsExportUrl(), "_blank");
    onNotify?.("info", "Đang tải xuống báo cáo nghiệm thu vận hành CSV...");
  };

  if (loading || !data) {
    return <div style={{ padding: 24, textAlign: "center", color: "#64748b" }}>Đang kiểm tra trạng thái các phân hệ D1...</div>;
  }

  const { system, modules, invariants } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. System Health & Environment Bar */}
      <div className="card" style={{ padding: 18, background: "#f8fafc", border: "1px solid #cbd5e1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Trung tâm Vận hành & Nghiệm thu Tích hợp (Phase 8.6)
              </h2>
              <span className="badge badge-success" style={{ fontSize: 11 }}>
                LOCAL D1 READY
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0 0" }}>
              Môi trường: <strong>{system.environment}</strong> • CSDL D1:{" "}
              <strong style={{ color: system.databaseConnected ? "#16a34a" : "#dc2626" }}>
                {system.databaseConnected ? "KẾT NỐI BÌNH THƯỜNG" : "MẤT KẾT NỐI"}
              </strong>{" "}
              • Số migration áp dụng: <strong>{system.appliedMigrationsCount} (0001 - 0015)</strong>
            </p>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Giờ VN: {system.timestampVietnam} | UTC: {system.timestampUtc}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={loadReadiness}
              title="Làm mới trạng thái"
            >
              Kiểm tra lại
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExportCsv}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                download
              </span>
              Xuất Báo cáo Nghiệm thu (CSV UTF-8 BOM)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Invariants & Data Integrity Verification */}
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Đối soát Tính Toàn vẹn & Bất biến Dữ liệu (Invariants Verification)
          </h3>
          <span
            className={invariants.overallIntegrity ? "badge badge-success" : "badge badge-danger"}
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            {invariants.overallIntegrity ? "100% ĐẠT CHUẨN KỸ THUẬT" : "CÓ SAI LỆCH CẦN RÀ SOÁT"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 10, background: invariants.quizCompletedMatchesStats ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (invariants.quizCompletedMatchesStats ? "#bbf7d0" : "#fecaca") }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: invariants.quizCompletedMatchesStats ? "#16a34a" : "#dc2626" }}>
              {invariants.quizCompletedMatchesStats ? "✓ KHỚP LƯỢT THI QUIZ" : "✗ LỆCH THỐNG KÊ QUIZ"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Số bài thi hoàn thành khớp chính xác với bảng tổng hợp người dùng (quiz_user_stats).
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 10, background: invariants.rewardSpinsMatchesUserCounters ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (invariants.rewardSpinsMatchesUserCounters ? "#bbf7d0" : "#fecaca") }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: invariants.rewardSpinsMatchesUserCounters ? "#16a34a" : "#dc2626" }}>
              {invariants.rewardSpinsMatchesUserCounters ? "✓ KHỚP QUOTA VÒNG QUAY" : "✗ LỆCH QUOTA QUAY"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Lượt quay hoàn thành trong sổ cái khớp 100% với bộ đếm người dùng (reward_user_campaign_spins).
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 10, background: invariants.zeroOversoldTemplates ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (invariants.zeroOversoldTemplates ? "#bbf7d0" : "#fecaca") }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: invariants.zeroOversoldTemplates ? "#16a34a" : "#dc2626" }}>
              {invariants.zeroOversoldTemplates ? "✓ KHO VOUCHER KHÔNG ÂM" : "✗ VƯỢT KHO VOUCHER"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              Tất cả các mẫu voucher có hạn mức đều tuân thủ (issued_count &lt;= total_stock).
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 10, background: invariants.zeroGhostVoucherSpins ? "#f0fdf4" : "#fef2f2", border: "1px solid " + (invariants.zeroGhostVoucherSpins ? "#bbf7d0" : "#fecaca") }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: invariants.zeroGhostVoucherSpins ? "#16a34a" : "#dc2626" }}>
              {invariants.zeroGhostVoucherSpins ? "✓ KHÔNG CÓ TRÚNG VOUCHER ẢO" : "✗ PHÁT HIỆN GHOST WIN"}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              100% lượt quay ghi nhận trúng voucher đều có mã và thẻ ví thực tế (P1-RWD-01).
            </div>
          </div>
        </div>
      </div>

      {/* 3. Monorepo Modules Readiness Details */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px 0" }}>
          Hiện trạng & Bằng chứng Nghiệm thu theo Phân hệ (Cross-Module Status)
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Identity */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>badge</span>
                <strong>{modules.identity.name}</strong>
              </div>
              <span className="badge badge-success">ACTIVE</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Tổng người dùng: <strong>{modules.identity.usersCount}</strong> • Phiên đăng nhập khả dụng: <strong>{modules.identity.activeSessionsCount}</strong> • Chế độ: {modules.identity.mode}
            </div>
          </div>

          {/* AI Planner */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "#3b82f6" }}>map</span>
                <strong>{modules.aiPlanner.name}</strong>
              </div>
              <span className="badge badge-success">ACTIVE</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Tổng lịch trình đã lưu: <strong>{modules.aiPlanner.itinerariesCount}</strong> • Chế độ: {modules.aiPlanner.mode} (Bảo toàn VR360 3D, zero travel buffer giả)
            </div>
          </div>

          {/* Booking & Mock Payment */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "#f59e0b" }}>shopping_cart</span>
                <strong>{modules.bookingAndPayment.name}</strong>
              </div>
              <span className="badge badge-warning" style={{ fontSize: 11 }}>{modules.bookingAndPayment.label}</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Sản phẩm tour: <strong>{modules.bookingAndPayment.toursCount}</strong> • Đơn đặt: <strong>{modules.bookingAndPayment.bookingsCount}</strong> • Giao dịch mô phỏng: <strong>{modules.bookingAndPayment.paymentAttemptsCount}</strong> • Hoàn tiền mô phỏng: <strong>{modules.bookingAndPayment.refundsCount}</strong>
            </div>
          </div>

          {/* Tourism Quiz */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "#10b981" }}>quiz</span>
                <strong>{modules.tourismQuiz.name}</strong>
              </div>
              <span className="badge badge-success">P1-QZ-08 PROTECTED</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Câu hỏi công bố: <strong>{modules.tourismQuiz.publishedQuestionsCount}</strong> • Thử thách ngày: <strong>{modules.tourismQuiz.challengesCount}</strong> • Tổng lượt thi: <strong>{modules.tourismQuiz.totalAttemptsCount}</strong> (Đã hoàn thành: <strong>{modules.tourismQuiz.completedAttemptsCount}</strong>) • Chống lộ đáp án khi in_progress: BẬT
            </div>
          </div>

          {/* Rewards & Lucky Spin */}
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: "#8b5cf6" }}>casino</span>
                <strong>{modules.rewardsAndLuckySpin.name}</strong>
              </div>
              <span className="badge badge-warning" style={{ fontSize: 11 }}>{modules.rewardsAndLuckySpin.label}</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
              Chiến dịch: <strong>{modules.rewardsAndLuckySpin.campaignsCount}</strong> • Lượt quay hoàn thành: <strong>{modules.rewardsAndLuckySpin.completedSpinsCount}</strong> • Voucher cấp ví: <strong>{modules.rewardsAndLuckySpin.vouchersIssuedCount}</strong> (Đã đổi: <strong>{modules.rewardsAndLuckySpin.vouchersRedeemedCount}</strong>) • Quà lưu niệm: <strong>{modules.rewardsAndLuckySpin.giftClaimsCount}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

