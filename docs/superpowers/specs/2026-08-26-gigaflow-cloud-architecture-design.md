# GigaFlow — Cloud Architecture Design (v2)

**Date:** 2026-08-26
**Status:** Draft for review
**Owner account (GCP/Firebase):** uitbestteam@gmail.com
**Repo:** `gigaflow` (reuse existing repo; no new repo)

---

## 1. Context & Goal

GigaFlow là project **mới, tách hoàn toàn** khỏi GigaFit v1 (`giga-fit`): repo riêng,
codebase riêng, deploy riêng, UI/UX làm lại. Mục tiêu là hợp nhất hai thứ tốt nhất:

- **Từ GymFlow (docs sẵn có trong repo này):** model workout ưu việt — history neo vào
  *slot*, progression tự tính, scheduling dạng *queue*, UX "2 tap/set", UI dark data-forward.
- **Từ GigaFit v1:** các feature backend đã chứng minh — AI workout/meal planner (OpenAI +
  Gemini fallback), InBody OCR bằng AI vision, FCM push, subscription/quota, analytics/awards,
  i18n EN/VI.

Trên nền một **stack cloud-native mới**: monorepo, Hono, MongoDB Atlas, Firebase Auth 3-mode,
Cloud Tasks, Firebase Hosting, toàn bộ hạ tầng bằng Terraform trên GCP.

### Quan hệ với docs cũ

Spec này **thay thế** các spec MVP client-only trước đó
(`2026-07-23-gymflow-*`) ở phần kiến trúc: GigaFlow là **backend-first + cloud sync**, không
còn là app Dexie/IndexedDB thuần offline. Các tài liệu cũ (`gymflow-docs/PRD.md`,
`data-model.md`, `ui-design-prompt.md`) vẫn giữ giá trị làm **nguồn tham chiếu cho workout UX,
progression algorithm và design language**.

---

## 2. Locked decisions (đã chốt với product owner)

| Chủ đề | Quyết định | Ghi chú |
|---|---|---|
| Kiểu project | Greenfield v2, tách hẳn v1 | Repo `gigaflow` |
| Repo shape | **Monorepo** (pnpm + Turborepo) | `apps/api`, `apps/web`, `packages/shared` |
| Backend | **Hono** trên Cloud Run | Nhẹ, cold-start nhanh, RPC typed client, Zod-first |
| Data access | **MongoDB native driver + Zod** | Không Mongoose; type từ Zod ở `packages/shared` |
| Database | **MongoDB Atlas** (region GCP `asia-southeast1`) | Giữ document model, tối ưu lại schema |
| Frontend | **React + Vite + PWA**, online-first + cache | shadcn/ui + Tailwind, TanStack Query + Zustand |
| Web deploy | **Firebase Hosting** | CDN + free tier tốt cho static PWA |
| Auth | **Firebase Auth** — Google + email/password + anonymous | anonymous → link (giữ uid) |
| Jobs | **Cloud Tasks** (không Redis) | 1M task/tháng free; job status lưu Mongo |
| File storage | **Cloud Storage** (thay S3) | Signed URL cho inbody/body photo |
| AI | Unified AI engine — **Gemini-first**, OpenAI fallback | Ưu tiên Gemini (rẻ); **meal chỉ Gemini** |
| IaC | **Terraform** cho toàn bộ GCP infra | Ưu tiên hàng đầu |
| i18n | EN + VI (Translatable en/vi) | Giữ từ v1 |
| Theme | Dark-only (MVP) | Theo design language GymFlow |

---

## 3. Scope

### Trong scope (v2)
- Auth 3-mode (guest anonymous → link Google/password).
- Workout: plan (template + slot), progression rule-based, AI-generated plan.
- Active session logging với 2-tap UX, rest timer, RPE/RIR optional.
- Progressive-overload memory (prefill target từ buổi trước).
- AI meal planner + TDEE.
- InBody OCR (AI vision) qua Cloud Tasks.
- FCM push notifications (job xong, nhắc tập).
- Subscription/quota (áp cho cả guest).
- Analytics: PR tracking, awards, statistics.
- Terraform IaC + Cloud Build CI/CD.

