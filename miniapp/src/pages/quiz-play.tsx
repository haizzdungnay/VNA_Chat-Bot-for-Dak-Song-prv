import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "zmp-ui";
import { api } from "../services/api";
import { useApp } from "../context/AppContext";
import type { QuizAttemptDetail } from "../types";
import { LoadingView, ErrorView } from "../components/state-view";

const QuizPlayPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const searchParams = new URLSearchParams(location.search);
  const attemptId = searchParams.get("attemptId") || "";

  const [attempt, setAttempt] = useState<QuizAttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answeredState, setAnsweredState] = useState<{ isAnswered: boolean; isCorrect?: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const loadAttempt = useCallback(async () => {
    if (!attemptId) {
      setError("Không tìm thấy mã lượt thi");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.getQuizAttempt(attemptId);
      if (res.attempt.status === "completed" || res.attempt.status === "expired") {
        navigate("/quiz/result/" + encodeURIComponent(attemptId));
        return;
      }

      setAttempt(res.attempt);

      // Check timer
      if (res.attempt.expiresAt) {
        const diff = Math.max(0, Math.floor((new Date(res.attempt.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsRemaining(diff);
      }

      // Restore previously selected option on first question if any
      const firstQ = res.attempt.questions[0];
      if (firstQ?.selectedOptionId) {
        setSelectedOptionId(firstQ.selectedOptionId);
        setAnsweredState({ isAnswered: true });
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tải bài thi");
    } finally {
      setLoading(false);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    loadAttempt();
  }, [loadAttempt]);

  // Live Timer Countdown
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          // Auto finalize when time runs out
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const handleSelectOption = (optId: string) => {
    if (answeredState?.isAnswered) return; // Locked once answered
    setSelectedOptionId(optId);
  };

  const handleSubmitAnswer = async () => {
    if (!attempt || !selectedOptionId) {
      showToast("Vui lòng chọn 1 phương án trả lời");
      return;
    }

    const currentQ = attempt.questions[currentIndex];
    if (!currentQ) return;

    setSubmitting(true);
    try {
      const res = await api.submitQuizAnswer(attempt.id, {
        attemptQuestionId: currentQ.id,
        selectedOptionId,
      });

      setAnsweredState({
        isAnswered: true,
        isCorrect: res.isCorrect,
      });

      // Update local attempt question
      currentQ.selectedOptionId = selectedOptionId;
    } catch (err: any) {
      showToast(err?.message || "Lỗi khi gửi đáp án");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNextQuestion = () => {
    if (!attempt) return;
    if (currentIndex < attempt.questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      const nextQ = attempt.questions[nextIdx];
      setSelectedOptionId(nextQ?.selectedOptionId || null);
      setAnsweredState(nextQ?.selectedOptionId ? { isAnswered: true } : null);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    if (!attempt) return;
    setFinishing(true);
    try {
      await api.finishQuizAttempt(attempt.id);
      navigate("/quiz/result/" + encodeURIComponent(attempt.id));
    } catch (err: any) {
      showToast(err?.message || "Lỗi khi nộp bài thi");
      navigate("/quiz/result/" + encodeURIComponent(attempt.id));
    } finally {
      setFinishing(false);
    }
  };

  if (loading) return <LoadingView message="Đang khởi tạo bài thi..." />;
  if (error || !attempt) return <ErrorView message={error || "Lỗi bài thi"} onRetry={loadAttempt} />;

  const currentQ = attempt.questions[currentIndex];
  const totalQ = attempt.questions.length;
  const isLastQuestion = currentIndex === totalQ - 1;

  const formatTimer = (sec: number | null) => {
    if (sec === null) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  };

  return (
    <div style={{ padding: "14px 16px 32px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Bar: Progress & Timer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--color-surface, #ffffff)",
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid var(--color-border, #e5e7eb)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--color-primary)" }}>
            assignment
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            Câu {currentIndex + 1} / {totalQ}
          </span>
        </div>

        {secondsRemaining !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: secondsRemaining < 60 ? "#dc2626" : "var(--color-text-primary)",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              timer
            </span>
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: "100%",
          height: 6,
          backgroundColor: "#e2e8f0",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            backgroundColor: "var(--color-primary)",
            width: ((currentIndex + 1) / totalQ) * 100 + "%",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Question Card */}
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          borderRadius: 16,
          padding: 18,
          border: "1px solid var(--color-border, #e5e7eb)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-primary)",
              backgroundColor: "rgba(19, 122, 62, 0.1)",
              padding: "2px 8px",
              borderRadius: 6,
              textTransform: "uppercase",
            }}
          >
            {currentQ.categoryName || "Du lịch Đắk Song"}
          </span>
          {currentQ.difficulty && (
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-secondary)",
                fontWeight: 600,
              }}
            >
              • Độ khó: {currentQ.difficulty === "easy" ? "Dễ" : currentQ.difficulty === "medium" ? "Trung bình" : "Khó"}
            </span>
          )}
        </div>

        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          {currentQ.questionText}
        </h2>
      </div>

      {/* Options List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {currentQ.options.map((opt) => {
          const isSelected = selectedOptionId === opt.id;
          let borderColor = "var(--color-border, #e5e7eb)";
          let bgColor = "var(--color-surface, #ffffff)";

          if (isSelected) {
            borderColor = "var(--color-primary)";
            bgColor = "rgba(19, 122, 62, 0.05)";
          }

          if (answeredState?.isAnswered && isSelected) {
            if (answeredState.isCorrect) {
              borderColor = "#16a34a";
              bgColor = "#f0fdf4";
            } else if (answeredState.isCorrect === false) {
              borderColor = "#dc2626";
              bgColor = "#fef2f2";
            }
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={answeredState?.isAnswered}
              onClick={() => handleSelectOption(opt.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 14,
                border: "2px solid " + borderColor,
                backgroundColor: bgColor,
                textAlign: "left",
                cursor: answeredState?.isAnswered ? "default" : "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: isSelected ? "2px solid var(--color-primary)" : "2px solid #cbd5e1",
                  backgroundColor: isSelected ? "var(--color-primary)" : "transparent",
                  color: isSelected ? "#ffffff" : "var(--color-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {opt.key}
              </div>

              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.35,
                  flex: 1,
                }}
              >
                {opt.text}
              </span>
            </button>
          );
        })}
      </div>

      {/* Answer Feedback Banner */}
      {answeredState?.isAnswered && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: answeredState.isCorrect ? "#f0fdf4" : "#fef2f2",
            border: "1px solid " + (answeredState.isCorrect ? "#bbf7d0" : "#fecaca"),
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color: answeredState.isCorrect ? "#16a34a" : "#dc2626" }}
          >
            {answeredState.isCorrect ? "check_circle" : "cancel"}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: answeredState.isCorrect ? "#16a34a" : "#dc2626",
            }}
          >
            {answeredState.isCorrect ? "Chính xác! Bạn được cộng 10 điểm." : "Chưa chính xác! Xem giải thích ở kết quả cuối bài."}
          </span>
        </div>
      )}

      {/* Bottom Action Button */}
      <div style={{ marginTop: "auto", paddingTop: 10 }}>
        {!answeredState?.isAnswered ? (
          <button
            type="button"
            className="eco-btn-primary"
            disabled={!selectedOptionId || submitting}
            onClick={handleSubmitAnswer}
            style={{ width: "100%", padding: 14 }}
          >
            <span>{submitting ? "Đang gửi đáp án..." : "Xác nhận câu trả lời"}</span>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              check
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="eco-btn-primary"
            disabled={finishing}
            onClick={handleNextQuestion}
            style={{ width: "100%", padding: 14 }}
          >
            <span>
              {finishing
                ? "Đang hoàn thành bài thi..."
                : isLastQuestion
                ? "Hoàn thành & Xem kết quả"
                : "Câu tiếp theo"}
            </span>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizPlayPage;
