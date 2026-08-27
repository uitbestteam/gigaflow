# E11 — Analytics, PR & Awards (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e11-analytics`.

**Goal:** Surface the user's progress — **personal records** (best e1RM per exercise, from the E5 `exercise_performance` cache), a **stats summary** (total sessions / volume / PRs / exercises), and lazily-evaluated **awards** (badges earned from those numbers). All read-only aggregation over existing data; no hooks into E5, no new write paths, no external services.

**Architecture:** A `stats` module reads `exercise_performance` (E5), `training_sessions` (E5), and the exercise catalog (E3), computes a summary + PR list, and evaluates a static award catalog against the summary. Endpoints under `/api/stats`, behind E2 `firebaseAuth`, owner-scoped. Native driver + Zod, `.js` ESM, per-assignee commits. Consistent with E1–E9.

**Tech Stack:** Hono, MongoDB native driver, Zod, Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.5 exercise_performance, §7 e1RM, analytics/awards)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E11)

## Scope

**In scope (backend):** E11-S1 (PR detection/surfacing + stats summary), E11-S2 (awards/gamification — a static catalog evaluated lazily from the summary). **Deferred:** E11-S3 (Statistics UI → E13). No persistence of PR events or award grants (recomputed on read — deterministic, race-free, no coupling); a PR-event timeline / stored award grants can come later if needed.

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm; TS strict, NO `any`, guard `noUncheckedIndexedAccess`, explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`; routes under `/api`, behind `firebaseAuth` (E2); owner = `c.get('user').authId`.
- Read-only: no writes, no new collections, no changes to E5's finish path.
- Run turbo `pnpm typecheck` (exit 0) + `pnpm test` after every api task.
- **Commit author = Ngọc Danh** for all tasks: `git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit ...`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts                # + AwardKey
  schemas/stats.ts              # zPersonalRecord, zStatsSummary, zAward + types (NEW)
  index.ts
apps/api/src/modules/exercise/
  exercise.repo.ts              # + findByIds()
apps/api/src/modules/stats/
  stats.repo.ts                 # listPerformance / countCompletedSessions (NEW)
  stats.repo.test.ts
  stats.service.ts              # buildSummary / buildPersonalRecords (NEW)
  stats.service.test.ts
  awards.ts                     # AWARD_CATALOG + evaluateAwards (NEW)
  awards.test.ts
  stats.routes.ts               # GET /stats/summary, /stats/prs, /stats/awards (NEW)
  stats.routes.test.ts
apps/api/src/app.ts             # mount /stats
```

---

### Task 1: Award enum + stats schemas (shared) — [Ngọc Danh]

**Files:** modify `enums/index.ts`, `index.ts`; create `schemas/stats.ts`, `schemas/stats.test.ts`.

**Interfaces — Produces:**
- `enum AwardKey { FIRST_WORKOUT='first_workout', CONSISTENT_10='consistent_10', FIRST_PR='first_pr', TEN_EXERCISES='ten_exercises', VOLUME_50K='volume_50k' }`
- `zPersonalRecord` → `PersonalRecord`: `{ exerciseId: string, name: Translatable, bestSet: { weightKg: number≥0, repsDone: int≥0, e1RM: number≥0 } }`.
- `zStatsSummary` → `StatsSummary`: `{ totalSessions: int≥0, totalVolume: number≥0, totalPrs: int≥0, totalExercises: int≥0 }`.
- `zAward` → `Award`: `{ key: AwardKey, name: Translatable, description: Translatable, target: number≥0, current: number≥0, earned: boolean }`.

- [ ] **Step 1: Failing test — `schemas/stats.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zPersonalRecord, zStatsSummary, zAward, AwardKey } from '../index';

describe('stats schemas', () => {
  it('accepts a personal record', () => {
    expect(zPersonalRecord.safeParse({ exerciseId: 'e1', name: { en: 'Bench', vi: 'Đẩy ngực' }, bestSet: { weightKg: 100, repsDone: 5, e1RM: 116.7 } }).success).toBe(true);
  });
  it('accepts a summary', () => {
    expect(zStatsSummary.safeParse({ totalSessions: 3, totalVolume: 12000, totalPrs: 5, totalExercises: 5 }).success).toBe(true);
  });
  it('rejects a negative summary field', () => {
    expect(zStatsSummary.safeParse({ totalSessions: -1, totalVolume: 0, totalPrs: 0, totalExercises: 0 }).success).toBe(false);
  });
  it('accepts an award', () => {
    expect(zAward.safeParse({ key: AwardKey.FIRST_WORKOUT, name: { en: 'First workout', vi: 'Buổi đầu' }, description: { en: 'x', vi: 'y' }, target: 1, current: 1, earned: true }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/stats.test.ts`)

- [ ] **Step 3: Add enum** `AwardKey` to `enums/index.ts`.

- [ ] **Step 4: Create `schemas/stats.ts`** (import `AwardKey` from enums, `zTranslatable` from `./common.js`; `.js` extensions) per the Interfaces.

