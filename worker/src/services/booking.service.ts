import type {
  Env,
  TourProductRow,
  TourServiceRow,
  TourPriceRuleRow,
  BookingQuoteRow,
  BookingQuoteItemRow,
  TourBookingRow,
  TourBookingItemRow,
  MockPaymentAttemptRow,
  BookingStateEventRow,
  PricingMode,
  PaymentMethod,
} from "../types";

export interface CalculateQuoteInput {
  userId: string;
  tourId?: string | null;
  itineraryId?: string | null;
  selectedServiceIds?: string[];
  adultsCount: number;
  childrenCount: number;
  durationDays?: number;
}

export interface CreateBookingInput {
  userId: string;
  quoteReference: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface MockPaymentInput {
  userId: string;
  bookingId: string;
  paymentMethod: PaymentMethod;
  simulateStatus: "success" | "failed";
  idempotencyKey?: string | null;
}

export class BookingService {
  constructor(private env: Env) {}

  /**
   * Tính báo giá chuẩn hóa từ máy chủ (Server-authoritative pricing).
   * Tuyệt đối không tin tưởng giá từ client hoặc AI.
   */
  async calculateQuote(input: CalculateQuoteInput): Promise<{
    quote: BookingQuoteRow;
    items: BookingQuoteItemRow[];
  }> {
    const adults = Math.floor(Number(input.adultsCount) || 0);
    const children = Math.floor(Number(input.childrenCount) || 0);

    if (adults < 1) {
      throw new Error("Số lượng người lớn tối thiểu là 1.");
    }
    if (children < 0) {
      throw new Error("Số lượng trẻ em không được âm.");
    }
    const totalTravelers = adults + children;
    if (totalTravelers > 50) {
      throw new Error("Đoàn vượt quá giới hạn tối đa 50 người.");
    }

    let durationDays = Math.max(1, Math.floor(Number(input.durationDays) || 1));
    let itinVersion: number | null = null;
    let tourRow: TourProductRow | null = null;

    // 1. Kiểm tra quyền sở hữu lịch trình nếu báo giá gắn với itinerary
    if (input.itineraryId) {
      const itin = await this.env.DB.prepare(
        "SELECT id, user_id, duration_days, version FROM travel_itineraries WHERE id = ?"
      )
        .bind(input.itineraryId)
        .first<{ id: string; user_id: string; duration_days: number; version: number }>();

      if (!itin) {
        throw new Error("Không tìm thấy lịch trình được chỉ định.");
      }
      if (itin.user_id !== input.userId) {
        throw new Error("Bạn không có quyền lập báo giá cho lịch trình của người dùng khác.");
      }
      durationDays = itin.duration_days;
      itinVersion = itin.version;
    }

    // 2. Kiểm tra Tour sản phẩm nếu có
    if (input.tourId) {
      tourRow = await this.env.DB.prepare(
        "SELECT * FROM tour_products WHERE id = ? AND status = 'published'"
      )
        .bind(input.tourId)
        .first<TourProductRow>();

      if (!tourRow) {
        throw new Error("Tour du lịch không tồn tại hoặc chưa được mở bán.");
      }
      if (totalTravelers < tourRow.min_travelers || totalTravelers > tourRow.max_travelers) {
        throw new Error(
          `Tour này chỉ nhận từ ${tourRow.min_travelers} đến ${tourRow.max_travelers} khách.`
        );
      }
      durationDays = tourRow.duration_days;
    }

    const calculatedItems: BookingQuoteItemRow[] = [];
    const quoteId = "quote-" + crypto.randomUUID();

    // 3. Nếu có tour sản phẩm, thêm dòng phí Tour gốc
    if (tourRow && tourRow.base_price > 0) {
      const lineTotal = tourRow.base_price * totalTravelers;
      calculatedItems.push({
        id: "qi-" + crypto.randomUUID(),
        quote_id: quoteId,
        service_id: null,
        item_name: `Gói tour: ${tourRow.title}`,
        category: "tour_package",
        pricing_mode: "per_person",
        unit_price: tourRow.base_price,
        quantity: totalTravelers,
        line_total: lineTotal,
      });
    }

    // 4. Tính toán các dịch vụ bổ sung được chọn
    const serviceIds = Array.isArray(input.selectedServiceIds)
      ? Array.from(new Set(input.selectedServiceIds.filter(Boolean)))
      : [];

    for (const srvId of serviceIds) {
      const service = await this.env.DB.prepare(
        "SELECT * FROM tour_services WHERE id = ? AND is_active = 1"
      )
        .bind(srvId)
        .first<TourServiceRow>();

      if (!service) {
        throw new Error(`Dịch vụ ${srvId} không tồn tại hoặc đã ngừng hoạt động.`);
      }

      // Lấy quy tắc giá đang kích hoạt của dịch vụ
      const priceRule = await this.env.DB.prepare(
        "SELECT * FROM tour_price_rules WHERE service_id = ? AND is_active = 1"
      )
        .bind(srvId)
        .first<TourPriceRuleRow>();

      if (!priceRule || priceRule.unit_price < 0) {
        throw new Error(`Dịch vụ "${service.name}" chưa có bảng giá khả dụng.`);
      }

      let qty = 1;
      let lineTotal = 0;
      const unitPrice = priceRule.unit_price;

      switch (priceRule.pricing_mode as PricingMode) {
        case "fixed":
        case "per_group":
          qty = 1;
          lineTotal = unitPrice;
          break;
        case "per_person":
          qty = totalTravelers;
          lineTotal = unitPrice * qty;
          break;
        case "per_adult":
          qty = adults;
          lineTotal = unitPrice * qty;
          break;
        case "per_child":
          qty = children;
          lineTotal = unitPrice * qty;
          break;
        case "per_day":
          qty = durationDays;
          lineTotal = unitPrice * qty;
          break;
        case "per_night":
          qty = Math.max(1, durationDays - 1);
          lineTotal = unitPrice * qty;
          break;
        default:
          qty = 1;
          lineTotal = unitPrice;
      }

      calculatedItems.push({
        id: "qi-" + crypto.randomUUID(),
        quote_id: quoteId,
        service_id: service.id,
        item_name: service.name,
        category: service.category,
        pricing_mode: priceRule.pricing_mode,
        unit_price: unitPrice,
        quantity: qty,
        line_total: lineTotal,
      });
    }

    const subtotal = calculatedItems.reduce((acc, it) => acc + it.line_total, 0);
    const totalPrice = subtotal;

    // Báo giá có hạn trong 30 phút
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const quoteRef =
      "QT-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    const quoteRow: BookingQuoteRow = {
      id: quoteId,
      quote_reference: quoteRef,
      user_id: input.userId,
      tour_id: input.tourId || null,
      itinerary_id: input.itineraryId || null,
      itinerary_version: itinVersion,
      adults_count: adults,
      children_count: children,
      duration_days: durationDays,
      subtotal: subtotal,
      total_price: totalPrice,
      currency: "VND",
      expires_at: expiresAt,
      status: "active",
      created_at: new Date().toISOString(),
    };

