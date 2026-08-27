# E8 — InBody OCR + Weight Log (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e8-inbody`.

**Goal:** Read an InBody scan photo with AI vision into structured body-composition metrics (async job, quota-gated like E7/E9) and let users log body weight manually. Runnable + testable with **no GCP** (image passed inline as base64; vision analyzer injected → fakes in tests) and **no AI key** for tests.

**Architecture:** Reuses the E7 job flow (`generation_jobs`, `type: INBODY`) + E12 quota (`GenerationType.INBODY`, limit 5/period). The image arrives **inline base64** in the request (Gemini vision accepts inline image data); a `VisionAnalyzer` seam (real = Gemini REST via `fetch`, injected → fakes in tests) returns metrics validated by Zod, stored in `inbody_results`. Cloud Storage signed-URL upload (E8-S1) is **deferred to deploy** (documented) — inline base64 is the default path. Weight logging is a plain CRUD collection. Native driver + Zod, `.js` ESM, per-assignee commits.

**Tech Stack:** Hono, MongoDB native driver, Zod, global `fetch` (Node 22), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5 inbody_results, weight_logs, §10 AI, InBody OCR via AI vision)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E8)

## Scope

**In scope (backend):** E8-S2 (InBody OCR job via AI vision, inline base64), E8-S4 (manual weight log). **Deferred:** E8-S1 (Cloud Storage + signed URL — infra; inline base64 is the working path, GCS documented as a deploy step), E8-S3 (InBody UI + client-side image validation → E13), the Cloud Tasks internal push-handler for inbody (inline enqueuer is the default, like E7/E9 — an `/internal/tasks/analyze-inbody` handler is added when the real Cloud Tasks enqueuer lands).

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm; TS strict, NO `any`, guard `noUncheckedIndexedAccess`, explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`; routes under `/api`, behind `firebaseAuth` (E2); owner = `c.get('user').authId`.
- InBody analyze route behind `quotaGuard(GenerationType.INBODY)`; `incrementUsage` on enqueue, `rollbackUsage` on failure. Weight log is not quota-gated.
- No real AI/GCP in tests: the `VisionAnalyzer` + enqueuer are injected; tests pass fakes. Real analyzer reads `GEMINI_API_KEY` at wiring; never called in tests.
- Run turbo `pnpm typecheck` (exit 0) + `pnpm test` after every api task.
- **Commit author = the task's assignee:** Quan → `Luong Hong Quan <lhongquan.1998@gmail.com>`; Ngọc Danh → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts                     # + ImageMimeType
  schemas/inbody.ts                  # zInbodyMetrics, zInbodyResult, zAnalyzeInbodyInput + types (NEW)
  schemas/weight.ts                  # zWeightLog, zLogWeightInput + types (NEW, T5)
  index.ts
apps/api/src/modules/inbody/
  vision.ts                          # VisionAnalyzer interface + GeminiVisionAnalyzer (REST) (NEW)
  vision.factory.ts                  # buildInbodyAnalyzer() from env (NEW)
  inbody-prompt.ts                   # buildInbodyPrompt() (pure) (NEW)
  inbody-prompt.test.ts
  inbody.engine.ts                   # analyzeInbody(analyzer, img) -> InbodyMetrics (validate) (NEW)
  inbody.engine.test.ts
  inbody.repo.ts                     # createInbodyResult / findLatest / findForUser (NEW)
  inbody.repo.test.ts
  inbody.service.ts                  # processAnalyzeInbody (NEW)
  inbody.service.test.ts
  inbody.routes.ts                   # POST /inbody/analyze, GET /inbody/jobs/:id, GET /inbody/latest (NEW)
  inbody.routes.test.ts
apps/api/src/modules/weight/
  weight.repo.ts                     # logWeight / listWeights (NEW, T5)
  weight.repo.test.ts
  weight.routes.ts                   # POST /weight, GET /weight/history (NEW, T5)
  weight.routes.test.ts
apps/api/src/app.ts                  # mount /inbody + /weight
apps/api/src/index.ts                # ensure inbody + weight indexes
```

