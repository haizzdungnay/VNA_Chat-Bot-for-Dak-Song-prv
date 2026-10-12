import React, { useState, useEffect } from "react";
// import { useNavigate } from "zmp-ui";
import { useApp } from "../context/AppContext";
import { api } from "../services/api";
import type { TourProduct } from "../types";
import { BookingCheckoutModal } from "../components/BookingCheckoutModal";

interface VoucherItem {
  id: string;
  code: string;
  title: string;
  discount: string;
  category: "all" | "food" | "stay" | "tour";
  categoryLabel: string;
  description: string;
  condition: string;
  expiry: string;
  icon: string;
}

const DAK_SONG_VOUCHERS: VoucherItem[] = [
  {
    id: "v1",
    code: "DAKSONG20",
    title: "Thưởng thức Cà phê Đắk Song",
    discount: "Giảm 20%",
    category: "food",
    categoryLabel: "Ẩm thực",
    description: "Áp dụng tại các quán cà phê bản địa và trạm dừng chân liên kết trên địa bàn huyện.",
    condition: "Đơn từ 100.000đ",
    expiry: "31/12/2026",
    icon: "coffee",
  },
  {
    id: "v2",
    code: "NAMNUNG15",
    title: "Tour trekking Rừng nguyên sinh Nâm Nung",
    discount: "Giảm 15%",
    category: "tour",
    categoryLabel: "Tour & Vé",
    description: "Khám phá thảm thực vật đặc hữu và rừng đại ngàn Tây Nguyên với hướng dẫn viên địa phương.",
    condition: "Áp dụng nhóm từ 2 khách",
    expiry: "31/12/2026",
    icon: "forest",
  },
  {
    id: "v3",
    code: "VR360FREE",
    title: "Trải nghiệm thực tế ảo VR360 toàn cảnh",
    discount: "Miễn phí",
    category: "tour",
    categoryLabel: "Tour & Vé",
    description: "Vé trải nghiệm tour 3D thực tế ảo tại các điểm chạm thông tin du lịch Đắk Song.",
    condition: "Áp dụng mọi du khách",
    expiry: "31/12/2026",
    icon: "view_in_ar",
  },
  {
    id: "v4",
    code: "STAY100K",
    title: "Homestay sinh thái cộng đồng M'nông",
    discount: "Giảm 100K",
    category: "stay",
    categoryLabel: "Lưu trú",
    description: "Ưu đãi đặt phòng tại các homestay văn hóa bản địa, hòa mình vào nếp sống đại ngàn.",
    condition: "Đơn từ 500.000đ",
    expiry: "31/12/2026",
    icon: "cottage",
  },
  {
    id: "v5",
    code: "COMLAM10",
    title: "Ẩm thực cơm lam & Gà nướng Đắk Song",
    discount: "Giảm 10%",
    category: "food",
    categoryLabel: "Ẩm thực",
    description: "Thưởng thức trọn vẹn hương vị đặc sản cao nguyên tại các nhà hàng ẩm thực truyền thống.",
    condition: "Đơn từ 200.000đ",
    expiry: "31/12/2026",
    icon: "restaurant",
  },
];