    // Lưu báo giá và items vào D1 atomically
    const statements: any[] = [
      this.env.DB.prepare(
        `INSERT INTO booking_quotes (id, quote_reference, user_id, tour_id, itinerary_id, itinerary_version, adults_count, children_count, duration_days, subtotal, total_price, currency, expires_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        quoteRow.id,
        quoteRow.quote_reference,
        quoteRow.user_id,
        quoteRow.tour_id,
        quoteRow.itinerary_id,
        quoteRow.itinerary_version,
        quoteRow.adults_count,
        quoteRow.children_count,
        quoteRow.duration_days,
        quoteRow.subtotal,
        quoteRow.total_price,
        quoteRow.currency,
        quoteRow.expires_at,
        quoteRow.status,
        quoteRow.created_at
      ),
    ];

    for (const item of calculatedItems) {
      statements.push(
        this.env.DB.prepare(
          `INSERT INTO booking_quote_items (id, quote_id, service_id, item_name, category, pricing_mode, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          item.id,
          item.quote_id,
          item.service_id,
          item.item_name,
          item.category,
          item.pricing_mode,
          item.unit_price,
          item.quantity,
          item.line_total
        )
      );
    }

    await this.env.DB.batch(statements);

    return {
      quote: quoteRow,
      items: calculatedItems,
    };
  }

