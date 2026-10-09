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

const MAX_POST_BYTES = 10 * 1024; // 10 KB limit

/**
 * Bounded byte reader to protect Worker isolate memory against oversized streams
 * even when Content-Length header is missing or spoofed.
 */
async function readBoundedBody(
  request: Request,
  maxBytes: number
): Promise<{ body: ArrayBuffer | null; tooLarge: boolean }> {
  if (!request.body) {
    return { body: null, tooLarge: false };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          return { body: null, tooLarge: true };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { body: null, tooLarge: false };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body: merged.buffer, tooLarge: false };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method.toUpperCase() === "OPTIONS") {
      return optionsResponse(env);
    }

    const url = new URL(request.url);

    // Trust boundary: Cloudflare authentic header 'cf-connecting-ip'.
    // Do NOT trust client-supplied 'x-forwarded-for' in public traffic.
    const clientIp =
      request.headers.get("cf-connecting-ip")?.trim() ||
      "127.0.0.1";

    let activeRequest = request;

    // Phase 4 Security: Bounded body size check for POST
    if (request.method.toUpperCase() === "POST") {
      const contentLength = request.headers.get("content-length");
      if (contentLength) {
        const parsedLen = parseInt(contentLength, 10);
        if (!isNaN(parsedLen) && parsedLen > MAX_POST_BYTES) {
          return errorResponse("Dung lượng yêu cầu vượt quá giới hạn cho phép (10KB).", 413, env);
        }
      }

      const { body, tooLarge } = await readBoundedBody(request, MAX_POST_BYTES);
      if (tooLarge) {
        return errorResponse("Dung lượng yêu cầu vượt quá giới hạn cho phép (10KB).", 413, env);
      }

      activeRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: body,
      });
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
      return await router.handle(activeRequest, env, ctx);
    } catch {
      // Bảo mật: không bao giờ expose stack trace hoặc raw exception
      return errorResponse("Internal Server Error", 500, env);
    }
  },
};
