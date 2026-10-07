# VNA Đắk Song Travel Mini App & Backend Skeleton

Foundation skeleton cho dự án **Zalo Mini App du lịch Đắk Song** do VNA phát triển.

---

## 1. Kiến trúc hệ thống (Architecture)

```text
Zalo Mini App (React 18 + Vite + zmp-sdk + zmp-ui)
                 │
                 │ HTTPS REST API
                 ▼
       Cloudflare Worker (Native Fetch Router)
                 │
        ┌────────┴────────┐
        ▼                 ▼
Cloudflare D1       AI Provider (Adapter Pattern)
  (SQLite DB)             ├─ WorkersAIProvider (@cf/meta/llama-3.1-8b-instruct-fast)
                          └─ OpenAICompatibleProvider (REST Chat Completions)
```

---

## 2. Cấu trúc thư mục (Repository Tree)

```text
VNA_Chat-Bot-for-Dak-Song-prv/
├── miniapp/                      # Frontend Zalo Mini App
│   ├── src/
│   │   ├── components/           # Layout, PlaceCard, StateView (Loading/Error/Empty)
│   │   ├── constants/            # Suggestion chips, Navigation items
│   │   ├── css/                  # Base styles
│   │   ├── pages/                # HomePage, ExplorePage, PlaceDetailPage, AIChatPage
│   │   ├── services/             # API client (fetch backend)
│   │   ├── types/                # Shared TypeScript contracts (Place, Category, Chat)
│   │   ├── app.tsx               # Entrypoint & Router
│   │   └── vite-env.d.ts
│   ├── app-config.json           # Zalo Mini App configuration
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts            # Vite + zmp-vite-plugin
│   └── .env.example
│
├── worker/                       # Backend Cloudflare Worker
│   ├── migrations/
│   │   ├── 0001_initial.sql      # Schema: categories, places (images_json, metadata), indexes
│   │   └── 0002_seed.sql         # Dữ liệu placeholder phát triển rõ ràng
│   ├── src/
│   │   ├── prompts/              # System prompt trợ lý du lịch Đắk Song
│   │   ├── repositories/         # CategoryRepository, PlaceRepository (D1 access)
│   │   ├── routes/               # Health, Categories, Places, Chat
│   │   ├── services/             # ChatService, AI Provider (Workers AI & OpenAI-compatible)
│   │   ├── types/                # Worker Env, Contracts, AI Provider interfaces
│   │   ├── utils/                # CORS response helpers, errors, native router
│   │   └── index.ts              # Worker native fetch handler
│   ├── test/                     # Router unit tests (node:test)
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.jsonc            # Cloudflare Worker v4 & D1/AI bindings
│   └── .dev.vars.example
│
├── .gitignore
├── package.json                  # Root npm workspaces
└── README.md
```

---

## 3. Yêu cầu môi trường (Prerequisites)

- **Node.js**: v18.0.0 trở lên (khuyến nghị v20+)
- **npm**: v9.0.0 trở lên
- **Zalo Mini App CLI**: cài toàn cục `npm install -g zmp-cli` (khi cần deploy/login Zalo)
- **Tài khoản Cloudflare** & **Wrangler v4**: đã cài đặt qua devDependencies

---

## 4. Hướng dẫn thiết lập & chạy (Development Commands)

### 4.1 Cài đặt dependencies
Chạy tại thư mục gốc:
```bash
npm install
```

### 4.2 Thiết lập biến môi trường
1. Frontend:
   ```bash
   cp miniapp/.env.example miniapp/.env
   ```
   Cập nhật `VITE_API_BASE_URL` (mặc định `http://localhost:8787`).

2. Worker:
   ```bash
   cp worker/.dev.vars.example worker/.dev.vars
   ```
   Cấu hình `AI_PROVIDER` (`workers-ai` hoặc `openai-compatible`), model (mặc định `@cf/meta/llama-3.1-8b-instruct-fast`), `AI_JSON_MODE=false` nếu provider bên ngoài không hỗ trợ json object format.

### 4.3 Khởi tạo Cloudflare D1 Database
Tạo D1 database trên Cloudflare:
```bash
npx --workspace worker wrangler d1 create dak-song-db
```
*Lưu ý: Sau khi tạo, copy `database_id` điền vào file `worker/wrangler.jsonc` tại mục `d1_databases`.*

### 4.4 Chạy Migration & Seed dữ liệu
Chạy trên môi trường local:
```bash
# 1. Tạo bảng
npx --workspace worker wrangler d1 execute dak-song-db --local --file migrations/0001_initial.sql

# 2. Seed dữ liệu mẫu (Placeholder dev data rõ ràng)
npx --workspace worker wrangler d1 execute dak-song-db --local --file migrations/0002_seed.sql
```

Chạy trên môi trường production (Cloudflare Remote):
```bash
npx --workspace worker wrangler d1 execute dak-song-db --remote --file migrations/0001_initial.sql
npx --workspace worker wrangler d1 execute dak-song-db --remote --file migrations/0002_seed.sql
```

### 4.5 Sinh Worker Types
```bash
npm --workspace worker run cf-typegen
```

### 4.6 Khởi chạy môi trường phát triển (Local Development)
- **Chạy song song Worker và Mini App:**
  - Terminal 1 (Backend Worker):
    ```bash
    npm run dev:worker
    ```
    Worker sẽ lắng nghe tại `http://localhost:8787`.
  - Terminal 2 (Frontend Mini App):
    ```bash
    npm run dev:miniapp
    ```
    Mini App Vite dev server sẽ khởi chạy tại `http://localhost:5173` (hoặc port được cấp).

### 4.7 Kiểm tra & Build (Typecheck & Build Validation)
```bash
# Chạy toàn bộ test
npm run test

# Typecheck cả 2 workspace
npm run typecheck

# Build Mini App ra miniapp/www và validate Worker bundle qua Wrangler dry-run
npm run build
```

### 4.8 Deploy
1. **Deploy Backend Worker:**
   ```bash
   npm --workspace worker run deploy
   ```
2. **Deploy Zalo Mini App:**
   - Đăng nhập Zalo: `zmp login`
   - Điền `appId` vào cấu hình nếu cần
   - Deploy: `zmp deploy` (hoặc chạy trong `miniapp/`)

---

## 5. Quy tắc về dữ liệu địa điểm (Data Notice)

Dữ liệu ban đầu trong `0002_seed.sql` là **dữ liệu mẫu phục vụ kiểm thử (placeholder rõ ràng: Địa điểm mẫu 01..04)** với các trường tọa độ, địa chỉ, số điện thoại để `NULL`.
TUYỆT ĐỐI không tự sáng tác giá vé, số điện thoại, giờ hoạt động hoặc dữ liệu chưa được xác minh của huyện Đắk Song. Khi có dữ liệu kiểm chứng chính thức từ địa phương/VNA, sẽ cập nhật migration dữ liệu thật.
