import type {
  Env,
  RewardCampaignRow,
  RewardVoucherTemplateRow,
  RewardWalletItemRow,
  RewardSpinWheelRow,
  RewardSpinSegmentRow,
  RewardEntitlementRow,
} from "../types";
import { getVietnamDateTime } from "./quiz.service";

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Unbiased bounded random index selection using Web Crypto rejection sampling.
 * Eliminates modulo bias completely.
 */
function selectWeightedSegmentIndex(weights: number[]): number {
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);
  if (totalWeight <= 0) return 0;

  const maxUint32 = 0x100000000;
  const limit = maxUint32 - (maxUint32 % totalWeight);

  let randVal = 0;
  do {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    randVal = buf[0];
  } while (randVal >= limit);

  const selectedPoint = randVal % totalWeight;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (selectedPoint < cumulative) {
      return i;
    }
  }
  return weights.length - 1;
}

export class RewardService {
  constructor(private env: Env) {}

  async listPublicCampaigns(): Promise<RewardCampaignRow[]> {
    const res = await this.env.DB.prepare(
      `SELECT * FROM reward_campaigns
       WHERE status = 'published' AND (end_at IS NULL OR end_at >= datetime('now'))
       ORDER BY start_at DESC`
    ).all<RewardCampaignRow>();
    return res.results || [];
  }

  async getActiveWheel(campaignId?: string): Promise<{
    wheel: RewardSpinWheelRow | null;
    campaign: RewardCampaignRow | null;
    segments: Array<RewardSpinSegmentRow & { is_available: boolean }>;
  }> {
    let wheel: RewardSpinWheelRow | null = null;
    let campaign: RewardCampaignRow | null = null;

    if (campaignId) {
      campaign = await this.env.DB.prepare(
        "SELECT * FROM reward_campaigns WHERE id = ? AND status = 'published'"
      ).bind(campaignId).first<RewardCampaignRow>();

      if (campaign) {
        wheel = await this.env.DB.prepare(
          "SELECT * FROM reward_spin_wheels WHERE campaign_id = ? AND status = 'active'"
        ).bind(campaign.id).first<RewardSpinWheelRow>();
      }
    } else {
      wheel = await this.env.DB.prepare(
        `SELECT w.* FROM reward_spin_wheels w
         JOIN reward_campaigns c ON w.campaign_id = c.id
         WHERE w.status = 'active' AND c.status = 'published'
         ORDER BY w.created_at DESC`
      ).first<RewardSpinWheelRow>();

      if (wheel) {
        campaign = await this.env.DB.prepare(
          "SELECT * FROM reward_campaigns WHERE id = ?"
        ).bind(wheel.campaign_id).first<RewardCampaignRow>();
      }
    }

    if (!wheel || !campaign) {
      return { wheel: null, campaign: null, segments: [] };
    }

    const segRes = await this.env.DB.prepare(
      `SELECT * FROM reward_spin_segments WHERE wheel_id = ? ORDER BY order_index ASC`
    ).bind(wheel.id).all<RewardSpinSegmentRow>();

    const segments = (segRes.results || []).map((s) => ({
      ...s,
      is_available: s.total_inventory === -1 || s.awarded_count < s.total_inventory,
    }));

    return { wheel, campaign, segments };
  }

  async getUserSpinEligibility(userId: string, campaignId?: string): Promise<{
    canSpin: boolean;
    availableTurns: number;
    campaign: RewardCampaignRow | null;
    wheel: RewardSpinWheelRow | null;
    dailyFreeEligible: boolean;
    reason?: string;
  }> {
    const { wheel, campaign } = await this.getActiveWheel(campaignId);
    if (!wheel || !campaign) {
      return {
        canSpin: false,
        availableTurns: 0,
        campaign: null,
        wheel: null,
        dailyFreeEligible: false,
        reason: "Không có vòng quay may mắn nào đang hoạt động.",
      };
    }

    // Sum unconsumed entitlement turns
    const entRes = await this.env.DB.prepare(
      `SELECT COALESCE(SUM(total_granted - consumed_count), 0) as available_turns
       FROM reward_entitlements
       WHERE user_id = ? AND campaign_id = ? AND (expires_at IS NULL OR expires_at >= datetime('now'))`
    ).bind(userId, campaign.id).first<{ available_turns: number }>();

    let availableTurns = entRes?.available_turns || 0;

    // Check if daily free spin is allowed and ungranted today
    let dailyFreeEligible = false;
    let rules: any = {};
    try {
      rules = JSON.parse(campaign.eligibility_rules_json || "{}");
    } catch {}

    if (rules.allow_free_daily) {
      const vnDate = getVietnamDateTime().dateStr;
      const todayDailyKey = `free_daily:${vnDate}`;
      const existingDaily = await this.env.DB.prepare(
        `SELECT id FROM reward_entitlements WHERE user_id = ? AND source_event_key = ?`
      ).bind(userId, todayDailyKey).first();

      if (!existingDaily) {
        dailyFreeEligible = true;
      }
    }

    const canSpin = availableTurns > 0 || dailyFreeEligible;

    return {
      canSpin,
      availableTurns,
      campaign,
      wheel,
      dailyFreeEligible,
      reason: canSpin ? undefined : "Bạn đã hết lượt quay may mắn hôm nay.",
    };
  }

