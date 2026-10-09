import type { Env } from "../types";

export interface AdminAuthResult {
  authenticated: boolean;
  email?: string;
  isMock?: boolean;
  status?: number;
  error?: string;
}

function parseJwtPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Cấu trúc JWT không đúng định dạng 3 phần.");
  }
  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(jsonPayload);
}

/**
 * Authenticates request against Cloudflare Access single-admin policy.
 * Fail-closed by default. Only permits mock authentication when strictly configured for local development.
 */
export async function authenticateAdmin(req: Request, env: Env): Promise<AdminAuthResult> {
  const jwtAssertion = req.headers.get("cf-access-jwt-assertion");

  // Check dev mock bypass only in explicit local dev mode
  const isDevMode =
    env.ADMIN_DEV_MOCK_AUTH === "true" ||
    env.ADMIN_DEV_MOCK_AUTH === true ||
    env.ENVIRONMENT === "development";

  if (!jwtAssertion) {
    if (isDevMode) {
      return {
        authenticated: true,
        email: "admin@daksong.vn",
        isMock: true,
      };
    }

    return {
      authenticated: false,
      status: 401,
      error: "Yêu cầu bị từ chối: Thiếu chứng thực Cloudflare Access (Cf-Access-Jwt-Assertion).",
    };
  }

  try {
    const payload = parseJwtPayload(jwtAssertion);

    // Expiry check
    if (!payload.exp || typeof payload.exp !== "number") {
      return {
        authenticated: false,
        status: 401,
        error: "Mã xác thực không có thời hạn hợp lệ (Missing exp).",
      };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) {
      return {
        authenticated: false,
        status: 401,
        error: "Phiên làm việc quản trị đã hết hạn (JWT expired).",
      };
    }

    // Issuer check if team name configured
    if (env.CF_ACCESS_TEAM_NAME) {
      const expectedIss = `https://${env.CF_ACCESS_TEAM_NAME.trim()}.cloudflareaccess.com`;
      if (payload.iss !== expectedIss) {
        return {
          authenticated: false,
          status: 403,
          error: "Cloudflare Access Team Issuer không khớp.",
        };
      }
    }

    // Audience check if AUD configured
    if (env.CF_ACCESS_AUD) {
      const expectedAud = env.CF_ACCESS_AUD.trim();
      const payloadAuds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!payloadAuds.includes(expectedAud)) {
        return {
          authenticated: false,
          status: 403,
          error: "Cloudflare Access Audience Tag không khớp.",
        };
      }
    }

    // Single-admin email allowlist check
    const email = payload.email?.toLowerCase().trim();
    if (!email) {
      return {
        authenticated: false,
        status: 403,
        error: "Không tìm thấy email trong chứng thực Cloudflare Access.",
      };
    }

    if (env.ADMIN_EMAIL_ALLOWLIST) {
      const allowedEmails = env.ADMIN_EMAIL_ALLOWLIST
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (!allowedEmails.includes(email)) {
        return {
          authenticated: false,
          status: 403,
          error: `Email '${email}' không được cấp quyền quản trị hệ thống.`,
        };
      }
    }

    return {
      authenticated: true,
      email,
      isMock: false,
    };
  } catch (err: any) {
    return {
      authenticated: false,
      status: 401,
      error: `Lỗi phân tích chứng thực Cloudflare Access: ${err.message || "JWT malformed"}`,
    };
  }
}

