# BÁO CÁO TOÀN DIỆN AUTOPILOT PHASE 6: CLOUDFLARE WORKER STAGING + GEMINI DIAGNOSTICS + ZALO MINI APP

**Dự án:** VNA Group | Đắk Song Smart Tourism — Zalo Mini App + AI Travel Assistant  
**Ngày thực hiện:** 09/10/2026  
**Môi trường:** Máy local (Windows 11 / Node v24.16.0 / Cloudflare Wrangler v4.148.0 / ZMP CLI v4.0.3)  
**Tài khoản Cloudflare:** `tuanduongdinh2004@gmail.com` (Account ID: `4fbcdcac1d35ed8a477bad98a033f6ed`)  
**Mục tiêu:** Chẩn đoán lỗi HTTP 502, xác minh Cloudflare D1 Remote & Worker Staging, đóng gói Frontend và chuẩn bị upload Zalo Mini App Development.

---

## 1. THỜI ĐIỂM, GIT & BẢO TOÀN PHIÊN PHÁT TRIỂN SONG SONG

- **Thời điểm kiểm tra:** 09/10/2026 10:35 (UTC+7)
- **Nhánh hiện tại:** `feature/admin-dashboard`
- **Commit HEAD:** `7897f8c` (`fix(admin): configure vite proxy to worker local port with env fallback`)
- **Trạng thái Working Tree:**
  - Tuyệt đối KHÔNG `git reset --hard`, KHÔNG `git clean -fd`, KHÔNG switch branch.
  - Các thay đổi của Codex Admin trên `admin/src/types/index.ts` và `worker/src/services/admin.service.ts` được giữ nguyên vẹn 100%.
  - Tệp cấu hình staging chuyên dụng `worker/wrangler.demo.jsonc` đã được hoàn thiện.

---

## 2. XÁC MINH CLOUDFLARE D1 REMOTE & WORKER STAGING (GATE 1)

### 2.1. Cơ sở dữ liệu D1 Remote (`dak-song-db-staging`)
- **Database Name:** `dak-song-db-staging`
- **Database ID:** `9c1d6303-7245-4baf-a3d4-114b63f8002a` (Region: APAC)
- **Tình trạng nạp dữ liệu:**
  - `SELECT count(*) FROM places;` -> **19 bản ghi** (15 verified từ VNA API + 4 điểm VR360 tour 3D).
  - `SELECT count(*) FROM articles;` -> **42 bài viết** toàn văn chính thống.
  - `SELECT count(*) FROM categories;` -> **4 danh mục** chuẩn MVP.
- **Ràng buộc Migration:** Bảng `d1_migrations` đã áp dụng thành công từ `0001` đến `0003`. Migration `0004` của Admin không áp dụng cưỡng bức vào bản demo để bảo vệ tính toàn vẹn của dữ liệu khách du lịch.

### 2.2. Cloudflare Worker Staging (`vna-dak-song-demo`)
- **Worker Name:** `vna-dak-song-demo`
- **Staging URL:** `https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev`
- **Version ID hiện tại:** `b221056f-fcc1-4f40-b864-da6454ccb982`
- **Kiểm tra trạng thái các endpoint LIVE:**
  - `GET /api/health`: **HTTP 200** (Latency: 343ms) -> `{"status":"ok"}`
  - `GET /api/categories`: **HTTP 200** (Latency: 238ms) -> 4 danh mục
  - `GET /api/places`: **HTTP 200** (Latency: 75ms) -> 19 địa điểm
  - `GET /api/articles`: **HTTP 200** (Latency: 75ms) -> 42 bài viết
  - `GET /api/places/:id`: **HTTP 200**
  - `GET /api/admin/overview`: **HTTP 401 Unauthorized** (Fail closed chính xác khi thiếu Cloudflare Access JWT)

---

## 3. CHẨN ĐOÁN GỐC LỖI GEMINI HTTP 502 QUA LOG THỰC TẾ (GATE 2)

### 3.1. Bằng chứng thực tế thu thập từ `wrangler tail`
Sử dụng công cụ giám sát thời gian thực `wrangler tail vna-dak-song-demo`, hệ thống đã ghi nhận 2 nguyên nhân cốt lõi gây ra lỗi 502 tại tầng upstream Google:

#### Nguyên nhân 1: Quota Free-Tier của Google Gemini API bị chạm ngưỡng (429 RESOURCE_EXHAUSTED)
```text
[TAIL OUT] POST https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev/api/chat - Ok
[TAIL OUT]   (warn) [OpenAICompatibleProvider] transient upstream 429, retrying in 1000ms...
[TAIL OUT]   (error) [OpenAICompatibleProvider] upstream error status: 429
Payload chi tiết từ Google:
{
  "code": 429,
  "status": "RESOURCE_EXHAUSTED",
  "message": "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash-lite. Please retry in 20h37m..."
}
```
- **Phân tích:** Gói miễn phí (Free Tier) của Google áp dụng hạn mức nghiêm ngặt **20 lượt gọi / ngày / project cho mỗi model**. Model `gemini-2.5-flash-lite` và `gemini-2.5-flash` trên API key hiện tại đã dùng hết 20 lượt thử nghiệm của ngày hôm nay.

#### Nguyên nhân 2: Giới hạn địa lý của Google đối với Node mạng Cloudflare (400 FAILED_PRECONDITION)
```text
[TAIL OUT] POST https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev/api/chat - Ok
[TAIL OUT]   (error) [OpenAICompatibleProvider] upstream error status: 400 (code: 400, status: FAILED_PRECONDITION, message: User location is not supported for the API use.)
```
- **Phân tích:** Traffic từ Việt Nam đi qua Cloudflare Workers gói miễn phí được định tuyến ra internet qua trung tâm dữ liệu Hong Kong (`cf-ray ... -HKG`). Google Gemini API chặn các kết nối xuất phát từ Hong Kong (`User location is not supported for the API use`). Trong khi đó, các kết nối trực tiếp từ máy tính local tại Việt Nam tới Google thì thành công bình thường.

### 3.2. Đánh giá trạng thái Gate 2
- **Trạng thái:** **AI BLOCKED BY QUOTA & GEO-RESTRICTION** (Không tự ý đánh dấu PASS khi upstream Google đang chặn).
- **Hành động đề xuất dứt điểm:**
  1. *Khắc phục Quota:* Nâng cấp API Key Google AI Studio sang gói Pay-as-you-go (tính phí theo lượt dùng thực tế, giá siêu rẻ ~$0.0001/lần gọi) hoặc tạo thêm 1 key mới.
  2. *Khắc phục Geo-restriction:* Bật **Cloudflare AI Gateway** (miễn phí 100% trên Cloudflare Dashboard: *AI > AI Gateway > Create Gateway*) để làm proxy chuyển tiếp request qua hạ tầng US/Global của Cloudflare, hóa giải hoàn toàn lỗi chặn vùng của Google.

---

## 4. XÁC MINH END-TO-END BACKEND & TEST SUITE (GATE 3)

- **TypeScript Typecheck:** 0 lỗi trên toàn bộ các workspace (`miniapp`, `worker`, `admin`).
- **Unit & Integration Test Suite:** **67 / 67 tests PASS 100%**:
  - Worker Tests (53 tests):
    * Crypto AES-256-GCM envelope: PASS
    * Endpoint security allowlist & IP validation: PASS
    * Cloudflare Access JWT auth (Fail-closed): PASS
    * Admin AI profile CRUD & rollback: PASS
    * Visitor Consent opt-in/opt-out: PASS
    * Fresh migration 0001 -> 0002 -> 0003: PASS
    * Chat E2E Scenarios (chào hỏi, đa lượt, lọc ID D1, anti-injection, validation): PASS
    * Rate Limiting & Bounded Body Guard (10KB): PASS
  - Miniapp Tests (14 tests):
    * Concurrency guard & safe retry: PASS
    * History 8-turn cap & welcome exclusion: PASS
    * Personalization opt-in/out: PASS
    * HTML Sanitization DOMPurify: PASS
    * React Hooks unconditional order: PASS

---

## 5. ĐÓNG GÓI FRONTEND & KẾT NỐI ZALO MINI APP (GATE 4)

### 5.1. Cấu hình Frontend
- **Tệp môi trường:**
  - `miniapp/.env`: `APP_ID=784313234570084849`, `VITE_API_BASE_URL=https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev`
  - `miniapp/.env.production`: `VITE_API_BASE_URL=https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev`
