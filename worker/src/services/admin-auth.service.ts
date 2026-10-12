import type { Env } from "../types";

export interface AdminAuthResult {
  authenticated: boolean;
  email?: string;
  isMock?: boolean;
  status?: number;
  error?: string;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + pad);
  return decodeURIComponent(
    binary
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}

function base64UrlToBytes(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const jwksCache = new Map<string, { keys: any[]; expiresAt: number }>();

// Test hook for RS256 JWKS verification in automated tests
export let testJwksProvider: ((team: string) => Promise<{ keys: any[] }>) | null = null;

export function setTestJwksProvider(provider: ((team: string) => Promise<{ keys: any[] }>) | null) {
  testJwksProvider = provider;
}

async function getJwksForTeam(teamName: string): Promise<any[]> {
  if (testJwksProvider) {
    const res = await testJwksProvider(teamName);
    return res.keys || [];
  }

  const cached = jwksCache.get(teamName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const url = `https://${teamName.trim()}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Không thể tải chứng chỉ Cloudflare Access (${res.status})`);
  }
  const data = (await res.json()) as { keys: any[] };
  const keys = data.keys || [];
  jwksCache.set(teamName, { keys, expiresAt: Date.now() + 3600 * 1000 });
  return keys;
}

export async function verifyJwtSignature(
  token: string,
  teamName: string
): Promise<{ valid: boolean; error?: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Định dạng JWT không đúng 3 phần." };
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    if (header.alg !== "RS256") {
      return { valid: false, error: `Thuật toán JWT không được hỗ trợ: ${header.alg}. Yêu cầu RS256.` };
    }

    const jwks = await getJwksForTeam(teamName);
    const keyJwk = jwks.find((k) => (header.kid ? k.kid === header.kid : true));
    if (!keyJwk) {
      return { valid: false, error: `Không tìm thấy khóa công khai phù hợp với kid: ${header.kid || "default"}` };
    }

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      keyJwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const dataToVerify = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = base64UrlToBytes(parts[2]);

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBytes,
      dataToVerify
    );

    if (!isValid) {
      return { valid: false, error: "Chữ ký Cloudflare Access JWT không hợp lệ (Signature verification failed)." };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: `Lỗi khi xác minh chữ ký JWT: ${err.message || String(err)}` };
  }
}

/**
 * Authenticates request against Cloudflare Access single-admin policy.
 * Fail-closed by default. Only permits mock authentication when strictly configured for local development/test.
 */
export async function authenticateAdmin(req: Request, env: Env): Promise<AdminAuthResult> {
  const jwtAssertion = req.headers.get("cf-access-jwt-assertion");

  // Strict Fail-Closed: Only permit mock admin auth when EXPLICITLY set to local development or test
  const isDevMode =
    (env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test") &&
    (env.ADMIN_DEV_MOCK_AUTH === "true" || env.ADMIN_DEV_MOCK_AUTH === true);

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
    const parts = jwtAssertion.split(".");
    if (parts.length !== 3) {
      return {
        authenticated: false,
        status: 401,
        error: "Cấu trúc JWT không đúng định dạng 3 phần.",
      };
    }

    // Cryptographic RS256 signature verification against Cloudflare Access JWKS
    if (env.CF_ACCESS_TEAM_NAME) {
      const sigCheck = await verifyJwtSignature(jwtAssertion, env.CF_ACCESS_TEAM_NAME);
      if (!sigCheck.valid) {
        return {
          authenticated: false,
          status: 401,
          error: sigCheck.error || "Chữ ký Cloudflare Access JWT không hợp lệ.",
        };
      }
    }

    const payload = JSON.parse(base64UrlDecode(parts[1]));

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
