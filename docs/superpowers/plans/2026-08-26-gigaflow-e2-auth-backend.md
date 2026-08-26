# E2 — Auth 3-mode (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do NOT use git worktrees** — work on a plain branch in this repo (user preference).

**Goal:** Backend for 3-mode Firebase auth — verify Firebase ID tokens, upsert a `users` record keyed by `authId` (uid), and expose an idempotent `/api/auth/session` — so guest (anonymous), Google, and email/password users all resolve to one durable user with zero migration on upgrade.

**Architecture:** A Hono middleware `firebaseAuth` verifies the bearer ID token via an injectable verifier (real one wraps `firebase-admin`; tests pass a fake), maps the token's `sign_in_provider` to our `AuthProvider`/`isGuest`, and upserts the user by `authId` on every request — so an anonymous→Google link (same uid) just updates the provider/email in place. Data access is the MongoDB native driver + Zod (no Mongoose), consistent with E1.

**Tech Stack:** Hono, firebase-admin, MongoDB native driver, Zod (`@gigaflow/shared`), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5.1 users, §6 auth)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E2)

## Scope

**In scope (this plan — backend, testable now):** E2-S2 (firebaseAuth middleware), E2-S6 (`/auth/session` idempotent upsert), plus the `users` schema/repo and provider mapping the middleware needs.

**Deferred (needs the React app from E13; not built yet):** E2-S1 (enable Firebase providers — an ops step, see infra note), E2-S3 (FE anonymous sign-in), E2-S4 (link Google), E2-S5 (email/password), E2-S7 (upgrade UI). These become a follow-on "E2-web auth" plan once `apps/web` is scaffolded. Quota (E12) is a separate epic; not here.

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm workspaces; TypeScript strict, NO `any`, explicit exported types.
- Zod single source in `@gigaflow/shared`; API validates with those schemas.
- Response envelope `{ success, data?, message? }` via `apiSuccess`/`errorBody` (from E1).
- All API routes live under the `/api` base path (E1 convention).
- `users` identity: `authId` (Firebase uid), `authSource: 'firebase'`. Default `timezone: 'Asia/Ho_Chi_Minh'`, `language: 'en'`.
- Commit author: `git -c user.name="Quill" -c user.email="lhongquan.1998@gmail.com" commit ...`. Conventional Commits.
- Cloud/Firebase provisioning (enable providers, service-account creds) is DEFERRED to the human — code must run in tests without real Firebase (injectable verifier).

---

## File Structure

```
packages/shared/src/
  enums/index.ts            # + AuthSource, AuthProvider
  schemas/user.ts           # + zUser, User type (NEW)
  index.ts                  # export user schema
apps/api/src/
  lib/firebase.ts           # firebase-admin lazy init + real TokenVerifier (NEW)
  modules/auth/
    provider-map.ts         # mapSignInProvider() pure helper (NEW)
    provider-map.test.ts
    user.repo.ts            # UserRepository (upsertByAuthId, findByAuthId, ensureIndexes) (NEW)
    user.repo.test.ts
    firebase-auth.ts        # firebaseAuth() middleware + types (NEW)
    firebase-auth.test.ts
    auth.routes.ts          # GET/POST /auth/session (NEW)
    auth.routes.test.ts
  app.ts                    # mount auth routes under firebaseAuth
  index.ts                  # ensure user indexes on startup
```

---

### Task 1: Auth enums + `users` Zod schema (shared)

**Files:**
- Modify: `packages/shared/src/enums/index.ts`
- Create: `packages/shared/src/schemas/user.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas/user.test.ts`

**Interfaces:**
- Consumes: `zObjectId` (E1).
- Produces: enum `AuthSource { FIREBASE='firebase' }`; enum `AuthProvider { ANONYMOUS='anonymous', PASSWORD='password', GOOGLE='google' }`; `zUser` (Zod object) and `type User = z.infer<typeof zUser>` with fields: `authId: string`, `authSource: AuthSource`, `authProvider: AuthProvider`, `isGuest: boolean`, `email?: string`, `displayName?: string`, `timezone: string`, `language: 'en'|'vi'`, `createdAt: Date`, `updatedAt: Date`.

