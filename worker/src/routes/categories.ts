import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { CategoryRepository } from "../repositories/category.repository";

export const categoriesRoute: RouteHandler = async (_req, _params, env) => {
  try {
    const repo = new CategoryRepository(env.DB);
    const categories = await repo.findAll();
    return jsonResponse(categories, 200, env);
  } catch (err: any) {
    return errorResponse("Không thể tải danh mục", 500, env);
  }
};
