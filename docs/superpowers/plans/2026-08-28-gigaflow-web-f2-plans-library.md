# GigaFlow Web F2 — Plans Builder + Exercise Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — plain branch `web-f2` (already created).

**Goal:** Full-stack F2 — backend plan-CRUD endpoints + web UI to browse/create exercises, manage plans, and build/edit a plan's days and per-exercise targets; the active plan drives the F1 Home queue.

**Architecture:** Add plan create/read/update/activate/delete to the Hono `apps/api` workout module (reusing the existing native-driver repo), backed by new `@gigaflow/shared` input schemas. Web app gets typed api helpers, an Exercise Library page (search/filter/create-custom), a Plans management page, and a client-side Plan Builder (Zustand working copy saved via whole-graph POST/PUT). Verify by Vitest (api: mongodb-memory-server; web: jsdom + Testing Library), typecheck, and build.

**Tech Stack:** Hono 4 + native mongodb driver + Zod (api); React 18 + Vite + TS + Tailwind tokens + TanStack Query + Zustand + React Router v6 + i18next (web); Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-gigaflow-web-f2-plans-library-design.md`

## Global Constraints

- TypeScript strict, NO `any`, `noUncheckedIndexedAccess` (guard every index/array access).
- `@gigaflow/shared` is the single source of truth for shapes — never redefine server shapes in the web app; import them.
- Backend: `.js` ESM import extensions; envelope `{success,data?,message?}` via `apiSuccess`/`errorBody`; all plan routes under the `/plans` base already mounted in `app.ts`; injectable seams (tests use mongodb-memory-server + an injected token verifier, no GCP/Firebase). Register literal routes (`/active`) before parametric (`/:id`).
- Web: `@/` alias → `apps/web/src`; dark-only Tailwind CSS-var tokens; ≥44px touch targets; tabular-nums for numeric fields; en/vi i18n catalogs kept in sync via `TranslationSchema`; reuse F1 primitives (Button, Card, ColorDot, Spinner), `resolveTranslatable`, the typed api client, queryClient.
- Tests use no real network/Firebase/GCP. Each task ends green: api tasks `pnpm --filter @gigaflow/api test`; web tasks `pnpm --filter @gigaflow/web build && pnpm --filter @gigaflow/web test`; every task `pnpm typecheck` (root turbo).
- Conventional Commits. Commit author = the task's assignee: Bảo Hân → `Đặng Bảo Hân <030537210074@st.buh.edu.vn>`; Thành Duy → `Duong Thanh Duy <duongduyy1512@gmail.com>`.

## File Structure
Backend: `packages/shared/src/schemas/plan.ts` (+input schemas), `apps/api/src/modules/workout/{workout.repo.ts,plan.service.ts(new),workout.routes.ts}` + tests. Web: `apps/web/src/lib/api.ts`, `apps/web/src/store/planBuilderStore.ts`, `apps/web/src/features/{exercises,plans}/*`, `apps/web/src/components/*`, `routes.ts`, `App.tsx`, `i18n/{en,vi}.ts`.

---

### Task 1: Shared plan input schemas + repo CRUD — [Thành Duy]

**Files:** modify `packages/shared/src/schemas/plan.ts`, `packages/shared/src/index.ts` (if it re-exports explicitly), `apps/api/src/modules/workout/workout.repo.ts`; test `apps/api/src/modules/workout/workout.repo.test.ts` (create if absent, else extend).

**Interfaces — Produces:**
- Shared: `zSlotInput`, `zTemplateInput`, `zCreatePlanInput`, `zUpdatePlanInput` (= create shape) + types `CreatePlanInput`, `UpdatePlanInput` (exact code in spec §3.1).
- Repo: `listPlans(userId): Promise<Plan[]>`; `findPlanById(userId, planId): Promise<PlanWithTemplates | null>`; `replacePlanGraph(userId, planId, planData, newTemplates): Promise<PlanWithTemplates | null>`; `deletePlan(userId, planId): Promise<boolean>`; plus an extracted shared insert helper used by both `insertPlanGraph` and `replacePlanGraph`.

- [ ] **Step 1: Add the shared input schemas** to `packages/shared/src/schemas/plan.ts` exactly as spec §3.1 (`zSlotInput`/`zTemplateInput`/`zCreatePlanInput`/`zUpdatePlanInput` + types). Ensure they're exported from the package entrypoint (check `packages/shared/src/index.ts` — add re-exports if it lists names explicitly). Build shared: `pnpm --filter @gigaflow/shared build`.

- [ ] **Step 2: Write failing repo tests.** In `workout.repo.test.ts` (mongodb-memory-server; follow the existing api test setup — look at `apps/api/src/modules/training/*.test.ts` or an existing repo test for the memory-server harness and how `db()` is initialized). Add tests:
  - `listPlans` returns the user's plans (insert two via `insertPlanGraph`, expect 2, newest first), and excludes another user's plan.
  - `findPlanById` returns the full graph for an owned plan; `null` for another user's id and for a missing id.
  - `replacePlanGraph` replaces templates/slots (seed a plan with 1 template/2 slots; replace with 2 templates/1 slot each; re-fetch via `findPlanById` → new graph present, old slot ids gone) and returns `null` for a non-owned plan.
  - `deletePlan` removes the plan + its templates + slots (findPlanById → null after) and returns `false` for a non-owned/missing id.

Run: `pnpm --filter @gigaflow/api test workout.repo` → FAIL (functions undefined).

- [ ] **Step 3: Implement the repo functions.** Extract the per-template/slot insert loop from `insertPlanGraph` into a private helper `insertTemplates(planId, newTemplates): Promise<(WorkoutTemplate & {slots: ExerciseSlot[]})[]>` and call it from both `insertPlanGraph` and `replacePlanGraph`. `listPlans`: `plans().find({userId}).sort({createdAt:-1}).toArray()` mapped via the existing id-mapping. `findPlanById`: load plan by `_id`+userId, then its templates (sorted by orderIndex) + slots (sorted by orderIndex), assemble `PlanWithTemplates`; return null if plan missing. `replacePlanGraph`: `findPlanById`-style ownership check (return null if not owned); delete templates (and their slots) for the plan; `insertTemplates`; return fresh graph preserving `createdAt`/`isActive`/`templateType` unless `planData` overrides. `deletePlan`: verify ownership; delete slots (by templateId in the plan's templates), templates, then the plan; return boolean. Guard all index access.

Run: `pnpm --filter @gigaflow/api test workout.repo` → PASS.

- [ ] **Step 4: Typecheck + commit — Thành Duy.**
```bash
pnpm typecheck
git add packages/shared apps/api/src/modules/workout/workout.repo.ts apps/api/src/modules/workout/workout.repo.test.ts
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(api): add plan input schemas and repo CRUD (list/get/replace/delete)"
```

---

### Task 2: plan.service + PlanError + wire routes — [Thành Duy]

**Files:** create `apps/api/src/modules/workout/plan.service.ts`; modify `apps/api/src/modules/workout/workout.routes.ts`; test `apps/api/src/modules/workout/workout.routes.test.ts` (create/extend).

**Interfaces — Consumes:** Task 1 repo fns + shared input schemas. **Produces:** `class PlanError extends Error { status: 404 }`; `createPlan(userId, input)`, `updatePlan(userId, id, input)`, `activatePlan(userId, id)`, `removePlan(userId, id)`; and the new routes on `makeWorkoutRoutes`.

- [ ] **Step 1: Write failing route tests.** In `workout.routes.test.ts` (mirror the existing session.routes test harness: build the app with an injected fake verifier that maps a bearer token → a userId; use mongodb-memory-server). Cover:
  - `POST /plans` with a valid `CreatePlanInput` → 200 envelope, returns `PlanWithTemplates` with server ids + `source:'custom'`; then `GET /plans` lists it.
  - `GET /plans/:id` returns the graph for the owner; 404 for another user's token.
  - `PUT /plans/:id` replaces the graph (assert a changed slot count/exerciseId round-trips); 404 for non-owner.
  - `POST /plans/:id/activate` sets `isActive:true` and `GET /plans/active` returns it; activating a second plan flips the first to inactive.
  - `DELETE /plans/:id` → `{deleted:true}`, then `GET /plans/:id` → 404; deleting again → 404.
  - rep-range validation: `POST /plans` with a slot `repRangeMax < repRangeMin` → 400.

Run: `pnpm --filter @gigaflow/api test workout.routes` → FAIL.

- [ ] **Step 2: Implement `plan.service.ts`.** `PlanError extends Error { constructor(msg){super(msg); this.status=404}}` (mirror `SessionError`). `createPlan`: validate rep ranges (`repRangeMax >= repRangeMin` per slot, else throw a `PlanError`-like 400 — use a distinct `PlanValidationError { status:400 }` or reuse a 400 path; simplest: a `PlanError` subclass carrying status 400 for validation). Normalize template `orderIndex` to 0..n-1 by array position and slot `orderIndex` within each template likewise. Map to `insertPlanGraph(userId, {name, templateType: input.templateType, source: PlanSource.CUSTOM, isActive: input.isActive ?? false}, templates)`. `updatePlan`: same validation/normalize; `replacePlanGraph(...)`; if it returns null → throw `PlanError` (404). `activatePlan`: `findPlanById` (404 if null) then `setActivePlan(userId, id)`, return `findPlanById` fresh graph. `removePlan`: `deletePlan` → if false throw `PlanError` (404).

- [ ] **Step 3: Wire routes** in `makeWorkoutRoutes` per spec §3.4 (register `/active` before `/:id`; `zValidator('json', zCreatePlanInput/zUpdatePlanInput)`; catch `PlanError` → `c.json(errorBody(err.message), err.status)`; DELETE returns `apiSuccess({deleted:true})`). Keep existing `/active` + `/from-template`.

Run: `pnpm --filter @gigaflow/api test workout.routes` → PASS.

- [ ] **Step 4: Typecheck + commit — Thành Duy.**
```bash
pnpm typecheck
git add apps/api/src/modules/workout
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(api): add plan CRUD service and routes"
```

---

### Task 3: Web api helpers for plans + exercises — TDD — [Thành Duy]

**Files:** modify `apps/web/src/lib/api.ts`; test `apps/web/src/lib/api.plans.test.ts` (new, or extend `api.test.ts`).

**Interfaces — Consumes:** Task 1/2 shared schemas + routes. **Produces:** `getPlans()`, `getPlan(id)`, `createPlan(input)`, `updatePlan(id, input)`, `activatePlan(id)`, `deletePlan(id)`, `createExercise(input)`, and `getExercises(params?: { q?: string; muscleGroup?: MuscleGroup })` (extend the existing helper to append query params).

- [ ] **Step 1: Failing test** (fake `fetchImpl`, per the existing `api.test.ts` pattern):
```typescript
it('getExercises appends q and muscleGroup query params', async () => {
  let url = '';
  const fetchImpl = (async (input: RequestInfo) => { url = new Request(input).url; return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }); }) as typeof fetch;
  await getExercises({ q: 'bench', muscleGroup: MuscleGroup.CHEST }, fetchImpl);
  expect(url).toContain('q=bench'); expect(url).toContain('muscleGroup=chest');
});
it('createPlan posts the input and parses PlanWithTemplates', async () => {
  const plan = { /* minimal valid PlanWithTemplates fixture */ };
  const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: plan }), { status: 200 })) as typeof fetch;
  const out = await createPlan(minimalCreateInput, fetchImpl);
  expect(out.id).toBe(plan.id);
});
```
(Provide the `fetchImpl` passthrough on each helper the same way F1's helpers accept it, or via the module-level configureApi + a fake — match whatever `api.ts` already does. Build a minimal `PlanWithTemplates` fixture with all required zod fields incl. Date objects; the api reviver expects ISO strings on the wire, so serialize dates as ISO in the Response.)

Run: `pnpm --filter @gigaflow/web test api` → FAIL.

- [ ] **Step 2: Implement** the helpers using the real shared schemas (`zPlan.array()` for getPlans; `zPlanWithTemplates` for getPlan/createPlan/updatePlan/activatePlan; `z.object({deleted: z.boolean()})` for deletePlan; `zExercise` for createExercise). Extend `getExercises` to build a query string from optional `{q, muscleGroup}` (URLSearchParams; omit empty). Reuse `apiFetch` (Bearer + envelope + reviver + schema).

Run: `pnpm --filter @gigaflow/web test api` → PASS.

- [ ] **Step 3: Typecheck + build + commit — Thành Duy.**
```bash
pnpm --filter @gigaflow/web build && pnpm typecheck
git add apps/web/src/lib
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add plan and exercise api helpers"
```

---

### Task 4: Exercise Library page + components — TDD — [Bảo Hân]

**Files:** create `apps/web/src/components/{MuscleTag.tsx,SearchInput.tsx,SegmentedFilter.tsx,ExerciseListItem.tsx}`, `apps/web/src/features/exercises/{ExerciseLibraryPage.tsx,CustomExerciseForm.tsx,library.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx}`, `apps/web/src/i18n/{en,vi}.ts`.

**Interfaces — Consumes:** `getExercises`/`createExercise` (Task 3), `resolveTranslatable`, existing primitives. **Produces:** `MuscleTag({muscleGroup})`, `SearchInput({value,onChange,placeholder})` (debounced via an internal timer + `onChange` of the debounced value; keep the input controlled locally), `SegmentedFilter<T>({options, value, onChange})`, `ExerciseListItem({exercise})`; `ExerciseLibraryPage`; `CustomExerciseForm({onCreated?})`; route `/exercises`.

- [ ] **Step 1: Failing test — `library.test.tsx`** (mock `@/lib/api`; QueryClientProvider + MemoryRouter):
  - `getExercises` → 2 exercises → renders 2 `ExerciseListItem`s with resolved names.
  - typing in the search input (advance fake timers past the debounce) calls `getExercises` with `{ q: <text> }` (assert via the mock's last call args) — or asserts the query key includes the text.
  - selecting a muscle-group chip calls `getExercises` with that `muscleGroup`.
  - submitting `CustomExerciseForm` (fill en/vi name, pick muscle + equipment) calls `createExercise` with the built `CreateExerciseInput`.

Run → FAIL.

- [ ] **Step 2: Implement** the components + page. `SearchInput` debounces (~250ms, `vi`-friendly: use `setTimeout`). `SegmentedFilter` renders "All" + one chip per `MuscleGroup` value (label via i18n). `ExerciseLibraryPage`: `useQuery(['exercises', {q, muscleGroup}], () => getExercises({q, muscleGroup}))`, a `SearchInput`, a `SegmentedFilter`, the list, and a "＋ Custom" toggle revealing `CustomExerciseForm` (mutation → `queryClient.invalidateQueries(['exercises'])`). Add `exercises.*` i18n keys (title, searchPlaceholder, filterAll, muscle labels, custom form labels) to en + vi. Wire `/exercises` route + a nav entry.

Run → PASS; `pnpm --filter @gigaflow/web build` green.

- [ ] **Step 3: Typecheck + commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/components apps/web/src/features/exercises apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/i18n
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "feat(web): add exercise library page with search, filter, and custom create"
```