---

### Task 1: InBody enums + schemas (shared) — [Quan]

**Files:** modify `enums/index.ts`, `index.ts`; create `schemas/inbody.ts`, `schemas/inbody.test.ts`.

**Interfaces — Produces:**
- `enum ImageMimeType { JPEG='image/jpeg', PNG='image/png' }`
- `zInbodyMetrics` → `InbodyMetrics`: `{ weightKg: number≥0, bmi?: number≥0, bodyFatPercent?: number≥0, skeletalMuscleMassKg?: number≥0, bodyFatMassKg?: number≥0, visceralFatLevel?: number≥0 }` (weightKg required, rest optional).
- `zAnalyzeInbodyInput` → `AnalyzeInbodyInput`: `{ imageBase64: string(min1), mimeType: ImageMimeType }`.
- `zInbodyResult` → `InbodyResult`: `{ id: string, userId: string, metrics: zInbodyMetrics, takenAt: Date, createdAt: Date }`.

- [ ] **Step 1: Failing test — `schemas/inbody.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zInbodyMetrics, zAnalyzeInbodyInput, ImageMimeType } from '../index';

describe('inbody schemas', () => {
  it('accepts metrics with only weight', () => {
    expect(zInbodyMetrics.safeParse({ weightKg: 72 }).success).toBe(true);
  });
  it('accepts full metrics', () => {
    expect(zInbodyMetrics.safeParse({ weightKg: 72, bmi: 22.5, bodyFatPercent: 18, skeletalMuscleMassKg: 33, bodyFatMassKg: 13, visceralFatLevel: 7 }).success).toBe(true);
  });
  it('rejects a negative weight', () => {
    expect(zInbodyMetrics.safeParse({ weightKg: -1 }).success).toBe(false);
  });
  it('accepts a valid analyze input', () => {
    expect(zAnalyzeInbodyInput.safeParse({ imageBase64: 'abc', mimeType: ImageMimeType.PNG }).success).toBe(true);
  });
  it('rejects an unsupported mime type', () => {
    expect(zAnalyzeInbodyInput.safeParse({ imageBase64: 'abc', mimeType: 'image/gif' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/inbody.test.ts`)
- [ ] **Step 3: Add enum** `ImageMimeType` to `enums/index.ts`.
- [ ] **Step 4: Create `schemas/inbody.ts`** per the Interfaces (`.js` imports).
- [ ] **Step 5: Export** — add `export * from './schemas/inbody.js';` to `index.ts`.
- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 38 + 5 new = 43).
- [ ] **Step 7: Commit — Quan**

```bash
git add packages/shared
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(shared): add InBody metrics and analyze-input schemas"
```

---

### Task 2: Vision analyzer + factory + inbody prompt + engine wrapper — TDD — [Quan]

**Files:** create `apps/api/src/modules/inbody/vision.ts`, `vision.factory.ts`, `inbody-prompt.ts`, `inbody-prompt.test.ts`, `inbody.engine.ts`, `inbody.engine.test.ts`.

**Interfaces — Produces:**
- `vision.ts`: `interface VisionAnalyzer { analyze(input: { imageBase64: string; mimeType: string; prompt: string }): Promise<unknown> }`; `class GeminiVisionAnalyzer implements VisionAnalyzer` — POST `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}` with body `{ contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: imageBase64 } }, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }`; guard `res.ok`; parse `candidates[0].content.parts[0].text` → `JSON.parse`; defensive narrowing (no `any`). Default model `'gemini-2.0-flash'`.
- `vision.factory.ts`: `buildInbodyAnalyzer(): VisionAnalyzer` — `GeminiVisionAnalyzer` iff `GEMINI_API_KEY` (model from `GEMINI_MODEL` default `gemini-2.0-flash`), else an `UnconfiguredVisionAnalyzer` that throws `'no AI provider configured'` at call time.
- `inbody-prompt.ts`: `buildInbodyPrompt(): string` — a fixed instruction: extract body-composition numbers from the InBody result sheet image and return ONLY minified JSON matching `{ weightKg, bmi?, bodyFatPercent?, skeletalMuscleMassKg?, bodyFatMassKg?, visceralFatLevel? }` (numbers only; omit fields not visible; `weightKg` required).
- `inbody.engine.ts`: `analyzeInbody(analyzer: VisionAnalyzer, input: { imageBase64: string; mimeType: string }): Promise<InbodyMetrics>` — `raw = analyzer.analyze({ ...input, prompt: buildInbodyPrompt() })`; `return zInbodyMetrics.parse(raw)` (throws on invalid).