export const VouchersPage: React.FC = () => {
  // const navigate = useNavigate();
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<"vouchers" | "tours">("tours");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [tours, setTours] = useState<TourProduct[]>([]);
  const [toursLoading, setToursLoading] = useState(false);

  // Modal checkout
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<TourProduct | null>(null);

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num || 0);
  };

  useEffect(() => {
    setToursLoading(true);
    api.getTours()
      .then((res) => setTours(res.tours || []))
      .catch(() => {})
      .finally(() => setToursLoading(false));
  }, []);

  const filteredVouchers = selectedCategory === "all"
    ? DAK_SONG_VOUCHERS
    : DAK_SONG_VOUCHERS.filter((v) => v.category === selectedCategory);

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    showToast("Đã sao chép mã ưu đãi " + code + "!");
  };

  const handleBookTour = (tour: TourProduct) => {
    setSelectedTour(tour);
    setIsModalOpen(true);
  };

  return (
    <div style={{ padding: "16px 16px 80px 16px", maxWidth: 640, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
            Tour & Ưu đãi Đắk Song
          </h1>
          <p style={{ fontSize: 12, margin: "2px 0 0 0", color: "var(--color-text-secondary)" }}>
            Đặt tour trải nghiệm, dịch vụ du lịch & mã giảm giá
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedTour(null);
            setIsModalOpen(true);
          }}
          style={{
            background: "none",
            border: "1px solid var(--color-primary)",
            borderRadius: 8,
            color: "var(--color-primary)",
            fontSize: 12,
            fontWeight: 700,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            receipt_long
          </span>
          Đơn của tôi
        </button>
      </div>

      {/* Main Tab Switcher */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          backgroundColor: "var(--color-surface-container)",
          borderRadius: 10,
          padding: 4,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("tours")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: activeTab === "tours" ? "var(--color-primary)" : "transparent",
            color: activeTab === "tours" ? "#ffffff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          🌲 Tour & Dịch vụ ({tours.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("vouchers")}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            backgroundColor: activeTab === "vouchers" ? "var(--color-primary)" : "transparent",
            color: activeTab === "vouchers" ? "#ffffff" : "var(--color-text-secondary)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          🎟️ Mã Ưu đãi (5)
        </button>
      </div>

      {/* TAB 1: TOURS & SERVICES */}
      {activeTab === "tours" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Demo Notice */}
          <div
            style={{
              backgroundColor: "var(--color-surface-container)",
              border: "1px dashed var(--color-border)",
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--color-primary)" }}>
              verified
            </span>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
              <strong>Sản phẩm du lịch Đắk Song:</strong> Giá demo hiển thị từ cơ sở dữ liệu D1. Hỗ trợ đặt chỗ và thanh toán mô phỏng (không thu tiền thật).
            </div>
          </div>

          {toursLoading ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--color-text-secondary)" }}>
              Đang tải danh mục tour...
            </div>
          ) : (
            tours.map((t) => (
              <div
                key={t.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 14,
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {t.coverImageUrl && (
                  <div style={{ height: 140, position: "relative" }}>
                    <img
                      src={t.coverImageUrl}
                      alt={t.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 8,
                        left: 8,
                        backgroundColor: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {t.durationDays} Ngày • {t.minTravelers}-{t.maxTravelers} khách
                    </div>
                  </div>
                )}

                <div style={{ padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)" }}>
                    {t.code}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text-primary)", marginTop: 2 }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 6, lineHeight: 1.4 }}>
                    {t.description}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Giá cơ bản / khách</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-primary)" }}>
                        {formatVnd(t.basePrice)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleBookTour(t)}
                      className="eco-btn-primary"
                      style={{
                        padding: "8px 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        shopping_cart_checkout
                      </span>
                      Đặt tour ngay
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: VOUCHERS */}
      {activeTab === "vouchers" && (
        <div>
          {/* Demo Preview Notice */}
          <div
            style={{
              backgroundColor: "var(--color-surface-container)",
              border: "1px dashed var(--color-border)",
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--color-ochre)" }}>
              info
            </span>
            <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
              <strong>Bản xem trước Demo:</strong> Các voucher dưới đây là dữ liệu minh họa giao diện cho Phase 8.5 (Voucher Wallet & Lucky Wheel), chưa có giá trị quy đổi thực tế.
            </div>
          </div>

          {/* Lucky Wheel Banner Preview */}
          <div
            style={{
              backgroundColor: "var(--color-ochre-bg)",
              border: "1px solid var(--color-ochre-border)",
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "var(--color-ochre)",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>
                casino
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ochre)" }}>
                Vòng quay may mắn Đắk Song
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
                Quay số trúng quà tặng du lịch & voucher hấp dẫn (sắp kích hoạt)
              </div>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 14 }}>
            {[
              { key: "all", label: "Tất cả" },
              { key: "food", label: "🍜 Ẩm thực" },
              { key: "stay", label: "🏡 Lưu trú" },
              { key: "tour", label: "🌲 Tour & Vé" },
            ].map((cat) => {
              const active = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 20,
                    border: "1px solid " + (active ? "var(--color-primary)" : "var(--color-border)"),
                    backgroundColor: active ? "var(--color-primary)" : "var(--color-surface)",
                    color: active ? "#ffffff" : "var(--color-text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Voucher Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredVouchers.map((item) => (
              <div
                key={item.id}
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      backgroundColor: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                      {item.icon}
                    </span>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "var(--color-primary)",
                          backgroundColor: "var(--color-primary-light)",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {item.discount}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                        {item.condition}
                      </span>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                      {item.title}
                    </div>

                    <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Voucher Footer: Code & Copy */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 10,
                    borderTop: "1px dashed var(--color-border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Mã:</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        color: "var(--color-text-primary)",
                        backgroundColor: "var(--color-surface-container)",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {item.code}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>• HSD {item.expiry}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(item.code)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "none",
                      backgroundColor: "var(--color-primary)",
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      content_copy
                    </span>
                    Lưu mã
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Booking & Checkout Modal */}
      <BookingCheckoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tour={selectedTour}
      />
    </div>
  );
};

export default VouchersPage;

