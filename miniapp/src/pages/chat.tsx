import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "zmp-ui";
import { api } from "../services/api";
import type { ChatMessage, Place } from "../types";
import { CHAT_SUGGESTION_CHIPS } from "../constants";
import { PlaceCard } from "../components/place-card";
import { useApp } from "../context/AppContext";

const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 8;

export const AIChatPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const placeIdParam = searchParams.get("placeId");

  const { profile } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào 👋\nTôi là trợ lý du lịch Đắk Song.\nBạn muốn tìm địa điểm tham quan, ẩm thực hay gợi ý lịch trình mẫu hôm nay?",
      placeIds: [],
      timestamp: "Vừa xong",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  // Contextual place state
  const [contextualPlace, setContextualPlace] = useState<Place | null>(null);
  const autoSentPlaceIdRef = useRef<string | null>(null);

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

  // Construct message text to send to AI with optional personalization
  const buildOutgoingPayloadText = useCallback(
    (userQuestion: string): string => {
      const cleanQuestion = userQuestion.trim();

      if (!profile || !profile.allowAIContext) {
        return cleanQuestion.slice(0, MAX_MESSAGE_LENGTH);
      }

      // Format short context prefix
      const lines: string[] = ["[Tuỳ chọn do người dùng cung cấp — chỉ phục vụ cách xưng hô]"];
      if (profile.displayName) {
        const cleanName = profile.displayName.replace(/[\r\n]/g, " ").trim();
        lines.push(`Tên gọi: ${cleanName}`);
      }
      if (profile.addressAs) {
        lines.push(`Cách xưng hô: ${profile.addressAs}`);
      }
      if (profile.ageGroup) {
        const ageLabels: Record<string, string> = {
          under18: "Dưới 18",
          "18-24": "18–24",
          "25-34": "25–34",
          "35-49": "35–49",
          "50plus": "50+",
        };
        const ageText = ageLabels[profile.ageGroup] || profile.ageGroup;
        lines.push(`Nhóm tuổi: ${ageText}`);
      }
      lines.push("[Nội dung người dùng hỏi]");
      lines.push(cleanQuestion);

      const combined = lines.join("\n");
      // If combined exceeds 500 limit, drop personalization prefix to protect the question
      if (combined.length <= MAX_MESSAGE_LENGTH) {
        return combined;
      }
      return cleanQuestion.slice(0, MAX_MESSAGE_LENGTH);
    },
    [profile]
  );

  const executeSendMessage = async (userText: string, isRetry = false) => {
    if (!userText || loading) return;

    if (!isRetry) {
      const userMsg: ChatMessage = {
        id: String(Date.now()),
        role: "user",
        content: userText,
        timestamp: formatTime(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputText("");
    }

    setLoading(true);
    setError(null);
    setLastFailedMessage(userText);

    try {
      // Build history payload (last MAX_HISTORY_MESSAGES, user and assistant only)
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .slice(-MAX_HISTORY_MESSAGES)
        .map((m) => ({ role: m.role, content: m.content }));

      const outgoingMessage = buildOutgoingPayloadText(userText);

      const res = await api.sendChatMessage({
        message: outgoingMessage,
        history: historyPayload,
      });

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: res.answer,
        placeIds: res.placeIds || [],
        timestamp: formatTime(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setLastFailedMessage(null);

      if (res.placeIds && res.placeIds.length > 0) {
        resolvePlaces(res.placeIds);
      }
    } catch (err: any) {
      setError(err?.message || "Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (content) {
      executeSendMessage(content, false);
    }
  };

  const handleRetry = () => {
    if (lastFailedMessage) {
      executeSendMessage(lastFailedMessage, true);
    }
  };

  // Handle contextual placeId param
  useEffect(() => {
    if (!placeIdParam) {
      setContextualPlace(null);
      return;
    }

    // Guard duplicate fetch and auto-send in Strict Mode
    if (autoSentPlaceIdRef.current === placeIdParam) return;

    let isMounted = true;
    api
      .getPlaceById(placeIdParam)
      .then((placeData) => {
        if (!isMounted) return;
        setContextualPlace(placeData);

        // Auto-send contextual inquiry once
        if (autoSentPlaceIdRef.current !== placeIdParam) {
          autoSentPlaceIdRef.current = placeIdParam;
          const prompt = `Hãy giới thiệu cho mình về ${placeData.name} và gợi ý những điều nên trải nghiệm tại đây.`;
          executeSendMessage(prompt, false);
        }
      })
      .catch(() => {
        // Fallback to regular chat if place not found
        if (isMounted) {
          setContextualPlace(null);
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
