# E3 — Exercise Catalog (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — work on a plain branch (`e3-catalog`) in this repo (user preference).

**Goal:** A MongoDB-backed exercise catalog — a seeded library of ~50 preset exercises plus per-user custom exercises (guests can create them immediately) — exposed via `GET /api/exercises` (preset + own custom, filterable) and `POST /api/exercises` (create custom), the foundation the workout planner (E4/E5) references by exercise id.

**Architecture:** Zod-first entity in `@gigaflow/shared`; a native-driver `ExerciseRepository` with visibility rules (presets visible to everyone, custom visible only to the owner); an idempotent seed; Hono routes behind the existing `firebaseAuth` (anonymous users included, so guests can create custom). Consistent with E1/E2 patterns.

**Tech Stack:** Hono, MongoDB native driver, Zod (`@gigaflow/shared`), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.2 exercises)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E3)

## Scope

**In scope (backend):** E3-S1 (schema + repo), E3-S2 (seed ~50), E3-S3 (custom exercise create + visibility — backend). **Deferred:** E3-S4 (Exercise library UI — search/filter) needs the React app (E13); becomes a follow-on.

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm workspaces; TypeScript strict, NO `any`, explicit exported types.
- Zod single source in `@gigaflow/shared`; API validates with those schemas via `@hono/zod-validator`.
- Envelope `{ success, data?, message? }` (`apiSuccess`/`errorBody` from E1). All routes under `/api` base path.
- Auth: exercise routes sit behind `firebaseAuth` (from E2); the current user is `c.get('user')` (anonymous allowed → guests can create custom).
- Exercises expose a string `id` (hex of Mongo `_id`); `_id` is never leaked raw. `Translatable` = `{ en, vi }`.
- Use turbo for verification (`pnpm build` / `pnpm typecheck` / `pnpm test`) — not standalone `--filter` typecheck (shared/dist ordering).
- **Commit author = the task's assignee** (per the team mapping). Use `git -c user.name="<Name>" -c user.email="<email>" commit ...`:
  - **Thanh Minh** → `Nguyen Thanh Minh <95201788+ngthminhdev@users.noreply.github.com>`
  - **Ngọc Danh** → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`
- Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts            # + MuscleGroup, EquipmentType
  schemas/exercise.ts       # zExercise, zCreateExerciseInput, types (NEW)
  index.ts                  # export exercise schema
apps/api/src/modules/exercise/
  exercise.repo.ts          # ExerciseRepository (NEW)
  exercise.repo.test.ts
  seed-exercises.ts         # PRESET_EXERCISES data + seedPresets() (NEW)
  seed-exercises.test.ts
  slugify.ts                # tiny helper (NEW)
  exercise.routes.ts        # GET/POST /exercises (NEW)
  exercise.routes.test.ts
apps/api/src/app.ts         # mount /exercises
apps/api/src/index.ts       # ensure exercise indexes + seed on startup
```

---

### Task 1: MuscleGroup/EquipmentType enums + exercise Zod schema (shared) — [Thanh Minh]

**Files:**
- Modify: `packages/shared/src/enums/index.ts`
- Create: `packages/shared/src/schemas/exercise.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas/exercise.test.ts`

**Interfaces:**
- Produces:
  - `enum MuscleGroup { CHEST='chest', BACK='back', LEGS='legs', SHOULDERS='shoulders', ARMS='arms', CORE='core', CARDIO='cardio' }`
  - `enum EquipmentType { BARBELL='barbell', DUMBBELL='dumbbell', MACHINE='machine', BODYWEIGHT='bodyweight', CABLE='cable' }`
  - `zExercise` → `type Exercise` with: `id: string`, `slug: string`, `name: Translatable`, `muscleGroup: MuscleGroup`, `equipmentType: EquipmentType`, `defaultIncrement: number (>=0)`, `videoUrl?: string`, `isCustom: boolean`, `ownerUserId?: string`.
  - `zCreateExerciseInput` → `type CreateExerciseInput`: `name: Translatable`, `muscleGroup: MuscleGroup`, `equipmentType: EquipmentType`, `defaultIncrement?: number (>=0)`, `videoUrl?: string`.

