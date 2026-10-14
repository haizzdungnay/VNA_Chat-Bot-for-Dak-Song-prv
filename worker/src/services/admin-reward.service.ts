import type {
  Env,
  RewardCampaignRow,
  RewardVoucherTemplateRow,
  RewardSpinWheelRow,
  RewardSpinSegmentRow,
} from "../types";

export class AdminRewardService {
  constructor(private env: Env) {}

  // ==================== CAMPAIGNS ====================
  async listCampaigns(page = 1, limit = 20, status?: string): Promise<any> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const offset = (p - 1) * l;

    let whereClause = "";
    const params: any[] = [];
    if (status) {
      whereClause = "WHERE status = ?";
      params.push(status);
    }

    const countRes = await this.env.DB.prepare(
      `SELECT count(*) as total FROM reward_campaigns ${whereClause}`
    ).bind(...params).first<any>();

    const itemsRes = await this.env.DB.prepare(
      `SELECT * FROM reward_campaigns ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(...params, l, offset).all<RewardCampaignRow>();

    return {
      campaigns: itemsRes.results || [],
      total: countRes?.total || 0,
      page: p,
      limit: l,
    };
  }

  async getCampaign(id: string): Promise<RewardCampaignRow | null> {
    return await this.env.DB.prepare(
      "SELECT * FROM reward_campaigns WHERE id = ?"
    ).bind(id).first<RewardCampaignRow>();
  }

  async createCampaign(input: {
    code: string;
    title: string;
    description?: string;
    campaignType?: string;
    startAt?: string;
    endAt?: string;
    totalQuota?: number;
    perUserLimit?: number;
    eligibilityRules?: any;
    createdBy?: string;
  }): Promise<RewardCampaignRow> {
    if (!input.code || !input.title) {
      throw new Error("Mã chiến dịch và tiêu đề không được để trống");
    }

    const id = "cmp-" + crypto.randomUUID().slice(0, 8);
    const code = input.code.trim().toUpperCase();
    const title = input.title.trim();
    const type = input.campaignType || "lucky_spin";
    const startAt = input.startAt || new Date().toISOString();
    const endAt = input.endAt || null;
    const totalQuota = input.totalQuota || 0;
    const perUserLimit = input.perUserLimit || 0;
    const rulesJson = JSON.stringify(input.eligibilityRules || {});
    const createdBy = input.createdBy || "admin";

    await this.env.DB.prepare(
      `INSERT INTO reward_campaigns (
        id, code, title, description, campaign_type, status, start_at, end_at,
        total_quota, per_user_limit, eligibility_rules_json, version, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
    ).bind(
      id, code, title, input.description || null, type, startAt, endAt,
      totalQuota, perUserLimit, rulesJson, createdBy
    ).run();

    return (await this.getCampaign(id))!;
  }

