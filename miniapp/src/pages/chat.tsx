import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "zmp-ui";
import { api } from "../services/api";
import type { ChatMessage, Place } from "../types";
import { CHAT_SUGGESTION_CHIPS } from "../constants";
import { PlaceCard } from "../components/place-card";
import { useApp } from "../context/AppContext";
import {
  buildChatHistory,
  buildOutgoingPayloadText,
} from "../utils/chat-helpers";

export const AIChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const placeIdParam = searchParams.get("placeId");
  const qParam = searchParams.get("q") || (searchParams.get("articleSlug") ? `Tìm hiểu về bài viết ${searchParams.get("articleSlug")}` : null);

  const {
    profile,
    showToast,
    chatMessages,
    setChatMessages,
    clearChatMessages,
  } = useApp();
  const messages = chatMessages;
  const setMessages = setChatMessages;

  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable failed turn state to avoid duplicate bubbles on retry
  const [failedTurn, setFailedTurn] = useState<{ id: string; text: string } | null>(null);

  // Concurrency guard to prevent duplicate concurrent network requests
  const inFlightRef = useRef(false);

  // Contextual place state
  const [contextualPlace, setContextualPlace] = useState<Place | null>(null);
  const autoSentPlaceIdRef = useRef<string | null>(null);
  const autoSentQRef = useRef<string | null>(null);
  const notifiedInvalidPlaceIdRef = useRef<string | null>(null);

  // Cached map of placeId -> Place
  const [placesCache, setPlacesCache] = useState<Record<string, Place>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const formatTime = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Resolve PlaceCards metadata for placeIds
  const resolvePlaces = useCallback(async (placeIds: string[]) => {
    const missing = placeIds.filter((id) => !placesCache[id]);
    if (missing.length === 0) return;

    try {
      const fetched = await Promise.all(
        missing.map((id) => api.getPlaceById(id).catch(() => null))
      );
      setPlacesCache((prev) => {
        const next = { ...prev };
        fetched.forEach((p) => {
          if (p) next[p.id] = p;
        });
        return next;
      });
    } catch {
      // Ignore cache fetch error
    }
  }, [placesCache]);

  const executeSendMessage = async (userText: string, retryTurnId?: string) => {
    const cleanText = userText.trim();
    if (!cleanText || inFlightRef.current) return;

    inFlightRef.current = true;
    setLoading(true);
    setError(null);

    const isRetry = Boolean(retryTurnId);
    const activeMsgId = retryTurnId || `msg-${Date.now()}`;

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: activeMsgId,
        role: "user",
        content: cleanText,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
    }

    try {
      // Build history strictly excluding the active/failed user turn
      const historyPayload = buildChatHistory(messages, activeMsgId);
      const outgoingMessage = buildOutgoingPayloadText(cleanText, profile);

      const res = await api.sendChatMessage({
        message: outgoingMessage,
        history: historyPayload,
      });

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        content: res.answer,
        placeIds: res.placeIds || [],
        timestamp: formatTime(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setFailedTurn(null);

      if (res.placeIds && res.placeIds.length > 0) {
        resolvePlaces(res.placeIds);
      }
    } catch (err: any) {
      setError(err?.message || "Không thể gửi tin nhắn. Vui lòng thử lại.");
      setFailedTurn({ id: activeMsgId, text: cleanText });
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (content) {
      executeSendMessage(content);
    }
  };

  const handleRetry = () => {
    if (failedTurn && !inFlightRef.current) {
      executeSendMessage(failedTurn.text, failedTurn.id);
    }
  };

  // Handle article/question query param (?q=... or ?articleSlug=...) auto-send once
  useEffect(() => {
    if (qParam && autoSentQRef.current !== qParam) {
      autoSentQRef.current = qParam;
      setSearchParams({});
      executeSendMessage(qParam);
    }
  }, [qParam]);

  // Handle contextual placeId param with P2 invalid place notice
  useEffect(() => {
    if (!placeIdParam) {
      setContextualPlace(null);
      autoSentPlaceIdRef.current = null;
      return;
    }

    if (autoSentPlaceIdRef.current === placeIdParam) return;

    let isMounted = true;
    api
      .getPlaceById(placeIdParam)
      .then((placeData) => {
        if (!isMounted) return;
        setContextualPlace(placeData);

        if (autoSentPlaceIdRef.current !== placeIdParam) {
          autoSentPlaceIdRef.current = placeIdParam;
          const prompt = `Hãy giới thiệu cho mình về ${placeData.name} và gợi ý những điều nên trải nghiệm tại đây.`;
          executeSendMessage(prompt);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setContextualPlace(null);
        setSearchParams({});

        // Friendly notice for invalid/missing placeId, guarded against replay
        if (notifiedInvalidPlaceIdRef.current !== placeIdParam) {
          notifiedInvalidPlaceIdRef.current = placeIdParam;
          showToast(
            "Không thể tải thông tin địa điểm này. Bạn vẫn có thể trò chuyện với trợ lý AI như bình thường."
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, [placeIdParam]);

  const handleClearContextualPlace = () => {
    setContextualPlace(null);
    setSearchParams({});
  };

  return (
    <div className="chat-container">
      {/* 1. Header Greeting & Status Panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--color-secondary-container)",
              color: "var(--color-on-secondary-container)",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                backgroundColor: "var(--color-secondary-leaf)",
              }}
            />
            <span>Sẵn sàng hỗ trợ</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {messages.length > 1 && (
              <button
                type="button"
                onClick={clearChatMessages}
                style={{
                  border: "none",
                  backgroundColor: "var(--color-surface-container, #f3f4f6)",
                  cursor: "pointer",
                  color: "var(--color-text-secondary, #4b5563)",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "4px 9px",
                  borderRadius: "var(--radius-full, 9999px)",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  restart_alt
                </span>
                <span>Hội thoại mới</span>
              </button>
            )}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-ochre-bg)",
                color: "var(--color-ochre)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                psychology
              </span>
              <span>AI Đắk Song</span>
            </div>
          </div>
        </div>

        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Trợ lý AI Đắk Song
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              margin: "2px 0 0 0",
            }}
          >
            Trợ lý ảo thông minh đồng hành cùng chuyến đi của bạn
          </p>
        </div>
      </div>

      {/* 2. Contextual Place Chip if querying specific place */}
      {contextualPlace && (
        <div style={{ marginBottom: 10 }}>
          <span className="contextual-place-chip">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              location_on
            </span>
            <span>Đang tìm hiểu: {contextualPlace.name}</span>
            <button
              type="button"
              onClick={handleClearContextualPlace}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--color-primary)",
                cursor: "pointer",
                padding: "0 2px",
                display: "inline-flex",
                alignItems: "center",
              }}
              aria-label="Xóa ngữ cảnh địa điểm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                close
              </span>
            </button>
          </span>
        </div>
      )}

      {/* 3. Quick Suggestion Chips */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-ochre)",
            marginBottom: 6,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            tips_and_updates
          </span>
          <span>Gợi ý câu hỏi nhanh</span>
        </div>

        <div className="filter-chip-row no-scrollbar">
          {CHAT_SUGGESTION_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className="filter-chip"
              onClick={() => handleSendMessage(chip.prompt)}
              disabled={loading}
              style={{
                backgroundColor: "var(--color-surface)",
                borderColor: "var(--color-ochre-border)",
              }}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Chat Messages Stream */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                width: "100%",
              }}
            >
              {/* Message Bubble */}
              <div className={isUser ? "chat-bubble-user" : "chat-bubble-assistant"}>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
                {msg.timestamp && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      marginTop: 4,
                      textAlign: isUser ? "right" : "left",
                      opacity: 0.75,
                    }}
                  >
                    {msg.timestamp}
                  </span>
                )}
              </div>

              {/* Recommended PlaceCards if returned by AI */}
              {!isUser && msg.placeIds && msg.placeIds.length > 0 && (
                <div style={{ width: "95%", maxWidth: 380, marginTop: 4 }}>
                  {msg.placeIds.map((pid) => {
                    const place = placesCache[pid];
                    return place ? (
                      <PlaceCard key={pid} place={place} compact />
                    ) : null;
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2px solid var(--color-border)",
                borderTopColor: "var(--color-primary)",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
              AI đang suy nghĩ...
            </span>
          </div>
        )}

        {/* Error View */}
        {error && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "rgba(220, 53, 69, 0.1)",
              border: "1px solid rgba(220, 53, 69, 0.3)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignSelf: "flex-start",
              maxWidth: "88%",
            }}
          >
            <span style={{ fontSize: 13, color: "#dc3545" }}>{error}</span>
            <button
              type="button"
              className="eco-btn-primary"
              style={{ height: 32, fontSize: 12, width: "auto", alignSelf: "flex-start", padding: "0 12px" }}
              onClick={handleRetry}
              disabled={loading}
            >
              Thử lại
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 5. Fixed Bottom Composer Bar */}
      <div className="chat-composer-bar">
        <input
          type="text"
          className="chat-composer-input"
          placeholder="Hỏi về địa điểm, đồ ăn, lịch trình..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendMessage();
          }}
          disabled={loading}
        />
        <button
          type="button"
          className="chat-send-btn"
          onClick={() => handleSendMessage()}
          disabled={loading || !inputText.trim()}
          aria-label="Gửi tin nhắn"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            send
          </span>
        </button>
      </div>
    </div>
  );
};

export default AIChatPage;
