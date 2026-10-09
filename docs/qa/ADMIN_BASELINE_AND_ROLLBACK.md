# TÀI LIỆU BASELINE VÀ QUY TRÌNH ROLLBACK (GATE 0)
# Dự án: VNA Đắk Song Smart Tourism - Phase 5A Admin Dashboard
# Ngày thực hiện: 09/10/2026

---

## 1. BASELINE VÀ THÔNG TIN MÔI TRƯỜNG

- **Git HEAD Baseline:** `39c507b821bc6871b588b953fe3a322a0acbbeb6`
- **Remote Origin:** `https://github.com/haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv.git`
- **Nhánh triển khai an toàn:** `feature/admin-dashboard` (nhánh tách biệt, tuyệt đối không commit đè lên `main`).
- **Trạng thái worktree:** Sạch 100% trước khi thực thi.

### Kết quả kiểm thử Baseline
1. `npm run typecheck`: PASS (miniapp & worker).
2. `npm test`: PASS (43/43 tests, bao gồm 29 worker tests và 14 miniapp tests).
3. `npm run build`: PASS (miniapp Vite bundle và worker deploy dry-run thành công).

---

## 2. HIỆN TRẠNG ỨNG DỤNG DEMO (LEGACY CHAT & MINI APP)

- **Mini App Frontend:** Thiết kế Eco Modern Light + Highland Nocturne Dark; Zalo Mini App ID `784313234570084849`.
- **Hồ sơ người dùng cục bộ:** Lưu tại client thông qua `AppContext` và `safeStorage`. Tùy chọn `allowAIContext` độc lập, mặc định `false`. Chưa có dữ liệu hồ sơ đồng bộ lên server.
- **Worker Runtime AI:** Đang chạy OpenAI-compatible adapter với cấu hình cố định từ Environment Variables (`AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`, `AI_REASONING_EFFORT`, `AI_JSON_MODE`).
- **D1 Database:** Migrations `0001_initial.sql`, `0002_seed.sql`, `0003_schema_update.sql` đã nạp 19 địa điểm và 42 bài viết. Không được sửa đổi các migration này.

---

## 3. CƠ CHẾ ROLLBACK KHẨN CẤP TRƯỚC GIỜ DEMO

Nếu cần chạy lại phiên bản gốc phục vụ demo ngay lập tức:

### Bước 1: Trở về nhánh chính an toàn
```powershell
git checkout main
```

### Bước 2: Tắt Feature Flags (Fail-Safe)
Trong trường hợp chạy trên nhánh tính năng nhưng muốn vô hiệu hóa toàn bộ cơ chế Admin & AI dynamic:
- Đảm bảo biến môi trường `ADMIN_AI_CONFIG_ENABLED` mang giá trị `"false"` hoặc không được khai báo.
- Worker tự động chuyển 100% lưu lượng chat về bộ provider từ Worker Environment Variables ban đầu.
- Tất cả endpoint quản trị `/api/admin/*` mặc định fail-closed.

### Bước 3: Khởi động lại dịch vụ demo
```powershell
# Chạy Mini App local
npm run dev:miniapp

# Chạy Worker local
npm run dev:worker
```

