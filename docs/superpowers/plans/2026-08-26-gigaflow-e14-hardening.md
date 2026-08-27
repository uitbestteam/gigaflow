# E14 — Testing & Hardening (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e14-hardening`.

**Goal:** Close the correctness/security deferrals accumulated across E1–E12 with **code-level, single-document-atomic** fixes, add observability + an end-to-end integration test, and document what still requires infra. Everything testable with no GCP/AI keys.

**Architecture:** Fixes are surgical and reuse existing seams. Quota becomes an **atomic conditional `$inc`** (closes the check-then-increment TOCTOU); session numbering uses an **atomic per-user counter**; the InBody payload is size-bounded; the internal `/generate-meal` handler is switched to a **Gemini-only** engine; notifications get batching + stale-token cleanup; a **request-id + structured logger** is threaded through the error path; one **integration test** exercises the full wired flow. Native driver + Zod, `.js` ESM, per-assignee commits.

**Tech Stack:** Hono, MongoDB native driver, Zod, Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§17 non-functional, atomicity, observability)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E14)

## Scope

**In scope (code hardening):** atomic quota (TOCTOU), atomic sessionNumber, InBody payload bound + Gemini-only internal meal gate, notification reminder batching + stale FCM token cleanup, observability (request-id + logger), one full-flow API integration test.

**Explicitly deferred (need infra, documented in Task 7):** multi-document **transactions** for the plan/meal/inbody active-toggle, `replaceSetLogs`, and finish+refresh (require a MongoDB **replica set** — Atlas has one; mongodb-memory-server would need `MongoMemoryReplSet`; a dedicated transaction pass is its own effort); **Terraform prod env + `apply`** and the **Cloud Tasks/Scheduler** switch-over (deploy). E10-S3/E13 UI unchanged.

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm; TS strict, NO `any`, guard `noUncheckedIndexedAccess`, explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`.
- Every change keeps the **full existing suite green** — these are refactors/additions, not rewrites. Run turbo `pnpm typecheck` + `pnpm build` + `pnpm test` after each task.
- **Commit author = the task's assignee:** Quan → `Luong Hong Quan <lhongquan.1998@gmail.com>`; Ngọc Danh → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`; Thanh Minh → `Nguyen Thanh Minh <95201788+ngthminhdev@users.noreply.github.com>`. Conventional Commits.

---

### Task 1: Atomic quota consume (fix TOCTOU) — [Quan]

**Files:** modify `apps/api/src/modules/subscription/quota.service.ts`, `quota.service.test.ts`, `apps/api/src/modules/subscription/quota.guard.ts`, `quota.guard.test.ts`; modify the 3 AI route handlers to drop the now-redundant `incrementUsage` call (`apps/api/src/modules/workout/workout-gen.routes.ts`, `apps/api/src/modules/nutrition/meal-gen.routes.ts`, `apps/api/src/modules/inbody/inbody.routes.ts`) + their tests if they asserted separate increment.