### Ngoài scope (v2)
- Di trú dữ liệu từ GigaFit v1 (project mới, bắt đầu sạch; import tùy chọn để sau).
- Light mode.
- Social login ngoài Google (Apple/Facebook để sau).
- Nutrition tracking chi tiết (ngoài meal plan).
- Web realtime multi-device sync tức thời (dùng poll/refetch là đủ).

---

## 4. Monorepo layout

```
gigaflow/
├─ apps/
│  ├─ api/                      # Hono backend → Cloud Run
│  │  ├─ src/
│  │  │  ├─ modules/            # workout, training, meal, inbody, auth, analytics, ai, notification
│  │  │  │  └─ <mod>/
│  │  │  │     ├─ <mod>.routes.ts    # Hono routes (+ zod-validator)
│  │  │  │     ├─ <mod>.service.ts   # business logic (pure, testable)
│  │  │  │     └─ <mod>.repo.ts      # Mongo access (native driver)
│  │  │  ├─ tasks/              # Cloud Tasks handlers (/internal/tasks/*)
│  │  │  ├─ lib/                # db client, firebase-admin, cloud-tasks, storage, ai
│  │  │  ├─ middleware/         # firebaseAuth, error, logger, quota
│  │  │  └─ index.ts            # app factory + route mount
│  │  ├─ Dockerfile
│  │  └─ package.json
│  └─ web/                      # React + Vite PWA → Firebase Hosting
│     ├─ src/
│     │  ├─ components/         # atoms/molecules/organisms (shadcn/ui base)
│     │  ├─ features/           # home, session, plan-setup, meal, inbody, profile, auth
│     │  ├─ lib/                # api client (Hono RPC), firebase, query client
│     │  ├─ store/              # zustand (ui/session-local state)
│     │  └─ i18n/
│     └─ package.json
├─ packages/
│  └─ shared/                   # Zod schemas + inferred types + enums (nguồn chân lý)
│     └─ src/{schemas,enums,types}
├─ infra/                       # Terraform (toàn bộ GCP)
│  ├─ modules/{cloud-run,cloud-tasks,storage,secrets,hosting,scheduler}
│  ├─ envs/{dev,prod}
│  └─ main.tf
├─ .github/workflows/ hoặc cloudbuild.yaml
├─ turbo.json
└─ pnpm-workspace.yaml
```

**Nguyên tắc type-safety:** mọi DTO/entity định nghĩa **một lần** bằng Zod trong
`packages/shared`. Backend validate input/output bằng chính schema đó; frontend nhận type qua
Hono RPC client → không còn lệch DTO như v1.

---

## 5. Data Model (MongoDB, Zod-first)

Tất cả collection định nghĩa bằng Zod trong `packages/shared`. `_id` là `ObjectId` (string ở
API boundary). Denormalize có chủ đích cho tốc độ đọc; giữ `exerciseId` làm khóa liên kết catalog.

### 5.1 `users`
```ts
{
  _id, authId,                 // Firebase uid — unique index
  authSource: 'firebase',      // enum, mở rộng sau
  authProvider: 'anonymous' | 'password' | 'google',
  isGuest: boolean,            // true khi anonymous chưa link
  email?: string,
  displayName?: string,
  timezone: string,            // default 'Asia/Ho_Chi_Minh' — FIX bug TZ của v1
  language: 'en' | 'vi',
  profile?: { goal, experienceLevel, gender, height, weight, targetWeight,
              activityLevel, trainingEnvironment },
  subscription: { plan, aiUsage: { workout, meal, inbody }, periodStart },
  createdAt, updatedAt
}
// Indexes: { authId: 1 } unique, { email: 1 } sparse
```

### 5.2 `exercises` (catalog — single source of truth)
```ts
{
  _id, slug,                   // 'bench-barbell'
  name: Translatable,          // { en, vi }
  muscleGroup: enum,
  equipmentType: 'barbell'|'dumbbell'|'machine'|'bodyweight'|'cable',
  defaultIncrement: number,    // 2.5 / 2 / 5 ...
  videoUrl?: string,
  isCustom: boolean, ownerUserId?  // custom exercise thuộc 1 user
}
// Indexes: { slug: 1 } unique, { muscleGroup: 1 }, { ownerUserId: 1 }
```