---

### Task 5: planBuilderStore (working-copy state machine) — TDD — [Thành Duy]

**Files:** create `apps/web/src/store/planBuilderStore.ts`, `apps/web/src/store/planBuilderStore.test.ts`.

**Interfaces — Consumes:** shared `PlanWithTemplates`/`CreatePlanInput`/`EquipmentType`/`ColorTag`/`PlanTemplateType`/`Exercise`. **Produces:** Zustand store with `EditableSlot`, `EditableTemplate`, state `{ name, templateType, templates }`, actions `init(fromPlan?)`, `setName`, `addTemplate`, `removeTemplate`, `setTemplateMeta(ti, patch)`, `moveTemplate(ti, dir)`, `addSlot(ti, exercise)`, `updateSlot(ti, si, patch)`, `removeSlot(ti, si)`, `moveSlot(ti, si, dir)`, `toInput(): CreatePlanInput`, `reset()`.

- [ ] **Step 1: Failing test:**
  - `init()` (no arg) → blank plan (name '', templateType CUSTOM, one empty template) OR empty templates — pick one and assert it; `init(fromPlan)` maps a `PlanWithTemplates` fixture into editable templates/slots (names + slot fields carried).
  - `addSlot(0, exercise)` appends a slot seeded `{exerciseId: exercise.id, setsTarget:3, repRangeMin:8, repRangeMax:12, equipmentType: exercise.equipmentType, weightIncrement: exercise.defaultIncrement ?? 2.5}`.
  - `updateSlot(0,0,{setsTarget:4})` changes only that field; `removeSlot`/`moveSlot` reorder; `moveSlot(0,1,'up')` swaps indices.
  - `toInput()` returns a `CreatePlanInput` with contiguous `orderIndex` (templates 0..n, slots 0..m within each) and the edited values; excludes empty templates? (Decide: keep all templates; a template with 0 slots is allowed by zTemplateInput since slots array can be empty — but zCreatePlanInput requires ≥1 template. Assert toInput keeps templates and assigns orderIndex.)

