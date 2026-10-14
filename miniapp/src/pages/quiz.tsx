import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "zmp-ui";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import type { QuizCategory, QuizDailyChallenge, QuizUserStats } from "../types";
import { LoadingView, ErrorView } from "../components/state-view";

const QuizHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { showToast } = useApp();

  const [daily, setDaily] = useState<QuizDailyChallenge | null>(null);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [stats, setStats] = useState<QuizUserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Practice Config State
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [startingPractice, setStartingPractice] = useState(false);
  const [startingDaily, setStartingDaily] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dailyRes, catRes] = await Promise.all([
        api.getDailyChallenge().catch(() => ({ challenge: null })),
        api.getQuizCategories().catch(() => ({ categories: [] })),
      ]);
      setDaily(dailyRes.challenge);
      setCategories(catRes.categories || []);

      if (isAuthenticated) {
        const statsRes = await api.getQuizUserStats().catch(() => ({ stats: null as any }));
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      setError(err?.message || "Không thể tải dữ liệu Thử thách Quiz");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartDaily = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      showToast("Vui lòng đăng nhập để tham gia Thử thách hàng ngày");
      return;
    }
    if (!daily || !daily.id) return;

    if (daily.hasAttempted) {
      if (daily.attemptId) {
        navigate("/quiz/result/" + encodeURIComponent(daily.attemptId));
      } else {
        showToast("Bạn đã hoàn thành thử thách của ngày hôm nay rồi");
      }
      return;
    }

    setStartingDaily(true);
    try {
      const res = await api.startQuizAttempt({
        attemptType: "daily_challenge",
        challengeId: daily.id,
      });
      navigate("/quiz/play?attemptId=" + encodeURIComponent(res.attempt.attemptId));
    } catch (err: any) {
      showToast(err?.message || "Không thể mở thử thách hàng ngày");
    } finally {
      setStartingDaily(false);
    }
  };

  const handleStartPractice = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      showToast("Vui lòng đăng nhập để luyện tập kiến thức du lịch");
      return;
    }

    setStartingPractice(true);
    try {
      const res = await api.startQuizAttempt({
        attemptType: "practice",
        categoryId: selectedCategory || undefined,
        difficulty: selectedDifficulty || undefined,
        questionCount,
      });
      navigate("/quiz/play?attemptId=" + encodeURIComponent(res.attempt.attemptId));
    } catch (err: any) {
      showToast(err?.message || "Không tìm thấy câu hỏi phù hợp để luyện tập");
    } finally {
      setStartingPractice(false);
    }
  };

  if (loading) return <LoadingView message="Đang tải thử thách du lịch..." />;
  if (error) return <ErrorView message={error} onRetry={loadData} />;

  return (
    <div style={{ padding: "14px 16px 32px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 1. Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#7c3aed",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Đấu trí văn hóa & cảnh quan
          </span>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--color-primary)",
              margin: "2px 0 0 0",
            }}
          >
            Thử thách Quiz Du lịch
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
            Khám phá vẻ đẹp Đắk Song qua các câu hỏi tương tác hấp dẫn
          </p>
        </div>

        <button
          type="button"
          className="eco-icon-btn"
          onClick={() => navigate("/quiz/history")}
          title="Lịch sử làm bài"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            history
          </span>
        </button>
      </div>

      {/* 2. User Stats Banner (if authenticated) */}
      {isAuthenticated && stats && (
        <div
          style={{
            background: "var(--color-surface, #ffffff)",
            borderRadius: 14,
            padding: "12px 16px",
            border: "1px solid var(--color-border, #e5e7eb)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#7c3aed" }}>{stats.totalScore}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>Điểm Quiz</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{stats.completedAttempts}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>Bài đã nộp</div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#d97706" }}>{stats.dailyChallengesCompleted}</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>Thử thách ngày</div>
          </div>
        </div>
      )}

      {/* 3. Daily Challenge Card */}
      <section
        style={{
          background: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 100%)",
          borderRadius: 18,
          padding: 18,
          color: "#ffffff",
          boxShadow: "0 6px 16px rgba(109, 40, 217, 0.28)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.08)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              background: "rgba(255, 255, 255, 0.2)",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Hôm nay: {daily?.businessDate || "12/10/2026"}
          </span>
          {daily?.isOpen && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: 6,
                background: "#10b981",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Chính thức
            </span>
          )}
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0", color: "#ffffff" }}>
          {daily?.title || "Thử thách Du lịch Đắk Song hàng ngày"}
        </h2>
        <p style={{ fontSize: 12, margin: 0, opacity: 0.9, lineHeight: 1.45 }}>
          {daily?.description || "Mỗi du khách có 01 lượt thi chính thức để ghi điểm văn hóa bản địa."}
        </p>

        <div style={{ display: "flex", gap: 14, margin: "14px 0", fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              help
            </span>
            <span>{daily?.questionCount || 5} câu hỏi</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              timer
            </span>
            <span>{daily?.timeLimitSeconds ? daily.timeLimitSeconds / 60 + " phút" : "Tự do"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              stars
            </span>
            <span>{daily?.scorePerQuestion || 10} điểm/câu</span>
          {daily?.openingTime && daily?.closingTime && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
              <span>{daily.openingTime.slice(0, 5)} - {daily.closingTime.slice(0, 5)}</span>
            </div>
          )}
          </div>
        </div>

        {daily?.hasAttempted ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.15)", padding: "10px 14px", borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Trạng thái của bạn:</div>
              <strong style={{ fontSize: 14 }}>
                {daily.attemptStatus === "in_progress"
                  ? "Đang làm bài..."
                  : `Đã thi xong (${daily.score !== null ? daily.score + " điểm" : "Đã hoàn thành"})`}
              </strong>
            </div>
            {daily.attemptId && (
              <button
                type="button"
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  backgroundColor: "#ffffff",
                  color: "#6d28d9",
                  fontWeight: 600,
                  fontSize: 12,
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => {
                  if (daily.attemptStatus === "in_progress") {
                    navigate("/quiz/play?attemptId=" + encodeURIComponent(daily.attemptId!));
                  } else {
                    navigate("/quiz/result/" + encodeURIComponent(daily.attemptId!));
                  }
                }}
              >
                {daily.attemptStatus === "in_progress" ? "Làm tiếp" : "Xem kết quả"}
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 12,
              backgroundColor: "#ffffff",
              color: "#6d28d9",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            disabled={startingDaily || !daily?.isOpen}
            onClick={handleStartDaily}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              play_arrow
            </span>
            <span>{startingDaily ? "Đang chuẩn bị đề thi..." : !daily?.isOpen ? (daily?.reason || "Thử thách chưa mở") : "Bắt đầu Thử thách ngay"}</span>
          </button>
        )}
      </section>

      {/* 4. Practice Mode Section */}
      <section style={{ background: "var(--color-surface, #ffffff)", borderRadius: 16, padding: 16, border: "1px solid var(--color-border, #e5e7eb)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span
            style={{
              width: 4,
              height: 16,
              borderRadius: 2,
              backgroundColor: "var(--color-primary)",
            }}
          />
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
            Luyện tập tự do
          </h3>
        </div>

        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "0 0 14px 0", lineHeight: 1.4 }}>
          Tự do chọn danh mục và mức độ khó để ôn luyện kiến thức du lịch Đắk Song không giới hạn số lần.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
              Chủ đề du lịch:
            </label>
            <select
              className="eco-input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Tất cả danh mục (Ngẫu nhiên)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
                Độ khó:
              </label>
              <select
                className="eco-input"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">Hỗn hợp</option>
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 6 }}>
                Số câu hỏi:
              </label>
              <select
                className="eco-input"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                style={{ width: "100%" }}
              >
                <option value={3}>3 câu</option>
                <option value={5}>5 câu</option>
                <option value={8}>8 câu</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            className="eco-btn-primary"
            style={{ marginTop: 4 }}
            disabled={startingPractice}
            onClick={handleStartPractice}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              psychology
            </span>
            <span>{startingPractice ? "Đang tạo đề luyện tập..." : "Vào phòng Luyện tập"}</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default QuizHomePage;
