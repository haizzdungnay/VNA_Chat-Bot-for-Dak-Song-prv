import React, { useState, useEffect, useCallback } from "react";
import type { AdminBookingItem, AdminBookingDetail } from "../types";
import { adminApi } from "../services/api";
import { ConfirmModal } from "../components/ConfirmModal";

interface BookingsPageProps {
  onNotify?: (type: "success" | "error" | "info", msg: string) => void;
}

export const BookingsPage: React.FC<BookingsPageProps> = ({ onNotify }) => {
  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");

  // Detail Modal State
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AdminBookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Action Confirmation
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getBookings({
        search: search.trim() || undefined,
        bookingStatus: bookingStatusFilter !== "all" ? bookingStatusFilter : undefined,
        paymentStatus: paymentStatusFilter !== "all" ? paymentStatusFilter : undefined,
      });
      setBookings(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi tải danh sách đơn đặt.");
    } finally {
      setLoading(false);
    }
  }, [search, bookingStatusFilter, paymentStatusFilter, onNotify]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const openDetail = async (id: string) => {
    setSelectedBookingId(id);
    setDetailLoading(true);
    try {
      const d = await adminApi.getBookingDetail(id);
      setDetailData(d);
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Lỗi tải chi tiết đơn.");
      setSelectedBookingId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancelId) return;
    try {
      await adminApi.cancelBooking(confirmCancelId, "Ban quản trị hủy theo yêu cầu");
      if (onNotify) onNotify("success", "Đã hủy đơn đặt thành công.");
      setConfirmCancelId(null);
      if (selectedBookingId) openDetail(selectedBookingId);
      await loadBookings();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Không thể hủy đơn đặt.");
    }
  };

  const handleRefund = async () => {
    if (!confirmRefundId) return;
    try {
      const res = await adminApi.mockRefundBooking(confirmRefundId, "Hoàn tiền mô phỏng từ ban quản trị");
      if (onNotify) onNotify("success", res.message || "Hoàn tiền mô phỏng thành công.");
      setConfirmRefundId(null);
      if (selectedBookingId) openDetail(selectedBookingId);
      await loadBookings();
    } catch (err: any) {
      if (onNotify) onNotify("error", err.message || "Không thể hoàn tiền đơn đặt.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
      case "paid":
        return { bg: "#ecfdf5", color: "#059669", text: status === "paid" ? "Đã thanh toán" : "Đã xác nhận" };
      case "pending":
      case "unpaid":
        return { bg: "#fffbeb", color: "#d97706", text: status === "unpaid" ? "Chưa thanh toán" : "Chờ xử lý" };
      case "failed":
        return { bg: "#fef2f2", color: "#dc2626", text: "Thất bại" };
      case "refunded":
        return { bg: "#f3e8ff", color: "#7e22ce", text: "Đã hoàn tiền" };
      case "cancelled":
        return { bg: "#f1f5f9", color: "#64748b", text: "Đã hủy" };
      default:
        return { bg: "#f1f5f9", color: "#334155", text: status };
    }
  };

  return (
    <div className="tab-pane">
      {/* Search & Filters */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Tìm theo mã đơn, tên khách, số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              width: 280,
            }}
          />

          <select
            value={bookingStatusFilter}
            onChange={(e) => setBookingStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              backgroundColor: "#fff",
            }}
          >
            <option value="all">Tất cả trạng thái đơn</option>
            <option value="pending">Chờ xử lý (pending)</option>
            <option value="confirmed">Đã xác nhận (confirmed)</option>
            <option value="cancelled">Đã hủy (cancelled)</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              backgroundColor: "#fff",
            }}
          >
            <option value="all">Tất cả trạng thái thanh toán</option>
            <option value="unpaid">Chưa thanh toán (unpaid)</option>
            <option value="paid">Đã thanh toán (paid)</option>
            <option value="refunded">Đã hoàn tiền (refunded)</option>
            <option value="failed">Thất bại (failed)</option>
          </select>
        </div>

        <div style={{ fontSize: 13, color: "#64748b" }}>
          Tổng cộng: <strong>{total}</strong> đơn đặt
        </div>
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Đang tải danh sách đơn đặt...</div>
      ) : bookings.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Chưa có đơn đặt nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                <th style={{ padding: "12px 16px" }}>Mã đơn hàng</th>
                <th style={{ padding: "12px 16px" }}>Khách hàng</th>
                <th style={{ padding: "12px 16px" }}>Số khách</th>
                <th style={{ padding: "12px 16px" }}>Tổng tiền</th>
                <th style={{ padding: "12px 16px" }}>Trạng thái đơn</th>
                <th style={{ padding: "12px 16px" }}>Thanh toán</th>
                <th style={{ padding: "12px 16px" }}>Thời gian</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const bBadge = getStatusBadge(b.booking_status);
                const pBadge = getStatusBadge(b.payment_status);
                return (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f766e" }}>
                      {b.booking_reference}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#1e293b" }}>{b.customer_name}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{b.customer_phone}</div>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#475569" }}>
                      {b.adults_count} lớn {b.children_count > 0 ? "• " + b.children_count + " trẻ" : ""}
                    </td>
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0f766e" }}>
                      {formatVnd(b.total_amount)}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: bBadge.bg,
                          color: bBadge.color,
                        }}
                      >
                        {bBadge.text}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: pBadge.bg,
                          color: pBadge.color,
                        }}
                      >
                        {pBadge.text}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#94a3b8", fontSize: 12 }}>
                      {b.created_at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      <button
                        onClick={() => openDetail(b.id)}
                        className="btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600 }}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBookingId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
          >
            {detailLoading || !detailData ? (
              <div style={{ padding: 40, textAlign: "center" }}>Đang tải dữ liệu chi tiết...</div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", margin: 0 }}>
                      Đơn hàng #{detailData.booking.booking_reference}
                    </h3>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Khởi tạo: {detailData.booking.created_at}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedBookingId(null)}
                    style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}
                  >
                    ✕
                  </button>
                </div>

                {/* Customer Snapshot */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: 14,
                    borderRadius: 6,
                    marginBottom: 16,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                    fontSize: 13,
                  }}
                >
                  <div><strong>Khách hàng:</strong> {detailData.booking.customer_name}</div>
                  <div><strong>Số điện thoại:</strong> {detailData.booking.customer_phone}</div>
                  <div><strong>Email:</strong> {detailData.booking.customer_email || "Chưa cung cấp"}</div>
                  <div><strong>Số lượng khách:</strong> {detailData.booking.adults_count} lớn, {detailData.booking.children_count} trẻ</div>
                  {detailData.booking.notes && (
                    <div style={{ gridColumn: "1 / -1" }}><strong>Ghi chú:</strong> {detailData.booking.notes}</div>
                  )}
                </div>

                {/* Line Items Snapshot */}
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#334155" }}>
                  Dịch vụ đã chọn (Snapshot bất biến)
                </h4>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left", color: "#64748b" }}>
                      <th style={{ padding: "8px" }}>Tên dịch vụ</th>
                      <th style={{ padding: "8px" }}>Đơn giá</th>
                      <th style={{ padding: "8px", textAlign: "center" }}>Số lượng</th>
                      <th style={{ padding: "8px", textAlign: "right" }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.items.map((it) => (
                      <tr key={it.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px", fontWeight: 600 }}>{it.item_name}</td>
                        <td style={{ padding: "8px" }}>{formatVnd(it.unit_price)}</td>
                        <td style={{ padding: "8px", textAlign: "center" }}>{it.quantity}</td>
                        <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, color: "#0f766e" }}>
                          {formatVnd(it.line_total)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3} style={{ padding: "10px 8px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                        Tổng cộng:
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 800, fontSize: 16, color: "#0f766e" }}>
                        {formatVnd(detailData.booking.total_amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Mock Payment Attempts */}
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#334155" }}>
                  Lịch sử giao dịch mô phỏng (Append-only Ledger)
                </h4>
                {detailData.paymentAttempts.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Chưa có giao dịch thanh toán nào được thực hiện.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {detailData.paymentAttempts.map((tx) => (
                      <div
                        key={tx.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                          backgroundColor: tx.status === "success" ? "#f0fdf4" : "#fef2f2",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "#1e293b" }}>{tx.transaction_reference}</div>
                          <div style={{ color: "#64748b" }}>
                            {tx.payment_method} • {tx.created_at.slice(0, 19).replace("T", " ")}
                            {tx.failure_reason && <span style={{ color: "#dc2626" }}> — {tx.failure_reason}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, color: tx.status === "success" ? "#059669" : "#dc2626" }}>
                            {formatVnd(tx.amount)}
                          </div>
                          {tx.refunded_amount > 0 && (
                            <div style={{ fontSize: 11, color: "#7e22ce" }}>
                              Đã hoàn: {formatVnd(tx.refunded_amount)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* State timeline */}
                <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "#334155" }}>
                  Nhật ký chuyển đổi trạng thái
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  {detailData.events.map((ev) => (
                    <div key={ev.id} style={{ fontSize: 12, color: "#475569", display: "flex", gap: 8 }}>
                      <span style={{ color: "#94a3b8" }}>{ev.created_at.slice(11, 19)}</span>
                      <strong style={{ color: "#0f766e" }}>[{ev.actor}]</strong>
                      <span>{ev.reason || ev.event_type}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 16,
                    borderTop: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    {detailData.booking.booking_status !== "cancelled" && detailData.booking.payment_status !== "paid" && (
                      <button
                        onClick={() => setConfirmCancelId(detailData.booking.id)}
                        className="btn-secondary"
                        style={{ color: "#dc2626", fontSize: 12, padding: "8px 14px" }}
                      >
                        Hủy đơn đặt
                      </button>
                    )}

                    {detailData.booking.payment_status === "paid" && (
                      <button
                        onClick={() => setConfirmRefundId(detailData.booking.id)}
                        className="btn-secondary"
                        style={{ color: "#7e22ce", fontSize: 12, padding: "8px 14px" }}
                      >
                        Hoàn tiền mô phỏng
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedBookingId(null)}
                    className="btn-secondary"
                    style={{ fontSize: 13, padding: "8px 16px" }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Confirmation */}
      {confirmCancelId && (
        <ConfirmModal
          isOpen={true}
          title="Xác nhận hủy đơn đặt"
          message="Bạn có chắc chắn muốn hủy đơn đặt này? Trạng thái sẽ được chuyển thành 'cancelled' và ghi nhật ký kiểm toán."
          confirmText="Xác nhận hủy"
          cancelText="Đóng"
          onConfirm={handleCancel}
          onCancel={() => setConfirmCancelId(null)}
          isDanger={true}
        />
      )}

      {/* Refund Confirmation */}
      {confirmRefundId && (
        <ConfirmModal
          isOpen={true}
          title="Xác nhận Hoàn tiền mô phỏng"
          message="Thao tác này sẽ ghi nhận hoàn tiền mô phỏng (Demo Refund) cho giao dịch đã thanh toán, hủy đơn đặt và trừ số tiền tương ứng khỏi doanh thu thuần mô phỏng. Tiếp tục?"
          confirmText="Xác nhận hoàn tiền"
          cancelText="Đóng"
          onConfirm={handleRefund}
          onCancel={() => setConfirmRefundId(null)}
          isDanger={false}
        />
      )}
    </div>
  );
};

