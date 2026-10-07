import React from "react";
import { Box, Text } from "zmp-ui";
import { useNavigate } from "zmp-ui";
import type { Place } from "../types";

export interface PlaceCardProps {
  place: Place;
  compact?: boolean;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, compact = false }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/place/${place.id}`);
  };

  return (
    <div
      className="card-shadow"
      onClick={handleClick}
      style={{
        cursor: "pointer",
        marginBottom: compact ? 8 : 14,
        border: compact ? "1px solid #e2e4e8" : "none",
      }}
    >
      {place.imageUrl && (
        <img
          src={place.imageUrl}
          alt={place.name}
          className="place-card-img"
          style={{ height: compact ? 100 : 140 }}
          loading="lazy"
        />
      )}
      <Box p={3}>
        {place.category?.name && (
          <span className="category-badge" style={{ marginBottom: 6 }}>
            {place.category.name}
          </span>
        )}
        <Text bold size={compact ? "small" : "normal"} style={{ marginBottom: 4 }}>
          {place.name}
        </Text>
        <Text
          size="xSmall"
          style={{
            color: "#767a7f",
            display: "-webkit-box",
            WebkitLineClamp: compact ? 1 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {place.shortDescription}
        </Text>
        {place.address && (
          <Text
            size="xxxxSmall"
            style={{
              color: "#999",
              marginTop: 4,
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {place.address}
          </Text>
        )}
      </Box>
    </div>
  );
};
