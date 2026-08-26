# GigaFlow — Full Feature Spec (Agile)

**Date:** 2026-08-26
**Companion to:** `2026-08-26-gigaflow-cloud-architecture-design.md`
**Purpose:** Nguồn chân lý cho Epics / User Stories / Acceptance Criteria — dùng để sinh Jira
task board (xem `2026-08-26-gigaflow-jira-import-prompts.md`).

## Conventions

- **Epic** = khối tính năng lớn (thường map 1 phase). **Story** = việc giao được cho 1 dev,
  demo được. **Task/Sub-task** = bước kỹ thuật trong story (để agent Jira tự chẻ nếu cần).
- **Points** (Fibonacci): 1,2,3,5,8,13. **Priority:** P0 (blocker) → P3.
- **Labels:** `backend`, `frontend`, `infra`, `ai`, `auth`, `design`, `test`.
- **AC** viết dạng Given/When/Then, kiểm chứng được.
- ID: `E<n>` cho epic, `E<n>-S<m>` cho story.

---

## EPIC E1 — Foundation & Infrastructure
**Goal:** Monorepo chạy được, deploy được lên GCP, CI/CD xanh. **Priority:** P0. **Labels:** infra, backend.
**Depends on:** —

### E1-S1 — Monorepo scaffold (5pt, P0)
Tạo pnpm workspace + Turborepo với `apps/api`, `apps/web`, `packages/shared`.
- **AC1:** `pnpm install` ở root cài mọi package; `pnpm build` build cả 3.
- **AC2:** `packages/shared` export được từ cả api và web (đường dẫn alias hoạt động).
- **AC3:** turbo cache hoạt động (build lần 2 nhanh hơn).

### E1-S2 — `packages/shared` nền tảng Zod (3pt, P0)
Khởi tạo enums + Zod base (Translatable, ObjectId helper, ApiResponse envelope).
- **AC:** import Zod schema ở api để validate và ở web để suy type, không lỗi type.

### E1-S3 — Hono app factory + health (3pt, P0) `backend`
App Hono với middleware error + logger, route `/health` (live/ready).
- **AC1:** `GET /health` trả 200 `{status:'ok'}`.
- **AC2:** lỗi trong handler → envelope lỗi thống nhất, không leak stack ở prod.

### E1-S4 — Mongo client (native driver) (3pt, P0) `backend`
Singleton connection tới Atlas qua URI từ env/Secret; helper lấy collection typed.
- **AC:** kết nối thành công tới Atlas dev; reuse connection giữa request (Cloud Run warm).

### E1-S5 — Dockerfile + Cloud Run deploy tay (5pt, P0) `infra`
Multi-stage Dockerfile cho api; deploy tay 1 lần để verify.
- **AC:** image chạy trên Cloud Run, `/health` truy cập được qua URL Cloud Run.

### E1-S6 — Terraform skeleton (8pt, P0) `infra`
GCP project riêng, GCS backend cho TF state, module cloud-run + secrets + service account (least-privilege), env dev.
- **AC1:** `terraform apply` tạo Cloud Run service + Secret Manager + SA.
- **AC2:** URI Atlas + AI keys nằm trong Secret Manager, Cloud Run đọc được.
- **AC3:** state lưu ở GCS bucket.

### E1-S7 — Firebase Hosting + rewrite `/api/**` → Cloud Run (5pt, P0) `infra`
Cấu hình Hosting; rewrite same-origin tới Cloud Run.
- **AC:** `GET https://<hosting>/api/health` trả về từ Cloud Run (không CORS).

### E1-S8 — CI/CD Cloud Build (5pt, P1) `infra`
PR → build + test + preview; merge main → deploy api (Cloud Run) + web (Hosting).
- **AC1:** PR chạy lint+test+build; fail thì chặn merge.
- **AC2:** merge main auto-deploy cả api và web.

### E1-S9 — Cloud Tasks queues via Terraform (3pt, P1) `infra`
Tạo queue `workout-gen`, `meal-gen`, `inbody-ocr` + SA có quyền enqueue + OIDC invoker.
- **AC:** enqueue thử 1 task → hit được route `/internal/tasks/*` với OIDC hợp lệ.

---

## EPIC E2 — Auth 3-mode (Firebase)
**Goal:** Guest anonymous dùng ngay; link Google/password giữ nguyên uid & data. **Priority:** P0. **Labels:** auth, backend, frontend.
**Depends on:** E1.

### E2-S1 — Firebase project + providers (2pt, P0) `infra`
Bật Anonymous, Google, Email/Password.
- **AC:** 3 provider bật ở Firebase console (dev).

