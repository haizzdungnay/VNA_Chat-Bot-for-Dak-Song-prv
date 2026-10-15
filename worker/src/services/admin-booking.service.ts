import type {
  Env,
  TourProductRow,
  TourProductPublic,
  TourServiceRow,
  TourServicePublic,
  TourPriceRuleRow,
  TourBookingRow,
  TourBookingItemRow,
  MockPaymentAttemptRow,
  MockPaymentRefundRow,
  BookingStateEventRow,
  RevenueAnalyticsSummary,
  PricingMode,
  TourStatus,
  ServiceCategory,
} from "../types";

export interface CreateTourInput {
  code: string;
  title: string;
  description: string;
  coverImageUrl?: string | null;
  durationDays: number;
  minTravelers?: number;
  maxTravelers?: number;
  basePrice: number;
  status?: TourStatus;
  destinationPlaceIds?: string[];
}

export interface UpdateTourInput {
  title?: string;
  description?: string;
  coverImageUrl?: string | null;
  durationDays?: number;
  minTravelers?: number;
  maxTravelers?: number;
  basePrice?: number;
  status?: TourStatus;
  destinationPlaceIds?: string[];
}

export interface CreateServiceInput {
  code: string;
  name: string;
  category: ServiceCategory;
  description?: string | null;
  providerName?: string | null;
  placeId?: string | null;
  pricingMode: PricingMode;
  unitPrice: number;
}

export interface UpdateServiceInput {
  name?: string;
  category?: ServiceCategory;
  description?: string | null;
  providerName?: string | null;
  placeId?: string | null;
}

/**
 * Helper: Tính toán ranh giới thời gian theo múi giờ kinh doanh Asia/Ho_Chi_Minh (+07:00).
 * Lưu và so sánh theo định dạng UTC ISO.
 */
export function getPeriodBoundsUtc(
  range: "today" | "7d" | "30d" | "all" | "custom",
  startDate?: string,
  endDate?: string
): { startUtc: string | null; endUtc: string | null } {
  if (range === "all") {
    return { startUtc: null, endUtc: null };
  }

  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayVnStr = vnFormatter.format(now); // "YYYY-MM-DD"

  if (range === "today") {
    const startUtc = new Date(`${todayVnStr}T00:00:00+07:00`).toISOString();
    return { startUtc, endUtc: null };
  }

  if (range === "7d") {
    const todayVnDate = new Date(`${todayVnStr}T00:00:00+07:00`);
    const startUtc = new Date(todayVnDate.getTime() - 6 * 24 * 3600 * 1000).toISOString();
    return { startUtc, endUtc: null };
  }

  if (range === "30d") {
    const todayVnDate = new Date(`${todayVnStr}T00:00:00+07:00`);
    const startUtc = new Date(todayVnDate.getTime() - 29 * 24 * 3600 * 1000).toISOString();
    return { startUtc, endUtc: null };
  }

  if (range === "custom") {
    const startUtc = startDate
      ? new Date(`${startDate.slice(0, 10)}T00:00:00+07:00`).toISOString()
      : null;
    const endUtc = endDate
      ? new Date(`${endDate.slice(0, 10)}T23:59:59.999+07:00`).toISOString()
      : null;
    return { startUtc, endUtc };
  }

  return { startUtc: null, endUtc: null };
}

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let s = String(val).trim();
  // Ngăn chặn lỗ hổng CSV Formula Injection trong Excel / Google Sheets
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return `"${s.replace(/"/g, '""')}"`;
}

export class AdminBookingService {
  constructor(private env: Env) {}

  // ==================== TOURS ====================

  async listTours(status?: string, search?: string): Promise<TourProductPublic[]> {
    let sql = "SELECT * FROM tour_products WHERE 1=1";
    const params: any[] = [];

    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    if (search && search.trim()) {
      sql += " AND (code LIKE ? OR title LIKE ? OR description LIKE ?)";
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }

    sql += " ORDER BY created_at DESC";

    const rows = await this.env.DB.prepare(sql).bind(...params).all<TourProductRow>();
    const tours: TourProductPublic[] = [];

    for (const r of rows.results || []) {
      const dests = await this.env.DB.prepare(
        `SELECT p.* FROM tour_product_destinations d
         JOIN places p ON d.place_id = p.id
         WHERE d.tour_id = ?
         ORDER BY d.day_number ASC, d.order_index ASC`
      )
        .bind(r.id)
        .all();

      tours.push({
        id: r.id,
        code: r.code,
        title: r.title,
        description: r.description,
        coverImageUrl: r.cover_image_url,
        durationDays: r.duration_days,
        minTravelers: r.min_travelers,
        maxTravelers: r.max_travelers,
        basePrice: r.base_price,
        status: r.status,
        isDemo: r.is_demo === 1,
        destinations: (dests.results as any) || [],
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      });
    }

    return tours;
  }

