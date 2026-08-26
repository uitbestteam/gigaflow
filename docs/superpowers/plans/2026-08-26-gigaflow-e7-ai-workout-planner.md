# E7 — AI Workout Planner (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e7-ai-planner`.

**Goal:** Generate a personalized workout plan with AI — a unified **Gemini-first / OpenAI-fallback** engine produces a plan (choosing exercises from the catalog), history-aware of the user's past performance; the request runs as an async **generation job** (`POST /api/workout/generate` → jobId, poll `GET /api/workout/jobs/:id`), gated by the E12 quota (increment on enqueue, rollback on failure). Everything is testable with **no GCP and no AI keys** via injected fakes.

**Architecture:** AI providers call the Gemini / OpenAI **REST APIs via `fetch`** (no SDK deps) and are injected behind an `AiProvider` interface, so the engine's fallback logic and the whole generation flow test with fakes. Jobs are tracked in a `generation_jobs` collection. A `TaskEnqueuer` seam runs **inline in-process** by default (works locally end-to-end) and is swapped for Cloud Tasks at deploy (the internal push-handler route already exists, guarded by E1 `internalAuth`). The AI plan's exercise slugs are resolved against the E3 catalog and materialized via E4's `insertPlanGraph`; the prompt embeds the E5 `exercise_performance` history. Native driver + Zod, `.js` ESM, per-assignee commits.

**Tech Stack:** Hono, MongoDB native driver, Zod, global `fetch` (Node 22), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.6 generation_jobs, §7 progression, §10 AI flow, §11 Cloud Tasks; AI engine Gemini-first + OpenAI fallback)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E7)

## Scope

**In scope (backend):** E7-S1 (unified AI engine, Gemini-first + OpenAI fallback), E7-S2 (generate-workout job + internal push-handler + inline enqueuer), E7-S3 (history-aware prompt), E7-S4 (job status API — polling). **Deferred:** the Cloud Tasks *enqueuer* real impl (needs GCP `@google-cloud/tasks` + OIDC — a documented stub; inline enqueuer is the default and the internal handler is fully built/tested); FCM notify on completion (E10); E7-S5 generate-plan UI (E13). Meal generation is E9.

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm; TS strict, NO `any`, guard `noUncheckedIndexedAccess`, explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`; routes under `/api`.
- AI generation route behind `firebaseAuth` (E2) + `quotaGuard(GenerationType.WORKOUT)` (E12); usage `incrementUsage` on enqueue, `rollbackUsage` on job failure.
- **No real AI/GCP in tests:** the `AiProvider`(s) and `TaskEnqueuer` are injected; tests pass fakes. Real providers read `GEMINI_API_KEY` / `OPENAI_API_KEY` at wiring time and are never called in tests.
- Run turbo `pnpm typecheck` (exit 0) + `pnpm test` after every api task.
- **Commit author = the task's assignee:** Quan → `Luong Hong Quan <lhongquan.1998@gmail.com>`; Ngọc Danh → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts                    # + Goal, ExperienceLevel, JobStatus, AiProviderName
  schemas/ai.ts                     # zGenerateWorkoutInput, zGeneratedPlan, zGenerationJob + types (NEW)
  index.ts
apps/api/src/modules/ai/
  ai-provider.ts                    # AiProvider interface + AiEngine (fallback)  (NEW)
  ai-engine.test.ts
  providers/gemini.provider.ts      # REST via fetch (NEW; not unit-tested — needs key)
  providers/openai.provider.ts      # REST via fetch (NEW; not unit-tested)
  ai.factory.ts                     # buildAiEngine() from env  (NEW)
  prompt.ts                         # buildWorkoutPrompt() (pure)  (NEW)
  prompt.test.ts
apps/api/src/modules/workout/
  generation-job.repo.ts            # createJob / setJobStatus / findJob  (NEW)
  generation-job.repo.test.ts
  workout-generation.service.ts     # processGenerateWorkout + resolve + build  (NEW)
  workout-generation.service.test.ts
  workout-gen.routes.ts             # POST /workout/generate, GET /workout/jobs/:id, POST /internal/tasks/generate-workout (NEW)
  workout-gen.routes.test.ts
apps/api/src/app.ts                 # mount /workout + the internal task route
apps/api/src/index.ts               # ensure generation_jobs indexes
apps/api/.env.example (root .env.example) # + GEMINI_API_KEY / OPENAI_API_KEY (commented)
```