### E2-S2 — `firebaseAuth` middleware (5pt, P0) `backend`
Verify ID token (firebase-admin); upsert `users` theo `authId`; gắn `c.get('user')`.
- **AC1:** request có token hợp lệ → user được set; token sai/expired → 401.
- **AC2:** lần đầu thấy `authId` → tạo user (isGuest theo provider).
- **AC3:** OIDC cho `/internal/tasks/*` tách riêng (không dùng Firebase token).

### E2-S3 — FE anonymous sign-in khi mở app (3pt, P0) `frontend` `auth`
`signInAnonymously()` nếu chưa có phiên; gắn token vào api client.
- **AC:** mở app lần đầu (chưa login) vẫn gọi được API (user guest).

### E2-S4 — Upgrade: link Google (5pt, P0) `frontend` `auth`
`linkWithCredential` từ anonymous → Google; uid giữ nguyên.
- **AC1:** sau link, `isGuest=false`, `authProvider='google'`, uid không đổi.
- **AC2:** data tạo lúc guest vẫn thuộc user sau khi link.

### E2-S5 — Upgrade: email/password (5pt, P1) `frontend` `auth`
Đăng ký/đăng nhập email-password; link từ anonymous.
- **AC:** tạo account email/password thành công; đăng nhập lại thiết bị khác thấy đúng data.

### E2-S6 — `POST /auth/session` idempotent upsert (2pt, P1) `backend`
Endpoint FE gọi sau signIn để đảm bảo user record.
- **AC:** gọi nhiều lần không tạo trùng user.

### E2-S7 — Auth UI (upgrade prompt) (5pt, P1) `frontend` `design`
Màn/hộp thoại "Tạo tài khoản để lưu tiến độ" cho guest; giữ dark design language.
- **AC:** guest thấy CTA upgrade ở nơi hợp lý (profile, sau vài buổi tập); flow mượt.

---

## EPIC E3 — Exercise Catalog
**Goal:** Thư viện bài tập + custom exercise. **Priority:** P0. **Labels:** backend, frontend.
**Depends on:** E1.

### E3-S1 — Schema + repo `exercises` (3pt, P0) `backend`
Zod schema + CRUD repo (native driver), index slug/muscleGroup/owner.
- **AC:** tạo/đọc/tìm theo muscleGroup hoạt động.

### E3-S2 — Seed thư viện (~50 bài) (3pt, P0) `backend`
Seed từ preset (tham chiếu `gymflow-docs/data-model.md`), có `defaultIncrement`, `equipmentType`.
- **AC:** chạy seed → ≥50 bài, mỗi bài đủ field bắt buộc, Translatable en/vi.

### E3-S3 — Custom exercise (guest tạo ngay) (5pt, P1) `backend` `frontend`
Guest & user tạo custom exercise (`isCustom`, `ownerUserId`).
- **AC1:** guest tạo được custom exercise ngay (không cần account).
- **AC2:** custom exercise chỉ hiện với owner; preset hiện với mọi người.

### E3-S4 — Exercise library UI (search + filter) (5pt, P1) `frontend` `design`
Tìm kiếm + filter nhóm cơ + thêm custom.
- **AC:** search < 300ms trên ~50–200 bài; filter theo nhóm cơ đúng.

---

## EPIC E4 — Workout Plan & Templates
**Goal:** Plan → Template(buổi) → Slot; queue scheduling. **Priority:** P0. **Labels:** backend, frontend.
**Depends on:** E3.

### E4-S1 — Schema plans/templates/slots (5pt, P0) `backend`
Zod + repo cho 3 collection; ràng buộc quan hệ + orderIndex.
- **AC:** tạo plan với nhiều template, mỗi template nhiều slot; đọc plan active kèm nested.

### E4-S2 — Preset templates (PPL/UL/Full-body) (5pt, P1) `backend`
Định nghĩa preset (tham chiếu PRD gymflow) → tạo plan từ template.
- **AC:** chọn 'PPL 6-day' → sinh đủ buổi + slot đúng.

### E4-S3 — Custom plan builder UI (8pt, P1) `frontend` `design`
Chọn template hoặc tạo custom; sắp xếp buổi + bài (queue).
- **AC:** onboarding tạo plan xong → về Home thấy queue buổi.

### E4-S4 — `GET /plans/active` (3pt, P0) `backend`
Trả plan active + templates + slots (đã sort orderIndex).
- **AC:** 1 request đủ dữ liệu render Home; không N+1.

### E4-S5 — Home / Today queue UI (5pt, P0) `frontend` `design`
Queue buổi theo design (dot màu, done/next/upcoming, CTA "Start").
- **AC:** buổi done mờ + thời lượng; buổi next highlight + nút Start; empty state đúng.

