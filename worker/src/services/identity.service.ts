import type {
  Env,
  UserRow,
  AuthIdentityRow,
  AuthSessionRow,
  AuthChallengeRow,
  AuthUser,
} from "../types";
import { ValidationError } from "../utils/errors";
import { EmailSenderService } from "./email-sender.service";

export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Server-secret HMAC-SHA256 for 6-digit OTP codes.
 * Prevents offline rainbow table attacks if database challenge records are leaked.
 */
export async function computeOtpHmac(code: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey || "vna-daksong-otp-hmac-salt-secret");
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(code));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateSecureToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtpCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const num = (buffer[0] % 900000) + 100000;
  return num.toString();
}

function parseDbDate(dt: string): number {
  if (!dt) return 0;
  if (dt.endsWith("Z")) return new Date(dt).getTime();
  return new Date(dt.replace(" ", "T") + "Z").getTime();
}

export interface ZaloVerifyResult {
  valid: boolean;
  zaloId?: string;
  name?: string;
  picture?: string;
  error?: string;
}

export class IdentityService {
  private env: Env;
  private emailSender: EmailSenderService;

  // Test hook to inject custom Zalo verification without external HTTP
  public static testZaloVerifier: ((token: string) => Promise<ZaloVerifyResult>) | null = null;

  constructor(env: Env) {
    this.env = env;
    this.emailSender = new EmailSenderService(env);
  }

  private getOtpSecret(): string {
    const key = this.env.ADMIN_ENCRYPTION_KEY || (this.env as any).SECRET_SALT;
    if (key) return key;
    if (this.env.ENVIRONMENT === "test" || this.env.ENVIRONMENT === "development") {
      return "vna-dev-otp-hmac-salt";
    }
    throw new ValidationError("Máy chủ thiếu cấu hình khóa bảo mật OTP (ADMIN_ENCRYPTION_KEY).", 500);
  }

