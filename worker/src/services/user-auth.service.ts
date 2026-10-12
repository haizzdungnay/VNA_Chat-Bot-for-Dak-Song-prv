import type { Env, AuthUser, AuthSessionRow } from "../types";
import { IdentityService } from "./identity.service";

export interface UserAuthResult {
  authenticated: boolean;
  user?: AuthUser;
  session?: AuthSessionRow;
  status?: number;
  error?: string;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1].trim();
  }
  return null;
}

export async function authenticateUser(req: Request, env: Env): Promise<UserAuthResult> {
  const token = extractBearerToken(req);
  if (!token) {
    return {
      authenticated: false,
      status: 401,
      error: "Yêu cầu bị từ chối: Thiếu Authorization header (Bearer token).",
    };
  }

  const identityService = new IdentityService(env);
  const result = await identityService.authenticateSession(token);

  if (!result.authenticated) {
    return {
      authenticated: false,
      status: result.status || 401,
      error: result.error || "Mã phiên làm việc không hợp lệ.",
    };
  }

  return {
    authenticated: true,
    user: result.user,
    session: result.session,
  };
}
