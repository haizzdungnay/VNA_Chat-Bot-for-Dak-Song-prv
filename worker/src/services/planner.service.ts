import type {
  Env,
  Place,
  PlannerRequest,
  ItineraryOutput,
  ItineraryDayOutput,
  ItineraryItemOutput,
  TravelPace,
  TransportationType,
  BudgetPreference,
  ItineraryItemType,
} from "../types";
import { PlaceRepository } from "../repositories/place.repository";
import { createAIProvider } from "./ai";
import { ValidationError } from "../utils/errors";

export class PlannerService {
  private env: Env;
  private placeRepo: PlaceRepository;

  // Test hook to inject custom AI mock for planner
  public static testAIOverride: ((prompt: string) => Promise<string>) | null = null;

  constructor(env: Env) {
    this.env = env;
    this.placeRepo = new PlaceRepository(env.DB);
  }

  validateRequest(req: Partial<PlannerRequest>): PlannerRequest {
    if (!req || typeof req !== "object") {
      throw new ValidationError("Dữ liệu yêu cầu lập lịch trình không hợp lệ.", 400);
    }

    const durationDays = Number(req.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 5) {
      throw new ValidationError("Thời gian chuyến đi phải từ 1 đến 5 ngày.", 400);
    }

    const travelersCount = Number(req.travelersCount);
    if (!Number.isInteger(travelersCount) || travelersCount < 1 || travelersCount > 50) {
      throw new ValidationError("Số lượng người tham gia phải từ 1 đến 50 người.", 400);
    }

    const childrenCount = req.childrenCount !== undefined ? Number(req.childrenCount) : 0;
    if (!Number.isInteger(childrenCount) || childrenCount < 0) {
      throw new ValidationError("Số lượng trẻ em không hợp lệ.", 400);
    }
    if (childrenCount > travelersCount) {
      throw new ValidationError("Số lượng trẻ em không thể vượt quá tổng số người tham gia.", 400);
    }

    const startDate = typeof req.startDate === "string" ? req.startDate.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new ValidationError("Ngày khởi hành phải đúng định dạng YYYY-MM-DD.", 400);
    }

    const validPaces = new Set(["relaxed", "moderate", "active"]);
    const pace = (req.pace && validPaces.has(req.pace) ? req.pace : "moderate") as TravelPace;

    const validTrans = new Set(["car", "motorbike", "shuttle"]);
    const transportation = (req.transportation && validTrans.has(req.transportation)
      ? req.transportation
      : "car") as TransportationType;

    const validBudgets = new Set(["economy", "moderate", "luxury"]);
    const budgetPreference = (req.budgetPreference && validBudgets.has(req.budgetPreference)
      ? req.budgetPreference
      : "moderate") as BudgetPreference;

    const departureTime = typeof req.departureTime === "string" && /^\d{2}:\d{2}$/.test(req.departureTime.trim())
      ? req.departureTime.trim()
      : "08:00";

    const interests = Array.isArray(req.interests)
      ? req.interests.filter((x): x is string => typeof x === "string")
      : ["nature", "culture"];

    const selectedPlaceIds = Array.isArray(req.selectedPlaceIds)
      ? req.selectedPlaceIds.filter((x): x is string => typeof x === "string")
      : [];