  async getTour(id: string): Promise<TourProductPublic | null> {
    const r = await this.env.DB.prepare("SELECT * FROM tour_products WHERE id = ?")
      .bind(id)
      .first<TourProductRow>();

    if (!r) return null;

    const dests = await this.env.DB.prepare(
      `SELECT p.* FROM tour_product_destinations d
       JOIN places p ON d.place_id = p.id
       WHERE d.tour_id = ?
       ORDER BY d.day_number ASC, d.order_index ASC`
    )
      .bind(r.id)
      .all();

    return {
      id: r.id,
      code: r.code,
      title: r.title,
      description: r.description,
      coverImageUrl: r.cover_image_url,
      durationDays: r.duration_days,
      minTravelers: r.min_travelers,
      maxTravelers: r.max_travelers,
      basePrice: r.base_price,
      status: r.status,
      isDemo: r.is_demo === 1,
      destinations: (dests.results as any) || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async createTour(input: CreateTourInput, adminEmail: string): Promise<TourProductPublic> {
    const code = (input.code || "").trim().toUpperCase();
    const title = (input.title || "").trim();
    if (!code || !title) {
      throw new Error("Mã tour và tiêu đề không được để trống.");
    }
    if (!Number.isSafeInteger(input.basePrice) || input.basePrice < 0) {
      throw new Error("Giá tour cơ bản không hợp lệ.");
    }

    const exists = await this.env.DB.prepare("SELECT id FROM tour_products WHERE code = ?")
      .bind(code)
      .first();
    if (exists) {
      throw new Error(`Mã tour "${code}" đã tồn tại.`);
    }

    const id = "tour-" + crypto.randomUUID();
    const now = new Date().toISOString();
    const minTravelers = Math.max(1, input.minTravelers || 1);
    const maxTravelers = Math.max(minTravelers, input.maxTravelers || 20);
    const durationDays = Math.max(1, input.durationDays || 1);
    const status = input.status || "published";

    const statements: any[] = [
      this.env.DB.prepare(
        `INSERT INTO tour_products (id, code, title, description, cover_image_url, duration_days, min_travelers, max_travelers, base_price, status, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(
        id,
        code,
        title,
        input.description || "",
        input.coverImageUrl || null,
        durationDays,
        minTravelers,
        maxTravelers,
        Math.floor(input.basePrice),
        status,
        now,
        now
      ),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'create_tour', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ tourId: id, code, title }),
        now
      ),
    ];

    if (Array.isArray(input.destinationPlaceIds)) {
      let idx = 0;
      for (const pId of input.destinationPlaceIds) {
        statements.push(
          this.env.DB.prepare(
            `INSERT INTO tour_product_destinations (id, tour_id, place_id, day_number, order_index)
             VALUES (?, ?, ?, 1, ?)`
          ).bind("td-" + crypto.randomUUID(), id, pId, idx++)
        );
      }
    }

    await this.env.DB.batch(statements);
    return (await this.getTour(id))!;
  }

  async updateTour(id: string, input: UpdateTourInput, adminEmail: string): Promise<TourProductPublic> {
    const existing = await this.getTour(id);
    if (!existing) {
      throw new Error("Không tìm thấy tour cần cập nhật.");
    }

    const now = new Date().toISOString();
    const title = input.title !== undefined ? input.title.trim() : existing.title;
    const description = input.description !== undefined ? input.description.trim() : existing.description;
    const coverImageUrl = input.coverImageUrl !== undefined ? input.coverImageUrl : existing.coverImageUrl;
    const durationDays = input.durationDays !== undefined ? Math.max(1, input.durationDays) : existing.durationDays;
    const minTravelers = input.minTravelers !== undefined ? Math.max(1, input.minTravelers) : existing.minTravelers;
    const maxTravelers = input.maxTravelers !== undefined ? Math.max(minTravelers, input.maxTravelers) : existing.maxTravelers;
    const basePrice = input.basePrice !== undefined ? Math.max(0, Math.floor(input.basePrice)) : existing.basePrice;
    const status = input.status !== undefined ? input.status : existing.status;

    const statements: any[] = [
      this.env.DB.prepare(
        `UPDATE tour_products
         SET title = ?, description = ?, cover_image_url = ?, duration_days = ?, min_travelers = ?, max_travelers = ?, base_price = ?, status = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        title,
        description,
        coverImageUrl,
        durationDays,
        minTravelers,
        maxTravelers,
        basePrice,
        status,
        now,
        id
      ),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'update_tour', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ tourId: id, title, status }),
        now
      ),
    ];

    if (Array.isArray(input.destinationPlaceIds)) {
      statements.push(
        this.env.DB.prepare("DELETE FROM tour_product_destinations WHERE tour_id = ?").bind(id)
      );
      let idx = 0;
      for (const pId of input.destinationPlaceIds) {
        statements.push(
          this.env.DB.prepare(
            `INSERT INTO tour_product_destinations (id, tour_id, place_id, day_number, order_index)
             VALUES (?, ?, ?, 1, ?)`
          ).bind("td-" + crypto.randomUUID(), id, pId, idx++)
        );
      }
    }

