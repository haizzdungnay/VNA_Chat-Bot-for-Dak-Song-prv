import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import type {
  TourProduct,
  TourService,
  BookingQuote,
  BookingQuoteItem,
  TourBooking,
  ItineraryOutput,
} from "../types";

interface BookingCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary?: ItineraryOutput | null;
  tour?: TourProduct | null;
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  tour,
}) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { showToast } = useApp();

  const [stage, setStage] = useState<"quote" | "customer" | "payment" | "receipt" | "history">("quote");
  const [services, setServices] = useState<TourService[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [adultsCount, setAdultsCount] = useState<number>(itinerary?.travelersCount || 2);
  const [childrenCount, setChildrenCount] = useState<number>(itinerary?.childrenCount || 0);

  // Quote State
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteItems, setQuoteItems] = useState<BookingQuoteItem[]>([]);

  // Customer State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingIdempotencyKey] = useState(() => "bk-idem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  const [paymentIdempotencyKey] = useState(() => "pay-idem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8));
  const [bookingLoading, setBookingLoading] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<TourBooking | null>(null);

  // Payment State
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    success: boolean;
    txRef?: string;
    message?: string;
  } | null>(null);

  // My Bookings History
  const [myBookings, setMyBookings] = useState<TourBooking[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  useEffect(() => {
    if (isOpen) {
      api.getServices().then((res) => {
        setServices(res.services || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleCalculateQuote = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setQuoteLoading(true);
    try {
      const res = await api.requestQuote({
        tourId: tour?.id || null,
        itineraryId: itinerary?.id || null,
        selectedServiceIds,
        adultsCount,
        childrenCount,
        durationDays: itinerary?.durationDays || tour?.durationDays || 1,
      });
      setQuote(res.quote);
      setQuoteItems(res.items || []);
      setStage("customer");
      showToast("Đã lập bảng báo giá thành công!");
    } catch (err: any) {
      showToast(err.message || "Không thể lập báo giá.");
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      showToast("Vui lòng điền họ tên và số điện thoại.");
      return;
    }
    setBookingLoading(true);
    try {
      const res = await api.createBooking({
        quoteReference: quote.quote_reference,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        notes: notes.trim() || null,
          idempotencyKey: bookingIdempotencyKey,
      });
      setCreatedBooking(res.booking);
      setStage("payment");
      showToast("Tạo đơn đặt thành công. Chuyển sang thanh toán mô phỏng.");
    } catch (err: any) {
      showToast(err.message || "Lỗi tạo đơn đặt.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleSimulatePayment = async (status: "success" | "failed") => {
    if (!createdBooking) return;
    setPaymentLoading(true);
    try {
      const res = await api.processMockPayment({
        bookingId: createdBooking.id,
        simulateStatus: status,
          idempotencyKey: paymentIdempotencyKey,
      });
      setPaymentResult({
        success: res.success,
        txRef: res.transactionReference,
        message: res.message,
      });
      if (res.booking) setCreatedBooking(res.booking);
      setStage("receipt");
    } catch (err: any) {
      showToast(err.message || "Lỗi khi mô phỏng thanh toán.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleLoadHistory = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setHistoryLoading(true);
    setStage("history");
    try {
      const res = await api.getMyBookings();
      setMyBookings(res.bookings || []);
    } catch (err: any) {
      showToast(err.message || "Không thể tải lịch sử đơn đặt.");
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "92vh",
          backgroundColor: "var(--color-surface, #ffffff)",
          borderRadius: "16px 16px 0 0",
          overflowY: "auto",
          padding: 20,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
          color: "var(--color-text-primary, #1e293b)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--color-primary, #0f766e)", fontSize: 22 }}>
              shopping_cart_checkout
            </span>
            <span style={{ fontWeight: 800, fontSize: 16 }}>
              {stage === "history" ? "Đơn đặt của tôi" : "Đặt Tour & Dịch vụ Đắk Song"}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {stage !== "history" && (
              <button
                type="button"
                onClick={handleLoadHistory}
                style={{
                  border: "none",
                  background: "none",
                  color: "var(--color-primary, #0f766e)",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                Đơn của tôi
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* STAGE 1: QUOTE CONFIGURATION */}
        {stage === "quote" && (
          <div>
            <div
              style={{
                backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                padding: 12,
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 13,
                border: "1px solid var(--color-border, #e2e8f0)",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--color-primary, #0f766e)" }}>
                {tour ? "Tour trọn gói: " + tour.title : itinerary ? "Theo lịch trình: " + itinerary.title : "Tự chọn dịch vụ du lịch"}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-secondary, #64748b)", marginTop: 2 }}>
                Báo giá chuẩn máy chủ • Giá demo thử nghiệm
              </div>
            </div>

            {/* Travelers & Duration */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Người lớn</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={adultsCount}
                  onChange={(e) => setAdultsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #cbd5e1)",
                    backgroundColor: "var(--color-surface, #fff)",
                    color: "inherit",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Trẻ em</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={childrenCount}
                  onChange={(e) => setChildrenCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #cbd5e1)",
                    backgroundColor: "var(--color-surface, #fff)",
                    color: "inherit",
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {/* Tourism Services Selection */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Chọn dịch vụ bổ trợ:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {services.map((srv) => {
                  const isChecked = selectedServiceIds.includes(srv.id);
                  return (
                    <div
                      key={srv.id}
                      onClick={() => handleToggleService(srv.id)}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        border: isChecked ? "2px solid var(--color-primary, #0f766e)" : "1px solid var(--color-border, #e2e8f0)",
                        backgroundColor: isChecked ? "rgba(15, 118, 110, 0.05)" : "var(--color-surface, #fff)",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ accentColor: "var(--color-primary, #0f766e)", width: 16, height: 16 }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{srv.name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary, #64748b)" }}>
                            {srv.providerName || "Ban du lịch địa phương"}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--color-primary, #0f766e)" }}>
                        {srv.pricingRule ? formatVnd(srv.pricingRule.unitPrice) : "Chưa có giá"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCalculateQuote}
              disabled={quoteLoading}
              className="eco-btn-primary"
              style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700, borderRadius: 8 }}
            >
              {quoteLoading ? "Đang tính báo giá..." : "Nhận Báo Giá Chính Thức"}
            </button>
          </div>
        )}

        {/* STAGE 2: CUSTOMER INFO & QUOTE REVIEW */}
        {stage === "customer" && quote && (
          <form onSubmit={handleCreateBooking}>
            <div
              style={{
                backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                padding: 14,
                borderRadius: 8,
                marginBottom: 16,
                border: "1px solid var(--color-border, #e2e8f0)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, color: "var(--color-text-secondary)" }}>
                <span>Mã báo giá: <strong>{quote.quote_reference}</strong></span>
                <span>Hiệu lực 30 phút</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px dashed var(--color-border)", paddingTop: 8 }}>
                {quoteItems.map((qi, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{qi.item_name} (x{qi.quantity})</span>
                    <span style={{ fontWeight: 600 }}>{formatVnd(qi.line_total)}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--color-border)",
                  marginTop: 10,
                  paddingTop: 8,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 14 }}>Tổng tiền thanh toán:</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: "var(--color-primary, #0f766e)" }}>
                  {formatVnd(quote.total_price)}
                </span>
              </div>
            </div>

            {/* Customer Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Họ và tên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #cbd5e1)",
                    fontSize: 13,
                    backgroundColor: "var(--color-surface, #fff)",
                    color: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Số điện thoại liên hệ *</label>
                <input
                  type="tel"
                  required
                  placeholder="Ví dụ: 0912345678"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #cbd5e1)",
                    fontSize: 13,
                    backgroundColor: "var(--color-surface, #fff)",
                    color: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Email nhận xác nhận (tùy chọn)</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #cbd5e1)",
                    fontSize: 13,
                    backgroundColor: "var(--color-surface, #fff)",
                    color: "inherit",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>Ghi chú đặc biệt (tùy chọn)</label>
                <input
                  type="text"
                  placeholder="Ăn chay, đón tại bến xe..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #cbd5e1)",
                    fontSize: 13,
                    backgroundColor: "var(--color-surface, #fff)",
                    color: "inherit",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setStage("quote")}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid var(--color-border, #cbd5e1)",
                  backgroundColor: "var(--color-surface, #fff)",
                  color: "inherit",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Quay lại
              </button>
              <button
                type="submit"
                disabled={bookingLoading}
                className="eco-btn-primary"
                style={{ flex: 2, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 700 }}
              >
                {bookingLoading ? "Đang xử lý..." : "Xác nhận đặt đơn"}
              </button>
            </div>
          </form>
        )}

        {/* STAGE 3: MOCK PAYMENT GATEWAY */}
        {stage === "payment" && createdBooking && (
          <div>
            {/* MANDATORY NOTICE */}
            <div
              style={{
                backgroundColor: "#fffbeb",
                border: "2px solid #f59e0b",
                borderRadius: 8,
                padding: "14px",
                marginBottom: 16,
                color: "#92400e",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800 }}>THANH TOÁN MÔ PHỎNG — KHÔNG THU TIỀN THẬT</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Đây là giao thức kiểm thử nghiệp vụ nội bộ. Vui lòng chọn kịch bản kết quả để tiếp tục.
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                padding: 14,
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 13,
                border: "1px solid var(--color-border)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Mã đơn đặt:</span>
                <strong>{createdBooking.booking_reference}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Người đặt:</span>
                <span>{createdBooking.customer_name} ({createdBooking.customer_phone})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "var(--color-primary, #0f766e)", marginTop: 8, borderTop: "1px solid var(--color-border)", paddingTop: 8 }}>
                <span>Số tiền mô phỏng:</span>
                <span>{formatVnd(createdBooking.total_amount)}</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                disabled={paymentLoading}
                onClick={() => handleSimulatePayment("success")}
                style={{
                  padding: "14px",
                  borderRadius: 8,
                  backgroundColor: "#059669",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <span>✅ Mô phỏng thanh toán THÀNH CÔNG</span>
              </button>

              <button
                type="button"
                disabled={paymentLoading}
                onClick={() => handleSimulatePayment("failed")}
                style={{
                  padding: "12px",
                  borderRadius: 8,
                  backgroundColor: "#fee2e2",
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: 13,
                  border: "1px solid #fca5a5",
                  cursor: "pointer",
                }}
              >
                ❌ Mô phỏng thanh toán THẤT BẠI (Để thử lại)
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: RECEIPT & RESULT */}
        {stage === "receipt" && paymentResult && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>
              {paymentResult.success ? "🎉" : "⚠️"}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, color: paymentResult.success ? "#059669" : "#dc2626", margin: "0 0 6px" }}>
              {paymentResult.success ? "Thanh toán mô phỏng thành công!" : "Giao dịch mô phỏng thất bại!"}
            </h3>

            <p style={{ fontSize: 13, color: "var(--color-text-secondary, #64748b)", margin: "0 0 16px" }}>
              {paymentResult.message}
            </p>

            {paymentResult.success && createdBooking && (
              <div
                style={{
                  backgroundColor: "var(--color-bg-secondary, #f8fafc)",
                  padding: 14,
                  borderRadius: 8,
                  marginBottom: 20,
                  textAlign: "left",
                  fontSize: 13,
                  border: "1px solid var(--color-border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>Mã giao dịch:</span>
                  <strong style={{ color: "#0f766e" }}>{paymentResult.txRef}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span>Mã đơn đặt:</span>
                  <strong>{createdBooking.booking_reference}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tổng tiền:</span>
                  <strong style={{ color: "#0f766e" }}>{formatVnd(createdBooking.total_amount)}</strong>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              {!paymentResult.success ? (
                <button
                  type="button"
                  onClick={() => setStage("payment")}
                  className="eco-btn-primary"
                  style={{ width: "100%", padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 700 }}
                >
                  Thử lại thanh toán
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoadHistory}
                  className="eco-btn-primary"
                  style={{ width: "100%", padding: 12, borderRadius: 8, fontSize: 14, fontWeight: 700 }}
                >
                  Xem đơn đặt của tôi
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE 5: MY BOOKINGS HISTORY */}
        {stage === "history" && (
          <div>
            {historyLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Đang tải lịch sử...</div>
            ) : myBookings.length === 0 ? (
              <div style={{ padding: 30, textAlign: "center", color: "#64748b" }}>
                Bạn chưa có đơn đặt nào.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {myBookings.map((b) => (
                  <div
                    key={b.id}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--color-border, #e2e8f0)",
                      backgroundColor: "var(--color-surface, #fff)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: "var(--color-primary, #0f766e)", fontSize: 13 }}>
                        {b.booking_reference}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          backgroundColor: b.payment_status === "paid" ? "#ecfdf5" : "#fffbeb",
                          color: b.payment_status === "paid" ? "#059669" : "#d97706",
                        }}
                      >
                        {b.payment_status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13 }}>
                      <span style={{ color: "var(--color-text-secondary, #64748b)" }}>
                        {b.adults_count} lớn {b.children_count > 0 ? "• " + b.children_count + " trẻ" : ""}
                      </span>
                      <span style={{ fontWeight: 800, color: "var(--color-primary, #0f766e)" }}>
                        {formatVnd(b.total_amount)}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      Ngày đặt: {b.created_at.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setStage("quote")}
              style={{
                marginTop: 16,
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-surface)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + Đặt thêm tour / dịch vụ mới
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