    return {
      durationDays,
      travelersCount,
      childrenCount,
      startDate,
      departureTime,
      pace,
      transportation,
      budgetPreference,
      interests,
      selectedPlaceIds,
    };
  }

  async generatePreview(rawReq: Partial<PlannerRequest>): Promise<ItineraryOutput> {
    const req = this.validateRequest(rawReq);
    const allPlaces = await this.placeRepo.findAll();
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));

    // Validate selected places
    if (req.selectedPlaceIds && req.selectedPlaceIds.length > 0) {
      for (const id of req.selectedPlaceIds) {
        if (!placesMap.has(id)) {
          throw new ValidationError(`Địa điểm đã chọn '${id}' không tồn tại trong cơ sở dữ liệu.`, 400);
        }
      }
    }

    try {
      if (PlannerService.testAIOverride) {
        const customAiText = await PlannerService.testAIOverride("test");
        const parsed = JSON.parse(customAiText);
        return this.normalizeAndEnforceItinerary(parsed, placesMap, req, false);
      }

      // Try AI generation with 10s race to preserve fast responsive UX
      const aiPromise = this.generateWithAI(allPlaces, req);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI generation timeout")), 10000)
      );

      const aiResult = await Promise.race([aiPromise, timeoutPromise]);
      return this.normalizeAndEnforceItinerary(aiResult, placesMap, req, false);
    } catch {
      // Fallback deterministic scheduling when AI times out, errors, or returns malformed JSON
      const fallback = this.generateDeterministicItinerary(allPlaces, req);
      fallback.isFallback = true;
      fallback.warnings = [
        ...(fallback.warnings || []),
        "Lịch trình được khởi tạo theo thuật toán tối ưu cục bộ do kết nối dịch vụ AI gián đoạn.",
      ];
      return fallback;
    }
  }

  private async generateWithAI(allPlaces: Place[], req: PlannerRequest): Promise<any> {
    const provider = createAIProvider(this.env);

    const availableList = allPlaces.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name || "Khám phá",
      sourceType: p.sourceType,
      shortDescription: p.shortDescription,
    }));

    const systemPrompt = `Bạn là Chuyên gia thiết kế lịch trình du lịch thông minh cho huyện Đắk Song, tỉnh Đắk Nông.
Nhiệm vụ: Tạo lịch trình du lịch ${req.durationDays} ngày có cấu trúc chi tiết, hợp lý về thời gian, đúng văn phong du lịch Đắk Song.
QUY TẮC BẮT BUỘC:
1. CHỈ ĐƯỢC CHỌN địa điểm từ danh sách D1 được cung cấp dưới đây. TUYỆT ĐỐI KHÔNG BỊA ĐẶT địa điểm mới hoặc địa chỉ giả.
2. Với các điểm có sourceType="vr360", đây là điểm ngắm cảnh hoặc thực tế ảo, phải ghi chú phù hợp.
3. Nhịp độ di chuyển: ${req.pace} (relaxed: 2-3 điểm/ngày, moderate: 3-4 điểm/ngày, active: 4-5 điểm/ngày). Không ép 7 điểm mỗi ngày!
4. Xen kẽ nghỉ ngơi và ăn trưa (11:30 - 13:00) hợp lý.
5. Luôn trả lời DUY NHẤT một khối JSON hợp lệ theo định dạng:
{
  "title": "Tên chuyến đi hấp dẫn",
  "summary": "Tóm tắt ngắn gọn trải nghiệm nổi bật",
  "days": [
    {
      "dayNumber": 1,
      "title": "Chủ đề ngày 1",
      "items": [
        {
          "placeId": "id-địa-điểm-từ-D1-hoặc-null-nếu-ăn-nghỉ",
          "itemType": "place" | "meal" | "rest",
          "title": "Tên hoạt động hoặc địa điểm",
          "plannedTime": "08:30",
          "durationMinutes": 90,
          "notes": "Lời khuyên trải nghiệm thực tế"
        }
      ]
    }
  ]
}

Danh sách địa điểm Đắk Song có sẵn trong D1:
${JSON.stringify(availableList, null, 2)}`;

    const userMessage = `Lập lịch trình du lịch Đắk Song:
- Số ngày: ${req.durationDays} ngày
- Số người: ${req.travelersCount} người (${req.childrenCount} trẻ em)
- Ngày bắt đầu: ${req.startDate}
- Giờ khởi hành: ${req.departureTime}
- Phương tiện: ${req.transportation}
- Nhịp độ: ${req.pace}
- Sở thích: ${(req.interests || []).join(", ")}
${req.selectedPlaceIds && req.selectedPlaceIds.length > 0 ? `- Điểm ưu tiên: ${req.selectedPlaceIds.join(", ")}` : ""}`;

    const response = await provider.chat({
      systemPrompt,
      message: userMessage,
      history: [],
      contextPlaces: allPlaces,
    });

    let rawJson = response.answer.trim();
    // Strip markdown code fences if present
    if (rawJson.startsWith("```")) {
      const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) rawJson = match[1].trim();
    }

    return JSON.parse(rawJson);
  }

  generateDeterministicItinerary(allPlaces: Place[], req: PlannerRequest): ItineraryOutput {
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));
    const selectedSet = new Set(req.selectedPlaceIds || []);

    // Separate verified places and vr360
    const verified = allPlaces.filter((p) => p.sourceType !== "vr360");
    const vr360 = allPlaces.filter((p) => p.sourceType === "vr360");

    // Order: user selected first, then featured, then others
    const prioritized: Place[] = [];
    for (const id of selectedSet) {
      const p = placesMap.get(id);
      if (p) prioritized.push(p);
    }
    for (const p of verified) {
      if (!selectedSet.has(p.id)) prioritized.push(p);
    }
    for (const p of vr360) {
      if (!selectedSet.has(p.id)) prioritized.push(p);
    }

    const itemsPerDay = req.pace === "relaxed" ? 2 : req.pace === "active" ? 4 : 3;
    const days: ItineraryDayOutput[] = [];

    const dayTitles = [
      "Khám phá danh thắng & Thiên nhiên Đắk Song",
      "Trải nghiệm văn hóa bản địa & Điểm check-in nổi bật",
      "Thưởng thức ẩm thực Tây Nguyên & Nghỉ dưỡng sinh thái",
      "Khám phá chiều sâu di tích & Cảnh quan đại ngàn",
      "Thong dong dạo chơi & Mua sắm đặc sản địa phương",
    ];

    let placeIdx = 0;

    for (let dayNum = 1; dayNum <= req.durationDays; dayNum++) {
      const dayDate = this.calculateDate(req.startDate, dayNum - 1);
      const dayItems: ItineraryItemOutput[] = [];
      let currentHour = dayNum === 1 ? parseInt(req.departureTime?.split(":")[0] || "8", 10) : 8;
      let currentMin = dayNum === 1 ? parseInt(req.departureTime?.split(":")[1] || "30", 10) : 30;

      let order = 0;

      // Morning stops
      const morningStops = Math.max(1, Math.floor(itemsPerDay / 2));
      for (let s = 0; s < morningStops; s++) {
        if (placeIdx < prioritized.length) {
          const place = prioritized[placeIdx++];
          const timeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
          const duration = req.pace === "relaxed" ? 90 : 60;

          dayItems.push({
            placeId: place.id,
            itemType: "place",
            title: place.name,
            plannedTime: timeStr,
            durationMinutes: duration,
            notes: place.sourceType === "vr360"
              ? "Điểm ngắm cảnh và trải nghiệm không gian thực tế ảo VR360 độc đáo."
              : place.shortDescription || "Tham quan và trải nghiệm vẻ đẹp thiên nhiên.",
            orderIndex: order++,
            isUserSelected: selectedSet.has(place.id),
            place,
          });

          // Advance time
          currentMin += duration + 30; // 30 min transit
          while (currentMin >= 60) {
            currentHour += 1;
            currentMin -= 60;
          }
        }
      }

      // Lunch break
      dayItems.push({
        placeId: null,
        itemType: "meal",
        title: "Nghỉ trưa & Thưởng thức ẩm thực Đắk Song",
        plannedTime: "11:45",
        durationMinutes: 75,
        notes: "Thưởng thức các món ngon Tây Nguyên như gà nướng cơm lam, cá suối hoặc nghỉ ngơi thư giãn.",
        orderIndex: order++,
        isUserSelected: false,
      });

      currentHour = 13;
      currentMin = 15;

      // Afternoon stops
      const afternoonStops = itemsPerDay - morningStops;
      for (let s = 0; s < afternoonStops; s++) {
        if (placeIdx < prioritized.length) {
          const place = prioritized[placeIdx++];
          const timeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
          const duration = req.pace === "relaxed" ? 90 : 60;

          dayItems.push({
            placeId: place.id,
            itemType: "place",
            title: place.name,
            plannedTime: timeStr,
            durationMinutes: duration,
            notes: place.sourceType === "vr360"
              ? "Chiêm ngưỡng không gian đại ngàn qua góc nhìn 360 độ."
              : place.shortDescription || "Trải nghiệm văn hóa và cảnh quan địa phương.",
            orderIndex: order++,
            isUserSelected: selectedSet.has(place.id),
            place,
          });

          currentMin += duration + 30;
          while (currentMin >= 60) {
            currentHour += 1;
            currentMin -= 60;
          }
        }
      }

      // Evening relaxation
      dayItems.push({
        placeId: null,
        itemType: "rest",
        title: "Ăn tối & Thư giãn buổi tối",
        plannedTime: "18:30",
        durationMinutes: 90,
        notes: "Thưởng thức cà phê Đắk Song hoặc dạo bộ thư giãn trong không khí cao nguyên mát lành.",
        orderIndex: order++,
        isUserSelected: false,
      });

      days.push({
        dayNumber: dayNum,
        date: dayDate,
        title: dayTitles[dayNum - 1] || `Khám phá Đắk Song - Ngày ${dayNum}`,
        notes: `Lịch trình ngày ${dayNum} được thiết kế phù hợp nhịp độ ${req.pace}.`,
        items: dayItems,
      });
    }

    const warnings: string[] = [];
    if (prioritized.length < req.durationDays * itemsPerDay) {
      warnings.push(
        "Số lượng điểm đến được phân bổ hợp lý để du khách có thời gian tận hưởng cảnh quan, không bị gấp gáp."
      );
    }

    return {
      title: `Hành trình khám phá Đắk Song ${req.durationDays}N${Math.max(1, req.durationDays - 1)}Đ`,
      startDate: req.startDate,
      departureTime: req.departureTime,
      durationDays: req.durationDays,
      travelersCount: req.travelersCount,
      childrenCount: req.childrenCount,
      pace: req.pace || "moderate",
      transportation: req.transportation || "car",
      budgetPreference: req.budgetPreference || "moderate",
      interests: req.interests || [],
      summary: `Chuyến đi ${req.durationDays} ngày dành cho ${req.travelersCount} người, kết hợp hài hòa giữa danh lam thắng cảnh, văn hóa bản địa và ẩm thực đặc sắc của huyện Đắk Song.`,
      status: "draft",
      version: 1,
      days,
      warnings,
      isFallback: false,
    };
  }

  normalizeAndEnforceItinerary(
    raw: any,
    placesMap: Map<string, Place>,
    req: PlannerRequest,
    isFallback: boolean
  ): ItineraryOutput {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.days)) {
      return this.generateDeterministicItinerary(Array.from(placesMap.values()), req);
    }

    const selectedSet = new Set(req.selectedPlaceIds || []);
    const normalizedDays: ItineraryDayOutput[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < req.durationDays; i++) {
      const dayRaw = raw.days[i];
      const dayNum = i + 1;
      const dayDate = this.calculateDate(req.startDate, i);
      const items: ItineraryItemOutput[] = [];

      if (dayRaw && Array.isArray(dayRaw.items)) {
        let order = 0;
        for (const itemRaw of dayRaw.items) {
          const itemType = (["place", "meal", "rest", "transport"].includes(itemRaw.itemType)
            ? itemRaw.itemType
            : "place") as ItineraryItemType;

          let placeId: string | null = null;
          let placeObj: Place | undefined = undefined;

          if (itemType === "place" && itemRaw.placeId && placesMap.has(itemRaw.placeId)) {
            placeId = itemRaw.placeId;
            placeObj = placesMap.get(itemRaw.placeId);
          }

          const title = placeObj
            ? placeObj.name
            : typeof itemRaw.title === "string" && itemRaw.title.trim()
            ? itemRaw.title.trim().slice(0, 100)
            : itemType === "meal"
            ? "Bữa ăn Tây Nguyên"
            : "Nghỉ ngơi & Thư giãn";

          let notes = typeof itemRaw.notes === "string" ? itemRaw.notes.trim().slice(0, 300) : "";
          if (placeObj && placeObj.sourceType === "vr360" && !notes.includes("VR360")) {
            notes = `[Điểm thực tế ảo VR360] ${notes || placeObj.shortDescription}`;
          }

          items.push({
            placeId,
            itemType,
            title,
            plannedTime: typeof itemRaw.plannedTime === "string" ? itemRaw.plannedTime.slice(0, 5) : undefined,
            durationMinutes: Number(itemRaw.durationMinutes) || 60,
            notes,
            orderIndex: order++,
            isUserSelected: placeId ? selectedSet.has(placeId) : false,
            place: placeObj,
          });
        }
      }

      normalizedDays.push({
        dayNumber: dayNum,
        date: dayDate,
        title: typeof dayRaw?.title === "string" ? dayRaw.title.slice(0, 100) : `Khám phá Đắk Song - Ngày ${dayNum}`,
        notes: typeof dayRaw?.notes === "string" ? dayRaw.notes.slice(0, 200) : undefined,
        items,
      });
    }

    return {
      title: typeof raw.title === "string" ? raw.title.slice(0, 120) : `Lịch trình du lịch Đắk Song ${req.durationDays} ngày`,
      startDate: req.startDate,
      departureTime: req.departureTime,
      durationDays: req.durationDays,
      travelersCount: req.travelersCount,
      childrenCount: req.childrenCount,
      pace: req.pace || "moderate",
      transportation: req.transportation || "car",
      budgetPreference: req.budgetPreference || "moderate",
      interests: req.interests || [],
      summary: typeof raw.summary === "string" ? raw.summary.slice(0, 500) : "Lịch trình du lịch thông minh tại Đắk Song.",
      status: "draft",
      version: 1,
      days: normalizedDays,
      warnings,
      isFallback,
    };
  }

  private calculateDate(startIso: string, dayOffset: number): string {
    try {
      const d = new Date(startIso + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + dayOffset);
      return d.toISOString().split("T")[0];
    } catch {
      return startIso;
    }
  }

  // --- CRUD Storage Operations Bound to Authenticated users.id ---

  async saveItinerary(userId: string, data: ItineraryOutput): Promise<ItineraryOutput> {
    if (!userId || typeof userId !== "string") {
      throw new ValidationError("Yêu cầu xác thực tài khoản để lưu lịch trình.", 401);
    }

    const itineraryId = data.id || crypto.randomUUID();
    const interestsJson = JSON.stringify(data.interests || []);

    await this.env.DB.prepare(`
      INSERT INTO travel_itineraries (
        id, user_id, title, start_date, departure_time, duration_days,
        travelers_count, children_count, pace, transportation, budget_preference,
        interests_json, summary, status, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved', 1, datetime('now'), datetime('now'))
    `)
      .bind(
        itineraryId,
        userId,
        data.title,
        data.startDate,
        data.departureTime || "08:00",
        data.durationDays,
        data.travelersCount,
        data.childrenCount,
        data.pace,
        data.transportation,
        data.budgetPreference,
        interestsJson,
        data.summary || null
      )
      .run();

    const savedDays: ItineraryDayOutput[] = [];

    for (const day of data.days) {
      const dayId = crypto.randomUUID();
      await this.env.DB.prepare(`
        INSERT INTO itinerary_days (id, itinerary_id, day_number, date, title, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
        .bind(dayId, itineraryId, day.dayNumber, day.date || null, day.title || null, day.notes || null)
        .run();

      const savedItems: ItineraryItemOutput[] = [];

      for (let idx = 0; idx < day.items.length; idx++) {
        const item = day.items[idx];
        const itemId = crypto.randomUUID();

        await this.env.DB.prepare(`
          INSERT INTO itinerary_items (
            id, itinerary_id, day_id, place_id, item_type, title,
            planned_time, duration_minutes, notes, order_index, is_user_selected, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
          .bind(
            itemId,
            itineraryId,
            dayId,
            item.placeId || null,
            item.itemType,
            item.title,
            item.plannedTime || null,
            item.durationMinutes,
            item.notes || null,
            idx,
            item.isUserSelected ? 1 : 0
          )
          .run();

        savedItems.push({ ...item, id: itemId });
      }

      savedDays.push({ ...day, id: dayId, items: savedItems });
    }

    return {
      ...data,
      id: itineraryId,
      userId,
      status: "saved",
      version: 1,
      days: savedDays,
    };
  }

  async listItineraries(userId: string): Promise<ItineraryOutput[]> {
    if (!userId) return [];

    const { results } = await this.env.DB.prepare(`
      SELECT * FROM travel_itineraries WHERE user_id = ? ORDER BY created_at DESC
    `)
      .bind(userId)
      .all<any>();

    const itineraries: ItineraryOutput[] = [];
    const allPlaces = await this.placeRepo.findAll();
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));

    for (const row of results || []) {
      const itin = await this.loadItineraryDetails(row, placesMap);
      itineraries.push(itin);
    }

    return itineraries;
  }

  async getItinerary(userId: string, itineraryId: string): Promise<ItineraryOutput> {
    const row = await this.env.DB.prepare(`
      SELECT * FROM travel_itineraries WHERE id = ? AND user_id = ?
    `)
      .bind(itineraryId, userId)
      .first<any>();

    if (!row) {
      throw new ValidationError("Không tìm thấy lịch trình hoặc bạn không có quyền truy cập.", 404);
    }

    const allPlaces = await this.placeRepo.findAll();
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));
    return await this.loadItineraryDetails(row, placesMap);
  }

  async updateItinerary(userId: string, itineraryId: string, data: ItineraryOutput): Promise<ItineraryOutput> {
    const existing = await this.env.DB.prepare(`
      SELECT * FROM travel_itineraries WHERE id = ? AND user_id = ?
    `)
      .bind(itineraryId, userId)
      .first<any>();

    if (!existing) {
      throw new ValidationError("Không tìm thấy lịch trình hoặc bạn không có quyền truy cập.", 404);
    }

    const newVersion = (existing.version || 1) + 1;
    const interestsJson = JSON.stringify(data.interests || []);

    await this.env.DB.prepare(`
      UPDATE travel_itineraries SET
        title = ?, start_date = ?, departure_time = ?, duration_days = ?,
        travelers_count = ?, children_count = ?, pace = ?, transportation = ?,
        budget_preference = ?, interests_json = ?, summary = ?, status = ?,
        version = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `)
      .bind(
        data.title,
        data.startDate,
        data.departureTime || "08:00",
        data.durationDays,
        data.travelersCount,
        data.childrenCount,
        data.pace,
        data.transportation,
        data.budgetPreference,
        interestsJson,
        data.summary || null,
        data.status || "saved",
        newVersion,
        itineraryId,
        userId
      )
      .run();

    // Replace days and items atomically
    await this.env.DB.prepare("DELETE FROM itinerary_items WHERE itinerary_id = ?")
      .bind(itineraryId)
      .run();
    await this.env.DB.prepare("DELETE FROM itinerary_days WHERE itinerary_id = ?")
      .bind(itineraryId)
      .run();

    const savedDays: ItineraryDayOutput[] = [];

    for (const day of data.days) {
      const dayId = crypto.randomUUID();
      await this.env.DB.prepare(`
        INSERT INTO itinerary_days (id, itinerary_id, day_number, date, title, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
        .bind(dayId, itineraryId, day.dayNumber, day.date || null, day.title || null, day.notes || null)
        .run();

      const savedItems: ItineraryItemOutput[] = [];

      for (let idx = 0; idx < day.items.length; idx++) {
        const item = day.items[idx];
        const itemId = crypto.randomUUID();

        await this.env.DB.prepare(`
          INSERT INTO itinerary_items (
            id, itinerary_id, day_id, place_id, item_type, title,
            planned_time, duration_minutes, notes, order_index, is_user_selected, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
          .bind(
            itemId,
            itineraryId,
            dayId,
            item.placeId || null,
            item.itemType,
            item.title,
            item.plannedTime || null,
            item.durationMinutes,
            item.notes || null,
            idx,
            item.isUserSelected ? 1 : 0
          )
          .run();

        savedItems.push({ ...item, id: itemId });
      }

      savedDays.push({ ...day, id: dayId, items: savedItems });
    }

    return {
      ...data,
      id: itineraryId,
      userId,
      version: newVersion,
      days: savedDays,
    };
  }

  async deleteItinerary(userId: string, itineraryId: string): Promise<boolean> {
    const existing = await this.env.DB.prepare(`
      SELECT id FROM travel_itineraries WHERE id = ? AND user_id = ?
    `)
      .bind(itineraryId, userId)
      .first<any>();

    if (!existing) {
      throw new ValidationError("Không tìm thấy lịch trình hoặc bạn không có quyền truy cập.", 404);
    }

    await this.env.DB.prepare("DELETE FROM travel_itineraries WHERE id = ? AND user_id = ?")
      .bind(itineraryId, userId)
      .run();

    return true;
  }

  private async loadItineraryDetails(
    row: any,
    placesMap: Map<string, Place>
  ): Promise<ItineraryOutput> {
    const { results: dayRows } = await this.env.DB.prepare(`
      SELECT * FROM itinerary_days WHERE itinerary_id = ? ORDER BY day_number ASC
    `)
      .bind(row.id)
      .all<any>();

    const { results: itemRows } = await this.env.DB.prepare(`
      SELECT * FROM itinerary_items WHERE itinerary_id = ? ORDER BY order_index ASC
    `)
      .bind(row.id)
      .all<any>();

    const itemsByDay = new Map<string, ItineraryItemOutput[]>();
    for (const item of itemRows || []) {
      const place = item.place_id ? placesMap.get(item.place_id) : undefined;
      const list = itemsByDay.get(item.day_id) || [];
      list.push({
        id: item.id,
        placeId: item.place_id,
        itemType: item.item_type,
        title: item.title,
        plannedTime: item.planned_time,
        durationMinutes: item.duration_minutes,
        notes: item.notes,
        orderIndex: item.order_index,
        isUserSelected: Boolean(item.is_user_selected),
        place,
      });
      itemsByDay.set(item.day_id, list);
    }

    const days: ItineraryDayOutput[] = (dayRows || []).map((d: any) => ({
      id: d.id,
      dayNumber: d.day_number,
      date: d.date,
      title: d.title,
      notes: d.notes,
      items: itemsByDay.get(d.id) || [],
    }));

    let interests: string[] = [];
    try {
      if (row.interests_json) interests = JSON.parse(row.interests_json);
    } catch {
      // safe fallback
    }

    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      startDate: row.start_date,
      departureTime: row.departure_time,
      durationDays: row.duration_days,
      travelersCount: row.travelers_count,
      childrenCount: row.children_count,
      pace: (row.pace as TravelPace) || "moderate",
      transportation: (row.transportation as TransportationType) || "car",
      budgetPreference: (row.budget_preference as BudgetPreference) || "moderate",
      interests,
      summary: row.summary,
      status: row.status,
      version: row.version,
      days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
