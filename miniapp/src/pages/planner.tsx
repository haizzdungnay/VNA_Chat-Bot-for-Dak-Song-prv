import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "zmp-ui";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import type {
  Place,
  PlannerRequest,
  ItineraryOutput,
  ItineraryItemOutput,
  TravelPace,
  TransportationType,
  BudgetPreference,
} from "../types";

export const PlannerPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { showToast } = useApp();

  const [step, setStep] = useState<"setup" | "timeline">("setup");
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);

  // Setup form states
  const [durationDays, setDurationDays] = useState<number>(3);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [departureTime, setDepartureTime] = useState<string>("08:30");
  const [travelersCount, setTravelersCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [pace, setPace] = useState<TravelPace>("moderate");
  const [transportation, setTransportation] = useState<TransportationType>("car");
  const [budgetPreference, setBudgetPreference] = useState<BudgetPreference>("moderate");
  const [interests, setInterests] = useState<string[]>(["nature", "culture", "food"]);

  // Timeline states
  const [itinerary, setItinerary] = useState<ItineraryOutput | null>(null);
  const [activeDayNumber, setActiveDayNumber] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSavedModal, setShowSavedModal] = useState<boolean>(false);
  const [savedTrips, setSavedTrips] = useState<ItineraryOutput[]>([]);
  const [showAddPlaceModal, setShowAddPlaceModal] = useState<boolean>(false);

  // Load places and handle ?placeId= URL param
  useEffect(() => {
    api.getPlaces().then((places) => {
      setAllPlaces(places);
      const params = new URLSearchParams(location.search);
      const queryPlaceId = params.get("placeId");
      if (queryPlaceId && places.some((p) => p.id === queryPlaceId)) {
        setSelectedPlaceIds((prev) => (prev.includes(queryPlaceId) ? prev : [...prev, queryPlaceId]));
      }
    }).catch(() => {});
  }, [location.search]);

  // Load saved trips when user is authenticated and opens saved trips modal
  const handleOpenSavedTrips = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    try {
      const list = await api.listItineraries();
      setSavedTrips(list);
      setShowSavedModal(true);
    } catch {
      showToast("Không thể tải danh sách lịch trình đã lưu.");
    }
  };

  const toggleInterest = (val: string) => {
    setInterests((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const req: PlannerRequest = {
        durationDays,
        travelersCount,
        childrenCount,
        startDate,
        departureTime,
        pace,
        transportation,
        budgetPreference,
        interests,
        selectedPlaceIds,
      };

      const res = await api.previewItinerary(req);
      setItinerary(res.itinerary);
      setActiveDayNumber(1);
      setStep("timeline");
      if (res.itinerary.isFallback) {
        showToast("Lịch trình được khởi tạo theo thuật toán tối ưu cục bộ.");
      }
    } catch (err: any) {
      showToast(err.message || "Không thể tạo lịch trình chuyến đi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveItinerary = async () => {
    if (!itinerary) return;
    if (!isAuthenticated) {
      showToast("Vui lòng đăng nhập để lưu lịch trình của bạn.");
      openAuthModal();
      return;
    }

    setIsSaving(true);
    try {
      if (itinerary.id && itinerary.status === "saved") {
        const res = await api.updateItinerary(itinerary.id, itinerary);
        setItinerary(res.itinerary);
        showToast("Đã cập nhật lịch trình thành công!");
      } else {
        const res = await api.saveItinerary(itinerary);
        setItinerary(res.itinerary);
        showToast("Đã lưu lịch trình chuyến đi vào tài khoản!");
      }
    } catch (err: any) {
      showToast(err.message || "Lỗi khi lưu lịch trình.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedTrip = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteItinerary(id);
      setSavedTrips((prev) => prev.filter((t) => t.id !== id));
      if (itinerary?.id === id) {
        setItinerary(null);
        setStep("setup");
      }
      showToast("Đã xóa lịch trình.");
    } catch {
      showToast("Không thể xóa lịch trình.");
    }
  };

  // Itinerary Item Modification Helpers
  const handleMoveItem = (dayNum: number, itemIdx: number, direction: "up" | "down") => {
    if (!itinerary) return;
    const targetIdx = direction === "up" ? itemIdx - 1 : itemIdx + 1;
    const day = itinerary.days.find((d) => d.dayNumber === dayNum);
    if (!day || targetIdx < 0 || targetIdx >= day.items.length) return;

    const newItems = [...day.items];
    const temp = newItems[itemIdx];
    newItems[itemIdx] = newItems[targetIdx];
    newItems[targetIdx] = temp;

    // Update orderIndex
    newItems.forEach((it, idx) => {
      it.orderIndex = idx;
    });

    const updatedDays = itinerary.days.map((d) =>
      d.dayNumber === dayNum ? { ...d, items: newItems } : d
    );

    setItinerary({ ...itinerary, days: updatedDays });
  };

  const handleDeleteItem = (dayNum: number, itemIdx: number) => {
    if (!itinerary) return;
    const day = itinerary.days.find((d) => d.dayNumber === dayNum);
    if (!day) return;

    const newItems = day.items.filter((_, idx) => idx !== itemIdx);
    newItems.forEach((it, idx) => {
      it.orderIndex = idx;
    });

    const updatedDays = itinerary.days.map((d) =>
      d.dayNumber === dayNum ? { ...d, items: newItems } : d
    );

    setItinerary({ ...itinerary, days: updatedDays });
    showToast("Đã bỏ điểm dừng khỏi ngày.");
  };

  const handleAddPlaceToDay = (place: Place) => {
    if (!itinerary) return;
    const day = itinerary.days.find((d) => d.dayNumber === activeDayNumber);
    if (!day) return;

    const newItem: ItineraryItemOutput = {
      placeId: place.id,
      itemType: "place",
      title: place.name,
      plannedTime: "15:00",
      durationMinutes: 60,
      notes: place.sourceType === "vr360"
        ? "[Điểm thực tế ảo VR360] Trải nghiệm ngắm cảnh."
        : place.shortDescription || "Tham quan điểm đến hấp dẫn.",
      orderIndex: day.items.length,
      isUserSelected: true,
      place,
    };

    const updatedDays = itinerary.days.map((d) =>
      d.dayNumber === activeDayNumber ? { ...d, items: [...d.items, newItem] } : d
    );

    setItinerary({ ...itinerary, days: updatedDays });
    setShowAddPlaceModal(false);
    showToast(`Đã thêm ${place.name} vào Ngày ${activeDayNumber}`);
  };

  return (
    <div style={{ padding: "16px 16px 80px 16px", maxWidth: 640, margin: "0 auto" }}>
      {/* Top Header & Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="eco-icon-btn"
            onClick={() => (step === "timeline" ? setStep("setup") : navigate(-1))}
            aria-label="Quay lại"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              arrow_back
            </span>
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
              {step === "setup" ? "Lập lịch trình thông minh" : itinerary?.title || "Lịch trình Đắk Song"}
            </h1>
            <p style={{ fontSize: 12, margin: 0, color: "var(--color-text-secondary)" }}>
              {step === "setup" ? "Thiết kế chuyến đi cá nhân hóa theo AI" : "Chi tiết lộ trình theo từng ngày"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenSavedTrips}
          style={{
            background: "none",
            border: "1px solid var(--color-primary)",
            borderRadius: 8,
            color: "var(--color-primary)",
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            bookmark
          </span>
          Lịch trình đã lưu
        </button>
      </div>

      {/* SCREEN A: PLANNER SETUP FORM */}
      {step === "setup" && (
        <div>
          {/* Duration Selector */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--color-text-primary)" }}>
              Thời gian chuyến đi
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDurationDays(d)}
                  style={{
                    padding: "10px 0",
                    borderRadius: 8,
                    border: "1px solid " + (durationDays === d ? "var(--color-primary)" : "var(--color-border, #d1d5db)"),
                    backgroundColor: durationDays === d ? "var(--color-primary)" : "var(--color-bg-card, #ffffff)",
                    color: durationDays === d ? "#ffffff" : "var(--color-text-primary)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {d} ngày
                </button>
              ))}
            </div>
          </div>

          {/* Dates and Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--color-text-primary)" }}>
                Ngày khởi hành
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border, #d1d5db)",
                  backgroundColor: "var(--color-bg-input, #ffffff)",
                  color: "var(--color-text-primary)",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--color-text-primary)" }}>
                Giờ xuất phát
              </label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--color-border, #d1d5db)",
                  backgroundColor: "var(--color-bg-input, #ffffff)",
                  color: "var(--color-text-primary)",
                  fontSize: 13,
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Travelers & Children Counters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div
              style={{
                backgroundColor: "var(--color-bg-card, #ffffff)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--color-border, #e5e7eb)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>Tổng số người</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setTravelersCount((c) => Math.max(1, c - 1))}
                  style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid #ccc", background: "none", cursor: "pointer" }}
                >
                  -
                </button>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{travelersCount}</span>
                <button
                  type="button"
                  onClick={() => setTravelersCount((c) => Math.min(20, c + 1))}
                  style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid #ccc", background: "none", cursor: "pointer" }}
                >
                  +
                </button>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-bg-card, #ffffff)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--color-border, #e5e7eb)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>Trong đó trẻ em</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setChildrenCount((c) => Math.max(0, c - 1))}
                  style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid #ccc", background: "none", cursor: "pointer" }}
                >
                  -
                </button>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{childrenCount}</span>
                <button
                  type="button"
                  onClick={() => setChildrenCount((c) => Math.min(travelersCount, c + 1))}
                  style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid #ccc", background: "none", cursor: "pointer" }}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Travel Pace */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--color-text-primary)" }}>
              Nhịp độ trải nghiệm
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { val: "relaxed", label: "Thong dong", sub: "2-3 điểm/ngày" },
                { val: "moderate", label: "Vừa phải", sub: "3-4 điểm/ngày" },
                { val: "active", label: "Khám phá", sub: "4-5 điểm/ngày" },
              ].map((p) => (
                <div
                  key={p.val}
                  onClick={() => setPace(p.val as TravelPace)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: "1px solid " + (pace === p.val ? "var(--color-primary)" : "var(--color-border, #d1d5db)"),
                    backgroundColor: pace === p.val ? "var(--color-primary-light)" : "var(--color-bg-card, #ffffff)",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: pace === p.val ? "var(--color-primary)" : "var(--color-text-primary)" }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>{p.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Transportation */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--color-text-primary)" }}>
              Phương tiện di chuyển
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { val: "car", label: "Ô tô / Thuê xe", icon: "directions_car" },
                { val: "motorbike", label: "Xe máy phượt", icon: "two_wheeler" },
                { val: "shuttle", label: "Xe trung chuyển", icon: "airport_shuttle" },
              ].map((t) => (
                <button
                  key={t.val}
                  type="button"
                  onClick={() => setTransportation(t.val as TransportationType)}
                  style={{
                    padding: "10px 6px",
                    borderRadius: 8,
                    border: "1px solid " + (transportation === t.val ? "var(--color-primary)" : "var(--color-border, #d1d5db)"),
                    backgroundColor: transportation === t.val ? "var(--color-primary-light)" : "var(--color-bg-card, #ffffff)",
                    color: transportation === t.val ? "var(--color-primary)" : "var(--color-text-primary)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {t.icon}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--color-text-primary)" }}>
              Sở thích ưu tiên
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {[
                { val: "nature", label: "🌿 Thiên nhiên & Thác" },
                { val: "culture", label: "🏛️ Văn hóa M'nông" },
                { val: "food", label: "🍜 Ẩm thực bản địa" },
                { val: "checkin", label: "📸 Check-in & Điện gió" },
              ].map((i) => {
                const active = interests.includes(i.val);
                return (
                  <button
                    key={i.val}
                    type="button"
                    onClick={() => toggleInterest(i.val)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 16,
                      border: "1px solid " + (active ? "var(--color-primary)" : "var(--color-border, #d1d5db)"),
                      backgroundColor: active ? "var(--color-primary)" : "var(--color-bg-card, #ffffff)",
                      color: active ? "#ffffff" : "var(--color-text-primary)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {i.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pre-selected Places */}
          {selectedPlaceIds.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--color-text-primary)" }}>
                Điểm bạn đã chọn trước ({selectedPlaceIds.length})
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedPlaceIds.map((id) => {
                  const p = allPlaces.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        backgroundColor: "var(--color-primary-light)",
                        color: "var(--color-primary)",
                        fontSize: 12,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {p?.name || id}
                      <span
                        onClick={() => setSelectedPlaceIds((prev) => prev.filter((x) => x !== id))}
                        style={{ cursor: "pointer", fontWeight: 700 }}
                      >
                        ×
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}


          {/* Budget Preference */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--color-text-primary)" }}>
              Mức ngân sách
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { val: "economy", label: "Tiết kiệm" },
                { val: "moderate", label: "Tiêu chuẩn" },
                { val: "luxury", label: "Thoải mái" },
              ].map((b) => (
                <button
                  key={b.val}
                  type="button"
                  onClick={() => setBudgetPreference(b.val as BudgetPreference)}
                  style={{
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "1px solid " + (budgetPreference === b.val ? "var(--color-primary)" : "var(--color-border, #d1d5db)"),
                    backgroundColor: budgetPreference === b.val ? "var(--color-primary-light)" : "var(--color-bg-card, #ffffff)",
                    color: budgetPreference === b.val ? "var(--color-primary)" : "var(--color-text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="eco-btn-primary"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(19, 122, 62, 0.25)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              auto_awesome
            </span>
            {isGenerating ? "AI đang lên lịch trình..." : "Khởi tạo lịch trình AI"}
          </button>
        </div>
      )}

      {/* SCREEN B: SUGGESTED TIMELINE VIEW */}
      {step === "timeline" && itinerary && (
        <div>
          {/* Summary Banner */}
          <div
            style={{
              backgroundColor: "var(--color-bg-card, #ffffff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span
                  style={{
                    backgroundColor: "var(--color-primary-light)",
                    color: "var(--color-primary)",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    textTransform: "uppercase",
                  }}
                >
                  {itinerary.durationDays} Ngày {Math.max(1, itinerary.durationDays - 1)} Đêm
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: "6px 0 4px 0", color: "var(--color-text-primary)" }}>
                  {itinerary.title}
                </h2>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {itinerary.travelersCount} khách • Khởi hành {itinerary.startDate}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveItinerary}
                disabled={isSaving}
                className="eco-btn-primary"
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  bookmark
                </span>
                {isSaving ? "Đang lưu..." : itinerary.status === "saved" ? "Đã lưu ✓" : "Lưu chuyến đi"}
              </button>
            </div>

            {itinerary.summary && (
              <p style={{ fontSize: 13, color: "var(--color-text-primary)", margin: "10px 0 0 0", lineHeight: 1.4 }}>
                {itinerary.summary}
              </p>
            )}

            {itinerary.warnings && itinerary.warnings.length > 0 && (
              <div
                style={{
                  backgroundColor: "#fffbeb",
                  color: "#92400e",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  marginTop: 10,
                }}
              >
                {itinerary.warnings.join(" ")}
              </div>
            )}
          </div>

          {/* Day Selector Tabs */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
            {itinerary.days.map((d) => (
              <button
                key={d.dayNumber}
                type="button"
                onClick={() => setActiveDayNumber(d.dayNumber)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 20,
                  border: "1px solid " + (activeDayNumber === d.dayNumber ? "var(--color-primary)" : "var(--color-border, #d1d5db)"),
                  backgroundColor: activeDayNumber === d.dayNumber ? "var(--color-primary)" : "var(--color-bg-card, #ffffff)",
                  color: activeDayNumber === d.dayNumber ? "#ffffff" : "var(--color-text-primary)",
                  fontWeight: 700,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Ngày {d.dayNumber} ({d.items.length} điểm)
              </button>
            ))}
          </div>

          {/* Day Title */}
          {(() => {
            const currentDay = itinerary.days.find((d) => d.dayNumber === activeDayNumber);
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }}>
                  {currentDay?.title || `Ngày ${activeDayNumber}`}
                </div>
                {currentDay?.date && (
                  <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{currentDay.date}</div>
                )}
              </div>
            );
          })()}

          {/* Vertical Timeline */}
          {(() => {
            const currentDay = itinerary.days.find((d) => d.dayNumber === activeDayNumber);
            if (!currentDay || currentDay.items.length === 0) {
              return (
                <div style={{ textAlign: "center", padding: 24, color: "var(--color-text-secondary)", fontSize: 13 }}>
                  Chưa có hoạt động nào trong ngày này.
                </div>
              );
            }

            return (
              <div style={{ position: "relative", paddingLeft: 28 }}>
                {/* Connecting Line */}
                <div
                  style={{
                    position: "absolute",
                    left: 9,
                    top: 14,
                    bottom: 14,
                    width: 2,
                    backgroundColor: "var(--color-border, #e5e7eb)",
                  }}
                />

                {currentDay.items.map((item, idx) => (
                  <div key={item.id || idx} style={{ position: "relative", marginBottom: 20 }}>
                    {/* Bullet */}
                    <div
                      style={{
                        position: "absolute",
                        left: -28,
                        top: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor:
                          item.itemType === "meal"
                            ? "var(--color-ochre, #d97706)"
                            : item.itemType === "rest"
                            ? "#6b7280"
                            : "var(--color-primary)",
                        color: "#ffffff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {idx + 1}
                    </div>

                    {/* Timeline Item Card */}
                    <div
                      style={{
                        backgroundColor: "var(--color-bg-card, #ffffff)",
                        border: "1px solid var(--color-border, #e5e7eb)",
                        borderRadius: 10,
                        padding: 12,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {item.plannedTime && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                backgroundColor: "var(--color-bg-secondary, #f3f4f6)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {item.plannedTime}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {item.durationMinutes} phút
                          </span>
                          {item.isUserSelected && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                backgroundColor: "var(--color-primary-light)",
                                color: "var(--color-primary)",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              Bạn đã chọn
                            </span>
                          )}
                        </div>

                        {/* Reorder / Delete Actions */}
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveItem(activeDayNumber, idx, "up")}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}
                            title="Di chuyển lên"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                              arrow_upward
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentDay.items.length - 1}
                            onClick={() => handleMoveItem(activeDayNumber, idx, "down")}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}
                            title="Di chuyển xuống"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                              arrow_downward
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(activeDayNumber, idx)}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: "#ef4444" }}
                            title="Xóa điểm dừng"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                              delete
                            </span>
                          </button>
                        </div>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 14, margin: "6px 0 4px 0", color: "var(--color-text-primary)" }}>
                        {item.title}
                      </div>

                      {item.notes && (
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
                          {item.notes}
                        </div>
                      )}

                      {/* Attached D1 Place Preview */}
                      {item.place && (
                        <div
                          onClick={() => navigate(`/place/${item.place?.id}`)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginTop: 10,
                            padding: 8,
                            backgroundColor: "var(--color-bg-secondary, #f9fafb)",
                            borderRadius: 8,
                            cursor: "pointer",
                          }}
                        >
                          {item.place.imageUrl ? (
                            <img
                              src={item.place.imageUrl}
                              alt={item.place.name}
                              style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 6,
                                backgroundColor: "var(--color-primary-light)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--color-primary)" }}>
                                landscape
                              </span>
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)" }}>
                              {item.place.name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.place.address || "Huyện Đắk Song, Đắk Nông"}
                            </div>
                          </div>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-primary)" }}>
                            chevron_right
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Timeline Bottom Action Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setShowAddPlaceModal(true)}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: 8,
                border: "1px dashed var(--color-primary)",
                backgroundColor: "var(--color-bg-card, #ffffff)",
                color: "var(--color-primary)",
                fontWeight: 700,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                add_location_alt
              </span>
              Thêm điểm vào ngày này
            </button>

            <button
              type="button"
              onClick={() => setStep("setup")}
              className="eco-btn-secondary"
              style={{
                padding: "11px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Đổi thiết lập
            </button>
          </div>
        </div>
      )}

      {/* MODAL: ADD PLACE SELECTOR */}
      {showAddPlaceModal && (
        <div className="sheet-backdrop" onClick={() => setShowAddPlaceModal(false)}>
          <div
            className="sheet-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "70vh", overflowY: "auto", padding: 18 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                Thêm điểm đến vào Ngày {activeDayNumber}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPlaceModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allPlaces.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleAddPlaceToDay(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid var(--color-border, #e5e7eb)",
                    backgroundColor: "var(--color-bg-card, #ffffff)",
                    cursor: "pointer",
                  }}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: "#e5e7eb" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                      {p.category?.name || "Điểm đến"} {p.sourceType === "vr360" ? "• VR360" : ""}
                    </div>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: "var(--color-primary)" }}>
                    add
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SAVED TRIPS LIST */}
      {showSavedModal && (
        <div className="sheet-backdrop" onClick={() => setShowSavedModal(false)}>
          <div
            className="sheet-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "75vh", overflowY: "auto", padding: 18 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                Lịch trình chuyến đi đã lưu ({savedTrips.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowSavedModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {savedTrips.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
                Bạn chưa lưu lịch trình nào. Hãy tạo một lịch trình mới!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {savedTrips.map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => {
                      setItinerary(trip);
                      setActiveDayNumber(1);
                      setStep("timeline");
                      setShowSavedModal(false);
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid var(--color-border, #e5e7eb)",
                      backgroundColor: "var(--color-bg-card, #ffffff)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)" }}>{trip.title}</div>
                      <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
                        {trip.durationDays} ngày • Khởi hành {trip.startDate} ({trip.travelersCount} người)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSavedTrip(trip.id!, e)}
                      style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", padding: 6 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        delete
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlannerPage;