### 5.3 Workout structure (theo GymFlow — slot-anchored + queue)
```ts
// plans
{ _id, userId, name, templateType, source: 'ai'|'custom', isActive, createdAt }

// workout_templates  (= "buổi": Push A / Pull B / Legs)
{ _id, planId, name: Translatable, focus?: Translatable,
  orderIndex, colorTag: 'push'|'pull'|'legs'|'upper'|'lower'|'full'|'custom' }

// exercise_slots  (bài trong buổi — HISTORY neo vào slotId)
{ _id, templateId, exerciseId, orderIndex,
  setsTarget, repRangeMin, repRangeMax,
  equipmentType, weightIncrement }
```
> Bỏ hẳn cách key theo `{week, year, dayOfWeek}` của v1 (nguồn của bug timezone/tuần). Lịch
> tập là **queue theo `orderIndex`**, không gán cứng ngày.

### 5.4 Session logging
```ts
// training_sessions
{ _id, userId, templateId, sessionNumber,
  startedAt, finishedAt?, status: 'in_progress'|'completed'|'cancelled',
  pausedDurationSeconds?,      // trừ khỏi duration khi tính calo (FIX v1)
  totalVolume?, totalCalories?, durationSeconds?, notes? }

// set_logs  (từng set — table quan trọng nhất)
{ _id, sessionId, slotId, exerciseId, setNumber,
  weightKg, repsDone,               // thực tế
  weightSuggested, repsSuggested,   // để đo accuracy của progression
  restSeconds?,                     // rest timer thực tế
  rir?: number,                     // Reps In Reserve (optional) — xem §8
  isCompleted, loggedAt }
// Indexes: { sessionId: 1 }, { slotId: 1, loggedAt: -1 }  ← query "buổi trước theo slot"
```

### 5.5 `exercise_performance` (cache — quyết định 1.4→B)
Cập nhật mỗi khi log set xong (qua handler nội bộ). Đọc **O(1)** cho prefill + màn PR/Statistics.
```ts
{ _id, userId, exerciseId, slotId,
  lastSets: [{ weightKg, repsDone, rir? }],
  lastPerformedAt,
  bestSet: { weightKg, repsDone, e1RM },   // Personal Record (Epley e1RM)
  totalVolume, totalSessions }
// Indexes: { userId: 1, exerciseId: 1 } unique
```

### 5.6 `generation_jobs` (thay Bull job state)
```ts
{ _id, userId, type: 'workout'|'meal'|'inbody_ocr',
  status: 'queued'|'processing'|'done'|'failed',
  progress: number, resultId?, error?, createdAt, updatedAt }
// Indexes: { userId: 1, status: 1 }, TTL on createdAt (auto-clean sau N ngày)
```

### 5.7 Carried-over collections (port từ v1, giữ hình dạng)
- `meal_plans` — schedule theo ngày, macro/calo (dùng cho AI meal planner).
- `inbody_results` — metrics + aiAnalysis (structured, không còn dual-format của v1).
- `weight_logs` — lịch sử cân nặng.
- `device_tokens` — FCM tokens.
- `awards` — gamification.
- `feedback` — user feedback (+ Telegram bridge, optional).

---

## 6. Auth 3-mode (Firebase, anonymous → link)

**Nguyên tắc:** mọi user (kể cả guest) có Firebase `uid` ngay từ đầu → backend luôn có user
thật → **zero-migration khi upgrade**.

```
Mở app lần đầu (chưa login)
  FE: signInAnonymously() → idToken (authProvider=anonymous, isGuest=true)
  BE: firebaseAuth middleware verifyIdToken → upsert users{authId=uid, isGuest:true}
  → dùng full app (AI generation giới hạn quota guest)

"Tạo tài khoản" (Google hoặc email/password)
  FE: linkWithCredential(anonymousUser, credential)   // uid GIỮ NGUYÊN
  BE: cùng authId → update authProvider, email, isGuest=false
  → toàn bộ data cũ vẫn thuộc user (không cần merge)

Đăng nhập thiết bị khác
  FE: signIn Google/password → cùng uid → data đồng bộ qua backend
```

