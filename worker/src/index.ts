
import {
  quizCategoriesRoute,
  quizCollectionsRoute,
  quizDailyRoute,
  quizStartAttemptRoute,
  quizGetAttemptRoute,
  quizSubmitAnswerRoute,
  quizFinishAttemptRoute,
  quizHistoryRoute,
  quizStatsRoute,
} from "./routes/quiz";
import {
  adminQuizCategoriesListRoute,
  adminQuizQuestionsListRoute,
  adminQuizQuestionDetailRoute,
  adminQuizQuestionCreateRoute,
  adminQuizQuestionUpdateRoute,
  adminQuizQuestionPublishRoute,
  adminQuizQuestionArchiveRoute,
  adminQuizQuestionRestoreRoute,
  adminQuizQuestionDuplicateRoute,
  adminQuizCollectionsListRoute,
  adminQuizCollectionDetailRoute,
  adminQuizCollectionCreateRoute,
  adminQuizChallengesListRoute,
  adminQuizChallengeDetailRoute,
  adminQuizChallengeCreateRoute,
  adminQuizChallengePublishRoute,
  adminQuizChallengeCloseRoute,
  adminQuizAnalyticsRoute,
  adminQuizAttemptsListRoute,
  adminQuizExportRoute,
} from "./routes/admin-quiz";
import type { Env } from "./types";
import { Router } from "./utils/router";
import { optionsResponse, errorResponse } from "./utils/response";
import { healthRoute } from "./routes/health";
import { categoriesRoute } from "./routes/categories";
import { placesListRoute, placeDetailRoute } from "./routes/places";
import { articlesListRoute, articleDetailRoute } from "./routes/articles";
import { chatRoute } from "./routes/chat";
import { visitorConsentRoute } from "./routes/visitors";
import {
  adminOverviewRoute,
  adminProfilesListRoute,
  adminProfileCreateRoute,
  adminProfileUpdateRoute,
  adminProfileDeleteRoute,
  adminProfileTestRoute,
  adminProfileActivateRoute,
  adminProfileRollbackRoute,
  adminVisitorsRoute,
  adminLogsRoute,
  adminSystemRoute,
} from "./routes/admin";
import {
  zaloAuthRoute,
  emailRequestRoute,
  emailVerifyRoute,
  meRoute,
  logoutRoute,
} from "./routes/auth";
import {
  previewItineraryRoute,
  saveItineraryRoute,
  listItinerariesRoute,
  getItineraryRoute,
  updateItineraryRoute,
  deleteItineraryRoute,
} from "./routes/itineraries";
import {
  toursListRoute,
  tourDetailRoute,
  servicesListRoute,
  createQuoteRoute,
  createBookingRoute,
  listUserBookingsRoute,
  getUserBookingDetailRoute,
  mockPaymentRoute,
  cancelUserBookingRoute,
} from "./routes/bookings";
import {
  adminToursListRoute,
  adminTourDetailRoute,
  adminTourCreateRoute,
  adminTourUpdateRoute,
  adminTourDeleteRoute,
  adminServicesListRoute,
  adminServiceCreateRoute,
  adminServiceUpdateRoute,
  adminServicePriceUpdateRoute,
  adminServiceToggleRoute,
  adminBookingsListRoute,
  adminBookingDetailRoute,
  adminBookingCancelRoute,
  adminBookingMockRefundRoute,
  adminRevenueAnalyticsRoute,
  adminRevenueExportRoute,
} from "./routes/admin-business";

import { chatRateLimiter, authRateLimiter, InMemoryRateLimiter } from "./utils/rate-limiter";

const previewRateLimiter = new InMemoryRateLimiter(60_000, 20);

const router = new Router();

// Public Tourist & Chat Routes
router.get("/api/health", healthRoute);
router.get("/api/categories", categoriesRoute);
router.get("/api/places", placesListRoute);
router.get("/api/places/:id", placeDetailRoute);
router.get("/api/articles", articlesListRoute);
router.get("/api/articles/:slug", articleDetailRoute);
router.post("/api/chat", chatRoute);
router.post("/api/visitors/consent", visitorConsentRoute);

// Phase 8.1 User Identity & Authentication Routes
router.post("/api/auth/zalo", zaloAuthRoute);
router.post("/api/auth/email/request", emailRequestRoute);
router.post("/api/auth/email/verify", emailVerifyRoute);
router.get("/api/me", meRoute);
router.post("/api/auth/logout", logoutRoute);

