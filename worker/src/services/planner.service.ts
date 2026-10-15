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
import { AdminService } from "./admin.service";
import { ValidationError } from "../utils/errors";

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export function isValidTimeFormat(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

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
    if (!isValidCalendarDate(startDate)) {
      throw new ValidationError("Ngày khởi hành không hợp lệ hoặc không đúng định dạng YYYY-MM-DD.", 400);
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

    const departureTime =
      typeof req.departureTime === "string" && isValidTimeFormat(req.departureTime.trim())
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

  async validateItineraryPayload(data: ItineraryOutput, placesMap: Map<string, Place>): Promise<void> {
    if (!data || typeof data !== "object") {
      throw new ValidationError("Dữ liệu lịch trình không hợp lệ.", 400);
    }
    const duration = Number(data.durationDays);
    if (!Number.isInteger(duration) || duration < 1 || duration > 5) {
      throw new ValidationError("Thời gian chuyến đi phải từ 1 đến 5 ngày.", 400);
    }
    const travelers = Number(data.travelersCount);
    if (!Number.isInteger(travelers) || travelers < 1 || travelers > 50) {
      throw new ValidationError("Số lượng người tham gia phải từ 1 đến 50 người.", 400);
    }
    const children = Number(data.childrenCount || 0);
    if (!Number.isInteger(children) || children < 0 || children > travelers) {
      throw new ValidationError("Số lượng trẻ em không thể vượt quá tổng số người.", 400);
    }
    if (!data.startDate || !isValidCalendarDate(data.startDate)) {
      throw new ValidationError("Ngày khởi hành không hợp lệ hoặc không đúng định dạng YYYY-MM-DD.", 400);
    }
    if (data.departureTime && !isValidTimeFormat(data.departureTime)) {
      throw new ValidationError("Giờ khởi hành không đúng định dạng HH:mm (00:00 - 23:59).", 400);
    }
    if (typeof data.title !== "string" || !data.title.trim() || data.title.trim().length > 200) {
      throw new ValidationError("Tiêu đề lịch trình phải từ 1 đến 200 ký tự.", 400);
    }
    if (data.summary && (typeof data.summary !== "string" || data.summary.length > 1000)) {
      throw new ValidationError("Tóm tắt lịch trình không được vượt quá 1000 ký tự.", 400);
    }
    if (!Array.isArray(data.days) || data.days.length !== duration) {
      throw new ValidationError(
        `Số lượng ngày trong lịch trình (${data.days?.length || 0}) không khớp với tổng số ngày (${duration}).`,
        400
      );
    }

    const seenDayNumbers = new Set<number>();
    const validItemTypes = new Set(["place", "meal", "rest", "transport"]);

    for (let dayIdx = 0; dayIdx < data.days.length; dayIdx++) {
      const day = data.days[dayIdx];
      if (!day || typeof day !== "object") {
        throw new ValidationError(`Dữ liệu ngày thứ ${dayIdx + 1} không hợp lệ.`, 400);
      }
      const dayNum = Number(day.dayNumber);
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > duration) {
        throw new ValidationError(
          `Số thứ tự ngày '${day.dayNumber}' không hợp lệ (phải từ 1 đến ${duration}).`,
          400
        );
      }
      if (seenDayNumbers.has(dayNum)) {
        throw new ValidationError(`Số thứ tự ngày ${dayNum} bị trùng lặp trong lịch trình.`, 400);
      }
      seenDayNumbers.add(dayNum);

      if (day.date) {
        if (!isValidCalendarDate(day.date)) {
          throw new ValidationError(`Ngày ${day.date} của ngày ${dayNum} không phải là ngày hợp lệ.`, 400);
        }
      }

      if (!Array.isArray(day.items)) {
        throw new ValidationError(`Danh sách hoạt động của ngày ${day.dayNumber} không hợp lệ.`, 400);
      }
      if (day.items.length > 15) {
        throw new ValidationError(
          `Số lượng hoạt động của ngày ${day.dayNumber} vượt quá giới hạn cho phép (tối đa 15).`,
          400
        );
      }

      for (let idx = 0; idx < day.items.length; idx++) {
        const item = day.items[idx];
        if (!item || typeof item !== "object") {
          throw new ValidationError(`Hoạt động thứ ${idx + 1} của ngày ${day.dayNumber} không hợp lệ.`, 400);
        }
        if (!item.itemType || !validItemTypes.has(item.itemType)) {
          throw new ValidationError(
            `Loại hoạt động '${item.itemType}' của hoạt động thứ ${idx + 1} không hợp lệ.`,
            400
          );
        }
        if (typeof item.title !== "string" || !item.title.trim() || item.title.trim().length > 200) {
          throw new ValidationError(
            `Tên hoạt động thứ ${idx + 1} của ngày ${day.dayNumber} phải từ 1 đến 200 ký tự.`,
            400
          );
        }
        if (item.notes && (typeof item.notes !== "string" || item.notes.length > 500)) {
          throw new ValidationError(
            `Ghi chú của hoạt động '${item.title}' không được vượt quá 500 ký tự.`,
            400
          );
        }

        if (item.itemType === "place") {
          if (!item.placeId || typeof item.placeId !== "string" || !item.placeId.trim()) {
            throw new ValidationError(
              `Hoạt động tham quan '${item.title || idx + 1}' thiếu mã định danh địa điểm (placeId).`,
              400
            );
          }
          if (!placesMap.has(item.placeId.trim())) {
            throw new ValidationError(
              `Địa điểm '${item.placeId}' không tồn tại trong cơ sở dữ liệu.`,
              400
            );
          }
        }

        const durationMin = Number(item.durationMinutes);
        if (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 360) {
          throw new ValidationError(
            `Thời lượng hoạt động '${item.title || idx + 1}' phải từ 15 đến 360 phút.`,
            400
          );
        }

        if (item.plannedTime !== undefined && item.plannedTime !== null) {
          if (typeof item.plannedTime !== "string" || !isValidTimeFormat(item.plannedTime.trim())) {
            throw new ValidationError(
              `Giờ dự kiến '${item.plannedTime}' của hoạt động '${item.title || idx + 1}' không đúng định dạng HH:mm (00:00 - 23:59).`,
              400
            );
          }
        }
      }
    }
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
    const isFeatureEnabled =
      this.env.ADMIN_AI_CONFIG_ENABLED === "true" ||
      this.env.ADMIN_AI_CONFIG_ENABLED === true;

    let runtimeEnv = this.env;
    const adminService = new AdminService(this.env);

    if (isFeatureEnabled) {
      try {
        const dynamicConfig = await adminService.getActiveRuntimeConfig();
        if (dynamicConfig) {
          runtimeEnv = {
            ...this.env,
            AI_PROVIDER: dynamicConfig.providerType,
            AI_BASE_URL: dynamicConfig.baseUrl,
            AI_MODEL: dynamicConfig.model,
            AI_REASONING_EFFORT: dynamicConfig.reasoningEffort,
            AI_JSON_MODE: dynamicConfig.jsonMode ? "true" : "false",
            AI_API_KEY: dynamicConfig.apiKey,
          };
        }
      } catch {
        // fallback gracefully to Worker Env
      }
    }

    const provider = createAIProvider(runtimeEnv);

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

    const startTime = Date.now();
    try {
      const response = await provider.chat({
        systemPrompt,
        message: userMessage,
        history: [],
        contextPlaces: allPlaces,
      });

      const duration = Date.now() - startTime;
      await adminService.logTelemetryEvent("planner_request", 200, duration);

      let rawJson = response.answer.trim();
      if (rawJson.startsWith("```")) {
        const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) rawJson = match[1].trim();
      }

      return JSON.parse(rawJson);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      await adminService.logTelemetryEvent("planner_error", 500, duration, err?.message);
      throw err;
    }
  }

  generateDeterministicItinerary(allPlaces: Place[], req: PlannerRequest): ItineraryOutput {
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));
    const selectedSet = new Set(req.selectedPlaceIds || []);

    const verified = allPlaces.filter((p) => p.sourceType !== "vr360");
    const vr360 = allPlaces.filter((p) => p.sourceType === "vr360");

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
            estimatedTravelMinutes: null,
            notes:
              place.sourceType === "vr360"
                ? "[Điểm thực tế ảo VR360] Điểm ngắm cảnh và trải nghiệm không gian 3D."
                : place.shortDescription || "Tham quan và trải nghiệm vẻ đẹp thiên nhiên.",
            orderIndex: order++,
            isUserSelected: selectedSet.has(place.id),
            place,
          });

          // Pure chronological advance by activity duration without fabricated transit buffer
          currentMin += duration;
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
        estimatedTravelMinutes: null,
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
            estimatedTravelMinutes: null,
            notes:
              place.sourceType === "vr360"
                ? "[Điểm thực tế ảo VR360] Chiêm ngưỡng không gian đại ngàn qua góc nhìn 360 độ."
                : place.shortDescription || "Trải nghiệm văn hóa và cảnh quan địa phương.",
            orderIndex: order++,
            isUserSelected: selectedSet.has(place.id),
            place,
          });

          // Pure chronological advance by activity duration without fabricated transit buffer
          currentMin += duration;
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
        estimatedTravelMinutes: null,
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

    const warnings: string[] = [
      "Khung giờ mang tính chất tham khảo CHƯA BAO GỒM thời gian di chuyển giữa các điểm. Thời gian hành trình thực tế phụ thuộc tuyến đường và phương tiện.",
    ];

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
      isFallback: true,
    };
  }

  normalizeAndEnforceItinerary(
    raw: any,
    placesMap: Map<string, Place>,
    req: PlannerRequest,
    isFallback: boolean
  ): ItineraryOutput {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.days)) {
      const fallback = this.generateDeterministicItinerary(Array.from(placesMap.values()), req);
      fallback.isFallback = true;
      return fallback;
    }

    const selectedSet = new Set(req.selectedPlaceIds || []);
    const normalizedDays: ItineraryDayOutput[] = [];
    const warnings: string[] = [
      "Khung giờ mang tính chất tham khảo CHƯA BAO GỒM thời gian di chuyển giữa các điểm. Thời gian hành trình thực tế phụ thuộc tuyến đường và phương tiện.",
    ];

    let totalValidPlaces = 0;

    for (let i = 0; i < req.durationDays; i++) {
      const dayRaw = raw.days[i];
      const dayNum = i + 1;
      const dayDate = this.calculateDate(req.startDate, i);
      const items: ItineraryItemOutput[] = [];
      const seenPlaceOnDay = new Set<string>();

      if (dayRaw && Array.isArray(dayRaw.items)) {
        let order = 0;
        for (const itemRaw of dayRaw.items) {
          const rawType = itemRaw.itemType;
          const itemType = (["place", "meal", "rest", "transport"].includes(rawType)
            ? rawType
            : "place") as ItineraryItemType;

          let placeId: string | null = null;
          let placeObj: Place | undefined = undefined;

          if (itemType === "place") {
            // Place item MUST have a valid verified placeId from D1
            if (!itemRaw.placeId || !placesMap.has(itemRaw.placeId)) {
              // Discard fabricated place without valid D1 ID
              continue;
            }
            if (seenPlaceOnDay.has(itemRaw.placeId)) {
              continue;
            }
            seenPlaceOnDay.add(itemRaw.placeId);
            placeId = itemRaw.placeId;
            placeObj = placesMap.get(itemRaw.placeId);
            totalValidPlaces++;
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

          let plannedTime: string | undefined = undefined;
          if (typeof itemRaw.plannedTime === "string" && isValidTimeFormat(itemRaw.plannedTime.slice(0, 5))) {
            plannedTime = itemRaw.plannedTime.slice(0, 5);
          }

          const rawDuration = Number(itemRaw.durationMinutes);
          const durationMinutes = Number.isInteger(rawDuration) && rawDuration >= 15 && rawDuration <= 360
            ? rawDuration
            : 60;

          items.push({
            placeId,
            itemType,
            title,
            plannedTime,
            durationMinutes,
            estimatedTravelMinutes: null,
            notes,
            orderIndex: order++,
            isUserSelected: placeId ? selectedSet.has(placeId) : false,
            place: placeObj,
          });
        }
      }

      if (items.length === 0) {
        // If a day ended up empty, fallback to deterministic itinerary
        const fallback = this.generateDeterministicItinerary(Array.from(placesMap.values()), req);
        fallback.isFallback = true;
        return fallback;
      }

      normalizedDays.push({
        dayNumber: dayNum,
        date: dayDate,
        title: typeof dayRaw?.title === "string" ? dayRaw.title.slice(0, 100) : `Khám phá Đắk Song - Ngày ${dayNum}`,
        notes: typeof dayRaw?.notes === "string" ? dayRaw.notes.slice(0, 200) : undefined,
        items,
      });
    }

    if (totalValidPlaces === 0) {
      // AI output had zero valid places from D1 -> fallback
      const fallback = this.generateDeterministicItinerary(Array.from(placesMap.values()), req);
      fallback.isFallback = true;
      return fallback;
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

  // --- CRUD Storage Operations with Server-side Validation & Atomic Batch ---

  async saveItinerary(userId: string, data: ItineraryOutput): Promise<ItineraryOutput> {
    if (!userId || typeof userId !== "string") {
      throw new ValidationError("Yêu cầu xác thực tài khoản để lưu lịch trình.", 401);
    }

    const allPlaces = await this.placeRepo.findAll();
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));
    await this.validateItineraryPayload(data, placesMap);

    const itineraryId = data.id || crypto.randomUUID();
    const interestsJson = JSON.stringify(data.interests || []);

    const batchStmts: any[] = [];
    batchStmts.push(
      this.env.DB.prepare(`
        INSERT INTO travel_itineraries (
          id, user_id, title, start_date, departure_time, duration_days,
          travelers_count, children_count, pace, transportation, budget_preference,
          interests_json, summary, status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saved', 1, datetime('now'), datetime('now'))
      `).bind(
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
    );

    const savedDays: ItineraryDayOutput[] = [];

    for (const day of data.days) {
      const dayId = crypto.randomUUID();
      batchStmts.push(
        this.env.DB.prepare(`
          INSERT INTO itinerary_days (id, itinerary_id, day_number, date, title, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(dayId, itineraryId, day.dayNumber, day.date || null, day.title || null, day.notes || null)
      );

      const savedItems: ItineraryItemOutput[] = [];

      for (let idx = 0; idx < day.items.length; idx++) {
        const item = day.items[idx];
        const itemId = crypto.randomUUID();
        const placeObj = item.placeId ? placesMap.get(item.placeId) : undefined;

        batchStmts.push(
          this.env.DB.prepare(`
            INSERT INTO itinerary_items (
              id, itinerary_id, day_id, place_id, item_type, title,
              planned_time, duration_minutes, notes, order_index, is_user_selected, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
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
        );

        savedItems.push({ ...item, id: itemId, place: placeObj, estimatedTravelMinutes: null });
      }

      savedDays.push({ ...day, id: dayId, items: savedItems });
    }

    await this.env.DB.batch(batchStmts);

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
    if (data.version === undefined || data.version === null || typeof data.version !== "number" || !Number.isInteger(data.version)) {
      throw new ValidationError("Phiên bản lịch trình (version) là bắt buộc để cập nhật.", 400);
    }

    const existing = await this.env.DB.prepare(`
      SELECT * FROM travel_itineraries WHERE id = ? AND user_id = ?
    `)
      .bind(itineraryId, userId)
      .first<any>();

    if (!existing) {
      throw new ValidationError("Không tìm thấy lịch trình hoặc bạn không có quyền truy cập.", 404);
    }

    const currentVersion = existing.version || 1;
    // Optimistic locking check: if client supplied version does not match DB, conflict!
    if (data.version !== currentVersion) {
      throw new ValidationError("Xung đột phiên bản: Lịch trình này đã được cập nhật từ thiết bị khác. Vui lòng tải lại trang.", 409);
    }

    const allPlaces = await this.placeRepo.findAll();
    const placesMap = new Map<string, Place>(allPlaces.map((p) => [p.id, p]));
    await this.validateItineraryPayload(data, placesMap);

    const newVersion = currentVersion + 1;
    const interestsJson = JSON.stringify(data.interests || []);

    const batchStmts: any[] = [];

    // 1. Update master itinerary with optimistic version check
    batchStmts.push(
      this.env.DB.prepare(`
        UPDATE travel_itineraries SET
          title = ?, start_date = ?, departure_time = ?, duration_days = ?,
          travelers_count = ?, children_count = ?, pace = ?, transportation = ?,
          budget_preference = ?, interests_json = ?, summary = ?, status = ?,
          version = ?, updated_at = datetime('now')
        WHERE id = ? AND user_id = ? AND version = ?
      `).bind(
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
        userId,
        currentVersion
      )
    );

    // 2. Database-level assertion: fails SQL execution with CHECK constraint error if master UPDATE changed 0 rows
    batchStmts.push(
      this.env.DB.prepare("INSERT INTO optimistic_lock_guard (guard_id) VALUES (changes())")
    );

    // 3. Delete existing child records
    batchStmts.push(
      this.env.DB.prepare("DELETE FROM itinerary_items WHERE itinerary_id = ?").bind(itineraryId)
    );
    batchStmts.push(
      this.env.DB.prepare("DELETE FROM itinerary_days WHERE itinerary_id = ?").bind(itineraryId)
    );

    const savedDays: ItineraryDayOutput[] = [];

    for (const day of data.days) {
      const dayId = crypto.randomUUID();
      batchStmts.push(
        this.env.DB.prepare(`
          INSERT INTO itinerary_days (id, itinerary_id, day_number, date, title, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(dayId, itineraryId, day.dayNumber, day.date || null, day.title || null, day.notes || null)
      );

      const savedItems: ItineraryItemOutput[] = [];

      for (let idx = 0; idx < day.items.length; idx++) {
        const item = day.items[idx];
        const itemId = crypto.randomUUID();
        const placeObj = item.placeId ? placesMap.get(item.placeId) : undefined;

        batchStmts.push(
          this.env.DB.prepare(`
            INSERT INTO itinerary_items (
              id, itinerary_id, day_id, place_id, item_type, title,
              planned_time, duration_minutes, notes, order_index, is_user_selected, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
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
        );

        savedItems.push({ ...item, id: itemId, place: placeObj, estimatedTravelMinutes: null });
      }

      savedDays.push({ ...day, id: dayId, items: savedItems });
    }

    // 4. Clean guard in the same atomic transaction
    batchStmts.push(
      this.env.DB.prepare("DELETE FROM optimistic_lock_guard WHERE guard_id = 1")
    );

    try {
      const batchResults = await this.env.DB.batch(batchStmts);
      const updateResult = batchResults[0] as any;
      if (updateResult && updateResult.meta && updateResult.meta.changes === 0) {
        throw new ValidationError("Xung đột phiên bản: Lịch trình này đã được cập nhật từ thiết bị khác. Vui lòng tải lại trang.", 409);
      }
    } catch (err: any) {
      if (
        (err?.message && (err.message.includes("guard_id") || err.message.includes("CHECK constraint"))) ||
        err?.status === 409
      ) {
        throw new ValidationError("Xung đột phiên bản: Lịch trình này đã được cập nhật từ thiết bị khác. Vui lòng tải lại trang.", 409);
      }
      throw err;
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
        estimatedTravelMinutes: null,
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
      pace: row.pace,
      transportation: row.transportation,
      budgetPreference: row.budget_preference,
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