Run → FAIL.

- [ ] **Step 2: Implement** the store (immutable updates; guard indices; `moveSlot`/`moveTemplate` no-op at bounds). `toInput` maps editable → `zCreatePlanInput` shape, assigning `orderIndex` by position. No `any`.

Run → PASS.

- [ ] **Step 3: Typecheck + build + commit — Thành Duy.**
```bash
pnpm --filter @gigaflow/web build && pnpm typecheck
git add apps/web/src/store/planBuilderStore.ts apps/web/src/store/planBuilderStore.test.ts
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add plan-builder working-copy store"
```

---

### Task 6: Plans management page — TDD — [Bảo Hân]

**Files:** create `apps/web/src/components/PlanListItem.tsx`, `apps/web/src/features/plans/{PlansPage.tsx,plans-page.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx}`, `apps/web/src/i18n/{en,vi}.ts`.

**Interfaces — Consumes:** `getPlans`/`activatePlan`/`deletePlan`/`createPlanFromTemplate` (api), route constants. **Produces:** `PlanListItem({plan, onActivate, onEdit, onDelete})`; `PlansPage`; route `/plans` + `planEditPath(id)`/`planNewPath` helpers in `routes.ts`.

- [ ] **Step 1: Failing test — `plans-page.test.tsx`** (mock api; QueryClientProvider + MemoryRouter):
  - `getPlans` → 2 plans (one `isActive`) → renders 2 rows; the active one shows an Active badge.
  - clicking Activate on the inactive row calls `activatePlan(id)`.
  - clicking Delete (confirm) calls `deletePlan(id)`.
  - clicking a preset in the header calls `createPlanFromTemplate(type)`.
  - `getPlans` → [] → empty state with New/From-preset actions.