---

### Task 1: AI enums + schemas (shared) — [Quan]

**Files:** modify `enums/index.ts`, `index.ts`; create `schemas/ai.ts`, `schemas/ai.test.ts`.

**Interfaces — Produces:**
- `enum Goal { STRENGTH='strength', HYPERTROPHY='hypertrophy', GENERAL_FITNESS='general_fitness', WEIGHT_LOSS='weight_loss' }`
- `enum ExperienceLevel { BEGINNER='beginner', INTERMEDIATE='intermediate', ADVANCED='advanced' }`
- `enum JobStatus { QUEUED='queued', PROCESSING='processing', DONE='done', FAILED='failed' }`
- `enum AiProviderName { GEMINI='gemini', OPENAI='openai' }`
- `zGenerateWorkoutInput` → `GenerateWorkoutInput`: `{ goal: Goal, experienceLevel: ExperienceLevel, daysPerWeek: int 1–7 }`.
- `zGeneratedPlan` → `GeneratedPlan` (the AI output contract): `{ name: string(min1), templates: array(min1) of { name: Translatable, colorTag: ColorTag, slots: array(min1) of { exerciseSlug: string(min1), setsTarget: int 1–10, repRangeMin: int≥1, repRangeMax: int≥1 } } }`.
- `zGenerationJob` → `GenerationJob`: `{ id, userId, type: GenerationType, status: JobStatus, input?: unknown, resultId?: string, error?: string, createdAt: Date, updatedAt: Date }`.

- [ ] **Step 1: Failing test — `schemas/ai.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zGenerateWorkoutInput, zGeneratedPlan, Goal, ExperienceLevel, ColorTag } from '../index';

describe('ai schemas', () => {
  it('accepts a valid generate input', () => {
    expect(zGenerateWorkoutInput.safeParse({ goal: Goal.HYPERTROPHY, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 }).success).toBe(true);
  });
  it('rejects daysPerWeek out of range', () => {
    expect(zGenerateWorkoutInput.safeParse({ goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.ADVANCED, daysPerWeek: 9 }).success).toBe(false);
  });
  it('accepts a valid generated plan', () => {
    const p = { name: 'AI Plan', templates: [{ name: { en: 'Push', vi: 'Đẩy' }, colorTag: ColorTag.PUSH, slots: [{ exerciseSlug: 'bench-barbell', setsTarget: 4, repRangeMin: 6, repRangeMax: 10 }] }] };
    expect(zGeneratedPlan.safeParse(p).success).toBe(true);
  });
  it('rejects a generated plan with no templates', () => {
    expect(zGeneratedPlan.safeParse({ name: 'x', templates: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/ai.test.ts`)

- [ ] **Step 3: Add enums — append to `enums/index.ts`** (Goal, ExperienceLevel, JobStatus, AiProviderName, values exactly as above).

- [ ] **Step 4: Create `schemas/ai.ts`**

```typescript
import { z } from 'zod';
import { ExperienceLevel, GenerationType, Goal, JobStatus } from '../enums/index.js';
import { ColorTag } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zGenerateWorkoutInput = z.object({
  goal: z.nativeEnum(Goal),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  daysPerWeek: z.number().int().min(1).max(7),
});

export const zGeneratedPlan = z.object({
  name: z.string().min(1),
  templates: z
    .array(
      z.object({
        name: zTranslatable,
        colorTag: z.nativeEnum(ColorTag),
        slots: z
          .array(
            z.object({
              exerciseSlug: z.string().min(1),
              setsTarget: z.number().int().min(1).max(10),
              repRangeMin: z.number().int().min(1),
              repRangeMax: z.number().int().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export const zGenerationJob = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.nativeEnum(GenerationType),
  status: z.nativeEnum(JobStatus),
  input: z.unknown().optional(),
  resultId: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type GenerateWorkoutInput = z.infer<typeof zGenerateWorkoutInput>;
export type GeneratedPlan = z.infer<typeof zGeneratedPlan>;
export type GenerationJob = z.infer<typeof zGenerationJob>;
```

- [ ] **Step 5: Export** — add `export * from './schemas/ai.js';` to `index.ts`.

- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 26 + 4 new = 30)

- [ ] **Step 7: Commit — Quan**

```bash
git add packages/shared
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(shared): add AI planner enums and generation schemas"
```

---

