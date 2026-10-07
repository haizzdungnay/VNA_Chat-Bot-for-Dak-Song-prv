import type { RouteHandler } from "../utils/router";
import { jsonResponse } from "../utils/response";

export const healthRoute: RouteHandler = async (_req, _params, env) => {
  return jsonResponse({ status: "ok" }, 200, env);
};