    await this.env.DB.batch(statements);
    return (await this.getTour(id))!;
  }

  async deleteTour(id: string, adminEmail: string): Promise<boolean> {
    const hasBookings = await this.env.DB.prepare(
      "SELECT count(*) as count FROM tour_bookings WHERE tour_id = ?"
    )
      .bind(id)
      .first<{ count: number }>();

    if (hasBookings && hasBookings.count > 0) {
      throw new Error(
        `Không thể xóa tour đã có ${hasBookings.count} đơn đặt. Vui lòng chuyển trạng thái sang "Lưu trữ" (archived).`
      );
    }

    const now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare("DELETE FROM tour_products WHERE id = ?").bind(id),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'delete_tour', ?, ?, ?)`
      ).bind("log-" + crypto.randomUUID(), adminEmail, JSON.stringify({ tourId: id }), now),
    ]);

    return true;
  }

  // ==================== SERVICES & PRICING ====================

  async listServices(category?: string, activeOnly?: boolean): Promise<TourServicePublic[]> {
    let sql = "SELECT * FROM tour_services WHERE 1=1";
    const params: any[] = [];

    if (category && category !== "all") {
      sql += " AND category = ?";
      params.push(category);
    }
    if (activeOnly) {
      sql += " AND is_active = 1";
    }

    sql += " ORDER BY created_at DESC";

    const rows = await this.env.DB.prepare(sql).bind(...params).all<TourServiceRow>();
    const list: TourServicePublic[] = [];

    for (const s of rows.results || []) {
      const priceRule = await this.env.DB.prepare(
        "SELECT * FROM tour_price_rules WHERE service_id = ? AND is_active = 1"
      )
        .bind(s.id)
        .first<TourPriceRuleRow>();

      list.push({
        id: s.id,
        code: s.code,
        name: s.name,
        category: s.category,
        description: s.description,
        providerName: s.provider_name,
        placeId: s.place_id,
        isActive: s.is_active === 1,
        isDemo: s.is_demo === 1,
        pricingRule: priceRule
          ? {
              id: priceRule.id,
              pricingMode: priceRule.pricing_mode,
              unitPrice: priceRule.unit_price,
              currency: priceRule.currency,
            }
          : null,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      });
    }

    return list;
  }

  async createService(input: CreateServiceInput, adminEmail: string): Promise<TourServicePublic> {
    const code = (input.code || "").trim().toUpperCase();
    const name = (input.name || "").trim();
    if (!code || !name) {
      throw new Error("Mã dịch vụ và tên dịch vụ không được để trống.");
    }
    if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0) {
      throw new Error("Đơn giá không hợp lệ.");
    }

    const exists = await this.env.DB.prepare("SELECT id FROM tour_services WHERE code = ?")
      .bind(code)
      .first();
    if (exists) {
      throw new Error(`Mã dịch vụ "${code}" đã tồn tại.`);
    }

    const serviceId = "srv-" + crypto.randomUUID();
    const ruleId = "pr-" + crypto.randomUUID();
    const now = new Date().toISOString();

    const statements: any[] = [
      this.env.DB.prepare(
        `INSERT INTO tour_services (id, code, name, category, description, provider_name, place_id, is_active, is_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`
      ).bind(
        serviceId,
        code,
        name,
        input.category,
        input.description || null,
        input.providerName || "Trung tâm XTTM&DL Đắk Song",
        input.placeId || null,
        now,
        now
      ),
      this.env.DB.prepare(
        `INSERT INTO tour_price_rules (id, service_id, tour_id, pricing_mode, unit_price, currency, is_active, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'VND', 1, ?, ?)`
      ).bind(
        ruleId,
        serviceId,
        input.pricingMode,
        Math.floor(input.unitPrice),
        now,
        now
      ),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'create_service', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ serviceId, code, name, unitPrice: input.unitPrice }),
        now
      ),
    ];

    await this.env.DB.batch(statements);

    const list = await this.listServices();
    return list.find((it) => it.id === serviceId)!;
  }

  async updateService(
    id: string,
    input: UpdateServiceInput,
    adminEmail: string
  ): Promise<TourServicePublic> {
    const existing = await this.env.DB.prepare("SELECT * FROM tour_services WHERE id = ?")
      .bind(id)
      .first<TourServiceRow>();

    if (!existing) {
      throw new Error("Không tìm thấy dịch vụ.");
    }

    const now = new Date().toISOString();
    const name = input.name !== undefined ? input.name.trim() : existing.name;
    const category = input.category !== undefined ? input.category : existing.category;
    const description = input.description !== undefined ? input.description : existing.description;
    const providerName = input.providerName !== undefined ? input.providerName : existing.provider_name;
    const placeId = input.placeId !== undefined ? input.placeId : existing.place_id;

    await this.env.DB.batch([
      this.env.DB.prepare(
        `UPDATE tour_services
         SET name = ?, category = ?, description = ?, provider_name = ?, place_id = ?, updated_at = ?
         WHERE id = ?`
      ).bind(name, category, description, providerName, placeId, now, id),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'update_service', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ serviceId: id, name, category }),
        now
      ),
    ]);

    const list = await this.listServices();
    return list.find((it) => it.id === id)!;
  }

  /**
   * Cập nhật giá dịch vụ: Vô hiệu hóa rule cũ và ghi rule mới.
   * TUYỆT ĐỐI KHÔNG SỬA ĐỔI SNAPSHOT GIÁ CỦA CÁC ĐƠN ĐẶT HOẶC BÁO GIÁ CŨ.
   */
  async updatePriceRule(
    serviceId: string,
    pricingMode: PricingMode,
    unitPrice: number,
    adminEmail: string
  ): Promise<TourServicePublic> {
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      throw new Error("Đơn giá dịch vụ không hợp lệ.");
    }

    const service = await this.env.DB.prepare("SELECT * FROM tour_services WHERE id = ?")
      .bind(serviceId)
      .first<TourServiceRow>();

    if (!service) {
      throw new Error("Không tìm thấy dịch vụ để cấu hình giá.");
    }

    const now = new Date().toISOString();
    const newRuleId = "pr-" + crypto.randomUUID();

    await this.env.DB.batch([
      this.env.DB.prepare(
        "UPDATE tour_price_rules SET is_active = 0, updated_at = ? WHERE service_id = ?"
      ).bind(now, serviceId),
      this.env.DB.prepare(
        `INSERT INTO tour_price_rules (id, service_id, tour_id, pricing_mode, unit_price, currency, is_active, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'VND', 1, ?, ?)`
      ).bind(newRuleId, serviceId, pricingMode, Math.floor(unitPrice), now, now),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'update_price_rule', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ serviceId, pricingMode, unitPrice }),
        now
      ),
    ]);

    const list = await this.listServices();
    return list.find((it) => it.id === serviceId)!;
  }

  async toggleServiceActive(id: string, isActive: boolean, adminEmail: string): Promise<boolean> {
    const now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        "UPDATE tour_services SET is_active = ?, updated_at = ? WHERE id = ?"
      ).bind(isActive ? 1 : 0, now, id),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'toggle_service', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ serviceId: id, isActive }),
        now
      ),
    ]);
    return true;
  }

  // ==================== BOOKING MANAGEMENT ====================

  async listBookings(filter: {
    bookingStatus?: string;
    paymentStatus?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: TourBookingRow[]; total: number }> {
    let sql = "SELECT * FROM tour_bookings WHERE 1=1";
    let countSql = "SELECT count(*) as total FROM tour_bookings WHERE 1=1";
    const params: any[] = [];
    const countParams: any[] = [];

    if (filter.bookingStatus && filter.bookingStatus !== "all") {
      sql += " AND booking_status = ?";
      countSql += " AND booking_status = ?";
      params.push(filter.bookingStatus);
      countParams.push(filter.bookingStatus);
    }

    if (filter.paymentStatus && filter.paymentStatus !== "all") {
      sql += " AND payment_status = ?";
      countSql += " AND payment_status = ?";
      params.push(filter.paymentStatus);
      countParams.push(filter.paymentStatus);
    }

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim()}%`;
      sql += " AND (booking_reference LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)";
      countSql += " AND (booking_reference LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)";
      params.push(q, q, q);
      countParams.push(q, q, q);
    }

    if (filter.dateFrom) {
      sql += " AND created_at >= ?";
      countSql += " AND created_at >= ?";
      params.push(filter.dateFrom);
      countParams.push(filter.dateFrom);
    }

    if (filter.dateTo) {
      sql += " AND created_at <= ?";
      countSql += " AND created_at <= ?";
      params.push(filter.dateTo);
      countParams.push(filter.dateTo);
    }

    sql += " ORDER BY created_at DESC";

    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = Math.max(0, filter.offset || 0);
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const countRes = await this.env.DB.prepare(countSql).bind(...countParams).first<{ total: number }>();
    const rows = await this.env.DB.prepare(sql).bind(...params).all<TourBookingRow>();

    return {
      items: rows.results || [],
      total: countRes?.total || 0,
    };
  }

  async getBookingDetail(id: string): Promise<{
    booking: TourBookingRow;
    items: TourBookingItemRow[];
    paymentAttempts: MockPaymentAttemptRow[];
    refunds: MockPaymentRefundRow[];
    events: BookingStateEventRow[];
  } | null> {
    const booking = await this.env.DB.prepare(
      "SELECT * FROM tour_bookings WHERE id = ? OR booking_reference = ?"
    )
      .bind(id, id)
      .first<TourBookingRow>();

    if (!booking) return null;

    const items = await this.env.DB.prepare(
      "SELECT * FROM tour_booking_items WHERE booking_id = ?"
    )
      .bind(booking.id)
      .all<TourBookingItemRow>();

    const payments = await this.env.DB.prepare(
      "SELECT * FROM mock_payment_attempts WHERE booking_id = ? ORDER BY created_at DESC"
    )
      .bind(booking.id)
      .all<MockPaymentAttemptRow>();

    const refunds = await this.env.DB.prepare(
      "SELECT * FROM mock_payment_refunds WHERE booking_id = ? ORDER BY created_at DESC"
    )
      .bind(booking.id)
      .all<MockPaymentRefundRow>();

    const events = await this.env.DB.prepare(
      "SELECT * FROM booking_state_events WHERE booking_id = ? ORDER BY created_at ASC"
    )
      .bind(booking.id)
      .all<BookingStateEventRow>();

    return {
      booking,
      items: items.results || [],
      paymentAttempts: payments.results || [],
      refunds: refunds.results || [],
      events: events.results || [],
    };
  }

  /**
   * Ban quản trị hủy đơn:
   * TUYỆT ĐỐI CHẶN HỦY TRỰC TIẾP ĐƠN ĐÃ THANH TOÁN (PHẢI REFUND QUA POLICY)
   */
  async adminCancelBooking(id: string, adminEmail: string, reason?: string): Promise<TourBookingRow> {
    const detail = await this.getBookingDetail(id);
    if (!detail) {
      const err = new Error("Không tìm thấy đơn đặt.");
      (err as any).status = 404;
      throw err;
    }
    const b = detail.booking;

    if (b.payment_status === "paid") {
      const err = new Error(
        "Không thể hủy trực tiếp đơn hàng đã thanh toán. Vui lòng thực hiện hoàn tiền (refund) theo quy trình."
      );
      (err as any).status = 409;
      throw err;
    }

    if (b.booking_status === "cancelled") {
      const err = new Error("Đơn đặt đã bị hủy trước đó.");
      (err as any).status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const statements: any[] = [
      this.env.DB.prepare(
        "UPDATE tour_bookings SET booking_status = 'cancelled', updated_at = ? WHERE id = ? AND booking_status != 'cancelled' AND payment_status != 'paid'"
      ).bind(now, b.id),
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare(
        `INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
         VALUES (?, ?, 'cancelled', ?, 'cancelled', ?, ?, ?)`
      ).bind(
        "ev-" + crypto.randomUUID(),
        b.id,
        b.booking_status,
        adminEmail,
        reason || "Ban quản trị hủy đơn",
        now
      ),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'admin_cancel_booking', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ bookingId: b.id, bookingReference: b.booking_reference, reason }),
        now
      ),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"),
    ];

    try {
      await this.env.DB.batch(statements);
    } catch {
      const err = new Error("Không thể hủy đơn đặt do trạng thái đã thay đổi đồng thời.");
      (err as any).status = 409;
      throw err;
    }

    b.booking_status = "cancelled";
    b.updated_at = now;
    return b;
  }

  /**
   * Ban quản trị hoàn tiền mô phỏng (Mock Refund):
   * Ghi vào sổ cái bất biến mock_payment_refunds, chặn double refund bằng CAS và UNIQUE index.
   */
  async adminMockRefund(id: string, adminEmail: string, reason?: string): Promise<TourBookingRow> {
    const detail = await this.getBookingDetail(id);
    if (!detail) {
      const err = new Error("Không tìm thấy đơn đặt.");
      (err as any).status = 404;
      throw err;
    }
    const b = detail.booking;

    if (b.payment_status !== "paid") {
      const err = new Error("Chỉ có thể hoàn tiền mô phỏng cho đơn đặt đã thanh toán thành công.");
      (err as any).status = 409;
      throw err;
    }

    const successfulTx = detail.paymentAttempts.find((p) => p.status === "success");
    if (!successfulTx) {
      const err = new Error("Không tìm thấy giao dịch thanh toán thành công để hoàn tiền.");
      (err as any).status = 409;
      throw err;
    }

    // Kiểm tra xem giao dịch đã được ghi nhận hoàn tiền trong ledger chưa
    const existingRefund = await this.env.DB.prepare(
      "SELECT id FROM mock_payment_refunds WHERE payment_attempt_id = ?"
    )
      .bind(successfulTx.id)
      .first<{ id: string }>();

    if (existingRefund) {
      const err = new Error("Giao dịch thanh toán này đã được hoàn tiền trước đó.");
      (err as any).status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const refundId = "rf-" + crypto.randomUUID();

    const statements: any[] = [
      this.env.DB.prepare(
        "UPDATE tour_bookings SET payment_status = 'refunded', booking_status = 'cancelled', updated_at = ? WHERE id = ? AND payment_status = 'paid' AND booking_status != 'cancelled'"
      ).bind(now, b.id),
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())"),
      this.env.DB.prepare(
        `INSERT INTO mock_payment_refunds (id, payment_attempt_id, booking_id, amount, currency, reason, actor, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, 'VND', ?, ?, NULL, ?)`
      ).bind(
        refundId,
        successfulTx.id,
        b.id,
        successfulTx.amount,
        reason || "Hoàn tiền mô phỏng từ ban quản trị",
        adminEmail,
        now
      ),
      this.env.DB.prepare(
        "UPDATE mock_payment_attempts SET refunded_amount = amount WHERE id = ?"
      ).bind(successfulTx.id),
      this.env.DB.prepare(
        `INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
         VALUES (?, ?, 'refunded', 'paid', 'refunded', ?, ?, ?)`
      ).bind(
        "ev-" + crypto.randomUUID(),
        b.id,
        adminEmail,
        reason || "Hoàn tiền mô phỏng từ ban quản trị",
        now
      ),
      this.env.DB.prepare(
        `INSERT INTO admin_audit_logs (id, action, actor, details_json, created_at)
         VALUES (?, 'admin_mock_refund', ?, ?, ?)`
      ).bind(
        "log-" + crypto.randomUUID(),
        adminEmail,
        JSON.stringify({ bookingId: b.id, bookingReference: b.booking_reference, reason, refundId }),
        now
      ),
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1"),
    ];

    try {
      await this.env.DB.batch(statements);
    } catch (batchErr: any) {
      const msg = String(batchErr?.message || "");
      if (
        msg.includes("CHECK constraint failed") ||
        msg.includes("UNIQUE constraint failed") ||
        msg.includes("conflict")
      ) {
        const conflictErr = new Error("Đơn hàng đã được hoàn tiền hoặc xung đột trạng thái.");
        (conflictErr as any).status = 409;
        throw conflictErr;
      }
      throw batchErr;
    }

    b.payment_status = "refunded";
    b.booking_status = "cancelled";
    b.updated_at = now;
    return b;
  }

  // ==================== REVENUE ANALYTICS ====================

  /**
   * Tính toán doanh thu mô phỏng trung thực từ các bản ghi D1.
   * Ngữ nghĩa thời gian: Asia/Ho_Chi_Minh (+07:00).
   * - Booking KPIs: Theo ngày tạo booking (tour_bookings.created_at).
   * - Gross revenue: Theo ngày thanh toán thành công (mock_payment_attempts.created_at).
   * - Refund amount: Theo ngày hoàn tiền (mock_payment_refunds.created_at).
   * - Net revenue: Gross - Refund (có thể âm nếu kỳ hiện tại hoàn tiền cho kỳ trước).
   */
  async getRevenueAnalytics(
    range: "today" | "7d" | "30d" | "all" | "custom",
    startDate?: string,
    endDate?: string
  ): Promise<RevenueAnalyticsSummary> {
    const { startUtc, endUtc } = getPeriodBoundsUtc(range, startDate, endDate);

    // 1. Bộ lọc cho tour_bookings
    let bookingFilterSql = "";
    const bookingParams: any[] = [];
    if (startUtc) {
      bookingFilterSql += " AND created_at >= ?";
      bookingParams.push(startUtc);
    }
    if (endUtc) {
      bookingFilterSql += " AND created_at <= ?";
      bookingParams.push(endUtc);
    }

    // 2. Bộ lọc cho mock_payment_attempts (thời điểm thanh toán)
    let paymentFilterSql = "";
    const paymentParams: any[] = [];
    if (startUtc) {
      paymentFilterSql += " AND created_at >= ?";
      paymentParams.push(startUtc);
    }
    if (endUtc) {
      paymentFilterSql += " AND created_at <= ?";
      paymentParams.push(endUtc);
    }

    // 3. Bộ lọc cho mock_payment_refunds (thời điểm hoàn tiền)
    let refundFilterSql = "";
    const refundParams: any[] = [];
    if (startUtc) {
      refundFilterSql += " AND created_at >= ?";
      refundParams.push(startUtc);
    }
    if (endUtc) {
      refundFilterSql += " AND created_at <= ?";
      refundParams.push(endUtc);
    }

    // 1. Bookings counts by status (theo created_at của booking)
    const bookingCounts = await this.env.DB.prepare(
      `SELECT
         COUNT(*) as total_bookings,
         SUM(CASE WHEN booking_status = 'pending' THEN 1 ELSE 0 END) as pending_bookings,
         SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as successful_bookings,
         SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings
       FROM tour_bookings
       WHERE 1=1 ${bookingFilterSql}`
    )
      .bind(...bookingParams)
      .first<{
        total_bookings: number;
        pending_bookings: number;
        successful_bookings: number;
        cancelled_bookings: number;
      }>();

    // 2. Gross revenue & Payment KPIs (dựa trên mock_payment_attempts.created_at)
    const grossRes = await this.env.DB.prepare(
      `SELECT
         COALESCE(SUM(amount), 0) as gross_revenue,
         COUNT(*) as success_count
       FROM mock_payment_attempts
       WHERE status = 'success' ${paymentFilterSql}`
    )
      .bind(...paymentParams)
      .first<{ gross_revenue: number; success_count: number }>();

    // 3. Failed payment attempts trong kỳ
    const failedTxCount = await this.env.DB.prepare(
      `SELECT COUNT(*) as failed_count
       FROM mock_payment_attempts
       WHERE status = 'failed' ${paymentFilterSql}`
    )
      .bind(...paymentParams)
      .first<{ failed_count: number }>();

    // 4. Refund amount từ mock_payment_refunds (dựa trên mock_payment_refunds.created_at)
    const refundRes = await this.env.DB.prepare(
      `SELECT
         COALESCE(SUM(amount), 0) as refund_total,
         COUNT(*) as refund_count
       FROM mock_payment_refunds
       WHERE 1=1 ${refundFilterSql}`
    )
      .bind(...refundParams)
      .first<{ refund_total: number; refund_count: number }>();

    const gross = grossRes?.gross_revenue || 0;
    const refunded = refundRes?.refund_total || 0;
    // Không dùng Math.max(0, ...), net revenue có thể âm khi hoàn tiền nhiều hơn thu trong kỳ
    const net = gross - refunded;
    const successPaymentsCount = grossRes?.success_count || 0;
    const avgBookingValue = successPaymentsCount > 0 ? Math.round(gross / successPaymentsCount) : 0;

    // 5. Daily revenue trend (Gộp ngày theo giờ Việt Nam Asia/Ho_Chi_Minh: UTC + 7 tiếng)
    const dailyPayments = await this.env.DB.prepare(
      `SELECT
         substr(datetime(created_at, '+7 hours'), 1, 10) as date_str,
         SUM(amount) as gross_amount
       FROM mock_payment_attempts
       WHERE status = 'success' ${paymentFilterSql}
       GROUP BY date_str`
    )
      .bind(...paymentParams)
      .all<{ date_str: string; gross_amount: number }>();

    const dailyRefunds = await this.env.DB.prepare(
      `SELECT
         substr(datetime(created_at, '+7 hours'), 1, 10) as date_str,
         SUM(amount) as refund_amount
       FROM mock_payment_refunds
       WHERE 1=1 ${refundFilterSql}
       GROUP BY date_str`
    )
      .bind(...refundParams)
      .all<{ date_str: string; refund_amount: number }>();

    const dailyBookings = await this.env.DB.prepare(
      `SELECT
         substr(datetime(created_at, '+7 hours'), 1, 10) as date_str,
         COUNT(*) as bookings_count
       FROM tour_bookings
       WHERE 1=1 ${bookingFilterSql}
       GROUP BY date_str`
    )
      .bind(...bookingParams)
      .all<{ date_str: string; bookings_count: number }>();

    const dateMap = new Map<string, { revenue: number; bookingsCount: number }>();

    for (const r of dailyBookings.results || []) {
      if (r.date_str) {
        dateMap.set(r.date_str, { revenue: 0, bookingsCount: r.bookings_count || 0 });
      }
    }

    for (const p of dailyPayments.results || []) {
      if (p.date_str) {
        const entry = dateMap.get(p.date_str) || { revenue: 0, bookingsCount: 0 };
        entry.revenue += p.gross_amount || 0;
        dateMap.set(p.date_str, entry);
      }
    }

    for (const rf of dailyRefunds.results || []) {
      if (rf.date_str) {
        const entry = dateMap.get(rf.date_str) || { revenue: 0, bookingsCount: 0 };
        entry.revenue -= rf.refund_amount || 0;
        dateMap.set(rf.date_str, entry);
      }
    }

    const sortedDates = Array.from(dateMap.keys()).sort();
    const dailyTrends = sortedDates.map((d) => ({
      date: d,
      revenue: dateMap.get(d)!.revenue,
      bookingsCount: dateMap.get(d)!.bookingsCount,
    }));

    // 6. Category distribution
    const catRows = await this.env.DB.prepare(
      `SELECT
         bi.category,
         COUNT(*) as item_count,
         COALESCE(SUM(bi.line_total), 0) as cat_amount
       FROM tour_booking_items bi
       JOIN tour_bookings b ON bi.booking_id = b.id
       WHERE b.payment_status = 'paid' ${bookingFilterSql.replace(/created_at/g, 'b.created_at')}
       GROUP BY bi.category
       ORDER BY cat_amount DESC`
    )
      .bind(...bookingParams)
      .all<{ category: string; item_count: number; cat_amount: number }>();

    // 7. Top booked products
    const topRows = await this.env.DB.prepare(
      `SELECT
         bi.item_name as name,
         CASE WHEN bi.category = 'tour_package' THEN 'tour' ELSE 'service' END as prod_type,
         SUM(bi.quantity) as booked_count,
         SUM(bi.line_total) as prod_revenue
       FROM tour_booking_items bi
       JOIN tour_bookings b ON bi.booking_id = b.id
       WHERE b.payment_status = 'paid' ${bookingFilterSql.replace(/created_at/g, 'b.created_at')}
       GROUP BY bi.item_name, prod_type
       ORDER BY prod_revenue DESC
       LIMIT 5`
    )
      .bind(...bookingParams)
      .all<{ name: string; prod_type: "tour" | "service"; booked_count: number; prod_revenue: number }>();

    return {
      totalBookings: bookingCounts?.total_bookings || 0,
      pendingBookings: bookingCounts?.pending_bookings || 0,
      successfulBookings: bookingCounts?.successful_bookings || 0,
      failedPaymentAttempts: failedTxCount?.failed_count || 0,
      cancelledBookings: bookingCounts?.cancelled_bookings || 0,
      grossSimulatedRevenue: gross,
      simulatedRefundedAmount: refunded,
      netSimulatedRevenue: net,
      averageBookingValue: avgBookingValue,
      dailyTrends,
      categoryDistribution: (catRows.results || []).map((r) => ({
        category: r.category,
        count: r.item_count,
        totalAmount: r.cat_amount,
      })),
      statusDistribution: [
        { status: "pending", count: bookingCounts?.pending_bookings || 0 },
        { status: "confirmed", count: bookingCounts?.successful_bookings || 0 },
        { status: "cancelled", count: bookingCounts?.cancelled_bookings || 0 },
      ],
      topProducts: (topRows.results || []).map((r) => ({
        name: r.name,
        type: r.prod_type,
        bookedCount: r.booked_count,
        revenue: r.prod_revenue,
      })),
    };
  }

  /**
   * Xuất báo cáo CSV giao dịch tài chính mô phỏng (hỗ trợ tiếng Việt UTF-8 BOM cho Excel).
   * Đồng bộ 100% bộ lọc thời gian và đối soát chuẩn xác với KPI Net Revenue.
   */
  async exportRevenueCsv(
    range: "today" | "7d" | "30d" | "all" | "custom",
    startDate?: string,
    endDate?: string
  ): Promise<string> {
    const { startUtc, endUtc } = getPeriodBoundsUtc(range, startDate, endDate);

    let pFilterSql = "";
    const pParams: any[] = [];
    if (startUtc) {
      pFilterSql += " AND p.created_at >= ?";
      pParams.push(startUtc);
    }
    if (endUtc) {
      pFilterSql += " AND p.created_at <= ?";
      pParams.push(endUtc);
    }

    let rFilterSql = "";
    const rParams: any[] = [];
    if (startUtc) {
      rFilterSql += " AND r.created_at >= ?";
      rParams.push(startUtc);
    }
    if (endUtc) {
      rFilterSql += " AND r.created_at <= ?";
      rParams.push(endUtc);
    }

    // Lấy tất cả giao dịch thanh toán thành công trong kỳ
    const payments = await this.env.DB.prepare(
      `SELECT
         p.transaction_reference as tx_ref,
         b.booking_reference as booking_ref,
         'Thanh toán mô phỏng' as tx_type,
         p.amount as amount,
         p.amount as net_contribution,
         datetime(p.created_at, '+7 hours') as vn_time,
         b.customer_name as customer_name,
         b.customer_phone as customer_phone,
         'Thành công' as status_desc,
         '' as notes,
         p.created_at as sort_time
       FROM mock_payment_attempts p
       JOIN tour_bookings b ON p.booking_id = b.id
       WHERE p.status = 'success' ${pFilterSql}`
    )
      .bind(...pParams)
      .all<any>();

    // Lấy tất cả giao dịch hoàn tiền trong kỳ
    const refunds = await this.env.DB.prepare(
      `SELECT
         r.id as tx_ref,
         b.booking_reference as booking_ref,
         'Hoàn tiền mô phỏng' as tx_type,
         r.amount as amount,
         (0 - r.amount) as net_contribution,
         datetime(r.created_at, '+7 hours') as vn_time,
         b.customer_name as customer_name,
         b.customer_phone as customer_phone,
         'Đã hoàn tiền' as status_desc,
         COALESCE(r.reason, '') as notes,
         r.created_at as sort_time
       FROM mock_payment_refunds r
       JOIN tour_bookings b ON r.booking_id = b.id
       WHERE 1=1 ${rFilterSql}`
    )
      .bind(...rParams)
      .all<any>();

    const allTx = [...(payments.results || []), ...(refunds.results || [])];
    allTx.sort((a, b) => (a.sort_time < b.sort_time ? 1 : -1));

    const header = [
      "Mã đơn hàng",
      "Khách hàng",
      "Số điện thoại",
      "Mã giao dịch",
      "Loại giao dịch",
      "Số tiền (VND)",
      "Đóng góp doanh thu thuần (VND)",
      "Thời gian (Giờ VN)",
      "Trạng thái",
      "Ghi chú",
    ].join(",");

    const lines = allTx.map((tx) =>
      [
        escapeCsvCell(tx.booking_ref),
        escapeCsvCell(tx.customer_name),
        escapeCsvCell(tx.customer_phone),
        escapeCsvCell(tx.tx_ref),
        escapeCsvCell(tx.tx_type),
        tx.amount,
        tx.net_contribution,
        escapeCsvCell(tx.vn_time),
        escapeCsvCell(tx.status_desc),
        escapeCsvCell(tx.notes),
      ].join(",")
    );

    // Thêm UTF-8 BOM (﻿) để Microsoft Excel hiển thị tiếng Việt chính xác không lỗi font
    return "\uFEFF" + [header, ...lines].join("\r\n");
  }
}
