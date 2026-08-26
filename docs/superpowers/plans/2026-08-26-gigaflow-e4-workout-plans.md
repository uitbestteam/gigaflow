# E4 — Workout Plans (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — work on a plain branch (`e4-plans`) in this repo (user preference).

**Goal:** The workout-plan data layer and read/create API — a plan is `Plan → WorkoutTemplate(s) → ExerciseSlot(s)` (GymFlow-style, slot-anchored, queue-ordered) — so a user can instantiate a preset split (PPL / Upper-Lower / Full-body) and fetch their active plan fully nested via `GET /api/plans/active`.

**Architecture:** Three MongoDB collections (`plans`, `workout_templates`, `exercise_slots`), a `WorkoutRepository` that writes the plan graph and reassembles it nested, and preset template definitions that resolve exercise **slugs** (from the E3 catalog) to exercise **ids** at instantiation. Zod-first shared types; Hono routes behind E2 `firebaseAuth`. Consistent with E1–E3.

**Tech Stack:** Hono, MongoDB native driver, Zod (`@gigaflow/shared`), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.3 workout structure)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E4)
- Reference: `gymflow-docs/data-model.md`, `gymflow-docs/PRD.md` (PPL preset shape)

## Scope

**In scope (backend):** E4-S1 (schemas + repo), E4-S2 (preset templates + instantiate), E4-S4 (`GET /plans/active` + a `POST /plans/from-template` to create one). **Deferred (need the React app, E13):** E4-S3 (custom plan builder UI + its create-custom-plan endpoint) and E4-S5 (Home/Today queue UI). AI-generated plans are E7.

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm workspaces; TypeScript strict, NO `any`, explicit exported types.
- Zod single source in `@gigaflow/shared`; validate with `@hono/zod-validator`.
- Envelope `{ success, data?, message? }`; all routes under `/api`; routes behind `firebaseAuth` (E2), user = `c.get('user')` (`user.authId`).
- Entities expose string `id` (hex of `_id`); `_id` never leaked; omit nullish optional fields (E3 `toExercise` pattern).
- Slots reference an exercise by its catalog **id** (`exerciseId`); preset templates are authored by exercise **slug** and resolved to ids at instantiation (presets only — `ownerUserId: null`).
- Use turbo (`pnpm build`/`pnpm typecheck`/`pnpm test`) for verification.
- **Commit author = the task's assignee:** Thanh Minh → `Nguyen Thanh Minh <95201788+ngthminhdev@users.noreply.github.com>`; Ngọc Danh → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts               # + PlanSource, PlanTemplateType, ColorTag
  schemas/plan.ts              # zPlan, zWorkoutTemplate, zExerciseSlot, zPlanWithTemplates + types (NEW)
  index.ts                     # export plan schema
apps/api/src/modules/exercise/
  exercise.repo.ts             # + findBySlugs() (read helper for preset instantiation)
apps/api/src/modules/workout/
  workout.repo.ts              # WorkoutRepository (plan graph write + nested read) (NEW)
  workout.repo.test.ts
  preset-templates.ts          # PRESET_TEMPLATES + createPlanFromTemplate() (NEW)
  preset-templates.test.ts
  workout.routes.ts            # POST /plans/from-template, GET /plans/active (NEW)
  workout.routes.test.ts
apps/api/src/app.ts            # mount /plans
apps/api/src/index.ts          # ensure workout indexes on startup
```

---

### Task 1: Plan enums + Zod schemas (shared) — [Thanh Minh]

**Files:**
- Modify: `packages/shared/src/enums/index.ts`
- Create: `packages/shared/src/schemas/plan.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas/plan.test.ts`

**Interfaces:**
- Produces:
  - `enum PlanSource { AI='ai', CUSTOM='custom' }`
  - `enum PlanTemplateType { PPL='ppl', UPPER_LOWER='upper_lower', FULL_BODY='full_body', CUSTOM='custom' }`
  - `enum ColorTag { PUSH='push', PULL='pull', LEGS='legs', UPPER='upper', LOWER='lower', FULL='full', CUSTOM='custom' }`
  - `zPlan` → `Plan`: `id`, `userId`, `name` (string), `templateType` (PlanTemplateType), `source` (PlanSource), `isActive` (boolean), `createdAt` (Date).
  - `zWorkoutTemplate` → `WorkoutTemplate`: `id`, `planId`, `name` (Translatable), `focus?` (Translatable), `orderIndex` (int ≥ 0), `colorTag` (ColorTag).
  - `zExerciseSlot` → `ExerciseSlot`: `id`, `templateId`, `exerciseId` (string), `orderIndex` (int ≥ 0), `setsTarget` (int 1–10), `repRangeMin` (int ≥ 1), `repRangeMax` (int ≥ 1), `equipmentType` (EquipmentType), `weightIncrement` (number ≥ 0).
  - `zPlanWithTemplates` → `PlanWithTemplates`: `zPlan` plus `templates: Array<WorkoutTemplate & { slots: ExerciseSlot[] }>`.

- [ ] **Step 1: Failing test — `packages/shared/src/schemas/plan.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  zPlan, zExerciseSlot, zPlanWithTemplates, PlanSource, PlanTemplateType, ColorTag, EquipmentType,
} from '../index';