---

## EPIC E5 — Active Session Logging & Progression
**Goal:** Log set 2-tap; prefill target từ buổi trước. **Priority:** P0. **Labels:** backend, frontend.
**Depends on:** E4.

### E5-S1 — Schema sessions/set_logs (3pt, P0) `backend`
Zod + repo; index `{slotId, loggedAt}`.
- **AC:** tạo session, ghi set, đọc lại đúng.

### E5-S2 — `exercise_performance` cache + update hook (5pt, P0) `backend`
Cập nhật cache khi log set (last sets, bestSet e1RM, volume).
- **AC1:** log set → cache cập nhật đúng lastSets & PR (Epley e1RM).
- **AC2:** đọc cache O(1) cho prefill.

### E5-S3 — Progression rule engine (5pt, P0) `backend` `test`
Tính target theo rule (all-max→+increment; else giữ tạ +1 rep; first→repMin).
- **AC:** unit test phủ 3 nhánh + increment theo equipment; ≥90% coverage cho engine.

### E5-S4 — Start session + prefill (3pt, P0) `backend`
`POST /sessions/start` trả slot kèm `weightSuggested/repsSuggested` (từ cache + rule).
- **AC:** session mới có target điền sẵn; bài lần đầu → reps=repMin, weight=0.

### E5-S5 — Log set / finish / cancel (5pt, P0) `backend`
Endpoints ghi set, finish (tính volume/calo trừ pausedDuration), cancel.
- **AC1:** finish tính duration đúng (đã trừ pause), totalVolume/calories hợp lý.
- **AC2:** không log được vào session đã finish/cancel.

### E5-S6 — Active Session UI (2-tap) (8pt, P0) `frontend` `design`
Set box 4 trạng thái; "prev vs target"; tap=done, tap2=inline edit; progress bar.
- **AC1:** tap set → done < 100ms feedback; edit inline lưu actual + amber dot.
- **AC2:** "prev: X×Y" đọc được trong 1 giây; blue=target/green=done nhất quán.

### E5-S7 — Session Summary UI (3pt, P1) `frontend` `design`
Sau finish: thời lượng, tổng volume, PR badge.
- **AC:** hiện đúng tổng + đánh dấu PR mới.

### E5-S8 — `GET /exercises/:id/last` (2pt, P1) `backend`
Trả last performance (O(1) từ cache) để prefill/hiển thị.
- **AC:** trả đúng set gần nhất; 404-safe nếu chưa có.

---

## EPIC E6 — Rest Timer & RIR
**Goal:** Đếm rest, ghi rest thực tế; RIR optional cho mọi trình độ. **Priority:** P1. **Labels:** frontend, backend.
**Depends on:** E5.

### E6-S1 — Rest timer UI (Pause/Resume) (5pt, P1) `frontend` `design`
Đếm ngược theo default goal; hết giờ rung/beep; ghi `restSeconds`.
- **AC1:** default rest theo goal (strength ~120s...); chỉnh được.
- **AC2:** rest thực tế lưu vào set; cộng dồn `pausedDurationSeconds`.

### E6-S2 — RIR capture (newbie + expert) (5pt, P2) `frontend` `design`
Sau set hỏi optional: 3 emoji (newbie) / nhập số (expert toggle).
- **AC1:** bỏ qua vẫn log được (không chặn 2-tap).
- **AC2:** lưu `rir`; suy RPE=10−RIR khi hiển thị.

### E6-S3 — RIR ảnh hưởng progression (3pt, P2) `backend` `test`
Rule dùng RIR để tinh chỉnh (còn khỏe→nhảy mạnh; kiệt lặp→giữ/deload).
- **AC:** unit test: chuỗi RIR cao → tăng nhanh hơn; RIR 0 lặp → không tăng.

---

## EPIC E7 — AI Workout Planner
**Goal:** AI sinh plan từ profile+inbody+lịch sử; async qua Cloud Tasks. **Priority:** P1. **Labels:** ai, backend.
**Depends on:** E4, E5, E1-S9.

### E7-S1 — Unified AI engine (Gemini-first, OpenAI fallback) (8pt, P1) `ai` `backend` `test`
Interface chung + 2 provider; ưu tiên Gemini, fallback OpenAI khi lỗi/quota; structured output (Zod).
- **AC1:** gọi engine trả object đúng Zod schema; Gemini là mặc định.
- **AC2:** giả lập Gemini lỗi quota → tự fallback OpenAI; log rõ provider dùng.

