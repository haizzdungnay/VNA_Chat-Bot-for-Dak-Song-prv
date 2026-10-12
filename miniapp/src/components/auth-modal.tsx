import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export const AuthModal: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    isZalo,
    isAuthModalOpen,
    closeAuthModal,
    loginWithZalo,
    requestEmailOtp,
    verifyEmailOtp,
    logout,
  } = useAuth();

  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [step, setStep] = useState<"input-email" | "input-code">("input-email");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  if (!isAuthModalOpen) return null;

  const handleZaloLogin = async () => {
    setErrorMessage(null);
    setActionLoading(true);
    try {
      await loginWithZalo();
    } catch (err: any) {
      setErrorMessage(err.message || "Đăng nhập Zalo không thành công.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }
    setErrorMessage(null);
    setActionLoading(true);
    try {
      await requestEmailOtp(email.trim());
      setStep("input-code");
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể gửi mã xác thực email.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      setErrorMessage("Vui lòng nhập mã OTP gồm 6 chữ số.");
      return;
    }
    setErrorMessage(null);
    setActionLoading(true);
    try {
      await verifyEmailOtp(email.trim(), code.trim());
      setStep("input-email");
      setCode("");
    } catch (err: any) {
      setErrorMessage(err.message || "Xác thực mã OTP thất bại.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setErrorMessage(null);
    setActionLoading(true);
    try {
      await logout();
      setStep("input-email");
      setCode("");
    } catch (err: any) {
      setErrorMessage(err.message || "Lỗi khi đăng xuất.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={closeAuthModal}>
      <div
        className="sheet-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="sheet-handle" />

        <div style={{ padding: "12px 20px 24px 20px", overflowY: "auto", maxHeight: "80vh" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: "var(--color-primary-light)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  account_circle
                </span>
              </div>
              <div>
                <h2
                  id="auth-modal-title"
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: "var(--color-text-primary)",
                    margin: 0,
                  }}
                >
                  {isAuthenticated ? "Tài khoản của bạn" : "Đăng nhập VNA Đắk Song"}
                </h2>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                  {isAuthenticated ? "Quản lý thông tin đăng nhập" : "Lưu ưu đãi, lịch trình và quà tặng"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={closeAuthModal}
              style={{
                background: "none",
                border: "none",
                padding: 4,
                cursor: "pointer",
                color: "var(--color-text-secondary)",
              }}
              aria-label="Đóng"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                close
              </span>
            </button>
          </div>

          {errorMessage && (
            <div
              style={{
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {errorMessage}
            </div>
          )}

          {isAuthenticated && user ? (
            /* User profile authenticated state */
            <div>
              <div
                style={{
                  backgroundColor: "var(--color-bg-secondary, #f3f4f6)",
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: "var(--color-primary)",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName || "Avatar"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    (user.displayName || user.email || "U").charAt(0).toUpperCase()
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)" }}>
                    {user.displayName || "Khách du lịch"}
                  </div>
                  {user.email && (
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{user.email}</div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {(user.providers || []).map((p) => (
                      <span
                        key={p}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 6,
                          backgroundColor: p === "zalo" ? "#0068ff" : "var(--color-primary)",
                          color: "#ffffff",
                          fontWeight: 600,
                          textTransform: "uppercase",
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16 }}>
                Mã tài khoản: <code style={{ fontSize: 11 }}>{user.id.slice(0, 12)}...</code>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={actionLoading || isLoading}
                className="eco-btn-secondary"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 8,
                  fontWeight: 600,
                  color: "#dc2626",
                  borderColor: "#fca5a5",
                }}
              >
                {actionLoading ? "Đang xử lý..." : "Đăng xuất tài khoản"}
              </button>
            </div>
          ) : (
            /* Login Form */
            <div>
              {/* Option A: Zalo Login */}
              {isZalo && (
                <div style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={handleZaloLogin}
                    disabled={actionLoading || isLoading}
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: 10,
                      backgroundColor: "#0068ff",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      cursor: "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      smartphone
                    </span>
                    {actionLoading ? "Đang kết nối Zalo..." : "Đăng nhập nhanh với Zalo"}
                  </button>
                  <div
                    style={{
                      textAlign: "center",
                      margin: "14px 0",
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                      position: "relative",
                    }}
                  >
                    <span>hoặc đăng nhập bằng Email</span>
                  </div>
                </div>
              )}

              {/* Option B: Email OTP Login */}
              {step === "input-email" ? (
                <form onSubmit={handleRequestOtp}>
                  <label
                    htmlFor="email-input"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Địa chỉ Email
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vidu@gmail.com"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border, #d1d5db)",
                      backgroundColor: "var(--color-bg-input, #ffffff)",
                      color: "var(--color-text-primary)",
                      fontSize: 14,
                      marginBottom: 12,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || isLoading}
                    className="eco-btn-primary"
                    style={{
                      width: "100%",
                      padding: "11px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    {actionLoading ? "Đang gửi mã OTP..." : "Gửi mã xác thực (OTP)"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 10 }}>
                    Mã 6 chữ số đã được gửi tới: <strong>{email}</strong>
                  </div>
                  <label
                    htmlFor="otp-code-input"
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 6,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    Nhập mã xác thực (OTP)
                  </label>
                  <input
                    id="otp-code-input"
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border, #d1d5db)",
                      backgroundColor: "var(--color-bg-input, #ffffff)",
                      color: "var(--color-text-primary)",
                      fontSize: 18,
                      letterSpacing: "4px",
                      textAlign: "center",
                      fontWeight: 700,
                      marginBottom: 12,
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={actionLoading || isLoading}
                    className="eco-btn-primary"
                    style={{
                      width: "100%",
                      padding: "11px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 14,
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                  >
                    {actionLoading ? "Đang xác nhận..." : "Xác nhận đăng nhập"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("input-email")}
                    style={{
                      width: "100%",
                      background: "none",
                      border: "none",
                      color: "var(--color-primary)",
                      fontSize: 13,
                      cursor: "pointer",
                      padding: 6,
                    }}
                  >
                    Đổi email khác
                  </button>
                </form>
              )}

              <p
                style={{
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                  marginTop: 16,
                  textAlign: "center",
                  lineHeight: 1.4,
                }}
              >
                Bạn vẫn có thể khám phá địa điểm, xem tour VR360 và hỏi đáp với Trợ lý AI hoàn toàn ẩn danh mà không bắt buộc đăng nhập.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