  /**
   * Tạo đơn đặt từ báo giá khả dụng
   */
  async createBooking(input: CreateBookingInput): Promise<{
    booking: TourBookingRow;
    items: TourBookingItemRow[];
  }> {
    // 1. Kiểm tra Idempotency trước
    if (input.idempotencyKey) {
      const existing = await this.env.DB.prepare(
        "SELECT * FROM tour_bookings WHERE idempotency_key = ?"
      )
        .bind(input.idempotencyKey)
        .first<TourBookingRow>();

      if (existing) {
        if (existing.user_id !== input.userId) {
          throw new Error("Khóa trùng lặp thuộc về người dùng khác.");
        }
        const items = await this.env.DB.prepare(
          "SELECT * FROM tour_booking_items WHERE booking_id = ?"
        )
          .bind(existing.id)
          .all<TourBookingItemRow>();
        return { booking: existing, items: items.results || [] };
      }
    }

    // 2. Validate thông tin khách hàng
    const name = (input.customerName || "").trim();
    const phone = (input.customerPhone || "").trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("Tên người đặt phải từ 2 đến 100 ký tự.");
    }
    if (!/^[0-9+ ]{8,15}$/.test(phone)) {
      throw new Error("Số điện thoại liên hệ không hợp lệ.");
    }

    // 3. Lấy báo giá
    const quote = await this.env.DB.prepare(
      "SELECT * FROM booking_quotes WHERE quote_reference = ? AND user_id = ?"
    )
      .bind(input.quoteReference, input.userId)
      .first<BookingQuoteRow>();

    if (!quote) {
      throw new Error("Không tìm thấy báo giá hoặc bạn không có quyền truy cập báo giá này.");
    }

    if (quote.status !== "active") {
      throw new Error("Báo giá không còn hiệu lực.");
    }

    if (new Date(quote.expires_at).getTime() < Date.now()) {
      await this.env.DB.prepare("UPDATE booking_quotes SET status = 'expired' WHERE id = ?")
        .bind(quote.id)
        .run();
      throw new Error("Báo giá đã hết hạn 30 phút. Vui lòng nhận báo giá mới.");
    }

    // 4. Nếu báo giá gắn với itinerary, kiểm tra version concurrency
    if (quote.itinerary_id) {
      const currentItin = await this.env.DB.prepare(
        "SELECT version FROM travel_itineraries WHERE id = ? AND user_id = ?"
      )
        .bind(quote.itinerary_id, input.userId)
        .first<{ version: number }>();

      if (!currentItin || currentItin.version !== quote.itinerary_version) {
        await this.env.DB.prepare("UPDATE booking_quotes SET status = 'invalidated' WHERE id = ?")
          .bind(quote.id)
          .run();
        throw new Error(
          "Lịch trình đã được chỉnh sửa sau khi báo giá được phát hành. Vui lòng tính lại báo giá."
        );
      }
    }

    // Lấy items của quote
    const quoteItems = await this.env.DB.prepare(
      "SELECT * FROM booking_quote_items WHERE quote_id = ?"
    )
      .bind(quote.id)
      .all<BookingQuoteItemRow>();

    const bookingId = "bk-" + crypto.randomUUID();
    const bookingRef =
      "BK-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    const bookingRow: TourBookingRow = {
      id: bookingId,
      booking_reference: bookingRef,
      user_id: input.userId,
      quote_id: quote.id,
      tour_id: quote.tour_id,
      itinerary_id: quote.itinerary_id,
      customer_name: name,
      customer_phone: phone,
      customer_email: input.customerEmail ? input.customerEmail.trim() : null,
      adults_count: quote.adults_count,
      children_count: quote.children_count,
      total_amount: quote.total_price,
      currency: "VND",
      booking_status: "pending",
      payment_status: "unpaid",
      notes: input.notes ? input.notes.trim() : null,
      idempotency_key: input.idempotencyKey || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const bookingItems: TourBookingItemRow[] = (quoteItems.results || []).map((qi) => ({
      id: "bi-" + crypto.randomUUID(),
      booking_id: bookingId,
      service_id: qi.service_id,
      item_name: qi.item_name,
      category: qi.category,
      pricing_mode: qi.pricing_mode,
      unit_price: qi.unit_price,
      quantity: qi.quantity,
      line_total: qi.line_total,
    }));

