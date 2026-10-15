# BAO CAO NGHIEM THU VA VA LOI P1-QZ-08 (PHASE 8.4.4a)
**Ngay thuc hien:** 14/10/2026 (Asia/Ho_Chi_Minh)
**Nguoi thuc hien:** Codex (Local Developer Agent)
**Nguoi review doc lap:** ChatGPT (External Reviewer)
**Trang thai review:** Codex tested: PASS - Cho ChatGPT review doc lap
**Branch:** `feature/phase8-tourism-quiz` (Baseline: `1b98eef` / `3b6dc04`, Main giu nguyen `c2d7673`)

---

## 1. NGUYEN NHAN GOC (ROOT CAUSE) - P1-QZ-08
Trong Phase 8.4.4 tro ve truoc, co che anti-cheat da an cac truong `isCorrect`, `correctOptionId`, `explanation` tren tung cau hoi khi `status = 'in_progress'`. Tuy nhien, cac chi so cham diem tong hop (aggregate grading) van bi ro ri qua 3 duong dan API:
1. **`GET /api/quiz/attempts/:id` (`quizService.getAttempt`):** Khi nguoi dung nop cau tra loi, bang `quiz_attempts` da cap nhat `score`, `correct_count`, `incorrect_count`. Khi goi `getAttempt()`, backend van serialize `score`, `correctCount`, `incorrectCount`, `percentage`. Nguoi dung co the so sanh `score` truoc va sau khi nop de suy ra dap an vua nop la Dung hay Sai truoc khi hoan thanh bai thi.
2. **`GET /api/quiz/daily` (`quizService.getDailyChallenge`):** Truong `score` tra ve `existingAttempt?.score` truc tiep ke ca khi attempt dang `in_progress`.
3. **`GET /api/quiz/history` (`quizService.getUserHistory`):** Cau lenh `SELECT a.*` tra ve toan bo row tho, de lo `score`, `correct_count`, `incorrect_count` cua cac attempt dang `in_progress`.

---

## 2. BIEN PHAP VA MINIMAL (DANH SACH FILE THAY DOI)

### A. Worker Backend
- **`worker/src/services/quiz.service.ts`:**
  - `getAttempt()`: Khi `attempt.status !== 'completed'`, bat buoc che toan bo chi so grading: `score = null`, `correctCount = null`, `incorrectCount = null`, `unansweredCount = null`, `percentage = null`. Giu lai `answeredCount` (so cau da nop, khong bao gom dung/sai) va thong tin tien do an toan.
  - `getDailyChallenge()`: `score` chi duoc tra ve gia tri thuc khi `existingAttempt?.status === 'completed'`, con lai tra `null`.
  - `getUserHistory()`: Chuyen sang DTO an toan, khong tra `SELECT a.*`. Moi attempt co `status !== 'completed'` deu co `score = null`, `correctCount = null`, `incorrectCount = null`, `percentage = null`.
- **`worker/test/tourism-quiz.test.mjs`:**
  - Cap nhat **Scenario 3**: Thay `assert.ok(stats.totalScore >= 30)` bang `assert.equal(stats.totalScore, 30)` va kiem tra chinh xac `totalCorrect = 3`, `totalQuestionsAnswered = 3`, `lastAttemptAt = att2.completed_at`.
  - Cap nhat **Scenario 5**: So sanh snapshot toan bo row content cua `quiz_attempts` va `quiz_attempt_answers` (`deepEqual`) thay vi chi so sanh `count(*)`.
  - Cap nhat **Scenario 6**: Trien khai test race / interleaving thuc su giua `finishAttempt` va `reconcileUserStats` qua `Promise.all` voi ca hai thu tu khoi tao A/B. Chung minh loi stale-write cua kieu doc-ghi da buoc trong 8.4.3 va tinh bat bien, chong ghi de cua single-SQL atomic reconcile trong 8.4.4.
  - Bo sung test **P1-QZ-08-01**: Practice attempt khong lo `score`, `correctCount`, `percentage` qua `GET attempt`, `GET history` khi `in_progress`; kiem tra de quy JSON (recursive inspection) loai tru 100% private grading fields.
  - Bo sung test **P1-QZ-08-02**: Daily challenge khong lo `score` qua `GET daily`, `GET attempt`, `GET stats` khi `in_progress`.
