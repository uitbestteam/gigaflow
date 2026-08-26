# E12 — Subscription & Quota (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e12-quota`.

**Goal:** A per-user monthly AI-generation quota — a `subscription` on the user (plan + per-type usage counters + period start), a service to check/increment/rollback usage with automatic period reset, and a `quotaGuard(type)` middleware (returns 429 when exceeded) ready for the AI routes to apply in E7. Guests and registered users share the same **basic (FREE)** limits.

**Architecture:** `subscription` is stored on the `users` doc (added in E2), lazily initialized/reset by the quota service so no migration or E2 change is needed. Limits are policy constants in `@gigaflow/shared`. Increment happens when an AI job is enqueued (E7 wires it); rollback when the job fails. Native driver + Zod, `.js` ESM, per-assignee commits — consistent with E1–E5.

**Tech Stack:** Hono, MongoDB native driver, Zod (`@gigaflow/shared`), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.1 users.subscription, §12 quota; decision: guest quota stays basic even after account creation)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E12)

## Scope

**In scope (backend):** E12-S1 (subscription model + `quotaGuard` middleware), E12-S2 (usage increment + rollback with period reset). **Consumers deferred:** the AI-generation routes that *apply* `quotaGuard` and call increment/rollback are built in **E7** (this epic exposes the middleware + service and tests them in isolation, like E1's internal-auth stub). No FE (quota UI is part of E13/later).

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm workspaces; TypeScript strict, NO `any` (guard `noUncheckedIndexedAccess`), explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`; routes under `/api` behind `firebaseAuth`.
- **Quota is basic for everyone** (guest and registered identical) at this stage — a single `FREE` plan; do not raise limits on account creation.
- Run turbo `pnpm typecheck` (exit 0) **and** `pnpm test` after every api task (not just the filtered test).
- **Commit author = Thanh Minh** for all tasks: `git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit ...`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts                 # + SubscriptionPlan, GenerationType
  schemas/subscription.ts        # zSubscription, PLAN_LIMITS, PERIOD_DAYS + types (NEW)
  schemas/user.ts                # zUser gains optional `subscription`
  index.ts                       # export subscription schema
apps/api/src/modules/subscription/
  quota.service.ts               # ensureCurrentPeriod / checkQuota / incrementUsage / rollbackUsage (NEW)
  quota.service.test.ts
  quota.guard.ts                 # quotaGuard(type) middleware (NEW)
  quota.guard.test.ts
```

---

### Task 1: Subscription enums + schema + limits (shared) — [Thanh Minh]

**Files:** modify `enums/index.ts`, `schemas/user.ts`, `index.ts`; create `schemas/subscription.ts`, `schemas/subscription.test.ts`.

**Interfaces — Produces:**
- `enum SubscriptionPlan { FREE='free' }` (PRO reserved for later — do not add now).
- `enum GenerationType { WORKOUT='workout', MEAL='meal', INBODY='inbody' }`.
- `zAiUsage` → `{ workout: int≥0, meal: int≥0, inbody: int≥0 }`.
- `zSubscription` → `Subscription`: `{ plan: SubscriptionPlan, aiUsage: zAiUsage, periodStart: Date }`.
- `zUser` gains `subscription: zSubscription.optional()` (optional so E2-created users still validate; the service initializes it).
- `PLAN_LIMITS: Record<SubscriptionPlan, Record<GenerationType, number>> = { free: { workout: 10, meal: 10, inbody: 5 } }`.
- `PERIOD_DAYS = 30`.

- [ ] **Step 1: Failing test — `schemas/subscription.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zSubscription, PLAN_LIMITS, PERIOD_DAYS, SubscriptionPlan, GenerationType } from '../index';

describe('subscription schema', () => {
  it('accepts a valid subscription', () => {
    const r = zSubscription.safeParse({ plan: SubscriptionPlan.FREE, aiUsage: { workout: 0, meal: 0, inbody: 0 }, periodStart: new Date() });
    expect(r.success).toBe(true);
  });
  it('rejects negative usage', () => {
    const r = zSubscription.safeParse({ plan: SubscriptionPlan.FREE, aiUsage: { workout: -1, meal: 0, inbody: 0 }, periodStart: new Date() });
    expect(r.success).toBe(false);
  });
  it('exposes FREE limits for each generation type', () => {
    expect(PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT]).toBe(10);
    expect(PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.INBODY]).toBe(5);
    expect(PERIOD_DAYS).toBe(30);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/subscription.test.ts`)