- [ ] **Step 1: Failing tests** — `inbody-prompt.test.ts` (asserts the prompt mentions `weightKg`, `JSON`, `InBody`) and `inbody.engine.test.ts` (fake analyzer returning `{ weightKg: 72, bodyFatPercent: 18 }` → `analyzeInbody` returns parsed metrics; fake returning schema-invalid `{}` → rejects).
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** `vision.ts`, `vision.factory.ts`, `inbody-prompt.ts`, `inbody.engine.ts`. `GeminiVisionAnalyzer` is not unit-tested (needs key); must compile strict, no `any`.
- [ ] **Step 4: Run — expect PASS**; root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/inbody/vision.ts apps/api/src/modules/inbody/vision.factory.ts apps/api/src/modules/inbody/inbody-prompt.ts apps/api/src/modules/inbody/inbody-prompt.test.ts apps/api/src/modules/inbody/inbody.engine.ts apps/api/src/modules/inbody/inbody.engine.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add Gemini vision analyzer and InBody OCR engine"
```

---

### Task 3: InBody repo + analyze service — TDD — [Quan]

**Files:** create `apps/api/src/modules/inbody/inbody.repo.ts`, `inbody.repo.test.ts`, `inbody.service.ts`, `inbody.service.test.ts`.

**Interfaces — Produces:**
- `inbody.repo.ts`: `ensureInbodyIndexes()` (`{ userId: 1, createdAt: -1 }`); `createInbodyResult(userId, metrics: InbodyMetrics): Promise<InbodyResult>` (insert with `takenAt: now`, `createdAt: now`); `findLatestInbody(userId): Promise<InbodyResult | null>` (newest by createdAt); `findInbodyForUser(userId, id): Promise<InbodyResult | null>` (invalid hex → null). Map `_id`→`id`.
- `inbody.service.ts`: `interface InbodyDeps { analyzer: VisionAnalyzer }`; `processAnalyzeInbody(jobId, deps)` — load job (throw if missing; capture userId) → `setJobStatus(processing)` → `zAnalyzeInbodyInput.parse(job.input)` → `analyzeInbody(deps.analyzer, { imageBase64, mimeType })` → `createInbodyResult(userId, metrics)` → `setJobStatus(done, resultId=result.id)`. On ANY error → `setJobStatus(failed, error)`, `rollbackUsage(userId, GenerationType.INBODY)`, rethrow. (Reuse E7 `generation-job.repo`: `createJob`/`setJobStatus`/`findJobById`.)

- [ ] **Step 1: Failing tests** — repo (create → findLatest returns it, findForUser owner-scoped/invalid-hex null) and service end-to-end with a FAKE analyzer returning valid metrics → job done + resultId + `findLatestInbody` returns metrics; failure case (fake analyzer throws) → job failed + quota rolled back (pre-increment INBODY usage). Memory mongo; seed a queued INBODY job via `createJob`.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** both modules (`.js` imports; reuse E7 job repo, E9-style pattern, E12 rollbackUsage; guard `noUncheckedIndexedAccess`; no `any`).
- [ ] **Step 4: Run — expect PASS**; root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/inbody/inbody.repo.ts apps/api/src/modules/inbody/inbody.repo.test.ts apps/api/src/modules/inbody/inbody.service.ts apps/api/src/modules/inbody/inbody.service.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add InBody repo and vision analyze service"
```

