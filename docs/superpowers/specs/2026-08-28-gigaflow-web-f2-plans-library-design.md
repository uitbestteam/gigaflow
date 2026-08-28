# GigaFlow Web F2 — Plans Builder + Exercise Library (Design)

**Date:** 2026-08-28
**Status:** Approved for implementation
**Scope:** Full-stack. Backend plan-CRUD endpoints (`apps/api`) + the web UI (`apps/web`) for managing plans, building/editing a plan's days & exercises, and an exercise library with custom-exercise creation. Builds on F0 (foundation) + F1 (core loop), already on `main`.

## 1. Goal

Let a user go beyond the F1 preset bootstrap: browse/search the exercise catalog and create their own exercises; see all their plans; create a plan (blank or from a preset), edit its days and per-exercise targets (sets, rep range, weight increment, equipment), reorder/add/remove exercises, set the active plan, and delete a plan. The active plan then drives the F1 Home queue.

## 2. Locked decisions

- **Full builder** (not a light editor): create custom plans from scratch, add/remove/reorder exercises per day, edit set/rep/increment, set-active, delete.
- **Exercise library** includes custom-exercise creation (backend `POST /exercises` already exists).
- Plan edits are made **client-side** on a working copy and persisted with a **whole-plan-graph save** (`POST /plans` for new, `PUT /plans/:id` for existing) — no per-slot granular endpoints. This keeps the API small and each save atomic-enough for a single-user document set (no multi-doc transaction needed; the replace is delete-then-insert scoped to one plan, documented as a known non-atomic window like the rest of the app's deferred-transaction items).
- Stack unchanged from F0/F1: Hono + native driver + Zod (backend); Vite/React/TS + Tailwind tokens + TanStack Query + Zustand + React Router + i18next (web). Tests: Vitest + mongodb-memory-server (api), Vitest + jsdom + Testing Library (web). No real network/Firebase/GCP in tests.

## 3. Backend additions (`apps/api` + `packages/shared`)

### 3.1 Shared schemas (`packages/shared/src/schemas/plan.ts`)
Add input schemas for create/update (server-assigned ids omitted; the graph is authoritative on save):

```ts
export const zSlotInput = z.object({
  exerciseId: z.string().min(1),
  orderIndex: z.number().int().min(0),
  setsTarget: z.number().int().min(1).max(10),
  repRangeMin: z.number().int().min(1),
  repRangeMax: z.number().int().min(1),
  equipmentType: z.nativeEnum(EquipmentType),
  weightIncrement: z.number().min(0),
});
export const zTemplateInput = z.object({
  name: zTranslatable,
  focus: zTranslatable.optional(),
  orderIndex: z.number().int().min(0),
  colorTag: z.nativeEnum(ColorTag),
  slots: z.array(zSlotInput),
});
export const zCreatePlanInput = z.object({
  name: z.string().min(1),
  templateType: z.nativeEnum(PlanTemplateType),   // CUSTOM for hand-built
  isActive: z.boolean().optional(),               // default false; server activates via /activate too
  templates: z.array(zTemplateInput).min(1),
});
export const zUpdatePlanInput = zCreatePlanInput;  // same shape; replaces the graph
export type CreatePlanInput = z.infer<typeof zCreatePlanInput>;
export type UpdatePlanInput = z.infer<typeof zUpdatePlanInput>;
```
Validation rule enforced in the service (not just Zod): every `repRangeMax >= repRangeMin`; `orderIndex` values within a plan/template are used for ordering but need not be contiguous (the service normalizes to 0..n-1 on save).

### 3.2 Repo (`apps/api/src/modules/workout/workout.repo.ts`)
- `listPlans(userId): Promise<Plan[]>` — all plans for the user, newest first (metadata only, no templates — the list view doesn't need the full graph).
- `replacePlanGraph(userId, planId, planData, newTemplates): Promise<PlanWithTemplates | null>` — verify the plan belongs to userId (return null if not); delete its existing templates+slots; re-insert the new graph (reuse the same per-template/slot insert logic as `insertPlanGraph`); keep `createdAt`, `isActive`, `templateType` unless changed; return the fresh `PlanWithTemplates`. Extract the shared insert loop so `insertPlanGraph` and `replacePlanGraph` don't duplicate it.
- `deletePlan(userId, planId): Promise<boolean>` — ownership-checked; delete the plan + its templates + their slots; return false if not found/owned.
- Reuse existing `insertPlanGraph`, `findActivePlan`, `setActivePlan`, `getTemplateWithSlotsForUser`.

### 3.3 Service (`apps/api/src/modules/workout/plan.service.ts` — new, thin)
- `createPlan(userId, input: CreatePlanInput)` — normalize orderIndex, validate rep ranges, map to `insertPlanGraph`; `source: PlanSource.CUSTOM`. Returns `PlanWithTemplates`.
- `updatePlan(userId, planId, input: UpdatePlanInput)` — validate; `replacePlanGraph`; throw a typed `PlanError` (404) if not owned.
- `activatePlan(userId, planId)` — `setActivePlan` (throw 404 if not owned — check via a repo ownership helper or `findPlanById`).
- `removePlan(userId, planId)` — `deletePlan`; 404 if not found.
- A `PlanError extends Error { status }` mirroring the existing `SessionError` pattern.

### 3.4 Routes (`apps/api/src/modules/workout/workout.routes.ts`, base `/plans`)
Add to `makeWorkoutRoutes` (all behind the existing `firebaseAuth`). Register the literal `/active` route BEFORE the parametric `/:id` so Hono doesn't match "active" as an id:
- `GET /plans` → `listPlans` → `Plan[]`.
- `GET /plans/:id` → `findPlanById(userId, id)` (ownership-checked repo helper) → `PlanWithTemplates`; 404 if not found/owned. (Used by the builder's edit route to load the full graph on reload.)
- `POST /plans` (zValidator zCreatePlanInput) → `createPlan` → `PlanWithTemplates` (201-ish via apiSuccess).
- `PUT /plans/:id` (zValidator zUpdatePlanInput) → `updatePlan` → `PlanWithTemplates`; 404 on PlanError.
- `POST /plans/:id/activate` → `activatePlan` → the activated `PlanWithTemplates`; 404.
- `DELETE /plans/:id` → `removePlan` → `{ deleted: true }`; 404.
Keep existing `GET /plans/active`, `POST /plans/from-template`. (§3.2 repo therefore also adds `findPlanById(userId, planId): Promise<PlanWithTemplates | null>`.)

### 3.5 Backend tests
Route + service tests with mongodb-memory-server (mirror the existing session/workout test style, injected verifier): create→list→get-active, update replaces the graph (old slots gone, new present), activate flips isActive (and only one active), delete removes graph + 404s on re-delete, ownership isolation (user B cannot update/delete/activate user A's plan → 404), rep-range validation rejects max<min.

## 4. Frontend additions (`apps/web`)

### 4.1 API helpers (`apps/web/src/lib/api.ts`)
Add, reusing shared schemas: `getPlans()` → GET /plans → `zPlan.array()`; `createPlan(input: CreatePlanInput)` → POST /plans → `zPlanWithTemplates`; `updatePlan(id, input)` → PUT /plans/:id → `zPlanWithTemplates`; `activatePlan(id)` → POST /plans/:id/activate → `zPlanWithTemplates` (or zPlan — match handler); `deletePlan(id)` → DELETE /plans/:id → `z.object({deleted: z.boolean()})`; `createExercise(input: CreateExerciseInput)` → POST /exercises → `zExercise`. (`getExercises()` already exists from F1.)

### 4.2 Exercise Library (`apps/web/src/features/exercises/`)
- `ExerciseLibraryPage.tsx` — `useQuery(['exercises', {q, muscleGroup}], () => getExercises({q, muscleGroup}))` (extend `getExercises` to accept optional `{q, muscleGroup}` query params → `GET /exercises?q=&muscleGroup=`). A search input (debounced) + a muscle-group filter (chips/segmented, `MuscleGroup` values, "All"). List rows: name (resolveTranslatable) + muscle tag (ColorDot-style or a MuscleTag) + equipment. A "＋ Custom" button opens `CustomExerciseForm`.
- `CustomExerciseForm.tsx` — fields: name (en + vi), muscleGroup (select), equipmentType (select), defaultIncrement (number, optional) → `createExercise` mutation → invalidate `['exercises']`. Validates non-empty names; dark tokens.

### 4.3 Plans management (`apps/web/src/features/plans/`)
- `PlansPage.tsx` — `useQuery(['plans'], getPlans)`. Rows: plan name + templateType + an **Active** badge (`isActive`). Actions per row: **Activate** (mutation → invalidate `['plans']` + `['activePlan']`), **Edit** (→ `/plans/:id/edit`), **Delete** (confirm → mutation → invalidate). Header actions: **New plan** (→ `/plans/new`) and **From preset** (the 3 presets → `createPlanFromTemplate` → invalidate). Empty state mirrors F1's.

### 4.4 Plan Builder (`apps/web/src/features/plans/PlanBuilderPage.tsx` + `planBuilderStore`)
- Route `/plans/new` (blank working copy) and `/plans/:id/edit` — the edit route loads the full graph via `useQuery(['plan', id], () => getPlan(id))` (backed by `GET /plans/:id`, §3.4), so edit is robust on a page reload rather than depending on cache.
- `planBuilderStore` (Zustand, client-only working copy): holds `{ name, templateType, templates: EditableTemplate[] }` where `EditableTemplate = { name:Translatable, focus?, colorTag, slots: EditableSlot[] }`, `EditableSlot = { exerciseId, setsTarget, repRangeMin, repRangeMax, equipmentType, weightIncrement }`. Actions: `init(fromPlan?)`, `setName`, `addTemplate`/`removeTemplate`/`setTemplateMeta`, `addSlot(templateIdx, exerciseId)` (defaults sets 3 / 8–12 / increment from the exercise), `updateSlot(ti, si, patch)`, `removeSlot(ti, si)`, `moveSlot(ti, si, dir)` (reorder within a day), `moveTemplate(ti, dir)`, `toInput(): CreatePlanInput` (assigns contiguous orderIndex). Guard indices (noUncheckedIndexedAccess).
- UI: editable plan name; a section per template (day) with name (localized input), colorTag picker (ColorDot swatches), and its slots; each slot row shows the exercise name (joined from the `['exercises']` catalog) + inline number inputs for sets and rep-range + an equipment select + increment + remove + up/down. "＋ Add exercise" opens an **ExercisePicker** (reuses the library's search/filter list in a modal; picking calls `addSlot`). "＋ Add day" adds a template. **Save** → `createPlan`/`updatePlan` → invalidate `['plans']`(+`['activePlan']` if active) → navigate `/plans`. Cancel → `/plans`.
- Reuse F1's `resolveTranslatable`, domain look (ColorDot, Button, Card), tokens, and i18n (`plans.*`, `exercises.*` groups; en/vi in sync).

### 4.5 Navigation
Add nav entries (MainLayout header or a simple menu) to reach `/plans` and `/exercises`. Wire all new routes in `App.tsx` + `routes.ts` (path constants + helpers `planEditPath(id)`).

## 5. Components (web)
`MuscleTag` (muscle-group colored label), `SearchInput` (debounced), `SegmentedFilter` (muscle-group chips), `ExerciseListItem`, `ExercisePickerModal`, `SlotEditorRow`, `TemplateEditor`, `PlanListItem`, `CustomExerciseForm`. All Tailwind + tokens, ≥44px targets, tabular-nums for numbers, en/vi copy via i18n.

## 6. Testing
- **Backend:** as §3.5.
- **Web:** `api.ts` new helpers (fake fetchImpl, schema validation, query-param building for getExercises); `planBuilderStore` (add/remove/reorder/toInput orderIndex assignment + rep-range invariants); ExerciseLibraryPage (mock api: renders list, filter narrows the query key/args, custom form calls createExercise); PlansPage (list + activate/delete call the right api + invalidations; from-preset); PlanBuilderPage (seed from a plan, add an exercise via picker, edit a slot, Save calls create/updatePlan with the built input). Mock `@/lib/api`; fresh QueryClient + MemoryRouter; deterministic (fake timers for debounce). No real network/Firebase.

## 7. Non-goals / deferred
- Drag-and-drop reordering (use up/down buttons; DnD is a later polish).
- Per-slot granular endpoints (whole-graph save chosen).
- Multi-doc transaction for the replace (documented deferral, consistent with the rest of the app).
- Exercise edit/delete UI (only create custom this pass; backend has no update/delete exercise route either).
- AI/meal/InBody/stats UIs (that's F3).

## 8. Task decomposition (for writing-plans)
**Backend:** (1) shared plan input schemas + repo `listPlans`/`replacePlanGraph`/`deletePlan` (+ extract shared insert loop) with repo tests; (2) `plan.service.ts` + `PlanError` + wire routes (GET list, GET :id, POST, PUT, POST activate, DELETE) with route tests.
**Frontend:** (3) api helpers (getPlans/getPlan/createPlan/updatePlan/activatePlan/deletePlan/createExercise + getExercises query params) + queryKeys, TDD; (4) library components (MuscleTag/SearchInput/SegmentedFilter/ExerciseListItem/CustomExerciseForm) + ExerciseLibraryPage + route, TDD; (5) planBuilderStore (working-copy state machine) TDD; (6) PlansPage (list/activate/delete/from-preset) + route, TDD; (7) PlanBuilderPage + ExercisePickerModal + SlotEditorRow/TemplateEditor + `/plans/new` & `/plans/:id/edit` routes + nav wiring, TDD; (8) docs (README F2 + i18n groups) .

**Assignees:** backend (1,2) → Thành Duy; api helpers (3) → Thành Duy; library UI + components (4) → Bảo Hân; planBuilderStore (5) → Thành Duy; PlansPage (6) → Bảo Hân; PlanBuilderPage (7) → Thành Duy; docs (8) → Bảo Hân. (Set per task in the plan; commit as the assignee's git identity.)
