# SỔ TAY HƯỚNG DẪN THỰC THI DỰ ÁN CHO CODEX
(CODEX EXECUTION RUNBOOK — POST PHASE 2-5 CLOSURE)

**Dự án:** VNA Group — Đắk Song Smart Tourism Zalo Mini App & AI Travel Assistant  
**Ngày cập nhật:** 09/10/2026  
**Phiên bản:** 2.0 (Khép lại Phase 2 đến Phase 5, sẵn sàng bàn giao Phase 6)  

---

## 1. NGUYÊN TẮC BẢO VỆ CỐT LÕI (CORE GUARDRAILS)

1. **Bảo toàn dữ liệu nguồn VNA:** 100% dữ liệu lấy từ API `https://core-360.vnaapi.com/` và tour thực tế ảo `daksong-daknong.vnasw.vn`. Tuyệt đối không tự bịa đặt giờ mở cửa, số điện thoại, giá vé hoặc tọa độ GPS.
2. **Bảo mật bí mật:** Không log, commit hoặc để lộ API Key AI hoặc file `.dev.vars` vào mã nguồn git.
3. **Thứ tự Migration D1 an toàn:** Schema và dữ liệu được phân chia theo 3 tệp chuẩn:
   - `0001_initial.sql`: Schema categories, places ban đầu.
   - `0002_seed.sql`: Seed categories và 19 places tương thích schema 0001.
   - `0003_schema_update.sql`: Thêm `source_type`, cấu hình điểm `vr360`, tạo bảng `articles` và nạp 42 bài viết.
4. **Không đụng chạm Production khi chưa có chỉ thị:** Toàn bộ lệnh deploy remote hoặc cập nhật production D1 phải có sự phê duyệt từ Product Owner.

---

## 2. QUY TRÌNH THIẾT LẬP TỪ MÁY MỚI (CLEAN SETUP RUNBOOK)

### Bước 1: Khởi tạo và cài đặt dependencies
```bash
# Kiểm tra Node (yêu cầu Node >= 20, khuyến nghị Node 22 hoặc 24)
node -v

# Cài đặt sạch các gói phụ thuộc
npm ci
```

### Bước 2: Dựng cơ sở dữ liệu Cloudflare D1 cục bộ từ đầu
```bash
# Di chuyển vào thư mục worker và áp dụng toàn bộ migration sạch từ 0001 đến 0003
cd worker
npx wrangler d1 migrations apply dak-song-db --local
cd ..
```

### Bước 3: Kiểm tra tính toàn vẹn của dữ liệu D1
```bash
cd worker
# Kiểm tra số lượng địa điểm (kỳ vọng: 19)
npx wrangler d1 execute dak-song-db --local --command "SELECT count(*) as places_count FROM places;"

# Kiểm tra số lượng bài viết (kỳ vọng: 42)
npx wrangler d1 execute dak-song-db --local --command "SELECT count(*) as articles_count FROM articles;"

# Kiểm tra phân loại nguồn (kỳ vọng: 15 verified, 4 vr360)
npx wrangler d1 execute dak-song-db --local --command "SELECT source_type, count(*) FROM places GROUP BY source_type;"

# Kiểm tra ràng buộc khóa ngoại (kỳ vọng: rỗng / 0 vi phạm)
npx wrangler d1 execute dak-song-db --local --command "PRAGMA foreign_key_check;"
cd ..
```

---

## 3. CÔNG CỤ ĐỒNG BỘ DỮ LIỆU CHÍNH THỨC (SYNC CLI TOOL)

### Chế độ xem trước (Dry-Run — không ghi disk / DB):
```bash
node scripts/sync-upstream-content.mjs --dry-run
```

### Chế độ áp dụng chính thức (Apply — cập nhật seed & knowledge base):
```bash
node scripts/sync-upstream-content.mjs --apply
# Sau khi sinh xong file, áp dụng vào D1 cục bộ:
cd worker && npx wrangler d1 migrations apply dak-song-db --local && cd ..
```

---

## 4. BỘ LỆNH KIỂM THỬ VÀ BIÊN DỊCH TOÀN BỘ (VERIFICATION COMMANDS)

```bash
# 1. Kiểm tra kiểu tĩnh TypeScript (0 lỗi)
npm run typecheck

# 2. Chạy toàn bộ 43 bài kiểm thử tự động (Worker + Miniapp)
npm test

# 3. Biên dịch sản phẩm sản xuất (Vite build + Wrangler dry-run)
npm run build
```

---

## 5. KHỞI CHẠY MÔI TRƯỜNG PHÁT TRIỂN CỤC BỘ (DEV SERVERS)

- **Terminal 1 (Backend Worker):**
  ```bash
  npm run dev:worker
  # API chạy tại http://127.0.0.1:8787
  ```

- **Terminal 2 (Frontend Zalo Mini App):**
  ```bash
  npm run dev:miniapp
  # Web giao diện chạy tại http://localhost:5173
  ```

---

## 6. XỬ LÝ SỰ CỐ PHỔ BIẾN (TROUBLESHOOTING)

1. **Lỗi `table places has no column named source_type`:**
   - *Nguyên nhân:* Thứ tự migration cũ chèn seed trước khi thêm cột.
   - *Khắc phục:* Đã được giải quyết triệt để tại commit Phase 2. Thứ tự 0001 -> 0002 -> 0003 hiện nay hoàn toàn độc lập và không phụ thuộc chéo.
2. **Lỗi `AI upstream status: 429`:**
   - *Nguyên nhân:* Khóa Google Gemini dev Free-tier đạt hạn mức cuộc gọi trong ngày.
   - *Khắc phục:* Trợ lý đã có cơ chế tự động thử lại một lần và phản hồi thông báo thân thiện. Để chạy kiểm thử diện rộng, cần cấu hình API key trả phí trong `worker/.dev.vars`.
3. **Lỗi `Cannot find module ... in node --test`:**
   - *Nguyên nhân:* Module TypeScript chạy trực tiếp trên ESM.
   - *Khắc phục:* Đã có loader `--import ./scripts/ts-register.mjs`, đã được gắn sẵn trong `package.json`.