  async updateCampaign(id: string, input: Partial<RewardCampaignRow & { eligibilityRules?: any }>): Promise<RewardCampaignRow> {
    const existing = await this.getCampaign(id);
    if (!existing) throw new Error("Chiến dịch không tồn tại");

    const title = input.title !== undefined ? input.title.trim() : existing.title;
    const desc = input.description !== undefined ? input.description : existing.description;
    const startAt = input.start_at !== undefined ? input.start_at : existing.start_at;
    const endAt = input.end_at !== undefined ? input.end_at : existing.end_at;
    const quota = input.total_quota !== undefined ? input.total_quota : existing.total_quota;
    const limit = input.per_user_limit !== undefined ? input.per_user_limit : existing.per_user_limit;
    const rules = input.eligibilityRules !== undefined ? JSON.stringify(input.eligibilityRules) : existing.eligibility_rules_json;

    await this.env.DB.prepare(
      `UPDATE reward_campaigns SET
        title = ?, description = ?, start_at = ?, end_at = ?, total_quota = ?,
        per_user_limit = ?, eligibility_rules_json = ?, version = version + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(title, desc, startAt, endAt, quota, limit, rules, id).run();

    return (await this.getCampaign(id))!;
  }

  async setCampaignStatus(id: string, status: string): Promise<RewardCampaignRow> {
    if (!["draft", "published", "paused", "closed", "archived"].includes(status)) {
      throw new Error("Trạng thái chiến dịch không hợp lệ");
    }

    const res = await this.env.DB.prepare(
      "UPDATE reward_campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, id).run();

    if (res.meta.changes === 0) throw new Error("Chiến dịch không tồn tại");
    return (await this.getCampaign(id))!;
  }

  // ==================== VOUCHER TEMPLATES ====================
  async listTemplates(campaignId?: string): Promise<RewardVoucherTemplateRow[]> {
    let whereClause = "";
    const params: any[] = [];
    if (campaignId) {
      whereClause = "WHERE campaign_id = ?";
      params.push(campaignId);
    }
    const res = await this.env.DB.prepare(
      `SELECT * FROM reward_voucher_templates ${whereClause} ORDER BY created_at DESC`
    ).bind(...params).all<RewardVoucherTemplateRow>();
    return res.results || [];
  }

  async getTemplate(id: string): Promise<RewardVoucherTemplateRow | null> {
    return await this.env.DB.prepare(
      "SELECT * FROM reward_voucher_templates WHERE id = ?"
    ).bind(id).first<RewardVoucherTemplateRow>();
  }

  async createTemplate(input: {
    campaignId?: string;
    codePrefix: string;
    title: string;
    discountDisplay: string;
    discountType?: string;
    discountValue?: number;
    minOrderValue?: number;
    category?: string;
    categoryLabel?: string;
    description: string;
    termsConditions: string;
    validityDays?: number;
    totalStock?: number;
  }): Promise<RewardVoucherTemplateRow> {
    if (!input.codePrefix || !input.title || !input.discountDisplay) {
      throw new Error("Thiếu thông tin bắt buộc của mẫu voucher");
    }

    const id = "tpl-" + crypto.randomUUID().slice(0, 8);
    const prefix = input.codePrefix.trim().toUpperCase();
    const title = input.title.trim();
    const display = input.discountDisplay.trim();
    const type = input.discountType || "percentage";
    const value = input.discountValue || 0;
    const minOrder = input.minOrderValue || 0;
    const cat = input.category || "all";
    const catLabel = input.categoryLabel || "Ưu đãi";
    const validityDays = input.validityDays || 30;
    const totalStock = input.totalStock !== undefined ? input.totalStock : -1;

    await this.env.DB.prepare(
      `INSERT INTO reward_voucher_templates (
        id, campaign_id, code_prefix, title, discount_display, discount_type,
        discount_value, min_order_value, category, category_label, description,
        terms_conditions, validity_days, total_stock, issued_count, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'active', datetime('now'), datetime('now'))`
    ).bind(
      id, input.campaignId || null, prefix, title, display, type, value, minOrder,
      cat, catLabel, input.description || "", input.termsConditions || "", validityDays, totalStock
    ).run();

    return (await this.getTemplate(id))!;
  }

  async toggleTemplate(id: string, status: "active" | "paused" | "archived"): Promise<RewardVoucherTemplateRow> {
    await this.env.DB.prepare(
      "UPDATE reward_voucher_templates SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, id).run();
    return (await this.getTemplate(id))!;
  }

  // ==================== WHEELS & SEGMENTS ====================
  async listWheels(campaignId?: string): Promise<RewardSpinWheelRow[]> {
    let whereClause = "";
    const params: any[] = [];
    if (campaignId) {
      whereClause = "WHERE campaign_id = ?";
      params.push(campaignId);
    }
    const res = await this.env.DB.prepare(
      `SELECT * FROM reward_spin_wheels ${whereClause} ORDER BY created_at DESC`
    ).bind(...params).all<RewardSpinWheelRow>();
    return res.results || [];
  }

  async getWheelWithSegments(wheelId: string): Promise<any | null> {
    const wheel = await this.env.DB.prepare(
      "SELECT * FROM reward_spin_wheels WHERE id = ?"
    ).bind(wheelId).first<RewardSpinWheelRow>();
    if (!wheel) return null;

    const segs = await this.env.DB.prepare(
      "SELECT * FROM reward_spin_segments WHERE wheel_id = ? ORDER BY order_index ASC"
    ).bind(wheelId).all<RewardSpinSegmentRow>();

    return { wheel, segments: segs.results || [] };
  }

  async createWheel(input: {
    campaignId: string;
    title: string;
    description?: string;
  }): Promise<RewardSpinWheelRow> {
    if (!input.campaignId || !input.title) {
      throw new Error("Thiếu mã chiến dịch hoặc tiêu đề vòng quay");
    }

    const id = "wheel-" + crypto.randomUUID().slice(0, 8);
    await this.env.DB.prepare(
      `INSERT INTO reward_spin_wheels (id, campaign_id, title, description, status, cost_entitlement_count, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'draft', 1, 1, datetime('now'), datetime('now'))`
    ).bind(id, input.campaignId, input.title.trim(), input.description || null).run();

    const created = await this.env.DB.prepare("SELECT * FROM reward_spin_wheels WHERE id = ?").bind(id).first<RewardSpinWheelRow>();
    return created!;
  }

  async setWheelSegments(
    wheelId: string,
    segments: Array<{
      label: string;
      segmentType: string;
      voucherTemplateId?: string;
      weight: number;
      totalInventory?: number;
      color?: string;
    }>
  ): Promise<any> {
    const wheel = await this.env.DB.prepare(
      "SELECT * FROM reward_spin_wheels WHERE id = ?"
    ).bind(wheelId).first<RewardSpinWheelRow>();
    if (!wheel) throw new Error("Vòng quay không tồn tại");

    // P2-RWD-05: Check if wheel has existing spin attempts in history
    const spinCount = await this.env.DB.prepare(
      "SELECT count(*) as c FROM reward_spin_attempts WHERE wheel_id = ?"
    ).bind(wheelId).first<{ c: number }>();

    if (spinCount && spinCount.c > 0) {
      const err = new Error(
        "Vòng quay đã có lượt quay ghi nhận trong lịch sử, không thể xóa sửa trực tiếp ô thưởng. Vui lòng nhân bản (Clone) hoặc tạo vòng quay phiên bản mới."
      );
      (err as any).statusCode = 409;
      throw err;
    }

    if (!Array.isArray(segments) || segments.length < 2) {
      throw new Error("Vòng quay cần có tối thiểu 2 ô thưởng");
    }

    const hasNoWin = segments.some((s) => s.segmentType === "no_win");
    if (!hasNoWin) {
      throw new Error("Vòng quay bắt buộc phải có ít nhất 1 ô Không trúng (no_win)");
    }

    const totalWeight = segments.reduce((sum, s) => sum + (s.weight || 0), 0);
    if (totalWeight <= 0 || totalWeight >= 0x100000000) {
      throw new Error("Tổng trọng số xác suất phải lớn hơn 0 và nhỏ hơn 2^32");
    }

    // Validate voucherTemplateId belongs to wheel's campaign
    for (const s of segments) {
      if (s.segmentType === "voucher" && s.voucherTemplateId) {
        const tpl = await this.env.DB.prepare(
          "SELECT id, campaign_id FROM reward_voucher_templates WHERE id = ?"
        ).bind(s.voucherTemplateId).first<any>();
        if (!tpl) {
          throw new Error(`Mẫu voucher ${s.voucherTemplateId} không tồn tại`);
        }
        if (tpl.campaign_id && tpl.campaign_id !== wheel.campaign_id) {
          throw new Error(`Mẫu voucher ${s.voucherTemplateId} không thuộc chiến dịch của vòng quay này`);
        }
      }
    }

    const stmts: any[] = [];
    stmts.push(this.env.DB.prepare("DELETE FROM reward_spin_segments WHERE wheel_id = ?").bind(wheelId));

    segments.forEach((s, idx) => {
      const segId = `seg-${wheelId}-${idx + 1}`;
      const inv = s.totalInventory !== undefined ? s.totalInventory : -1;
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO reward_spin_segments (
            id, wheel_id, order_index, label, segment_type, voucher_template_id,
            weight, total_inventory, awarded_count, color, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`
        ).bind(
          segId, wheelId, idx + 1, s.label.trim(), s.segmentType, s.voucherTemplateId || null,
          s.weight, inv, s.color || null
        )
      );
    });

    stmts.push(
      this.env.DB.prepare(
        "UPDATE reward_spin_wheels SET version = version + 1, updated_at = datetime('now') WHERE id = ?"
      ).bind(wheelId)
    );

    await this.env.DB.batch(stmts);
    return await this.getWheelWithSegments(wheelId);
  }

  async toggleWheelStatus(wheelId: string, status: "draft" | "active" | "paused" | "archived"): Promise<RewardSpinWheelRow> {
    await this.env.DB.prepare(
      "UPDATE reward_spin_wheels SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, wheelId).run();

    const w = await this.env.DB.prepare("SELECT * FROM reward_spin_wheels WHERE id = ?").bind(wheelId).first<RewardSpinWheelRow>();
    return w!;
  }

  async cloneWheel(wheelId: string, newTitle?: string): Promise<any> {
    const existing = await this.getWheelWithSegments(wheelId);
    if (!existing || !existing.wheel) {
      throw new Error("Vòng quay gốc không tồn tại");
    }

    const newWheelId = "wheel-" + crypto.randomUUID().slice(0, 8);
    const title = newTitle?.trim() || `${existing.wheel.title} (Bản sao)`;

    const stmts: any[] = [
      this.env.DB.prepare(
        `INSERT INTO reward_spin_wheels (id, campaign_id, title, description, status, cost_entitlement_count, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'draft', ?, 1, datetime('now'), datetime('now'))`
      ).bind(
        newWheelId,
        existing.wheel.campaign_id,
        title,
        existing.wheel.description,
        existing.wheel.cost_entitlement_count
      )
    ];

    existing.segments.forEach((s: any, idx: number) => {
      const newSegId = `seg-${newWheelId}-${idx + 1}`;
      stmts.push(
        this.env.DB.prepare(
          `INSERT INTO reward_spin_segments (
            id, wheel_id, order_index, label, segment_type, voucher_template_id,
            weight, total_inventory, awarded_count, color, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'), datetime('now'))`
        ).bind(
          newSegId,
          newWheelId,
          s.order_index,
          s.label,
          s.segment_type,
          s.voucher_template_id,
          s.weight,
          s.total_inventory,
          s.color
        )
      );
    });

    await this.env.DB.batch(stmts);
    return await this.getWheelWithSegments(newWheelId);
  }

  // ==================== WALLET & REDEMPTIONS ====================
  async listWalletItems(
    page = 1,
    limit = 20,
    filter: { status?: string; search?: string; campaignId?: string } = {}
  ): Promise<any> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const offset = (p - 1) * l;

    const where: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      where.push("w.status = ?");
      params.push(filter.status);
    }
    if (filter.campaignId) {
      where.push("w.campaign_id = ?");
      params.push(filter.campaignId);
    }
    if (filter.search) {
      where.push("(w.voucher_code LIKE ? OR w.title LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)");
      const term = `%${filter.search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

    const countRes = await this.env.DB.prepare(
      `SELECT count(*) as total
       FROM reward_wallet_items w
       LEFT JOIN users u ON w.user_id = u.id
       ${whereSql}`
    ).bind(...params).first<any>();

    const itemsRes = await this.env.DB.prepare(
      `SELECT w.*,
              CASE
                WHEN w.status = 'issued' AND unixepoch(w.expires_at) <= unixepoch() THEN 'expired'
                ELSE w.status
              END AS effective_status,
              u.email as user_email, u.display_name as user_name, c.title as campaign_title
       FROM reward_wallet_items w
       LEFT JOIN users u ON w.user_id = u.id
       LEFT JOIN reward_campaigns c ON w.campaign_id = c.id
       ${whereSql}
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

  async redeemVoucher(
    actorEmail: string,
    voucherIdOrCode: string,
    input: { reason?: string; notes?: string; idempotencyKey?: string } = {}
  ): Promise<any> {
    const voucher = await this.env.DB.prepare(
      "SELECT * FROM reward_wallet_items WHERE id = ? OR voucher_code = ?"
    ).bind(voucherIdOrCode, voucherIdOrCode).first<any>();

    if (!voucher) {
      const err = new Error("Mã ưu đãi không tồn tại");
      (err as any).statusCode = 404;
      throw err;
    }

    if (voucher.status === "redeemed") {
      const err = new Error("Mã ưu đãi đã được sử dụng trước đó (Đã xác minh)");
      (err as any).statusCode = 409;
      throw err;
    }

    if (voucher.status === "revoked") {
      const err = new Error("Không thể sử dụng mã ưu đãi đã bị thu hồi");
      (err as any).statusCode = 409;
      throw err;
    }

    const expMs = Date.parse(voucher.expires_at);
    if (voucher.status === "expired" || (!isNaN(expMs) && expMs <= Date.now())) {
      const err = new Error("Mã ưu đãi đã hết hạn sử dụng");
      (err as any).statusCode = 400;
      throw err;
    }

    const redemptionId = "rdm-" + crypto.randomUUID();
    const stmts: any[] = [
      this.env.DB.prepare(
        `UPDATE reward_wallet_items
         SET status = 'redeemed', redeemed_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'issued' AND unixepoch() < unixepoch(expires_at)`
      ).bind(voucher.id),
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare(
        `INSERT INTO reward_redemptions (
          id, voucher_id, actor, actor_role, status, reason, notes, idempotency_key, created_at
        ) VALUES (?, ?, ?, 'admin', 'success', ?, ?, ?, datetime('now'))`
      ).bind(
        redemptionId,
        voucher.id,
        actorEmail,
        input.reason || "Xác minh sử dụng tại quầy dịch vụ (DEMO)",
        input.notes || null,
        input.idempotencyKey || null
      ),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"),
      this.env.DB.prepare(
        `INSERT INTO reward_audit_events (
          id, actor, actor_type, action, resource_type, resource_id, payload_json, created_at
        ) VALUES (?, ?, 'admin', 'redeem_voucher', 'reward_wallet_items', ?, ?, datetime('now'))`
      ).bind(
        "aud-" + crypto.randomUUID(),
        actorEmail,
        voucher.id,
        JSON.stringify({ voucherCode: voucher.voucher_code, redemptionId })
      )
    ];

    try {
      await this.env.DB.batch(stmts);
    } catch (e: any) {
      const recheck = await this.env.DB.prepare(
        "SELECT status FROM reward_wallet_items WHERE id = ?"
      ).bind(voucher.id).first<any>();
      if (recheck?.status === "redeemed") {
        const err = new Error("Mã ưu đãi đã được sử dụng trước đó (Đã xác minh)");
        (err as any).statusCode = 409;
        throw err;
      }
      if (recheck?.status === "revoked") {
        const err = new Error("Không thể sử dụng mã ưu đãi đã bị thu hồi");
        (err as any).statusCode = 409;
        throw err;
      }
      throw e;
    }

    return await this.env.DB.prepare("SELECT * FROM reward_wallet_items WHERE id = ?").bind(voucher.id).first<any>();
  }

  async revokeVoucher(actorEmail: string, voucherId: string, reason: string): Promise<any> {
    const voucher = await this.env.DB.prepare("SELECT * FROM reward_wallet_items WHERE id = ?").bind(voucherId).first<any>();
    if (!voucher) throw new Error("Mã ưu đãi không tồn tại");

    if (voucher.status === "redeemed") {
      const err = new Error("Không thể thu hồi mã ưu đãi đã được sử dụng");
      (err as any).statusCode = 409;
      throw err;
    }

    if (voucher.status === "revoked") {
      const err = new Error("Mã ưu đãi đã bị thu hồi trước đó");
      (err as any).statusCode = 409;
      throw err;
    }

    const stmts: any[] = [
      this.env.DB.prepare(
        `UPDATE reward_wallet_items
         SET status = 'revoked', revoked_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ? AND status = 'issued'`
      ).bind(voucherId),
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare(
        `INSERT INTO reward_audit_events (
          id, actor, actor_type, action, resource_type, resource_id, payload_json, created_at
        ) VALUES (?, ?, 'admin', 'revoke_voucher', 'reward_wallet_items', ?, ?, datetime('now'))`
      ).bind("aud-" + crypto.randomUUID(), actorEmail, voucherId, JSON.stringify({ reason })),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1")
    ];

    try {
      await this.env.DB.batch(stmts);
    } catch (e: any) {
      const recheck = await this.env.DB.prepare("SELECT status FROM reward_wallet_items WHERE id = ?").bind(voucherId).first<any>();
      if (recheck?.status === "redeemed") {
        const err = new Error("Không thể thu hồi mã ưu đãi đã được sử dụng");
        (err as any).statusCode = 409;
        throw err;
      }
      throw e;
    }

    return await this.env.DB.prepare("SELECT * FROM reward_wallet_items WHERE id = ?").bind(voucherId).first<any>();
  }

  // ==================== GIFT CLAIMS (P1-RWD-02) ====================
  async listGiftClaims(
    page = 1,
    limit = 20,
    filter: { status?: string; search?: string; campaignId?: string } = {}
  ): Promise<any> {
    const p = Math.max(1, page);
    const l = Math.min(100, Math.max(1, limit));
    const offset = (p - 1) * l;

    const where: string[] = [];
    const params: any[] = [];

    if (filter.status) {
      where.push("g.status = ?");
      params.push(filter.status);
    }
    if (filter.campaignId) {
      where.push("g.campaign_id = ?");
      params.push(filter.campaignId);
    }
    if (filter.search) {
      where.push("(g.claim_code LIKE ? OR g.title LIKE ? OR u.email LIKE ? OR u.display_name LIKE ?)");
      const term = `%${filter.search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

    const countRes = await this.env.DB.prepare(
      `SELECT count(*) as total
       FROM reward_gift_claims g
       LEFT JOIN users u ON g.user_id = u.id
       ${whereSql}`
    ).bind(...params).first<any>();

    const itemsRes = await this.env.DB.prepare(
      `SELECT g.*, u.email as user_email, u.display_name as user_name, c.title as campaign_title
       FROM reward_gift_claims g
       LEFT JOIN users u ON g.user_id = u.id
       LEFT JOIN reward_campaigns c ON g.campaign_id = c.id
       ${whereSql}
       ORDER BY g.awarded_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, l, offset).all<any>();

    return {
      claims: itemsRes.results || [],
      total: countRes?.total || 0,
      page: p,
      limit: l,
    };
  }

  async fulfillGiftClaim(actorEmail: string, claimIdOrCode: string, notes?: string): Promise<any> {
    const claim = await this.env.DB.prepare(
      "SELECT * FROM reward_gift_claims WHERE id = ? OR claim_code = ?"
    ).bind(claimIdOrCode, claimIdOrCode).first<any>();

    if (!claim) {
      const err = new Error("Phiếu nhận quà tặng không tồn tại");
      (err as any).statusCode = 404;
      throw err;
    }

    if (claim.status === "fulfilled") {
      const err = new Error("Quà tặng đã được bàn giao trước đó");
      (err as any).statusCode = 409;
      throw err;
    }

    if (claim.status === "revoked") {
      const err = new Error("Phiếu nhận quà đã bị thu hồi");
      (err as any).statusCode = 409;
      throw err;
    }

    const stmts: any[] = [
      this.env.DB.prepare(
        `UPDATE reward_gift_claims
         SET status = 'fulfilled', fulfilled_at = datetime('now'), fulfilled_by = ?, notes = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      ).bind(actorEmail, notes || "Bàn giao quà tại quầy (DEMO)", claim.id),
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"),
      this.env.DB.prepare(
        `INSERT INTO reward_audit_events (
          id, actor, actor_type, action, resource_type, resource_id, payload_json, created_at
        ) VALUES (?, ?, 'admin', 'fulfill_gift_claim', 'reward_gift_claims', ?, ?, datetime('now'))`
      ).bind("aud-" + crypto.randomUUID(), actorEmail, claim.id, JSON.stringify({ claimCode: claim.claim_code }))
    ];

    try {
      await this.env.DB.batch(stmts);
    } catch (e: any) {
      const recheck = await this.env.DB.prepare("SELECT status FROM reward_gift_claims WHERE id = ?").bind(claim.id).first<any>();
      if (recheck?.status === "fulfilled") {
        const err = new Error("Quà tặng đã được bàn giao trước đó");
        (err as any).statusCode = 409;
        throw err;
      }
      throw e;
    }

    return await this.env.DB.prepare("SELECT * FROM reward_gift_claims WHERE id = ?").bind(claim.id).first<any>();
  }

  async revokeGiftClaim(actorEmail: string, claimId: string, reason: string): Promise<any> {
    const claim = await this.env.DB.prepare("SELECT * FROM reward_gift_claims WHERE id = ?").bind(claimId).first<any>();
    if (!claim) throw new Error("Phiếu nhận quà không tồn tại");

    if (claim.status === "fulfilled") {
      const err = new Error("Không thể thu hồi quà tặng đã được bàn giao");
      (err as any).statusCode = 409;
      throw err;
    }

    const stmts: any[] = [
      this.env.DB.prepare(
        `UPDATE reward_gift_claims
         SET status = 'revoked', notes = ?, updated_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      ).bind(reason, claimId),
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"),
      this.env.DB.prepare(
        `INSERT INTO reward_audit_events (
          id, actor, actor_type, action, resource_type, resource_id, payload_json, created_at
        ) VALUES (?, ?, 'admin', 'revoke_gift_claim', 'reward_gift_claims', ?, ?, datetime('now'))`
      ).bind("aud-" + crypto.randomUUID(), actorEmail, claimId, JSON.stringify({ reason }))
    ];

    await this.env.DB.batch(stmts);
    return await this.env.DB.prepare("SELECT * FROM reward_gift_claims WHERE id = ?").bind(claimId).first<any>();
  }

  // ==================== ANALYTICS & EXPORT ====================
  async getRewardAnalytics(): Promise<any> {
    const campaignStats = await this.env.DB.prepare(
      `SELECT
        count(*) as total_campaigns,
        COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) as published_campaigns
       FROM reward_campaigns`
    ).first<any>();

    const walletStats = await this.env.DB.prepare(
      `SELECT
        count(*) as total_issued,
        COALESCE(SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END), 0) as total_redeemed,
        COALESCE(SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END), 0) as total_revoked,
        COALESCE(SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END), 0) as total_expired,
        COUNT(DISTINCT user_id) as unique_voucher_holders
       FROM reward_wallet_items`
    ).first<any>();

    const spinStats = await this.env.DB.prepare(
      `SELECT
        count(*) as total_spins,
        COALESCE(SUM(CASE WHEN result_type != 'no_win' THEN 1 ELSE 0 END), 0) as total_wins,
        COALESCE(SUM(CASE WHEN result_type = 'no_win' THEN 1 ELSE 0 END), 0) as total_no_wins,
        COUNT(DISTINCT user_id) as unique_spinners
       FROM reward_spin_attempts`
    ).first<any>();

    const totalSpins = spinStats?.total_spins || 0;
    const totalWins = spinStats?.total_wins || 0;
    const winRate = totalSpins > 0 ? Math.round((totalWins / totalSpins) * 1000) / 10 : 0;

    const totalIssued = walletStats?.total_issued || 0;
    const totalRedeemed = walletStats?.total_redeemed || 0;
    const redemptionRate = totalIssued > 0 ? Math.round((totalRedeemed / totalIssued) * 1000) / 10 : 0;

    return {
      campaigns: {
        total: campaignStats?.total_campaigns || 0,
        published: campaignStats?.published_campaigns || 0,
      },
      vouchers: {
        totalIssued,
        totalRedeemed,
        totalRevoked: walletStats?.total_revoked || 0,
        totalExpired: walletStats?.total_expired || 0,
        uniqueHolders: walletStats?.unique_voucher_holders || 0,
        redemptionRate,
      },
      spins: {
        totalSpins,
        totalWins,
        totalNoWins: spinStats?.total_no_wins || 0,
        uniqueSpinners: spinStats?.unique_spinners || 0,
        winRate,
      },
    };
  }

  async exportVouchersCsv(): Promise<string> {
    const items = await this.env.DB.prepare(
      `SELECT w.*, u.email as user_email, u.display_name as user_name, c.title as campaign_title
       FROM reward_wallet_items w
       LEFT JOIN users u ON w.user_id = u.id
       LEFT JOIN reward_campaigns c ON w.campaign_id = c.id
       ORDER BY w.issued_at DESC
       LIMIT 5000`
    ).all<any>();

    const sanitizeCsvField = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      // Anti formula injection: escape leading =, +, -, @, \t, \r
      if (/^[=+\-@\t\r]/.test(str)) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    const rows: string[] = [];
    rows.push("BÁO CÁO MÃ ƯU ĐÃI & PHẦN THƯỞNG DU LỊCH ĐẮK SONG (DEMO)");
    rows.push("");
    rows.push(
      [
        "Mã Voucher",
        "Tiêu đề",
        "Ưu đãi",
        "Danh mục",
        "Trạng thái",
        "Chiến dịch",
        "Khách hàng",
        "Email",
        "Nguồn cấp",
        "Ngày cấp",
        "Hạn dùng",
        "Ngày sử dụng",
      ]
        .map(sanitizeCsvField)
        .join(",")
    );

    for (const r of items.results || []) {
      rows.push(
        [
          r.voucher_code,
          r.title,
          r.discount_display,
          r.category,
          r.status,
          r.campaign_title || r.campaign_id || "",
          r.user_name || "",
          r.user_email || "",
          r.source_type,
          r.issued_at,
          r.expires_at,
          r.redeemed_at || "",
        ]
          .map(sanitizeCsvField)
          .join(",")
      );
    }

    // Prepend UTF-8 BOM
    return String.fromCharCode(0xFEFF) + rows.join("\r\n");
  }
}