**Backend middleware `firebaseAuth()` (Hono):**
- Đọc Bearer token → `admin.auth().verifyIdToken()`.
- Upsert user theo `authId`; gắn `c.set('user', user)`.
- Route public (health) skip; route `/internal/tasks/*` verify **OIDC** của Cloud Tasks (không
  phải Firebase token).
- Bỏ hẳn: JWT tự ký, passport, refresh-token thủ công, Cognito. Firebase SDK lo refresh ở FE.

**Quota guest:** `subscription` áp cho guest với hạn mức AI thấp hơn (chống lạm dụng anonymous).

---

## 7. Workout & Progression logic

**Rule-based (mặc định, không cần AI — nhanh, đúng triết lý "2 tap/set"):**
```
Lấy set buổi gần nhất theo slotId (từ exercise_performance, O(1)):
  - TẤT CẢ set đạt repRangeMax  → weightTarget = prev + weightIncrement, reps = repRangeMin
  - CHƯA đạt                    → giữ tạ, reps = prev + 1 (cap ở repRangeMax)
  - Lần đầu                     → reps = repRangeMin, weight = 0 (user tự nhập)
Increment theo equipmentType: barbell +2.5, dumbbell +2, machine +5...
```

**AI đóng vai trò lớp trên:**
- Sinh **Plan → Template → Slot** ban đầu từ goal/experience/inbody (thay vì hard-code template).
- Định kỳ (hoặc khi user yêu cầu) review điều chỉnh slot (thêm/bớt bài, đổi rep range).
- Prefill hằng ngày **do rule lo**, không gọi AI mỗi buổi.

**RIR tinh chỉnh progression (khi có):** báo "còn khỏe" nhiều buổi → gợi ý nhảy tạ mạnh hơn;
"kiệt/không đạt reps" lặp lại → giữ hoặc đề xuất deload.

---

## 8. RPE / RIR — thiết kế cho cả newbie lẫn experienced

Dùng **RIR (Reps In Reserve — "còn mấy rep nữa thì kiệt")** thay RPE thô; trực giác hơn. Lưu 1
field `rir?: number`, suy ra RPE = 10 − RIR khi cần. **Luôn optional** (bỏ qua vẫn log được).

- **Newbie (mặc định):** sau set hỏi optional 1 câu, 3 lựa chọn hình ảnh:
  🙂 Còn khỏe (RIR 3+) · 💪 Hơi rát, còn 1–2 (RIR 1–2) · 😮‍💨 Kiệt (RIR 0)
- **Experienced:** toggle "nhập số" → RIR 0–4 (hoặc RPE 6–10) trực tiếp.
- Không ảnh hưởng UX 2-tap; chỉ dùng để tinh chỉnh progression (§7) và hiển thị insight.

---

## 9. Rest timer

- `set_logs.restSeconds` lưu thời gian nghỉ **thực tế** sau mỗi set.
- FE: nút Pause/Resume → rest timer đếm ngược, mặc định theo goal
  (strength ~120s, hypertrophy ~60–90s, có thể lấy `slot.restTarget` nếu định nghĩa). Hết giờ →
  rung/beep. Ghi lại rest thực tế.
- `training_sessions.pausedDurationSeconds` cộng dồn thời gian nghỉ → trừ khỏi `durationSeconds`
  khi tính calo (FIX v1: calo hiện tính cả lúc nghỉ nên hơi cao).
- Session-local state (timer đang chạy/còn lại) giữ ở Zustand, không đụng backend tới khi log.

---

## 10. AI Workout Planner flow (với history prefill)

```
POST /workout/plan/generate  (auth required; quota check qua middleware)
  → tạo generation_jobs{status:queued}
  → CloudTasks.enqueue(/internal/tasks/generate-workout, {userId, jobId, params})
  → trả { jobId } NGAY (202)

Cloud Tasks push → POST /internal/tasks/generate-workout  (verify OIDC)
  → job{processing}
  → gom context: profile + latest inbody + exercise_performance summary (lịch sử tập)
  → AIService.generateWorkoutPlan(context)  // OpenAI, fallback Gemini khi quota
  → enrich videoUrl từ catalog (bulk, tránh N+1)
  → tạo plan + templates + slots
  → job{done, resultId=planId}; gửi FCM

FE: poll GET /jobs/:id  hoặc nhận FCM → refetch plan (TanStack Query invalidate)
```

