# E5 — Session Logging & Progression (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e5-session`.

**Goal:** The training core loop — start a session from a plan template with **pre-filled target weight×reps** (computed from the user's last performance via a progression rule), log each set, and finish (rolling volume/duration up and refreshing an `exercise_performance` cache incl. best-set e1RM). This is the backend behind GymFlow's "2-tap" logging.

**Architecture:** Two new collections `training_sessions` + `set_logs`, plus an `exercise_performance` cache (one doc per user×exercise) that is refreshed on finish and read on start to prefill targets. A pure progression engine turns "last performance + slot rep-range/increment" into a suggested target. Hono routes behind E2 `firebaseAuth`; reads the plan graph from E4's `WorkoutRepository`. Consistent with E1–E4 (native driver + Zod, `.js` ESM, per-assignee commits).

**Tech Stack:** Hono, MongoDB native driver, Zod (`@gigaflow/shared`), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.4 sessions/set_logs, §5.5 exercise_performance, §7 progression)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E5)
- Reference: `gymflow-docs/data-model.md` (progression algorithm), `gymflow-docs/PRD.md`

## Scope

**In scope (backend):** E5-S1 (schemas), E5-S2 (`exercise_performance` cache + refresh on finish), E5-S3 (progression rule engine), E5-S4 (start session + prefill), E5-S5 (log set / finish / cancel), E5-S8 (`GET /exercises/:id/last`). **Deferred (need the React app, E13):** E5-S6 (Active Session 2-tap UI), E5-S7 (Session Summary UI). Full PR/awards surfacing is E11 (this epic computes best-set e1RM in the cache but exposes no awards). RIR *capture/influence* is E6 (`rir` is stored here as an optional passthrough).

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm workspaces; TypeScript strict, NO `any`, explicit exported types.
- Zod single source in `@gigaflow/shared`; validate request bodies with `@hono/zod-validator`.
- Envelope `{ success, data?, message? }`; all routes under `/api`, behind `firebaseAuth` (E2); user = `c.get('user').authId`.
- Entities expose string `id` (hex of `_id`); `_id` never leaked; omit nullish optional fields.
- Ownership is always server-derived from the token; a user may only touch their own sessions / a template under a plan they own.
- Use turbo (`pnpm build`/`pnpm typecheck`/`pnpm test`) for verification.
- **Commit author = the task's assignee:** Thanh Minh → `Nguyen Thanh Minh <95201788+ngthminhdev@users.noreply.github.com>`; Ngọc Danh → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts               # + SessionStatus
  schemas/session.ts           # zTrainingSession, zSetLog, zLogSetInput, zExercisePerformance,
                               #   zSlotTarget, zSessionStartResult + types (NEW)
  index.ts                     # export session schema
apps/api/src/modules/workout/
  workout.repo.ts              # + getTemplateWithSlotsForUser()
apps/api/src/modules/training/
  progression.ts               # epley1RM(), computeTarget()  (pure)  (NEW)
  progression.test.ts
  session.repo.ts              # SessionRepository + PerformanceRepository (NEW)
  session.repo.test.ts
  session.service.ts           # startSession / logSets / finishSession / cancelSession / lastForExercise (NEW)
  session.service.test.ts
  session.routes.ts            # /sessions + /exercises/:id/last routes (NEW)
  session.routes.test.ts
