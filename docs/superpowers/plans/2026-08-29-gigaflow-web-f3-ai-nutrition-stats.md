# GigaFlow Web F3 — AI Plan · Meal · InBody · Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — plain branch `web-f3` (already created).

**Goal:** Build the web UI for the four AI/analytics features whose backends already exist — AI generate-plan (→ edit in F2 builder), meal planner, InBody capture, and a stats/awards dashboard with bodyweight logging.

**Architecture:** Frontend only (`apps/web`); no `apps/api`/`packages/shared` changes. Typed api helpers over existing endpoints + a shared `useJobPolling` hook for the three enqueue→poll features. Query-driven pages (TanStack Query); local form state is component state. Inline SVG for charts (no chart lib). Verify by Vitest (jsdom + Testing Library, `@/lib/api` mocked), typecheck, build.

**Tech Stack:** React 18 + Vite + TS + Tailwind tokens + TanStack Query + React Router v6 + i18next; Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-gigaflow-web-f3-ai-nutrition-stats-design.md`

## Global Constraints

- TypeScript strict, NO `any`, `noUncheckedIndexedAccess` (guard every index/array access).
- `@gigaflow/shared` is the single source of truth — import existing types/schemas (`GenerateWorkoutInput`, `zGenerationJob`, `GenerateMealInput`, `zMealPlanDoc`, `AnalyzeInbodyInput`, `zInbodyResult`, `zStatsSummary`, `zAward`, `zWeightLog`, `LogWeightInput`, enums `Goal`/`ExperienceLevel`/`Gender`/`ActivityLevel`/`MealType`/`ImageMimeType`/`JobStatus`); never redefine server shapes.
- Reuse F0–F2: the typed `apiFetch` client, `queryClient`, `resolveTranslatable`, primitives (Button/Card/ColorDot/Spinner), `SegmentedFilter`, F2 `getPlan`/`planEditPath`. `@/` alias → `apps/web/src`.
- Dark-only Tailwind CSS-var tokens; ≥44px touch targets; `tnum` for numeric values; en/vi i18n kept in sync via `TranslationSchema`; reduced-motion safe.
- Tests use no real network/Firebase; mock `@/lib/api`; fresh QueryClient + MemoryRouter; deterministic (fake timers for polling/debounce), pristine output.
- Each task ends green: `pnpm --filter @gigaflow/web build && pnpm --filter @gigaflow/web test` and root `pnpm typecheck`.
- Conventional Commits. Commit author = the task's assignee: Bảo Hân → `Đặng Bảo Hân <030537210074@st.buh.edu.vn>`; Thành Duy → `Duong Thanh Duy <duongduyy1512@gmail.com>`.

## File Structure
`apps/web/src/lib/{api.ts,useJobPolling.ts}`; `apps/web/src/components/{StatTile,MacroBar,MiniBarChart,JobProgress,ImagePickerInput}.tsx`; `apps/web/src/features/{ai,meal,inbody,stats}/*`; `apps/web/src/{routes.ts,App.tsx,components/MainLayout.tsx,i18n/{en,vi}.ts}`.

---

### Task 1: F3 api helpers + `useJobPolling` hook — TDD — [Thành Duy]

**Files:** modify `apps/web/src/lib/api.ts`; create `apps/web/src/lib/useJobPolling.ts`; tests `apps/web/src/lib/api.f3.test.ts`, `apps/web/src/lib/useJobPolling.test.tsx`.

**Interfaces — Produces:**
- api helpers (each reuses `apiFetch` with the real shared schema): `generateWorkout(input: GenerateWorkoutInput)` → `POST /workout/generate` → `{jobId:string}`; `getGenerationJob(id)` → `GET /workout/jobs/:id` → `GenerationJob`; `generateMeal(input: GenerateMealInput)` → `POST /meal/generate` → `{jobId}`; `getMealJob(id)` → `GET /meal/jobs/:id` → `GenerationJob`; `getActiveMeal()` → `GET /meal/active` → `MealPlanDoc | null`; `analyzeInbody(input: AnalyzeInbodyInput)` → `POST /inbody/analyze` → `{jobId}`; `getInbodyJob(id)` → `GET /inbody/jobs/:id` → `GenerationJob`; `getLatestInbody()` → `GET /inbody/latest` → `InbodyResult | null`; `getStatsSummary()` → `GET /stats/summary` → `StatsSummary`; `getAwards()` → `GET /stats/awards` → `Award[]`; `logWeight(input: LogWeightInput)` → `POST /weight` → `WeightLog`; `getWeightHistory()` → `GET /weight/history` → `WeightLog[]`.
- `useJobPolling<TResult>(opts)` (see below).

- [ ] **Step 1: Read** `apps/web/src/lib/api.ts` for the existing helper pattern (fetchImpl passthrough, apiFetch, ISO-date reviver) and the shared schema export names in `packages/shared/src/schemas/{ai,meal,inbody,stats,weight}.ts` (`zGenerationJob`, `zMealPlanDoc`, `zInbodyResult`, `zStatsSummary`, `zAward`, `zWeightLog`). Use the REAL names.

- [ ] **Step 2: Failing test — `api.f3.test.ts`** (fake `fetchImpl`, per existing `api.test.ts`):
```typescript
it('generateWorkout posts input and returns jobId', async () => {
  let seen: Request | undefined;
  const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => { seen = new Request(i, init); return new Response(JSON.stringify({ success: true, data: { jobId: 'j1' } }), { status: 202 }); }) as typeof fetch;
  const out = await generateWorkout({ goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 }, fetchImpl);
  expect(out.jobId).toBe('j1'); expect(seen?.method).toBe('POST'); expect(new URL(seen!.url).pathname).toContain('/workout/generate');
});
it('getActiveMeal returns null when no plan', async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })) as typeof fetch;
  expect(await getActiveMeal(fetchImpl)).toBeNull();
});
```
Run: `pnpm --filter @gigaflow/web test api.f3` → FAIL.

- [ ] **Step 3: Implement the helpers** (nullable results use `zX.nullable()`; POST helpers take the input; each accepts an optional trailing `fetchImpl` like existing helpers). Run → PASS.

- [ ] **Step 4: Failing test — `useJobPolling.test.tsx`** (fake timers; a tiny harness component or `renderHook`). Contract to satisfy:
```
useJobPolling<TResult>({ start, poll, fetchResult?, intervalMs?, maxAttempts? })
  → { run: (input) => void, status: 'idle'|'submitting'|'polling'|'done'|'error', job?: GenerationJob, result?: TResult, error?: string }
```
Tests: (a) `run` → start resolves {jobId} → status 'polling'; a poll returning `status:'done'` (with resultId) → `fetchResult(job)` resolves → status 'done', `result` set; (b) poll returns `status:'failed'` with `error:'boom'` → status 'error', `error:'boom'`, no fetchResult; (c) `start` rejects with an `ApiError` (quota) → status 'error', error = message; (d) unmount mid-poll stops further polling (no post-unmount state update / act warning). Use `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`.
Run → FAIL.

- [ ] **Step 5: Implement `useJobPolling`** — `run(input)`: set 'submitting'; `await start(input)` (catch → 'error'); set 'polling'; loop up to `maxAttempts` (default 40) with `intervalMs` (default 1500): `await poll(jobId)`; if `job.status===JobStatus.DONE` → optional `await fetchResult(job)` → 'done'; if `JobStatus.FAILED` → 'error' with `job.error ?? <generic>`; else wait `intervalMs`. On exhausting attempts → 'error' timeout. Track a mounted/cancel ref; clear on unmount; no setState after unmount. No `any`. Run → PASS.

- [ ] **Step 6: Verify + commit — Thành Duy.**
```bash
pnpm --filter @gigaflow/web build && pnpm typecheck
git add apps/web/src/lib
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add F3 api helpers and job-polling hook"
```

---

### Task 2: Shared display components — TDD — [Bảo Hân]

**Files:** create `apps/web/src/components/{StatTile,MacroBar,MiniBarChart,JobProgress,ImagePickerInput}.tsx`; test `apps/web/src/components/f3-components.test.tsx`; may add i18n keys for JobProgress status text (en/vi).

**Interfaces — Produces:**
- `StatTile({ label: string, value: string|number, unit?: string })` — Card-like tile, `tnum` value.
- `MacroBar({ calories, proteinG, carbsG, fatG }: {calories:number;proteinG:number;carbsG:number;fatG:number})` — a row/bar of the four values with labels, `tnum`.
- `MiniBarChart({ points, unit? }: { points: {label:string; value:number}[]; unit?:string })` — inline SVG: one bar per point scaled to the max value; `role="img"` + `<title>`; wrapper `overflow-x:auto`; renders nothing (an empty-state text) when `points` is empty; reduced-motion safe.
- `JobProgress({ status, error? }: { status:'submitting'|'polling'|'done'|'error'; error?:string })` — Spinner + localized status line (i18n keys `job.submitting`/`job.polling`), error text when status 'error'.
- `ImagePickerInput({ accept, maxBase64Length, onPicked, onError }: { accept:string; maxBase64Length:number; onPicked:(base64:string, mimeType:ImageMimeType)=>void; onError:(msgKey:string)=>void })` — a file input (≥44px label/button) + preview `<img>`; on select: reject a mime not in `ImageMimeType` via `onError('inbody.errBadType')`; FileReader→dataURL, strip the `data:<mime>;base64,` prefix, if `base64.length > maxBase64Length` → `onError('inbody.errTooLarge')` else `onPicked(base64, mimeType)`.

- [ ] **Step 1: Failing test — `f3-components.test.tsx`:**
  - `StatTile` renders label + value (+ unit).
  - `MacroBar` renders the 4 numbers.
  - `MiniBarChart` with 3 points renders 3 `<rect>` bars (query `container.querySelectorAll('rect')`), and with `[]` shows an empty-state text.
  - `ImagePickerInput`: selecting a `text/plain` file calls `onError` with `inbody.errBadType` and NOT `onPicked` (simulate via `fireEvent.change` with a `File`); selecting a valid small `image/png` File calls `onPicked` with the stripped base64 + `ImageMimeType.PNG` (mock `FileReader` or use a real File + await). Keep deterministic.

Run → FAIL.

- [ ] **Step 2: Implement** the five components (Tailwind tokens; SVG bars computed from max; guard empty arrays — noUncheckedIndexedAccess). Add `job.*` i18n keys (en+vi). No `any`. Run → PASS; build green.

- [ ] **Step 3: Commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/components apps/web/src/i18n
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "feat(web): add F3 shared display components"
```

---

### Task 3: AI Generate-Plan page — TDD — [Thành Duy]

**Files:** create `apps/web/src/features/ai/{GeneratePlanPage.tsx,generate-plan.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx,components/MainLayout.tsx,i18n/{en,vi}.ts}`.

**Interfaces — Consumes:** `useJobPolling`, `generateWorkout`/`getGenerationJob`/`getPlan` (api), `planEditPath` + `ROUTES` (routes.ts), `JobProgress`, primitives, `resolveTranslatable`. **Produces:** route `/generate` + `ROUTES.generate` + nav link.

- [ ] **Step 1: Failing test — `generate-plan.test.tsx`** (mock `@/lib/api`; QueryClientProvider + MemoryRouter with a capture route for navigation; fake timers):
  - fill goal/experience/days, submit → `generateWorkout` called with the form values; polling shows `JobProgress`; `getGenerationJob` → `{status:'done', resultId:'plan9'}`; `getPlan('plan9')` → a `PlanWithTemplates` (1 template) → a preview with the plan name + "edit in builder" CTA appears.
  - clicking "edit in builder" navigates to `planEditPath('plan9')`.
  - `getGenerationJob` → `{status:'failed', error:'quota'}` → an error message shows, no navigation.

Run → FAIL.

- [ ] **Step 2: Implement** `GeneratePlanPage` (form with `SegmentedFilter`/selects for the enums + a number input; the polling hook; preview from the fetched plan — template name via resolveTranslatable + `slots.length` per template; on "edit in builder" `queryClient.invalidateQueries(['plans'])` + `invalidateQueries(['activePlan'])` then `navigate(planEditPath(resultId))`). Add `ai.*` i18n (en+vi). Wire `/generate` route + `ROUTES.generate` + nav link. No `any`. Run → PASS; build green.

- [ ] **Step 3: Commit — Thành Duy.**
```bash
pnpm typecheck
git add apps/web/src/features/ai apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/components/MainLayout.tsx apps/web/src/i18n
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add AI generate-plan page with builder handoff"
```

---

### Task 4: Meal Planner page — TDD — [Bảo Hân]

**Files:** create `apps/web/src/features/meal/{MealPlannerPage.tsx,MealDayView.tsx,meal.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx,components/MainLayout.tsx,i18n/{en,vi}.ts}`.

**Interfaces — Consumes:** `useJobPolling`, `generateMeal`/`getMealJob`/`getActiveMeal`, `MacroBar`, `JobProgress`, `resolveTranslatable`, enums (Goal/Gender/ActivityLevel). **Produces:** route `/meal` + `ROUTES.meal` + nav link; `MealDayView({day})`.

- [ ] **Step 1: Failing test — `meal.test.tsx`** (mock api; QueryClientProvider + MemoryRouter; fake timers):
  - `getActiveMeal` → a `MealPlanDoc` (1 day, 2 meals) on mount → renders the plan name, a `MacroBar` with the day totals, and the 2 meals (mealType + resolved name + calories).
  - `getActiveMeal` → null initially; fill the form (goal/gender/age/height/weight/activity), submit → `generateMeal` called with the values; poll → `{status:'done'}`; then `getActiveMeal` (invalidated) → the new plan renders.

Run → FAIL.

- [ ] **Step 2: Implement** `MealPlannerPage` (`useQuery(['mealActive'], getActiveMeal)`; a generate form; the polling hook with `fetchResult: () => getActiveMeal()` + on done `invalidateQueries(['mealActive'])`) and `MealDayView` (a **stacked list of days** — no day-selector state; each day: a `MacroBar` totals row + its meals list: mealType badge, name resolveTranslatable, calories + protein/carbs/fat tnum, ingredients). Add `meal.*` i18n (en+vi). Wire `/meal` route + nav link. No `any`. Run → PASS; build green.

- [ ] **Step 3: Commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/features/meal apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/components/MainLayout.tsx apps/web/src/i18n
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "feat(web): add meal planner page"
```

---

### Task 5: InBody Capture page — TDD — [Bảo Hân]

**Files:** create `apps/web/src/features/inbody/{InbodyPage.tsx,inbody.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx,components/MainLayout.tsx,i18n/{en,vi}.ts}`.

**Interfaces — Consumes:** `useJobPolling`, `analyzeInbody`/`getInbodyJob`/`getLatestInbody`, `ImagePickerInput`, `StatTile`, `JobProgress`, `ImageMimeType`. **Produces:** route `/inbody` + `ROUTES.inbody` + nav link.

- [ ] **Step 1: Failing test — `inbody.test.tsx`** (mock api; QueryClientProvider + MemoryRouter; fake timers):
  - `getLatestInbody` → an `InbodyResult` with `metrics:{weightKg:80, bodyFatPercent:18}` (others undefined) on mount → renders a weight tile and a body-fat tile, and does NOT render tiles for the undefined metrics (assert only the present ones appear).
  - picking a valid image (via `ImagePickerInput`, simulated), then "analyze" → `analyzeInbody` called with `{imageBase64, mimeType}`; poll → done; `getLatestInbody` re-fetched (invalidated) → updated metrics render.
  - (ImagePickerInput's own bad-type/oversize validation is covered in Task 2; here just assert analyze isn't called until a valid image is picked.)

Run → FAIL.

- [ ] **Step 2: Implement** `InbodyPage` (`useQuery(['inbodyLatest'], getLatestInbody)`; `ImagePickerInput` with `accept="image/png,image/jpeg"` + `maxBase64Length={10_000_000}`; local `{base64, mimeType}` state; "Analyze" runs the polling hook with `start: () => analyzeInbody({imageBase64: base64, mimeType})`, `fetchResult: () => getLatestInbody()`, on done `invalidateQueries(['inbodyLatest'])`; a metrics grid of `StatTile`s that renders ONLY defined metrics — a helper mapping metric key → {labelKey, unit}, filtered by `!== undefined`). Add `inbody.*` i18n incl. `errBadType`/`errTooLarge` (en+vi). Wire `/inbody` route + nav link. No `any`; guard optional metrics. Run → PASS; build green.

- [ ] **Step 3: Commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/features/inbody apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/components/MainLayout.tsx apps/web/src/i18n
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "feat(web): add InBody capture page"
```

---

### Task 6: Stats Dashboard + bodyweight — TDD — [Thành Duy]

**Files:** create `apps/web/src/features/stats/{StatsPage.tsx,AwardCard.tsx,stats.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx,components/MainLayout.tsx,i18n/{en,vi}.ts}`.

**Interfaces — Consumes:** `getStatsSummary`/`getAwards`/`getPrs`/`getWeightHistory`/`logWeight`/`getExercises` (api), `StatTile`, `MiniBarChart`, `resolveTranslatable`. **Produces:** route `/stats` + `ROUTES.stats` + nav link; `AwardCard({award})`.

- [ ] **Step 1: Failing test — `stats.test.tsx`** (mock api; QueryClientProvider + MemoryRouter):
  - `getStatsSummary` → renders 4 StatTiles (sessions/volume/prs/exercises values present).
  - `getAwards` → one earned + one in-progress → the earned card shows an earned badge; the in-progress shows a progress indicator (current/target).
  - `getPrs` → 1 PR + `getExercises` → its exercise → a PR row with the resolved exercise name.
  - `getWeightHistory` → 3 logs → a `MiniBarChart` renders 3 bars; submitting the log-weight form calls `logWeight({weightKg})` and invalidates `['weightHistory']`.

Run → FAIL.

- [ ] **Step 2: Implement** `StatsPage` (four `useQuery`s + `['exercises']` for PR names; a log-weight form → `logWeight` mutation → `invalidateQueries(['weightHistory'])`; `MiniBarChart` fed `weightHistory.map(w => ({ label: <short date>, value: w.weightKg }))`) and `AwardCard` (name/description resolveTranslatable, a `current/target` progress bar, amber earned badge). Add `stats.*` i18n (en+vi). Wire `/stats` route + nav link. No `any`; guard arrays. Run → PASS; build green.

- [ ] **Step 3: Commit — Thành Duy.**
```bash
pnpm typecheck
git add apps/web/src/features/stats apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/components/MainLayout.tsx apps/web/src/i18n
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add stats dashboard with awards and bodyweight logging"
```

---

### Task 7: Docs — README F3 — [Bảo Hân]

**Files:** modify `README.md`.

- [ ] **Step 1:** Add an **F3** subsection under the Web app section: AI generate-plan (`/generate`, → edits in the builder), Meal planner (`/meal`), InBody capture (`/inbody`), Stats dashboard + bodyweight (`/stats`); note these are UI over existing endpoints (`/workout/generate`+jobs, `/meal/*`, `/inbody/*`, `/stats/*`, `/weight`). Update the roadmap: E13 frontend **F0+F1+F2+F3 done**; remaining deferred = notifications/web-push UI (needs FCM infra) + real GCP/Firebase provisioning & deploy. Verify route/endpoint names against the code. Keep the existing README style.
- [ ] **Step 2: Commit — Bảo Hân.**
```bash
git add README.md
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "docs: document web F3 (AI, meal, InBody, stats)"
```

---

## Self-Review

**1. Spec coverage:** api helpers + useJobPolling (T1); shared components incl. ImagePickerInput validation + MiniBarChart (T2); AI page → builder handoff (T3); meal planner (T4); InBody capture (T5); stats dashboard + weight (T6); docs (T7). Notifications/TDEE-screen/meal-edit/real-time streaming left out per spec §7. Every spec §4 area + §5 component mapped.

**2. Placeholder scan:** api/hook have concrete signatures + real tests; components specified by exact props + concrete assertions (bar count, validation callbacks); pages by exact query keys, api calls, and navigation targets with real test assertions. Two spec ambiguities pinned: meal view = stacked day list (T4); InBody image sent base64 with prefix stripped (T2/T5). No vague directives.

**3. Type consistency:** helper return types use real shared schemas (`GenerationJob`/`MealPlanDoc`/`InbodyResult`/`StatsSummary`/`Award`/`WeightLog`), nullable where the endpoint can return null (getActiveMeal/getLatestInbody). `useJobPolling` generic `TResult` = whatever `fetchResult` returns (PlanWithTemplates / MealPlanDoc / InbodyResult). AI page consumes F2 `getPlan` + `planEditPath` (exist on main). Cache keys `['plans']`/`['activePlan']` (invalidated by AI), `['mealActive']`, `['inbodyLatest']`, `['statsSummary']`/`['awards']`/`['prs']`/`['weightHistory']`/`['exercises']` each owned by one page; `ImageMimeType`/`JobStatus` from shared. `ROUTES.{generate,meal,inbody,stats}` added incrementally (sequential tasks, no parallel dispatch → no App.tsx/routes.ts/MainLayout conflict); each page task keeps en/vi in sync. Every task ends green.

**Assignees:** T1,T3,T6 → Thành Duy; T2,T4,T5,T7 → Bảo Hân.