**Interfaces — Produces:**
- `tryConsume(userId: string, type: GenerationType, now: Date): Promise<{ allowed: boolean; used: number; limit: number }>` in `quota.service.ts` — `ensureCurrentPeriod(userId, now)` to read plan + reset if expired; `limit = PLAN_LIMITS[plan][type]`; then a SINGLE atomic `findOneAndUpdate({ authId: userId, ['subscription.aiUsage.'+type]: { $lt: limit } }, { $inc: { ['subscription.aiUsage.'+type]: 1 } }, { returnDocument: 'after' })`. If the result is null → over limit → `{ allowed: false, used: limit, limit }`; else `{ allowed: true, used: result.subscription.aiUsage[type], limit }`. (Two concurrent requests can't both pass — the conditional `$inc` is atomic.)
- `quotaGuard(type)` now **consumes**: calls `tryConsume(user.authId, type, new Date())`; if `!allowed` → 429 `errorBody('AI generation quota exceeded')`; else `next()`. Keep `incrementUsage`/`rollbackUsage` exported (rollback still used on job failure; `incrementUsage` may remain for tests/back-compat but is no longer called by routes).
- Routes: since `quotaGuard` now increments atomically, the handlers must NOT also call `incrementUsage` — remove that line from all three `POST` handlers.

- [ ] **Step 1: Update `quota.service.test.ts`** — add a `tryConsume` test: N concurrent `tryConsume` calls (`Promise.all`) for a fresh user with limit L yield exactly L `allowed:true` and the rest `allowed:false`; a subsequent `checkQuota` shows `used === L`. Keep existing tests green.
- [ ] **Step 2: Run — expect FAIL** (`tryConsume` missing).
- [ ] **Step 3: Implement `tryConsume`** (atomic conditional `$inc`; guard `PLAN_LIMITS[plan][type]` lookup; no `any`).
- [ ] **Step 4: Refactor `quota.guard.ts`** to consume via `tryConsume`; update `quota.guard.test.ts` (guard alone now increments; exhausting via repeated guarded requests → 429).
- [ ] **Step 5: Remove `incrementUsage` from the 3 route handlers**; adjust their route tests if any asserted a separate increment (the 429-quota tests should still pass — they exhaust via `incrementUsage`/`tryConsume` then expect 429).
- [ ] **Step 6: Run full suite** — `pnpm typecheck && pnpm build && pnpm test` all green.
- [ ] **Step 7: Commit — Quan**

```bash
git add apps/api/src/modules/subscription apps/api/src/modules/workout/workout-gen.routes.ts apps/api/src/modules/nutrition/meal-gen.routes.ts apps/api/src/modules/inbody/inbody.routes.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "fix(api): make quota consumption atomic to close TOCTOU"
```

---

### Task 2: Atomic session number — [Quan]

**Files:** modify `apps/api/src/modules/training/session.repo.ts`, `session.repo.test.ts`.

**Interfaces — Produces:** replace `createSession`'s `countDocuments + 1` with an **atomic per-user counter**: a `counters` collection, `findOneAndUpdate({ _id: 'session:'+userId }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' })` → `sessionNumber = counter.seq`. (Two concurrent `createSession` calls get distinct numbers.)

- [ ] **Step 1: Update `session.repo.test.ts`** — add: two concurrent `createSession(userId, templateId)` (`Promise.all`) yield distinct `sessionNumber`s (`{1,2}`). Keep existing sequential test (`s1=1, s2=2`) green.
- [ ] **Step 2: Run — expect FAIL** (concurrent duplicates under the old count+1).
- [ ] **Step 3: Implement** the counter-based `createSession` (no `any`; the counter doc `_id` is a string key).
- [ ] **Step 4: Run full suite** — green.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/training/session.repo.ts apps/api/src/modules/training/session.repo.test.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "fix(api): assign session numbers via an atomic counter"
```

---

### Task 3: InBody payload bound + Gemini-only internal meal — [Quan]

**Files:** modify `packages/shared/src/schemas/inbody.ts`, `schemas/inbody.test.ts`; modify `apps/api/src/app.ts` (internal meal engine) and `apps/api/src/modules/workout/workout-gen.routes.ts` (`makeInternalTaskRoutes` signature if needed).

**Interfaces — Produces:**
- `zAnalyzeInbodyInput.imageBase64` gains `.max(10_000_000)` (~10 MB of base64 chars) with a clear message; a test asserts an over-limit string is rejected.
- Gemini-only internal meal: the shared internal task group's `/generate-meal` must use the **Gemini-only** meal engine, not the all-provider one. Simplest bounded change: give `makeInternalTaskRoutes` deps `{ engine, mealEngine }` (workout uses `engine`, meal uses `mealEngine`); in `app.ts` pass `engine: buildAiEngine()` and `mealEngine: buildMealAiEngine()`. Update `makeInternalTaskRoutes`'s internal `/generate-meal` to call `processGenerateMeal(jobId, { engine: mealEngine })`. Update the E9 route test fixture that stubbed the engine to also provide `mealEngine` (or make `mealEngine` default to `engine` when omitted, to keep older callers/tests compiling).

- [ ] **Step 1: Update `inbody.test.ts`** (reject > max base64) and the E7 `workout-gen.routes.test.ts`/E9 tests only if the `makeInternalTaskRoutes` signature change breaks them.
- [ ] **Step 2: Run — expect FAIL** (max not enforced / signature).
- [ ] **Step 3: Implement** the `.max()` and the `{ engine, mealEngine }` split (default `mealEngine ??= engine` so existing tests pass), wire `app.ts`.
- [ ] **Step 4: Run full suite** — green; typecheck exit 0.
- [ ] **Step 5: Commit — Quan**