apps/api/src/app.ts            # mount /sessions and the /exercises/:id/last route
apps/api/src/index.ts          # ensure training indexes on startup
```

---

### Task 1: SessionStatus enum + session Zod schemas (shared) — [Thanh Minh]

**Files:** modify `enums/index.ts`, `index.ts`; create `schemas/session.ts`, `schemas/session.test.ts`.

**Interfaces — Produces:**
- `enum SessionStatus { IN_PROGRESS='in_progress', COMPLETED='completed', CANCELLED='cancelled' }`
- `zSetLog` → `SetLog`: `id`, `sessionId`, `slotId`, `exerciseId`, `setNumber` (int ≥ 1), `weightKg` (number ≥ 0), `repsDone` (int ≥ 0), `weightSuggested` (number ≥ 0), `repsSuggested` (int ≥ 0), `restSeconds?` (int ≥ 0), `rir?` (int 0–10), `isCompleted` (boolean), `loggedAt` (Date).
- `zLogSetInput` → `LogSetInput`: `slotId`, `exerciseId`, `setNumber` (int ≥ 1), `weightKg` (≥ 0), `repsDone` (int ≥ 0), `weightSuggested` (≥ 0), `repsSuggested` (int ≥ 0), `restSeconds?`, `rir?`, `isCompleted` (boolean).
- `zTrainingSession` → `TrainingSession`: `id`, `userId`, `templateId`, `sessionNumber` (int ≥ 1), `startedAt` (Date), `finishedAt?` (Date), `status` (SessionStatus), `pausedDurationSeconds?` (int ≥ 0), `totalVolume?` (≥ 0), `totalSets?` (int ≥ 0), `durationSeconds?` (int ≥ 0), `notes?` (string).
- `zExercisePerformance` → `ExercisePerformance`: `id`, `userId`, `exerciseId`, `lastSets` (array of `{ weightKg, repsDone, rir? }`), `lastPerformedAt` (Date), `bestSet` (`{ weightKg, repsDone, e1RM }`), `totalVolume` (≥ 0), `totalSessions` (int ≥ 0).
- `zSlotTarget` → `SlotTarget`: the E4 `zExerciseSlot` fields plus `weightSuggested` (≥ 0), `repsSuggested` (int ≥ 1), `lastSets?` (array of `{ weightKg, repsDone, rir? }`).
- `zSessionStartResult` → `SessionStartResult`: `{ session: TrainingSession, slots: SlotTarget[] }`.

- [ ] **Step 1: Failing test — `schemas/session.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zTrainingSession, zLogSetInput, zSlotTarget, SessionStatus, EquipmentType } from '../index';

const session = { id: 's1', userId: 'u1', templateId: 't1', sessionNumber: 1, startedAt: new Date(), status: SessionStatus.IN_PROGRESS };
const logInput = { slotId: 'sl1', exerciseId: 'e1', setNumber: 1, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true };
const slotTarget = { id: 'sl1', templateId: 't1', exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5, weightSuggested: 80, repsSuggested: 6 };