Run → FAIL.

- [ ] **Step 2: Implement** `PlanListItem` + `PlansPage` (`useQuery(['plans'], getPlans)`; mutations invalidate `['plans']` and, for activate, `['activePlan']`; Delete guarded by a confirm — a simple `window.confirm` or an inline confirm control; if `window.confirm`, don't trigger it in a way that adds jsdom noise — prefer an inline two-step confirm button so tests stay pristine). Header: New plan (→ planNewPath), From preset (3 buttons). Add `plans.*` i18n keys (en + vi). Wire `/plans` route + nav entry.

Run → PASS; build green.

- [ ] **Step 3: Typecheck + commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/components/PlanListItem.tsx apps/web/src/features/plans apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/i18n
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "feat(web): add plans management page"
```

---

### Task 7: Plan Builder page + editors + picker — TDD — [Thành Duy]

**Files:** create `apps/web/src/components/{SlotEditorRow.tsx,TemplateEditor.tsx,ExercisePickerModal.tsx}`, `apps/web/src/features/plans/{PlanBuilderPage.tsx,plan-builder.test.tsx}`; modify `apps/web/src/{routes.ts,App.tsx}`, `apps/web/src/i18n/{en,vi}.ts`.

**Interfaces — Consumes:** `planBuilderStore` (Task 5), `getExercises`/`getPlan`/`createPlan`/`updatePlan` (api), `resolveTranslatable`, F1 primitives + `SearchInput`/`SegmentedFilter`/`ExerciseListItem`/`MuscleTag` (Task 4). **Produces:** `SlotEditorRow({slot, exerciseName, onChange, onRemove, onMove})`; `TemplateEditor({template, index, exercisesById, on…})`; `ExercisePickerModal({open, onPick, onClose})` (reuses the library list); `PlanBuilderPage`; routes `/plans/new` and `/plans/:id/edit`.

- [ ] **Step 1: Failing test — `plan-builder.test.tsx`** (mock api; QueryClientProvider + MemoryRouter at `/plans/new` and separately `/plans/p1/edit`):
  - new: `getExercises` → catalog; store starts blank; open the picker, pick an exercise → a `SlotEditorRow` appears; edit its sets to 4; click Save → `createPlan` called with a `CreatePlanInput` whose first template's first slot has `exerciseId` = picked + `setsTarget:4`; navigates to `/plans`.
  - edit: seed `getPlan('p1')` → a plan with 1 template/1 slot; the builder renders that slot; Save → `updatePlan('p1', input)` called with the graph.

Run → FAIL.

- [ ] **Step 2: Implement.** `SlotEditorRow`: exercise name + inline number inputs (sets, repMin, repMax, increment — tnum, ≥44px), equipment select, remove + up/down buttons → `onChange(patch)`/`onRemove`/`onMove(dir)`. `TemplateEditor`: template name input (localized — edits the `en`/current-lang field; keep it simple: edit a single display string mapped into `{en,vi}` both, or edit en and mirror — pick edit-`en`-and-mirror-to-vi for F2, note it), colorTag swatches (ColorDot), its `SlotEditorRow`s, "＋ Add exercise" (opens picker), move/remove day. `ExercisePickerModal`: a dialog reusing `SearchInput`+`SegmentedFilter`+the exercise list; picking calls `onPick(exercise)` and closes. `PlanBuilderPage`: on `/plans/:id/edit` `useQuery(['plan', id], () => getPlan(id))` then `planBuilderStore.init(plan)`; on `/plans/new` `init()`. `useQuery(['exercises'], () => getExercises())` for the name map. Editable plan name; a `TemplateEditor` per template; "＋ Add day"; Save (create vs update by presence of `:id`) → mutation → invalidate `['plans']`(+`['activePlan']` if the plan is active) → navigate `/plans`; Cancel → `/plans`. Add remaining `plans.*`/builder i18n keys (en+vi). Wire both routes + `planEditPath`/`planNewPath` (already added in Task 6 — reuse).

Run → PASS; `pnpm --filter @gigaflow/web build` green.

- [ ] **Step 3: Typecheck + commit — Thành Duy.**
```bash
pnpm typecheck
git add apps/web/src/components apps/web/src/features/plans apps/web/src/routes.ts apps/web/src/App.tsx apps/web/src/i18n
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add plan builder with exercise picker and slot editors"
```

---

### Task 8: Docs — README F2 section — [Bảo Hân]

**Files:** modify `README.md`.

- [ ] **Step 1:** Add an F2 subsection under the Web app section: what shipped (Exercise Library with search/filter/create-custom; Plans management: list/activate/delete/from-preset; Plan Builder: days + exercises + set/rep/increment/equipment, reorder, save; new backend plan endpoints `GET/POST/PUT /plans`, `GET /plans/:id`, `POST /plans/:id/activate`, `DELETE /plans/:id`). Update the roadmap: E13 frontend F0+F1+F2 done; F3 (AI/meal/InBody/stats UI) deferred. Keep consistent with existing README style.
- [ ] **Step 2: Commit — Bảo Hân.**
```bash
git add README.md
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "docs: document web F2 (plans builder + exercise library)"
```

---

## Self-Review

**1. Spec coverage:** shared input schemas + repo CRUD (T1); service + PlanError + routes incl. GET/:id and ordering rule (T2); web api helpers incl. getExercises params (T3); Exercise Library + custom create + components (T4); planBuilderStore (T5); Plans management incl. activate/delete/from-preset (T6); Plan Builder + picker + slot/template editors + new/edit routes + nav (T7); docs (T8). Backend tests in T1/T2, web tests in T3–T7. Non-goals (DnD, granular endpoints, transaction, exercise edit/delete, F3) left out per spec §7. All spec sections mapped.

**2. Placeholder scan:** repo/service/store/api have concrete signatures + real test assertions; UI tasks specify components by exact props + concrete test assertions + token/i18n rules (JSX rendered to the tokens rather than inlined — consistent with F1). Two decisions made explicit rather than left vague: template-name editing = edit `en`, mirror to `vi` for F2 (T7); delete confirm = inline two-step control to keep tests pristine (T6). No "TBD"/"handle appropriately" directives.

**3. Type consistency:** `CreatePlanInput`/`UpdatePlanInput`/`zSlotInput`/`zTemplateInput` defined in T1, consumed by T2 (routes), T3 (api), T5 (`toInput`), T7 (Save). `PlanWithTemplates`/`Plan` returned by repo (T1) → service (T2) → api helpers (T3) → pages (T6/T7). `planBuilderStore.toInput()` returns exactly `CreatePlanInput` fed to `createPlan`/`updatePlan`. Route paths in T2 match api helper paths in T3 (`GET /plans`, `GET /plans/:id`, `POST /plans`, `PUT /plans/:id`, `POST /plans/:id/activate`, `DELETE /plans/:id`). `getExercises({q,muscleGroup})` signature (T3) consumed by T4 + T7. Query keys `['plans']`, `['plan', id]`, `['exercises', …]`, `['activePlan']` consistent across T4/T6/T7. `routes.ts` helpers `planEditPath`/`planNewPath` added in T6, reused in T7. Every task ends green on its suite + typecheck.

**Assignees:** T1,T2,T3,T5,T7 → Thành Duy; T4,T6,T8 → Bảo Hân.