    // Batch thực thi: tạo booking, tạo items, đánh dấu quote consumed, ghi state event
    const statements: any[] = [
      this.env.DB.prepare(
        `INSERT INTO tour_bookings (id, booking_reference, user_id, quote_id, tour_id, itinerary_id, customer_name, customer_phone, customer_email, adults_count, children_count, total_amount, currency, booking_status, payment_status, notes, idempotency_key, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        bookingRow.id,
        bookingRow.booking_reference,
        bookingRow.user_id,
        bookingRow.quote_id,
        bookingRow.tour_id,
        bookingRow.itinerary_id,
        bookingRow.customer_name,
        bookingRow.customer_phone,
        bookingRow.customer_email,
        bookingRow.adults_count,
        bookingRow.children_count,
        bookingRow.total_amount,
        bookingRow.currency,
        bookingRow.booking_status,
        bookingRow.payment_status,
        bookingRow.notes,
        bookingRow.idempotency_key,
        bookingRow.created_at,
        bookingRow.updated_at
      ),
      this.env.DB.prepare("UPDATE booking_quotes SET status = 'consumed' WHERE id = ?").bind(
        quote.id
      ),
      this.env.DB.prepare(
        `INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
         VALUES (?, ?, 'created', NULL, 'pending', 'customer', ?, ?)`
      ).bind(
        "ev-" + crypto.randomUUID(),
        bookingId,
        `Đặt đơn hàng từ báo giá ${quote.quote_reference}`,
        new Date().toISOString()
      ),
    ];

    for (const bi of bookingItems) {
      statements.push(
        this.env.DB.prepare(
          `INSERT INTO tour_booking_items (id, booking_id, service_id, item_name, category, pricing_mode, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          bi.id,
          bi.booking_id,
          bi.service_id,
          bi.item_name,
          bi.category,
          bi.pricing_mode,
          bi.unit_price,
          bi.quantity,
          bi.line_total
        )
      );
    }

    await this.env.DB.batch(statements);

