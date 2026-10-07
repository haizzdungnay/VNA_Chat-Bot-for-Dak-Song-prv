import React, { useState, useEffect, useRef } from "react";
import { Page, Header, Box, Text, Button, Input, Spinner } from "zmp-ui";
import { api } from "../services/api";
import type { ChatMessage, Place } from "../types";
import { CHAT_SUGGESTION_CHIPS } from "../constants";
import { PlaceCard } from "../components/place-card";

const AIChatPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Xin chào! Tôi là trợ lý du lịch Đắk Song. Bạn muốn tìm hiểu địa điểm tham quan, ẩm thực hay gợi ý lịch trình?",
      placeIds: [],
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cached map of placeId -> Place to render PlaceCards in chat
  const [placesCache, setPlacesCache] = useState<Record<string, Place>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Load places metadata for placeIds returned by AI
  const resolvePlaces = async (placeIds: string[]) => {
    const missingIds = placeIds.filter((id) => !placesCache[id]);
    if (missingIds.length === 0) return;

    try {
      const fetched = await Promise.all(
        missingIds.map((id) => api.getPlaceById(id).catch(() => null))
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
  };

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);
    setError(null);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.sendChatMessage({
        message: content,
        history: historyPayload,
      });

      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: res.answer,
        placeIds: res.placeIds || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (res.placeIds && res.placeIds.length > 0) {
        resolvePlaces(res.placeIds);
      }
    } catch (err: any) {
      setError(err?.message || "Không thể gửi tin nhắn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <Header title="Trợ lý AI Đắk Song" showBackIcon={false} />

      <Box
        p={4}
        flex
        flexDirection="column"
        style={{
          minHeight: "calc(100vh - 120px)",
          paddingBottom: 90,
        }}
      >
        {/* Suggestion Chips */}
        <Box mb={3} flex style={{ gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {CHAT_SUGGESTION_CHIPS.map((chip, idx) => (
            <button
              key={idx}
              className="chip-btn"
              onClick={() => handleSendMessage(chip)}
              disabled={loading}
            >
              {chip}
            </button>
          ))}
        </Box>

        {/* Message Stream */}
        <Box flex flexDirection="column" style={{ gap: 12, flex: 1 }}>
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
                <div className={isUser ? "chat-bubble-user" : "chat-bubble-assistant"}>
                  <Text size="normal" style={{ whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </Text>
                </div>

                {/* Render PlaceCards if placeIds attached to assistant answer */}
                {!isUser && msg.placeIds && msg.placeIds.length > 0 && (
                  <Box mt={2} style={{ width: "90%" }}>
                    <Text size="xSmall" bold style={{ color: "#767a7f", marginBottom: 6 }}>
                      Địa điểm được gợi ý:
                    </Text>
                    {msg.placeIds.map((pid) => {
                      const place = placesCache[pid];
                      return place ? (
                        <PlaceCard key={pid} place={place} compact />
                      ) : (
                        <div
                          key={pid}
                          style={{
                            padding: 8,
                            backgroundColor: "#ffffff",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "#555",
                            marginBottom: 4,
                          }}
                        >
                          📍 {pid}
                        </div>
                      );
                    })}
                  </Box>
                )}
              </div>
            );
          })}

          {loading && (
            <Box flex alignItems="center" p={2} style={{ alignSelf: "flex-start" }}>
              <Spinner visible />
              <Text size="xSmall" style={{ marginLeft: 8, color: "#767a7f" }}>
                AI đang suy nghĩ...
              </Text>
            </Box>
          )}

          {error && (
            <Box p={3} style={{ backgroundColor: "#ffeef0", borderRadius: 8 }}>
              <Text size="small" style={{ color: "#d32f2f" }}>
                {error}
              </Text>
              <Button
                size="small"
                variant="tertiary"
                onClick={() => handleSendMessage()}
                style={{ marginTop: 4 }}
              >
                Thử lại
              </Button>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>

        {/* Input Bar */}
        <Box
          p={3}
          style={{
            position: "fixed",
            bottom: 48,
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e2e4e8",
            display: "flex",
            alignItems: "center",
            gap: 8,
            zIndex: 100,
          }}
        >
          <Input
            placeholder="Hỏi về địa điểm, đồ ăn..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSendMessage();
            }}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            size="medium"
            onClick={() => handleSendMessage()}
            disabled={loading || !inputText.trim()}
          >
            Gửi
          </Button>
        </Box>
      </Box>
    </Page>
  );
};

export default AIChatPage;