  async verifyZaloAccessToken(accessToken: string): Promise<ZaloVerifyResult> {
    if (IdentityService.testZaloVerifier) {
      return await IdentityService.testZaloVerifier(accessToken);
    }

    try {
      const res = await fetch("https://graph.zalo.me/v2.0/me", {
        method: "GET",
        headers: {
          access_token: accessToken,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          valid: false,
          error: `Zalo API error (${res.status}): ${errText.slice(0, 150)}`,
        };
      }

      const data: any = await res.json();
      if (data?.error) {
        return {
          valid: false,
          error: data.message || "Mã truy cập Zalo không hợp lệ hoặc đã hết hạn",
        };
      }

      if (!data?.id) {
        return {
          valid: false,
          error: "Không tìm thấy định danh người dùng trong phản hồi của Zalo",
        };
      }

      return {
        valid: true,
        zaloId: String(data.id),
        name: data.name,
        picture: data.picture?.data?.url,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Không thể kết nối máy chủ Zalo: ${err.message || String(err)}`,
      };
    }
  }

  async loginWithZalo(
    accessToken: string,
    clientInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ sessionToken: string; user: AuthUser }> {
    if (!accessToken || typeof accessToken !== "string" || accessToken.trim().length < 8) {
      throw new ValidationError("Thiếu hoặc sai định dạng mã truy cập Zalo.", 400);
    }

    const verification = await this.verifyZaloAccessToken(accessToken.trim());
    if (!verification.valid || !verification.zaloId) {
      throw new ValidationError(
        verification.error || "Mã truy cập Zalo không hợp lệ hoặc đã hết hạn.",
        401
      );
    }

    const zaloId = verification.zaloId.trim();

    // Look up existing identity
    const existingIdentity = await this.env.DB.prepare(
      "SELECT user_id FROM auth_identities WHERE provider = 'zalo' AND provider_user_id = ?"
    )
      .bind(zaloId)
      .first<{ user_id: string }>();

    let userId: string;

    if (existingIdentity && existingIdentity.user_id) {
      userId = existingIdentity.user_id;
      // Update display name or avatar if new ones present
      if (verification.name || verification.picture) {
        await this.env.DB.prepare(
          "UPDATE users SET display_name = COALESCE(?, display_name), avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now') WHERE id = ?"
        )
          .bind(verification.name || null, verification.picture || null, userId)
          .run();
      }
    } else {
      userId = crypto.randomUUID();
      const displayName = verification.name || "Khách Zalo";
      const avatarUrl = verification.picture || null;

      await this.env.DB.prepare(
        "INSERT INTO users (id, display_name, avatar_url, status) VALUES (?, ?, ?, 'active')"
      )
        .bind(userId, displayName, avatarUrl)
        .run();

      try {
        await this.env.DB.prepare(
          "INSERT INTO auth_identities (id, user_id, provider, provider_user_id, provider_metadata_json) VALUES (?, ?, 'zalo', ?, ?)"
        )
          .bind(
            crypto.randomUUID(),
            userId,
            zaloId,
            JSON.stringify({ name: verification.name, picture: verification.picture })
          )
          .run();
      } catch {
        // Concurrency guard: If another concurrent request inserted identity first, resolve that user
        const recheck = await this.env.DB.prepare(
          "SELECT user_id FROM auth_identities WHERE provider = 'zalo' AND provider_user_id = ?"
        )
          .bind(zaloId)
          .first<{ user_id: string }>();
        if (recheck?.user_id) {
          userId = recheck.user_id;
        }
      }
    }

    // Issue session token
    const sessionToken = generateSecureToken(32);
    const tokenHash = await sha256(sessionToken);
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await this.env.DB.prepare(
      "INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        sessionId,
        userId,
        tokenHash,
        expiresAt,
        clientInfo?.userAgent?.slice(0, 255) || null,
        clientInfo?.ipAddress?.slice(0, 45) || null
      )
      .run();

    const user = await this.getUserById(userId);
    return { sessionToken, user };
  }

  async requestEmailOtp(
    email: string,
    clientIp?: string
  ): Promise<{ success: boolean; message: string; challengeId: string }> {
    if (!email || typeof email !== "string") {
      throw new ValidationError("Email không hợp lệ.", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 255) {
      throw new ValidationError("Định dạng email không đúng chuẩn.", 400);
    }

    // Security: Check transactional email service configuration
    if (!this.emailSender.isConfigured() && this.env.ENVIRONMENT !== "test") {
      throw new ValidationError(
        "Dịch vụ gửi email chưa được cấu hình trên máy chủ. Vui lòng liên hệ quản trị viên.",
        503
      );
    }

    // Rate limiting: max 5 requests per 10 minutes per email
    const recentCountRow = await this.env.DB.prepare(
      "SELECT count(*) as count FROM auth_challenges WHERE identifier = ? AND created_at > datetime('now', '-10 minutes')"
    )
      .bind(normalizedEmail)
      .first<{ count: number }>();

    if (recentCountRow && recentCountRow.count >= 5) {
      throw new ValidationError(
        "Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau 10 phút.",
        429
      );
    }

    const otpCode = generateOtpCode();
    // Step 2 Security Hardening: Use HMAC-SHA256 with server-secret instead of plain SHA-256
    const codeHash = await computeOtpHmac(otpCode, this.getOtpSecret());
    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await this.env.DB.prepare(
      "INSERT INTO auth_challenges (id, identifier, challenge_type, code_hash, attempts, max_attempts, expires_at) VALUES (?, ?, 'email_otp', ?, 0, 3, ?)"
    )
      .bind(challengeId, normalizedEmail, codeHash, expiresAt)
      .run();

    const sendRes = await this.emailSender.sendEmail({
      to: normalizedEmail,
      subject: "Mã xác thực đăng nhập Du Lịch Đắk Song",
      text: `Mã xác thực (OTP) của bạn là: ${otpCode}. Mã có hiệu lực trong 10 phút. Tuyệt đối không chia sẻ mã này cho người khác.`,
      html: `<p>Xin chào,</p><p>Mã xác thực (OTP) đăng nhập của bạn là: <strong>${otpCode}</strong></p><p>Mã có hiệu lực trong 10 phút. Tuyệt đối không chia sẻ mã này cho người khác.</p>`,
    });

    if (!sendRes.success) {
      throw new ValidationError(
        "Không thể gửi email xác thực: " + (sendRes.error || "Lỗi dịch vụ email"),
        502
      );
    }

    return {
      success: true,
      message: "Mã xác thực OTP đã được gửi đến email của bạn.",
      challengeId,
    };
  }

  async verifyEmailOtp(
    email: string,
    code: string,
    clientInfo?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ sessionToken: string; user: AuthUser }> {
    if (!email || typeof email !== "string" || !code || typeof code !== "string") {
      throw new ValidationError("Email và mã xác thực không được để trống.", 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new ValidationError("Mã xác thực phải bao gồm 6 chữ số.", 400);
    }

    // Lookup latest unconsumed challenge
    const challenge = await this.env.DB.prepare(
      "SELECT * FROM auth_challenges WHERE identifier = ? AND challenge_type = 'email_otp' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1"
    )
      .bind(normalizedEmail)
      .first<AuthChallengeRow>();

    if (!challenge) {
      throw new ValidationError("Không tìm thấy yêu cầu xác thực hoặc mã đã được sử dụng.", 400);
    }

    // Expiration check
    const expiresAtMs = parseDbDate(challenge.expires_at);
    if (expiresAtMs <= Date.now()) {
      throw new ValidationError("Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.", 400);
    }

    // Attempt counter check
    if (challenge.attempts >= challenge.max_attempts) {
      throw new ValidationError(
        "Mã xác thực đã bị vô hiệu hóa do thử sai quá số lần cho phép. Vui lòng yêu cầu mã mới.",
        400
      );
    }

    // Compare HMAC
    const codeHash = await computeOtpHmac(cleanCode, this.getOtpSecret());
    if (codeHash !== challenge.code_hash) {
      const nextAttempts = challenge.attempts + 1;
      await this.env.DB.prepare(
        "UPDATE auth_challenges SET attempts = ? WHERE id = ?"
      )
        .bind(nextAttempts, challenge.id)
        .run();

      const remaining = challenge.max_attempts - nextAttempts;
      if (remaining <= 0) {
        throw new ValidationError(
          "Mã xác thực không chính xác. Bạn đã hết số lần thử. Vui lòng yêu cầu mã mới.",
          400
        );
      }

      throw new ValidationError(
        `Mã xác thực không chính xác. Bạn còn ${remaining} lần thử.`,
        400
      );
    }

    // Step 2 Security Hardening: Atomic conditional update to prevent concurrent replay race conditions
    const updateRes = await this.env.DB.prepare(
      "UPDATE auth_challenges SET consumed_at = datetime('now') WHERE id = ? AND consumed_at IS NULL"
    )
      .bind(challenge.id)
      .run();

    if (updateRes && (updateRes as any).meta && (updateRes as any).meta.changes === 0) {
      throw new ValidationError("Mã xác thực đã được sử dụng hoặc đang được xử lý.", 400);
    }

    // Check existing email identity
    const existingIdentity = await this.env.DB.prepare(
      "SELECT user_id FROM auth_identities WHERE provider = 'email' AND provider_user_id = ?"
    )
      .bind(normalizedEmail)
      .first<{ user_id: string }>();

    let userId: string;

    if (existingIdentity && existingIdentity.user_id) {
      userId = existingIdentity.user_id;
    } else {
      userId = crypto.randomUUID();
      const displayName = normalizedEmail.split("@")[0];

      await this.env.DB.prepare(
        "INSERT INTO users (id, email, display_name, status) VALUES (?, ?, ?, 'active')"
      )
        .bind(userId, normalizedEmail, displayName)
        .run();

      try {
        await this.env.DB.prepare(
          "INSERT INTO auth_identities (id, user_id, provider, provider_user_id) VALUES (?, ?, 'email', ?)"
        )
          .bind(crypto.randomUUID(), userId, normalizedEmail)
          .run();
      } catch {
        const recheck = await this.env.DB.prepare(
          "SELECT user_id FROM auth_identities WHERE provider = 'email' AND provider_user_id = ?"
        )
          .bind(normalizedEmail)
          .first<{ user_id: string }>();
        if (recheck?.user_id) {
          userId = recheck.user_id;
        }
      }
    }

    // Issue session token
    const sessionToken = generateSecureToken(32);
    const tokenHash = await sha256(sessionToken);
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await this.env.DB.prepare(
      "INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        sessionId,
        userId,
        tokenHash,
        expiresAt,
        clientInfo?.userAgent?.slice(0, 255) || null,
        clientInfo?.ipAddress?.slice(0, 45) || null
      )
      .run();

    const user = await this.getUserById(userId);
    return { sessionToken, user };
  }

  async authenticateSession(sessionToken: string): Promise<{
    authenticated: boolean;
    user?: AuthUser;
    session?: AuthSessionRow;
    error?: string;
    status?: number;
  }> {
    if (!sessionToken || typeof sessionToken !== "string" || sessionToken.trim().length < 16) {
      return {
        authenticated: false,
        status: 401,
        error: "Thiếu hoặc sai định dạng mã phiên làm việc (Session Token).",
      };
    }

    const tokenHash = await sha256(sessionToken.trim());

    interface SessionJoinRow {
      session_id: string;
      user_id: string;
      token_hash: string;
      session_created_at: string;
      expires_at: string;
      revoked_at: string | null;
      last_active_at: string;
      user_agent: string | null;
      ip_address: string | null;
      email: string | null;
      display_name: string | null;
      avatar_url: string | null;
      user_status: string;
      user_created_at: string;
    }

    const row = await this.env.DB.prepare(
      `SELECT s.id as session_id, s.user_id, s.token_hash, s.created_at as session_created_at,
              s.expires_at, s.revoked_at, s.last_active_at, s.user_agent, s.ip_address,
              u.email, u.display_name, u.avatar_url, u.status as user_status, u.created_at as user_created_at
       FROM auth_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ?`
    )
      .bind(tokenHash)
      .first<SessionJoinRow>();

    if (!row) {
      return {
        authenticated: false,
        status: 401,
        error: "Phiên làm việc không tồn tại hoặc đã hết hạn.",
      };
    }

    if (row.revoked_at) {
      return {
        authenticated: false,
        status: 401,
        error: "Phiên làm việc đã bị thu hồi (đã đăng xuất).",
      };
    }

    const expiresAtMs = parseDbDate(row.expires_at);
    if (expiresAtMs <= Date.now()) {
      return {
        authenticated: false,
        status: 401,
        error: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.",
      };
    }

    if (row.user_status !== "active") {
      return {
        authenticated: false,
        status: 403,
        error: "Tài khoản người dùng đã bị tạm khóa.",
      };
    }

    // Update last_active_at
    await this.env.DB.prepare(
      "UPDATE auth_sessions SET last_active_at = datetime('now') WHERE id = ?"
    )
      .bind(row.session_id)
      .run();

    const providers = await this.getUserProviders(row.user_id);

    const user: AuthUser = {
      id: row.user_id,
      email: row.email,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      status: row.user_status,
      providers,
      createdAt: row.user_created_at,
    };

    const session: AuthSessionRow = {
      id: row.session_id,
      user_id: row.user_id,
      token_hash: row.token_hash,
      created_at: row.session_created_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
      last_active_at: row.last_active_at,
      user_agent: row.user_agent,
      ip_address: row.ip_address,
    };

    return { authenticated: true, user, session };
  }

  async logout(sessionToken: string): Promise<boolean> {
    if (!sessionToken || typeof sessionToken !== "string" || sessionToken.trim().length < 16) {
      return false;
    }

    const tokenHash = await sha256(sessionToken.trim());
    await this.env.DB.prepare(
      "UPDATE auth_sessions SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL"
    )
      .bind(tokenHash)
      .run();

    return true;
  }

  async getUserById(userId: string): Promise<AuthUser> {
    const userRow = await this.env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    )
      .bind(userId)
      .first<UserRow>();

    if (!userRow) {
      throw new ValidationError("Không tìm thấy thông tin người dùng.", 404);
    }

    const providers = await this.getUserProviders(userId);

    return {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      avatarUrl: userRow.avatar_url,
      status: userRow.status,
      providers,
      createdAt: userRow.created_at,
    };
  }

  async getUserProviders(userId: string): Promise<string[]> {
    const { results } = await this.env.DB.prepare(
      "SELECT provider FROM auth_identities WHERE user_id = ?"
    )
      .bind(userId)
      .all<{ provider: string }>();

    return (results || []).map((r) => r.provider);
  }
}
