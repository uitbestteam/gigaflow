# GigaFlow Web F3 — AI Plan · Meal Planner · InBody · Stats (Design)

**Date:** 2026-08-29
**Status:** Approved for implementation
**Scope:** `apps/web` only — F3 is UI over already-shipped backend endpoints. Four feature areas: AI generate-plan flow, Meal planner + TDEE, InBody capture, Stats/awards dashboard (+ bodyweight logging). Builds on F0/F1/F2, all on `main`.

## 1. Goal

Surface the four AI/analytics features the backend already implements: generate a training plan with AI (then refine it in the F2 builder), generate a meal plan with macros, analyze an InBody photo into body-composition metrics, and see a stats/awards dashboard with bodyweight tracking. No backend changes — every endpoint exists.

## 2. Locked decisions

- **Frontend only.** All endpoints already exist and are behind `firebaseAuth`. No `apps/api` / `packages/shared` changes (we import existing shared types).
- **AI plan → preview → open in F2 Plan Builder.** The workout job **persists the plan itself** (`insertPlanGraph`, `isActive: true`) and returns `resultId` = the plan id, so after the job completes we fetch it with the existing `getPlan(resultId)` and hand off to the builder via `planEditPath(resultId)`.
- **Job polling** for the three async features (workout/meal/inbody): `POST …/generate|analyze` → `{ jobId }` (202) → poll `GET …/jobs/:id` until `status` is `done`/`failed`. A shared `useJobPolling` hook. The default inline enqueuer runs synchronously, so the first poll usually already sees `done`; polling still works unchanged if a real Cloud Tasks queue is wired later.
- **InBody image** is sent as **base64 in the request body** (`imageBase64` + `mimeType`), validated client-side (mime ∈ `ImageMimeType` = jpeg/png; base64 length ≤ 10,000,000) — no cloud storage.
- **No chart library.** Bodyweight/volume visuals are hand-built inline SVG (CSP-safe, self-contained, testable). Tailwind CSS-var tokens, dark-only, ≥44px targets, tabular-nums.
- **Notifications UI is out of F3** — web push needs real Firebase Cloud Messaging (VAPID + service worker), part of the deferred infra. Revisit when Firebase is provisioned.
- Stack unchanged: TanStack Query + Zustand-free (these pages are query-driven; local form state is component state) + React Router + i18next. Tests: Vitest + jsdom + Testing Library, `@/lib/api` mocked, no real network/Firebase.

## 3. Backend surface (existing — reference)

All under `/api`, envelope `{success,data,message}`, behind `firebaseAuth`. AI/meal/inbody are `quotaGuard`-ed (an over-quota request returns an error envelope; pages surface `ApiError.message`).

- **Workout AI:** `POST /workout/generate` (`zGenerateWorkoutInput`: goal, experienceLevel, daysPerWeek) → `{ jobId }` (202); `GET /workout/jobs/:id` → `GenerationJob` (`status`, `resultId?`, `error?`). On `done`, `resultId` is a **Plan id** (persisted + active).
- **Meal:** `POST /meal/generate` (`zGenerateMealInput`: goal, gender, age, heightCm, weightKg, activityLevel) → `{ jobId }` (202); `GET /meal/jobs/:id` → `GenerationJob`; `GET /meal/active` → `MealPlanDoc | null` (`name`, `days[]` each with `meals[]` + macro totals).
- **InBody:** `POST /inbody/analyze` (`zAnalyzeInbodyInput`: imageBase64, mimeType) → `{ jobId }` (202); `GET /inbody/jobs/:id` → `GenerationJob`; `GET /inbody/latest` → `InbodyResult | null` (`metrics`: weightKg + optional bmi/bodyFatPercent/skeletalMuscleMassKg/bodyFatMassKg/visceralFatLevel; `takenAt`).
- **Stats:** `GET /stats/summary` → `StatsSummary` (totalSessions, totalVolume, totalPrs, totalExercises); `GET /stats/prs` → `PersonalRecord[]`; `GET /stats/awards` → `Award[]` (key, name, description, target, current, earned).
- **Weight:** `POST /weight` (`zLogWeightInput`: weightKg, loggedAt?) → `WeightLog`; `GET /weight/history` → `WeightLog[]`.

`JobStatus` = queued | processing | done | failed. Enums for forms: `Goal` (strength/hypertrophy/general_fitness/weight_loss), `ExperienceLevel` (beginner/intermediate/advanced), `Gender` (male/female), `ActivityLevel` (sedentary/light/moderate/active/very_active), `MealType`, `ImageMimeType` (image/jpeg, image/png).

## 4. Frontend additions (`apps/web`)