### Task 2: Unified AI engine (Gemini-first, OpenAI fallback) + REST providers — TDD — [Quan]

**Files:** create `ai-provider.ts`, `ai-engine.test.ts`, `providers/gemini.provider.ts`, `providers/openai.provider.ts`, `ai.factory.ts`.

**Interfaces — Produces:**
- `interface AiProvider { name: AiProviderName; generatePlan(prompt: { system: string; user: string }): Promise<unknown> }` — returns parsed JSON (the raw model output); throws on transport/parse error.
- `class AiEngine { constructor(providers: AiProvider[]) ; async generateWorkoutPlan(prompt): Promise<GeneratedPlan> }` — tries providers in order; for each, calls `generatePlan`, then `zGeneratedPlan.parse(raw)`; on throw/validation-failure logs and tries the next; if all fail throws `Error('All AI providers failed')`. (Order = Gemini first, then OpenAI — set by the factory.)
- `providers/gemini.provider.ts`: `class GeminiProvider implements AiProvider` — POST `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}` with body `{ contents: [{ parts: [{ text: system + '\n\n' + user }] }], generationConfig: { responseMimeType: 'application/json' } }`; parse `json.candidates[0].content.parts[0].text` → `JSON.parse`. `model` default `'gemini-1.5-flash'`.
- `providers/openai.provider.ts`: `class OpenAiProvider implements AiProvider` — POST `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer ${apiKey}`, body `{ model, messages: [{role:'system',content:system},{role:'user',content:user}], response_format: { type: 'json_object' } }`; parse `json.choices[0].message.content` → `JSON.parse`. `model` default `'gpt-4o-mini'`.
- `ai.factory.ts`: `buildAiEngine(): AiEngine` — reads `GEMINI_API_KEY` / `OPENAI_API_KEY` (+ optional `GEMINI_MODEL`/`OPENAI_MODEL`) from env; includes a provider only if its key is set; **Gemini first**. If neither key is set, returns an engine whose only provider throws a clear "no AI provider configured" error at call time (so the app still boots; only a real generation fails).

- [ ] **Step 1: Failing test — `ai-engine.test.ts`** (fakes only; no network)

```typescript
import { describe, it, expect } from 'vitest';
import { AiProviderName } from '@gigaflow/shared';
import { AiEngine, type AiProvider } from './ai-provider';

const validRaw = { name: 'P', templates: [{ name: { en: 'Push', vi: 'Đẩy' }, colorTag: 'push', slots: [{ exerciseSlug: 'bench-barbell', setsTarget: 4, repRangeMin: 6, repRangeMax: 10 }] }] };

const fake = (name: AiProviderName, impl: () => Promise<unknown>): AiProvider => ({ name, generatePlan: impl });

describe('AiEngine', () => {
  it('returns the first provider result when valid', async () => {
    const engine = new AiEngine([fake(AiProviderName.GEMINI, async () => validRaw)]);
    const plan = await engine.generateWorkoutPlan({ system: 's', user: 'u' });
    expect(plan.templates[0].slots[0].exerciseSlug).toBe('bench-barbell');
  });
  it('falls back to the next provider when the first throws', async () => {
    const engine = new AiEngine([
      fake(AiProviderName.GEMINI, async () => { throw new Error('quota'); }),
      fake(AiProviderName.OPENAI, async () => validRaw),
    ]);
    const plan = await engine.generateWorkoutPlan({ system: 's', user: 'u' });
    expect(plan.name).toBe('P');
  });
  it('falls back when the first returns schema-invalid output', async () => {
    const engine = new AiEngine([
      fake(AiProviderName.GEMINI, async () => ({ name: 'x', templates: [] })),
      fake(AiProviderName.OPENAI, async () => validRaw),
    ]);
    expect((await engine.generateWorkoutPlan({ system: 's', user: 'u' })).templates.length).toBe(1);
  });
  it('throws when all providers fail', async () => {
    const engine = new AiEngine([fake(AiProviderName.GEMINI, async () => { throw new Error('x'); })]);
    await expect(engine.generateWorkoutPlan({ system: 's', user: 'u' })).rejects.toThrow(/All AI providers failed/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `ai-provider.ts`** (`AiProvider` interface + `AiEngine` with the try/validate/fallback loop; `zGeneratedPlan.parse` for validation; no `any` — provider returns `unknown`, engine narrows via parse; log provider failures with the module Logger pattern or `console.warn`).

- [ ] **Step 4: Implement the two REST providers + `ai.factory.ts`** per the Interfaces (concrete `fetch` calls; guard `res.ok`; narrow the JSON shape defensively — no `any`, use `unknown` + checks; throw on missing fields). These are NOT unit-tested (need real keys); they must compile under strict TS.

- [ ] **Step 5: Run — expect PASS** (engine tests 4/4); then root `pnpm typecheck` exit 0.

- [ ] **Step 6: Commit — Quan**

```bash
git add apps/api/src/modules/ai
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add unified AI engine (Gemini-first, OpenAI fallback) with REST providers"
```

---

### Task 3: History-aware prompt builder (pure) — TDD — [Quan]

**Files:** create `apps/api/src/modules/ai/prompt.ts`, `prompt.test.ts`.

**Interfaces — Produces:**
- `interface PromptExercise { slug: string; nameEn: string; muscleGroup: string }`
- `interface PromptHistory { slug: string; lastWeightKg: number; lastReps: number; bestE1RM: number }`
- `interface WorkoutPromptInput { goal: string; experienceLevel: string; daysPerWeek: number; catalog: PromptExercise[]; history: PromptHistory[] }`
- `buildWorkoutPrompt(input: WorkoutPromptInput): { system: string; user: string }` — the `system` message states the assistant is a strength coach and MUST return JSON matching the plan schema, using ONLY `exerciseSlug` values from the provided catalog, with `daysPerWeek` templates; the `user` message embeds the goal/experience/daysPerWeek, the catalog (slug — nameEn — muscleGroup, one per line), and the history block (per-exercise last set + best e1RM) so the model can progress. Deterministic string output.

- [ ] **Step 1: Failing test — `prompt.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { buildWorkoutPrompt } from './prompt';