**Điểm mới so với v1:**
- Nạp `exercise_performance` vào prompt → AI biết user đang bench 3×10@40kg để đề xuất tăng tải.
- Job state ở Mongo, không Redis. Retry do Cloud Tasks lo (maxAttempts + backoff).
- Fix "log dối": nếu AI trả thiếu ngày/slot, **thật sự** bổ sung default hoặc báo lỗi rõ (không
  im lặng).

---

## 11. Background jobs (Cloud Tasks)

| Job | Trigger | Handler |
|---|---|---|
| generate-workout | POST /workout/plan/generate | /internal/tasks/generate-workout |
| generate-meal | POST /meal/plan/generate | /internal/tasks/generate-meal |
| inbody-ocr | POST /inbody/process (sau upload) | /internal/tasks/inbody-ocr |

- Queue Cloud Tasks tạo bằng Terraform; push HTTP tới chính API (cùng service) với OIDC token.
- Timeout dài (Cloud Run request timeout tới 300s+), phù hợp AI generation.
- Idempotency: `jobId` là task name → dedup thật sự (khắc phục bug dedup vô hiệu của v1).

---

## 12. API design (Hono + RPC + Zod)

- Mỗi module export một Hono sub-app; mount dưới prefix (`/workout`, `/training`, ...).
- Validate bằng `@hono/zod-validator` với schema từ `packages/shared`.
- Export `AppType` → `hono/client` sinh **typed client** cho `apps/web`.
- Response envelope thống nhất `{ success, data, message }` (giữ convention v1).
- Error: middleware tập trung → map sang HTTP code; validate ObjectId (fix bug 500 của v1).

Ví dụ endpoints (rút gọn):
```
POST /auth/session            # đảm bảo user tồn tại sau signIn (idempotent upsert)
GET  /plans/active            # plan đang active + templates + slots
POST /workout/plan/generate   # → job
GET  /jobs/:id
POST /sessions/start          # {templateId}
POST /sessions/:id/sets       # log set (prefill target trả kèm khi start)
POST /sessions/:id/finish
GET  /exercises/:id/last      # last performance để prefill (O(1) từ cache)
POST /inbody/presigned-url    # Cloud Storage signed URL
POST /meal/plan/generate      # → job
```

---

## 13. GCP topology + Terraform

**GCP project riêng** (owner `uitbestteam@gmail.com`), quản lý **toàn bộ bằng Terraform** (`infra/`).

| Thành phần | Dịch vụ | Terraform module |
|---|---|---|
| API | Cloud Run (min=0, autoscale) | `modules/cloud-run` |
| Jobs | Cloud Tasks queues | `modules/cloud-tasks` |
| Web | Firebase Hosting | `modules/hosting` |
| File | Cloud Storage bucket + IAM | `modules/storage` |
| Secrets | Secret Manager (AI keys, Atlas URI, FCM) | `modules/secrets` |
| Cron | Cloud Scheduler (nhắc inbody...) → HTTP API | `modules/scheduler` |
| CI/CD | Cloud Build (PR preview, main deploy) | `cloudbuild.yaml` |
| DB | MongoDB Atlas | ngoài GCP — quản lý qua Atlas TF provider (tùy chọn) |
| Auth/Push | Firebase Auth + FCM | Firebase (cấu hình qua console/TF Firebase provider) |

- State Terraform: GCS backend (bucket riêng), tách `envs/dev` và `envs/prod`.
- Service Account tối thiểu quyền cho Cloud Run (đọc Secret, enqueue Task, ghi Storage).

---

## 14. UI/UX direction

Theo **design language GymFlow** (`gymflow-docs/ui-design-prompt.md`) — dark, data-forward,
"tool dùng lúc 6h sáng ở phòng gym":