  async claimDailySpin(userId: string, campaignId?: string): Promise<{
    success: boolean;
    entitlementId: string;
    availableTurns: number;
  }> {
    const { campaign } = await this.getActiveWheel(campaignId);
    if (!campaign) {
      const err = new Error("Chiến dịch không tồn tại hoặc đã đóng.");
      (err as any).statusCode = 404;
      throw err;
    }

    let rules: any = {};
    try {
      rules = JSON.parse(campaign.eligibility_rules_json || "{}");
    } catch {}

    if (!rules.allow_free_daily) {
      const err = new Error("Chiến dịch này không áp dụng lượt quay miễn phí hàng ngày.");
      (err as any).statusCode = 400;
      throw err;
    }

    const vnDate = getVietnamDateTime().dateStr;
    const sourceKey = `free_daily:${vnDate}`;

    // Idempotent check
    const existing = await this.env.DB.prepare(
      `SELECT * FROM reward_entitlements WHERE user_id = ? AND source_event_key = ?`
    ).bind(userId, sourceKey).first<RewardEntitlementRow>();

    if (existing) {
      const remaining = await this.getUserSpinEligibility(userId, campaign.id);
      return {
        success: true,
        entitlementId: existing.id,
        availableTurns: remaining.availableTurns,
      };
    }

    const entitlementId = "ent-daily-" + crypto.randomUUID();
    const expiresAt = `${vnDate} 23:59:59`;

    try {
      await this.env.DB.prepare(
        `INSERT INTO reward_entitlements (
          id, user_id, campaign_id, grant_type, source_event_key, total_granted, consumed_count, expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, 'free_daily', ?, 1, 0, ?, datetime('now'), datetime('now'))`
      ).bind(entitlementId, userId, campaign.id, sourceKey, expiresAt).run();
    } catch (e: any) {
      if (String(e).includes("UNIQUE")) {
        const recheck = await this.env.DB.prepare(
          `SELECT * FROM reward_entitlements WHERE user_id = ? AND source_event_key = ?`
        ).bind(userId, sourceKey).first<RewardEntitlementRow>();
        const remaining = await this.getUserSpinEligibility(userId, campaign.id);
        return {
          success: true,
          entitlementId: recheck?.id || entitlementId,
          availableTurns: remaining.availableTurns,
        };
      }
      throw e;
    }

    const remaining = await this.getUserSpinEligibility(userId, campaign.id);
    return {
      success: true,
      entitlementId,
      availableTurns: remaining.availableTurns,
    };
  }