### 4.1 API helpers (`apps/web/src/lib/api.ts`)
Add, reusing shared schemas: `generateWorkout(input)` → POST /workout/generate → `z.object({jobId:z.string()})`; `getGenerationJob(id)` → GET /workout/jobs/:id → `zGenerationJob`; `generateMeal(input)` → POST /meal/generate → `{jobId}`; `getMealJob(id)` → GET /meal/jobs/:id → `zGenerationJob`; `getActiveMeal()` → GET /meal/active → `zMealPlanDoc.nullable()`; `analyzeInbody(input)` → POST /inbody/analyze → `{jobId}`; `getInbodyJob(id)` → GET /inbody/jobs/:id → `zGenerationJob`; `getLatestInbody()` → GET /inbody/latest → `zInbodyResult.nullable()`; `getStatsSummary()` → `zStatsSummary`; `getAwards()` → `zAward.array()`; `logWeight(input)` → POST /weight → `zWeightLog`; `getWeightHistory()` → GET /weight/history → `zWeightLog.array()`. (`getPrs()` already exists.)

### 4.2 Shared hook — `apps/web/src/lib/useJobPolling.ts`
`useJobPolling<TResult>({ start, poll, fetchResult, onQuotaOrError? })` — a hook returning `{ run(input), status: 'idle'|'submitting'|'polling'|'done'|'error', job?, result?, error? }`. `run`: call `start(input)` → `{jobId}`; then poll `poll(jobId)` every 1500ms up to 40 attempts; on `job.status === 'done'` call `fetchResult(job)` (optional; e.g. getPlan(resultId)/getActiveMeal/getLatestInbody) and set `result`; on `failed` set error from `job.error`; on timeout set a timeout error. Cancels polling on unmount. Errors from `start` (incl. quota `ApiError`) set `status:'error'` + `error.message`. Injectable timing (accept an optional interval + a `sleep`/timer injection or use fake timers in tests) so tests are deterministic.

### 4.3 AI Generate-Plan (`apps/web/src/features/ai/GeneratePlanPage.tsx`)
- Route `/generate`. A form: `Goal` select, `ExperienceLevel` select, `daysPerWeek` number (1–7). Submit → `useJobPolling({ start: generateWorkout, poll: getGenerationJob, fetchResult: job => getPlan(job.resultId) })`.
- While polling: a `JobProgress` indicator (spinner + status text). On `done`: a preview card (plan name + a compact per-day summary: template name + exercise count, from the fetched `PlanWithTemplates`) + primary CTA **"Chỉnh trong builder"** → invalidate `['plans']` + `['activePlan']` (the plan is now active) → navigate `planEditPath(resultId)`; secondary "Về Plans" → `/plans`. On `error`/quota: a message (uses `error.message`), retry.

### 4.4 Meal Planner (`apps/web/src/features/meal/MealPlannerPage.tsx`)
- Route `/meal`. On mount `useQuery(['mealActive'], getActiveMeal)` — if a plan exists, render it. A "Tạo thực đơn" form: goal, gender, age, heightCm, weightKg, activityLevel. Submit → `useJobPolling({ start: generateMeal, poll: getMealJob, fetchResult: () => getActiveMeal() })` → on done invalidate `['mealActive']` and show the plan.
- Plan view: plan name; a day selector (day 1..n) or a stacked list; per day a `MacroBar`/totals row (calories, protein, carbs, fat) + a list of meals (mealType badge, name (resolveTranslatable), calories + macros, ingredients). Numbers tnum.

### 4.5 InBody Capture (`apps/web/src/features/inbody/InbodyPage.tsx`)
- Route `/inbody`. On mount `useQuery(['inbodyLatest'], getLatestInbody)` → show latest metrics if any. An `ImagePickerInput` (file input `accept="image/png,image/jpeg"`): on select, validate mime ∈ ImageMimeType and (after base64 encode) length ≤ 10,000,000 (else inline error); show a preview thumbnail. "Phân tích" → base64-encode (FileReader→dataURL, strip the `data:…;base64,` prefix) → `useJobPolling({ start: () => analyzeInbody({imageBase64, mimeType}), poll: getInbodyJob, fetchResult: () => getLatestInbody() })` → on done invalidate `['inbodyLatest']`.
- Metrics view: `StatTile`s for each present metric (weightKg always; bmi/bodyFatPercent/skeletalMuscleMassKg/bodyFatMassKg/visceralFatLevel only when defined) + `takenAt` date. Never render `undefined` tiles.

