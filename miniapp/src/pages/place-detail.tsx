import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "zmp-ui";
import { api } from "../services/api";
import type { Place } from "../types";
import { LoadingView, ErrorView } from "../components/state-view";
import { useApp } from "../context/AppContext";
import { DEFAULT_HERO_IMAGE } from "../constants";

const PlaceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useApp();

  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async (placeId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPlaceById(placeId);
      setPlace(data);
    } catch (err: any) {
      setError(err?.message || "Không tìm thấy địa điểm");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDetail(id);
    }
  }, [id]);

  const handleOpenDirections = (targetPlace: Place) => {
    if (targetPlace.mapUrl) {
      window.open(targetPlace.mapUrl, "_blank");
      return;
    }
    if (targetPlace.latitude && targetPlace.longitude) {
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${targetPlace.latitude},${targetPlace.longitude}`;
      window.open(gmapsUrl, "_blank");
      return;
    }
    showToast(`Thông tin chỉ đường tới ${targetPlace.name} đang được cập nhật.`);
  };

  const handleSharePlace = (targetPlace: Place) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          showToast(`Đã sao chép liên kết chia sẻ địa điểm: ${targetPlace.name}`);
        })
        .catch(() => {
          showToast(`Đã sao chép liên kết chia sẻ địa điểm: ${targetPlace.name}`);
        });
    } else {
      showToast(`Đã sao chép liên kết chia sẻ địa điểm: ${targetPlace.name}`);
    }
  };

  const handleAskAI = (targetPlace: Place) => {
    navigate(`/chat?placeId=${encodeURIComponent(targetPlace.id)}`);
  };

  return (
    <div style={{ paddingBottom: 40, backgroundColor: "var(--color-bg)", minHeight: "100vh" }}>
      {loading && (
        <div style={{ paddingTop: 80 }}>
          <LoadingView message="Đang tải thông tin địa điểm..." />
        </div>
      )}

      {error && !loading && (
        <div style={{ paddingTop: 80, paddingLeft: 16, paddingRight: 16 }}>
          <ErrorView message={error} onRetry={() => id && loadDetail(id)} />
        </div>
      )}

      {!loading && !error && place && (
        <div>
          {/* 1. Hero Image Container with Back Button */}
          <div className="detail-hero-wrapper">
            <img
              src={place.imageUrl || DEFAULT_HERO_IMAGE}
              alt={place.name}
              className="detail-hero-img"
            />
            <div className="detail-hero-gradient" />

            {/* Back Button Pill */}
            <button
              type="button"
              className="detail-back-btn"
              onClick={() => navigate(-1)}
              aria-label="Quay lại"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                arrow_back
              </span>
              <span>Quay lại</span>
            </button>

            {/* Bottom Overlay Badges */}
            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 16,
                right: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#FFFFFF",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(6px)",
                  fontSize: 12,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--color-ochre-light)" }}>
                  place
                </span>
                <span>Điểm tham quan Đắk Song</span>
              </div>

              {place.images && place.images.length > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    backdropFilter: "blur(6px)",
                    fontSize: 11,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    photo_camera
                  </span>
                  <span>{place.images.length} góc nhìn</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Detail Body Content */}
          <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header info */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {place.category?.name && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: "var(--color-secondary-container)",
                      color: "var(--color-on-secondary-container)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                      category
                    </span>
                    {place.category.name}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 8px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: "var(--color-surface-container)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Đắk Song
                </span>
              </div>

              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  margin: 0,
                  lineHeight: 1.3,
                  letterSpacing: "-0.015em",
                }}
              >
                {place.name}
              </h1>

              {place.address && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 18, color: "var(--color-primary)", marginTop: 2 }}
                  >
                    location_on
                  </span>
                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: 0, lineHeight: 1.45 }}>
                    {place.address}
                  </p>
                </div>
              )}

              {place.openingHours && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: "var(--color-ochre)" }}
                  >
                    schedule
                  </span>
                  <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0 }}>
                    Giờ mở cửa: {place.openingHours}
                  </p>
                </div>
              )}

              {place.phone && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: "var(--color-primary)" }}
                  >
                    call
                  </span>
                  <a
                    href={`tel:${place.phone}`}
                    style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "none" }}
                  >
                    Điện thoại: {place.phone}
                  </a>
                </div>
              )}

              {place.website && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, color: "var(--color-primary)" }}
                  >
                    language
                  </span>
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 12, color: "var(--color-primary)", textDecoration: "none" }}
                  >
                    Website: {place.website}
                  </a>
                </div>
              )}
            </div>

            {/* 3. Action Buttons (Chỉ đường & Chia sẻ) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                className="eco-btn-primary"
                onClick={() => handleOpenDirections(place)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  explore
                </span>
                <span>Chỉ đường</span>
              </button>

              <button
                type="button"
                className="eco-btn-secondary"
                onClick={() => handleSharePlace(place)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  share
                </span>
                <span>Chia sẻ</span>
              </button>
            </div>

            {/* 4. AI Experience Tip Card */}
            <div className="ai-tip-box">
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  backgroundColor: "rgba(231, 195, 122, 0.3)",
                  color: "var(--color-ochre)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  auto_awesome
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--color-ochre)",
                    margin: 0,
                  }}
                >
                  Mẹo trải nghiệm
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    margin: "3px 0 0 0",
                    lineHeight: 1.45,
                  }}
                >
                  Buổi sáng sớm hoặc hoàng hôn là khoảng thời gian lý tưởng nhất để ngắm sương và tận hưởng không khí trong lành tại Đắk Song.
                </p>
              </div>
            </div>

            {/* 5. MANDATORY: Hỏi AI về địa điểm này */}
            <button
              type="button"
              className="eco-btn-ochre"
              onClick={() => handleAskAI(place)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                auto_awesome
              </span>
              <span>✨ Hỏi AI về địa điểm này</span>
            </button>

            {/* 6. Description Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
              >
                Giới thiệu
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.6,
                  margin: 0,
                  textAlign: "justify",
                }}
              >
                {place.description || place.shortDescription}
              </p>
            </div>

            {/* 7. Gallery Section */}
            {place.images && place.images.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--color-text-primary)",
                      margin: 0,
                    }}
                  >
                    Hình ảnh
                  </h3>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    Cuộn ngang để xem thêm
                  </span>
                </div>

                <div className="gallery-carousel no-scrollbar">
                  {place.images.map((imgUrl, idx) => (
                    <img
                      key={idx}
                      src={imgUrl}
                      alt={`${place.name} ${idx + 1}`}
                      className="gallery-thumbnail"
                      loading="lazy"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 8. Featured Badge */}
            {place.isFeatured && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-ochre-bg)",
                  border: "1px solid var(--color-ochre-border)",
                  fontSize: 12,
                  color: "var(--color-ochre)",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>★</span>
                <span>Điểm đến tiêu biểu của du lịch Đắk Song</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaceDetailPage;