- Palette dark (#0f0f0f nền, blue=target, green=done, amber=hold), tabular-nums cho số tạ.
- **Signature:** dòng "prev vs target" side-by-side, đọc trong 1 giây.
- **2-tap/set:** tap = done (dùng target), tap lần 2 = inline edit.
- Màn chính: Home/Today (queue), Active Session, Plan Setup, Session Summary. Bổ sung cho v2:
  Meal Planner, InBody, Profile, Auth/Upgrade.
- Build trên **shadcn/ui + Tailwind** (thay "no library" của MVP cũ để đi nhanh hơn), giữ đúng
  tokens màu/typography.
- Touch target ≥ 44px, `prefers-reduced-motion`, mobile-first 390px, dark-only MVP.

---

## 15. Non-functional

- **Performance:** session screen thao tác < 100ms feedback; đọc prefill O(1) từ cache.
- **Offline:** online-first + TanStack Query cache + service worker cho app shell (không
  offline-first full — đã chốt). Ghi khi mất mạng: chặn có thông báo, retry khi có mạng lại.
- **Security:** Firebase token verify mọi request; OIDC cho task; signed URL cho file; Secret
  Manager cho key; least-privilege SA; validate mọi input bằng Zod.
- **i18n:** Translatable en/vi ở data + i18next ở UI.
- **Testing:** service layer pure + unit test (Vitest) cho progression, calo, auth-upsert,
  quota. Đây là điểm yếu nhất của v1 (gần như không có test) → v2 bắt buộc test core logic.

---

## 16. Build roadmap (đề xuất — sẽ chi tiết hoá ở writing-plans)

1. **Phase 0 — Foundation:** monorepo scaffold, `packages/shared` (Zod), Hono app factory,
   Mongo client, Firebase admin, Terraform skeleton (project, Cloud Run, secrets), CI/CD.
2. **Phase 1 — Auth 3-mode:** anonymous → link Google/password; user upsert; quota middleware.
3. **Phase 2 — Workout core:** catalog seed, plan/template/slot, session logging, progression
   rule-based, exercise_performance cache, prefill. (UI: Home, Active Session, Summary.)
4. **Phase 3 — Rest timer + RIR.**
5. **Phase 4 — AI workout planner** (Cloud Tasks + history prefill) + fallback provider.
6. **Phase 5 — InBody OCR** (Cloud Storage + Cloud Tasks + AI vision) + WeightLog.
7. **Phase 6 — Meal planner + TDEE.**
8. **Phase 7 — Notifications (FCM), Analytics/Awards, Statistics.**
9. **Phase 8 — Hardening:** tests, Terraform prod env, observability, rollout.

Mỗi phase → 1 implementation plan riêng (spec → plan → build).

---

## 17. Resolved decisions (từ open questions)

1. **Atlas provisioning:** tạo cluster **tay**, đưa connection URI vào **Secret Manager**
   (không TF hoá Atlas ở v2).
2. **Web + API:** **Firebase Hosting rewrite `/api/**` → Cloud Run** (same-origin, tránh CORS).
3. **Custom exercise của guest:** guest **tạo được ngay**; **quota giữ mức cơ bản** kể cả sau
   khi tạo account (không nâng quota chỉ vì đã đăng ký).
4. **Import dữ liệu v1:** **bỏ hẳn** — GigaFlow bắt đầu sạch, không import từ GigaFit v1.
5. **AI meal:** **chỉ Gemini**.
6. **AI engine:** một engine hợp nhất hỗ trợ cả Gemini + OpenAI, nhưng **ưu tiên Gemini trước**
   (chi phí thấp), OpenAI làm fallback khi Gemini lỗi/quota. Meal cưỡng bức Gemini.

---

## 18. Decision log

- DB giữ MongoDB Atlas (không Firestore/SQL) — giảm rủi ro, tối ưu document model.
- Guest = Firebase anonymous (không local-then-sync) — zero-migration.
- Social = Google only (v2).
- Backend = Hono (tiêu chí "nhanh nhẹ"), data = native driver + Zod.
- Jobs = Cloud Tasks (rẻ nhất; "Redis rẻ nhất" = không dùng Redis).
- Web = Firebase Hosting (rewrite `/api/**` → Cloud Run); infra = Terraform toàn bộ (trừ Atlas).
- Atlas tạo tay + URI vào Secret Manager; không import dữ liệu v1.
- AI engine hợp nhất, Gemini-first + OpenAI fallback; meal chỉ Gemini.
- Guest tạo custom exercise ngay; quota giữ mức cơ bản kể cả sau khi đăng ký.
