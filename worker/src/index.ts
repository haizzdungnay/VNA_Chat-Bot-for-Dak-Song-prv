import type { Env } from "./types";
import { Router } from "./utils/router";
import { optionsResponse, errorResponse } from "./utils/response";
import { healthRoute } from "./routes/health";
import { categoriesRoute } from "./routes/categories";
import { placesListRoute, placeDetailRoute } from "./routes/places";
import { articlesListRoute, articleDetailRoute } from "./routes/articles";
import { chatRoute } from "./routes/chat";
import { chatRateLimiter } from "./utils/rate-limiter";

const router = new Router();

router.get("/api/health", healthRoute);
router.get("/api/categories", categoriesRoute);
router.get("/api/places", placesListRoute);
router.get("/api/places/:id", placeDetailRoute);
router.get("/api/articles", articlesListRoute);
router.get("/api/articles/:slug", articleDetailRoute);
router.post("/api/chat", chatRoute);

const MAX_POST_BYTES = 10 * 1024; // 10 KB

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method.toUpperCase() === "OPTIONS") {
      return optionsResponse(env);
    }

    const url = new URL(request.url);
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    // Phase 4 Security: Body size guard for POST
    if (request.method.toUpperCase() === "POST") {
      const contentLength = request.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_POST_BYTES) {
        return errorResponse("Dung lượng yêu cầu vượt quá giới hạn cho phép (10KB).", 413, env);
      }
    }

    // Phase 4 Security: Rate limiting for chat endpoint
    if (url.pathname === "/api/chat" && request.method.toUpperCase() === "POST") {
      const check = chatRateLimiter.check(clientIp);
      if (!check.allowed) {
        return errorResponse(
          "Bạn đã gửi quá nhiều yêu cầu chat. Vui lòng thử lại sau.",
          429,
          env,
          { "Retry-After": String(check.retryAfterSec) }
        );
      }
    }

    try {
      return await router.handle(request, env, ctx);
    } catch {
      // Bảo mật: không bao giờ expose stack trace hoặc raw exception
      return errorResponse("Internal Server Error", 500, env);
    }
  },
};