describe('session schemas', () => {
  it('accepts a valid in-progress session', () => { expect(zTrainingSession.safeParse(session).success).toBe(true); });
  it('rejects an unknown status', () => { expect(zTrainingSession.safeParse({ ...session, status: 'paused' }).success).toBe(false); });
  it('accepts a valid log-set input', () => { expect(zLogSetInput.safeParse(logInput).success).toBe(true); });
  it('rejects rir out of range', () => { expect(zLogSetInput.safeParse({ ...logInput, rir: 99 }).success).toBe(false); });
  it('accepts a slot target', () => { expect(zSlotTarget.safeParse(slotTarget).success).toBe(true); });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/session.test.ts`)

- [ ] **Step 3: Add enum — append to `enums/index.ts`**

```typescript
export enum SessionStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```

- [ ] **Step 4: Create `schemas/session.ts`**

```typescript
import { z } from 'zod';
import { SessionStatus } from '../enums/index.js';
import { zExerciseSlot } from './plan.js';

const zPerfSet = z.object({
  weightKg: z.number().min(0),
  repsDone: z.number().int().min(0),
  rir: z.number().int().min(0).max(10).optional(),
});

export const zSetLog = z.object({
  id: z.string(),
  sessionId: z.string(),
  slotId: z.string(),
  exerciseId: z.string(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0),
  repsDone: z.number().int().min(0),
  weightSuggested: z.number().min(0),
  repsSuggested: z.number().int().min(0),
  restSeconds: z.number().int().min(0).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  isCompleted: z.boolean(),
  loggedAt: z.date(),
});

export const zLogSetInput = z.object({
  slotId: z.string(),
  exerciseId: z.string(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0),
  repsDone: z.number().int().min(0),
  weightSuggested: z.number().min(0),
  repsSuggested: z.number().int().min(0),
  restSeconds: z.number().int().min(0).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  isCompleted: z.boolean(),
});

export const zTrainingSession = z.object({
  id: z.string(),
  userId: z.string(),
  templateId: z.string(),
  sessionNumber: z.number().int().min(1),
  startedAt: z.date(),
  finishedAt: z.date().optional(),
  status: z.nativeEnum(SessionStatus),
  pausedDurationSeconds: z.number().int().min(0).optional(),
  totalVolume: z.number().min(0).optional(),
  totalSets: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const zExercisePerformance = z.object({
  id: z.string(),
  userId: z.string(),
  exerciseId: z.string(),
  lastSets: z.array(zPerfSet),
  lastPerformedAt: z.date(),
  bestSet: z.object({ weightKg: z.number().min(0), repsDone: z.number().int().min(0), e1RM: z.number().min(0) }),
  totalVolume: z.number().min(0),
  totalSessions: z.number().int().min(0),
});

export const zSlotTarget = zExerciseSlot.extend({
  weightSuggested: z.number().min(0),
  repsSuggested: z.number().int().min(1),
  lastSets: z.array(zPerfSet).optional(),
});

export const zSessionStartResult = z.object({
  session: zTrainingSession,
  slots: z.array(zSlotTarget),
});

export type PerfSet = z.infer<typeof zPerfSet>;
export type SetLog = z.infer<typeof zSetLog>;
export type LogSetInput = z.infer<typeof zLogSetInput>;
export type TrainingSession = z.infer<typeof zTrainingSession>;
export type ExercisePerformance = z.infer<typeof zExercisePerformance>;
export type SlotTarget = z.infer<typeof zSlotTarget>;
export type SessionStartResult = z.infer<typeof zSessionStartResult>;
```

- [ ] **Step 5: Export** — add `export * from './schemas/session.js';` to `packages/shared/src/index.ts`.

- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 18 + 5 new = 23)

- [ ] **Step 7: Commit — Thanh Minh**

```bash
git add packages/shared
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(shared): add session, set-log, and exercise-performance schemas"
```

---

### Task 2: Progression rule engine (pure) — TDD — [Thanh Minh]

**Files:** create `apps/api/src/modules/training/progression.ts`, `progression.test.ts`.

**Interfaces — Produces:**
- `epley1RM(weightKg: number, reps: number): number` — `weightKg * (1 + reps/30)`, rounded to 1 decimal; `reps <= 0` → 0.
- `interface LastPerf { sets: { weightKg: number; repsDone: number }[] }`
- `interface SlotSpec { repRangeMin: number; repRangeMax: number; weightIncrement: number }`
- `type ProgressionReason = 'first' | 'increase' | 'hold'`
- `computeTarget(last: LastPerf | null, slot: SlotSpec): { weightSuggested: number; repsSuggested: number; reason: ProgressionReason }` — rules (from §7 / GymFlow):
  - `last` null or empty sets → `{ weightSuggested: 0, repsSuggested: slot.repRangeMin, reason: 'first' }`.
  - else let `completed = last.sets` (all logged sets), `prevWeight = completed[0].weightKg`. If **every** set has `repsDone >= slot.repRangeMax` → `{ weightSuggested: prevWeight + slot.weightIncrement, repsSuggested: slot.repRangeMin, reason: 'increase' }`.
  - else → `{ weightSuggested: prevWeight, repsSuggested: min((completed[0].repsDone) + 1, slot.repRangeMax), reason: 'hold' }`.

- [ ] **Step 1: Failing test — `progression.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { epley1RM, computeTarget } from './progression';

describe('epley1RM', () => {
  it('computes Epley 1RM', () => { expect(epley1RM(100, 5)).toBeCloseTo(116.7, 1); });
  it('is 0 for non-positive reps', () => { expect(epley1RM(100, 0)).toBe(0); });
});

describe('computeTarget', () => {
  const slot = { repRangeMin: 6, repRangeMax: 10, weightIncrement: 2.5 };
  it('first session → repRangeMin at weight 0', () => {
    expect(computeTarget(null, slot)).toEqual({ weightSuggested: 0, repsSuggested: 6, reason: 'first' });
  });
  it('all sets hit max → increase weight, reset reps to min', () => {
    const r = computeTarget({ sets: [{ weightKg: 80, repsDone: 10 }, { weightKg: 80, repsDone: 10 }] }, slot);
    expect(r).toEqual({ weightSuggested: 82.5, repsSuggested: 6, reason: 'increase' });
  });
  it('not all sets hit max → hold weight, +1 rep capped at max', () => {
    const r = computeTarget({ sets: [{ weightKg: 80, repsDone: 8 }, { weightKg: 80, repsDone: 7 }] }, slot);
    expect(r).toEqual({ weightSuggested: 80, repsSuggested: 9, reason: 'hold' });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/api test src/modules/training/progression.test.ts`)

- [ ] **Step 3: Implement `progression.ts`**

```typescript
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface LastPerf { sets: { weightKg: number; repsDone: number }[] }
export interface SlotSpec { repRangeMin: number; repRangeMax: number; weightIncrement: number }
export type ProgressionReason = 'first' | 'increase' | 'hold';

export function computeTarget(
  last: LastPerf | null,
  slot: SlotSpec,
): { weightSuggested: number; repsSuggested: number; reason: ProgressionReason } {
  if (!last || last.sets.length === 0) {
    return { weightSuggested: 0, repsSuggested: slot.repRangeMin, reason: 'first' };
  }
  const prevWeight = last.sets[0].weightKg;
  const allHitMax = last.sets.every((s) => s.repsDone >= slot.repRangeMax);
  if (allHitMax) {
    return { weightSuggested: prevWeight + slot.weightIncrement, repsSuggested: slot.repRangeMin, reason: 'increase' };
  }
  return { weightSuggested: prevWeight, repsSuggested: Math.min(last.sets[0].repsDone + 1, slot.repRangeMax), reason: 'hold' };
}
```

- [ ] **Step 4: Run — expect PASS** (5 tests)

- [ ] **Step 5: Commit — Thanh Minh**

```bash
git add apps/api/src/modules/training/progression.ts apps/api/src/modules/training/progression.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add progression rule engine and Epley 1RM"
```

---

### Task 3: Session + Performance repositories + workout-template lookup — TDD — [Thanh Minh]

**Files:** modify `apps/api/src/modules/workout/workout.repo.ts`; create `apps/api/src/modules/training/session.repo.ts`, `session.repo.test.ts`.

**Interfaces — Produces:**
- In `workout.repo.ts`: `getTemplateWithSlotsForUser(userId: string, templateId: string): Promise<{ template: WorkoutTemplate; slots: ExerciseSlot[] } | null>` — resolves the template, verifies its plan's `userId === userId`, returns the template + its slots sorted by `orderIndex`; `null` if not found or not owned.
- In `session.repo.ts`:
  - `ensureTrainingIndexes()` — `training_sessions`: `{ userId: 1, status: 1 }`, `{ userId: 1, startedAt: -1 }`; `set_logs`: `{ sessionId: 1, setNumber: 1 }`; `exercise_performance`: unique `{ userId: 1, exerciseId: 1 }`.
  - `createSession(userId, templateId): Promise<TrainingSession>` — `sessionNumber = (count of user's sessions) + 1`, `startedAt = now`, `status = IN_PROGRESS`.
  - `findSessionById(id): Promise<TrainingSession | null>` (invalid hex → null).
  - `findActiveSession(userId): Promise<TrainingSession | null>` — status IN_PROGRESS.
  - `replaceSetLogs(sessionId, sets: LogSetInput[]): Promise<SetLog[]>` — delete existing set_logs for the session, insert the given ones (with `loggedAt = now`), return them.
  - `listSetLogs(sessionId): Promise<SetLog[]>` (sorted by `setNumber`).
  - `updateSessionOnFinish(id, patch: { status; finishedAt; durationSeconds; totalVolume; totalSets }): Promise<TrainingSession>`.
  - `updateSessionStatus(id, status): Promise<TrainingSession>` (for cancel).
  - `findPerformanceMany(userId, exerciseIds: string[]): Promise<Map<string, ExercisePerformance>>` (keyed by exerciseId).
  - `findPerformance(userId, exerciseId): Promise<ExercisePerformance | null>`.
  - `upsertPerformance(userId, exerciseId, data: { lastSets; lastPerformedAt; bestSet; totalVolume; totalSessions }): Promise<void>` — upsert by `{ userId, exerciseId }` with `$set` of the fields (bestSet/totalVolume/totalSessions computed by the caller/service).

- [ ] **Step 1: Failing test — `session.repo.test.ts`** (covers: create session increments sessionNumber; replace+list set logs; performance upsert then findMany returns it; getTemplateWithSlotsForUser respects ownership). Write real assertions with mongodb-memory-server; seed a plan via E4 `insertPlanGraph` to test `getTemplateWithSlotsForUser`.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import { ensureWorkoutIndexes, insertPlanGraph, getTemplateWithSlotsForUser } from '../workout/workout.repo';
import {
  ensureTrainingIndexes, createSession, replaceSetLogs, listSetLogs,
  upsertPerformance, findPerformanceMany, findActiveSession,
} from './session.repo';

let mongod: MongoMemoryServer;
let templateId: string;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_sess_test');
  await ensureWorkoutIndexes();
  await ensureTrainingIndexes();
  const plan = await insertPlanGraph('u1', { name: 'P', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true }, [
    { name: { en: 'Push', vi: 'Đẩy' }, orderIndex: 0, colorTag: ColorTag.PUSH, slots: [{ exerciseId: 'e1', orderIndex: 0, setsTarget: 3, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 }] },
  ]);
  templateId = plan.templates[0].id;
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('SessionRepository', () => {
  it('createSession assigns incrementing sessionNumber and active status', async () => {
    const s1 = await createSession('u1', templateId);
    const s2 = await createSession('u1', templateId);
    expect(s1.sessionNumber).toBe(1);
    expect(s2.sessionNumber).toBe(2);
    expect((await findActiveSession('u1'))).not.toBeNull();
  });
  it('replaceSetLogs then listSetLogs round-trips sorted', async () => {
    const s = await createSession('u1', templateId);
    await replaceSetLogs(s.id, [
      { slotId: 'sl1', exerciseId: 'e1', setNumber: 2, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true },
      { slotId: 'sl1', exerciseId: 'e1', setNumber: 1, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true },
    ]);
    const logs = await listSetLogs(s.id);
    expect(logs.map((l) => l.setNumber)).toEqual([1, 2]);
  });
  it('upsertPerformance then findPerformanceMany returns it', async () => {
    await upsertPerformance('u1', 'e1', { lastSets: [{ weightKg: 80, repsDone: 8 }], lastPerformedAt: new Date(), bestSet: { weightKg: 80, repsDone: 8, e1RM: 101.3 }, totalVolume: 640, totalSessions: 1 });
    const map = await findPerformanceMany('u1', ['e1', 'e2']);
    expect(map.get('e1')?.bestSet.e1RM).toBe(101.3);
    expect(map.has('e2')).toBe(false);
  });
  it('getTemplateWithSlotsForUser returns slots for owner, null for others', async () => {
    const owned = await getTemplateWithSlotsForUser('u1', templateId);
    expect(owned?.slots).toHaveLength(1);
    expect(await getTemplateWithSlotsForUser('u2', templateId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Add `getTemplateWithSlotsForUser` to `workout.repo.ts`**

```typescript
import { ObjectId } from 'mongodb'; // (already imported)
// ...
export async function getTemplateWithSlotsForUser(
  userId: string, templateId: string,
): Promise<{ template: WorkoutTemplate; slots: ExerciseSlot[] } | null> {
  if (!ObjectId.isValid(templateId)) return null;
  const tDoc = await templates().findOne({ _id: new ObjectId(templateId) });
  if (!tDoc) return null;
  const template = mapId<WorkoutTemplate>(tDoc);
  const planDoc = await plans().findOne({ _id: new ObjectId(template.planId), userId });
  if (!planDoc) return null;
  const sDocs = await slots().find({ templateId: template.id }).sort({ orderIndex: 1 }).toArray();
  return { template, slots: sDocs.map((d) => mapId<ExerciseSlot>(d)) };
}
```

> `mapId`/`plans`/`templates`/`slots` already exist in `workout.repo.ts` (E4). Export `getTemplateWithSlotsForUser`.

- [ ] **Step 4: Implement `session.repo.ts`** (native driver; map `_id`→`id`, omit nullish; the caller computes bestSet/volume). Provide the full module — collections `training_sessions`, `set_logs`, `exercise_performance`; each function per the Interfaces block; use a local `mapId` helper identical in spirit to E4's (`{ id: _id.toString(), ...rest }` with `as unknown as T`).

- [ ] **Step 5: Run — expect PASS** (4 tests)

- [ ] **Step 6: Commit — Thanh Minh**

```bash
git add apps/api/src/modules/training/session.repo.ts apps/api/src/modules/training/session.repo.test.ts apps/api/src/modules/workout/workout.repo.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add Session/Performance repositories and template lookup"
```

---

### Task 4: Session service (start/log/finish/cancel/last) — TDD — [Thanh Minh]

**Files:** create `apps/api/src/modules/training/session.service.ts`, `session.service.test.ts`.

**Interfaces — Produces (all take the resolved `userId`):**
- `startSession(userId, templateId): Promise<SessionStartResult>` — `getTemplateWithSlotsForUser` (throw `SessionError('Template not found', 404)` if null); collect slot exerciseIds; `findPerformanceMany`; for each slot build a `SlotTarget` = slot + `computeTarget(lastPerfForExercise, slot)` (map performance `lastSets` → `LastPerf`) + `lastSets` (from perf, if any); `createSession`; return `{ session, slots }`.
- `logSets(userId, sessionId, sets: LogSetInput[]): Promise<SetLog[]>` — load session (`SessionError('Session not found',404)` if missing/not owner), require `status===IN_PROGRESS` (`SessionError('Session not in progress',409)`), `replaceSetLogs`.
- `finishSession(userId, sessionId): Promise<TrainingSession>` — load+own+in-progress; read set logs; compute `totalSets = completed count`, `totalVolume = Σ weightKg*repsDone` over completed sets, `durationSeconds = max(0, (now - startedAt)/1000 - (pausedDurationSeconds ?? 0))`; **refresh exercise_performance** per exercise present in the session (see rule below); `updateSessionOnFinish(status=COMPLETED,...)`.
- `cancelSession(userId, sessionId): Promise<TrainingSession>` — load+own+in-progress → `updateSessionStatus(CANCELLED)`.
- `lastForExercise(userId, exerciseId): Promise<ExercisePerformance | null>` — `findPerformance`.
- `class SessionError extends Error { status: number }` (exported) for the routes layer.

**Performance refresh rule (per exercise in the finished session):** consider that exercise's *completed* sets in this session; `lastSets` = those sets' `{weightKg,repsDone,rir?}`; `sessionBest` = the set maximizing `epley1RM`; load prior perf → `bestSet` = whichever of prior.bestSet / sessionBest has the higher `e1RM` (sessionBest's e1RM via `epley1RM`); `totalVolume = (prior?.totalVolume ?? 0) + Σ this exercise's completed volume`; `totalSessions = (prior?.totalSessions ?? 0) + 1`; `lastPerformedAt = now`; `upsertPerformance`.

- [ ] **Step 1: Failing test — `session.service.test.ts`** covering: start returns targets with `reason:'first'` weight 0 for a fresh user; after logging all-max sets + finish, a *second* start suggests the increased weight (progression end-to-end through the cache); finish computes totalVolume; logging into a finished session throws 409; start for an unowned template throws 404. Use memory mongo + an E4 plan seed.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `session.service.ts`** per the Interfaces + refresh rule (pure composition over Task 2 engine + Task 3 repos). No `any`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit — Thanh Minh**

```bash
git add apps/api/src/modules/training/session.service.ts apps/api/src/modules/training/session.service.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add session service (start/log/finish/cancel) with performance refresh"
```

---

### Task 5: Routes + wire app + startup indexes — TDD — [Ngọc Danh]

**Files:** create `session.routes.ts`, `session.routes.test.ts`; modify `app.ts`, `index.ts`.

**Interfaces — Produces:** `makeSessionRoutes(deps: { verify: TokenVerifier }): Hono` with `firebaseAuth` and:
- `POST /start` — body `{ templateId: string }` (zValidator) → `startSession(user.authId, templateId)` → 201 `apiSuccess(result)`; `SessionError` → its `status` + `errorBody(message)`.
- `GET /active` → `findActiveSession(user.authId)` → `apiSuccess(session | null)`.
- `POST /:id/sets` — body `{ sets: LogSetInput[] }` (`z.object({ sets: z.array(zLogSetInput) })`) → `logSets` → `apiSuccess(setLogs)`.
- `POST /:id/finish` → `finishSession` → `apiSuccess(session)`.
- `POST /:id/cancel` → `cancelSession` → `apiSuccess(session)`.
- A separate exported `makeExerciseLastRoute(deps)` OR extend the exercise routes: add `GET /exercises/:id/last`. **Decision:** mount a tiny standalone route group `makeLastPerfRoutes(deps)` at `/exercises` with `GET /:id/last` → `lastForExercise(user.authId, id)` → `apiSuccess(perf | null)`. (Keeps E3's exercise routes untouched; Hono merges the two `/exercises` groups at mount.)

Wire in `app.ts`: `app.route('/sessions', makeSessionRoutes({ verify: firebaseVerifier }))` and `app.route('/exercises', makeLastPerfRoutes({ verify: firebaseVerifier }))` (after the existing `/exercises` mount, before `notFound`). In `index.ts`: `ensureTrainingIndexes()` on startup (inside `if (uri)`, after workout indexes).

`SessionError` → response: map `err.status` (404/409) with `errorBody(err.message)`; rethrow non-SessionError.

- [ ] **Step 1: Failing test — `session.routes.test.ts`** covering: 401 no token; POST /start 201 with slots (fresh → weightSuggested 0); GET /active returns the session; POST /:id/sets then POST /:id/finish 200; POST /:id/sets on finished → 409; POST /start bad body → 400; `GET /exercises/:id/last` returns null then (after a finished session) the perf. Use memory mongo + E4 plan seed + fake verifier.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `session.routes.ts`** (+ `makeLastPerfRoutes`) per Interfaces.

- [ ] **Step 4: Mount in `app.ts`; add `ensureTrainingIndexes()` to `index.ts`.**

- [ ] **Step 5: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` all green.

- [ ] **Step 6: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/training/session.routes.ts apps/api/src/modules/training/session.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add /sessions routes and GET /exercises/:id/last"
```

---

### Task 6: Docs — README endpoints + roadmap — [Ngọc Danh]

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E5 (session logging & progression backend) complete.
- API Endpoints — add a **Sessions** subsection: `POST /api/sessions/start` (body `{templateId}`, returns session + prefilled slot targets), `GET /api/sessions/active`, `POST /api/sessions/:id/sets` (body `{sets:[...]}`), `POST /api/sessions/:id/finish`, `POST /api/sessions/:id/cancel`, `GET /api/exercises/:id/last` (last performance / progression source) — all auth-required.
- Roadmap: mark E5 ✅ (backend); note E5-S6 (Active Session UI) + E5-S7 (Session Summary UI) deferred to E13.

- [ ] **Step 2: Commit — Ngọc Danh**

```bash
git add README.md
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "docs: document session logging endpoints and roadmap"
```

---

## Self-Review

**1. Spec coverage (E5 backend):** S1 schemas → T1; S3 progression engine → T2; S2 exercise_performance cache + refresh → T3 (repo) + T4 (refresh rule on finish); S4 start+prefill → T4/T5; S5 log/finish/cancel → T4/T5; S8 GET /exercises/:id/last → T5. S6/S7 (UI) deferred (Scope). RIR stored as optional passthrough (E6 captures/uses it). PR/awards surfacing → E11 (best-set e1RM computed in cache here).

**2. Placeholder scan:** T3 `session.repo.ts` and T4 `session.service.ts` bodies are specified by exhaustive Interfaces + the explicit performance-refresh rule rather than full literals (they are multi-function modules); every other step has literal code or exact assertions. The progression math, e1RM, volume/duration formulas, and error-status mapping are all given concretely. No "add error handling"-style vagueness.

**3. Type consistency:** `SessionStatus`/`SetLog`/`LogSetInput`/`TrainingSession`/`ExercisePerformance`/`SlotTarget`/`SessionStartResult` (T1) flow into repo (T3), service (T4), routes (T5). `epley1RM`/`computeTarget`/`LastPerf`/`SlotSpec` (T2) consumed by T4. `getTemplateWithSlotsForUser` (T3, on workout.repo) consumed by T4. `SessionError{status}` (T4) consumed by T5. `zExerciseSlot` reused for `zSlotTarget`. `.js` ESM throughout; `user.authId` matches E2. `/exercises/:id/last` mounted as a second `/exercises` group so E3 routes stay untouched.

**Assignees:** T1–T4 Thanh Minh (S1/S2/S3/S5 core logic), T5–T6 Ngọc Danh (S4 route/prefill wiring + S8 + docs). Commit authors set per task.