  async claimQuizReward(userId: string, quizAttemptId: string, campaignId?: string): Promise<{
    success: boolean;
    entitlementId: string;
    message: string;
  }> {
    if (!quizAttemptId) {
      const err = new Error("Thiếu mã lượt thi Quiz");
      (err as any).statusCode = 400;
      throw err;
    }

    // Read authoritative completed quiz attempt from DB
    const att = await this.env.DB.prepare(
      `SELECT id, user_id, status, score, max_score, completed_at
       FROM quiz_attempts
       WHERE id = ?`
    ).bind(quizAttemptId).first<any>();

    if (!att) {
      const err = new Error("Không tìm thấy kết quả bài thi Quiz");
      (err as any).statusCode = 404;
      throw err;
    }

    if (att.user_id !== userId) {
      const err = new Error("Không có quyền yêu cầu nhận thưởng cho bài thi này");
      (err as any).statusCode = 403;
      throw err;
    }

    if (att.status !== "completed") {
      const err = new Error("Bài thi chưa kết thúc, không thể xét thưởng");
      (err as any).statusCode = 400;
      throw err;
    }

    const { campaign } = await this.getActiveWheel(campaignId);
    if (!campaign) {
      const err = new Error("Không có chiến dịch quà tặng nào đang mở");
      (err as any).statusCode = 404;
      throw err;
    }

    let rules: any = {};
    try {
      rules = JSON.parse(campaign.eligibility_rules_json || "{}");
    } catch {}

    const minScore = rules.quiz_reward_min_score !== undefined ? rules.quiz_reward_min_score : 10;
    if (att.score < minScore) {
      const err = new Error(`Bạn đạt ${att.score} điểm, chưa đủ ngưỡng tối thiểu ${minScore} điểm để nhận quà`);
      (err as any).statusCode = 400;
      throw err;
    }

    const sourceKey = `quiz_attempt:${quizAttemptId}`;

    // Idempotent check
    const existing = await this.env.DB.prepare(
      `SELECT id FROM reward_entitlements WHERE user_id = ? AND source_event_key = ?`
    ).bind(userId, sourceKey).first<RewardEntitlementRow>();

    if (existing) {
      return {
        success: true,
        entitlementId: existing.id,
        message: "Bạn đã nhận lượt quay cho bài thi này rồi.",
      };
    }

    const entId = "ent-qz-" + crypto.randomUUID();
    try {
      await this.env.DB.prepare(
        `INSERT INTO reward_entitlements (
          id, user_id, campaign_id, grant_type, source_event_key, total_granted, consumed_count, created_at, updated_at
        ) VALUES (?, ?, ?, 'quiz_completed', ?, 1, 0, datetime('now'), datetime('now'))`
      ).bind(entId, userId, campaign.id, sourceKey).run();
    } catch (e: any) {
      if (String(e).includes("UNIQUE")) {
        const recheck = await this.env.DB.prepare(
          `SELECT id FROM reward_entitlements WHERE user_id = ? AND source_event_key = ?`
        ).bind(userId, sourceKey).first<RewardEntitlementRow>();
        return {
          success: true,
          entitlementId: recheck?.id || entId,
          message: "Bạn đã nhận lượt quay cho bài thi này rồi.",
        };
      }
      throw e;
    }

    return {
      success: true,
      entitlementId: entId,
      message: "Chúc mừng! Bạn đã nhận được 1 lượt quay may mắn từ thành tích Quiz.",
    };
  }