- **`worker/test/quiz-concurrency-tier-c.test.mjs`:**
  - Mo rong Step 9: HTTP E2E qua live local workerd 8788 kiem tra `score === null`, `correctCount === null`, `percentage === null` tren ca `GET /api/quiz/attempts/:id`, `GET /api/quiz/history` khi bai dang `in_progress`.

### B. Miniapp Frontend
- **`miniapp/src/types/index.ts`:** Cap nhat interface `QuizAttemptDetail`: `score`, `correctCount`, `incorrectCount`, `unansweredCount`, `percentage` co kieu `number | null`.
- **`miniapp/src/pages/quiz-play.tsx`:** Sua banner phan hoi cau tra loi: khi `isCorrect === undefined` (API khong tra ve tinh dung sai), hien thi thong bao trung tinh an toan ("Da ghi nhan phuong an. Tiep tuc cau tiep theo.") thay vi hien thi sai "Chua chinh xac!".
- **`miniapp/src/pages/quiz-history.tsx`:** Voi attempt `in_progress`, hien thi diem `--`, trang thai `Dang thi` va tieu de so cau `Dang lam do`. Click vao chuyen huong ve `/quiz/play?attemptId=...`.
- **`miniapp/src/pages/quiz.tsx`:** Khi Daily Challenge dang `in_progress`, nut bam hien `Lam tiep` va chuyen huong ve `/quiz/play`.
- **`miniapp/src/pages/quiz-result.tsx`:** Neu nguoi dung co tinh truy cap ket qua cua attempt `in_progress`, tu dong chuyen huong sang man hinh lam bai `/quiz/play`.
- **`miniapp/test/fe-quiz.test.mjs`:** Bo sung test FE ve logic che diem va phan nhanh giao dien an toan cho attempt `in_progress`.

### C. Documentation
- **`docs/PHASE8_4_4_FINAL_CLOSURE_REPORT.md`:** Dinh chinh so luong test cua `travel-planner.test.mjs` tu 15 thanh 14 (tong 17 file giu dung 149 tests).

---

## 3. CHUNG MINH THUC NGHIEM (SOURCE VS EXECUTED EVIDENCE)

### A. Thong ke Source Test (Static File Inspection)
- **Worker (17 test files):**
  1. `admin-backend.test.mjs`: 27 tests
  2. `ai-config-switch.test.mjs`: 4 tests
  3. `business-booking.test.mjs`: 7 tests
  4. `chat-e2e-scenarios.test.mjs`: 7 tests
  5. `d1-concurrency.test.mjs`: 1 test
  6. `hardening-concurrency.test.mjs`: 13 tests
  7. `hardening-validation-d1.test.mjs`: 8 tests
  8. `identity-auth.test.mjs`: 9 tests
  9. `migrations.test.mjs`: 12 tests
  10. `openai-compatible.test.mjs`: 3 tests
  11. `quiz-concurrency-tier-c.test.mjs`: 1 test (Live HTTP Tier C)
  12. `router.test.js`: 3 tests
  13. `security.test.mjs`: 7 tests
  14. `sync-adapter.test.mjs`: 6 tests
  15. `tourism-quiz.test.mjs`: 26 tests (24 cu + 2 test P1-QZ-08 moi)
  16. `travel-planner.test.mjs`: 14 tests
  17. `visitor-consent.test.mjs`: 3 tests
  *Tong so test Worker static:* **151 tests**.