- [ ] **Step 1: Failing test — `packages/shared/src/schemas/exercise.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zExercise, zCreateExerciseInput, MuscleGroup, EquipmentType } from '../index';

const ex = {
  id: '651f1f77bcf86cd799439011',
  slug: 'bench-barbell',
  name: { en: 'Bench press', vi: 'Đẩy ngực' },
  muscleGroup: MuscleGroup.CHEST,
  equipmentType: EquipmentType.BARBELL,
  defaultIncrement: 2.5,
  isCustom: false,
};

describe('exercise schemas', () => {
  it('accepts a valid preset exercise', () => {
    expect(zExercise.safeParse(ex).success).toBe(true);
  });
  it('rejects an unknown muscle group', () => {
    expect(zExercise.safeParse({ ...ex, muscleGroup: 'neck' }).success).toBe(false);
  });
  it('rejects negative increment', () => {
    expect(zExercise.safeParse({ ...ex, defaultIncrement: -1 }).success).toBe(false);
  });
  it('validates create input (increment optional)', () => {
    const r = zCreateExerciseInput.safeParse({
      name: { en: 'My Curl', vi: 'Cuốn của tôi' },
      muscleGroup: MuscleGroup.ARMS,
      equipmentType: EquipmentType.DUMBBELL,
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/shared test src/schemas/exercise.test.ts`

- [ ] **Step 3: Add enums — append to `packages/shared/src/enums/index.ts`**

```typescript
export enum MuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  LEGS = 'legs',
  SHOULDERS = 'shoulders',
  ARMS = 'arms',
  CORE = 'core',
  CARDIO = 'cardio',
}

export enum EquipmentType {
  BARBELL = 'barbell',
  DUMBBELL = 'dumbbell',
  MACHINE = 'machine',
  BODYWEIGHT = 'bodyweight',
  CABLE = 'cable',
}
```

- [ ] **Step 4: Create `packages/shared/src/schemas/exercise.ts`**

```typescript
import { z } from 'zod';
import { EquipmentType, MuscleGroup } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zExercise = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: zTranslatable,
  muscleGroup: z.nativeEnum(MuscleGroup),
  equipmentType: z.nativeEnum(EquipmentType),
  defaultIncrement: z.number().min(0),
  videoUrl: z.string().optional(),
  isCustom: z.boolean(),
  ownerUserId: z.string().optional(),
});

export const zCreateExerciseInput = z.object({
  name: zTranslatable,
  muscleGroup: z.nativeEnum(MuscleGroup),
  equipmentType: z.nativeEnum(EquipmentType),
  defaultIncrement: z.number().min(0).optional(),
  videoUrl: z.string().optional(),
});

export type Exercise = z.infer<typeof zExercise>;
export type CreateExerciseInput = z.infer<typeof zCreateExerciseInput>;
```

- [ ] **Step 5: Export — add to `packages/shared/src/index.ts`**

`export * from './schemas/exercise.js';`

- [ ] **Step 6: Run — expect PASS**

Run: `pnpm --filter @gigaflow/shared test`  (existing 9 + 4 new = 13)

- [ ] **Step 7: Commit** — author **Thanh Minh**

```bash
git add packages/shared
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(shared): add exercise enums and Zod schema"
```

---

### Task 2: `ExerciseRepository` + slugify — TDD — [Thanh Minh]

**Files:**
- Create: `apps/api/src/modules/exercise/slugify.ts`
- Create: `apps/api/src/modules/exercise/exercise.repo.ts`
- Test: `apps/api/src/modules/exercise/exercise.repo.test.ts`

**Interfaces:**
- Consumes: `getDb` (E1), `Exercise`/`CreateExerciseInput`/enums from `@gigaflow/shared`.
- Produces:
  - `slugify(s: string): string` in `slugify.ts` — lowercase, strip accents, non-alphanumerics → `-`, collapse/trim dashes.
  - In `exercise.repo.ts`:
    - `ensureExerciseIndexes(): Promise<void>` — unique compound `{ slug: 1, ownerUserId: 1 }`, plus `{ muscleGroup: 1 }`.
    - `upsertPreset(p: PresetSeed): Promise<void>` — idempotent upsert of a preset (ownerUserId unset) keyed by `{ slug, ownerUserId: null }`. `interface PresetSeed { slug; name; muscleGroup; equipmentType; defaultIncrement; videoUrl? }`.
    - `createCustom(ownerUserId: string, input: CreateExerciseInput): Promise<Exercise>` — slug from `slugify(input.name.en)`; `isCustom=true`, `ownerUserId` set, `defaultIncrement` defaults to 2.5 when omitted; on duplicate-key (code 11000) throw `new ExerciseConflictError()`.
    - `listVisible(userId: string, filter: { muscleGroup?: MuscleGroup; q?: string }): Promise<Exercise[]>` — `{ $or: [ { isCustom: false }, { ownerUserId: userId } ] }` + optional `muscleGroup` + optional case-insensitive regex on `name.en`/`name.vi`; sorted by `name.en` asc.
    - `findById(id: string): Promise<Exercise | null>` — accepts hex string; invalid hex → null.
  - `class ExerciseConflictError extends Error` (exported) for the routes layer to map to 409.
  - A private `toExercise(doc)` maps `_id`→`id` (hex string) and strips `_id`.

