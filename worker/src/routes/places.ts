import type { RouteHandler } from "../utils/router";
import { jsonResponse, errorResponse } from "../utils/response";
import { PlaceRepository } from "../repositories/place.repository";

export const placesListRoute: RouteHandler = async (req, _params, env) => {
  try {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const featuredParam = url.searchParams.get("featured");
    const featured = featuredParam !== null ? featuredParam === "true" || featuredParam === "1" : undefined;

    const repo = new PlaceRepository(env.DB);
    const places = await repo.findAll({ categoryId, search, featured });
    return jsonResponse(places, 200, env);
  } catch (err: any) {
    return errorResponse("Không thể tải danh sách địa điểm", 500, env);
  }
};

export const placeDetailRoute: RouteHandler = async (_req, params, env) => {
  try {
    const id = params.id;
    if (!id) {
      return errorResponse("Thiếu ID địa điểm", 400, env);
    }

    const repo = new PlaceRepository(env.DB);
    const place = await repo.findById(id);

    if (!place) {
      return errorResponse("Không tìm thấy địa điểm", 404, env);
    }

    return jsonResponse(place, 200, env);
  } catch (err: any) {
    return errorResponse("Không thể tải chi tiết địa điểm", 500, env);
  }
};