const input = {
  goal: 'hypertrophy', experienceLevel: 'beginner', daysPerWeek: 3,
  catalog: [{ slug: 'bench-barbell', nameEn: 'Bench press', muscleGroup: 'chest' }],
  history: [{ slug: 'bench-barbell', lastWeightKg: 60, lastReps: 8, bestE1RM: 75 }],
};

describe('buildWorkoutPrompt', () => {
  it('embeds catalog slugs, history and constraints', () => {
    const { system, user } = buildWorkoutPrompt(input);
    expect(system.toLowerCase()).toContain('json');
    expect(user).toContain('bench-barbell');
    expect(user).toContain('hypertrophy');
    expect(user).toContain('3'); // daysPerWeek
    expect(user).toMatch(/60|75/); // history numbers present
  });
  it('handles empty history', () => {
    const { user } = buildWorkoutPrompt({ ...input, history: [] });
    expect(user).toContain('bench-barbell');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement `prompt.ts`** (pure string building per Interfaces; no `any`).
- [ ] **Step 4: Run — expect PASS** (2 tests).
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/ai/prompt.ts apps/api/src/modules/ai/prompt.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add history-aware workout prompt builder"
```

---

### Task 4: Generation-job repo + workout-generation service — TDD — [Quan]

**Files:** create `generation-job.repo.ts`, `generation-job.repo.test.ts`, `workout-generation.service.ts`, `workout-generation.service.test.ts` (under `apps/api/src/modules/workout/`).

**Interfaces — Produces:**
- `generation-job.repo.ts`: `ensureGenerationJobIndexes()` (`{ userId: 1, status: 1 }`, TTL-free); `createJob(userId, type, input): Promise<GenerationJob>` (status QUEUED); `setJobStatus(id, patch: { status; resultId?; error? }): Promise<void>`; `findJobForUser(userId, id): Promise<GenerationJob | null>` (invalid hex → null).
- `workout-generation.service.ts`:
  - `interface WorkoutGenDeps { engine: { generateWorkoutPlan(p: { system: string; user: string }): Promise<GeneratedPlan> } }`
  - `processGenerateWorkout(jobId: string, deps: WorkoutGenDeps): Promise<void>` — load job (throw if missing); `setJobStatus(processing)`; parse `job.input` with `zGenerateWorkoutInput`; gather catalog (E3 `listVisible(userId, {})` filtered to presets, mapped to `PromptExercise`) + history (E5 `findPerformanceMany` for the catalog's exerciseIds → `PromptHistory` using `lastSets[0]` + `bestSet.e1RM`, keyed back to slug); `buildWorkoutPrompt`; `engine.generateWorkoutPlan`; **resolve** the plan's `exerciseSlug`s via `findBySlugs` → build `NewTemplate[]` (drop slots whose slug isn't in the catalog; drop templates left with 0 slots; if 0 templates remain throw `Error('AI plan had no resolvable exercises')`; `exerciseId=ex.id`, `equipmentType=ex.equipmentType`, `weightIncrement=ex.defaultIncrement`, `orderIndex` per position); `insertPlanGraph(userId, { name, templateType: PlanTemplateType.CUSTOM, source: PlanSource.AI, isActive: true }, templates)`; `setJobStatus(done, resultId=plan.id)`. On ANY thrown error: `setJobStatus(failed, error=message)`, `rollbackUsage(userId, GenerationType.WORKOUT)`, then rethrow.

- [ ] **Step 1: Failing tests** — `generation-job.repo.test.ts` (create→queued, setStatus, findForUser owner-scoped) and `workout-generation.service.test.ts` (end-to-end with a FAKE engine returning a valid `GeneratedPlan` referencing seeded catalog slugs: after `processGenerateWorkout`, the job is `done` with a `resultId`, and `findActivePlan(userId)` returns the AI plan; and a failure case: a fake engine that throws → job `failed` + quota rolled back). Seed exercises (`seedPresets`) + a user; pre-increment quota so rollback is observable.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement both modules** per Interfaces (native driver; `.js` imports; reuse E3 `listVisible`/`findBySlugs`, E4 `insertPlanGraph`/`findActivePlan`, E5 `findPerformanceMany`, E12 `rollbackUsage`; guard `noUncheckedIndexedAccess`; no `any`).
- [ ] **Step 4: Run — expect PASS**; root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/workout/generation-job.repo.ts apps/api/src/modules/workout/generation-job.repo.test.ts apps/api/src/modules/workout/workout-generation.service.ts apps/api/src/modules/workout/workout-generation.service.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add generation-job repo and AI workout-generation service"
```

---

### Task 5: Routes (generate / job status / internal handler) + enqueuer + wiring — TDD — [Ngọc Danh]

**Files:** create `workout-gen.routes.ts`, `workout-gen.routes.test.ts`; modify `app.ts`, `index.ts`, root `.env.example`.

**Interfaces — Produces:**
- `type TaskEnqueuer = (jobId: string) => Promise<void>` and `inlineEnqueuer(deps): TaskEnqueuer` = `async (jobId) => processGenerateWorkout(jobId, deps)` (awaits processing in-process — used locally/tests; prod swaps a Cloud Tasks enqueuer that POSTs to `/internal/tasks/generate-workout`, a documented stub, NOT built here).
- `makeWorkoutGenRoutes(deps: { verify: TokenVerifier; engine; enqueue: TaskEnqueuer }): Hono`:
  - `POST /generate` — `firebaseAuth`, then `quotaGuard(GenerationType.WORKOUT)`, then `zValidator('json', zGenerateWorkoutInput)`: `incrementUsage(user.authId, WORKOUT, now)`; `createJob(user.authId, WORKOUT, input)`; `await enqueue(job.id)` (inline processes now); return **202** `apiSuccess({ jobId: job.id })`.
  - `GET /jobs/:id` — `firebaseAuth`: `findJobForUser(user.authId, id)` → `apiSuccess(job | null)`.
- `makeInternalTaskRoutes(deps: { engine }): Hono` (mounted under `/internal/tasks`, guarded by E1 `internalAuth`): `POST /generate-workout` — body `{ jobId }` → `processGenerateWorkout(jobId, { engine })` → `apiSuccess({ ok: true })`. (This is the Cloud Tasks push target; tested by direct call with the `X-CloudTasks-QueueName` header.)
- `app.ts`: build the engine via `buildAiEngine()`; mount `app.route('/workout', makeWorkoutGenRoutes({ verify: firebaseVerifier, engine, enqueue: inlineEnqueuer({ engine }) }))` and `app.route('/internal/tasks', makeInternalTaskRoutes({ engine }))` — the internal group applies `internalAuth()` (from E1) on `*`. Keep the existing E1 `/internal/tasks/ping`. Place before `notFound`.
- `index.ts`: `ensureGenerationJobIndexes()` on startup (inside `if (uri)`).
- root `.env.example`: add commented `# GEMINI_API_KEY=` and `# OPENAI_API_KEY=` (+ optional `# GEMINI_MODEL=` / `# OPENAI_MODEL=`).

- [ ] **Step 1: Failing test — `workout-gen.routes.test.ts`** (fake verifier + FAKE engine + memory mongo + `seedPresets`): 401 without token; `POST /generate` with valid body → 202 + jobId, then `GET /jobs/:id` → status `done` + resultId (inline enqueuer processed it); quota: after exhausting `incrementUsage` to the limit, `POST /generate` → 429 (quotaGuard); invalid body → 400; the internal handler `POST /internal/tasks/generate-workout` with the `X-CloudTasks-QueueName` header + `{ jobId }` processes a queued job to done, and without the header → 401.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement `workout-gen.routes.ts`** (+ `inlineEnqueuer`) per Interfaces; `.js` imports; no `any`.
- [ ] **Step 4: Wire `app.ts` + `index.ts` + `.env.example`.**
- [ ] **Step 5: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` ALL green.
- [ ] **Step 6: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/workout/workout-gen.routes.ts apps/api/src/modules/workout/workout-gen.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts .env.example
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add AI workout generation routes, job status, and internal task handler"
```

---

### Task 6: Docs — README endpoints + roadmap + env — [Ngọc Danh]

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E7 (AI workout planner backend) complete.
- API Endpoints — add an **AI generation** subsection: `POST /api/workout/generate` (body `{ goal, experienceLevel, daysPerWeek }`; auth + quota; returns 202 `{ jobId }`; 429 when quota exceeded), `GET /api/workout/jobs/:id` (job status: queued/processing/done/failed, `resultId` = the created plan's id when done). Note the plan is created via the same slot model as E4 and set active.
- Running locally: note that generation runs **inline in-process** by default (no GCP needed); it needs `GEMINI_API_KEY` (and optionally `OPENAI_API_KEY` fallback) to actually call a model — without a key the job fails with a clear "no AI provider configured" error, but the whole flow is covered by `pnpm test` with a fake engine.
- Add `GEMINI_API_KEY` / `OPENAI_API_KEY` (+ optional model vars) to the env docs.
- Roadmap: mark E7 ✅ (backend); note E7-S5 (generate-plan UI) → E13, Cloud Tasks enqueuer + FCM notify → deploy/E10.

- [ ] **Step 2: Commit — Ngọc Danh**

```bash
git add README.md
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "docs: document AI workout generation endpoints and env"
```

---

## Self-Review

**1. Spec coverage (E7 backend):** S1 unified engine Gemini-first+OpenAI fallback → T2; S2 generate job + internal push handler + enqueuer → T4/T5; S3 history-aware prompt → T3 (+ used in T4); S4 job status API → T5. Deferred: Cloud Tasks enqueuer real impl (inline default + internal handler built/tested), FCM notify (E10), generate-plan UI (E13), meal (E9) — all documented.

**2. Placeholder scan:** T2 providers + T4 modules are specified by exhaustive Interfaces + concrete REST contracts / an explicit resolve+build algorithm (multi-function modules); engine/prompt/schema steps have literal code + exact tests. The REST endpoints/bodies for Gemini and OpenAI are concrete. The Cloud Tasks enqueuer is explicitly a deferred documented stub, not a hidden gap.

**3. Type consistency:** `Goal`/`ExperienceLevel`/`JobStatus`/`AiProviderName`/`zGenerateWorkoutInput`/`zGeneratedPlan`/`zGenerationJob` (T1) flow to engine (T2), prompt (T3), repo+service (T4), routes (T5). `AiProvider`/`AiEngine` (T2) consumed by factory + service-deps + routes. `GeneratedPlan` is the engine output AND validated inside the engine. Service reuses E3 `listVisible`/`findBySlugs`, E4 `insertPlanGraph`/`findActivePlan`/`NewTemplate`, E5 `findPerformanceMany`, E12 `incrementUsage`/`rollbackUsage`/`quotaGuard`, E1 `internalAuth`. `user.authId` matches E2. `.js` ESM throughout. Engine injected into routes/service so tests use fakes (no network/keys); `buildAiEngine()` only at app wiring.

**Assignees:** T1–T4 Quan (S1/S2/S3 + service), T5–T6 Ngọc Danh (S4 routes/status + docs). Commit authors set per task.