- [ ] **Step 1: Failing test — `exercise.repo.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { MuscleGroup, EquipmentType } from '@gigaflow/shared';
import {
  ensureExerciseIndexes, upsertPreset, createCustom, listVisible, findById, ExerciseConflictError,
} from './exercise.repo';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_ex_test');
  await ensureExerciseIndexes();
  await upsertPreset({ slug: 'bench-barbell', name: { en: 'Bench press', vi: 'Đẩy ngực' }, muscleGroup: MuscleGroup.CHEST, equipmentType: EquipmentType.BARBELL, defaultIncrement: 2.5 });
  await upsertPreset({ slug: 'squat-barbell', name: { en: 'Barbell squat', vi: 'Squat' }, muscleGroup: MuscleGroup.LEGS, equipmentType: EquipmentType.BARBELL, defaultIncrement: 2.5 });
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('ExerciseRepository', () => {
  it('upsertPreset is idempotent (no duplicate presets)', async () => {
    await upsertPreset({ slug: 'bench-barbell', name: { en: 'Bench press', vi: 'Đẩy ngực' }, muscleGroup: MuscleGroup.CHEST, equipmentType: EquipmentType.BARBELL, defaultIncrement: 2.5 });
    const all = await listVisible('u1', {});
    expect(all.filter((e) => e.slug === 'bench-barbell')).toHaveLength(1);
  });
  it('creates a custom exercise owned by the user, with an id', async () => {
    const ex = await createCustom('u1', { name: { en: 'My Special Curl', vi: 'Cuốn đặc biệt' }, muscleGroup: MuscleGroup.ARMS, equipmentType: EquipmentType.DUMBBELL });
    expect(ex.id).toMatch(/^[a-f0-9]{24}$/);
    expect(ex.isCustom).toBe(true);
    expect(ex.ownerUserId).toBe('u1');
    expect(ex.slug).toBe('my-special-curl');
    expect(ex.defaultIncrement).toBe(2.5);
    const round = await findById(ex.id);
    expect(round?.slug).toBe('my-special-curl');
  });
  it('custom exercise is visible to owner but not to others', async () => {
    const mine = await listVisible('u1', {});
    const theirs = await listVisible('u2', {});
    expect(mine.some((e) => e.slug === 'my-special-curl')).toBe(true);
    expect(theirs.some((e) => e.slug === 'my-special-curl')).toBe(false);
    // both see presets
    expect(theirs.some((e) => e.slug === 'bench-barbell')).toBe(true);
  });
  it('filters by muscle group and search query', async () => {
    const legs = await listVisible('u1', { muscleGroup: MuscleGroup.LEGS });
    expect(legs.every((e) => e.muscleGroup === MuscleGroup.LEGS)).toBe(true);
    const q = await listVisible('u1', { q: 'bench' });
    expect(q.some((e) => e.slug === 'bench-barbell')).toBe(true);
  });
  it('rejects a duplicate custom slug for the same owner with ExerciseConflictError', async () => {
    await expect(
      createCustom('u1', { name: { en: 'My Special Curl', vi: 'x' }, muscleGroup: MuscleGroup.ARMS, equipmentType: EquipmentType.DUMBBELL }),
    ).rejects.toBeInstanceOf(ExerciseConflictError);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/exercise/exercise.repo.test.ts`

- [ ] **Step 3: Implement `slugify.ts`**

```typescript
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Implement `exercise.repo.ts`**

```typescript
import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import {
  EquipmentType, MuscleGroup, type Exercise, type CreateExerciseInput,
} from '@gigaflow/shared';
import { slugify } from './slugify.js';

const COLLECTION = 'exercises';
const DEFAULT_INCREMENT = 2.5;