- [ ] **Step 5: Export** — add `export * from './schemas/stats.js';` to `index.ts`.

- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 34 + 4 new = 38).

- [ ] **Step 7: Commit — Ngọc Danh**

```bash
git add packages/shared
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(shared): add award enum and stats/PR/award schemas"
```

---

### Task 2: Stats repo + `exercise.repo.findByIds` — TDD — [Ngọc Danh]

**Files:** modify `apps/api/src/modules/exercise/exercise.repo.ts`; create `apps/api/src/modules/stats/stats.repo.ts`, `stats.repo.test.ts`.

**Interfaces — Produces:**
- In `exercise.repo.ts`: `findByIds(ids: string[]): Promise<Map<string, Exercise>>` — filters invalid hex out, queries `{ _id: { $in: [ObjectId...] } }`, returns a Map keyed by the exercise `id` (hex string).
- In `stats.repo.ts`:
  - `listPerformance(userId: string): Promise<ExercisePerformance[]>` — all `exercise_performance` docs for the user (map `_id`→`id`).
  - `countCompletedSessions(userId: string): Promise<number>` — count `training_sessions` with `status: 'completed'` for the user.

- [ ] **Step 1: Failing test — `stats.repo.test.ts`** (memory mongo; insert a couple `exercise_performance` docs + a completed and an in-progress `training_session` for `u1`; assert `listPerformance` returns the 2 perf docs and `countCompletedSessions` returns 1; `findByIds` returns a Map for real ids and skips a bad hex).

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';
import { connectDb, closeDb, getDb } from '../../lib/db';
import { listPerformance, countCompletedSessions } from './stats.repo';
import { findByIds } from '../exercise/exercise.repo';

