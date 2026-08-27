# E9 — Meal Planner (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e9-meal`.

**Goal:** Generate a weekly meal plan with AI, sized to the user's calorie/macro targets — a pure **TDEE calculator** (Mifflin-St Jeor + activity + goal → target calories/macros) feeds a **Gemini-only** meal generation job (`POST /api/meal/generate` → jobId, poll `GET /api/meal/jobs/:id`, fetch `GET /api/meal/active`), gated by the E12 quota. Reuses E7's AI engine + job flow + inline enqueuer wholesale; **testable with no GCP and no AI keys**.

**Architecture:** Extends E7. The `AiEngine` gains a generic `generate<T>(prompt, schema)` (existing `generateWorkoutPlan` unchanged) plus `generateMealPlan`; a `buildMealAiEngine()` factory wires **Gemini only** (per the "meal = Gemini only" decision). TDEE is a pure function fed from the request body (goal, gender, age, height, weight, activity). The generated plan's macros are validated by Zod and stored in `meal_plans`. Jobs reuse the E7 `generation-job` repo (`type: MEAL`). Native driver + Zod, `.js` ESM, per-assignee commits.

**Tech Stack:** Hono, MongoDB native driver, Zod, global `fetch` (Node 22), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5 meal_plans, §9 meal, AI: meal = Gemini only)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E9)

## Scope

**In scope (backend):** E9-S1 (TDEE calculator), E9-S2 (meal generate job, Gemini-only — engine method + factory + prompt + repo + service + routes). **Deferred:** E9-S3 (meal planner UI → E13); Cloud Tasks enqueuer real impl / FCM (as in E7).

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm; TS strict, NO `any`, guard `noUncheckedIndexedAccess`, explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`; routes under `/api`.
- Meal generation route behind `firebaseAuth` (E2) + `quotaGuard(GenerationType.MEAL)` (E12); `incrementUsage` on enqueue, `rollbackUsage` on failure.
- **Meal uses Gemini ONLY** (no OpenAI fallback) — enforced by `buildMealAiEngine()`.
- No real AI/GCP in tests: engine + enqueuer injected; fakes in tests.
- Run turbo `pnpm typecheck` (exit 0) + `pnpm test` after every api task. Engine refactor MUST keep E7's `generateWorkoutPlan` behavior (its tests stay green).
- **Commit author = the task's assignee:** Thanh Minh → `Nguyen Thanh Minh <95201788+ngthminhdev@users.noreply.github.com>`; Quan → `Luong Hong Quan <lhongquan.1998@gmail.com>`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts                    # + Gender, ActivityLevel, MealType
  schemas/meal.ts                   # zGenerateMealInput, zTdeeResult, zMeal, zMealDay, zMealPlan, zMealPlanDoc + types (NEW)
  index.ts
apps/api/src/modules/nutrition/
  tdee.ts                           # computeTdee() (pure) (NEW)
  tdee.test.ts
  meal-plan.repo.ts                 # createMealPlan / findActiveMealPlan / findMealPlanForUser (NEW)
  meal-plan.repo.test.ts
  meal-prompt.ts                    # buildMealPrompt() (pure) (NEW)
  meal-prompt.test.ts
  meal-generation.service.ts        # processGenerateMeal (NEW)
  meal-generation.service.test.ts
  meal-gen.routes.ts                # POST /meal/generate, GET /meal/jobs/:id, GET /meal/active, POST /internal/tasks/generate-meal (NEW)
  meal-gen.routes.test.ts
apps/api/src/modules/ai/
  ai-provider.ts                    # + generic generate<T> + generateMealPlan
  ai-engine.test.ts                 # + a meal-plan fallback test
  ai.factory.ts                     # + buildMealAiEngine() (Gemini only)
apps/api/src/app.ts                 # mount /meal + internal generate-meal
apps/api/src/index.ts               # ensureMealPlanIndexes
```

---

### Task 1: Nutrition enums + meal schemas (shared) — [Thanh Minh]

**Files:** modify `enums/index.ts`, `index.ts`; create `schemas/meal.ts`, `schemas/meal.test.ts`.

