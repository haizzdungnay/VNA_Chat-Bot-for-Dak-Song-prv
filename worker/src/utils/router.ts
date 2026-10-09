import type { Env } from "../types";
import { errorResponse } from "./response";

export type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response>;

interface RouteEntry {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: RouteEntry[] = [];

  add(method: string, path: string, handler: RouteHandler): this {
    const paramNames: string[] = [];
    const regexSource = path.replace(/:([a-zA-Z0-9_]+)/g, (_, paramName) => {
      paramNames.push(paramName);
      return "([^/]+)";
    });
    const pattern = new RegExp(`^${regexSource}$`);
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      paramNames,
      handler,
    });
    return this;
  }

  get(path: string, handler: RouteHandler): this {
    return this.add("GET", path, handler);
  }

  post(path: string, handler: RouteHandler): this {
    return this.add("POST", path, handler);
  }

  put(path: string, handler: RouteHandler): this {
    return this.add("PUT", path, handler);
  }

  delete(path: string, handler: RouteHandler): this {
    return this.add("DELETE", path, handler);
  }

  async handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
        }
        return await route.handler(req, params, env, ctx);
      }
    }

    return errorResponse("Not Found", 404, env);
  }
}

