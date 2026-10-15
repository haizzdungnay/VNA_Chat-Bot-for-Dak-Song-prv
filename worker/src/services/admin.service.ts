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

export const EXPECTED_MIGRATIONS = [
  "0001_initial.sql",
  "0002_seed.sql",
  "0003_schema_update.sql",
  "0004_admin_extension.sql",
  "0005_identity.sql",
  "0006_travel_planner.sql",
  "0007_optimistic_lock_guard.sql",
  "0008_business_booking.sql",
  "0009_booking_transaction_hardening.sql",
  "0010_historical_refund_reconciliation.sql",
  "0011_tourism_quiz.sql",
  "0012_quiz_scoring_and_schedule.sql",
  "0013_rewards_wallet_spin.sql",
  "0014_rewards_integrity_hardening.sql",
  "0015_rewards_time_quota_hardening.sql",
];

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
        stream: false,
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
async getOperationsReadiness(): Promise<Record<string, unknown>> {
    const vnTime = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());

    const [
      dbPing,
      userCount,
      sessionCount,
      itinCount,
      tourCount,
      bookingCount,
      paymentCount,
      refundCount,
      questionCount,
      challengeCount,
      attemptCount,
      attemptCompleted,
      campaignCount,
      spinCount,
      voucherIssued,
      voucherRedeemed,
      giftCount,
      oversoldTpl,
      oversoldSeg,
      ghostSpins,
      userSpinSumRow,
      quizStatsSumRow,
      quizUserDiscrepancyRow,
      rewardDiscrepancyRow,
      hasMigTable,
    ] = await Promise.all([
      this.env.DB.prepare("SELECT 1 as alive").first<{ alive: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM users").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM auth_sessions WHERE expires_at > datetime('now')").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM travel_itineraries").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM tour_products").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM tour_bookings").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM mock_payment_attempts").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM mock_payment_refunds").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM quiz_questions WHERE status = 'published'").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM quiz_challenges").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM quiz_attempts").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM quiz_attempts WHERE status = 'completed'").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_campaigns").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_spin_attempts WHERE status = 'completed'").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_wallet_items").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_wallet_items WHERE status = 'redeemed'").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_gift_claims").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_voucher_templates WHERE total_stock != -1 AND issued_count > total_stock").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_spin_segments WHERE total_inventory != -1 AND awarded_count > total_inventory").first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM reward_spin_attempts WHERE result_type = 'voucher' AND voucher_id IS NULL AND status = 'completed'").first<{ c: number }>(),
      this.env.DB.prepare("SELECT COALESCE(SUM(completed_spins), 0) as s FROM reward_user_campaign_spins").first<{ s: number }>(),
      this.env.DB.prepare("SELECT COALESCE(SUM(completed_attempts), 0) as s FROM quiz_user_stats").first<{ s: number }>(),
      this.env.DB.prepare(`
        SELECT count(*) as c FROM (
          SELECT user_id FROM quiz_user_stats
          WHERE completed_attempts != (SELECT count(*) FROM quiz_attempts WHERE user_id = quiz_user_stats.user_id AND status = 'completed')
          UNION
          SELECT user_id FROM quiz_attempts
          WHERE status = 'completed' AND user_id NOT IN (SELECT user_id FROM quiz_user_stats)
        )
      `).first<{ c: number }>(),
      this.env.DB.prepare(`
        SELECT count(*) as c FROM (
          SELECT s.campaign_id, s.user_id
          FROM reward_user_campaign_spins s
          WHERE s.completed_spins != (
            SELECT count(*)
            FROM reward_spin_attempts a
            JOIN reward_spin_wheels w ON a.wheel_id = w.id
            WHERE w.campaign_id = s.campaign_id AND a.user_id = s.user_id AND a.status = 'completed'
          )
          UNION
          SELECT w.campaign_id, a.user_id
          FROM reward_spin_attempts a
          JOIN reward_spin_wheels w ON a.wheel_id = w.id
          WHERE a.status = 'completed' AND NOT EXISTS (
            SELECT 1 FROM reward_user_campaign_spins s
            WHERE s.campaign_id = w.campaign_id AND s.user_id = a.user_id
          )
        )
      `).first<{ c: number }>(),
      this.env.DB.prepare("SELECT count(*) as c FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'").first<{ c: number }>(),
    ]);

    const isMockPayment = Boolean(this.env.MOCK_PAYMENT_ENABLED === "true" || this.env.MOCK_PAYMENT_ENABLED === true);
    const dbAlive = dbPing?.alive === 1;

    const completedAttemptsCount = attemptCompleted?.c || 0;
    const completedSpinsCount = spinCount?.c || 0;
    const userSpinsSum = userSpinSumRow?.s || 0;
    const quizStatsSum = quizStatsSumRow?.s || 0;

    // P2-OPS-02: Verify migrations dynamically against d1_migrations metadata table
    let migrationVerificationStatus: "VERIFIED" | "INCOMPLETE" | "UNKNOWN" = "UNKNOWN";
    let verifiedAppliedMigrationsCount: number | null = null;
    let migrationDiscrepancyReason: string | null = null;

    if ((hasMigTable?.c || 0) > 0) {
      const migRows = await this.env.DB.prepare(
        "SELECT name FROM d1_migrations ORDER BY id ASC"
      ).all<{ name: string }>();
      const appliedNames = (migRows.results || []).map((r) => r.name);
      verifiedAppliedMigrationsCount = appliedNames.length;

      const matchesLength = appliedNames.length === EXPECTED_MIGRATIONS.length;
      const matchesNames = matchesLength && appliedNames.every((name, i) => name === EXPECTED_MIGRATIONS[i]);

      if (matchesNames) {
        migrationVerificationStatus = "VERIFIED";
        migrationDiscrepancyReason = null;
      } else {
        migrationVerificationStatus = "INCOMPLETE";
        const missing = EXPECTED_MIGRATIONS.filter((m) => !appliedNames.includes(m));
        const extra = appliedNames.filter((m) => !EXPECTED_MIGRATIONS.includes(m));
        migrationDiscrepancyReason = `Sai lệch migration metadata: Thiếu [${missing.join(", ")}], Thừa [${extra.join(", ")}]`;
      }
    } else {
      migrationVerificationStatus = "UNKNOWN";
      verifiedAppliedMigrationsCount = null;
      migrationDiscrepancyReason = "Bảng metadata d1_migrations không tồn tại (Môi trường test in-memory hoặc chưa qua Wrangler migrator)";
    }

    // P1-OPS-01: Rigorous invariant calculation including user-level discrepancy checks
    const quizMatchesGlobal = completedAttemptsCount === quizStatsSum;
    const quizUserDiscrepancies = quizUserDiscrepancyRow?.c || 0;
    const quizIntegrityPassed = quizMatchesGlobal && quizUserDiscrepancies === 0;

    const rewardMatchesGlobal = completedSpinsCount === userSpinsSum;
    const rewardUserDiscrepancies = rewardDiscrepancyRow?.c || 0;
    const rewardIntegrityPassed = rewardMatchesGlobal && rewardUserDiscrepancies === 0;

    const zeroOversoldTemplates = (oversoldTpl?.c || 0) === 0;
    const zeroOversoldSegments = (oversoldSeg?.c || 0) === 0;
    const zeroGhostVoucherSpins = (ghostSpins?.c || 0) === 0;

    const overallIntegrity =
      Boolean(dbAlive) &&
      quizIntegrityPassed &&
      rewardIntegrityPassed &&
      zeroOversoldTemplates &&
      zeroOversoldSegments &&
      zeroGhostVoucherSpins;

    const overallStatus: "PASS" | "FAIL" = overallIntegrity ? "PASS" : "FAIL";
    const overallStatusLabel = overallIntegrity
      ? "Kiểm tra toàn vẹn LOCAL: PASS (100% đạt chuẩn kỹ thuật)"
      : "Kiểm tra toàn vẹn LOCAL: FAIL (Phát hiện sai lệch bất biến dữ liệu)";

    return {
      system: {
        timestampUtc: new Date().toISOString(),
        timestampVietnam: vnTime,
        environment: this.env.ENVIRONMENT || "development",
        databaseConnected: dbAlive,
        expectedMigrationsCount: EXPECTED_MIGRATIONS.length,
        verifiedAppliedMigrationsCount,
        migrationVerificationStatus,
        migrationDiscrepancyReason,
      },
      modules: {
        identity: {
          name: "Xác thực & Danh tính (Phase 8.1)",
          status: "active",
          mode: "LOCAL_DEV_MOCK",
          usersCount: userCount?.c || 0,
          activeSessionsCount: sessionCount?.c || 0,
        },
        aiPlanner: {
          name: "Lập lịch trình AI (Phase 8.2)",
          status: "active",
          mode: "REAL_OR_FALLBACK_DETERMINISTIC",
          itinerariesCount: itinCount?.c || 0,
        },
        bookingAndPayment: {
          name: "Đặt tour & Thanh toán (Phase 8.3)",
          status: "active",
          mode: isMockPayment ? "MOCK_SIMULATED" : "DISABLED",
          label: "MÔ PHỎNG / DEMO — Không giao dịch tiền thật",
          toursCount: tourCount?.c || 0,
          bookingsCount: bookingCount?.c || 0,
          paymentAttemptsCount: paymentCount?.c || 0,
          refundsCount: refundCount?.c || 0,
        },
        tourismQuiz: {
          name: "Thử thách Du lịch & Quiz (Phase 8.4)",
          status: "active",
          mode: "SERVER_AUTHORITATIVE",
          publishedQuestionsCount: questionCount?.c || 0,
          challengesCount: challengeCount?.c || 0,
          totalAttemptsCount: attemptCount?.c || 0,
          completedAttemptsCount,
          antiCheatLeakageProtected: true,
        },
        rewardsAndLuckySpin: {
          name: "Ví Voucher & Vòng quay (Phase 8.5)",
          status: "active",
          mode: "DEMO_COUPONS",
          label: "DEMO ONLY — Không có giá trị quy đổi tiền mặt ngoài đời thực",
          campaignsCount: campaignCount?.c || 0,
          completedSpinsCount,
          vouchersIssuedCount: voucherIssued?.c || 0,
          vouchersRedeemedCount: voucherRedeemed?.c || 0,
          giftClaimsCount: giftCount?.c || 0,
        },
      },
      invariants: {
        quizCompletedMatchesStats: quizMatchesGlobal,
        quizUserDiscrepancyCount: quizUserDiscrepancies,
        quizIntegrityPassed,
        rewardSpinsMatchesUserCounters: rewardMatchesGlobal,
        rewardUserDiscrepancyCount: rewardUserDiscrepancies,
        rewardIntegrityPassed,
        zeroOversoldTemplates,
        zeroOversoldSegments,
        zeroGhostVoucherSpins,
        databaseConnected: dbAlive,
        overallIntegrity,
        overallStatus,
        overallStatusLabel,
      },
    };
  }

  async exportOperationsCsv(): Promise<string> {
    const data: any = await this.getOperationsReadiness();
    const sanitizeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    const lines: string[] = [];
    lines.push("BÁO CÁO NGHIỆM THU & VẬN HÀNH HỆ THỐNG DU LỊCH ĐẮK SONG (PHASE 8.6)");
    lines.push("");
    lines.push(`Thời điểm kết xuất (UTC):,${sanitizeCsv(data.system.timestampUtc)}`);
    lines.push(`Thời điểm kết xuất (Việt Nam):,${sanitizeCsv(data.system.timestampVietnam)}`);
    lines.push(`Môi trường:,${sanitizeCsv(data.system.environment)}`);
    lines.push(`Trạng thái CSDL (D1):,${sanitizeCsv(data.system.databaseConnected ? "KẾT NỐI TỐT" : "LỖI")}`);
    lines.push(`Xác minh migration D1:,${sanitizeCsv(
      data.system.migrationVerificationStatus === "VERIFIED"
        ? `ĐÃ XÁC MINH (${data.system.verifiedAppliedMigrationsCount}/${data.system.expectedMigrationsCount})`
        : data.system.migrationVerificationStatus === "INCOMPLETE"
        ? `THIẾU MIGRATION (${data.system.verifiedAppliedMigrationsCount || 0}/${data.system.expectedMigrationsCount}) - ${data.system.migrationDiscrepancyReason || ""}`
        : "CHƯA THỂ XÁC MINH METADATA (Môi trường test in-memory hoặc thiếu d1_migrations)"
    )}`);
    lines.push("");
    lines.push(["Phân hệ", "Trạng thái", "Chế độ nghiệp vụ", "Chỉ số hoạt động", "Ghi chú bảo mật & bản quyền"].map(sanitizeCsv).join(","));

    for (const [, mod] of Object.entries(data.modules) as any[]) {
      lines.push([
        mod.name,
        mod.status,
        mod.mode,
        JSON.stringify(mod),
        mod.label || "Chính thức / Kiểm thử nội bộ",
      ].map(sanitizeCsv).join(","));
    }

    lines.push("");
    lines.push("ĐỐI SOÁT TÍNH TOÀN VẸN VÀ BẤT BIẾN DỮ LIỆU (INVARIANTS):");
    lines.push(`Đối soát số lượt Quiz hoàn thành tổng toàn cục:,${sanitizeCsv(data.invariants.quizCompletedMatchesStats ? "ĐẠT (PASS)" : "LỆCH")}`);
    lines.push(`Đối soát sai lệch Quiz từng người dùng (User-level):,${sanitizeCsv(data.invariants.quizUserDiscrepancyCount === 0 ? "ĐẠT (0 sai lệch)" : `LỖI (${data.invariants.quizUserDiscrepancyCount} sai lệch)`)}`);
    lines.push(`Đối soát lượt quay khớp bộ đếm người dùng tổng toàn cục:,${sanitizeCsv(data.invariants.rewardSpinsMatchesUserCounters ? "ĐẠT (PASS)" : "LỆCH")}`);
    lines.push(`Đối soát sai lệch lượt quay từng cặp Campaign/User:,${sanitizeCsv(data.invariants.rewardUserDiscrepancyCount === 0 ? "ĐẠT (0 sai lệch)" : `LỖI (${data.invariants.rewardUserDiscrepancyCount} sai lệch)`)}`);
    lines.push(`Không có mẫu voucher nào bị âm kho:,${sanitizeCsv(data.invariants.zeroOversoldTemplates ? "ĐẠT (PASS)" : "LỖI")}`);
    lines.push(`Không có ô thưởng nào bị vượt hạn mức:,${sanitizeCsv(data.invariants.zeroOversoldSegments ? "ĐẠT (PASS)" : "LỖI")}`);
    lines.push(`Không có lượt quay trúng voucher ảo (Ghost win):,${sanitizeCsv(data.invariants.zeroGhostVoucherSpins ? "ĐẠT (PASS)" : "LỖI")}`);
    lines.push(`KẾT LUẬN TOÀN VẸN LOCAL:,${sanitizeCsv(data.invariants.overallIntegrity ? "PASS (100% ĐẠT CHUẨN KỸ THUẬT)" : "FAIL (CÓ SAI LỆCH CẦN RÀ SOÁT)")}`);

    return "\uFEFF" + lines.join("\r\n");
  }
}