- **Biên dịch sản xuất:**
  - Đã chạy `npm --workspace miniapp run build`.
  - Sinh thư mục `miniapp/www/` gồm các tài nguyên nén:
    * `www/index.html` (0.86 kB)
    * `www/assets/index-CCe5R9v3.css` (119.80 kB)
    * `www/assets/index.BO4hfWx-.module.js` (269.33 kB)
  - Xác minh chuỗi URL: Đã kiểm tra trực tiếp mã nguồn bundle, URL Worker Staging HTTPS được nhúng cứng hoàn toàn, không còn sót localhost hay placeholder.

### 5.2. Công cụ ZMP CLI & Đăng nhập
- **Phiên bản:** `zmp-cli` v4.0.3 (đã cài đặt toàn cục).
- **Zalo App ID liên kết:** `784313234570084849` (Tổ chức: DakSong AI VNA).
- **Trạng thái xác thực CLI hiện tại:**
  - Lệnh deploy `npx zmp-cli deploy -e -t -m "Phase 6 Development Build" -p` đã sẵn sàng nhưng trả về:
    `Error: Permission denied. Please login again. (Tips: Run 'zmp login')`.
  - Lệnh đăng nhập `npx zmp-cli login` hỗ trợ 2 cách:
    1. Quét mã QR bằng ứng dụng Zalo trên điện thoại.
    2. Sử dụng Mini App Access Token (`--token <access_token>`).

---

## 6. MA TRẬN TỔNG KẾT & KẾ HOẠCH BÀN GIAO

| Hạng mục | Trạng thái kỹ thuật | Bằng chứng kiểm tra |
| :--- | :---: | :--- |
| **Cloudflare D1 Remote** | **VERIFIED** | 19 places, 42 articles trên `dak-song-db-staging` |
| **Worker Staging APIs** | **VERIFIED** | `/api/health`, `/api/places`, `/api/articles` HTTP 200 |
| **Admin Fail-Closed** | **VERIFIED** | `/api/admin/overview` trả về HTTP 401 đúng chuẩn |
| **AI Upstream Status** | **BLOCKED (Quota & Geo)** | Google 429 (hạn mức 20 req/ngày) & 400 (chặn IP HKG) |
| **Frontend Production Build** | **VERIFIED** | Đã nhúng URL HTTPS staging vào bundle `www/` |
| **Zalo Development Upload** | **AWAITING LOGIN** | Đã sẵn sàng lệnh deploy, chờ phiên xác thực Zalo |
| **Kiểm thử trên Zalo thật** | **REAL_DEVICE_NOT_VERIFIED** | Chờ quét mã sau khi upload |

---

## 7. DUY NHẤT HÀNH ĐỘNG CẦN CHỦ DỰ ÁN THỰC HIỆN

Hệ thống đã hoàn tất 100% các bước tự động hóa trên máy local. Để hoàn tất bước tải bản thử nghiệm lên Zalo, anh trai chỉ cần thực hiện **1 trong 2 thao tác xác thực Zalo** dưới đây:

### Cách 1: Đăng nhập bằng mã QR (Khuyên dùng - nhanh nhất)
Mở cửa sổ terminal PowerShell tại thư mục dự án và chạy:
```powershell
cd miniapp
npx zmp-cli login
```
- Nhập App ID: `784313234570084849`
- Chọn `1. Login Via QR Code With Zalo App`
- Mở Zalo trên điện thoại, quét mã QR hiển thị trên màn hình để xác nhận đăng nhập.

### Cách 2: Đăng nhập bằng Access Token (Nếu không muốn quét QR)
Truy cập trang [Zalo Mini App Center](https://mini.zalo.me) > Chọn app `AI chatbot Dak Song` > Cài đặt dự án > Lấy Access Token, sau đó chạy:
```powershell
cd miniapp
npx zmp-cli login --app-id 784313234570084849 --token <DÁN_TOKEN_VÀO_ĐÂY>
```

**Sau khi anh đăng nhập xong:**
Chỉ cần chạy tiếp một lệnh duy nhất để tải bản Development lên Zalo:
```powershell
npx zmp-cli deploy -e -t -m "Phase 6 Development Build" -p
```
Mã QR của bản thử nghiệm sẽ xuất hiện ngay trên màn hình để anh mở app trên điện thoại Zalo thật!