    return {
      booking: bookingRow,
      items: bookingItems,
    };
  }

  /**
   * Chi tiết đơn đặt (Cô lập dữ liệu người dùng)
   */
  async getBooking(
    userId: string,
    bookingIdOrRef: string
  ): Promise<{
    booking: TourBookingRow;
    items: TourBookingItemRow[];
    paymentAttempts: MockPaymentAttemptRow[];
    events: BookingStateEventRow[];
  }> {
    const booking = await this.env.DB.prepare(
      "SELECT * FROM tour_bookings WHERE (id = ? OR booking_reference = ?) AND user_id = ?"
    )
      .bind(bookingIdOrRef, bookingIdOrRef, userId)
      .first<TourBookingRow>();

    if (!booking) {
      throw new Error("Không tìm thấy đơn đặt hàng.");
    }

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

  /**
   * Danh sách đơn đặt của người dùng
   */
  async listUserBookings(userId: string): Promise<TourBookingRow[]> {
    const res = await this.env.DB.prepare(
      "SELECT * FROM tour_bookings WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(userId)
      .all<TourBookingRow>();

    return res.results || [];
  }

  /**
   * Hủy đơn đặt (Chỉ hủy được khi chưa thanh toán thành công)
   */
  async cancelBooking(
    userId: string,
    bookingId: string,
    reason?: string
  ): Promise<TourBookingRow> {
    const booking = await this.env.DB.prepare(
      "SELECT * FROM tour_bookings WHERE id = ? AND user_id = ?"
    )
      .bind(bookingId, userId)
      .first<TourBookingRow>();

    if (!booking) {
      throw new Error("Không tìm thấy đơn đặt hàng.");
    }

    if (booking.booking_status === "cancelled") {
      throw new Error("Đơn đặt hàng đã ở trạng thái hủy trước đó.");
    }

    if (booking.payment_status === "paid") {
      throw new Error("Không thể tự hủy đơn hàng đã thanh toán. Vui lòng liên hệ ban quản lý.");
    }

    const now = new Date().toISOString();
    const statements: any[] = [
      this.env.DB.prepare(
        "UPDATE tour_bookings SET booking_status = 'cancelled', updated_at = ? WHERE id = ?"
      ).bind(now, bookingId),
      this.env.DB.prepare(
        `INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
         VALUES (?, ?, 'cancelled', ?, 'cancelled', 'customer', ?, ?)`
      ).bind(
        "ev-" + crypto.randomUUID(),
        bookingId,
        booking.booking_status,
        reason || "Người dùng tự hủy đơn",
        now
      ),
    ];

    await this.env.DB.batch(statements);
    booking.booking_status = "cancelled";
    booking.updated_at = now;
    return booking;
  }

  /**
   * Xử lý thanh toán mô phỏng (Mock Payment)
   * TUYỆT ĐỐI KHÔNG GIAO DỊCH TIỀN THẬT
   */
  async processMockPayment(input: MockPaymentInput): Promise<{
    success: boolean;
    booking: TourBookingRow;
    transactionReference: string;
    message: string;
  }> {
    // 1. Kiểm tra Idempotency
    if (input.idempotencyKey) {
      const existingTx = await this.env.DB.prepare(
        "SELECT * FROM mock_payment_attempts WHERE idempotency_key = ?"
      )
        .bind(input.idempotencyKey)
        .first<MockPaymentAttemptRow>();

      if (existingTx && existingTx.status === "success") {
        const b = await this.env.DB.prepare("SELECT * FROM tour_bookings WHERE id = ?")
          .bind(existingTx.booking_id)
          .first<TourBookingRow>();
        return {
          success: true,
          booking: b!,
          transactionReference: existingTx.transaction_reference,
          message: "Giao dịch mô phỏng đã hoàn tất trước đó (Idempotent).",
        };
      }
    }

    // 2. Kiểm tra booking
    const booking = await this.env.DB.prepare(
      "SELECT * FROM tour_bookings WHERE id = ? AND user_id = ?"
    )
      .bind(input.bookingId, input.userId)
      .first<TourBookingRow>();

    if (!booking) {
      throw new Error("Không tìm thấy đơn đặt hàng.");
    }

    if (booking.payment_status === "paid") {
      throw new Error("Đơn hàng này đã được thanh toán thành công trước đó.");
    }

    if (booking.booking_status === "cancelled") {
      throw new Error("Không thể thanh toán đơn hàng đã bị hủy.");
    }

    const txRef =
      "TX-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).substring(2, 6).toUpperCase();
    const now = new Date().toISOString();

    if (input.simulateStatus === "success") {
      const statements: any[] = [
        this.env.DB.prepare(
          "UPDATE tour_bookings SET payment_status = 'paid', booking_status = 'confirmed', updated_at = ? WHERE id = ?"
        ).bind(now, booking.id),
        this.env.DB.prepare(
          `INSERT INTO mock_payment_attempts (id, booking_id, transaction_reference, payment_method, amount, currency, status, idempotency_key, failure_reason, refunded_amount, created_at)
           VALUES (?, ?, ?, ?, ?, 'VND', 'success', ?, NULL, 0, ?)`
        ).bind(
          "tx-" + crypto.randomUUID(),
          booking.id,
          txRef,
          input.paymentMethod,
          booking.total_amount,
          input.idempotencyKey || null,
          now
        ),
        this.env.DB.prepare(
          `INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
           VALUES (?, ?, 'payment_success', ?, 'paid', 'customer', 'Mô phỏng thanh toán thành công', ?)`
        ).bind("ev-" + crypto.randomUUID(), booking.id, booking.payment_status, now),
      ];

      await this.env.DB.batch(statements);

      booking.payment_status = "paid";
      booking.booking_status = "confirmed";
      booking.updated_at = now;

      return {
        success: true,
        booking,
        transactionReference: txRef,
        message: "THANH TOÁN MÔ PHỎNG — KHÔNG THU TIỀN THẬT",
      };
    } else {
      // Simulate failure
      const statements: any[] = [
        this.env.DB.prepare(
          "UPDATE tour_bookings SET payment_status = 'failed', updated_at = ? WHERE id = ?"
        ).bind(now, booking.id),
        this.env.DB.prepare(
          `INSERT INTO mock_payment_attempts (id, booking_id, transaction_reference, payment_method, amount, currency, status, idempotency_key, failure_reason, refunded_amount, created_at)
           VALUES (?, ?, ?, ?, ?, 'VND', 'failed', ?, 'Thử nghiệm giao dịch thất bại có chủ đích', 0, ?)`
        ).bind(
          "tx-" + crypto.randomUUID(),
          booking.id,
          txRef,
          input.paymentMethod,
          booking.total_amount,
          input.idempotencyKey || null,
          now
        ),
        this.env.DB.prepare(
          `INSERT INTO booking_state_events (id, booking_id, event_type, from_status, to_status, actor, reason, created_at)
           VALUES (?, ?, 'payment_failed', ?, 'failed', 'customer', 'Mô phỏng thanh toán thất bại', ?)`
        ).bind("ev-" + crypto.randomUUID(), booking.id, booking.payment_status, now),
      ];

      await this.env.DB.batch(statements);

      booking.payment_status = "failed";
      booking.updated_at = now;

      return {
        success: false,
        booking,
        transactionReference: txRef,
        message: "Giao dịch mô phỏng thất bại. Bạn có thể thử lại.",
      };
    }
  }
}
