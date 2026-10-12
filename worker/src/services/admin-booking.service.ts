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
      // destinations
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
    if (input.basePrice < 0) {
      throw new Error("Giá tour cơ bản không được âm.");
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
    if (input.unitPrice < 0) {
      throw new Error("Đơn giá không được âm.");
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
    if (unitPrice < 0) {
      throw new Error("Đơn giá dịch vụ không được âm.");
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
      // 1. Tắt rule cũ
      this.env.DB.prepare(
        "UPDATE tour_price_rules SET is_active = 0, updated_at = ? WHERE service_id = ?"
      ).bind(now, serviceId),
      // 2. Thêm rule mới
      this.env.DB.prepare(
        `INSERT INTO tour_price_rules (id, service_id, tour_id, pricing_mode, unit_price, currency, is_active, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, 'VND', 1, ?, ?)`
      ).bind(newRuleId, serviceId, pricingMode, Math.floor(unitPrice), now, now),
      // 3. Audit log
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

    const events = await this.env.DB.prepare(
      "SELECT * FROM booking_state_events WHERE booking_id = ? ORDER BY created_at ASC"
    )
      .bind(booking.id)
      .all<BookingStateEventRow>();

    return {
      booking,
      items: items.results || [],
      paymentAttempts: payments.results || [],
      events: events.results || [],
    };
  }

  async adminCancelBooking(id: string, adminEmail: string, reason?: string): Promise<TourBookingRow> {
    const detail = await this.getBookingDetail(id);
    if (!detail) {
      throw new Error("Không tìm thấy đơn đặt.");
    }
    const b = detail.booking;
    if (b.booking_status === "cancelled") {
      throw new Error("Đơn đặt đã bị hủy trước đó.");
    }

    const now = new Date().toISOString();
    await this.env.DB.batch([
      this.env.DB.prepare(
        "UPDATE tour_bookings SET booking_status = 'cancelled', updated_at = ? WHERE id = ?"
      ).bind(now, b.id),
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
    ]);

    b.booking_status = "cancelled";
    b.updated_at = now;
    return b;
  }

  async adminMockRefund(id: string, adminEmail: string, reason?: string): Promise<TourBookingRow> {
    const detail = await this.getBookingDetail(id);
    if (!detail) {
      throw new Error("Không tìm thấy đơn đặt.");
    }
    const b = detail.booking;
    if (b.payment_status !== "paid") {
      throw new Error("Chỉ có thể hoàn tiền mô phỏng cho đơn đặt đã thanh toán thành công.");
    }

    const now = new Date().toISOString();
    const successfulTx = detail.paymentAttempts.find((p) => p.status === "success");

    const statements: any[] = [
      this.env.DB.prepare(
        "UPDATE tour_bookings SET payment_status = 'refunded', booking_status = 'cancelled', updated_at = ? WHERE id = ?"
      ).bind(now, b.id),
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
        JSON.stringify({ bookingId: b.id, bookingReference: b.booking_reference, reason }),
        now
      ),
    ];

    if (successfulTx) {
      statements.push(
        this.env.DB.prepare(
          "UPDATE mock_payment_attempts SET refunded_amount = amount WHERE id = ?"
        ).bind(successfulTx.id)
      );
    }

    await this.env.DB.batch(statements);

    b.payment_status = "refunded";
    b.booking_status = "cancelled";
    b.updated_at = now;
    return b;
  }

  // ==================== REVENUE ANALYTICS ====================

  /**
   * Tính toán doanh thu mô phỏng trung thực từ các bản ghi D1.
   * Asia/Ho_Chi_Minh (+07:00).
   */
  async getRevenueAnalytics(
    range: "today" | "7d" | "30d" | "all" | "custom",
    startDate?: string,
    endDate?: string
  ): Promise<RevenueAnalyticsSummary> {
    let dateFilterSql = "";
    const params: any[] = [];

    const now = new Date();
    // Helper to format ISO date string in UTC
    if (range === "today") {
      // Start of today in UTC+7 is yesterday 17:00 UTC
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      startOfDay.setTime(startOfDay.getTime() - 7 * 3600 * 1000);
      dateFilterSql = " AND b.created_at >= ?";
      params.push(startOfDay.toISOString());
    } else if (range === "7d") {
      const past7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      dateFilterSql = " AND b.created_at >= ?";
      params.push(past7.toISOString());
    } else if (range === "30d") {
      const past30 = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      dateFilterSql = " AND b.created_at >= ?";
      params.push(past30.toISOString());
    } else if (range === "custom") {
      if (startDate) {
        dateFilterSql += " AND b.created_at >= ?";
        params.push(startDate);
      }
      if (endDate) {
        dateFilterSql += " AND b.created_at <= ?";
        params.push(endDate);
      }
    }

    // 1. Bookings counts by status
    const bookingCounts = await this.env.DB.prepare(
      `SELECT
         COUNT(*) as total_bookings,
         SUM(CASE WHEN booking_status = 'pending' THEN 1 ELSE 0 END) as pending_bookings,
         SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as successful_bookings,
         SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings
       FROM tour_bookings b
       WHERE 1=1 ${dateFilterSql}`
    )
      .bind(...params)
      .first<{
        total_bookings: number;
        pending_bookings: number;
        successful_bookings: number;
        cancelled_bookings: number;
      }>();

    // 2. Failed payment attempts
    const failedTxCount = await this.env.DB.prepare(
      `SELECT COUNT(*) as failed_count
       FROM mock_payment_attempts p
       JOIN tour_bookings b ON p.booking_id = b.id
       WHERE p.status = 'failed' ${dateFilterSql}`
    )
      .bind(...params)
      .first<{ failed_count: number }>();

    // 3. Gross revenue & refunded amount derived strictly from mock_payment_attempts
    const revenueSum = await this.env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount ELSE 0 END), 0) as gross_revenue,
         COALESCE(SUM(p.refunded_amount), 0) as refunded_amount
       FROM mock_payment_attempts p
       JOIN tour_bookings b ON p.booking_id = b.id
       WHERE 1=1 ${dateFilterSql}`
    )
      .bind(...params)
      .first<{ gross_revenue: number; refunded_amount: number }>();

    const gross = revenueSum?.gross_revenue || 0;
    const refunded = revenueSum?.refunded_amount || 0;
    const net = Math.max(0, gross - refunded);
    const successfulCount = bookingCounts?.successful_bookings || 0;
    const avgBookingValue = successfulCount > 0 ? Math.round(gross / successfulCount) : 0;

    // 4. Daily revenue trend
    const dailyRows = await this.env.DB.prepare(
      `SELECT
         substr(b.created_at, 1, 10) as date_str,
         COALESCE(SUM(CASE WHEN p.status = 'success' THEN p.amount - p.refunded_amount ELSE 0 END), 0) as daily_revenue,
         COUNT(DISTINCT b.id) as daily_bookings
       FROM tour_bookings b
       LEFT JOIN mock_payment_attempts p ON b.id = p.booking_id
       WHERE 1=1 ${dateFilterSql}
       GROUP BY date_str
       ORDER BY date_str ASC`
    )
      .bind(...params)
      .all<{ date_str: string; daily_revenue: number; daily_bookings: number }>();

    // 5. Category distribution
    const catRows = await this.env.DB.prepare(
      `SELECT
         bi.category,
         COUNT(*) as item_count,
         COALESCE(SUM(bi.line_total), 0) as cat_amount
       FROM tour_booking_items bi
       JOIN tour_bookings b ON bi.booking_id = b.id
       WHERE b.payment_status = 'paid' ${dateFilterSql}
       GROUP BY bi.category
       ORDER BY cat_amount DESC`
    )
      .bind(...params)
      .all<{ category: string; item_count: number; cat_amount: number }>();

    // 6. Top booked products
    const topRows = await this.env.DB.prepare(
      `SELECT
         bi.item_name as name,
         CASE WHEN bi.category = 'tour_package' THEN 'tour' ELSE 'service' END as prod_type,
         SUM(bi.quantity) as booked_count,
         SUM(bi.line_total) as prod_revenue
       FROM tour_booking_items bi
       JOIN tour_bookings b ON bi.booking_id = b.id
       WHERE b.payment_status = 'paid' ${dateFilterSql}
       GROUP BY bi.item_name, prod_type
       ORDER BY prod_revenue DESC
       LIMIT 5`
    )
      .bind(...params)
      .all<{ name: string; prod_type: "tour" | "service"; booked_count: number; prod_revenue: number }>();

    return {
      totalBookings: bookingCounts?.total_bookings || 0,
      pendingBookings: bookingCounts?.pending_bookings || 0,
      successfulBookings: successfulCount,
      failedPaymentAttempts: failedTxCount?.failed_count || 0,
      cancelledBookings: bookingCounts?.cancelled_bookings || 0,
      grossSimulatedRevenue: gross,
      simulatedRefundedAmount: refunded,
      netSimulatedRevenue: net,
      averageBookingValue: avgBookingValue,
      dailyTrends: (dailyRows.results || []).map((r) => ({
        date: r.date_str,
        revenue: r.daily_revenue,
        bookingsCount: r.daily_bookings,
      })),
      categoryDistribution: (catRows.results || []).map((r) => ({
        category: r.category,
        count: r.item_count,
        totalAmount: r.cat_amount,
      })),
      statusDistribution: [
        { status: "pending", count: bookingCounts?.pending_bookings || 0 },
        { status: "confirmed", count: successfulCount },
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
   * Xuất báo cáo CSV giao dịch mô phỏng (hỗ trợ tiếng Việt UTF-8 BOM cho Excel).
   */
  async exportRevenueCsv(
    range: "today" | "7d" | "30d" | "all" | "custom",
    startDate?: string,
    endDate?: string
  ): Promise<string> {
    const listRes = await this.listBookings({
      dateFrom: startDate,
      dateTo: endDate,
      limit: 1000,
    });

    const escapeCsv = (str: string) => {
      if (!str) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const header = [
      "Mã đơn hàng",
      "Khách hàng",
      "Số điện thoại",
      "Email",
      "Số người lớn",
      "Số trẻ em",
      "Tổng tiền (VND)",
      "Trạng thái đơn",
      "Trạng thái thanh toán",
      "Thời gian tạo",
    ].join(",");

    const lines = listRes.items.map((b) =>
      [
        escapeCsv(b.booking_reference),
        escapeCsv(b.customer_name),
        escapeCsv(b.customer_phone),
        escapeCsv(b.customer_email || ""),
        b.adults_count,
        b.children_count,
        b.total_amount,
        escapeCsv(b.booking_status),
        escapeCsv(b.payment_status),
        escapeCsv(b.created_at),
      ].join(",")
    );

    // Thêm UTF-8 BOM để Excel hiển thị tiếng Việt không bị lỗi font
    return "\uFEFF" + [header, ...lines].join("\r\n");
  }
}