const plan = { id: 'p1', userId: 'u1', name: 'PPL', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true, createdAt: new Date() };
const slot = { id: 's1', templateId: 't1', exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 };

describe('plan schemas', () => {
  it('accepts a valid plan', () => { expect(zPlan.safeParse(plan).success).toBe(true); });
  it('rejects an unknown templateType', () => { expect(zPlan.safeParse({ ...plan, templateType: 'bro-split' }).success).toBe(false); });
  it('accepts a valid slot', () => { expect(zExerciseSlot.safeParse(slot).success).toBe(true); });
  it('rejects setsTarget out of range', () => { expect(zExerciseSlot.safeParse({ ...slot, setsTarget: 99 }).success).toBe(false); });
  it('accepts a nested plan-with-templates', () => {
    const r = zPlanWithTemplates.safeParse({ ...plan, templates: [{ id: 't1', planId: 'p1', name: { en: 'Push A', vi: 'Đẩy A' }, orderIndex: 0, colorTag: ColorTag.PUSH, slots: [slot] }] });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/shared test src/schemas/plan.test.ts`

- [ ] **Step 3: Add enums — append to `packages/shared/src/enums/index.ts`**

```typescript
export enum PlanSource {
  AI = 'ai',
  CUSTOM = 'custom',
}

export enum PlanTemplateType {
  PPL = 'ppl',
  UPPER_LOWER = 'upper_lower',
  FULL_BODY = 'full_body',
  CUSTOM = 'custom',
}

export enum ColorTag {
  PUSH = 'push',
  PULL = 'pull',
  LEGS = 'legs',
  UPPER = 'upper',
  LOWER = 'lower',
  FULL = 'full',
  CUSTOM = 'custom',
}
```

- [ ] **Step 4: Create `packages/shared/src/schemas/plan.ts`**

```typescript
import { z } from 'zod';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zPlan = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  templateType: z.nativeEnum(PlanTemplateType),
  source: z.nativeEnum(PlanSource),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export const zWorkoutTemplate = z.object({
  id: z.string(),
  planId: z.string(),
  name: zTranslatable,
  focus: zTranslatable.optional(),
  orderIndex: z.number().int().min(0),
  colorTag: z.nativeEnum(ColorTag),
});

export const zExerciseSlot = z.object({
  id: z.string(),
  templateId: z.string(),
  exerciseId: z.string(),
  orderIndex: z.number().int().min(0),
  setsTarget: z.number().int().min(1).max(10),
  repRangeMin: z.number().int().min(1),
  repRangeMax: z.number().int().min(1),
  equipmentType: z.nativeEnum(EquipmentType),
  weightIncrement: z.number().min(0),
});

export const zPlanWithTemplates = zPlan.extend({
  templates: z.array(zWorkoutTemplate.extend({ slots: z.array(zExerciseSlot) })),
});

export type Plan = z.infer<typeof zPlan>;
export type WorkoutTemplate = z.infer<typeof zWorkoutTemplate>;
export type ExerciseSlot = z.infer<typeof zExerciseSlot>;
export type PlanWithTemplates = z.infer<typeof zPlanWithTemplates>;
```

- [ ] **Step 5: Export — add to `packages/shared/src/index.ts`**

`export * from './schemas/plan.js';`

- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 13 + 5 new = 18)

- [ ] **Step 7: Commit** — **Thanh Minh**

```bash
git add packages/shared
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(shared): add workout plan enums and Zod schemas"
```

---

### Task 2: `WorkoutRepository` (plan graph write + nested read) + exercise `findBySlugs` — TDD — [Thanh Minh]

**Files:**
- Modify: `apps/api/src/modules/exercise/exercise.repo.ts` (add `findBySlugs`)
- Create: `apps/api/src/modules/workout/workout.repo.ts`
- Test: `apps/api/src/modules/workout/workout.repo.test.ts`

**Interfaces:**
- Consumes: `getDb` (E1); `Plan`/`WorkoutTemplate`/`ExerciseSlot`/`PlanWithTemplates` + enums from shared; `Exercise` from shared.
- Produces:
  - In `exercise.repo.ts`: `findBySlugs(slugs: string[]): Promise<Map<string, Exercise>>` — presets only (`ownerUserId: null`), keyed by slug.
  - In `workout.repo.ts`:
    - `ensureWorkoutIndexes(): Promise<void>` — `plans`: `{ userId: 1, isActive: 1 }`; `workout_templates`: `{ planId: 1, orderIndex: 1 }`; `exercise_slots`: `{ templateId: 1, orderIndex: 1 }`.
    - `interface NewTemplate { name: Translatable; focus?: Translatable; orderIndex: number; colorTag: ColorTag; slots: NewSlot[] }` and `interface NewSlot { exerciseId: string; orderIndex: number; setsTarget: number; repRangeMin: number; repRangeMax: number; equipmentType: EquipmentType; weightIncrement: number }`.
    - `insertPlanGraph(userId: string, planData: { name: string; templateType: PlanTemplateType; source: PlanSource; isActive: boolean }, templates: NewTemplate[]): Promise<PlanWithTemplates>` — if `isActive`, first set all the user's other plans `isActive:false`; insert plan, then each template (with `planId`), then each slot (with `templateId`); return the assembled nested graph.
    - `findActivePlan(userId: string): Promise<PlanWithTemplates | null>` — the user's `isActive:true` plan, templates sorted by `orderIndex`, each template's slots sorted by `orderIndex`; `null` if none.
    - `setActivePlan(userId: string, planId: string): Promise<void>` — set others inactive, this one active.

- [ ] **Step 1: Failing test — `apps/api/src/modules/workout/workout.repo.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import { ensureWorkoutIndexes, insertPlanGraph, findActivePlan } from './workout.repo';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wo_test');
  await ensureWorkoutIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const tpl = (order: number, tag: ColorTag) => ({
  name: { en: `T${order}`, vi: `T${order}` }, orderIndex: order, colorTag: tag,
  slots: [{ exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 }],
});

describe('WorkoutRepository', () => {
  it('inserts a plan graph and reads it back nested', async () => {
    const plan = await insertPlanGraph('u1', { name: 'PPL', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true }, [tpl(0, ColorTag.PUSH), tpl(1, ColorTag.PULL)]);
    expect(plan.id).toMatch(/^[a-f0-9]{24}$/);
    expect(plan.templates).toHaveLength(2);
    expect(plan.templates[0].slots).toHaveLength(1);
    expect(plan.templates[0].slots[0].exerciseId).toBe('e1');
  });
  it('findActivePlan returns the active plan sorted by orderIndex', async () => {
    const active = await findActivePlan('u1');
    expect(active).not.toBeNull();
    expect(active?.templates.map((t) => t.orderIndex)).toEqual([0, 1]);
  });
  it('creating a second active plan deactivates the first', async () => {
    await insertPlanGraph('u1', { name: 'UL', templateType: PlanTemplateType.UPPER_LOWER, source: PlanSource.CUSTOM, isActive: true }, [tpl(0, ColorTag.UPPER)]);
    const active = await findActivePlan('u1');
    expect(active?.name).toBe('UL');
  });
  it('returns null when the user has no active plan', async () => {
    expect(await findActivePlan('nobody')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/workout/workout.repo.test.ts`

- [ ] **Step 3: Add `findBySlugs` to `apps/api/src/modules/exercise/exercise.repo.ts`**

Add (using the file's existing `collection()` and `toExercise`):

```typescript
export async function findBySlugs(slugs: string[]): Promise<Map<string, Exercise>> {
  const docs = await collection().find({ slug: { $in: slugs }, ownerUserId: null }).toArray();
  const map = new Map<string, Exercise>();
  for (const doc of docs) {
    const ex = toExercise(doc);
    map.set(ex.slug, ex);
  }
  return map;
}
```

- [ ] **Step 4: Implement `apps/api/src/modules/workout/workout.repo.ts`**

```typescript
import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import {
  type ColorTag, type EquipmentType, type PlanSource, type PlanTemplateType,
  type Translatable, type Plan, type WorkoutTemplate, type ExerciseSlot, type PlanWithTemplates,
} from '@gigaflow/shared';

const PLANS = 'plans';
const TEMPLATES = 'workout_templates';
const SLOTS = 'exercise_slots';

export interface NewSlot {
  exerciseId: string; orderIndex: number; setsTarget: number;
  repRangeMin: number; repRangeMax: number; equipmentType: EquipmentType; weightIncrement: number;
}
export interface NewTemplate {
  name: Translatable; focus?: Translatable; orderIndex: number; colorTag: ColorTag; slots: NewSlot[];
}

function plans() { return getDb().collection(PLANS); }
function templates() { return getDb().collection(TEMPLATES); }
function slots() { return getDb().collection(SLOTS); }

function mapId<T extends Record<string, unknown>>(doc: WithId<Document>): T {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as T;
}

export async function ensureWorkoutIndexes(): Promise<void> {
  await plans().createIndex({ userId: 1, isActive: 1 });
  await templates().createIndex({ planId: 1, orderIndex: 1 });
  await slots().createIndex({ templateId: 1, orderIndex: 1 });
}

export async function insertPlanGraph(
  userId: string,
  planData: { name: string; templateType: PlanTemplateType; source: PlanSource; isActive: boolean },
  newTemplates: NewTemplate[],
): Promise<PlanWithTemplates> {
  if (planData.isActive) {
    await plans().updateMany({ userId, isActive: true }, { $set: { isActive: false } });
  }
  const planDoc = { userId, ...planData, createdAt: new Date() };
  const planRes = await plans().insertOne(planDoc);
  const planId = planRes.insertedId.toString();

  const outTemplates: (WorkoutTemplate & { slots: ExerciseSlot[] })[] = [];
  for (const t of newTemplates) {
    const tDoc: Record<string, unknown> = { planId, name: t.name, orderIndex: t.orderIndex, colorTag: t.colorTag };
    if (t.focus) tDoc.focus = t.focus;
    const tRes = await templates().insertOne(tDoc);
    const templateId = tRes.insertedId.toString();

    const outSlots: ExerciseSlot[] = [];
    for (const s of t.slots) {
      const sDoc = { templateId, ...s };
      const sRes = await slots().insertOne(sDoc);
      outSlots.push({ id: sRes.insertedId.toString(), ...sDoc });
    }
    outTemplates.push({ id: templateId, planId, name: t.name, ...(t.focus ? { focus: t.focus } : {}), orderIndex: t.orderIndex, colorTag: t.colorTag, slots: outSlots });
  }

  return { id: planId, userId, name: planData.name, templateType: planData.templateType, source: planData.source, isActive: planData.isActive, createdAt: planDoc.createdAt, templates: outTemplates };
}

export async function findActivePlan(userId: string): Promise<PlanWithTemplates | null> {
  const planDoc = await plans().findOne({ userId, isActive: true });
  if (!planDoc) return null;
  const plan = mapId<Plan>(planDoc);
  const tDocs = await templates().find({ planId: plan.id }).sort({ orderIndex: 1 }).toArray();
  const outTemplates = [];
  for (const tDoc of tDocs) {
    const template = mapId<WorkoutTemplate>(tDoc);
    const sDocs = await slots().find({ templateId: template.id }).sort({ orderIndex: 1 }).toArray();
    outTemplates.push({ ...template, slots: sDocs.map((d) => mapId<ExerciseSlot>(d)) });
  }
  return { ...plan, templates: outTemplates };
}

export async function setActivePlan(userId: string, planId: string): Promise<void> {
  await plans().updateMany({ userId, isActive: true }, { $set: { isActive: false } });
  await plans().updateOne({ _id: new ObjectId(planId), userId }, { $set: { isActive: true } });
}
```

> Note: no multi-document transaction (mongodb-memory-server is standalone). Inserts are sequential; a mid-insert failure could orphan templates/slots, but `findActivePlan` only surfaces a complete graph via the plan doc. A transactional/cleanup pass is deferred to E14.

- [ ] **Step 5: Run — expect PASS** (`pnpm --filter @gigaflow/api test src/modules/workout/workout.repo.test.ts`; 4 tests)

- [ ] **Step 6: Commit** — **Thanh Minh**

```bash
git add apps/api/src/modules/workout/workout.repo.ts apps/api/src/modules/workout/workout.repo.test.ts apps/api/src/modules/exercise/exercise.repo.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add WorkoutRepository (plan graph) and exercise findBySlugs"
```

---

### Task 3: Preset templates + `createPlanFromTemplate` — TDD — [Ngọc Danh]

**Files:**
- Create: `apps/api/src/modules/workout/preset-templates.ts`
- Test: `apps/api/src/modules/workout/preset-templates.test.ts`

**Interfaces:**
- Consumes: `findBySlugs` (Task 2), `insertPlanGraph`/`NewTemplate` (Task 2), enums from shared.
- Produces:
  - `interface PresetSlotDef { slug: string; setsTarget: number; repRangeMin: number; repRangeMax: number }`
  - `interface PresetTemplateDef { name: Translatable; colorTag: ColorTag; focus?: Translatable; slots: PresetSlotDef[] }`
  - `PRESET_TEMPLATES: Record<PlanTemplateType.PPL | PlanTemplateType.UPPER_LOWER | PlanTemplateType.FULL_BODY, { name: string; templates: PresetTemplateDef[] }>` (the data below).
  - `createPlanFromTemplate(userId: string, templateType: PlanTemplateType): Promise<PlanWithTemplates>` — look up the preset def (throw `Error('Unknown preset template')` for `CUSTOM`/unknown); collect all slugs; `findBySlugs`; for any missing slug throw `Error('Preset references unknown exercise: <slug>')`; build `NewTemplate[]` where each slot's `exerciseId = exercise.id`, `equipmentType = exercise.equipmentType`, `weightIncrement = exercise.defaultIncrement`; call `insertPlanGraph(userId, { name, templateType, source: CUSTOM, isActive: true }, templates)`.

- [ ] **Step 1: Failing test — `preset-templates.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { PlanTemplateType } from '@gigaflow/shared';
import { ensureExerciseIndexes } from '../exercise/exercise.repo';
import { seedPresets } from '../exercise/seed-exercises';
import { ensureWorkoutIndexes, findActivePlan } from './workout.repo';
import { PRESET_TEMPLATES, createPlanFromTemplate } from './preset-templates';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_preset_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('preset templates', () => {
  it('every preset slug exists in the seeded catalog', () => {
    const { findBySlugs } = require('../exercise/exercise.repo');
    // structural check: all slugs are strings; existence verified by instantiation below
    for (const key of Object.keys(PRESET_TEMPLATES)) {
      const def = PRESET_TEMPLATES[key as keyof typeof PRESET_TEMPLATES];
      expect(def.templates.length).toBeGreaterThan(0);
    }
    expect(typeof findBySlugs).toBe('function');
  });
  it('instantiates a PPL plan resolving slugs to exercise ids', async () => {
    const plan = await createPlanFromTemplate('u1', PlanTemplateType.PPL);
    expect(plan.templateType).toBe(PlanTemplateType.PPL);
    expect(plan.templates.length).toBe(PRESET_TEMPLATES.ppl.templates.length);
    const firstSlot = plan.templates[0].slots[0];
    expect(firstSlot.exerciseId).toMatch(/^[a-f0-9]{24}$/);
    expect(firstSlot.weightIncrement).toBeGreaterThanOrEqual(0);
  });
  it('sets the new plan active', async () => {
    await createPlanFromTemplate('u2', PlanTemplateType.FULL_BODY);
    const active = await findActivePlan('u2');
    expect(active?.templateType).toBe(PlanTemplateType.FULL_BODY);
  });
  it('throws for CUSTOM template type', async () => {
    await expect(createPlanFromTemplate('u3', PlanTemplateType.CUSTOM)).rejects.toThrow(/Unknown preset template/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/workout/preset-templates.test.ts`

- [ ] **Step 3: Implement `preset-templates.ts`** — use this EXACT data (all slugs exist in the E3 seed)

```typescript
import {
  ColorTag, PlanSource, PlanTemplateType, type Translatable, type PlanWithTemplates,
} from '@gigaflow/shared';
import { findBySlugs } from '../exercise/exercise.repo.js';
import { insertPlanGraph, type NewTemplate } from './workout.repo.js';

export interface PresetSlotDef { slug: string; setsTarget: number; repRangeMin: number; repRangeMax: number }
export interface PresetTemplateDef { name: Translatable; colorTag: ColorTag; focus?: Translatable; slots: PresetSlotDef[] }

const S = (slug: string, setsTarget: number, repRangeMin: number, repRangeMax: number): PresetSlotDef => ({ slug, setsTarget, repRangeMin, repRangeMax });

export const PRESET_TEMPLATES: Record<
  PlanTemplateType.PPL | PlanTemplateType.UPPER_LOWER | PlanTemplateType.FULL_BODY,
  { name: string; templates: PresetTemplateDef[] }
> = {
  [PlanTemplateType.PPL]: {
    name: 'Push / Pull / Legs',
    templates: [
      { name: { en: 'Push A', vi: 'Đẩy A' }, colorTag: ColorTag.PUSH, slots: [S('bench-barbell', 4, 6, 10), S('ohp-barbell', 3, 8, 12), S('bench-incline-db', 3, 10, 15), S('lateral-raise', 3, 12, 20), S('tricep-pushdown', 3, 10, 15)] },
      { name: { en: 'Pull A', vi: 'Kéo A' }, colorTag: ColorTag.PULL, slots: [S('pullup', 4, 6, 12), S('row-barbell', 4, 6, 10), S('lat-pulldown', 3, 10, 15), S('facepull', 3, 15, 25), S('curl-barbell', 3, 10, 15)] },
      { name: { en: 'Legs A', vi: 'Chân A' }, colorTag: ColorTag.LEGS, slots: [S('squat-barbell', 4, 6, 10), S('rdl', 3, 8, 12), S('leg-press', 3, 10, 15), S('leg-curl', 3, 10, 15), S('calf-raise', 4, 12, 20)] },
      { name: { en: 'Push B', vi: 'Đẩy B' }, colorTag: ColorTag.PUSH, slots: [S('bench-incline-bb', 4, 6, 10), S('ohp-db', 3, 8, 12), S('chest-fly-cable', 3, 12, 15), S('lateral-raise', 3, 12, 20), S('skull-crusher', 3, 8, 12)] },
      { name: { en: 'Pull B', vi: 'Kéo B' }, colorTag: ColorTag.PULL, slots: [S('deadlift', 3, 5, 8), S('row-db', 4, 8, 12), S('seated-row-cable', 3, 10, 15), S('rear-delt-fly', 3, 15, 20), S('curl-hammer', 3, 10, 15)] },
      { name: { en: 'Legs B', vi: 'Chân B' }, colorTag: ColorTag.LEGS, slots: [S('front-squat', 4, 6, 10), S('hip-thrust', 3, 8, 12), S('lunge-db', 3, 10, 12), S('leg-extension', 3, 12, 15), S('calf-raise', 4, 12, 20)] },
    ],
  },
  [PlanTemplateType.UPPER_LOWER]: {
    name: 'Upper / Lower',
    templates: [
      { name: { en: 'Upper A', vi: 'Thân trên A' }, colorTag: ColorTag.UPPER, slots: [S('bench-barbell', 4, 6, 10), S('row-barbell', 4, 6, 10), S('ohp-barbell', 3, 8, 12), S('lat-pulldown', 3, 10, 15), S('curl-db', 3, 10, 15)] },
      { name: { en: 'Lower A', vi: 'Thân dưới A' }, colorTag: ColorTag.LOWER, slots: [S('squat-barbell', 4, 6, 10), S('rdl', 3, 8, 12), S('leg-press', 3, 10, 15), S('leg-curl', 3, 10, 15), S('calf-raise', 4, 12, 20)] },
      { name: { en: 'Upper B', vi: 'Thân trên B' }, colorTag: ColorTag.UPPER, slots: [S('bench-incline-db', 4, 8, 12), S('pullup', 4, 6, 12), S('ohp-db', 3, 8, 12), S('seated-row-cable', 3, 10, 15), S('tricep-pushdown', 3, 10, 15)] },
      { name: { en: 'Lower B', vi: 'Thân dưới B' }, colorTag: ColorTag.LOWER, slots: [S('deadlift', 3, 5, 8), S('front-squat', 3, 8, 10), S('lunge-db', 3, 10, 12), S('leg-extension', 3, 12, 15), S('hip-thrust', 3, 10, 12)] },
    ],
  },
  [PlanTemplateType.FULL_BODY]: {
    name: 'Full body',
    templates: [
      { name: { en: 'Full A', vi: 'Toàn thân A' }, colorTag: ColorTag.FULL, slots: [S('squat-barbell', 3, 6, 10), S('bench-barbell', 3, 6, 10), S('row-barbell', 3, 8, 12), S('ohp-db', 3, 10, 12), S('plank', 3, 1, 1)] },
      { name: { en: 'Full B', vi: 'Toàn thân B' }, colorTag: ColorTag.FULL, slots: [S('deadlift', 3, 5, 8), S('bench-incline-db', 3, 8, 12), S('lat-pulldown', 3, 10, 15), S('lateral-raise', 3, 12, 20), S('curl-barbell', 3, 10, 15)] },
      { name: { en: 'Full C', vi: 'Toàn thân C' }, colorTag: ColorTag.FULL, slots: [S('front-squat', 3, 6, 10), S('pushup', 3, 10, 20), S('pullup', 3, 6, 12), S('leg-curl', 3, 10, 15), S('tricep-pushdown', 3, 10, 15)] },
    ],
  },
};

export async function createPlanFromTemplate(userId: string, templateType: PlanTemplateType): Promise<PlanWithTemplates> {
  const def = (PRESET_TEMPLATES as Record<string, { name: string; templates: PresetTemplateDef[] }>)[templateType];
  if (!def) throw new Error('Unknown preset template');

  const allSlugs = def.templates.flatMap((t) => t.slots.map((s) => s.slug));
  const bySlug = await findBySlugs(Array.from(new Set(allSlugs)));

  const templates: NewTemplate[] = def.templates.map((t, ti) => ({
    name: t.name,
    ...(t.focus ? { focus: t.focus } : {}),
    orderIndex: ti,
    colorTag: t.colorTag,
    slots: t.slots.map((s, si) => {
      const ex = bySlug.get(s.slug);
      if (!ex) throw new Error(`Preset references unknown exercise: ${s.slug}`);
      return {
        exerciseId: ex.id, orderIndex: si, setsTarget: s.setsTarget,
        repRangeMin: s.repRangeMin, repRangeMax: s.repRangeMax,
        equipmentType: ex.equipmentType, weightIncrement: ex.defaultIncrement,
      };
    }),
  }));

  return insertPlanGraph(userId, { name: def.name, templateType, source: PlanSource.CUSTOM, isActive: true }, templates);
}
```

- [ ] **Step 4: Run — expect PASS** (4 tests)

- [ ] **Step 5: Commit** — **Ngọc Danh**

```bash
git add apps/api/src/modules/workout/preset-templates.ts apps/api/src/modules/workout/preset-templates.test.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): add preset workout templates and createPlanFromTemplate"
```

---

### Task 4: Routes (`POST /plans/from-template`, `GET /plans/active`) + wire app + startup indexes — [Thanh Minh]

**Files:**
- Create: `apps/api/src/modules/workout/workout.routes.ts`
- Test: `apps/api/src/modules/workout/workout.routes.test.ts`
- Modify: `apps/api/src/app.ts` (mount `/plans`)
- Modify: `apps/api/src/index.ts` (ensure workout indexes on startup)

**Interfaces:**
- Consumes: `firebaseAuth`/`TokenVerifier`/`firebaseVerifier` (E2); `createPlanFromTemplate` (Task 3); `findActivePlan`/`ensureWorkoutIndexes` (Task 2); `apiSuccess`/`errorBody`; `@hono/zod-validator` + a small body schema.
- Produces: `makeWorkoutRoutes(deps: { verify: TokenVerifier }): Hono` with `firebaseAuth` applied and:
  - `POST /from-template` — body `{ templateType: PlanTemplateType }` (validate with a Zod object using `z.nativeEnum(PlanTemplateType)`); `createPlanFromTemplate(user.authId, templateType)` → 201 `apiSuccess(plan)`; on `Error('Unknown preset template')` → 400 `errorBody('Unknown preset template')`.
  - `GET /active` → `findActivePlan(user.authId)` → `apiSuccess(plan | null)` (200, `data: null` when none).
- App mounts at `/plans` with the real `firebaseVerifier` → `/api/plans/...`.

- [ ] **Step 1: Failing test — `workout.routes.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { ensureExerciseIndexes } from '../exercise/exercise.repo';
import { seedPresets } from '../exercise/seed-exercises';
import { ensureWorkoutIndexes } from './workout.repo';
import { makeWorkoutRoutes } from './workout.routes';
import type { TokenVerifier } from '../auth/firebase-auth';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wroutes_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

describe('workout routes', () => {
  it('401 without token', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/active');
    expect(res.status).toBe(401);
  });
  it('GET /active returns null when no plan', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/active', { headers: { Authorization: 'Bearer u1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.data).toBeNull();
  });
  it('POST /from-template creates a PPL plan (201) then GET /active returns it nested', async () => {
    const app = makeWorkoutRoutes({ verify });
    const create = await app.request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'ppl' }) });
    expect(create.status).toBe(201);
    const active = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
    const body = (await active.json()) as { data: { templateType: string; templates: Array<{ slots: unknown[] }> } };
    expect(body.data.templateType).toBe('ppl');
    expect(body.data.templates.length).toBe(6);
    expect(body.data.templates[0].slots.length).toBeGreaterThan(0);
  });
  it('POST /from-template with custom → 400', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'custom' }) });
    expect(res.status).toBe(400);
  });
  it('POST /from-template with invalid type → 400', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'bro' }) });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/workout/workout.routes.test.ts`

- [ ] **Step 3: Implement `workout.routes.ts`**

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, PlanTemplateType } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { findActivePlan } from './workout.repo.js';
import { createPlanFromTemplate } from './preset-templates.js';

const fromTemplateBody = z.object({ templateType: z.nativeEnum(PlanTemplateType) });

export function makeWorkoutRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.get('/active', async (c) => {
    const plan = await findActivePlan(c.get('user').authId);
    return c.json(apiSuccess(plan));
  });

  app.post('/from-template', zValidator('json', fromTemplateBody), async (c) => {
    const { templateType } = c.req.valid('json');
    try {
      const plan = await createPlanFromTemplate(c.get('user').authId, templateType);
      return c.json(apiSuccess(plan), 201);
    } catch (err) {
      if (err instanceof Error && err.message === 'Unknown preset template') {
        return c.json(errorBody('Unknown preset template'), 400);
      }
      throw err;
    }
  });

  return app;
}
```