export class ExerciseConflictError extends Error {
  constructor(message = 'Exercise already exists') {
    super(message);
    this.name = 'ExerciseConflictError';
  }
}

export interface PresetSeed {
  slug: string;
  name: { en: string; vi: string };
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  defaultIncrement: number;
  videoUrl?: string;
}

function collection() {
  return getDb().collection(COLLECTION);
}

function toExercise(doc: WithId<Document>): Exercise {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as Omit<Exercise, 'id'>) };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

export async function ensureExerciseIndexes(): Promise<void> {
  await collection().createIndex({ slug: 1, ownerUserId: 1 }, { unique: true });
  await collection().createIndex({ muscleGroup: 1 });
}

export async function upsertPreset(p: PresetSeed): Promise<void> {
  await collection().updateOne(
    { slug: p.slug, ownerUserId: null },
    {
      $set: {
        name: p.name, muscleGroup: p.muscleGroup, equipmentType: p.equipmentType,
        defaultIncrement: p.defaultIncrement, videoUrl: p.videoUrl, isCustom: false,
      },
      $setOnInsert: { slug: p.slug, ownerUserId: null },
    },
    { upsert: true },
  );
}

export async function createCustom(ownerUserId: string, input: CreateExerciseInput): Promise<Exercise> {
  const doc = {
    slug: slugify(input.name.en),
    name: input.name,
    muscleGroup: input.muscleGroup,
    equipmentType: input.equipmentType,
    defaultIncrement: input.defaultIncrement ?? DEFAULT_INCREMENT,
    videoUrl: input.videoUrl,
    isCustom: true,
    ownerUserId,
  };
  try {
    const res = await collection().insertOne(doc);
    return toExercise({ _id: res.insertedId, ...doc } as WithId<Document>);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ExerciseConflictError();
    throw err;
  }
}