**Interfaces — Produces:**
- `enum Gender { MALE='male', FEMALE='female' }`
- `enum ActivityLevel { SEDENTARY='sedentary', LIGHT='light', MODERATE='moderate', ACTIVE='active', VERY_ACTIVE='very_active' }`
- `enum MealType { BREAKFAST='breakfast', LUNCH='lunch', DINNER='dinner', SNACK='snack' }`
- `zGenerateMealInput` → `GenerateMealInput`: `{ goal: Goal, gender: Gender, age: int 10–100, heightCm: number>0, weightKg: number>0, activityLevel: ActivityLevel }`.
- `zTdeeResult` → `TdeeResult`: `{ bmr: int≥0, tdee: int≥0, targetCalories: int≥0, proteinG: int≥0, carbsG: int≥0, fatG: int≥0 }`.
- `zMeal` → `Meal`: `{ name: Translatable, mealType: MealType, calories: number≥0, proteinG: number≥0, carbsG: number≥0, fatG: number≥0, ingredients: string[] }`.
- `zMealDay` → `MealDay`: `{ dayIndex: int 1–7, meals: array(min1) of zMeal, totalCalories: number≥0, totalProteinG: number≥0, totalCarbsG: number≥0, totalFatG: number≥0 }`.
- `zMealPlan` → `MealPlan` (AI output): `{ name: string(min1), days: array(min1) of zMealDay }`.
- `zMealPlanDoc` → `MealPlanDoc` = `zMealPlan.extend({ id: string, userId: string, createdAt: Date, isActive: boolean })`.

- [ ] **Step 1: Failing test — `schemas/meal.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zGenerateMealInput, zMealPlan, Goal, Gender, ActivityLevel, MealType } from '../index';

describe('meal schemas', () => {
  it('accepts a valid generate-meal input', () => {
    expect(zGenerateMealInput.safeParse({ goal: Goal.WEIGHT_LOSS, gender: Gender.MALE, age: 30, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE }).success).toBe(true);
  });
  it('rejects an out-of-range age', () => {
    expect(zGenerateMealInput.safeParse({ goal: Goal.WEIGHT_LOSS, gender: Gender.MALE, age: 5, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE }).success).toBe(false);
  });
  it('accepts a valid meal plan', () => {
    const p = { name: 'Cut', days: [{ dayIndex: 1, meals: [{ name: { en: 'Oats', vi: 'Yến mạch' }, mealType: MealType.BREAKFAST, calories: 400, proteinG: 20, carbsG: 60, fatG: 8, ingredients: ['oats', 'milk'] }], totalCalories: 400, totalProteinG: 20, totalCarbsG: 60, totalFatG: 8 }] };
    expect(zMealPlan.safeParse(p).success).toBe(true);
  });
  it('rejects a meal plan with no days', () => {
    expect(zMealPlan.safeParse({ name: 'x', days: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/meal.test.ts`)

- [ ] **Step 3: Add enums** (Gender, ActivityLevel, MealType) to `enums/index.ts`.

- [ ] **Step 4: Create `schemas/meal.ts`** per the Interfaces (import `Goal` from enums, `zTranslatable` from `./common.js`; `.js` extensions).

- [ ] **Step 5: Export** — add `export * from './schemas/meal.js';` to `index.ts`.

- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 30 + 4 new = 34).

- [ ] **Step 7: Commit — Thanh Minh**

```bash
git add packages/shared
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(shared): add nutrition enums and meal plan schemas"
```

---

### Task 2: TDEE calculator (pure) — TDD — [Thanh Minh]

**Files:** create `apps/api/src/modules/nutrition/tdee.ts`, `tdee.test.ts`.

**Interfaces — Produces:** `computeTdee(input: GenerateMealInput): TdeeResult` —
- **BMR (Mifflin-St Jeor):** male `10*weightKg + 6.25*heightCm - 5*age + 5`; female `... - 161`.
- **Activity multiplier:** sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very_active 1.9. `tdee = bmr * multiplier`.
- **targetCalories by goal:** `weight_loss` → `tdee*0.8`; `hypertrophy` → `tdee*1.1`; `strength` → `tdee*1.05`; `general_fitness` → `tdee`.
- **Macros:** `proteinG = 2*weightKg`; `fatG = (targetCalories*0.25)/9`; `carbsG = max(0, (targetCalories - proteinG*4 - fatG*9)/4)`.
- Return all fields **rounded to integers** (`Math.round`), `carbsG` floored at 0.