### 4.6 Stats Dashboard (`apps/web/src/features/stats/StatsPage.tsx`)
- Route `/stats`. `useQuery`s: `['statsSummary']`→getStatsSummary, `['awards']`→getAwards, `['prs']`→getPrs, `['weightHistory']`→getWeightHistory.
- Summary: a row of `StatTile`s (totalSessions, totalVolume, totalPrs, totalExercises).
- Awards: cards — name + description (resolveTranslatable), a progress bar `current/target`, an "earned" badge (amber) when `earned`.
- PRs: a list (exercise name via the `['exercises']` catalog + resolveTranslatable; weightKg × repsDone; e1RM).
- Bodyweight: a "Log weight" form (weightKg → `logWeight` → invalidate `['weightHistory']`) + a `MiniBarChart` (inline SVG) of the history (weightKg over loggedAt) + a compact list.

### 4.7 Navigation & routes
Wire `/generate`, `/meal`, `/inbody`, `/stats` in `routes.ts` (path constants) + `App.tsx`. Add nav entries in `MainLayout` — given the growing count (home, plans, exercises, + 4), group secondary links under a simple "More" menu or a second nav row (keep it lightweight; a wrapped flex row of links is acceptable). i18n groups `ai.*`, `meal.*`, `inbody.*`, `stats.*`, `nav.*` (en/vi in sync).

## 5. Components (`apps/web/src/components/`)
- `StatTile({ label, value, unit? })` — a labelled metric tile, tnum value.
- `MacroBar({ calories, proteinG, carbsG, fatG })` — a macro totals row (or a proportional bar), tnum.
- `MiniBarChart({ points: {label, value}[], unit? })` — inline SVG bars scaled to max; accessible (title/aria), reduced-motion safe; `overflow-x:auto` wrapper.
- `JobProgress({ status, error? })` — spinner + localized status/error text.
- `ImagePickerInput({ accept, maxBase64Length, onPicked(base64, mimeType), onError(msgKey) })` — file input + preview + client validation; ≥44px.
- `AwardCard`, `MealDayView`, `PrListItem` (feature-local or shared as convenient).

## 6. Testing
Vitest + jsdom + Testing Library; mock `@/lib/api`; fresh QueryClient + MemoryRouter; deterministic (fake timers for the polling interval + any debounce). Cover:
- `api.ts` new helpers (fake fetchImpl: method/path/schema, nullable results).
- `useJobPolling` (start→poll→done sets result; failed sets error from job.error; quota/start error sets error; unmount stops polling) — fake timers.
- GeneratePlanPage (submit → polling → done shows preview + "edit in builder" navigates planEditPath(resultId) after invalidation; error path).
- MealPlannerPage (existing active plan renders; generate → poll → renders new plan + macros).
- InbodyPage (invalid mime/oversize → inline error, no POST; valid → analyze called with base64+mime, poll, latest metrics render; undefined metrics not rendered).
- StatsPage (summary tiles, award progress + earned badge, PR list, log weight calls logWeight + invalidates, MiniBarChart renders bars for the history).
- Key components (StatTile, MacroBar, MiniBarChart bar count, ImagePickerInput validation).

## 7. Non-goals / deferred
- Notifications / web push (needs real FCM/VAPID + service worker — infra).
- Real-time job streaming (polling is sufficient; inline enqueuer resolves synchronously).
- Rich charts / date-range filtering / editing past InBody or weight entries.
- Meal plan editing (view + regenerate only; backend has no meal-edit endpoint).
- A dedicated TDEE screen (no TDEE endpoint is exposed; macro totals come from the meal plan days).

## 8. Task decomposition (for writing-plans)
1. **api helpers** (all F3 endpoints) + `useJobPolling` hook — TDD. [Thành Duy]
2. **Shared display components** (StatTile, MacroBar, MiniBarChart, JobProgress, ImagePickerInput) — TDD. [Bảo Hân]
3. **AI Generate-Plan page** (+ route + nav) — form → poll → preview → edit-in-builder. [Thành Duy]
4. **Meal Planner page** (+ route + nav) — active plan + generate flow + macro/day view. [Bảo Hân]
5. **InBody page** (+ route + nav) — image validate/base64 → analyze → poll → metrics. [Bảo Hân]
6. **Stats dashboard + bodyweight** (+ route + nav) — summary/awards/PRs + weight log + MiniBarChart. [Thành Duy]
7. **Docs** — README F3 section + roadmap (E13 F0+F1+F2+F3 done). [Bảo Hân]

**Assignees:** api/hook (1), AI page (3), stats (6) → Thành Duy; components (2), meal (4), inbody (5), docs (7) → Bảo Hân. (Set per task in the plan; commit as the assignee's git identity.)