- **Miniapp (5 test files):** `fe-logic` (14), `fe-auth` (4), `fe-planner` (6), `fe-booking` (3), `fe-quiz` (6). *Tong:* **33 tests**.
- **Admin (3 test files):** `admin-ui` (3), `admin-business` (4), `admin-quiz` (3). *Tong:* **10 tests**.
- **Tong toan monorepo:** **194 tests**.

### B. Ket qua chay thuc te tren may (Executed Local TAP Runner Output)

#### 1. Worker Test Run (`npm test -w worker`)
- **Exit Code:** `0`
- **TAP Summary:**
```text
ℹ tests 151
ℹ suites 0
ℹ pass 151
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 15248.7352
```

#### 2. Miniapp Test Run (`npm test -w miniapp`)
- **Exit Code:** `0`
- **TAP Summary:**
```text
ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 307.1308
```

#### 3. Admin Test Run (`npm test -w admin`)
- **Exit Code:** `0`
- **TAP Summary:**
```text
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 155.6943
```

#### 4. Typecheck Toan Bo Monorepo (`npm run --workspaces typecheck`)
- **Exit Code:** `0`
- **Log:**
```text
> miniapp@0.1.0 typecheck
> tsc --noEmit

> worker@0.1.0 typecheck
> tsc --noEmit

> admin@0.1.0 typecheck
> tsc --noEmit
```

#### 5. Production Build Toan Bo Monorepo (`npm run --workspaces build`)
- **Exit Code:** `0`
- **Log:**
```text
> miniapp@0.1.0 build
✓ built in 9.39s

> worker@0.1.0 build
Total Upload: 346.71 KiB / gzip: 66.03 KiB
--dry-run: exiting now.

> admin@0.1.0 build
✓ built in 5.52s
```

---

## 4. MA TRAN KIEM DINH ACCEPTANCE GATES (G1 - G6)

| Ma Gate | Noi dung yeu cau | Ket qua kiem dinh Codex | Trang thai chap nhan |
|---|---|---|---|
| **G1** | Single atomic SQL reconcile, bang chung race/concurrency ro rang | Da bo sung test Scenario 6 co latch / Promise.all A/B, chung minh tinh serializable va ngan chan stale-write. | **Codex tested: PASS** (Cho ChatGPT review doc lap) |
| **G2** | Semantics user stats chinh xac | Khong tinh in_progress vao attempts/score; sau finish tinh exact; Scenario 3 assert exact 30. | **Codex tested: PASS** (Cho ChatGPT review doc lap) |
| **G3** | KHONG leak grading metrics khi in_progress qua bat ky API nao | Che 100% score/correctCount/percentage thanh null; recursive inspection test PASS; Step 9 Tier C PASS. | **Codex tested: PASS** (Cho ChatGPT review doc lap) |
| **G4** | Local D1 SQL + HTTP Tier C live workerd 8788, zero silent skip | Local dev server khoi chay 8788, 151/151 worker test PASS voi **0 skipped**. | **Codex tested: PASS** (Cho ChatGPT review doc lap) |
| **G5** | Bang chung thuc chay TAP runner, log thuc, exit code = 0 | 194/194 tests pass across 3 workspaces, exit code 0 toan bo. | **Codex tested: PASS** (Cho ChatGPT review doc lap) |
| **G6** | Git safety, minimal change, main bat bien, khong deploy | Branch `feature/phase8-tourism-quiz`, main nguyen ven tai `c2d7673`, khong deploy remote. | **Codex tested: PASS** (Cho ChatGPT review doc lap) |

---

## 5. SO DANG KY QA (CON MO THEO QUY DINH)
1. **Remote Cloudflare D1 Concurrency:** Khong deploy remote theo ton chi localhost-first; tiep tuc duy tri OPEN danh cho phase deploy remote production.
2. **Historical Refund Reconciliation (Phase 8.3):** Duy tri OPEN cho den khi tich hop cong thanh toan thuc.
3. **P1-QZ-08 Verification:** Trang thai hien tai la **Codex tested: PASS**, CHUA tu dong dong Phase 8.4; cho ChatGPT review doc lap commit nay.

