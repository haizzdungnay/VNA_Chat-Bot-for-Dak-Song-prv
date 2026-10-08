import React, { useState } from "react";
import { useNavigate } from "zmp-ui";
import type { Place } from "../types";
import { DEFAULT_HERO_IMAGE } from "../constants";

export interface PlaceCardProps {
  place: Place;
  compact?: boolean;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, compact = false }) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    navigate(`/place/${place.id}`);
  };

  const imageSrc =
    !imageError && place.imageUrl ? place.imageUrl : DEFAULT_HERO_IMAGE;

  if (compact) {
    // Compact card for chat recommended destinations (Bento style)
    return (
      <div
        className="place-card-compact"
        onClick={handleClick}
        role="button"
        tabIndex={0}
      >
        {/* Suggestion Header Strip */}
        <div
          style={{
            padding: "6px 12px",
            backgroundColor: "var(--color-surface-low)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-ochre)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              auto_awesome
            </span>
            Địa điểm được gợi ý
          </span>
          {place.category?.name && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                backgroundColor: "var(--color-secondary-container)",
                color: "var(--color-on-secondary-container)",
              }}
            >
              {place.category.name}
            </span>
          )}
        </div>

        {/* Thumbnail & Info row */}
        <div style={{ display: "flex", padding: 10, gap: 10 }}>
          <img
            src={imageSrc}
            alt={place.name}
            onError={() => setImageError(true)}
            style={{
              width: 80,
              height: 70,
              borderRadius: "var(--radius-sm)",
              objectFit: "cover",
              backgroundColor: "var(--color-surface-container)",
              flexShrink: 0,
            }}
            loading="lazy"
          />

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h4
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                margin: "0 0 3px 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {place.name}
            </h4>

            <p
              style={{
                fontSize: 12,
                color: "var(--color-text-secondary)",
                margin: "0 0 4px 0",
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.3,
              }}
            >
              {place.shortDescription}
            </p>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                📍 {place.address || "Đắk Song, Đắk Nông"}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-primary)",
                  whiteSpace: "nowrap",
                  marginLeft: 6,
                }}
              >
                Xem chi tiết →
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full destination card (Stitch Explore / Featured style)
  return (
    <article
      className="place-card-stitch"
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <div className="place-card-stitch-media">
        <img
          src={imageSrc}
          alt={place.name}
          onError={() => setImageError(true)}
          loading="lazy"
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)",
          }}
        />

        {place.category?.name && (
          <span className="place-card-stitch-badge">
            {place.category.name}
          </span>
        )}

        <div className="place-card-stitch-location">
          <span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--color-ochre-light)" }}>
            location_on
          </span>
          <span>{place.address || "Huyện Đắk Song, Đắk Nông"}</span>
        </div>
      </div>

      <div className="place-card-stitch-body">
        <h4 className="place-card-stitch-title">{place.name}</h4>
        <p className="place-card-stitch-desc">{place.shortDescription}</p>
      </div>
    </article>
  );
};
