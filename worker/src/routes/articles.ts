import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { ArticleRepository } from "../repositories/article.repository";

export const articlesListRoute: RouteHandler = async (req, _params, env) => {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const search = url.searchParams.get("q") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const repo = new ArticleRepository(env.DB);
    const articles = await repo.findAll({ category, search, limit });
    return jsonResponse(articles, 200, env);
  } catch (err: any) {
    return errorResponse("Không thể tải danh sách bài viết", 500, env);
  }
};

export const articleDetailRoute: RouteHandler = async (_req, params, env) => {
  try {
    const slug = params.slug || params.id;
    if (!slug) {
      return errorResponse("Thiếu định danh bài viết", 400, env);
    }

    const repo = new ArticleRepository(env.DB);
    const article = await repo.findBySlugOrId(slug);

    if (!article) {
      return errorResponse("Không tìm thấy bài viết", 404, env);
    }

    return jsonResponse(article, 200, env);
  } catch (err: any) {
    return errorResponse("Không thể tải chi tiết bài viết", 500, env);
  }
};
