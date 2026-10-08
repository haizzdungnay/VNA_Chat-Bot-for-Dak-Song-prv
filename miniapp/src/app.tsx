import React from "react";
import { createRoot, Root } from "react-dom/client";
import { App, ZMPRouter, AnimationRoutes, Route } from "zmp-ui";

import "zmp-ui/zaui.css";
import "./css/app.css";

import { AppProvider } from "./context/AppContext";
import { Layout } from "./components/layout";
import HomePage from "./pages/home";
import ExplorePage from "./pages/explore";
import PlaceDetailPage from "./pages/place-detail";
import AIChatPage from "./pages/chat";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "#b91c1c" }}>
          <h3>Đã xảy ra sự cố hiển thị</h3>
          <p style={{ fontSize: 13, color: "#4b5563" }}>
            {this.state.error?.message || "Vui lòng làm mới lại trang."}
          </p>
          <button
            type="button"
            className="eco-btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => window.location.reload()}
          >
            Tải lại ứng dụng
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const RootApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <App>
        <AppProvider>
          <ZMPRouter>
            <Layout>
              <AnimationRoutes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/place/:id" element={<PlaceDetailPage />} />
                <Route path="/chat" element={<AIChatPage />} />
              </AnimationRoutes>
            </Layout>
          </ZMPRouter>
        </AppProvider>
      </App>
    </ErrorBoundary>
  );
};

declare global {
  interface Window {
    __reactRoot?: Root;
  }
}

const container = document.getElementById("app");
if (container) {
  let root = window.__reactRoot;
  if (!root) {
    root = createRoot(container);
    window.__reactRoot = root;
  }
  root.render(<RootApp />);
}