- [ ] **Step 1: Failing test — `tdee.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Goal, Gender, ActivityLevel } from '@gigaflow/shared';
import { computeTdee } from './tdee';

describe('computeTdee', () => {
  it('computes BMR/TDEE for a male, maintenance', () => {
    const r = computeTdee({ goal: Goal.GENERAL_FITNESS, gender: Gender.MALE, age: 30, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE });
    // BMR = 10*75 + 6.25*175 - 5*30 + 5 = 1698.75 ; TDEE = *1.55 = 2633.06 -> 2633
    expect(r.bmr).toBe(1699);
    expect(r.tdee).toBe(2633);
    expect(r.targetCalories).toBe(2633);
    expect(r.proteinG).toBe(150);
  });
  it('cuts calories for weight loss', () => {
    const r = computeTdee({ goal: Goal.WEIGHT_LOSS, gender: Gender.MALE, age: 30, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE });
    expect(r.targetCalories).toBe(Math.round(2633.06 * 0.8)); // 2106
    expect(r.carbsG).toBeGreaterThanOrEqual(0);
  });
  it('applies the female BMR offset', () => {
    const male = computeTdee({ goal: Goal.GENERAL_FITNESS, gender: Gender.MALE, age: 30, heightCm: 165, weightKg: 60, activityLevel: ActivityLevel.SEDENTARY });
    const female = computeTdee({ goal: Goal.GENERAL_FITNESS, gender: Gender.FEMALE, age: 30, heightCm: 165, weightKg: 60, activityLevel: ActivityLevel.SEDENTARY });
    expect(male.bmr - female.bmr).toBe(166); // +5 vs -161
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement `tdee.ts`** per Interfaces (compute unrounded, round at the end; no `any`; guard the activity multiplier lookup via a `Record<ActivityLevel, number>` and the goal factor via a `Record<Goal, number>`).
- [ ] **Step 4: Run — expect PASS** (3 tests); root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Thanh Minh**

```bash
git add apps/api/src/modules/nutrition/tdee.ts apps/api/src/modules/nutrition/tdee.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add TDEE calculator (Mifflin-St Jeor + macros)"
```

---

### Task 3: AI engine meal support (generic + Gemini-only factory) + meal prompt — TDD — [Quan]

**Files:** modify `apps/api/src/modules/ai/ai-provider.ts`, `ai-engine.test.ts`, `ai.factory.ts`; create `apps/api/src/modules/nutrition/meal-prompt.ts`, `meal-prompt.test.ts`.

**Interfaces — Produces:**
- Refactor `AiEngine`: extract a **private** `async generate<T>(prompt, schema: z.ZodType<T>): Promise<T>` implementing the existing try/validate/fallback loop; `generateWorkoutPlan(prompt)` now `return this.generate(prompt, zGeneratedPlan)` (behavior identical — E7 tests must stay green); ADD `generateMealPlan(prompt): Promise<MealPlan>` = `this.generate(prompt, zMealPlan)`.
- `ai.factory.ts`: ADD `buildMealAiEngine(): AiEngine` — **Gemini only** (include `GeminiProvider` iff `GEMINI_API_KEY`; else a single `UnconfiguredAiProvider`). Do NOT include OpenAI.
- `meal-prompt.ts`: `interface MealPromptInput { targetCalories: number; proteinG: number; carbsG: number; fatG: number; goal: string }`; `buildMealPrompt(input): { system: string; user: string }` — pure; the `system` message states: return ONLY minified JSON matching the meal-plan schema (`{ name, days:[ { dayIndex 1-7, meals:[ { name:{en,vi}, mealType: breakfast|lunch|dinner|snack, calories, proteinG, carbsG, fatG, ingredients:[...] } ], totalCalories, totalProteinG, totalCarbsG, totalFatG } ] }`), produce **7 days**, each day's totals ≈ the target calories/macros, bilingual meal names. The `user` embeds the target calories + macros + goal.

- [ ] **Step 1: Failing tests** — extend `ai-engine.test.ts` with a `generateMealPlan` fallback case (fake providers returning a valid `MealPlan` / throwing) and `meal-prompt.test.ts` (asserts the prompt mentions `days`, `mealType`, `ingredients`, JSON, and the target-calorie number).

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** the engine refactor (private generic + both public methods), `buildMealAiEngine`, and `meal-prompt.ts`. No `any`.
- [ ] **Step 4: Run — expect PASS** (engine + meal-prompt tests, and the pre-existing 4 engine tests still pass); root `pnpm typecheck` exit 0; full `pnpm test` green (E7 `generateWorkoutPlan` unaffected).
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/ai apps/api/src/modules/nutrition/meal-prompt.ts apps/api/src/modules/nutrition/meal-prompt.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add meal-plan generation to AI engine (Gemini-only) and meal prompt"
```

