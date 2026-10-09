import React from "react";
import { useNavigate } from "zmp-ui";
import { sanitizeArticleHtml } from "../utils/sanitize";
import type { Article } from "../types";

interface ArticleModalProps {
  article: Article | null;
  onClose: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ article, onClose }) => {
  const navigate = useNavigate();

  const sanitizedContent = React.useMemo(() => {
    if (!article?.content) return "<p>Nội dung đang được cập nhật...</p>";
    return sanitizeArticleHtml(article.content);
  }, [article?.content]);

  const handleAskAI = React.useCallback(() => {
    if (!article) return;
    onClose();
    navigate(
      `/chat?q=${encodeURIComponent(`Tìm hiểu thêm về "${article.title}"`)}&articleSlug=${encodeURIComponent(article.slug)}`
    );
  }, [article, onClose, navigate]);

  // Hook calls strictly unconditional above. Safe conditional render:
  if (!article) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxHeight: "88vh",
          backgroundColor: "var(--color-surface, #ffffff)",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -8px 30px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Drag Handle & Close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px 16px",
            borderBottom: "1px solid var(--color-border, #e5e7eb)",
            position: "sticky",
            top: 0,
            backgroundColor: "var(--color-surface, #ffffff)",
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-secondary, #2563eb)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {article.categoryName}
          </span>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              padding: 4,
              cursor: "pointer",
              color: "var(--color-text-secondary, #6b7280)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              close
            </span>
          </button>
        </div>

        {/* Hero Image */}
        {article.imageUrl && (
          <div style={{ width: "100%", height: 210, overflow: "hidden", position: "relative" }}>
            <img
              src={article.imageUrl}
              alt={article.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: "16px 18px 24px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--color-text-primary, #111827)",
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            {article.title}
          </h2>

          {article.quote && (
            <div
              style={{
                padding: "10px 12px",
                backgroundColor: "var(--color-bg-neutral, #f3f4f6)",
                borderLeft: "3px solid var(--color-primary, #137A3E)",
                borderRadius: 6,
                fontSize: 13,
                fontStyle: "italic",
                color: "var(--color-text-secondary, #4b5563)",
                lineHeight: 1.45,
              }}
            >
              {article.quote}
            </div>
          )}

          {/* Render article HTML content safely */}
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--color-text-primary, #1f2937)",
            }}
            dangerouslySetInnerHTML={{
              __html: sanitizedContent,
            }}
          />

          {/* Action Button: Ask AI */}
          <div style={{ paddingTop: 10, display: "flex", gap: 10 }}>
            <button
              type="button"
              className="eco-btn-ochre"
              style={{ flex: 1 }}
              onClick={handleAskAI}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                auto_awesome
              </span>
              <span>Hỏi trợ lý AI về bài viết này</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
