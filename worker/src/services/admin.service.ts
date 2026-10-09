import type {
  Env,
  AdminAIProfileRow,
  AdminAIProfilePublic,
  VisitorProfileRow,
  AdminAuditLogRow,
  AdminTelemetryEventRow,
} from "../types";
import { encryptApiKey, decryptApiKey } from "../utils/crypto";
import { validateAiEndpoint } from "../utils/security-guards";
import { ValidationError } from "../utils/errors";

function rowToPublic(row: AdminAIProfileRow): AdminAIProfilePublic {
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    model: row.model,
    reasoningEffort: row.reasoning_effort || "low",
    jsonMode: Boolean(row.json_mode),
    keySuffix: row.key_suffix,
    isActive: Boolean(row.is_active),
    testStatus: row.test_status,
    testError: row.test_error,
    lastTestedAt: row.last_tested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AdminService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  async getProfiles(): Promise<AdminAIProfilePublic[]> {
    const { results } = await this.env.DB.prepare(
      `SELECT id, name, provider_type, base_url, model, reasoning_effort, json_mode,
              key_suffix, is_active, test_status, test_error, last_tested_at, created_at, updated_at
       FROM admin_ai_profiles
       ORDER BY is_active DESC, updated_at DESC`
    ).all<AdminAIProfileRow>();

    return (results || []).map(rowToPublic);
  }

  async createProfile(
    input: {
      name: string;
      providerType?: string;
      baseUrl: string;
      model: string;
      apiKey: string;
      reasoningEffort?: string;
      jsonMode?: boolean;
    },
    actor: string
  ): Promise<AdminAIProfilePublic> {
    if (!input.name?.trim()) throw new ValidationError("Tên cấu hình không được để trống");
    if (!input.model?.trim()) throw new ValidationError("Tên model không được để trống");
    if (!input.apiKey?.trim()) throw new ValidationError("API Key không được để trống");

    const endpointCheck = validateAiEndpoint(input.baseUrl, this.env.ALLOWED_AI_HOSTS);
    if (!endpointCheck.valid) {
      throw new ValidationError(endpointCheck.error || "Endpoint AI không hợp lệ");
    }

    if (!this.env.ADMIN_ENCRYPTION_KEY) {
      throw new ValidationError("Máy chủ chưa cấu hình ADMIN_ENCRYPTION_KEY để mã hóa khóa");
    }

    const encryptedKey = await encryptApiKey(input.apiKey, this.env.ADMIN_ENCRYPTION_KEY);
    const cleanKey = input.apiKey.trim();
    const keySuffix = cleanKey.length <= 4 ? cleanKey : cleanKey.slice(-4);
    const id = crypto.randomUUID();
    const providerType = input.providerType || "openai-compatible";
    const reasoning = input.reasoningEffort || "low";
    const jsonMode = input.jsonMode ? 1 : 0;

    await this.env.DB.prepare(
      `INSERT INTO admin_ai_profiles (
        id, name, provider_type, base_url, model, reasoning_effort,
        json_mode, encrypted_api_key, key_suffix, is_active, test_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'untested')`
    )
      .bind(
        id,
        input.name.trim(),
        providerType,
        input.baseUrl.trim(),
        input.model.trim(),
        reasoning,
        jsonMode,
        encryptedKey,
        keySuffix
      )
      .run();

    await this.logAuditEvent(
      "profile_created",
      actor,
      JSON.stringify({ profileId: id, name: input.name.trim(), model: input.model.trim() })
    );

    const created = await this.env.DB.prepare(
      "SELECT * FROM admin_ai_profiles WHERE id = ?"
    )
      .bind(id)
      .first<AdminAIProfileRow>();

    if (!created) throw new Error("Lỗi nạp profile vừa tạo");
    return rowToPublic(created);
  }

  async updateProfile(
    id: string,
    input: Partial<{
      name: string;
      baseUrl: string;
      model: string;
      apiKey?: string;
      reasoningEffort?: string;
      jsonMode?: boolean;
    }>,
    actor: string
  ): Promise<AdminAIProfilePublic> {
    const existing = await this.env.DB.prepare("SELECT * FROM admin_ai_profiles WHERE id = ?")
      .bind(id)
      .first<AdminAIProfileRow>();
    if (!existing) throw new ValidationError("Không tìm thấy profile cấu hình");

    let baseUrl = existing.base_url;
    if (input.baseUrl) {
      const check = validateAiEndpoint(input.baseUrl, this.env.ALLOWED_AI_HOSTS);
      if (!check.valid) throw new ValidationError(check.error || "Endpoint không hợp lệ");
      baseUrl = input.baseUrl.trim();
    }

    let encryptedKey = existing.encrypted_api_key;
    let keySuffix = existing.key_suffix;
    if (input.apiKey && input.apiKey.trim()) {
      if (!this.env.ADMIN_ENCRYPTION_KEY) {
        throw new ValidationError("Máy chủ chưa cấu hình ADMIN_ENCRYPTION_KEY");
      }
      encryptedKey = await encryptApiKey(input.apiKey, this.env.ADMIN_ENCRYPTION_KEY);
      const cleanKey = input.apiKey.trim();
      keySuffix = cleanKey.length <= 4 ? cleanKey : cleanKey.slice(-4);
    }

    const name = input.name?.trim() || existing.name;
    const model = input.model?.trim() || existing.model;
    const reasoning = input.reasoningEffort !== undefined ? input.reasoningEffort : existing.reasoning_effort;
    const jsonMode = input.jsonMode !== undefined ? (input.jsonMode ? 1 : 0) : existing.json_mode;

    await this.env.DB.prepare(
      `UPDATE admin_ai_profiles SET
        name = ?, base_url = ?, model = ?, reasoning_effort = ?, json_mode = ?,
        encrypted_api_key = ?, key_suffix = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(name, baseUrl, model, reasoning, jsonMode, encryptedKey, keySuffix, id)
      .run();

    await this.logAuditEvent("profile_updated", actor, JSON.stringify({ profileId: id, name }));

    const updated = await this.env.DB.prepare("SELECT * FROM admin_ai_profiles WHERE id = ?")
      .bind(id)
      .first<AdminAIProfileRow>();
    if (!updated) throw new Error("Lỗi nạp profile đã cập nhật");
    return rowToPublic(updated);
  }

  async deleteProfile(id: string, actor: string): Promise<boolean> {
    const existing = await this.env.DB.prepare("SELECT * FROM admin_ai_profiles WHERE id = ?")
      .bind(id)
      .first<AdminAIProfileRow>();
    if (!existing) throw new ValidationError("Không tìm thấy profile");
    if (existing.is_active === 1) {
      throw new ValidationError("Không thể xóa profile đang hoạt động (Active). Vui lòng kích hoạt profile khác hoặc rollback trước.");
    }

    await this.env.DB.prepare("DELETE FROM admin_ai_profiles WHERE id = ?").bind(id).run();
    await this.logAuditEvent("profile_deleted", actor, JSON.stringify({ profileId: id, name: existing.name }));
    return true;
  }

  async activateProfile(id: string, actor: string): Promise<string> {
    const profile = await this.env.DB.prepare("SELECT * FROM admin_ai_profiles WHERE id = ?")
      .bind(id)
      .first<AdminAIProfileRow>();
    if (!profile) throw new ValidationError("Không tìm thấy profile để kích hoạt");

    // Atomic deactivate all, then activate selected
    await this.env.DB.batch([
      this.env.DB.prepare("UPDATE admin_ai_profiles SET is_active = 0 WHERE is_active = 1"),
      this.env.DB.prepare("UPDATE admin_ai_profiles SET is_active = 1, updated_at = datetime('now') WHERE id = ?").bind(id),
    ]);

    await this.logAuditEvent(
      "profile_activated",
      actor,
      JSON.stringify({ profileId: id, name: profile.name, model: profile.model })
    );

    return id;
  }

  async rollbackToEnv(actor: string): Promise<void> {
    await this.env.DB.prepare("UPDATE admin_ai_profiles SET is_active = 0 WHERE is_active = 1").run();
    await this.logAuditEvent("rollback_to_worker_env", actor, JSON.stringify({ source: "env_fallback" }));
  }

  async testProfileConnection(
    id: string,
    actor: string
  ): Promise<{ status: "success" | "failed" | "degraded"; latencyMs: number; error?: string }> {
    const profile = await this.env.DB.prepare("SELECT * FROM admin_ai_profiles WHERE id = ?")
      .bind(id)
      .first<AdminAIProfileRow>();
    if (!profile) throw new ValidationError("Không tìm thấy profile để kiểm tra");

    if (!this.env.ADMIN_ENCRYPTION_KEY) {
      throw new ValidationError("Thiếu ADMIN_ENCRYPTION_KEY để giải mã khóa test");
    }

    let rawApiKey: string;
    try {
      rawApiKey = await decryptApiKey(profile.encrypted_api_key, this.env.ADMIN_ENCRYPTION_KEY);
    } catch (err: any) {
      await this.env.DB.prepare(
        "UPDATE admin_ai_profiles SET test_status = 'failed', test_error = ?, last_tested_at = datetime('now') WHERE id = ?"
      )
        .bind(err.message || "Decryption failed", id)
        .run();
      return { status: "failed", latencyMs: 0, error: err.message };
    }

    const testUrl = `${profile.base_url.replace(/\/$/, "")}/chat/completions`;
    const startTime = Date.now();
    let status: "success" | "failed" | "degraded" = "failed";
    let errorMsg: string | undefined;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const pingBody = {
        model: profile.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      };

      const res = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawApiKey}`,
        },
        body: JSON.stringify(pingBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        status = "success";
      } else if (res.status === 429) {
        status = "degraded";
        errorMsg = "HTTP 429: Hạn ngạch (Quota) hoặc Rate Limit bị vượt ngưỡng.";
      } else if (res.status === 401 || res.status === 403) {
        status = "failed";
        errorMsg = `HTTP ${res.status}: Khóa API không hợp lệ hoặc thiếu quyền truy cập.`;
      } else {
        status = "failed";
        errorMsg = `HTTP ${res.status} ${res.statusText}`;
      }

      await this.env.DB.prepare(
        "UPDATE admin_ai_profiles SET test_status = ?, test_error = ?, last_tested_at = datetime('now') WHERE id = ?"
      )
        .bind(status, errorMsg || null, id)
        .run();

      await this.logAuditEvent(
        "test_connection",
        actor,
        JSON.stringify({ profileId: id, status, latencyMs, error: errorMsg })
      );

      return { status, latencyMs, error: errorMsg };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isTimeout = err.name === "AbortError";
      const errText = isTimeout ? "Quá thời gian kết nối (Timeout 6s)" : err.message || "Network error";

      await this.env.DB.prepare(
        "UPDATE admin_ai_profiles SET test_status = 'failed', test_error = ?, last_tested_at = datetime('now') WHERE id = ?"
      )
        .bind(errText, id)
        .run();

      return { status: "failed", latencyMs, error: errText };
    }
  }

  async getActiveRuntimeConfig(): Promise<{
    providerType: string;
    baseUrl: string;
    model: string;
    apiKey: string;
    reasoningEffort: string;
    jsonMode: boolean;
    source: "database" | "env_fallback";
    profileId?: string;
    profileName?: string;
  } | null> {
    const isFeatureEnabled =
      this.env.ADMIN_AI_CONFIG_ENABLED === "true" ||
      this.env.ADMIN_AI_CONFIG_ENABLED === true;

    if (!isFeatureEnabled) {
      return null; // Return null so caller continues using legacy env variables directly
    }

    try {
      const activeRow = await this.env.DB.prepare(
        "SELECT * FROM admin_ai_profiles WHERE is_active = 1 LIMIT 1"
      ).first<AdminAIProfileRow>();

      if (!activeRow) return null;

      if (!this.env.ADMIN_ENCRYPTION_KEY) {
        return null; // Master key missing -> fail-safe fallback to worker env
      }

      const decryptedKey = await decryptApiKey(activeRow.encrypted_api_key, this.env.ADMIN_ENCRYPTION_KEY);

      return {
        providerType: activeRow.provider_type,
        baseUrl: activeRow.base_url,
        model: activeRow.model,
        apiKey: decryptedKey,
        reasoningEffort: activeRow.reasoning_effort || "low",
        jsonMode: Boolean(activeRow.json_mode),
        source: "database",
        profileId: activeRow.id,
        profileName: activeRow.name,
      };
    } catch {
      // Tampered / decryption error -> fail-safe fallback to worker env
      return null;
    }
  }

  async getVisitors(): Promise<VisitorProfileRow[]> {
    const { results } = await this.env.DB.prepare(
      `SELECT id, display_name, address_as, age_group, consent_version, consented_at, updated_at, deleted_at
       FROM visitor_profiles
       WHERE deleted_at IS NULL
       ORDER BY consented_at DESC
       LIMIT 100`
    ).all<VisitorProfileRow>();

    return (results || []).map((row) => ({ ...row, displayName: row.display_name, addressAs: row.address_as, ageGroup: row.age_group, consentVersion: row.consent_version, consentedAt: row.consented_at, updatedAt: row.updated_at }));
  }

  async saveVisitorConsent(profile: {
    id: string;
    displayName?: string;
    addressAs?: string;
    ageGroup?: string;
    consentVersion: string;
  }): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO visitor_profiles (id, display_name, address_as, age_group, consent_version, consented_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         display_name = excluded.display_name,
         address_as = excluded.address_as,
         age_group = excluded.age_group,
         consent_version = excluded.consent_version,
         updated_at = datetime('now'),
         deleted_at = NULL`
    )
      .bind(
        profile.id,
        profile.displayName || null,
        profile.addressAs || null,
        profile.ageGroup || null,
        profile.consentVersion
      )
      .run();
  }

  async getLogs(): Promise<{ auditLogs: AdminAuditLogRow[]; telemetryEvents: AdminTelemetryEventRow[] }> {
    const [auditRes, telemRes] = await Promise.all([
      this.env.DB.prepare(
        "SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 50"
      ).all<AdminAuditLogRow>(),
      this.env.DB.prepare(
        "SELECT * FROM admin_telemetry_events ORDER BY created_at DESC LIMIT 50"
      ).all<AdminTelemetryEventRow>(),
    ]);

    return {
      auditLogs: auditRes.results || [],
      telemetryEvents: telemRes.results || [],
    };
  }

  async logAuditEvent(action: string, actor: string, detailsJson?: string): Promise<void> {
    try {
      await this.env.DB.prepare(
        "INSERT INTO admin_audit_logs (id, action, actor, details_json) VALUES (?, ?, ?, ?)"
      )
        .bind(crypto.randomUUID(), action, actor, detailsJson || null)
        .run();
    } catch {
      // Audit log failures do not interrupt primary operation
    }
  }

  async logTelemetryEvent(
    eventType: string,
    statusCode: number,
    durationMs: number,
    errorType?: string,
    tokensUsed?: number
  ): Promise<void> {
    try {
      await this.env.DB.prepare(
        `INSERT INTO admin_telemetry_events (id, event_type, status_code, duration_ms, error_type, tokens_used)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(crypto.randomUUID(), eventType, statusCode, durationMs, errorType || null, tokensUsed ?? null)
        .run();
    } catch {
      // Telemetry failures fail-silent
    }
  }

  async getOverview(): Promise<Record<string, unknown>> {
    const isFeatureEnabled =
      this.env.ADMIN_AI_CONFIG_ENABLED === "true" ||
      this.env.ADMIN_AI_CONFIG_ENABLED === true;

    const [visitorCountRow, telemStatsRow, activeProfileRow] = await Promise.all([
      this.env.DB.prepare("SELECT count(*) as count FROM visitor_profiles WHERE deleted_at IS NULL").first<{ count: number }>(),
      this.env.DB.prepare(
        `SELECT
           count(*) as total_requests,
           sum(case when status_code >= 400 then 1 else 0 end) as total_errors,
           sum(case when status_code = 429 then 1 else 0 end) as rate_limit_429,
           sum(case when status_code = 503 then 1 else 0 end) as upstream_503,
           avg(duration_ms) as avg_duration
         FROM admin_telemetry_events`
      ).first<{
        total_requests: number;
        total_errors: number;
        rate_limit_429: number;
        upstream_503: number;
        avg_duration: number | null;
      }>(),
      this.env.DB.prepare("SELECT * FROM admin_ai_profiles WHERE is_active = 1 LIMIT 1").first<AdminAIProfileRow>(),
    ]);

    let activeProfileInfo: any = null;
    if (activeProfileRow && isFeatureEnabled) {
      activeProfileInfo = {
        id: activeProfileRow.id,
        name: activeProfileRow.name,
        model: activeProfileRow.model,
        baseUrl: activeProfileRow.base_url,
        source: "database",
      };
    } else {
      activeProfileInfo = {
        id: "env-default",
        name: "Worker Environment Variables (Baseline)",
        model: this.env.AI_MODEL || "gemini-2.5-flash-lite",
        baseUrl: this.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
        source: "env_fallback",
      };
    }

    const hasAccess = Boolean(this.env.CF_ACCESS_TEAM_NAME && this.env.CF_ACCESS_AUD);
    const hasKey = Boolean(this.env.ADMIN_ENCRYPTION_KEY && this.env.ADMIN_ENCRYPTION_KEY.length >= 16);

    return {
      visitorConsentCount: visitorCountRow?.count || 0,
      totalChatRequests: telemStatsRow?.total_requests || 0,
      totalChatErrors: telemStatsRow?.total_errors || 0,
      rateLimit429Count: telemStatsRow?.rate_limit_429 || 0,
      upstream503Count: telemStatsRow?.upstream_503 || 0,
      averageLatencyMs: Math.round(telemStatsRow?.avg_duration || 0),
      telemetryActive: true,
      accessConfigured: hasAccess,
      encryptionKeyConfigured: hasKey,
      featureFlagActive: isFeatureEnabled,
      activeProfile: activeProfileInfo,
    };
  }
}