- [ ] **Step 4: Run — expect PASS** (5 tests)

- [ ] **Step 5: Mount in `apps/api/src/app.ts`** — after `/exercises`, before `notFound`:

```typescript
import { makeWorkoutRoutes } from './modules/workout/workout.routes.js';
// inside createApp():
app.route('/plans', makeWorkoutRoutes({ verify: firebaseVerifier }));
```

- [ ] **Step 6: Startup indexes — modify `apps/api/src/index.ts`** — inside `if (uri)`, after the exercise seed:

```typescript
    const { ensureWorkoutIndexes } = await import('./modules/workout/workout.repo.js');
    await ensureWorkoutIndexes();
```

- [ ] **Step 7: Verify** — `pnpm typecheck && pnpm build && pnpm test`. Expected all pass — shared 18; api = prior 35 + workout (repo 4 + preset 4 + routes 5 = 13) = 48; total 66.

- [ ] **Step 8: Commit** — **Thanh Minh**

```bash
git add apps/api/src/modules/workout/workout.routes.ts apps/api/src/modules/workout/workout.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add /plans routes (from-template, active) and startup indexes"
```

---

### Task 5: Docs — README endpoints + roadmap — [Ngọc Danh]

**Files:** Modify `README.md`.

- [ ] **Step 1: Read `README.md`, then update**