// Phase 8.2 AI Travel Planner & Itineraries Routes
router.post("/api/itineraries/preview", previewItineraryRoute);
router.post("/api/itineraries", saveItineraryRoute);
router.get("/api/itineraries", listItinerariesRoute);
router.get("/api/itineraries/:id", getItineraryRoute);
router.put("/api/itineraries/:id", updateItineraryRoute);
router.delete("/api/itineraries/:id", deleteItineraryRoute);

// Admin Dashboard Routes (Protected by Cloudflare Access)
router.get("/api/admin/overview", adminOverviewRoute);
router.get("/api/admin/ai-profiles", adminProfilesListRoute);
router.post("/api/admin/ai-profiles", adminProfileCreateRoute);
router.put("/api/admin/ai-profiles/:id", adminProfileUpdateRoute);
router.delete("/api/admin/ai-profiles/:id", adminProfileDeleteRoute);
router.post("/api/admin/ai-profiles/:id/test", adminProfileTestRoute);
router.post("/api/admin/ai-profiles/:id/activate", adminProfileActivateRoute);
router.post("/api/admin/ai-profiles/rollback", adminProfileRollbackRoute);
router.get("/api/admin/visitors", adminVisitorsRoute);
router.get("/api/admin/logs", adminLogsRoute);
router.get("/api/admin/system", adminSystemRoute);
// Phase 8.3 Business Operations & Booking Routes
router.get("/api/tours", toursListRoute);
router.get("/api/tours/:id", tourDetailRoute);
router.get("/api/services", servicesListRoute);
router.post("/api/quotes", createQuoteRoute);
router.post("/api/bookings", createBookingRoute);
router.get("/api/bookings", listUserBookingsRoute);
router.get("/api/bookings/:id", getUserBookingDetailRoute);
router.post("/api/bookings/:id/pay", mockPaymentRoute);
router.post("/api/bookings/:id/cancel", cancelUserBookingRoute);

// Phase 8.3 Admin Business Operations Routes
router.get("/api/admin/tours", adminToursListRoute);
router.get("/api/admin/tours/:id", adminTourDetailRoute);
router.post("/api/admin/tours", adminTourCreateRoute);
router.put("/api/admin/tours/:id", adminTourUpdateRoute);
router.delete("/api/admin/tours/:id", adminTourDeleteRoute);
router.get("/api/admin/services", adminServicesListRoute);
router.post("/api/admin/services", adminServiceCreateRoute);
router.put("/api/admin/services/:id", adminServiceUpdateRoute);
router.put("/api/admin/services/:id/price", adminServicePriceUpdateRoute);
router.put("/api/admin/services/:id/toggle", adminServiceToggleRoute);
router.get("/api/admin/bookings", adminBookingsListRoute);
router.get("/api/admin/bookings/:id", adminBookingDetailRoute);
router.post("/api/admin/bookings/:id/cancel", adminBookingCancelRoute);
router.post("/api/admin/bookings/:id/mock-refund", adminBookingMockRefundRoute);
router.post("/api/admin/bookings/:id/refund", adminBookingMockRefundRoute);
router.get("/api/admin/revenue/analytics", adminRevenueAnalyticsRoute);
router.get("/api/admin/revenue/export", adminRevenueExportRoute);

// Phase 8.4 Quiz Routes (Tourist)
router.get("/api/quiz/categories", quizCategoriesRoute);
router.get("/api/quiz/collections", quizCollectionsRoute);
router.get("/api/quiz/daily", quizDailyRoute);
router.post("/api/quiz/attempts", quizStartAttemptRoute);
router.get("/api/quiz/attempts/:id", quizGetAttemptRoute);
router.post("/api/quiz/attempts/:id/answers", quizSubmitAnswerRoute);
router.post("/api/quiz/attempts/:id/finish", quizFinishAttemptRoute);
router.get("/api/quiz/history", quizHistoryRoute);
router.get("/api/quiz/stats", quizStatsRoute);

