import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import type { AddressAs, AgeGroup } from "../types";
import { ADDRESS_OPTIONS, AGE_GROUP_OPTIONS } from "../constants";

export const WelcomePersonalizationSheet: React.FC = () => {
  const {
    isWelcomeSheetOpen,
    closeWelcomeSheet,
    profile,
    saveProfile,
    deleteProfile,
    dismissOnboarding,
    onboardingSeen,
    isStoragePersistent,
  } = useApp();

  const isEditing = Boolean(profile) || onboardingSeen;

  const [displayName, setDisplayName] = useState<string>("");
  const [addressAs, setAddressAs] = useState<AddressAs>("ban");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(null);
  const [allowAIContext, setAllowAIContext] = useState<boolean>(false);
  const [allowServerProfileStorage, setAllowServerProfileStorage] = useState<boolean>(false);

  // Sync state whenever sheet opens or profile changes
  useEffect(() => {
    if (isWelcomeSheetOpen) {
      if (profile) {
        setDisplayName(profile.displayName || "");
        setAddressAs(profile.addressAs || "ban");
        setAgeGroup(profile.ageGroup ?? null);
        setAllowAIContext(Boolean(profile.allowAIContext));
        setAllowServerProfileStorage(Boolean(profile.allowServerProfileStorage));
      } else {
        setDisplayName("");
        setAddressAs("ban");
        setAgeGroup(null);
        setAllowAIContext(false);
        setAllowServerProfileStorage(false);
      }
    }
  }, [isWelcomeSheetOpen, profile]);

  if (!isWelcomeSheetOpen) return null;

  const handleSave = () => {
    saveProfile({
      displayName: displayName.trim() || undefined,
      addressAs,
      ageGroup,
      allowAIContext,
      allowServerProfileStorage,
    });
  };

  const handleSkipOrClose = () => {
    if (!onboardingSeen) {
      dismissOnboarding();
    } else {
      closeWelcomeSheet();
    }
  };

  const handleDelete = () => {
    deleteProfile();
  };

  return (
    <div className="sheet-backdrop" onClick={handleSkipOrClose}>
      <div
        className="sheet-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
      >
        <div className="sheet-handle" />

        <div style={{ padding: "12px 20px 24px 20px", overflowY: "auto", maxHeight: "80vh" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: "var(--color-primary-light)",
                color: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                spa
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <h2
                id="sheet-title"
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Chào mừng đến với Đắk Song! 🌿
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  margin: "4px 0 0 0",
                  lineHeight: 1.45,
                }}
              >
                Cho mình biết một chút về bạn để chuyến khám phá và những cuộc trò chuyện với trợ lý AI trở nên gần gũi hơn nhé.
              </p>
            </div>
          </div>

          {/* Transparent notice if storage is only in-memory */}
          {!isStoragePersistent && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-ochre-bg)",
                border: "1px solid var(--color-ochre-border)",
                fontSize: 12,
                color: "var(--color-ochre)",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                info
              </span>
              <span>Lưu ý: Môi trường này chỉ lưu thông tin trong phiên truy cập hiện tại.</span>
            </div>
          )}

          {/* Form Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Field 1: Display Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                Bạn muốn được gọi là gì?{" "}
                <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>
                  (không bắt buộc)
                </span>
              </label>
              <input
                type="text"
                maxLength={32}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tên hoặc biệt danh"
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 14px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-surface-container)",
                  color: "var(--color-text-primary)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                Không cần nhập họ tên thật.
              </span>
            </div>

            {/* Field 2: Pronoun / Xưng hô */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                Cách xưng hô bạn thích
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {ADDRESS_OPTIONS.map((opt) => {
                  const isSelected = addressAs === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={"pronoun-btn " + (isSelected ? "selected" : "")}
                      onClick={() => setAddressAs(opt.value)}
                    >
                      {isSelected && (
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 16, marginRight: 2 }}
                        >
                          check
                        </span>
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field 3: Age Group */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                }}
              >
                Nhóm tuổi{" "}
                <span style={{ fontWeight: 400, color: "var(--color-text-secondary)" }}>
                  (không bắt buộc)
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <select
                  value={ageGroup ?? ""}
                  onChange={(e) => setAgeGroup((e.target.value as AgeGroup) || null)}
                  style={{
                    width: "100%",
                    height: 44,
                    padding: "0 36px 0 14px",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface-container)",
                    color: "var(--color-text-primary)",
                    fontSize: 14,
                    outline: "none",
                    appearance: "none",
                  }}
                >
                  {AGE_GROUP_OPTIONS.map((opt, idx) => (
                    <option key={idx} value={opt.value ?? ""}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span
                  className="material-symbols-outlined"
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--color-text-secondary)",
                    pointerEvents: "none",
                  }}
                >
                  expand_more
                </span>
              </div>
            </div>

            {/* Field 4: AI Personalization Opt-in Checkbox */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-surface-container)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <input
                id="ai-optin"
                type="checkbox"
                checked={allowAIContext}
                onChange={(e) => setAllowAIContext(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 2,
                  accentColor: "var(--color-primary)",
                  cursor: "pointer",
                }}
              />
              <label htmlFor="ai-optin" style={{ cursor: "pointer", flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.35,
                  }}
                >
                  Cho phép dùng các lựa chọn này để cá nhân hóa cách trò chuyện với trợ lý AI
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.4,
                    marginTop: 4,
                  }}
                >
                  Thông tin được lưu trên thiết bị. Nếu bật tùy chọn AI, dữ liệu phù hợp có thể được gửi cùng câu hỏi để trợ lý xưng hô tự nhiên hơn.
                </span>
              </label>
            </div>

            {/* Field 5: Server Profile Storage Opt-in Checkbox */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-surface-container)",
                border: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <input
                id="server-optin"
                type="checkbox"
                checked={allowServerProfileStorage}
                onChange={(e) => setAllowServerProfileStorage(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  marginTop: 2,
                  accentColor: "var(--color-primary)",
                  cursor: "pointer",
                }}
              />
              <label htmlFor="server-optin" style={{ cursor: "pointer", flex: 1 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.35,
                  }}
                >
                  Đồng ý chia sẻ thông tin xưng hô lên hệ thống để hỗ trợ thống kê khách tham quan
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.4,
                    marginTop: 4,
                  }}
                >
                  Tùy chọn tự nguyện. Chỉ lưu tên/biệt danh, cách xưng hô và nhóm tuổi ẩn danh. Không thu thập số điện thoại, định vị hay ID Zalo.
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="eco-btn-primary" onClick={handleSave}>
              <span>{isEditing ? "Lưu thay đổi" : "Lưu và bắt đầu khám phá"}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_forward
              </span>
            </button>

            <button
              type="button"
              onClick={handleSkipOrClose}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-text-secondary)",
                fontSize: 13,
                fontWeight: 500,
                padding: "8px 0",
                cursor: "pointer",
              }}
            >
              {isEditing ? "Đóng" : "Bỏ qua, khám phá ngay"}
            </button>

            {isEditing && profile && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#d32f2f",
                  fontSize: 12,
                  padding: "4px 0",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  delete_outline
                </span>
                <span>Xóa thông tin đã lưu</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