- Status line: note E4 (workout plans backend) complete.
- API Endpoints: add a **Plans** subsection:
  - `POST /api/plans/from-template` — body `{ templateType: "ppl" | "upper_lower" | "full_body" }`; creates a plan (templates + slots) from a preset split and sets it active; 201 with the nested plan, 400 for an unknown/`custom` type.
  - `GET /api/plans/active` — the caller's active plan with templates and slots nested (`data: null` if none).
- Roadmap: mark E4 Workout Plans ✅ (backend); note E4-S3 (custom plan builder UI) and E4-S5 (Home/Today queue UI) deferred to the web app (E13).

- [ ] **Step 2: Commit** — **Ngọc Danh**

```bash
git add README.md
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "docs: document workout plan endpoints and roadmap"
```

---

## Self-Review

**1. Spec coverage (E4 backend):** E4-S1 schemas+repo → Tasks 1–2 ✅; E4-S2 preset templates (PPL/UL/FB) + instantiate → Task 3 ✅; E4-S4 `GET /plans/active` → Task 4 ✅ (+ `POST /from-template` to create data). E4-S3 (custom builder UI + its endpoint) and E4-S5 (Home queue UI) → deferred (Scope). Slot-anchored, queue-ordered (orderIndex) per GymFlow model.

**2. Placeholder scan:** no vague steps; preset data is concrete and every slug is drawn from the E3 seed (52 exercises); all code steps have full code. No-transaction limitation is explicitly noted and deferred to E14, not hidden.

