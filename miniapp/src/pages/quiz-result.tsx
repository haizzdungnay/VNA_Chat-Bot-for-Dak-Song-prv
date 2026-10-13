import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "zmp-ui";
import { api } from "../services/api";
import type { QuizAttemptDetail } from "../types";
import { LoadingView, ErrorView } from "../components/state-view";

const QuizResultPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<QuizAttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResult = useCallback(async () => {
    if (!id) {
      setError("Không tìm thấy mã kết quả bài thi");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.getQuizAttempt(id);
      setAttempt(res.attempt);
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tải kết quả");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadResult();
  }, [loadResult]);

  if (loading) return <LoadingView message="Đang chấm điểm và tải kết quả..." />;
  if (error || !attempt) return <ErrorView message={error || "Lỗi kết quả"} onRetry={loadResult} />;

  const isDaily = attempt.attemptType === "daily_challenge";

  return (
    <div style={{ padding: "14px 16px 36px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 1. Header Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, #137A3E 0%, #0d522a 100%)",
          borderRadius: 18,
          padding: 20,
          color: "#ffffff",
          textAlign: "center",
          boxShadow: "0 6px 16px rgba(19, 122, 62, 0.25)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            background: "rgba(255, 255, 255, 0.2)",
            padding: "3px 10px",
            borderRadius: 6,
            display: "inline-block",
            marginBottom: 8,
          }}
        >
          {isDaily ? "Thử thách hàng ngày" : "Luyện tập tự do"}
        </span>

        <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 10px 0", color: "#ffffff" }}>
          {attempt.challengeTitle || attempt.collectionTitle || "Kết quả Quiz Du lịch"}
        </h1>

        <div style={{ margin: "14px 0" }}>
          <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>{attempt.score}</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
            trên tổng số {attempt.maxScore} điểm tối đa ({attempt.percentage}%)
          </div>
        </div>

        {/* Counters Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            background: "rgba(255, 255, 255, 0.15)",
            padding: "10px 12px",
            borderRadius: 12,
            marginTop: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#a7f3d0" }}>{attempt.correctCount}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Câu đúng</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fecaca" }}>{attempt.incorrectCount}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Câu sai</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>{attempt.unansweredCount}</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>Chưa chọn</div>
          </div>
        </div>
      </section>

      {/* 2. Questions Review Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 4,
            height: 16,
            borderRadius: 2,
            backgroundColor: "var(--color-primary)",
          }}
        />
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
          Chi tiết đáp án & Tư liệu giải thích ({attempt.questions.length} câu)
        </h2>
      </div>

      {/* 3. Detailed Questions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {attempt.questions.map((q, idx) => (
          <div
            key={q.id}
            style={{
              background: "var(--color-surface, #ffffff)",
              borderRadius: 16,
              padding: 16,
              border: "1px solid var(--color-border, #e5e7eb)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Question Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: q.isCorrect ? "#16a34a" : "#dc2626",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  {q.categoryName || "Đắk Song"}
                </span>
              </div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: q.isCorrect ? "#16a34a" : "#dc2626",
                }}
              >
                {q.isCorrect ? "+10 điểm" : "0 điểm"}
              </span>
            </div>

            {/* Question Text */}
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
              {q.questionText}
            </div>

            {/* Options Review */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {q.options.map((opt) => {
                const isSelected = q.selectedOptionId === opt.id;
                const isCorrect = q.correctOptionId === opt.id;

                let border = "1px solid #e2e8f0";
                let bg = "#ffffff";
                let badge = null;

                if (isCorrect) {
                  border = "2px solid #16a34a";
                  bg = "#f0fdf4";
                  badge = <span style={{ color: "#16a34a", fontWeight: 700, fontSize: 11, marginLeft: "auto" }}>[Đáp án đúng]</span>;
                } else if (isSelected && !isCorrect) {
                  border = "2px solid #dc2626";
                  bg = "#fef2f2";
                  badge = <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 11, marginLeft: "auto" }}>[Bạn chọn]</span>;
                }

                return (
                  <div
                    key={opt.id}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border,
                      background: bg,
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <strong style={{ color: isCorrect ? "#16a34a" : "#64748b" }}>{opt.key}.</strong>
                    <span>{opt.text}</span>
                    {badge}
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            {q.explanation && (
              <div
                style={{
                  background: "#f8fafc",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  color: "#334155",
                  lineHeight: 1.45,
                }}
              >
                <strong style={{ color: "var(--color-primary)" }}>Giải thích tư liệu: </strong>
                <span>{q.explanation}</span>
              </div>
            )}

            {/* Related Place / Article Link */}
            {q.relatedPlaceId && (
              <button
                type="button"
                className="eco-btn-outline"
                style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 12 }}
                onClick={() => navigate("/place/" + encodeURIComponent(q.relatedPlaceId!))}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  explore
                </span>
                <span>Khám phá điểm đến: {q.relatedPlaceName || "Chi tiết"}</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 4. Action Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          className="eco-btn-primary"
          onClick={() => navigate("/quiz")}
          style={{ width: "100%", padding: 14 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            quiz
          </span>
          <span>Về trang chủ Quiz</span>
        </button>

        <button
          type="button"
          className="eco-btn-outline"
          onClick={() => navigate("/quiz/history")}
          style={{ width: "100%", padding: 12 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            history
          </span>
          <span>Xem lịch sử bài thi của bạn</span>
        </button>
      </div>
    </div>
  );
};

export default QuizResultPage;