// Phase 8.4 Admin Quiz Routes
router.get("/api/admin/quiz/categories", adminQuizCategoriesListRoute);
router.get("/api/admin/quiz/questions", adminQuizQuestionsListRoute);
router.get("/api/admin/quiz/questions/:id", adminQuizQuestionDetailRoute);
router.post("/api/admin/quiz/questions", adminQuizQuestionCreateRoute);
router.put("/api/admin/quiz/questions/:id", adminQuizQuestionUpdateRoute);
router.post("/api/admin/quiz/questions/:id/publish", adminQuizQuestionPublishRoute);
router.post("/api/admin/quiz/questions/:id/archive", adminQuizQuestionArchiveRoute);
router.post("/api/admin/quiz/questions/:id/restore", adminQuizQuestionRestoreRoute);
router.post("/api/admin/quiz/questions/:id/duplicate", adminQuizQuestionDuplicateRoute);
router.get("/api/admin/quiz/collections", adminQuizCollectionsListRoute);
router.get("/api/admin/quiz/collections/:id", adminQuizCollectionDetailRoute);
router.post("/api/admin/quiz/collections", adminQuizCollectionCreateRoute);
router.get("/api/admin/quiz/challenges", adminQuizChallengesListRoute);
router.get("/api/admin/quiz/challenges/:id", adminQuizChallengeDetailRoute);
router.post("/api/admin/quiz/challenges", adminQuizChallengeCreateRoute);
router.post("/api/admin/quiz/challenges/:id/publish", adminQuizChallengePublishRoute);
router.post("/api/admin/quiz/challenges/:id/close", adminQuizChallengeCloseRoute);
router.get("/api/admin/quiz/analytics", adminQuizAnalyticsRoute);
router.get("/api/admin/quiz/attempts", adminQuizAttemptsListRoute);
router.get("/api/admin/quiz/export", adminQuizExportRoute);



const MAX_DEFAULT_BYTES = 10 * 1024; // 10 KB limit for general endpoints
const MAX_ITINERARY_BYTES = 30 * 1024; // 30 KB limit for multi-day itineraries

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
    const method = request.method.toUpperCase();

    if (method === "OPTIONS") {
      return optionsResponse(env);
    }

    const url = new URL(request.url);

    // Trust boundary: Cloudflare authentic header 'cf-connecting-ip'.
    // Do NOT trust client-supplied 'x-forwarded-for' in public traffic.
    const clientIp =
      request.headers.get("cf-connecting-ip")?.trim() ||
      "127.0.0.1";

    let activeRequest = request;

    // Security: Bounded body size check for POST & PUT (10KB default, 30KB for itineraries)
    if (method === "POST" || method === "PUT") {
      const isItin = url.pathname.startsWith("/api/itineraries");
      const maxLimit = isItin ? MAX_ITINERARY_BYTES : MAX_DEFAULT_BYTES;
      const limitLabel = isItin ? "30KB" : "10KB";

      const contentLength = request.headers.get("content-length");
      if (contentLength) {
        const parsedLen = parseInt(contentLength, 10);
        if (!isNaN(parsedLen) && parsedLen > maxLimit) {
          return errorResponse(`Dung lượng yêu cầu vượt quá giới hạn cho phép (${limitLabel}).`, 413, env);
        }
      }

      const { body, tooLarge } = await readBoundedBody(request, maxLimit);
      if (tooLarge) {
        return errorResponse(`Dung lượng yêu cầu vượt quá giới hạn cho phép (${limitLabel}).`, 413, env);
      }

      activeRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: body,
      });
    }

    // Phase 4 Security: Rate limiting for chat endpoint
    if (url.pathname === "/api/chat" && method === "POST") {
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

    // Phase 8.1 Security: Rate limiting for auth endpoints
    if (url.pathname.startsWith("/api/auth/") && method === "POST") {
      const check = authRateLimiter.check(clientIp);
      if (!check.allowed) {
        return errorResponse(
          "Bạn đã thử xác thực quá nhiều lần. Vui lòng thử lại sau.",
          429,
          env,
          { "Retry-After": String(check.retryAfterSec) }
        );
      }
    }

    // Phase 8.2 Security: Rate limiting for preview endpoint
    if (url.pathname === "/api/itineraries/preview" && method === "POST") {
      const check = previewRateLimiter.check(clientIp);
      if (!check.allowed) {
        return errorResponse(
          "Bạn đã tạo quá nhiều lịch trình thử nghiệm. Vui lòng thử lại sau 1 phút.",
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