---

### Task 4: Meal-plan repo + meal-generation service — TDD — [Quan]

**Files:** create `apps/api/src/modules/nutrition/meal-plan.repo.ts`, `meal-plan.repo.test.ts`, `meal-generation.service.ts`, `meal-generation.service.test.ts`.

**Interfaces — Produces:**
- `meal-plan.repo.ts`: `ensureMealPlanIndexes()` (`{ userId: 1, isActive: 1 }`); `createMealPlan(userId, plan: MealPlan): Promise<MealPlanDoc>` (deactivate the user's other meal plans, insert with `isActive: true`, `createdAt: now`); `findActiveMealPlan(userId): Promise<MealPlanDoc | null>`; `findMealPlanForUser(userId, id): Promise<MealPlanDoc | null>` (invalid hex → null). Map `_id`→`id`.
- `meal-generation.service.ts`: `interface MealGenDeps { engine: { generateMealPlan(p:{system,user}): Promise<MealPlan> } }`; `processGenerateMeal(jobId, deps)` — load job (throw if missing; capture `userId`); `setJobStatus(processing)`; `zGenerateMealInput.parse(job.input)`; `computeTdee(input)`; `buildMealPrompt({ ...tdee, goal })`; `engine.generateMealPlan`; `createMealPlan(userId, plan)`; `setJobStatus(done, resultId=doc.id)`. On ANY error → `setJobStatus(failed, error)`, `rollbackUsage(userId, GenerationType.MEAL)`, rethrow. (Reuses the E7 `generation-job.repo` for job records; import `createJob`/`setJobStatus`/`findJobById` from `../workout/generation-job.repo.js`.)

- [ ] **Step 1: Failing tests** — repo (create → active, deactivates prior; findActive; findForUser owner-scoped/invalid-hex null) and service end-to-end with a FAKE engine returning a valid `MealPlan`: after `processGenerateMeal`, job `done` + `resultId`, and `findActiveMealPlan(userId)` returns the plan; failure case (fake engine throws) → job `failed` + `rollbackUsage` observed (pre-increment MEAL usage). Memory mongo; seed a queued MEAL job via `createJob`.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** both modules (native driver; reuse E7 `generation-job.repo`, E9 `computeTdee`/`buildMealPrompt`, E12 `rollbackUsage`; `.js` imports; guard `noUncheckedIndexedAccess`; no `any`).
- [ ] **Step 4: Run — expect PASS**; root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/nutrition/meal-plan.repo.ts apps/api/src/modules/nutrition/meal-plan.repo.test.ts apps/api/src/modules/nutrition/meal-generation.service.ts apps/api/src/modules/nutrition/meal-generation.service.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add meal-plan repo and Gemini meal-generation service"
```

---

### Task 5: Meal routes + internal handler + wiring — TDD — [Quan]

**Files:** create `apps/api/src/modules/nutrition/meal-gen.routes.ts`, `meal-gen.routes.test.ts`; modify `apps/api/src/app.ts`, `index.ts`.

**Interfaces — Produces:**
- `inlineMealEnqueuer(deps:{engine}): TaskEnqueuer` (reuse the E7 `TaskEnqueuer` type; import it) = `async (jobId) => processGenerateMeal(jobId, deps)`.
- `makeMealGenRoutes({ verify, engine, enqueue }): Hono`: `POST /generate` — `firebaseAuth` → `quotaGuard(GenerationType.MEAL)` → `zValidator('json', zGenerateMealInput)`: `incrementUsage(user.authId, MEAL, new Date())`; `createJob(user.authId, MEAL, input)`; `await enqueue(job.id)`; **202** `apiSuccess({ jobId })`. `GET /jobs/:id` → `findJobForUser(user.authId, id)` → `apiSuccess(job|null)`. `GET /active` → `findActiveMealPlan(user.authId)` → `apiSuccess(plan|null)`.
- Extend the E7 internal task group: in `makeInternalTaskRoutes` (E7, `workout-gen.routes.ts`) ADD `POST /generate-meal` (`{ jobId }` → `processGenerateMeal(jobId, { engine })` → `apiSuccess({ ok: true })`), so both AI job types share the single `internalAuth`-guarded group. (Its deps become `{ engine }` used for both — the SAME engine instance is fine; meal calls `generateMealPlan`, workout calls `generateWorkoutPlan`. **Ruling:** for the internal group pass the workout engine; meal generation via the internal path can use the same all-provider engine's `generateMealPlan` — acceptable since it still validates `zMealPlan`. The **Gemini-only** guarantee is enforced on the primary `POST /meal/generate` inline path via `buildMealAiEngine()`.)
- `app.ts`: `const mealEngine = buildMealAiEngine();` mount `app.route('/meal', makeMealGenRoutes({ verify: firebaseVerifier, engine: mealEngine, enqueue: inlineMealEnqueuer({ engine: mealEngine }) }))` (before `notFound`). Keep the existing `/workout` + `/internal/tasks` mounts; the internal group gains `/generate-meal`.
- `index.ts`: `ensureMealPlanIndexes()` on startup (inside `if (uri)`).

- [ ] **Step 1: Failing test — `meal-gen.routes.test.ts`** (fake verifier + FAKE meal engine + memory mongo): 401 no token; `POST /generate` valid body → 202 + jobId, then `GET /jobs/:id` → done + resultId, then `GET /active` → the meal plan; quota exhausted (`incrementUsage` to the MEAL limit) → 429; invalid body → 400.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** `meal-gen.routes.ts` + wire `app.ts`/`index.ts` + extend `makeInternalTaskRoutes` with `/generate-meal`.
- [ ] **Step 4: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` ALL green.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/nutrition/meal-gen.routes.ts apps/api/src/modules/nutrition/meal-gen.routes.test.ts apps/api/src/modules/workout/workout-gen.routes.ts apps/api/src/app.ts apps/api/src/index.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add meal generation routes, active meal plan, and internal handler"
```

---

### Task 6: Docs — README endpoints + roadmap — [Quan]

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E9 (meal planner backend) complete.
- API Endpoints — add a **Meal** subsection: `POST /api/meal/generate` (auth + quota(MEAL); body `{ goal, gender, age, heightCm, weightKg, activityLevel }`; computes TDEE + macros, generates a 7-day plan via **Gemini only**; 202 `{ jobId }`; 429 when quota exceeded); `GET /api/meal/jobs/:id` (job status); `GET /api/meal/active` (current meal plan or null).
- Note meal generation is Gemini-only and, like workout, runs inline by default (needs `GEMINI_API_KEY`; covered by `pnpm test` with a fake engine).
- Roadmap: mark E9 Meal Planner ✅ (backend); note E9-S3 (meal planner UI) → E13.

- [ ] **Step 2: Commit — Quan**

```bash
git add README.md
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "docs: document meal generation endpoints"
```

---

## Self-Review

**1. Spec coverage (E9 backend):** E9-S1 TDEE → T2 (+ schema T1); E9-S2 meal generate job Gemini-only → T3 (engine `generateMealPlan` + `buildMealAiEngine` + prompt) / T4 (repo+service) / T5 (routes+internal+wiring). E9-S3 UI → deferred. Gemini-only enforced by `buildMealAiEngine()` on the primary inline path.

**2. Placeholder scan:** engine refactor + service/repo are specified by exhaustive Interfaces + the explicit TDEE formulas and generation algorithm; schema/prompt/tdee steps have literal code + exact tests (TDEE test pins concrete numbers). The internal-path engine-choice tradeoff is explicitly ruled on, not hidden.

**3. Type consistency:** `Gender`/`ActivityLevel`/`MealType`/`zGenerateMealInput`/`zTdeeResult`/`zMeal`/`zMealDay`/`zMealPlan`/`zMealPlanDoc` (T1) → TDEE (T2), engine/prompt (T3), repo+service (T4), routes (T5). `AiEngine.generateMealPlan`/`buildMealAiEngine` (T3) consumed by service-deps + routes. Reuses E7 `generation-job.repo` (`createJob`/`setJobStatus`/`findJobById`/`findJobForUser`), `TaskEnqueuer`, `makeInternalTaskRoutes`; E12 `quotaGuard`/`incrementUsage`/`rollbackUsage`; E2 `firebaseAuth`. `generateWorkoutPlan` behavior preserved (E7 tests green). `.js` ESM; injected engine/enqueuer so tests need no network/keys.

**Assignees:** T1–T2 Thanh Minh (S1 TDEE + shared), T3–T6 Quan (S2 meal engine/service/routes/docs). Commit authors set per task.
