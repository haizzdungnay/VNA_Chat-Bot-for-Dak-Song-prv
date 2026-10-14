import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "zmp-ui";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import type { RewardSpinSegment, RewardSpinResult } from "../types";
import { LoadingView, ErrorView } from "../components/state-view";

const LuckySpinPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { showToast } = useApp();

  const [segments, setSegments] = useState<RewardSpinSegment[]>([]);
  const [availableTurns, setAvailableTurns] = useState<number>(0);
  const [dailyEligible, setDailyEligible] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState<number>(0);
  const [spinResult, setSpinResult] = useState<RewardSpinResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"wheel" | "history">("wheel");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const wheelRes = await api.getActiveWheel();
      setSegments(wheelRes.segments || []);

      if (isAuthenticated) {
        const elig = await api.getSpinEligibility();
        setAvailableTurns(elig.availableTurns);
        setDailyEligible(elig.dailyFreeEligible);

        const hist = await api.getSpinHistory(1, 20);
        setHistory(hist.history || []);
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tải dữ liệu vòng quay");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Draw wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || segments.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const numSegments = segments.length;
    const arc = (2 * Math.PI) / numSegments;

    ctx.clearRect(0, 0, size, size);

    // Default colors palette if segment color not set
    const defaultColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b", "#06b6d4", "#eab308"];

    segments.forEach((seg, i) => {
      const angle = i * arc;
      ctx.beginPath();
      ctx.fillStyle = seg.color || defaultColors[i % defaultColors.length];
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle + arc);
      ctx.lineTo(center, center);
      ctx.fill();
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;

      const label = seg.label.length > 14 ? seg.label.slice(0, 13) + "…" : seg.label;
      ctx.fillText(label, radius - 18, 4);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#f1f5f9";
    ctx.stroke();

    // Center star icon
    ctx.fillStyle = "var(--color-primary, #137A3E)";
    ctx.font = "bold 13px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VNA", center, center);
  }, [segments]);

  const handleClaimDaily = async () => {
    try {
      const res = await api.claimDailySpin();
      setAvailableTurns(res.availableTurns);
      setDailyEligible(false);
      showToast("Đã nhận 1 lượt quay miễn phí hôm nay!");
    } catch (err: any) {
      showToast(err?.message || "Lỗi khi nhận lượt quay");
    }
  };

  const handleSpin = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    if (spinning) return;

    if (availableTurns <= 0 && !dailyEligible) {
      showToast("Bạn đã hết lượt quay may mắn!");
      return;
    }

    setSpinning(true);
    try {
      const idemKey = "spin-req-" + crypto.randomUUID();
      const result = await api.executeSpin({ idempotencyKey: idemKey });
      setSpinResult(result);

      // Find segment index to align pointer
      const targetIndex = segments.findIndex((s) => s.id === result.segment.id);
      const numSegments = segments.length;
      const arcDeg = 360 / numSegments;

      // Pointer is at the top (270 degrees in standard canvas angle, or 0 at right)
      // To bring targetIndex to top (270 deg):
      const segmentCenterDeg = (targetIndex * arcDeg) + (arcDeg / 2);
      const targetDeg = (270 - segmentCenterDeg + 360) % 360;

      // Spin 5 full rotations (1800 deg) + target angle
      const totalSpin = 1800 + targetDeg;
      setRotation((prev) => prev + totalSpin);

      // Wait for spin animation (4.5s)
      setTimeout(async () => {
        setSpinning(false);
        setShowResultModal(true);

        // Refresh turns and history
        const elig = await api.getSpinEligibility();
        setAvailableTurns(elig.availableTurns);
        setDailyEligible(elig.dailyFreeEligible);

        const hist = await api.getSpinHistory(1, 20);
        setHistory(hist.history || []);
      }, 4500);
    } catch (err: any) {
      setSpinning(false);
      showToast(err?.message || "Lỗi khi thực hiện quay thưởng");
    }
  };

  if (loading) return <LoadingView message="Đang nạp vòng quay may mắn..." />;
  if (error || segments.length === 0) {
    return <ErrorView message={error || "Vòng quay hiện chưa sẵn sàng"} onRetry={loadData} />;
  }

  return (
    <div style={{ padding: "14px 16px 40px 16px", maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          type="button"
          className="eco-icon-btn"
          onClick={() => navigate("/vouchers")}
          title="Quay lại"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            arrow_back
          </span>
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
          Vòng Quay May Mắn (DEMO)
        </h1>
        <button
          type="button"
          className="eco-icon-btn"
          onClick={() => navigate("/vouchers/wallet")}
          title="Ví voucher"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            account_balance_wallet
          </span>
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          backgroundColor: "var(--color-surface-container)",
          borderRadius: 10,
          padding: 4,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("wheel")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: activeTab === "wheel" ? "var(--color-primary)" : "transparent",
            color: activeTab === "wheel" ? "#ffffff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Vòng quay thưởng
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: activeTab === "history" ? "var(--color-primary)" : "transparent",
            color: activeTab === "history" ? "#ffffff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Lịch sử trúng quà ({history.length})
        </button>
      </div>

      {activeTab === "wheel" ? (
        <div>
          {/* Turns Status Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(19, 122, 62, 0.1)",
              padding: "6px 14px",
              borderRadius: 20,
              color: "var(--color-primary)",
              fontWeight: 700,
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              stars
            </span>
            <span>
              {isAuthenticated ? `Bạn có ${availableTurns} lượt quay` : "Đăng nhập để nhận lượt quay"}
            </span>
          </div>

          {/* Daily Claim Banner if eligible */}
          {dailyEligible && (
            <div
              style={{
                backgroundColor: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 12,
                padding: "8px 12px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, color: "#065f46", fontWeight: 600 }}>
                Bạn có 1 lượt quay miễn phí hôm nay!
              </span>
              <button
                type="button"
                className="eco-btn-primary"
                style={{ padding: "4px 10px", fontSize: 11, height: "auto" }}
                onClick={handleClaimDaily}
              >
                Nhận ngay
              </button>
            </div>
          )}

          {/* Wheel Container */}
          <div
            style={{
              position: "relative",
              width: 300,
              height: 300,
              margin: "10px auto 24px auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Top Pointer */}
            <div
              style={{
                position: "absolute",
                top: -12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: "24px solid #ef4444",
                zIndex: 10,
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />

            {/* Rotating Wheel Canvas */}
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              style={{
                borderRadius: "50%",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "transform 4.5s cubic-bezier(0.15, 0.9, 0.2, 1)" : "none",
              }}
            />
          </div>

          {/* Spin Action Button */}
          <div style={{ maxWidth: 280, margin: "0 auto" }}>
            <button
              type="button"
              className="eco-btn-primary"
              disabled={spinning || (isAuthenticated && availableTurns <= 0 && !dailyEligible)}
              onClick={handleSpin}
              style={{
                width: "100%",
                padding: "14px 20px",
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 12,
                boxShadow: "0 4px 12px rgba(19, 122, 62, 0.3)",
              }}
            >
              {spinning ? "Đang quay..." : "QUAY NGAY"}
            </button>
          </div>

          <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 14 }}>
            Mỗi lượt quay sử dụng thuật toán Web Crypto ngẫu nhiên từ server. Dữ liệu thử nghiệm (DEMO).
          </p>
        </div>
      ) : (
        /* History Tab */
        <div style={{ textAlign: "left" }}>
          {history.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13, padding: 24 }}>
              Bạn chưa có lượt quay nào.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13, color: h.result_type === "no_win" ? "#64748b" : "var(--color-primary)" }}>
                      {h.segment_label || (h.result_type === "no_win" ? "Không trúng" : "Trúng voucher")}
                    </strong>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                      {h.created_at.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: h.result_type === "no_win" ? "#f1f5f9" : "#ecfdf5",
                      color: h.result_type === "no_win" ? "#64748b" : "#059669",
                    }}
                  >
                    {h.result_type === "no_win" ? "May mắn lần sau" : "Trúng thưởng"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && spinResult && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowResultModal(false)}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface, #ffffff)",
              borderRadius: 20,
              padding: 24,
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                backgroundColor: spinResult.segment.segmentType === "no_win" ? "#f1f5f9" : "#fef3c7",
                color: spinResult.segment.segmentType === "no_win" ? "#64748b" : "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px auto",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
                {spinResult.segment.segmentType === "no_win" ? "sentiment_neutral" : "redeem"}
              </span>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px 0", color: "var(--color-text-primary)" }}>
              {spinResult.segment.segmentType === "no_win" ? "Chúc bạn may mắn lần sau!" : "Chúc mừng bạn trúng thưởng!"}
            </h3>

            <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 16px 0" }}>
              {spinResult.segment.label}
            </p>

            {spinResult.voucher && (
              <div
                style={{
                  backgroundColor: "rgba(19, 122, 62, 0.08)",
                  border: "1px dashed var(--color-primary)",
                  borderRadius: 12,
                  padding: "12px",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>ĐÃ CẤP VÀO VÍ CỦA BẠN</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-primary)", marginTop: 2 }}>
                  {spinResult.voucher.title}
                </div>
                <code style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 4, display: "block" }}>
                  {spinResult.voucher.code}
                </code>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {spinResult.voucher && (
                <button
                  type="button"
                  className="eco-btn-primary"
                  onClick={() => {
                    setShowResultModal(false);
                    navigate("/vouchers/wallet");
                  }}
                  style={{ width: "100%", padding: 12 }}
                >
                  Mở ví voucher của tôi
                </button>
              )}
              <button
                type="button"
                className="eco-btn-outline"
                onClick={() => setShowResultModal(false)}
                style={{ width: "100%", padding: 10 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LuckySpinPage;