---

### Task 4: InBody routes + wiring — TDD — [Quan]

**Files:** create `apps/api/src/modules/inbody/inbody.routes.ts`, `inbody.routes.test.ts`; modify `apps/api/src/app.ts`, `index.ts`.

**Interfaces — Produces:**
- `inlineInbodyEnqueuer({ analyzer }): TaskEnqueuer` (reuse E7 `TaskEnqueuer` type) = `async (jobId) => processAnalyzeInbody(jobId, { analyzer })`.
- `makeInbodyRoutes({ verify, analyzer, enqueue }): Hono`: `POST /analyze` — `firebaseAuth` → `quotaGuard(GenerationType.INBODY)` → `zValidator('json', zAnalyzeInbodyInput)`: `incrementUsage(user.authId, INBODY, new Date())`; `createJob(user.authId, INBODY, input)`; `await enqueue(job.id)`; **202** `apiSuccess({ jobId })`. `GET /jobs/:id` → `findJobForUser` → `apiSuccess(job|null)`. `GET /latest` → `findLatestInbody(user.authId)` → `apiSuccess(result|null)`.
- `app.ts`: `const inbodyAnalyzer = buildInbodyAnalyzer();` mount `app.route('/inbody', makeInbodyRoutes({ verify: firebaseVerifier, analyzer: inbodyAnalyzer, enqueue: inlineInbodyEnqueuer({ analyzer: inbodyAnalyzer }) }))` before `notFound`.
- `index.ts`: `ensureInbodyIndexes()` on startup (inside `if (uri)`).

- [ ] **Step 1: Failing test — `inbody.routes.test.ts`** (fake verifier + FAKE analyzer + memory mongo): 401 no token; `POST /analyze` valid body → 202 + jobId, then `GET /jobs/:id` → done + resultId, then `GET /latest` → the metrics; quota exhausted (increment INBODY to the limit of 5) → 429; invalid body (bad mimeType) → 400.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement `inbody.routes.ts`** + wire `app.ts`/`index.ts`.
- [ ] **Step 4: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` ALL green.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/inbody/inbody.routes.ts apps/api/src/modules/inbody/inbody.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add InBody analyze routes and latest-result endpoint"
```

---

### Task 5: Weight log (shared + repo + routes) — TDD — [Ngọc Danh]

**Files:** create `packages/shared/src/schemas/weight.ts`, `schemas/weight.test.ts`, modify shared `index.ts`; create `apps/api/src/modules/weight/weight.repo.ts`, `weight.repo.test.ts`, `weight.routes.ts`, `weight.routes.test.ts`; modify `apps/api/src/app.ts`, `index.ts`.

**Interfaces — Produces:**
- shared: `zLogWeightInput` → `{ weightKg: number>0, loggedAt?: Date }`; `zWeightLog` → `WeightLog`: `{ id, userId, weightKg: number>0, loggedAt: Date, createdAt: Date }`. Export `./schemas/weight.js`.
- `weight.repo.ts`: `ensureWeightIndexes()` (`{ userId: 1, loggedAt: -1 }`); `logWeight(userId, weightKg, loggedAt?): Promise<WeightLog>` (loggedAt defaults to now); `listWeights(userId, limit=100): Promise<WeightLog[]>` (newest first). Map `_id`→`id`.
- `weight.routes.ts`: `makeWeightRoutes({ verify }): Hono` — `firebaseAuth`; `POST /` — `zValidator('json', zLogWeightInput)` → `logWeight` → 201 `apiSuccess(log)`; `GET /history` → `listWeights(user.authId)` → `apiSuccess(logs)`.
- `app.ts`: mount `app.route('/weight', makeWeightRoutes({ verify: firebaseVerifier }))` before `notFound`. `index.ts`: `ensureWeightIndexes()` on startup.

