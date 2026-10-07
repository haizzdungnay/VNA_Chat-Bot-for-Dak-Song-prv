import React from "react";
import { createRoot } from "react-dom/client";
import { App, ZMPRouter, AnimationRoutes, Route } from "zmp-ui";

import "zmp-ui/zaui.css";
import "./css/app.css";

import { Layout } from "./components/layout";
import HomePage from "./pages/home";
import ExplorePage from "./pages/explore";
import PlaceDetailPage from "./pages/place-detail";
import AIChatPage from "./pages/chat";

const RootApp: React.FC = () => {
  return (
    <App>
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
    </App>
  );
};

const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(<RootApp />);
}
