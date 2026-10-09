import React from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  text: string;
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ messages, onDismiss }) => {
  if (messages.length === 0) return null;

  return (
    <div className="toast-container">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`toast toast-${m.type}`}
          onClick={() => onDismiss(m.id)}
          style={{ cursor: "pointer" }}
        >
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  );
};