let mongod: MongoMemoryServer;
let exId: string;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_stats_test');
  const ex = await getDb().collection('exercises').insertOne({ slug: 'bench-barbell', name: { en: 'Bench', vi: 'Đẩy ngực' }, muscleGroup: 'chest', equipmentType: 'barbell', defaultIncrement: 2.5, isCustom: false, ownerUserId: null });
  exId = ex.insertedId.toString();
  await getDb().collection('exercise_performance').insertMany([
    { userId: 'u1', exerciseId: exId, lastSets: [{ weightKg: 100, repsDone: 5 }], lastPerformedAt: new Date(), bestSet: { weightKg: 100, repsDone: 5, e1RM: 116.7 }, totalVolume: 5000, totalSessions: 2 },
    { userId: 'u1', exerciseId: 'other', lastSets: [], lastPerformedAt: new Date(), bestSet: { weightKg: 50, repsDone: 8, e1RM: 63.3 }, totalVolume: 2000, totalSessions: 1 },
  ]);
  await getDb().collection('training_sessions').insertMany([
    { userId: 'u1', templateId: 't', sessionNumber: 1, startedAt: new Date(), status: 'completed' },
    { userId: 'u1', templateId: 't', sessionNumber: 2, startedAt: new Date(), status: 'in_progress' },
  ]);
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('stats repo', () => {
  it('listPerformance returns the user perf docs', async () => {
    expect((await listPerformance('u1')).length).toBe(2);
  });
  it('countCompletedSessions counts only completed', async () => {
    expect(await countCompletedSessions('u1')).toBe(1);
  });
  it('findByIds maps real ids and skips bad hex', async () => {
    const map = await findByIds([exId, 'not-hex']);
    expect(map.get(exId)?.slug).toBe('bench-barbell');
    expect(map.size).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** `findByIds` (in exercise.repo, using its existing `collection()`/`toExercise` + `ObjectId.isValid` filter) and `stats.repo.ts` (native driver; map `_id`→`id`; no `any`).
- [ ] **Step 4: Run — expect PASS**; root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/stats/stats.repo.ts apps/api/src/modules/stats/stats.repo.test.ts apps/api/src/modules/exercise/exercise.repo.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add stats repo and exercise findByIds"
```

---

### Task 3: Stats service (summary + PRs) + awards — TDD — [Ngọc Danh]

**Files:** create `apps/api/src/modules/stats/stats.service.ts`, `stats.service.test.ts`, `awards.ts`, `awards.test.ts`.

**Interfaces — Produces:**
- `stats.service.ts`:
  - `buildSummary(userId: string): Promise<StatsSummary>` — `perf = listPerformance(userId)`; `totalSessions = countCompletedSessions(userId)`; `totalVolume = Math.round(Σ perf.totalVolume)`; `totalExercises = perf.length`; `totalPrs = perf.length` (each cached exercise has a best set = its PR).
  - `buildPersonalRecords(userId: string): Promise<PersonalRecord[]>` — `perf = listPerformance(userId)`; resolve names via `findByIds(perf.map(p=>p.exerciseId))` (missing name → `{ en: exerciseId, vi: exerciseId }` fallback); map to `PersonalRecord` (`bestSet` from perf); sort by `bestSet.e1RM` descending.
- `awards.ts`:
  - `interface AwardDef { key: AwardKey; name: Translatable; description: Translatable; target: number; metric: (s: StatsSummary) => number }`
  - `AWARD_CATALOG: AwardDef[]` — the 5 awards: FIRST_WORKOUT (target 1, metric `totalSessions`), CONSISTENT_10 (10, `totalSessions`), FIRST_PR (1, `totalPrs`), TEN_EXERCISES (10, `totalExercises`), VOLUME_50K (50000, `totalVolume`) — each with bilingual name+description.
  - `evaluateAwards(summary: StatsSummary): Award[]` — for each def, `current = min(metric(summary), target)`, `earned = metric(summary) >= target`; return `Award[]`.

- [ ] **Step 1: Failing tests** — `stats.service.test.ts` (memory mongo + seeded perf/sessions: summary totals correct; PRs sorted by e1RM desc with resolved name) and `awards.test.ts` (pure: a summary with `totalSessions: 1` earns FIRST_WORKOUT but not CONSISTENT_10; `totalVolume: 50000` earns VOLUME_50K; `current` is capped at `target`).

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** both modules (`.js` imports; reuse T2 repo + E3 `findByIds`; guard `noUncheckedIndexedAccess`; no `any`).
- [ ] **Step 4: Run — expect PASS**; root `pnpm typecheck` exit 0.
- [ ] **Step 5: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/stats/stats.service.ts apps/api/src/modules/stats/stats.service.test.ts apps/api/src/modules/stats/awards.ts apps/api/src/modules/stats/awards.test.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add stats service (summary, PRs) and awards evaluation"
```

---

### Task 4: Stats routes + wiring — TDD — [Ngọc Danh]

**Files:** create `apps/api/src/modules/stats/stats.routes.ts`, `stats.routes.test.ts`; modify `apps/api/src/app.ts`.

**Interfaces — Produces:** `makeStatsRoutes(deps: { verify: TokenVerifier }): Hono` with `firebaseAuth` and:
- `GET /summary` → `apiSuccess(buildSummary(user.authId))`.
- `GET /prs` → `apiSuccess(buildPersonalRecords(user.authId))`.
- `GET /awards` → `apiSuccess(evaluateAwards(await buildSummary(user.authId)))`.
- App mounts `app.route('/stats', makeStatsRoutes({ verify: firebaseVerifier }))` before `notFound`. (No new startup indexes — reads existing collections.)

- [ ] **Step 1: Failing test — `stats.routes.test.ts`** (fake verifier + memory mongo, seed a completed session + a couple `exercise_performance` docs + matching exercises): 401 without token; `GET /summary` returns the totals; `GET /prs` returns records sorted by e1RM desc; `GET /awards` includes FIRST_WORKOUT earned:true.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement `stats.routes.ts`** + mount in `app.ts` (`.js` imports; no `any`).
- [ ] **Step 4: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` ALL green.
- [ ] **Step 5: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/stats/stats.routes.ts apps/api/src/modules/stats/stats.routes.test.ts apps/api/src/app.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add /stats routes (summary, prs, awards)"
```

---

### Task 5: Docs — README endpoints + roadmap — [Ngọc Danh]

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E11 (analytics/PR/awards backend) complete.
- API Endpoints — add a **Stats** subsection (all auth-required): `GET /api/stats/summary` (total sessions / volume / PRs / exercises), `GET /api/stats/prs` (best e1RM per exercise, sorted), `GET /api/stats/awards` (badge catalog with earned + progress).
- Roadmap: mark E11 Analytics/PR ✅ (backend); note E11-S3 (Statistics UI) → E13.

- [ ] **Step 2: Commit — Ngọc Danh**

```bash
git add README.md
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "docs: document stats/analytics endpoints"
```

---

## Self-Review

**1. Spec coverage (E11 backend):** E11-S1 PR (best e1RM per exercise) + stats summary → T2/T3/T4; E11-S2 awards (catalog + lazy evaluation) → T3/T4. E11-S3 UI deferred. PRs derive from E5's already-maintained `bestSet` (e1RM), so "detection" is surfaced without touching E5's finish path.

**2. Placeholder scan:** stats service + awards specified by exhaustive Interfaces + explicit summary formulas + the 5-award catalog with concrete targets/metrics; schema/repo steps have literal code + exact tests. No vague directives.

**3. Type consistency:** `AwardKey`/`zPersonalRecord`/`zStatsSummary`/`zAward` (T1) → service/awards (T3), routes (T4). `listPerformance`/`countCompletedSessions` (T2) + `findByIds` (T2, on exercise.repo) → service (T3). `AWARD_CATALOG`/`evaluateAwards`/`buildSummary`/`buildPersonalRecords` (T3) → routes (T4). Reuses E5 `exercise_performance`/`training_sessions` (read), E3 `Exercise`. `user.authId` matches E2. `.js` ESM throughout; read-only (no writes, no E5 coupling).

**Assignees:** all tasks Ngọc Danh (board: E11-S1 GIGA-56, E11-S2 GIGA-76 both Ngọc Danh; E11-S3 UI → Bảo Hân, deferred). Commit authors set per task.
