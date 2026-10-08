import React from "react";

export interface LoadingViewProps {
  message?: string;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ message = "Đang tải dữ liệu..." }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "36px 16px",
      gap: 12,
    }}
  >
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "3px solid var(--color-border)",
        borderTopColor: "var(--color-primary)",
        animation: "spin 0.8s linear infinite",
      }}
    />
    <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>{message}</span>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

export interface EmptyViewProps {
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyView: React.FC<EmptyViewProps> = ({
  message = "Chưa có dữ liệu",
  actionText,
  onAction,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "36px 16px",
      textAlign: "center",
      gap: 12,
    }}
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        backgroundColor: "var(--color-surface-container)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
        nature_people
      </span>
    </div>
    <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: 0 }}>
      {message}
    </p>
    {actionText && onAction && (
      <button
        type="button"
        className="eco-btn-secondary"
        style={{ width: "auto", padding: "0 18px", height: 38, fontSize: 13, marginTop: 4 }}
        onClick={onAction}
      >
        {actionText}
      </button>
    )}
  </div>
);

export interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = "Đã xảy ra lỗi khi tải dữ liệu",
  onRetry,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "32px 16px",
      textAlign: "center",
      gap: 12,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        backgroundColor: "rgba(220, 53, 69, 0.12)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#dc3545",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
        error_outline
      </span>
    </div>
    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0 }}>
      {message}
    </p>
    {onRetry && (
      <button
        type="button"
        className="eco-btn-primary"
        style={{ width: "auto", padding: "0 18px", height: 38, fontSize: 13, marginTop: 4 }}
        onClick={onRetry}
      >
        Thử lại
      </button>
    )}
  </div>
);
