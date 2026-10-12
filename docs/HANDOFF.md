# PROJECT HANDOFF — VNA DAK SONG SMART TOURISM

## 1. Project Overview & Repositories
- Repo: `haizzdungnay/VNA_Chat-Bot-for-Dak-Song-prv`
- Active branches: `main` (HEAD: `446f356`), `feature/admin-dashboard` (HEAD: `f2418e1`). Tree clean, remote in sync.
- Tech stack: Monorepo npm workspaces (`miniapp`, `worker`, `admin`), Node v24, TypeScript.

## 2. Infrastructure & Production Endpoints
- **Cloudflare Worker (BE)**: `https://vna-dak-song-demo.vna-daksong-tuanduong26.workers.dev`
  - Config: `worker/wrangler.demo.jsonc`
  - Secrets: `AI_API_KEY`, `ADMIN_ENCRYPTION_KEY`
- **Cloudflare D1 (DB)**: `dak-song-db-staging` (`9c1d6303-7245-4baf-a3d4-114b63f8002a`)
  - Migrations: `0001` to `0004` applied on remote D1 and local SQLite.
  - Data: 19 places (15 verified + 4 VR360), 42 articles, visitor profiles, dynamic AI profiles.
- **Zalo Mini App**:
  - App ID: `784313234570084849` | Zalo Dev App ID: `4478412936132513991`
  - Active Dev Version: `zdev-1b6f1180`
  - Deep link: `https://zalo.me/s/784313234570084849/?env=DEVELOPMENT&version=zdev-1b6f1180`
  - QR Code image: `docs/zalo_dev_qr.png`
  - Note: Fonts bundled locally via `miniapp/src/assets/fonts/MaterialSymbolsOutlined.woff2` for offline rendering.
- **Tourist Web App (Public Web)**: `https://vna-dak-song-travel.pages.dev`
  - Dual routing enabled in `miniapp/vite.config.ts` (supports both web root `/` and Zalo `/zapps/{APP_ID}`).
- **Admin Dashboard**: `https://vna-dak-song-admin.pages.dev` (Local: `http://localhost:3001`)
  - Direct proxy / API base pointing to live Cloudflare Worker staging. Real-time visitor sync.

## 3. AI Pipeline
- Current active endpoint: `https://rrdf59c.abc-tunnel.us/v1` (via 9router)
- Model: `ag/gemini-3.8-flash-low` (compatible OpenAI format)
- Fallback: Cloudflare AI Gateway architecture documented in `docs/PHASE6_ZALO_DEVELOPMENT_DEPLOY_REPORT.md` for enterprise production (avoids Google Hong Kong IP geo-blocks).

## 4. Test Suite & Validation
- Run all tests: `npm test; npm run test:admin`
- Status: 70/70 tests PASS (53 worker, 14 miniapp, 3 admin). Zero TypeScript errors.

## 5. Next Steps / Phase 7 Backlog
- Phase 0 - 6: 100% DONE.
- Phase 7 remaining:
  1. Update acceptance matrix (`docs/ACCEPTANCE_MATRIX.md`).
  2. Tag release: `git tag v1.0.0-mvp && git push origin v1.0.0-mvp`.
  3. Production review: Submit Zalo Mini App review on `mini.zalo.me` when ready for public rollout.