- [ ] **Step 3: Add enums — append to `enums/index.ts`**

```typescript
export enum SubscriptionPlan {
  FREE = 'free',
}

export enum GenerationType {
  WORKOUT = 'workout',
  MEAL = 'meal',
  INBODY = 'inbody',
}
```

- [ ] **Step 4: Create `schemas/subscription.ts`**

```typescript
import { z } from 'zod';
import { GenerationType, SubscriptionPlan } from '../enums/index.js';

export const zAiUsage = z.object({
  workout: z.number().int().min(0),
  meal: z.number().int().min(0),
  inbody: z.number().int().min(0),
});

export const zSubscription = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  aiUsage: zAiUsage,
  periodStart: z.date(),
});

export type AiUsage = z.infer<typeof zAiUsage>;
export type Subscription = z.infer<typeof zSubscription>;

export const PLAN_LIMITS: Record<SubscriptionPlan, Record<GenerationType, number>> = {
  [SubscriptionPlan.FREE]: {
    [GenerationType.WORKOUT]: 10,
    [GenerationType.MEAL]: 10,
    [GenerationType.INBODY]: 5,
  },
};

export const PERIOD_DAYS = 30;
```

- [ ] **Step 5: Add `subscription` to `schemas/user.ts`**

Import `zSubscription` (`import { zSubscription } from './subscription.js';`) and add to the `zUser` object: `subscription: zSubscription.optional(),`.

- [ ] **Step 6: Export** — add `export * from './schemas/subscription.js';` to `packages/shared/src/index.ts`.

- [ ] **Step 7: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 23 + 3 new = 26)

- [ ] **Step 8: Commit**

```bash
git add packages/shared
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(shared): add subscription schema, generation types, and plan limits"
```

---

### Task 2: Quota service (period reset + check + increment + rollback) — TDD — [Thanh Minh]

**Files:** create `apps/api/src/modules/subscription/quota.service.ts`, `quota.service.test.ts`.

**Interfaces — Produces:**
- `interface QuotaStatus { allowed: boolean; plan: SubscriptionPlan; type: GenerationType; used: number; limit: number }`
- `ensureCurrentPeriod(userId: string, now: Date): Promise<Subscription>` — load the user; if `subscription` is missing OR `now - periodStart >= PERIOD_DAYS days`, reset to `{ plan: FREE, aiUsage: {0,0,0}, periodStart: now }` (persist via `$set`); return the current subscription. (Takes `now` as a param for testability — routes/service pass `new Date()`.)
- `checkQuota(userId: string, type: GenerationType, now: Date): Promise<QuotaStatus>` — `ensureCurrentPeriod`; `used = sub.aiUsage[type]`; `limit = PLAN_LIMITS[sub.plan][type]`; `allowed = used < limit`.
- `incrementUsage(userId: string, type: GenerationType, now: Date): Promise<void>` — `ensureCurrentPeriod` then `$inc { ['subscription.aiUsage.'+type]: 1 }`.
- `rollbackUsage(userId: string, type: GenerationType): Promise<void>` — decrement but not below 0: load, compute `max(0, current-1)`, `$set` that value (no period reset — a rollback of a just-counted job).
- Missing-user → throw `Error('User not found')`.