- [ ] **Step 1: Failing tests** — shared `weight.test.ts` (valid input, reject non-positive weight); `weight.repo.test.ts` (log then list newest-first, owner-scoped); `weight.routes.test.ts` (fake verifier + memory mongo): 401; POST 201; GET /history returns logs; invalid body → 400.
- [ ] **Step 2: Run — expect FAIL** (each)
- [ ] **Step 3: Implement** shared weight schema, `weight.repo.ts`, `weight.routes.ts` + wire `app.ts`/`index.ts` (`.js` imports; no `any`).
- [ ] **Step 4: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` ALL green.
- [ ] **Step 5: Commit — Ngọc Danh**

```bash
git add packages/shared/src/schemas/weight.ts packages/shared/src/schemas/weight.test.ts packages/shared/src/index.ts apps/api/src/modules/weight/weight.repo.ts apps/api/src/modules/weight/weight.repo.test.ts apps/api/src/modules/weight/weight.routes.ts apps/api/src/modules/weight/weight.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add manual weight logging (schema, repo, routes)"
```

---

### Task 6: Docs — README endpoints + roadmap + env — [Quan]

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E8 (InBody OCR + weight log backend) complete.
- API Endpoints — add an **InBody & Weight** subsection (all auth-required): `POST /api/inbody/analyze` (body `{ imageBase64, mimeType }`; auth + quota(INBODY); reads the InBody sheet via **Gemini vision**; 202 `{ jobId }`; 429 when quota exceeded; 400 invalid body), `GET /api/inbody/jobs/:id`, `GET /api/inbody/latest`; `POST /api/weight` (body `{ weightKg, loggedAt? }`; 201), `GET /api/weight/history`.
- Note: InBody analysis takes the image **inline as base64** (no cloud upload needed to run); needs `GEMINI_API_KEY` to call a real model — covered by `pnpm test` with a fake analyzer. Cloud Storage signed-URL upload is a deploy-time addition.
- Roadmap: mark E8 InBody OCR ✅ (backend, weight log); note E8-S1 (Cloud Storage/signed URL) → deploy, E8-S3 (InBody UI) → E13.

- [ ] **Step 2: Commit — Quan**

```bash
git add README.md
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "docs: document InBody OCR and weight logging endpoints"
```

---

## Self-Review

**1. Spec coverage (E8 backend):** E8-S2 InBody OCR (AI vision, inline base64) → T2/T3/T4; E8-S4 weight log → T5. E8-S1 (Cloud Storage signed URL) deferred to deploy (inline base64 is the working path); E8-S3 UI → E13; inbody Cloud Tasks internal handler deferred (inline enqueuer default). All documented.

**2. Placeholder scan:** vision analyzer + service/repo specified by exhaustive Interfaces + a concrete Gemini vision REST contract + explicit process algorithm; schema/prompt/engine steps have literal code + exact tests. Deferrals (GCS, internal handler) explicitly stated, not hidden.

**3. Type consistency:** `ImageMimeType`/`zInbodyMetrics`/`zAnalyzeInbodyInput`/`zInbodyResult` (T1) → vision/engine (T2), repo/service (T3), routes (T4). `VisionAnalyzer`/`GeminiVisionAnalyzer`/`buildInbodyAnalyzer`/`analyzeInbody` (T2) consumed by service-deps + routes. Reuses E7 `generation-job.repo` (`createJob`/`setJobStatus`/`findJobById`/`findJobForUser`) + `TaskEnqueuer`; E12 `quotaGuard(INBODY)`/`incrementUsage`/`rollbackUsage` (INBODY limit already 5 in PLAN_LIMITS); E2 `firebaseAuth`. Weight (T5): `zWeightLog`/`zLogWeightInput` → repo → routes, independent, no AI. `.js` ESM; injected analyzer/enqueuer so tests need no network/keys; `buildInbodyAnalyzer()` only at wiring.

**Assignees:** T1–T4, T6 Quan (S1-inline/S2 InBody vision + docs); T5 Ngọc Danh (S4 weight). Commit authors set per task.
