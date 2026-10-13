import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "zmp-ui";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { LoadingView, ErrorView, EmptyView } from "../components/state-view";

const QuizHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.getQuizHistory(1, 50);
      setHistory(res.history || []);
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tải lịch sử bài thi");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--color-primary)" }}>
          lock
        </span>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 6px 0" }}>Yêu cầu đăng nhập</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 18 }}>
          Vui lòng đăng nhập tài khoản để xem lại lịch sử các bài thi và điểm số của bạn.
        </p>
        <button type="button" className="eco-btn-primary" onClick={openAuthModal}>
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  if (loading) return <LoadingView message="Đang tải lịch sử bài thi..." />;
  if (error) return <ErrorView message={error} onRetry={loadHistory} />;

  return (
    <div style={{ padding: "14px 16px 32px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="eco-icon-btn"
          onClick={() => navigate("/quiz")}
          title="Quay lại"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            arrow_back
          </span>
        </button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
            Lịch sử Thử thách Quiz
          </h1>
          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "2px 0 0 0" }}>
            {history.length} lượt bài thi đã tham gia
          </p>
        </div>
      </div>

      {history.length === 0 ? (
        <EmptyView message="Bạn chưa tham gia bài thi Quiz nào. Hãy bắt đầu ngay!" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.map((att) => {
            const isDaily = att.attempt_type === "daily_challenge";
            const dateStr = att.started_at ? att.started_at.slice(0, 16).replace("T", " ") : "";

            return (
              <div
                key={att.id}
                onClick={() => navigate("/quiz/result/" + encodeURIComponent(att.id))}
                style={{
                  background: "var(--color-surface, #ffffff)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  border: "1px solid var(--color-border, #e5e7eb)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: isDaily ? "rgba(109, 40, 217, 0.1)" : "rgba(19, 122, 62, 0.1)",
                        color: isDaily ? "#6d28d9" : "var(--color-primary)",
                        textTransform: "uppercase",
                      }}
                    >
                      {isDaily ? "Thử thách ngày" : "Luyện tập"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{dateStr}</span>
                  </div>

                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {att.challenge_title || att.collection_title || "Bài thi du lịch"}
                  </h3>

                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
                    {att.total_questions} câu • Đúng {att.correct_count} • Sai {att.incorrect_count}
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-primary)" }}>
                    {att.score} đ
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: att.status === "completed" ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {att.status === "completed" ? "Đã nộp" : att.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuizHistoryPage;
