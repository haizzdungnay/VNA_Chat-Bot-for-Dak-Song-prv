import type { Env } from "./types";
import { Router } from "./utils/router";
import { optionsResponse, errorResponse } from "./utils/response";
import { healthRoute } from "./routes/health";
import { categoriesRoute } from "./routes/categories";
import { placesListRoute, placeDetailRoute } from "./routes/places";
import { articlesListRoute, articleDetailRoute } from "./routes/articles";
import { chatRoute } from "./routes/chat";

const router = new Router();

router.get("/api/health", healthRoute);
router.get("/api/categories", categoriesRoute);
router.get("/api/places", placesListRoute);
router.get("/api/places/:id", placeDetailRoute);
router.get("/api/articles", articlesListRoute);
router.get("/api/articles/:slug", articleDetailRoute);
router.post("/api/chat", chatRoute);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method.toUpperCase() === "OPTIONS") {
      return optionsResponse(env);
    }

    try {
      return await router.handle(request, env, ctx);
    } catch {
      // Bảo mật: không bao giờ expose stack trace hoặc raw exception
      return errorResponse("Internal Server Error", 500, env);
    }
  },
};