- [ ] **Step 1: Write failing test — `packages/shared/src/schemas/user.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zUser, AuthProvider, AuthSource } from '../index';

const base = {
  authId: 'uid_123',
  authSource: AuthSource.FIREBASE,
  authProvider: AuthProvider.ANONYMOUS,
  isGuest: true,
  timezone: 'Asia/Ho_Chi_Minh',
  language: 'en',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('zUser', () => {
  it('accepts a minimal guest user', () => {
    expect(zUser.safeParse(base).success).toBe(true);
  });
  it('accepts a linked google user with email', () => {
    const r = zUser.safeParse({ ...base, authProvider: AuthProvider.GOOGLE, isGuest: false, email: 'a@b.com' });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown authProvider', () => {
    expect(zUser.safeParse({ ...base, authProvider: 'facebook' }).success).toBe(false);
  });
  it('rejects a bad language', () => {
    expect(zUser.safeParse({ ...base, language: 'fr' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/shared test src/schemas/user.test.ts`
Expected: FAIL (`zUser`/enums not exported).

- [ ] **Step 3: Add enums — append to `packages/shared/src/enums/index.ts`**

```typescript
export enum AuthSource {
  FIREBASE = 'firebase',
}

export enum AuthProvider {
  ANONYMOUS = 'anonymous',
  PASSWORD = 'password',
  GOOGLE = 'google',
}
```

- [ ] **Step 4: Create `packages/shared/src/schemas/user.ts`**

```typescript
import { z } from 'zod';
import { AuthProvider, AuthSource, Language } from '../enums/index.js';

export const zUser = z.object({
  authId: z.string().min(1),
  authSource: z.nativeEnum(AuthSource),
  authProvider: z.nativeEnum(AuthProvider),
  isGuest: z.boolean(),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  timezone: z.string(),
  language: z.nativeEnum(Language),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof zUser>;
```

> Note: `Language` enum already exists in E1 (`en`/`vi`); `z.nativeEnum(Language)` rejects `'fr'`.

- [ ] **Step 5: Export from `packages/shared/src/index.ts`**

Add: `export * from './schemas/user.js';` (keep existing exports). Use the `.js` extension (repo ESM convention).

- [ ] **Step 6: Run — expect PASS**

Run: `pnpm --filter @gigaflow/shared test`
Expected: PASS (existing 5 + 4 new).

