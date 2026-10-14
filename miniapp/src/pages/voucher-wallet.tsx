import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "zmp-ui";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import type { RewardWalletItem, RewardGiftClaim } from "../types";
import { LoadingView, EmptyView, ErrorView } from "../components/state-view";

const VoucherWalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { showToast } = useApp();

  const [items, setItems] = useState<RewardWalletItem[]>([]);
  const [giftClaims, setGiftClaims] = useState<RewardGiftClaim[]>([]);
  const [walletSection, setWalletSection] = useState<"vouchers" | "gifts">("vouchers");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedVoucher, setSelectedVoucher] = useState<RewardWalletItem | null>(null);

  const loadWallet = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (walletSection === "vouchers") {
        const statusParam = activeTab === "all" ? undefined : activeTab;
        const res = await api.getRewardWallet(statusParam, 1, 50);
        setItems(res.items || []);
      } else {
        const res = await api.getGiftClaims();
        setGiftClaims(res.claims || []);
      }
    } catch (err: any) {
      setError(err?.message || "Lỗi khi tải ví voucher");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeTab, walletSection]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    showToast("Đã sao chép mã ưu đãi " + code + "!");
  };

  const parseTerms = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {};
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "40px 16px", textAlign: "center" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: "var(--color-primary)" }}>
          account_balance_wallet
        </span>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "14px 0 6px 0" }}>Ví Voucher & Phần thưởng</h2>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
          Vui lòng đăng nhập để lưu trữ và quản lý các mã ưu đãi du lịch Đắk Song của bạn.
        </p>
        <button type="button" className="eco-btn-primary" onClick={openAuthModal}>
          Đăng nhập ngay
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 16px 40px 16px", maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
              Ví Voucher của tôi
            </h1>
            <p style={{ fontSize: 12, margin: "2px 0 0 0", color: "var(--color-text-secondary)" }}>
              Quản lý và sử dụng ưu đãi du lịch Đắk Song (DEMO)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/spin")}
          style={{
            backgroundColor: "#f59e0b",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            casino
          </span>
          Vòng quay
        </button>
      </div>

      {/* Demo Notice Banner */}
      <div
        style={{
          backgroundColor: "#fef3c7",
          border: "1px solid #fde68a",
          borderRadius: 12,
          padding: "10px 14px",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#d97706", flexShrink: 0 }}>
          verified
        </span>
        <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.4 }}>
          <strong>Lưu ý nghiệp vụ:</strong> Voucher trong ví là phần thưởng mô phỏng (DEMO). Khi trải nghiệm, xuất trình mã cho nhân viên đối tác/Admin để quét xác nhận.
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", backgroundColor: "var(--color-surface-container)", borderRadius: 10, padding: 4, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => setWalletSection("vouchers")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: walletSection === "vouchers" ? "var(--color-primary)" : "transparent",
            color: walletSection === "vouchers" ? "#ffffff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Mã Voucher
        </button>
        <button
          type="button"
          onClick={() => setWalletSection("gifts")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: walletSection === "gifts" ? "var(--color-primary)" : "transparent",
            color: walletSection === "gifts" ? "#ffffff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Quà lưu niệm ({giftClaims.length})
        </button>
      </div>

      {walletSection === "vouchers" && (
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 14,
        }}
      >
        {[
          { key: "all", label: "Tất cả" },
          { key: "issued", label: "Khả dụng" },
          { key: "redeemed", label: "Đã dùng" },
          { key: "expired", label: "Hết hạn" },
          { key: "revoked", label: "Đã thu hồi" },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid " + (active ? "var(--color-primary)" : "var(--color-border)"),
                backgroundColor: active ? "var(--color-primary)" : "var(--color-surface)",
                color: active ? "#ffffff" : "var(--color-text-primary)",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingView message="Đang tải ví voucher..." />
      ) : error ? (
        <ErrorView message={error} onRetry={loadWallet} />
      ) : walletSection === "gifts" ? (
        giftClaims.length === 0 ? (
          <EmptyView
            message="Bạn chưa có quà lưu niệm nào. Hãy thử vận may tại Vòng quay!"
            actionText="Quay ngay"
            onAction={() => navigate("/spin")}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {giftClaims.map((claim) => (
              <div
                key={claim.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: 14,
                  border: "1px solid var(--color-border)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        backgroundColor: claim.status === "fulfilled" ? "#ecfdf5" : "#fef3c7",
                        color: claim.status === "fulfilled" ? "#059669" : "#d97706",
                        textTransform: "uppercase",
                      }}
                    >
                      {claim.status === "fulfilled" ? "Đã nhận quà" : "Chờ nhận tại quầy"}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: "6px 0 2px 0" }}>
                      {claim.title}
                    </h3>
                    <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {claim.description}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--color-surface-container)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px dashed var(--color-border)",
                  }}
                >
                  <code style={{ fontSize: 15, fontWeight: 800, color: "#8b5cf6", letterSpacing: 1 }}>
                    {claim.claim_code}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(claim.claim_code)}
                    style={{ background: "none", border: "none", color: "var(--color-primary)", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                  >
                    Sao chép
                  </button>
                </div>

                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Trúng lúc: {claim.awarded_at.slice(0, 16).replace("T", " ")}
                  {claim.fulfilled_at && <span> • Đã nhận: {claim.fulfilled_at.slice(0, 16)}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
        <EmptyView
          message="Bạn chưa có mã ưu đãi nào trong mục này."
          actionText="Thử vận may tại Vòng quay"
          onAction={() => navigate("/spin")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((item) => {
            const isUsable = item.status === "issued" && new Date() <= new Date(item.expires_at);
            const isRedeemed = item.status === "redeemed";
            const isExpired = item.status === "expired" || (item.status === "issued" && new Date() > new Date(item.expires_at));

            let statusLabel = "Khả dụng";
            let statusColor = "#16a34a";
            let statusBg = "#f0fdf4";

            if (isRedeemed) {
              statusLabel = "Đã sử dụng";
              statusColor = "#7c3aed";
              statusBg = "#f5f3ff";
            } else if (isExpired) {
              statusLabel = "Đã hết hạn";
              statusColor = "#dc2626";
              statusBg = "#fef2f2";
            } else if (item.status === "revoked") {
              statusLabel = "Đã thu hồi";
              statusColor = "#64748b";
              statusBg = "#f1f5f9";
            }

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  borderRadius: 14,
                  border: "1px solid var(--color-border)",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  position: "relative",
                  opacity: isUsable ? 1 : 0.75,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        backgroundColor: statusBg,
                        color: statusColor,
                        textTransform: "uppercase",
                      }}
                    >
                      {statusLabel}
                    </span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", margin: "6px 0 2px 0" }}>
                      {item.title}
                    </h3>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--color-primary)" }}>
                      {item.discount_display}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedVoucher(item)}
                    style={{
                      backgroundColor: "var(--color-surface-container)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-text-secondary)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      visibility
                    </span>
                    Chi tiết
                  </button>
                </div>

                {/* Voucher Code Box */}
                <div
                  style={{
                    backgroundColor: "var(--color-surface-container)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: "1px dashed var(--color-border)",
                  }}
                >
                  <code style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)", letterSpacing: 1 }}>
                    {item.voucher_code}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(item.voucher_code)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-primary)",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      content_copy
                    </span>
                    Sao chép
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-secondary)" }}>
                  <span>HSD: {item.expires_at.slice(0, 10)}</span>
                  {item.redeemed_at && <span>Đã dùng lúc: {item.redeemed_at.slice(0, 16)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Voucher Detail Modal */}
      {selectedVoucher && (
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
          onClick={() => setSelectedVoucher(null)}
        >
          <div
            style={{
              backgroundColor: "var(--color-surface, #ffffff)",
              borderRadius: 18,
              padding: 20,
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase" }}>
                Thẻ Ưu Đãi Du Lịch
              </span>
              <button
                type="button"
                className="eco-icon-btn"
                onClick={() => setSelectedVoucher(null)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  close
                </span>
              </button>
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 6px 0", color: "var(--color-text-primary)" }}>
              {selectedVoucher.title}
            </h3>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary)", marginBottom: 14 }}>
              {selectedVoucher.discount_display}
            </div>

            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "2px dashed #cbd5e1",
                borderRadius: 12,
                padding: "16px",
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>MÃ XÁC NHẬN (DEMO)</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, color: "#0f172a" }}>
                {selectedVoucher.voucher_code}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                Xuất trình mã này cho nhân viên đối tác để quét xác nhận
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.5, marginBottom: 16 }}>
              <strong>Điều kiện áp dụng:</strong>
              <p style={{ margin: "4px 0 0 0" }}>
                {parseTerms(selectedVoucher.terms_conditions_snapshot).terms || "Áp dụng theo quy chế ưu đãi du lịch Đắk Song."}
              </p>
              <p style={{ margin: "4px 0 0 0", color: "#d97706" }}>
                {parseTerms(selectedVoucher.terms_conditions_snapshot).demoNotice}
              </p>
            </div>

            <button
              type="button"
              className="eco-btn-primary"
              style={{ width: "100%", padding: 12 }}
              onClick={() => {
                handleCopyCode(selectedVoucher.voucher_code);
                setSelectedVoucher(null);
              }}
            >
              Sao chép mã & Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoucherWalletPage;