### E7-S2 — Generate workout job (Cloud Tasks) (8pt, P1) `backend` `ai`
`POST /workout/plan/generate` → job queued → handler `/internal/tasks/generate-workout`.
- **AC1:** trả `jobId` ngay (202); job state trong Mongo.
- **AC2:** handler verify OIDC; sinh plan+template+slot; enrich videoUrl bulk (no N+1).
- **AC3:** thiếu ngày/slot → bổ sung default hoặc fail rõ (không im lặng như v1).

### E7-S3 — History-aware prompt (5pt, P1) `ai` `backend`
Nạp `exercise_performance` summary vào prompt để AI đề xuất tăng tải.
- **AC:** prompt chứa lịch sử; plan phản ánh progression (kiểm bằng snapshot test prompt).

### E7-S4 — Job status API + polling/FCM (3pt, P1) `backend` `frontend`
`GET /jobs/:id`; FE poll hoặc nhận FCM → refetch.
- **AC:** FE thấy trạng thái queued→processing→done; khi done tự refetch plan.

### E7-S5 — Generate plan UI flow (5pt, P2) `frontend` `design`
Onboarding "AI tạo plan"; loading state; nhận kết quả.
- **AC:** UX rõ ràng lúc chờ; lỗi hiển thị thân thiện + retry.

---

## EPIC E8 — InBody OCR
**Goal:** Upload ảnh InBody → OCR AI vision → metrics. **Priority:** P2. **Labels:** ai, backend, frontend.
**Depends on:** E7-S1, E1-S9.

### E8-S1 — Cloud Storage + signed URL (3pt, P2) `infra` `backend`
Bucket + `POST /inbody/presigned-url`.
- **AC:** FE upload trực tiếp lên GCS bằng signed URL.

### E8-S2 — Inbody OCR job (5pt, P2) `ai` `backend`
`POST /inbody/process` → Cloud Tasks → AI vision → `inbody_results`.
- **AC:** ảnh hợp lệ → metrics + aiAnalysis (structured); lỗi ảnh → báo rõ.

### E8-S3 — Inbody UI + validate ảnh (5pt, P2) `frontend` `design`
Chụp/upload (webcam), validate mờ/nghiêng, hiển thị kết quả + lịch sử.
- **AC:** cảnh báo ảnh kém trước upload; hiển thị metrics + so sánh lần trước.

### E8-S4 — Weight log (2pt, P3) `backend` `frontend`
Ghi cân nặng thủ công + biểu đồ.
- **AC:** thêm/đọc lịch sử cân nặng; chart cơ bản.

---

## EPIC E9 — Meal Planner & TDEE
**Goal:** Thực đơn AI theo TDEE (chỉ Gemini). **Priority:** P2. **Labels:** ai, backend, frontend.
**Depends on:** E7-S1.

### E9-S1 — TDEE calculator (3pt, P2) `backend` `test`
Tính BMR/TDEE theo profile.
- **AC:** unit test các công thức; khớp giá trị tham chiếu.

### E9-S2 — Meal generate job (Gemini only) (5pt, P2) `ai` `backend`
`POST /meal/plan/generate` → Cloud Tasks → Gemini → `meal_plans`.
- **AC:** trả job; kết quả có macro/calo theo ngày; cưỡng bức Gemini (không fallback OpenAI).

### E9-S3 — Meal planner UI (5pt, P3) `frontend` `design`
Hiển thị thực đơn tuần + macro; regenerate.
- **AC:** render đủ ngày/bữa; tổng macro đúng.

---

## EPIC E10 — Notifications (FCM)
**Goal:** Push khi job xong + nhắc tập. **Priority:** P2. **Labels:** backend, frontend.
**Depends on:** E2, E7.

### E10-S1 — Device token API (2pt, P2) `backend`
Đăng ký/gỡ token (`device_tokens`).
- **AC:** lưu token theo user; gỡ khi logout.

### E10-S2 — Send FCM on job complete/error (3pt, P2) `backend`
Gửi push song ngữ khi workout/meal/inbody xong hoặc lỗi.
- **AC:** job done → push tới đúng device; nội dung theo `user.language`.

### E10-S3 — FE FCM setup + permission (3pt, P2) `frontend`
Xin quyền, nhận foreground/background, deep-link vào kết quả.
- **AC:** nhận push; tap → mở đúng màn.

### E10-S4 — Cron nhắc tập/inbody (Cloud Scheduler) (3pt, P3) `infra` `backend`
Scheduler → HTTP API → gửi nhắc.
- **AC:** job cron chạy đúng lịch; gửi nhắc cho user đủ điều kiện.

---