- [ ] **Step 1: Failing test — `quota.service.test.ts`** (memory mongo; insert a bare user doc via the `users` collection). Cover: first check initializes FREE period and allows; after `limit` increments, `checkQuota.allowed` is false; `rollbackUsage` frees one and floors at 0; a `periodStart` older than 30 days resets usage to 0 on next check.

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db';
import { GenerationType, SubscriptionPlan, PLAN_LIMITS } from '@gigaflow/shared';
import { checkQuota, incrementUsage, rollbackUsage } from './quota.service';

let mongod: MongoMemoryServer;
const NOW = new Date('2026-08-26T00:00:00Z');
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await connectDb(mongod.getUri(), 'gigaflow_quota_test'); });
afterAll(async () => { await closeDb(); await mongod.stop(); });
beforeEach(async () => { await getDb().collection('users').deleteMany({}); });

async function makeUser(authId: string, sub?: unknown) {
  await getDb().collection('users').insertOne({ authId, authSource: 'firebase', authProvider: 'anonymous', isGuest: true, timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: NOW, updatedAt: NOW, ...(sub ? { subscription: sub } : {}) });
}

describe('quota.service', () => {
  it('initializes a FREE period and allows the first generation', async () => {
    await makeUser('u1');
    const s = await checkQuota('u1', GenerationType.WORKOUT, NOW);
    expect(s.allowed).toBe(true);
    expect(s.plan).toBe(SubscriptionPlan.FREE);
    expect(s.limit).toBe(PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT]);
    expect(s.used).toBe(0);
  });
  it('blocks once usage reaches the limit', async () => {
    await makeUser('u2');
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT];
    for (let i = 0; i < limit; i++) await incrementUsage('u2', GenerationType.WORKOUT, NOW);
    expect((await checkQuota('u2', GenerationType.WORKOUT, NOW)).allowed).toBe(false);
  });
  it('rollback frees one and floors at zero', async () => {
    await makeUser('u3');
    await incrementUsage('u3', GenerationType.MEAL, NOW);
    await rollbackUsage('u3', GenerationType.MEAL);
    await rollbackUsage('u3', GenerationType.MEAL); // floor
    expect((await checkQuota('u3', GenerationType.MEAL, NOW)).used).toBe(0);
  });
  it('resets usage when the period has expired', async () => {
    await makeUser('u4', { plan: 'free', aiUsage: { workout: 10, meal: 0, inbody: 0 }, periodStart: new Date('2026-06-01T00:00:00Z') });
    const s = await checkQuota('u4', GenerationType.WORKOUT, NOW); // >30 days later
    expect(s.used).toBe(0);
    expect(s.allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `quota.service.ts`** per the Interfaces block (native driver on `getDb().collection('users')`, keyed by `authId`; `PERIOD_DAYS` ms math; `$inc`/`$set` with `subscription.aiUsage.<type>` dotted paths; no `any`; guard `noUncheckedIndexedAccess` on `PLAN_LIMITS[plan][type]` via locals).

- [ ] **Step 4: Run — expect PASS**; then root `pnpm typecheck` exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/subscription/quota.service.ts apps/api/src/modules/subscription/quota.service.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add quota service with period reset, increment, and rollback"
```

---

### Task 3: `quotaGuard(type)` middleware — TDD — [Thanh Minh]

**Files:** create `apps/api/src/modules/subscription/quota.guard.ts`, `quota.guard.test.ts`.

**Interfaces — Produces:** `quotaGuard(type: GenerationType): MiddlewareHandler` — reads `c.get('user')` (set by `firebaseAuth` upstream), calls `checkQuota(user.authId, type, new Date())`; if `!allowed` → `c.json(errorBody('AI generation quota exceeded'), 429)`; else `await next()`.

- [ ] **Step 1: Failing test — `quota.guard.test.ts`** — build a tiny Hono app that sets a fake `user` via an inline middleware (`c.set('user', { authId: 'u1', ... })`) then `quotaGuard(GenerationType.WORKOUT)` then a 200 handler; memory mongo + a seeded user. Assert: under limit → 200; after hitting the limit (via `incrementUsage`) → 429.

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db';
import { GenerationType, PLAN_LIMITS, SubscriptionPlan } from '@gigaflow/shared';
import { incrementUsage } from './quota.service';
import { quotaGuard } from './quota.guard';

let mongod: MongoMemoryServer;
const NOW = new Date();
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_guard_test');
  await getDb().collection('users').insertOne({ authId: 'u1', authSource: 'firebase', authProvider: 'anonymous', isGuest: true, timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: NOW, updatedAt: NOW });
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

function app() {
  const a = new Hono();
  a.use('/gen', async (c, next) => { c.set('user', { authId: 'u1' } as never); await next(); });
  a.use('/gen', quotaGuard(GenerationType.WORKOUT));
  a.post('/gen', (c) => c.json({ success: true }));
  return a;
}

describe('quotaGuard', () => {
  it('allows when under limit', async () => {
    const res = await app().request('/gen', { method: 'POST' });
    expect(res.status).toBe(200);
  });
  it('returns 429 when the quota is exhausted', async () => {
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT];
    for (let i = 0; i < limit; i++) await incrementUsage('u1', GenerationType.WORKOUT, NOW);
    const res = await app().request('/gen', { method: 'POST' });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `quota.guard.ts`**

```typescript
import type { MiddlewareHandler } from 'hono';
import type { GenerationType } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { checkQuota } from './quota.service.js';

export function quotaGuard(type: GenerationType): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    const status = await checkQuota(user.authId, type, new Date());
    if (!status.allowed) {
      return c.json(errorBody('AI generation quota exceeded'), 429);
    }
    await next();
  };
}
```

- [ ] **Step 4: Run — expect PASS**; then `pnpm typecheck && pnpm build && pnpm test` all green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/subscription/quota.guard.ts apps/api/src/modules/subscription/quota.guard.test.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add quotaGuard middleware (429 on exceeded AI quota)"
```

---

### Task 4: Docs — README (quota) + note E7 wiring — [Thanh Minh]

**Files:** modify `README.md`.

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E12 (subscription & quota backend) complete.
- Add a short **Quota** note under API Endpoints (or a new "Quota" subsection): AI generation is limited per 30-day period per user (FREE plan: workout 10 / meal 10 / inbody 5); guests and registered users share the same basic limits. The `quotaGuard(type)` middleware returns **429** when exceeded and is applied to the AI-generation routes in E7; usage is incremented on job enqueue and rolled back on job failure.
- Roadmap: mark E12 Subscription & Quota ✅ (backend).

- [ ] **Step 2: Commit**

```bash
git add README.md
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "docs: document AI generation quota"
```

---

## Self-Review

**1. Spec coverage (E12 backend):** E12-S1 (subscription model → T1; `quotaGuard` middleware → T3) ✅; E12-S2 (increment + rollback → T2) ✅. Guest==registered basic limits enforced (single FREE plan, same limits). The routes that apply the guard + call increment/rollback are E7 consumers (documented). No FE (deferred).

**2. Placeholder scan:** T2 `quota.service.ts` body is specified by an exhaustive Interfaces block + explicit reset/inc/rollback semantics (multi-function module); every other step has literal code or exact assertions. Limits/period are concrete constants. No vague directives.

**3. Type consistency:** `SubscriptionPlan`/`GenerationType`/`zSubscription`/`Subscription`/`PLAN_LIMITS`/`PERIOD_DAYS` (T1) consumed by service (T2) and guard (T3). `QuotaStatus`/`checkQuota`/`incrementUsage`/`rollbackUsage` (T2) consumed by T3. `zUser.subscription` optional keeps E2 users valid. `user.authId` matches E2 `User`. `errorBody` reused (E1). `.js` ESM throughout; `noUncheckedIndexedAccess` guarded on `PLAN_LIMITS[plan][type]`.

**Assignees:** all tasks Thanh Minh (board: GIGA-32 E12-S1, GIGA-33 E12-S2 both Thanh Minh).