  async executeSpin(
    userId: string,
    input: { wheelId?: string; campaignId?: string; idempotencyKey?: string } = {}
  ): Promise<any> {
    const idemKey = input.idempotencyKey?.trim() || null;
    const requestPayload = JSON.stringify({
      userId,
      wheelId: input.wheelId || null,
      campaignId: input.campaignId || null,
    });
    const requestHash = await sha256Hex(requestPayload);

    // 1. Idempotency check in idempotency_records
    if (idemKey) {
      const record = await this.env.DB.prepare(
        `SELECT * FROM idempotency_records WHERE idempotency_key = ?`
      ).bind(idemKey).first<any>();

      if (record) {
        if (record.user_id !== userId) {
          const err = new Error("Không có quyền truy cập dữ liệu idempotency này.");
          (err as any).statusCode = 403;
          throw err;
        }
        if (record.request_hash !== requestHash) {
          const err = new Error("Trùng lặp Idempotency-Key với nội dung yêu cầu khác.");
          (err as any).statusCode = 409;
          throw err;
        }
        return JSON.parse(record.response_json);
      }
    }

    // 2. Fetch wheel & campaign
    const { wheel, campaign, segments } = await this.getActiveWheel(input.campaignId);
    if (!wheel || !campaign) {
      const err = new Error("Vòng quay may mắn hiện không mở.");
      (err as any).statusCode = 404;
      throw err;
    }

    // 3. Find available entitlement or auto-grant daily free turn
    let entitlement = await this.env.DB.prepare(
      `SELECT * FROM reward_entitlements
       WHERE user_id = ? AND campaign_id = ? AND consumed_count < total_granted
         AND (expires_at IS NULL OR expires_at >= datetime('now'))
       ORDER BY created_at ASC
       LIMIT 1`
    ).bind(userId, campaign.id).first<RewardEntitlementRow>();

    let autoGrantedDaily = false;
    let newDailyEntId: string | null = null;
    const vnDate = getVietnamDateTime().dateStr;
    const dailyKey = `free_daily:${vnDate}`;

    if (!entitlement) {
      let rules: any = {};
      try {
        rules = JSON.parse(campaign.eligibility_rules_json || "{}");
      } catch {}

      if (rules.allow_free_daily) {
        const existingDaily = await this.env.DB.prepare(
          `SELECT id FROM reward_entitlements WHERE user_id = ? AND source_event_key = ?`
        ).bind(userId, dailyKey).first();

        if (!existingDaily) {
          autoGrantedDaily = true;
          newDailyEntId = "ent-daily-" + crypto.randomUUID();
        }
      }

      if (!autoGrantedDaily) {
        const err = new Error("Bạn không còn lượt quay may mắn. Hãy tham gia Quiz hoặc chờ ngày mai!");
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // 4. Select segment via rejection-sampled Web Crypto weighted selection
    const candidateSegments = segments.filter((s) => s.is_available && s.weight > 0);
    let chosenSegment: (RewardSpinSegmentRow & { is_available: boolean }) | null = null;

    if (candidateSegments.length === 0) {
      chosenSegment = segments.find((s) => s.segment_type === "no_win") || segments[0];
    } else {
      const weights = candidateSegments.map((s) => s.weight);
      const chosenIdx = selectWeightedSegmentIndex(weights);
      chosenSegment = candidateSegments[chosenIdx];
    }

    // 5. Prepare atomic D1 Batch statements
    const spinAttemptId = "spin-" + crypto.randomUUID();
    const stmts: any[] = [];

    // If auto-granting daily entitlement, insert it first in the batch
    if (autoGrantedDaily && newDailyEntId) {
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO reward_entitlements (
            id, user_id, campaign_id, grant_type, source_event_key, total_granted, consumed_count, expires_at, created_at, updated_at
          ) VALUES (?, ?, ?, 'free_daily', ?, 1, 0, ?, datetime('now'), datetime('now'))`
        ).bind(newDailyEntId, userId, campaign.id, dailyKey, `${vnDate} 23:59:59`)
      );
    }

    // Consume entitlement turn with CAS check
    const entIdToConsume = entitlement ? entitlement.id : newDailyEntId!;
    stmts.push(
      this.env.DB.prepare(
        `UPDATE reward_entitlements
         SET consumed_count = consumed_count + 1, updated_at = datetime('now')
         WHERE id = ? AND consumed_count < total_granted`
      ).bind(entIdToConsume)
    );
    stmts.push(this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"));
    stmts.push(this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"));

    let voucherDetail: any = null;
    let voucherId: string | null = null;

    if (chosenSegment.segment_type === "voucher" && chosenSegment.voucher_template_id) {
      const tpl = await this.env.DB.prepare(
        `SELECT * FROM reward_voucher_templates WHERE id = ?`
      ).bind(chosenSegment.voucher_template_id).first<RewardVoucherTemplateRow>();

      if (tpl && tpl.status === "active" && (tpl.total_stock === -1 || tpl.issued_count < tpl.total_stock)) {
        voucherId = "vouch-" + crypto.randomUUID();
        const randCodeSuffix = crypto.randomUUID().slice(0, 8).toUpperCase();
        const voucherCode = `${tpl.code_prefix}-${randCodeSuffix}`;
        const validityDays = tpl.validity_days || 30;
        const expiresAt = new Date(Date.now() + validityDays * 86400000).toISOString();

        // Snapshot terms & conditions
        const termsSnapshot = JSON.stringify({
          templateId: tpl.id,
          codePrefix: tpl.code_prefix,
          discountDisplay: tpl.discount_display,
          discountType: tpl.discount_type,
          discountValue: tpl.discount_value,
          minOrderValue: tpl.min_order_value,
          category: tpl.category,
          terms: tpl.terms_conditions,
          validityDays,
          demoNotice: "Voucher thử nghiệm (DEMO), không có giá trị thanh toán tiền mặt.",
        });

        stmts.push(
          this.env.DB.prepare(
            `INSERT INTO reward_wallet_items (
              id, user_id, template_id, campaign_id, voucher_code, title, discount_display,
              category, terms_conditions_snapshot, status, source_type, source_reference_id,
              issued_at, expires_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', 'lucky_spin', ?, datetime('now'), ?, datetime('now'), datetime('now'))`
          ).bind(
            voucherId,
            userId,
            tpl.id,
            campaign.id,
            voucherCode,
            tpl.title,
            tpl.discount_display,
            tpl.category,
            termsSnapshot,
            spinAttemptId,
            expiresAt
          )
        );

        // Increment template issued count
        stmts.push(
          this.env.DB.prepare(
            `UPDATE reward_voucher_templates
             SET issued_count = issued_count + 1, updated_at = datetime('now')
             WHERE id = ? AND (total_stock = -1 OR issued_count < total_stock)`
          ).bind(tpl.id)
        );
        stmts.push(this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"));
        stmts.push(this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"));

        // Increment segment inventory if finite
        stmts.push(
          this.env.DB.prepare(
            `UPDATE reward_spin_segments
             SET awarded_count = awarded_count + 1, updated_at = datetime('now')
             WHERE id = ? AND (total_inventory = -1 OR awarded_count < total_inventory)`
          ).bind(chosenSegment.id)
        );
        stmts.push(this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"));
        stmts.push(this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"));

        voucherDetail = {
          id: voucherId,
          code: voucherCode,
          title: tpl.title,
          discountDisplay: tpl.discount_display,
          category: tpl.category,
          expiresAt,
        };
      }
    }

    const snapshot = JSON.stringify({
      segmentId: chosenSegment.id,
      label: chosenSegment.label,
      segmentType: chosenSegment.segment_type,
      voucher: voucherDetail,
    });

    stmts.push(
      this.env.DB.prepare(
        `INSERT INTO reward_spin_attempts (
          id, user_id, wheel_id, entitlement_id, segment_id, result_type, voucher_id,
          result_snapshot_json, idempotency_key, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', datetime('now'))`
      ).bind(
        spinAttemptId,
        userId,
        wheel.id,
        entIdToConsume,
        chosenSegment.id,
        chosenSegment.segment_type,
        voucherId,
        snapshot,
        idemKey
      )
    );

    const responseData = {
      success: true,
      spinAttemptId,
      segment: {
        id: chosenSegment.id,
        orderIndex: chosenSegment.order_index,
        label: chosenSegment.label,
        segmentType: chosenSegment.segment_type,
        color: chosenSegment.color,
      },
      voucher: voucherDetail,
    };

    if (idemKey) {
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO idempotency_records (
            id, user_id, operation, idempotency_key, resource_id, request_hash, response_json, created_at
          ) VALUES (?, ?, 'execute_spin', ?, ?, ?, ?, datetime('now'))`
        ).bind(
          "idem-" + crypto.randomUUID(),
          userId,
          idemKey,
          spinAttemptId,
          requestHash,
          JSON.stringify(responseData)
        )
      );
    }

    // Execute atomic batch
    try {
      await this.env.DB.batch(stmts);
    } catch (batchErr: any) {
      if (idemKey) {
        const record = await this.env.DB.prepare(
          `SELECT response_json FROM idempotency_records WHERE idempotency_key = ?`
        ).bind(idemKey).first<any>();
        if (record) {
          return JSON.parse(record.response_json);
        }
      }
      throw batchErr;
    }

    return responseData;
  }

  async getUserWallet(
    userId: string,
    statusFilter?: string,
    page = 1,
    limit = 20
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const offset = (p - 1) * l;

    let whereClause = "WHERE user_id = ?";
    const params: any[] = [userId];

    if (statusFilter && ["issued", "redeemed", "expired", "revoked"].includes(statusFilter)) {
      whereClause += " AND status = ?";
      params.push(statusFilter);
    }

    const countRes = await this.env.DB.prepare(
      `SELECT count(*) as total FROM reward_wallet_items ${whereClause}`
    ).bind(...params).first<any>();

    const itemsRes = await this.env.DB.prepare(
      `SELECT w.*, c.title as campaign_title
       FROM reward_wallet_items w
       LEFT JOIN reward_campaigns c ON w.campaign_id = c.id
       ${whereClause}
       ORDER BY w.issued_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, l, offset).all<any>();

    return {
      items: itemsRes.results || [],
      total: countRes?.total || 0,
      page: p,
      limit: l,
    };
  }

  async getWalletItemDetail(userId: string, itemId: string): Promise<any | null> {
    const item = await this.env.DB.prepare(
      `SELECT w.*, c.title as campaign_title
       FROM reward_wallet_items w
       LEFT JOIN reward_campaigns c ON w.campaign_id = c.id
       WHERE w.id = ?`
    ).bind(itemId).first<any>();

    if (!item) return null;
    if (item.user_id !== userId) {
      const err = new Error("Không có quyền truy cập mã ưu đãi này.");
      (err as any).statusCode = 403;
      throw err;
    }

    return item;
  }

  async getSpinHistory(userId: string, page = 1, limit = 20): Promise<any> {
    const p = Math.max(1, page);
    const l = Math.min(50, Math.max(1, limit));
    const offset = (p - 1) * l;

    const countRes = await this.env.DB.prepare(
      `SELECT count(*) as total FROM reward_spin_attempts WHERE user_id = ?`
    ).bind(userId).first<any>();

    const itemsRes = await this.env.DB.prepare(
      `SELECT a.*, s.label as segment_label, s.color as segment_color
       FROM reward_spin_attempts a
       LEFT JOIN reward_spin_segments s ON a.segment_id = s.id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(userId, l, offset).all<any>();

    return {
      history: itemsRes.results || [],
      total: countRes?.total || 0,
      page: p,
      limit: l,
    };
  }
}

