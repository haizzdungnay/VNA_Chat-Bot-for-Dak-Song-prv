import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import zaloMiniApp from "zmp-vite-plugin";

function fixZmpWebRouter() {
  return {
    name: "fix-zmp-web-router",
    transform(code: string, id: string) {
      if (id.includes("ZMPRouter")) {
        return code.replace(
          'basepath = "/zapps/" + window.APP_ID;',
          'basepath = (typeof window !== "undefined" && window.location.pathname.startsWith("/zapps/")) ? "/zapps/" + window.APP_ID : (window.BASE_PATH || "");'
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [fixZmpWebRouter(), react(), zaloMiniApp()],
});