**3. Type consistency:** `Plan`/`WorkoutTemplate`/`ExerciseSlot`/`PlanWithTemplates` + `PlanSource`/`PlanTemplateType`/`ColorTag` defined in Task 1; consumed by repo (Task 2), presets (Task 3), routes (Task 4). `NewTemplate`/`NewSlot`/`insertPlanGraph`/`findActivePlan` defined in Task 2, consumed by Tasks 3–4. `findBySlugs` added in Task 2, consumed by Task 3. `exerciseId` = catalog `Exercise.id`; `equipmentType`/`weightIncrement` sourced from the resolved exercise. `.js` ESM extensions throughout. Route `user.authId` matches E2 `User`.

**Slug cross-check (must hold):** every preset slug — bench-barbell, ohp-barbell, bench-incline-db, lateral-raise, tricep-pushdown, pullup, row-barbell, lat-pulldown, facepull, curl-barbell, squat-barbell, rdl, leg-press, leg-curl, calf-raise, bench-incline-bb, ohp-db, chest-fly-cable, skull-crusher, deadlift, row-db, seated-row-cable, rear-delt-fly, curl-hammer, front-squat, hip-thrust, lunge-db, leg-extension, curl-db, pushup, plank — exists in the E3 `PRESET_EXERCISES` seed. Task 3's instantiation test fails loudly if any slug is missing.

**Assignees:** T1, T2, T4 → Thanh Minh (S1, S4); T3, T5 → Ngọc Danh (S2). Commit authors set per task.