export async function listVisible(
  userId: string,
  filter: { muscleGroup?: MuscleGroup; q?: string },
): Promise<Exercise[]> {
  const query: Record<string, unknown> = { $or: [{ isCustom: false }, { ownerUserId: userId }] };
  if (filter.muscleGroup) query.muscleGroup = filter.muscleGroup;
  if (filter.q && filter.q.trim()) {
    const rx = new RegExp(filter.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = [{ $or: [{ 'name.en': rx }, { 'name.vi': rx }] }];
  }
  const docs = await collection().find(query).sort({ 'name.en': 1 }).toArray();
  return docs.map(toExercise);
}

export async function findById(id: string): Promise<Exercise | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  return doc ? toExercise(doc) : null;
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/exercise/exercise.repo.test.ts`  (5 tests)

- [ ] **Step 6: Commit** — author **Thanh Minh**

```bash
git add apps/api/src/modules/exercise/slugify.ts apps/api/src/modules/exercise/exercise.repo.ts apps/api/src/modules/exercise/exercise.repo.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add ExerciseRepository with visibility rules and slugify"
```

---

### Task 3: Seed ~50 preset exercises — [Ngọc Danh]

**Files:**
- Create: `apps/api/src/modules/exercise/seed-exercises.ts`
- Test: `apps/api/src/modules/exercise/seed-exercises.test.ts`

**Interfaces:**
- Consumes: `upsertPreset`/`ensureExerciseIndexes` (Task 2), `MuscleGroup`/`EquipmentType` from shared.
- Produces: `PRESET_EXERCISES: PresetSeed[]` (the array below) and `seedPresets(): Promise<number>` — calls `upsertPreset` for each, returns the count seeded.

- [ ] **Step 1: Failing test — `seed-exercises.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { ensureExerciseIndexes, listVisible } from './exercise.repo';
import { PRESET_EXERCISES, seedPresets } from './seed-exercises';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_seed_test');
  await ensureExerciseIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('seedPresets', () => {
  it('has at least 50 presets with unique slugs and en/vi names', () => {
    expect(PRESET_EXERCISES.length).toBeGreaterThanOrEqual(50);
    const slugs = new Set(PRESET_EXERCISES.map((p) => p.slug));
    expect(slugs.size).toBe(PRESET_EXERCISES.length);
    for (const p of PRESET_EXERCISES) {
      expect(p.name.en.length).toBeGreaterThan(0);
      expect(p.name.vi.length).toBeGreaterThan(0);
    }
  });
  it('is idempotent — seeding twice yields one row per slug', async () => {
    await seedPresets();
    await seedPresets();
    const all = await listVisible('anyone', {});
    expect(all.length).toBe(PRESET_EXERCISES.length);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/exercise/seed-exercises.test.ts`

- [ ] **Step 3: Implement `seed-exercises.ts`** — use this EXACT data (52 presets)

```typescript
import { EquipmentType as EQ, MuscleGroup as MG } from '@gigaflow/shared';
import { upsertPreset, type PresetSeed } from './exercise.repo.js';

export const PRESET_EXERCISES: PresetSeed[] = [
  // Chest
  { slug: 'bench-barbell', name: { en: 'Bench press', vi: 'Đẩy ngực tạ đòn' }, muscleGroup: MG.CHEST, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'bench-incline-bb', name: { en: 'Incline barbell press', vi: 'Đẩy ngực trên tạ đòn' }, muscleGroup: MG.CHEST, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'bench-incline-db', name: { en: 'Incline dumbbell press', vi: 'Đẩy ngực trên tạ đơn' }, muscleGroup: MG.CHEST, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'bench-db', name: { en: 'Dumbbell bench press', vi: 'Đẩy ngực tạ đơn' }, muscleGroup: MG.CHEST, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'chest-fly-cable', name: { en: 'Cable chest fly', vi: 'Ép ngực cáp' }, muscleGroup: MG.CHEST, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'chest-fly-db', name: { en: 'Dumbbell fly', vi: 'Ép ngực tạ đơn' }, muscleGroup: MG.CHEST, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'chest-press-machine', name: { en: 'Chest press machine', vi: 'Máy đẩy ngực' }, muscleGroup: MG.CHEST, equipmentType: EQ.MACHINE, defaultIncrement: 5 },
  { slug: 'pushup', name: { en: 'Push-up', vi: 'Hít đất' }, muscleGroup: MG.CHEST, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'dip-chest', name: { en: 'Chest dip', vi: 'Xà nhúng ngực' }, muscleGroup: MG.CHEST, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  // Back
  { slug: 'pullup', name: { en: 'Pull-up', vi: 'Hít xà' }, muscleGroup: MG.BACK, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'chinup', name: { en: 'Chin-up', vi: 'Hít xà ngửa' }, muscleGroup: MG.BACK, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'row-barbell', name: { en: 'Barbell row', vi: 'Chèo tạ đòn' }, muscleGroup: MG.BACK, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'row-db', name: { en: 'Dumbbell row', vi: 'Chèo tạ đơn' }, muscleGroup: MG.BACK, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'row-tbar', name: { en: 'T-bar row', vi: 'Chèo T-bar' }, muscleGroup: MG.BACK, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'lat-pulldown', name: { en: 'Lat pulldown', vi: 'Kéo xô' }, muscleGroup: MG.BACK, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'seated-row-cable', name: { en: 'Seated cable row', vi: 'Chèo cáp ngồi' }, muscleGroup: MG.BACK, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'facepull', name: { en: 'Face pull', vi: 'Kéo cáp ngang mặt' }, muscleGroup: MG.BACK, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'deadlift', name: { en: 'Deadlift', vi: 'Kéo đất' }, muscleGroup: MG.BACK, equipmentType: EQ.BARBELL, defaultIncrement: 5 },
  { slug: 'pullover-db', name: { en: 'Dumbbell pullover', vi: 'Kéo tạ qua đầu' }, muscleGroup: MG.BACK, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  // Legs
  { slug: 'squat-barbell', name: { en: 'Barbell squat', vi: 'Squat tạ đòn' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'front-squat', name: { en: 'Front squat', vi: 'Squat trước' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'rdl', name: { en: 'Romanian deadlift', vi: 'Kéo đất kiểu Romania' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'leg-press', name: { en: 'Leg press', vi: 'Máy đạp chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 5 },
  { slug: 'leg-curl', name: { en: 'Leg curl', vi: 'Máy cuốn chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 2.5 },
  { slug: 'leg-extension', name: { en: 'Leg extension', vi: 'Máy duỗi chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 2.5 },
  { slug: 'lunge-db', name: { en: 'Dumbbell lunge', vi: 'Bước tấn tạ đơn' }, muscleGroup: MG.LEGS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'bulgarian-split', name: { en: 'Bulgarian split squat', vi: 'Squat chẻ Bulgaria' }, muscleGroup: MG.LEGS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'calf-raise', name: { en: 'Calf raise', vi: 'Nhón bắp chân' }, muscleGroup: MG.LEGS, equipmentType: EQ.MACHINE, defaultIncrement: 5 },
  { slug: 'hip-thrust', name: { en: 'Hip thrust', vi: 'Đẩy hông' }, muscleGroup: MG.LEGS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'goblet-squat', name: { en: 'Goblet squat', vi: 'Squat ôm tạ' }, muscleGroup: MG.LEGS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  // Shoulders
  { slug: 'ohp-barbell', name: { en: 'Overhead press', vi: 'Đẩy vai tạ đòn' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'ohp-db', name: { en: 'Dumbbell shoulder press', vi: 'Đẩy vai tạ đơn' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'lateral-raise', name: { en: 'Lateral raise', vi: 'Nâng tạ ngang vai' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'front-raise', name: { en: 'Front raise', vi: 'Nâng tạ trước vai' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'rear-delt-fly', name: { en: 'Rear delt fly', vi: 'Ép vai sau' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'upright-row', name: { en: 'Upright row', vi: 'Chèo đứng' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'shrug-db', name: { en: 'Dumbbell shrug', vi: 'Nhún vai tạ đơn' }, muscleGroup: MG.SHOULDERS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  // Arms
  { slug: 'curl-barbell', name: { en: 'Barbell curl', vi: 'Cuốn tạ đòn' }, muscleGroup: MG.ARMS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'curl-db', name: { en: 'Dumbbell curl', vi: 'Cuốn tạ đơn' }, muscleGroup: MG.ARMS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'curl-hammer', name: { en: 'Hammer curl', vi: 'Cuốn tạ búa' }, muscleGroup: MG.ARMS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'curl-preacher', name: { en: 'Preacher curl', vi: 'Cuốn tạ ghế dốc' }, muscleGroup: MG.ARMS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'tricep-pushdown', name: { en: 'Tricep pushdown', vi: 'Đẩy cáp tay sau' }, muscleGroup: MG.ARMS, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'tricep-overhead', name: { en: 'Overhead tricep extension', vi: 'Duỗi tay sau qua đầu' }, muscleGroup: MG.ARMS, equipmentType: EQ.DUMBBELL, defaultIncrement: 2 },
  { slug: 'skull-crusher', name: { en: 'Skull crusher', vi: 'Đập trán' }, muscleGroup: MG.ARMS, equipmentType: EQ.BARBELL, defaultIncrement: 2.5 },
  { slug: 'dip-tricep', name: { en: 'Tricep dip', vi: 'Xà nhúng tay sau' }, muscleGroup: MG.ARMS, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  // Core
  { slug: 'plank', name: { en: 'Plank', vi: 'Plank' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'crunch-cable', name: { en: 'Cable crunch', vi: 'Gập bụng cáp' }, muscleGroup: MG.CORE, equipmentType: EQ.CABLE, defaultIncrement: 2.5 },
  { slug: 'ab-wheel', name: { en: 'Ab wheel rollout', vi: 'Con lăn bụng' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'hanging-leg-raise', name: { en: 'Hanging leg raise', vi: 'Nâng chân treo xà' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  { slug: 'russian-twist', name: { en: 'Russian twist', vi: 'Xoay bụng Nga' }, muscleGroup: MG.CORE, equipmentType: EQ.BODYWEIGHT, defaultIncrement: 0 },
  // Cardio
  { slug: 'treadmill', name: { en: 'Treadmill run', vi: 'Chạy máy' }, muscleGroup: MG.CARDIO, equipmentType: EQ.MACHINE, defaultIncrement: 0 },
  { slug: 'rowing-erg', name: { en: 'Rowing machine', vi: 'Máy chèo' }, muscleGroup: MG.CARDIO, equipmentType: EQ.MACHINE, defaultIncrement: 0 },
];

export async function seedPresets(): Promise<number> {
  for (const p of PRESET_EXERCISES) {
    await upsertPreset(p);
  }
  return PRESET_EXERCISES.length;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/exercise/seed-exercises.test.ts`  (2 tests)

- [ ] **Step 5: Commit** — author **Ngọc Danh**

```bash
git add apps/api/src/modules/exercise/seed-exercises.ts apps/api/src/modules/exercise/seed-exercises.test.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): seed ~50 preset exercises (idempotent)"
```

---

### Task 4: Exercise routes (GET list + POST custom) + wire app + startup seed — [Ngọc Danh]

**Files:**
- Create: `apps/api/src/modules/exercise/exercise.routes.ts`
- Test: `apps/api/src/modules/exercise/exercise.routes.test.ts`
- Modify: `apps/api/src/app.ts` (mount `/exercises`)
- Modify: `apps/api/src/index.ts` (ensure exercise indexes + seed presets on startup)

**Interfaces:**
- Consumes: `firebaseAuth`/`TokenVerifier` (E2), `firebaseVerifier` (E2), `listVisible`/`createCustom`/`ExerciseConflictError` (Task 2), `zCreateExerciseInput`/`MuscleGroup` (shared), `apiSuccess`/`errorBody`, `@hono/zod-validator`.
- Produces: `makeExerciseRoutes(deps: { verify: TokenVerifier }): Hono` with `firebaseAuth` applied and:
  - `GET /` → `listVisible(user.authId, { muscleGroup?: query 'muscleGroup', q?: query 'q' })` → `apiSuccess(list)`. Invalid `muscleGroup` value → ignore it (treat as no filter) — do not 400.
  - `POST /` → validate body with `zCreateExerciseInput`; `createCustom(user.authId, body)` → 201 `apiSuccess(exercise)`; on `ExerciseConflictError` → 409 `errorBody('Exercise already exists')`.
- App mounts at `/exercises` with the real `firebaseVerifier` → live paths `/api/exercises`.

- [ ] **Step 1: Install validator (if not present)**

Run: `pnpm --filter @gigaflow/api add @hono/zod-validator`
Expected: dependency added (zod peer already present transitively via shared; if the type needs `zod` directly, also `pnpm --filter @gigaflow/api add zod@^3.23.8`).

- [ ] **Step 2: Failing test — `exercise.routes.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { ensureExerciseIndexes } from './exercise.repo';
import { seedPresets } from './seed-exercises';
import { makeExerciseRoutes } from './exercise.routes';
import type { TokenVerifier } from '../auth/firebase-auth';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_exroutes_test');
  await ensureExerciseIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) =>
  t === 'u1' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad'));

const H = { Authorization: 'Bearer u1' };

describe('exercise routes', () => {
  it('401 without token', async () => {
    const res = await makeExerciseRoutes({ verify }).request('/');
    expect(res.status).toBe(401);
  });
  it('GET / lists presets for an authed (guest) user', async () => {
    const res = await makeExerciseRoutes({ verify }).request('/', { headers: H });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    expect(body.data.length).toBeGreaterThanOrEqual(50);
  });
  it('POST / creates a custom exercise (201) then GET includes it', async () => {
    const app = makeExerciseRoutes({ verify });
    const create = await app.request('/', {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: { en: 'My Row', vi: 'Chèo của tôi' }, muscleGroup: 'back', equipmentType: 'dumbbell' }),
    });
    expect(create.status).toBe(201);
    const listed = await app.request('/?muscleGroup=back', { headers: H });
    const body = (await listed.json()) as { data: Array<{ slug: string }> };
    expect(body.data.some((e) => e.slug === 'my-row')).toBe(true);
  });
  it('POST / duplicate custom slug → 409', async () => {
    const app = makeExerciseRoutes({ verify });
    const mk = () => app.request('/', {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: { en: 'Dup Ex', vi: 'Trùng' }, muscleGroup: 'arms', equipmentType: 'dumbbell' }),
    });
    await mk();
    const res = await mk();
    expect(res.status).toBe(409);
  });
  it('POST / invalid body → 400', async () => {
    const res = await makeExerciseRoutes({ verify }).request('/', {
      method: 'POST', headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: { en: 'x' } }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Implement `exercise.routes.ts`**

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, zCreateExerciseInput, MuscleGroup } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { listVisible, createCustom, ExerciseConflictError } from './exercise.repo.js';

function parseMuscleGroup(v: string | undefined): MuscleGroup | undefined {
  return v && (Object.values(MuscleGroup) as string[]).includes(v) ? (v as MuscleGroup) : undefined;
}

export function makeExerciseRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.get('/', async (c) => {
    const user = c.get('user');
    const list = await listVisible(user.authId, {
      muscleGroup: parseMuscleGroup(c.req.query('muscleGroup')),
      q: c.req.query('q'),
    });
    return c.json(apiSuccess(list));
  });

  app.post('/', zValidator('json', zCreateExerciseInput), async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const created = await createCustom(user.authId, input);
      return c.json(apiSuccess(created), 201);
    } catch (err) {
      if (err instanceof ExerciseConflictError) return c.json(errorBody('Exercise already exists'), 409);
      throw err;
    }
  });

  return app;
}
```

> Note: `zValidator('json', …)` returns a 400 with its own body on invalid input. That is acceptable here (the test only asserts status 400). Envelope-shape consistency for validation errors is a cross-cutting concern deferred to E14.

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/exercise/exercise.routes.test.ts`  (5 tests)

- [ ] **Step 5: Mount in `apps/api/src/app.ts`**

Add imports + mount BEFORE `notFound`:

```typescript
import { makeExerciseRoutes } from './modules/exercise/exercise.routes.js';
// inside createApp(), after the /auth route:
app.route('/exercises', makeExerciseRoutes({ verify: firebaseVerifier }));
```

- [ ] **Step 6: Seed + index on startup — modify `apps/api/src/index.ts`**

Inside the `if (uri)` block, after the user-index ensure, add:

```typescript
    const { ensureExerciseIndexes } = await import('./modules/exercise/exercise.repo.js');
    const { seedPresets } = await import('./modules/exercise/seed-exercises.js');
    await ensureExerciseIndexes();
    await seedPresets();
```

- [ ] **Step 7: Verify whole suite + typecheck + build**

Run: `pnpm typecheck && pnpm build && pnpm test`
Expected: typecheck clean; build green; all tests pass — shared 13; api = prior 21 + exercise (repo 5 + seed 2 + routes 5 = 12) = 33; total 46.

- [ ] **Step 8: Commit** — author **Ngọc Danh**

```bash
git add apps/api/src/modules/exercise/exercise.routes.ts apps/api/src/modules/exercise/exercise.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts apps/api/package.json pnpm-lock.yaml
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add GET/POST /exercises and seed catalog on startup"
```

---

### Task 5: Docs — README endpoints + roadmap — [Ngọc Danh]

**Files:**
- Modify: `README.md`

**Interfaces:** docs only.

- [ ] **Step 1: Read `README.md`, then update**

- Status line: note E3 (exercise catalog backend) complete.
- API Endpoints: add an **Exercises** subsection —
  - `GET /api/exercises?muscleGroup=&q=` — list preset + your own custom exercises (auth required; guests included).
  - `POST /api/exercises` — create a custom exercise (auth required; body `{ name:{en,vi}, muscleGroup, equipmentType, defaultIncrement?, videoUrl? }`); 201 on success, 409 on duplicate.
- Roadmap: mark E3 Exercise Catalog ✅ (backend); note E3-S4 Exercise library UI deferred to the web app (E13).

- [ ] **Step 2: Commit** — author **Ngọc Danh**

```bash
git add README.md
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "docs: document exercise catalog endpoints and roadmap"
```

---

## Self-Review

**1. Spec coverage (Epic E3 backend):** E3-S1 schema+repo → Tasks 1–2 ✅; E3-S2 seed ~50 → Task 3 (52 presets) ✅; E3-S3 custom exercise (guest creates immediately, owner-scoped visibility) → Tasks 2 (`createCustom`/`listVisible`) + 4 (routes) ✅; E3-S4 library UI → deferred (Scope) ✅. Guest-can-create is satisfied because `firebaseAuth` admits anonymous users and `createCustom` uses `user.authId` as owner.

**2. Placeholder scan:** no vague steps; the seed is concrete (52 items inline); every code step has full code. `zValidator` 400 envelope-shape noted as a deferred E14 concern (explicit, not a hidden gap).

**3. Type consistency:** `Exercise`/`CreateExerciseInput`/`MuscleGroup`/`EquipmentType` defined in Task 1, consumed by repo (Task 2), seed (Task 3), routes (Task 4). `PresetSeed`/`upsertPreset`/`ExerciseConflictError`/`listVisible`/`createCustom` defined in Task 2, consumed by Tasks 3–4. `toExercise` maps `_id`→`id` consistently. `.js` ESM extensions throughout. Route `user.authId` matches the `User` field from E2.

**Assignees:** T1–T2 Thanh Minh; T3–T5 Ngọc Danh (per sprint board GIGA-34 Thanh Minh S1, GIGA-35/38 Ngọc Danh; docs folded to Ngọc Danh who owns the visible catalog work). Commit authors set per task.
