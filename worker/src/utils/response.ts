import type { Env } from "../types";

export function getCorsHeaders(env?: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env?.CORS_ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export function jsonResponse<T>(data: T, status = 200, env?: Env, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getCorsHeaders(env),
      ...(extraHeaders || {}),
    },
  });
}

export function errorResponse(message: string, status = 400, env?: Env, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message, status }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getCorsHeaders(env),
      ...(extraHeaders || {}),
    },
  });
}

export function optionsResponse(env?: Env): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(env),
  });
}