- [ ] **Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat(shared): add auth enums and users Zod schema"
```

---

### Task 2: `UserRepository` (upsert by authId) — TDD

**Files:**
- Create: `apps/api/src/modules/auth/user.repo.ts`
- Test: `apps/api/src/modules/auth/user.repo.test.ts`

**Interfaces:**
- Consumes: `getDb` (E1 `apps/api/src/lib/db.ts`), `User`, `AuthProvider`, `AuthSource` from `@gigaflow/shared`.
- Produces:
  - `ensureUserIndexes(): Promise<void>` — unique index on `{ authId: 1 }`.
  - `upsertByAuthId(input: UpsertUserInput): Promise<User>` where
    `interface UpsertUserInput { authId: string; authProvider: AuthProvider; isGuest: boolean; email?: string; displayName?: string; }`.
    Upsert semantics: on insert set `authSource='firebase'`, `timezone='Asia/Ho_Chi_Minh'`, `language='en'`, `createdAt=now`; ALWAYS set `authProvider`, `isGuest`, `updatedAt=now`, and `email`/`displayName` when provided. Returns the resulting `User` (without Mongo `_id`).
  - `findByAuthId(authId: string): Promise<User | null>`.

- [ ] **Step 1: Write failing test — `apps/api/src/modules/auth/user.repo.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { AuthProvider } from '@gigaflow/shared';
import { ensureUserIndexes, upsertByAuthId, findByAuthId } from './user.repo';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test');
  await ensureUserIndexes();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('UserRepository', () => {
  it('inserts a guest on first upsert, sets defaults', async () => {
    const u = await upsertByAuthId({ authId: 'uid_a', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    expect(u.authSource).toBe('firebase');
    expect(u.isGuest).toBe(true);
    expect(u.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(u.language).toBe('en');
  });
  it('is idempotent — same authId does not create a second doc', async () => {
    await upsertByAuthId({ authId: 'uid_b', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    await upsertByAuthId({ authId: 'uid_b', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    const found = await findByAuthId('uid_b');
    expect(found).not.toBeNull();
  });
  it('updates provider/email in place on link (anonymous -> google)', async () => {
    await upsertByAuthId({ authId: 'uid_c', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    const linked = await upsertByAuthId({ authId: 'uid_c', authProvider: AuthProvider.GOOGLE, isGuest: false, email: 'c@x.com' });
    expect(linked.authProvider).toBe(AuthProvider.GOOGLE);
    expect(linked.isGuest).toBe(false);
    expect(linked.email).toBe('c@x.com');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/user.repo.test.ts`
Expected: FAIL (`./user.repo` missing).

- [ ] **Step 3: Implement `apps/api/src/modules/auth/user.repo.ts`**

```typescript
import { getDb } from '../../lib/db.js';
import { AuthProvider, AuthSource, Language, type User } from '@gigaflow/shared';

const COLLECTION = 'users';

export interface UpsertUserInput {
  authId: string;
  authProvider: AuthProvider;
  isGuest: boolean;
  email?: string;
  displayName?: string;
}

function collection() {
  return getDb().collection<User>(COLLECTION);
}

export async function ensureUserIndexes(): Promise<void> {
  await collection().createIndex({ authId: 1 }, { unique: true });
}

export async function upsertByAuthId(input: UpsertUserInput): Promise<User> {
  const now = new Date();
  const set: Partial<User> = {
    authProvider: input.authProvider,
    isGuest: input.isGuest,
    updatedAt: now,
  };
  if (input.email !== undefined) set.email = input.email;
  if (input.displayName !== undefined) set.displayName = input.displayName;

  const setOnInsert: Partial<User> = {
    authId: input.authId,
    authSource: AuthSource.FIREBASE,
    timezone: 'Asia/Ho_Chi_Minh',
    language: Language.EN,
    createdAt: now,
  };

  const result = await collection().findOneAndUpdate(
    { authId: input.authId },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } },
  );
  if (!result) throw new Error('Failed to upsert user');
  return result as User;
}

export async function findByAuthId(authId: string): Promise<User | null> {
  return collection().findOne({ authId }, { projection: { _id: 0 } }) as Promise<User | null>;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/user.repo.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/user.repo.ts apps/api/src/modules/auth/user.repo.test.ts
git commit -m "feat(api): add UserRepository with idempotent upsertByAuthId"
```

---

### Task 3: Provider mapping helper (pure) — TDD

**Files:**
- Create: `apps/api/src/modules/auth/provider-map.ts`
- Test: `apps/api/src/modules/auth/provider-map.test.ts`

**Interfaces:**
- Consumes: `AuthProvider` from `@gigaflow/shared`.
- Produces: `mapSignInProvider(signInProvider: string): { authProvider: AuthProvider; isGuest: boolean }` — `'anonymous'`→(ANONYMOUS,true); `'google.com'`→(GOOGLE,false); `'password'`→(PASSWORD,false); anything else → throws `Error('Unsupported sign-in provider: <x>')`.

- [ ] **Step 1: Write failing test — `provider-map.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { AuthProvider } from '@gigaflow/shared';
import { mapSignInProvider } from './provider-map';

describe('mapSignInProvider', () => {
  it('maps anonymous', () => {
    expect(mapSignInProvider('anonymous')).toEqual({ authProvider: AuthProvider.ANONYMOUS, isGuest: true });
  });
  it('maps google.com', () => {
    expect(mapSignInProvider('google.com')).toEqual({ authProvider: AuthProvider.GOOGLE, isGuest: false });
  });
  it('maps password', () => {
    expect(mapSignInProvider('password')).toEqual({ authProvider: AuthProvider.PASSWORD, isGuest: false });
  });
  it('throws on unsupported provider', () => {
    expect(() => mapSignInProvider('facebook.com')).toThrow(/Unsupported sign-in provider/);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/provider-map.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `provider-map.ts`**

```typescript
import { AuthProvider } from '@gigaflow/shared';

export function mapSignInProvider(signInProvider: string): { authProvider: AuthProvider; isGuest: boolean } {
  switch (signInProvider) {
    case 'anonymous':
      return { authProvider: AuthProvider.ANONYMOUS, isGuest: true };
    case 'google.com':
      return { authProvider: AuthProvider.GOOGLE, isGuest: false };
    case 'password':
      return { authProvider: AuthProvider.PASSWORD, isGuest: false };
    default:
      throw new Error(`Unsupported sign-in provider: ${signInProvider}`);
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/provider-map.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/provider-map.ts apps/api/src/modules/auth/provider-map.test.ts
git commit -m "feat(api): add sign-in provider mapping helper"
```

---

### Task 4: `firebaseAuth` middleware (injectable verifier) — TDD

**Files:**
- Create: `apps/api/src/modules/auth/firebase-auth.ts`
- Test: `apps/api/src/modules/auth/firebase-auth.test.ts`

**Interfaces:**
- Consumes: `mapSignInProvider` (Task 3), `upsertByAuthId` (Task 2), `errorBody` (E1 `middleware/error.ts`), `User` from shared.
- Produces:
  - `interface VerifiedToken { uid: string; email?: string; name?: string; signInProvider: string; }`
  - `type TokenVerifier = (bearerToken: string) => Promise<VerifiedToken>;`
  - `interface FirebaseAuthDeps { verify: TokenVerifier; upsert?: typeof upsertByAuthId; }` (upsert defaults to the real repo fn; injectable for tests)
  - `firebaseAuth(deps: FirebaseAuthDeps): MiddlewareHandler` — extracts `Authorization: Bearer <t>`; 401 if missing; calls `verify`; on throw → 401; maps provider; upserts user; sets `c.set('user', user)`; `next()`.
  - Hono context typing: `declare module 'hono' { interface ContextVariableMap { user: User } }` (so `c.get('user')` is typed).

- [ ] **Step 1: Write failing test — `firebase-auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { ensureUserIndexes } from './user.repo';
import { firebaseAuth, type TokenVerifier } from './firebase-auth';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test_mw');
  await ensureUserIndexes();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

const fakeVerify: TokenVerifier = async (t) => {
  if (t === 'good-anon') return { uid: 'uid_anon', signInProvider: 'anonymous' };
  if (t === 'good-google') return { uid: 'uid_anon', email: 'g@x.com', signInProvider: 'google.com' };
  throw new Error('invalid token');
};

function app() {
  const a = new Hono();
  a.use('/me', firebaseAuth({ verify: fakeVerify }));
  a.get('/me', (c) => c.json({ success: true, data: c.get('user') }));
  return a;
}

describe('firebaseAuth', () => {
  it('401 when no Authorization header', async () => {
    const res = await app().request('/me');
    expect(res.status).toBe(401);
  });
  it('401 when token invalid', async () => {
    const res = await app().request('/me', { headers: { Authorization: 'Bearer nope' } });
    expect(res.status).toBe(401);
  });
  it('200 + guest user for anonymous token', async () => {
    const res = await app().request('/me', { headers: { Authorization: 'Bearer good-anon' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { authId: string; isGuest: boolean } };
    expect(body.data.authId).toBe('uid_anon');
    expect(body.data.isGuest).toBe(true);
  });
  it('same uid upgraded to google updates user in place', async () => {
    await app().request('/me', { headers: { Authorization: 'Bearer good-anon' } });
    const res = await app().request('/me', { headers: { Authorization: 'Bearer good-google' } });
    const body = (await res.json()) as { data: { isGuest: boolean; authProvider: string; email?: string } };
    expect(body.data.isGuest).toBe(false);
    expect(body.data.authProvider).toBe('google');
    expect(body.data.email).toBe('g@x.com');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/firebase-auth.test.ts`
Expected: FAIL (`./firebase-auth` missing).

- [ ] **Step 3: Implement `firebase-auth.ts`**

```typescript
import type { MiddlewareHandler } from 'hono';
import type { User } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { mapSignInProvider } from './provider-map.js';
import { upsertByAuthId } from './user.repo.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export interface VerifiedToken {
  uid: string;
  email?: string;
  name?: string;
  signInProvider: string;
}

export type TokenVerifier = (bearerToken: string) => Promise<VerifiedToken>;

export interface FirebaseAuthDeps {
  verify: TokenVerifier;
  upsert?: typeof upsertByAuthId;
}

export function firebaseAuth(deps: FirebaseAuthDeps): MiddlewareHandler {
  const upsert = deps.upsert ?? upsertByAuthId;
  return async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) return c.json(errorBody('Unauthorized'), 401);

    let verified: VerifiedToken;
    try {
      verified = await deps.verify(token);
    } catch {
      return c.json(errorBody('Unauthorized'), 401);
    }

    const { authProvider, isGuest } = mapSignInProvider(verified.signInProvider);
    const user = await upsert({
      authId: verified.uid,
      authProvider,
      isGuest,
      email: verified.email,
      displayName: verified.name,
    });
    c.set('user', user);
    await next();
  };
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/firebase-auth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/firebase-auth.ts apps/api/src/modules/auth/firebase-auth.test.ts
git commit -m "feat(api): add firebaseAuth middleware with injectable verifier"
```

---

### Task 5: `firebase-admin` real verifier + startup index ensure

**Files:**
- Modify: `apps/api/package.json` (add `firebase-admin`)
- Create: `apps/api/src/lib/firebase.ts`
- Modify: `apps/api/src/index.ts` (ensure indexes after DB connect)

**Interfaces:**
- Consumes: `firebase-admin`, `VerifiedToken`/`TokenVerifier` (Task 4), `ensureUserIndexes` (Task 2), `connectDb` (E1).
- Produces: `firebaseVerifier: TokenVerifier` — verifies a Firebase ID token with `firebase-admin` and adapts `DecodedIdToken` → `VerifiedToken` (`signInProvider = decoded.firebase.sign_in_provider`). Admin app lazy-inits with application default credentials.

- [ ] **Step 1: Add dependency**

Run: `pnpm --filter @gigaflow/api add firebase-admin`
Expected: `firebase-admin` in `apps/api/package.json` dependencies; lockfile updated.

- [ ] **Step 2: Create `apps/api/src/lib/firebase.ts`**

```typescript
import { initializeApp, getApps, applicationDefault, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { TokenVerifier, VerifiedToken } from '../modules/auth/firebase-auth.js';

let app: App | undefined;

function getApp(): App {
  if (!app) {
    app = getApps()[0] ?? initializeApp({ credential: applicationDefault() });
  }
  return app;
}

export const firebaseVerifier: TokenVerifier = async (token: string): Promise<VerifiedToken> => {
  const decoded = await getAuth(getApp()).verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name,
    signInProvider: decoded.firebase.sign_in_provider,
  };
};
```

> Credentials: on Cloud Run the runtime service account supplies application-default credentials automatically; locally set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key. This is an ops concern — the verifier is only constructed at runtime, never in tests (tests use the fake from Task 4).

- [ ] **Step 3: Ensure indexes on startup — modify `apps/api/src/index.ts`**

In `main()`, after `await connectDb(...)` (inside the `if (uri)` block), add:

```typescript
    const { ensureUserIndexes } = await import('./modules/auth/user.repo.js');
    await ensureUserIndexes();
```

- [ ] **Step 4: Verify typecheck + build + tests still green**

Run: `pnpm --filter @gigaflow/api typecheck && pnpm build && pnpm --filter @gigaflow/api test`
Expected: typecheck clean; build green; all api tests pass (health 3 + db 1 + internal-auth 2 + auth: user.repo 3 + provider-map 4 + firebase-auth 4 = 17). `firebase.ts` is not imported by any test, so no real Firebase init occurs during tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/src/lib/firebase.ts apps/api/src/index.ts pnpm-lock.yaml
git commit -m "feat(api): add firebase-admin verifier and ensure user indexes on startup"
```

---

### Task 6: `/auth/session` route + wire into app (integration)

**Files:**
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Test: `apps/api/src/modules/auth/auth.routes.test.ts`
- Modify: `apps/api/src/app.ts` (mount auth routes)

**Interfaces:**
- Consumes: `firebaseAuth` (Task 4), `firebaseVerifier` (Task 5), `apiSuccess` (E1), `createApp` (E1).
- Produces:
  - `makeAuthRoutes(deps: { verify: TokenVerifier }): Hono` — a sub-app with `firebaseAuth` applied and `GET /session` + `POST /session` both returning `apiSuccess(c.get('user'))`.
  - `app.ts` mounts it at `/auth` using the real `firebaseVerifier` (so effective paths are `/api/auth/session`).

- [ ] **Step 1: Write failing test — `auth.routes.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db';
import { ensureUserIndexes } from './user.repo';
import { makeAuthRoutes } from './auth.routes';
import type { TokenVerifier } from './firebase-auth';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test_routes');
  await ensureUserIndexes();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

const verify: TokenVerifier = async (t) =>
  t === 'ok' ? { uid: 'uid_route', signInProvider: 'anonymous' } : Promise.reject(new Error('bad'));

describe('POST /session', () => {
  it('401 without token', async () => {
    const app = makeAuthRoutes({ verify });
    const res = await app.request('/session', { method: 'POST' });
    expect(res.status).toBe(401);
  });
  it('creates then returns the same user (idempotent)', async () => {
    const app = makeAuthRoutes({ verify });
    await app.request('/session', { method: 'POST', headers: { Authorization: 'Bearer ok' } });
    const res = await app.request('/session', { method: 'POST', headers: { Authorization: 'Bearer ok' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { authId: string } };
    expect(body.success).toBe(true);
    expect(body.data.authId).toBe('uid_route');
    const count = await getDb().collection('users').countDocuments({ authId: 'uid_route' });
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/auth.routes.test.ts`
Expected: FAIL (`./auth.routes` missing).

- [ ] **Step 3: Implement `auth.routes.ts`**

```typescript
import { Hono } from 'hono';
import { apiSuccess } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from './firebase-auth.js';

export function makeAuthRoutes(deps: { verify: TokenVerifier }): Hono {
  const auth = new Hono();
  auth.use('*', firebaseAuth({ verify: deps.verify }));
  const handler = (c: import('hono').Context) => c.json(apiSuccess(c.get('user')));
  auth.get('/session', handler);
  auth.post('/session', handler);
  return auth;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `pnpm --filter @gigaflow/api test src/modules/auth/auth.routes.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Mount in `apps/api/src/app.ts`**

Add imports and mount BEFORE `app.notFound(...)`:

```typescript
import { makeAuthRoutes } from './modules/auth/auth.routes.js';
import { firebaseVerifier } from './lib/firebase.js';
// ... inside createApp(), after health route:
app.route('/auth', makeAuthRoutes({ verify: firebaseVerifier }));
```

> With the app-level `.basePath('/api')`, the live endpoint is `POST /api/auth/session`. `firebaseVerifier` is only exercised at runtime; `createApp()` is not called by unit tests that would trigger real Firebase (health test calls createApp but never hits `/auth`, so no token verification runs).

- [ ] **Step 6: Verify whole suite + typecheck + build**

Run: `pnpm --filter @gigaflow/api typecheck && pnpm build && pnpm test`
Expected: typecheck clean; build green; all tests pass (shared 5+4 user = 9; api 17 + auth.routes 2 = 19).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/auth/auth.routes.ts apps/api/src/modules/auth/auth.routes.test.ts apps/api/src/app.ts
git commit -m "feat(api): add POST/GET /auth/session behind firebaseAuth"
```

---

### Task 7: Docs — README + infra note for deferred Firebase setup

**Files:**
- Modify: `README.md` (status/roadmap: E2 backend auth done; note FE auth deferred)
- Modify: `infra/README.md` (deferred: enable Firebase Anonymous/Google/Password providers; grant Cloud Run SA token-verify via ADC; set `GOOGLE_APPLICATION_CREDENTIALS` locally)

**Interfaces:** docs only.

- [ ] **Step 1: Update `README.md`**

- Change the status line to note E2 (backend auth) complete.
- In the endpoints/dev section, add: `POST /api/auth/session` (requires `Authorization: Bearer <Firebase ID token>`; upserts and returns the user).
- In Roadmap, mark E2 backend done; note FE auth (anonymous sign-in, Google/password link, upgrade UI) is a follow-on once the web app is scaffolded (E13).

- [ ] **Step 2: Update `infra/README.md`**

Append a "Firebase auth (deferred)" section:
- Enable providers in Firebase console: Anonymous, Google, Email/Password.
- Cloud Run: the runtime service account provides application-default credentials for `firebase-admin` token verification (no key file needed in prod).
- Local dev: set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON to verify real tokens; unit tests use a fake verifier and need nothing.
- Add `GOOGLE_APPLICATION_CREDENTIALS` to `.env.example` as an optional local var.

- [ ] **Step 3: Update `.env.example`**

Add a commented line:
```
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json  # local Firebase token verify
```

- [ ] **Step 4: Commit**

```bash
git add README.md infra/README.md .env.example
git commit -m "docs: document E2 backend auth and deferred Firebase setup"
```

---

## Self-Review

**1. Spec coverage (Epic E2, backend portion):**
- E2-S2 firebaseAuth middleware → Task 4 (+ real verifier Task 5) ✅
- E2-S6 `/auth/session` idempotent upsert → Task 6 ✅
- users schema/repo the middleware needs → Tasks 1, 2 ✅
- provider mapping (anonymous/google/password) → Task 3 ✅
- E2-S1 (enable providers) → deferred ops, documented Task 7 ✅ (flagged)
- E2-S3/S4/S5/S7 (frontend) → explicitly deferred to a follow-on plan after `apps/web` scaffold (Scope section) ✅
- Anonymous→link "zero migration" → covered by upsert-by-authId updating provider/email in place (Task 2 test 3, Task 4 test 4) ✅

**2. Placeholder scan:** no TBD/vague steps; every code step has full code; infra credential setup is a documented human step with concrete instructions, not a code placeholder.

**3. Type consistency:** `authId`/`authProvider`/`isGuest`/`email` names consistent across `zUser` (T1), `UpsertUserInput` (T2), `VerifiedToken`/`firebaseAuth` (T4), and `firebaseVerifier` (T5). `TokenVerifier`/`VerifiedToken` defined in T4 and imported by T5/T6. `mapSignInProvider` signature identical in T3 and its caller T4. `c.get('user')` typed via the `ContextVariableMap` augmentation in T4 and consumed in T6. `.js` ESM import extensions used throughout (repo convention).

**Sequencing note:** Tasks 1→2→3→4→5→6 are strictly ordered (each consumes the prior). Task 7 is docs, last. All backend; no web app needed. Firebase real credentials never touched by tests.