## EPIC E11 — Analytics, PR & Statistics
**Goal:** PR tracking, awards, thống kê. **Priority:** P2. **Labels:** backend, frontend.
**Depends on:** E5.

### E11-S1 — PR detection (3pt, P2) `backend` `test`
Phát hiện PR (e1RM) khi log; đánh dấu.
- **AC:** log vượt bestSet → PR flag; test biên.

### E11-S2 — Awards/gamification (5pt, P3) `backend`
Trao award theo mốc (streak, tổng volume...) qua handler nội bộ.
- **AC:** đạt mốc → tạo award; không trùng.

### E11-S3 — Statistics UI (5pt, P3) `frontend` `design`
Biểu đồ volume/PR/tần suất theo thời gian.
- **AC:** chart theo tuần/tháng; số liệu khớp dữ liệu.

---

## EPIC E12 — Subscription & Quota
**Goal:** Giới hạn AI generation; guota cơ bản cho guest & user. **Priority:** P1. **Labels:** backend.
**Depends on:** E2.

### E12-S1 — Quota model + middleware (5pt, P1) `backend` `test`
`subscription.aiUsage`; middleware chặn khi vượt; **quota cơ bản kể cả sau khi tạo account**.
- **AC1:** vượt quota → 429 + thông báo; reset theo chu kỳ.
- **AC2:** guest và user thường cùng mức quota cơ bản (không nâng vì đăng ký).

### E12-S2 — Usage increment/rollback (3pt, P1) `backend`
Tăng khi bắt đầu job; hoàn khi job fail.
- **AC:** job fail → usage được hoàn (khắc phục v1 tính cả lần lỗi).

---

## EPIC E13 — UI/UX Design System
**Goal:** Design system dark data-forward, shadcn/ui + tokens. **Priority:** P0. **Labels:** design, frontend.
**Depends on:** E1.

### E13-S1 — Tokens + Tailwind theme (3pt, P0) `design`
CSS variables theo palette GymFlow; tabular-nums; dark-only.
- **AC:** tokens khớp `ui-design-prompt.md`; dùng xuyên suốt.

### E13-S2 — Core components (5pt, P0) `design` `frontend`
SetBox, ExerciseRow, SessionQueueItem, ProgressionBadge, SummaryRow (shadcn base).
- **AC:** component đủ trạng thái; touch ≥44px; `prefers-reduced-motion`.

### E13-S3 — i18n EN/VI (3pt, P1) `frontend`
i18next + Translatable; switch ngôn ngữ.
- **AC:** đổi ngôn ngữ đổi toàn UI; số/tạ không vỡ layout.

### E13-S4 — PWA (installable + service worker) (3pt, P1) `frontend`
vite-plugin-pwa; app shell cache; install prompt.
- **AC:** cài được PWA; mở lại nhanh; app shell hoạt động khi mạng chập chờn.

---

## EPIC E14 — Testing & Hardening
**Goal:** Chất lượng, quan sát, prod-ready. **Priority:** P1. **Labels:** test, infra, backend.
**Depends on:** tất cả.

### E14-S1 — Unit tests core logic (5pt, P1) `test`
Progression, e1RM, TDEE, quota, auth-upsert.
- **AC:** coverage core ≥ 80%; chạy trong CI.

### E14-S2 — API integration tests (5pt, P2) `test` `backend`
Test route chính với Mongo test (memory/atlas test).
- **AC:** happy path + lỗi chính có test; chạy CI.

### E14-S3 — Observability (3pt, P2) `infra` `backend`
Structured logs, error tracking, request id.
- **AC:** log truy vết được theo requestId; lỗi gom về 1 nơi.

### E14-S4 — Terraform prod env + rollout (5pt, P2) `infra`
`envs/prod`, secrets prod, min-instances/scaling, domain.
- **AC:** apply prod tạo hạ tầng đầy đủ; rollback được (revision Cloud Run).

---

## Dependency / sprint gợi ý (6 sprint × ~2 tuần)

| Sprint | Epic chính | Mục tiêu demo |
|---|---|---|
| 1 | E1, E13-S1/S2 | Deploy được `/health` + design tokens/components |
| 2 | E2, E12 | Guest dùng app + link Google + quota |
| 3 | E3, E4 | Tạo plan (preset/custom) + Home queue |
| 4 | E5, E6 | Log buổi tập 2-tap + prefill + rest timer |
| 5 | E7, E10 | AI tạo plan (Cloud Tasks) + push |
| 6 | E8, E9, E11, E14 | InBody + meal + statistics + hardening |

> Story points tổng ~ 230pt. Điều chỉnh theo velocity thực tế.
