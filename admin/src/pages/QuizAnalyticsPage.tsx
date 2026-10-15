import React, { useState, useEffect, useCallback } from "react";
import type { AdminQuizAnalytics } from "../types";
import { adminApi } from "../services/api";

interface QuizAnalyticsPageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const QuizAnalyticsPage: React.FC<QuizAnalyticsPageProps> = ({ onNotify }) => {
  const [analytics, setAnalytics] = useState<AdminQuizAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getQuizAnalytics(startDate || undefined, endDate || undefined);
      setAnalytics(data);
    } catch (err: any) {
      onNotify?.("error", err.message || "Lỗi khi tải dữ liệu thống kê Quiz");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, onNotify]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExportCsv = () => {
    const url = adminApi.getQuizExportUrl(startDate || undefined, endDate || undefined);
    window.open(url, "_blank");
  };

  const kpis = analytics?.kpis || {
    totalPublishedQuestions: 0,
    draftQuestions: 0,
    archivedQuestions: 0,
    activeChallenges: 0,
    totalAttempts: 0,
    completedAttempts: 0,
    uniqueParticipants: 0,
    averageScore: 0,
    accuracyRate: 0,
    completionRate: 0,
  };

  return (
    <div className="admin-page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Kết quả & Thống kê Quiz Du lịch</h2>
          <p className="text-secondary" style={{ margin: "4px 0 0" }}>
            Theo dõi chất lượng bộ câu hỏi, tỷ lệ đúng/sai và mức độ tương tác của du khách
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-secondary" onClick={handleExportCsv}>
            Xuất CSV báo cáo
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="card" style={{ marginBottom: 16, padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Khoảng thời gian:</span>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: 160 }}
          />
          <span>đến</span>
          <input
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: 160 }}
          />
          {(startDate || endDate) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
            >
              Xem tất cả
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Tổng câu hỏi đã duyệt
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
            {kpis.totalPublishedQuestions}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{kpis.draftQuestions} câu đang chờ duyệt</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Lượt tham gia
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0284c7", marginTop: 4 }}>
            {kpis.totalAttempts}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{kpis.completedAttempts} lượt hoàn thành</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Du khách tham gia
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#16a34a", marginTop: 4 }}>
            {kpis.uniqueParticipants}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Tài khoản độc lập</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Điểm trung bình
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#d97706", marginTop: 4 }}>
            {kpis.averageScore}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Thang điểm chuẩn server</div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Tỷ lệ trả lời đúng
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#7c3aed", marginTop: 4 }}>
            {kpis.accuracyRate}%
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Độ chính xác trung bình</div>
        </div>
      </div>

      {/* Question Quality Analysis */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Phân tích chất lượng câu hỏi (Câu hỏi hay sai nhất)</h3>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
            Hỗ trợ ban biên tập nhận diện các câu hỏi quá khó hoặc có thông tin gây nhầm lẫn để cải thiện tư liệu
          </p>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>Đang phân tích dữ liệu...</div>
        ) : !analytics || analytics.questionQuality.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            Chưa có câu trả lời nào được ghi nhận để phân tích chất lượng.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Mã câu</th>
                  <th>Nội dung câu hỏi</th>
                  <th style={{ width: 140 }}>Danh mục</th>
                  <th style={{ width: 90 }}>Độ khó</th>
                  <th style={{ width: 90, textAlign: "center" }}>Lượt làm</th>
                  <th style={{ width: 90, textAlign: "center" }}>Đúng</th>
                  <th style={{ width: 90, textAlign: "center" }}>Sai</th>
                  <th style={{ width: 120, textAlign: "center" }}>Tỷ lệ đúng</th>
                </tr>
              </thead>
              <tbody>
                {analytics.questionQuality.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <strong>{q.code}</strong>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{q.questionText}</div>
                    </td>
                    <td>{q.categoryName || "Đắk Song"}</td>
                    <td>{q.difficulty}</td>
                    <td style={{ textAlign: "center" }}>{q.attemptsCount}</td>
                    <td style={{ textAlign: "center", color: "#16a34a", fontWeight: 600 }}>{q.correctCount}</td>
                    <td style={{ textAlign: "center", color: "#dc2626", fontWeight: 600 }}>{q.incorrectCount}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: q.accuracyRate < 50 ? "#dc2626" : q.accuracyRate < 80 ? "#d97706" : "#16a34a",
                        }}
                      >
                        {q.accuracyRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Daily Trends */}
      {analytics && analytics.dailyTrends.length > 0 && (
        <div className="card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Xu hướng tham gia theo ngày</h3>
          </div>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th style={{ textAlign: "center" }}>Số lượt làm bài</th>
                  <th style={{ textAlign: "center" }}>Hoàn thành</th>
                  <th style={{ textAlign: "center" }}>Điểm TB</th>
                </tr>
              </thead>
              <tbody>
                {analytics.dailyTrends.map((d) => (
                  <tr key={d.date}>
                    <td>
                      <strong>{d.date}</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>{d.attemptsCount}</td>
                    <td style={{ textAlign: "center", color: "#16a34a" }}>{d.completedCount}</td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{d.avgScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