```bash
git add packages/shared/src/schemas/inbody.ts packages/shared/src/schemas/inbody.test.ts apps/api/src/modules/workout/workout-gen.routes.ts apps/api/src/app.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "fix(api): bound InBody image size and use Gemini-only engine for internal meal jobs"
```

---

### Task 4: Notification hardening — reminder batching + stale-token cleanup — [Ngọc Danh]

**Files:** modify `apps/api/src/modules/notification/reminder.service.ts`, `reminder.service.test.ts`; modify `apps/api/src/modules/notification/push-sender.ts` (report failed tokens) + `notification.service.ts` (prune), and `notification.service.test.ts`; modify `device-token.repo.ts` (delete by token) if needed.

**Interfaces — Produces:**
- `PushSender.send` returns `Promise<{ invalidTokens: string[] }>` — `FcmPushSender` maps `sendEachForMulticast` per-token responses to the list of tokens whose error code is `messaging/registration-token-not-registered` or `messaging/invalid-argument`; the fake sender in tests returns `{ invalidTokens: [] }` by default.
- `notification.service.notifyJobComplete/Error` (and reminder send): after `sender.send`, delete any returned `invalidTokens` via a new `deleteTokens(tokens: string[])` in `device-token.repo.ts` (bulk delete by token, not owner-scoped since FCM says they're dead). Still swallow all errors.
- `sendWorkoutReminders`: process due users in **batches** (e.g. chunks of 20) rather than one unbounded `Promise.all`.

- [ ] **Step 1: Update tests** — `notification.service.test.ts`: a fake sender returning `invalidTokens:['dead']` causes that token to be deleted (assert via repo). `reminder.service.test.ts`: still notifies all due users (batching doesn't drop anyone); keep existing cases green.
- [ ] **Step 2: Run — expect FAIL**.
- [ ] **Step 3: Implement** the `send` return type, `deleteTokens`, prune-on-send, and chunked reminders (a small `chunk<T>(arr, size)` helper; no `any`).
- [ ] **Step 4: Run full suite** — green.
- [ ] **Step 5: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/notification
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "fix(api): prune stale FCM tokens and batch workout reminders"
```

---

### Task 5: Observability — request id + structured logger — [Quan]

**Files:** create `apps/api/src/lib/logger.ts`, `logger.test.ts`, `apps/api/src/middleware/request-id.ts`, `request-id.test.ts`; modify `apps/api/src/app.ts` + `apps/api/src/middleware/error.ts`.

**Interfaces — Produces:**
- `logger.ts`: `log(level: 'info'|'warn'|'error', message: string, fields?: Record<string, unknown>): void` — emits a single-line JSON object `{ level, message, ts, ...fields }` to stdout/stderr (uses `process.stdout.write`; `ts` from `new Date().toISOString()`). Pure-ish, testable by spying on the write.
- `request-id.ts`: `requestId(): MiddlewareHandler` — reads incoming `X-Request-Id` or generates one (`crypto.randomUUID()`), sets it on `c.set('requestId', id)` and the response header `X-Request-Id`. Augment Hono `ContextVariableMap` with `requestId: string`.
- `app.ts`: mount `requestId()` first (before logger). `error.ts` `onError`: log the error via `logger.log('error', message, { requestId: c.get('requestId'), path, status })` before returning the envelope (still no stack leak at 500).

- [ ] **Step 1: Failing tests** — `logger.test.ts` (spy `process.stdout.write`; asserts a parseable JSON line with level/message/fields); `request-id.test.ts` (a tiny app: response carries `X-Request-Id`; an incoming id is echoed back).
- [ ] **Step 2: Run — expect FAIL**.
- [ ] **Step 3: Implement** logger + requestId middleware; wire `app.ts` + `error.ts`.
- [ ] **Step 4: Run full suite** — green; typecheck exit 0.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/lib/logger.ts apps/api/src/lib/logger.test.ts apps/api/src/middleware/request-id.ts apps/api/src/middleware/request-id.test.ts apps/api/src/app.ts apps/api/src/middleware/error.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add request-id middleware and structured logger"
```

---

### Task 6: End-to-end API integration test — [Thanh Minh]

**Files:** create `apps/api/src/integration/full-flow.test.ts`.

**Interfaces — Consumes:** the real route factories with a fake verifier + fake AI engine/analyzer + memory mongo, composed into one Hono app (mirror how `createApp` mounts, but inject fakes). Exercises a full journey and asserts the cross-module wiring.

- [ ] **Step 1: Write the integration test** — build an app mounting auth/exercises/plans/sessions/workout-gen/stats with a fake `TokenVerifier` (anonymous user), a fake AI engine returning a valid `GeneratedPlan` over seeded catalog slugs, memory mongo + `seedPresets` + all `ensure*Indexes`. Journey: `POST /auth/session` (guest) → `POST /workout/generate` 202 → `GET /workout/jobs/:id` done → `GET /plans/active` returns the AI plan → `POST /sessions/start` (a template) returns prefilled slots → `POST /sessions/:id/sets` (all-max reps) → `POST /sessions/:id/finish` → `POST /sessions/start` again shows the progressed (increased) weight → `GET /stats/prs` shows a PR. Assert each step's status + one key field.
- [ ] **Step 2: Run — iterate** until green (this is additive; fix only the test, not production code — if it reveals a real wiring bug, STOP and report it as a finding rather than patching silently).
- [ ] **Step 3: Run full suite** — green.
- [ ] **Step 4: Commit — Thanh Minh**

```bash
git add apps/api/src/integration/full-flow.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "test(api): add end-to-end plan→session→progression→PR integration test"
```

---

### Task 7: Docs — hardening notes + remaining deferrals + Terraform prod stub — [Quan]

**Files:** modify `README.md`, `infra/README.md`; create `infra/envs/prod/{backend.tf,main.tf,variables.tf,terraform.tfvars.example}` (mirror dev, prod bucket/prefix — **files only, no apply**).

- [ ] **Step 1: `README.md`** — mark E14 ✅ (backend hardening); add a short **Hardening** note: atomic quota + session numbering, InBody payload bound, Gemini-only internal meal, FCM stale-token pruning + reminder batching, request-id/structured logging.
- [ ] **Step 2: `infra/README.md`** — add a **Remaining before production** section listing the explicit deferrals: multi-document **transactions** (need a replica set / Atlas) for plan/meal/inbody active-toggle + `replaceSetLogs` + finish+refresh; **Terraform prod** `apply`; **Cloud Tasks + Scheduler** switch-over (replace inline enqueuers; add the inbody internal handler); rotate any exposed secrets.
- [ ] **Step 3: `infra/envs/prod/`** — mirror `envs/dev` with a `gigaflow-tfstate-prod` bucket + `env/prod` prefix and a `gigaflow-prod` project var; `terraform fmt` only (no `init`/`apply`).
- [ ] **Step 4: Commit — Quan**

```bash
git add README.md infra
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "docs+infra: hardening notes, remaining-before-prod list, and Terraform prod skeleton"
```

---

## Self-Review

**1. Coverage:** atomic quota TOCTOU → T1; atomic sessionNumber → T2; InBody payload bound + Gemini-only internal meal → T3; FCM stale-token cleanup + reminder batching → T4; observability (request-id + logger) → T5; end-to-end integration test → T6; docs + remaining-deferral list + prod TF skeleton → T7. True multi-doc transactions + prod apply + Cloud Tasks/Scheduler explicitly deferred with reasons (need replica set / live GCP), documented in T7.

**2. Placeholder scan:** each task specifies concrete atomic operators / interfaces / test assertions; no vague "harden X". The deferred transaction work is named with its blocker (replica set), not hidden.

**3. Type consistency:** `tryConsume` (T1) used by `quotaGuard`; `PLAN_LIMITS`/`GenerationType` reused. Counter (T2) internal to `session.repo`. `makeInternalTaskRoutes` deps `{engine, mealEngine}` (T3, default mealEngine=engine keeps callers compiling). `PushSender.send` return-type change (T4) ripples to `FcmPushSender` + fakes + `notification.service` + reminder — all updated in T4. `requestId`/`ContextVariableMap` augmentation (T5) consumed by `error.ts`. Integration test (T6) is additive, production code untouched (a revealed bug → reported, not silently patched). `.js` ESM throughout; every task ends on a green full suite.

**Assignees:** T1–T3, T5, T7 Quan; T4 Ngọc Danh; T6 Thanh Minh. Commit authors set per task.
