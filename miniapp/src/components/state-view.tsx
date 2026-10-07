import React from "react";
import { Box, Text, Button, Spinner } from "zmp-ui";

export interface LoadingViewProps {
  message?: string;
}

export const LoadingView: React.FC<LoadingViewProps> = ({ message = "Đang tải dữ liệu..." }) => (
  <Box flex flexDirection="column" alignItems="center" justifyContent="center" p={6}>
    <Spinner visible />
    <Text size="small" className="text-gray-500" style={{ marginTop: 12 }}>
      {message}
    </Text>
  </Box>
);

export interface EmptyViewProps {
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyView: React.FC<EmptyViewProps> = ({
  message = "Chưa có dữ liệu",
  actionText,
  onAction,
}) => (
  <Box flex flexDirection="column" alignItems="center" justifyContent="center" p={6}>
    <Text size="normal" style={{ color: "#767a7f", textAlign: "center" }}>
      {message}
    </Text>
    {actionText && onAction && (
      <Box mt={4}>
        <Button size="small" variant="secondary" onClick={onAction}>
          {actionText}
        </Button>
      </Box>
    )}
  </Box>
);

export interface ErrorViewProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = "Đã xảy ra lỗi khi tải dữ liệu",
  onRetry,
}) => (
  <Box flex flexDirection="column" alignItems="center" justifyContent="center" p={6}>
    <Text size="normal" style={{ color: "#dc3545", textAlign: "center" }}>
      {message}
    </Text>
    {onRetry && (
      <Box mt={4}>
        <Button size="small" onClick={onRetry}>
          Thử lại
        </Button>
      </Box>
    )}
  </Box>
);
