# E10 — Notifications (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox steps. **No git worktrees** — plain branch `e10-notifications`.

**Goal:** Push notifications for the async AI jobs and workout reminders — register/remove FCM device tokens, send a (bilingual) push when a generation job completes or fails, and expose a cron-triggered "time to train" reminder. Runnable + testable with **no real Firebase** (the push sender is injected → fakes in tests; the real sender uses firebase-admin messaging).

**Architecture:** A `device_tokens` collection + CRUD routes (E10-S1). A `PushSender` seam (real = firebase-admin `getMessaging`, reusing the E2 admin app; injected → fakes in tests) drives a `NotificationService` that looks up a user's tokens + language and sends a localized message (E10-S2). Job completion is hooked **without touching the E7/E8/E9 route factories or services**: a `notifyingEnqueuer(inner, notifier, type)` wrapper — applied where the real enqueuers are built in `app.ts` — reads the job's final status after processing and notifies. A `/internal/cron/workout-reminders` endpoint (internalAuth-guarded) finds users due for a reminder and pushes (E10-S4). Native driver + Zod, `.js` ESM, per-assignee commits.

**Tech Stack:** Hono, MongoDB native driver, Zod, firebase-admin (messaging), Vitest + mongodb-memory-server.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md` (§5 device_tokens, §10 notifications, FCM)
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E10)

## Scope

**In scope (backend):** E10-S1 (device token API), E10-S2 (FCM on job complete/error), E10-S4 (workout reminder service + cron endpoint). **Deferred:** E10-S3 (FE FCM setup/permission → E13); the Cloud Scheduler trigger for the cron endpoint (the endpoint is built/tested; the scheduler is a deploy step); wiring notifications into the future Cloud Tasks internal-handler path (the inline path is wrapped).

## Global Constraints

- Node dev ≥ 20 / container Node 22; pnpm; TS strict, NO `any`, guard `noUncheckedIndexedAccess`, explicit exported types.
- Zod single source in `@gigaflow/shared`; envelope `{ success, data?, message? }`; user routes under `/api` behind `firebaseAuth` (E2); owner = `c.get('user').authId`. Cron under `/internal/cron` behind `internalAuth` (E1).
- No real Firebase in tests: `PushSender` + notifier are injected; tests pass fakes. Notification failures must NEVER break the job/HTTP flow (swallow + continue).
- Run turbo `pnpm typecheck` (exit 0) + `pnpm test` after every api task.
- **Commit author = the task's assignee:** Thanh Minh → `Nguyen Thanh Minh <95201788+ngthminhdev@users.noreply.github.com>`; Ngọc Danh → `Ngo Ngoc Danh <218212775+danh98it@users.noreply.github.com>`; Quan → `Luong Hong Quan <lhongquan.1998@gmail.com>`. Conventional Commits.

---

## File Structure

```
packages/shared/src/
  enums/index.ts                     # + DevicePlatform
  schemas/notification.ts            # zDeviceToken, zRegisterDeviceTokenInput + types (NEW)
  index.ts
apps/api/src/modules/notification/
  device-token.repo.ts               # upsertDeviceToken / deleteDeviceToken / listTokens (NEW, T2)
  device-token.repo.test.ts
  device-token.routes.ts             # POST/DELETE /notifications/device-token (NEW, T2)
  device-token.routes.test.ts
  push-sender.ts                     # PushSender interface + FcmPushSender (firebase-admin) (NEW, T3)
  push-sender.factory.ts             # buildPushSender() (NEW, T3)
  notification.service.ts            # NotificationService (notifyJobComplete/Error) (NEW, T3)
  notification.service.test.ts
  notifying-enqueuer.ts              # notifyingEnqueuer(inner, notifier, type) (NEW, T3)
  notifying-enqueuer.test.ts
  reminder.service.ts                # findUsersDueForWorkoutReminder / sendWorkoutReminders (NEW, T4)
  reminder.service.test.ts
  cron.routes.ts                     # POST /internal/cron/workout-reminders (NEW, T4)
  cron.routes.test.ts
apps/api/src/app.ts                  # mount /notifications, /internal/cron; wrap job enqueuers with notifyingEnqueuer
apps/api/src/index.ts                # ensure device-token indexes
```

---

### Task 1: DevicePlatform enum + device-token schemas (shared) — [Thanh Minh]

**Files:** modify `enums/index.ts`, `index.ts`; create `schemas/notification.ts`, `schemas/notification.test.ts`.

**Interfaces — Produces:**
- `enum DevicePlatform { IOS='ios', ANDROID='android', WEB='web' }`
- `zRegisterDeviceTokenInput` → `RegisterDeviceTokenInput`: `{ token: string(min1), platform?: DevicePlatform }`.
- `zDeviceToken` → `DeviceToken`: `{ id: string, userId: string, token: string, platform?: DevicePlatform, createdAt: Date, updatedAt: Date }`.

- [ ] **Step 1: Failing test — `schemas/notification.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zRegisterDeviceTokenInput, zDeviceToken, DevicePlatform } from '../index';

describe('notification schemas', () => {
  it('accepts a token with platform', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: 'abc', platform: DevicePlatform.ANDROID }).success).toBe(true);
  });
  it('accepts a token without platform', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: 'abc' }).success).toBe(true);
  });
  it('rejects an empty token', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: '' }).success).toBe(false);
  });
  it('rejects an unknown platform', () => {
    expect(zRegisterDeviceTokenInput.safeParse({ token: 'abc', platform: 'watch' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`pnpm --filter @gigaflow/shared test src/schemas/notification.test.ts`)
- [ ] **Step 3: Add enum** `DevicePlatform` to `enums/index.ts`.
- [ ] **Step 4: Create `schemas/notification.ts`** per the Interfaces (`.js` imports).
- [ ] **Step 5: Export** — add `export * from './schemas/notification.js';` to `index.ts`.
- [ ] **Step 6: Run — expect PASS** (`pnpm --filter @gigaflow/shared test`; prior 49 + 4 new = 53).
- [ ] **Step 7: Commit — Thanh Minh**

```bash
git add packages/shared
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(shared): add device platform enum and device-token schemas"
```

---

### Task 2: Device-token repo + routes + wiring — TDD — [Thanh Minh]

**Files:** create `device-token.repo.ts`, `device-token.repo.test.ts`, `device-token.routes.ts`, `device-token.routes.test.ts`; modify `app.ts`, `index.ts`.

**Interfaces — Produces:**
- `device-token.repo.ts`: `ensureDeviceTokenIndexes()` (unique `{ token: 1 }`, plus `{ userId: 1 }`); `upsertDeviceToken(userId, token, platform?): Promise<DeviceToken>` (upsert by `token`, set userId/platform/updatedAt, `$setOnInsert` createdAt — a token re-registered by another user reassigns to the new user); `deleteDeviceToken(userId, token): Promise<boolean>` (delete only if owned); `listTokens(userId): Promise<DeviceToken[]>`.
- `device-token.routes.ts`: `makeDeviceTokenRoutes({ verify }): Hono` — `firebaseAuth`; `POST /device-token` — `zValidator('json', zRegisterDeviceTokenInput)` → `upsertDeviceToken(user.authId, ...)` → 201 `apiSuccess(token)`; `DELETE /device-token/:token` → `deleteDeviceToken(user.authId, token)` → `apiSuccess({ deleted })`.
- `app.ts`: mount `app.route('/notifications', makeDeviceTokenRoutes({ verify: firebaseVerifier }))` before `notFound`. `index.ts`: `ensureDeviceTokenIndexes()` on startup.

- [ ] **Step 1: Failing tests** — repo (upsert reassigns on re-register; delete only own; list) and routes (fake verifier + memory mongo): 401; POST 201; DELETE own → `{deleted:true}`; POST invalid body → 400.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** repo + routes + wire `app.ts`/`index.ts` (`.js` imports; map `_id`→`id`, omit nullish; no `any`).
- [ ] **Step 4: Run — expect PASS**; `pnpm typecheck && pnpm build && pnpm test` green.
- [ ] **Step 5: Commit — Thanh Minh**

```bash
git add apps/api/src/modules/notification/device-token.repo.ts apps/api/src/modules/notification/device-token.repo.test.ts apps/api/src/modules/notification/device-token.routes.ts apps/api/src/modules/notification/device-token.routes.test.ts apps/api/src/app.ts apps/api/src/index.ts
git -c user.name="Nguyen Thanh Minh" -c user.email="95201788+ngthminhdev@users.noreply.github.com" commit -m "feat(api): add device token registration API"
```

---

### Task 3: Push sender + notification service + notifying enqueuer + wiring — TDD — [Ngọc Danh]

**Files:** create `push-sender.ts`, `push-sender.factory.ts`, `notification.service.ts`, `notification.service.test.ts`, `notifying-enqueuer.ts`, `notifying-enqueuer.test.ts`; modify `app.ts`.

**Interfaces — Produces:**
- `push-sender.ts`: `interface PushMessage { title: string; body: string; data?: Record<string, string> }`; `interface PushSender { send(tokens: string[], message: PushMessage): Promise<void> }`; `class FcmPushSender implements PushSender` — uses firebase-admin `getMessaging(getFirebaseApp()).sendEachForMulticast({ tokens, notification: { title, body }, data })` (no-op when `tokens` is empty). (Reuse the E2 admin app; import the app getter from `../../lib/firebase.js` — expose one if needed. Not unit-tested.)
- `push-sender.factory.ts`: `buildPushSender(): PushSender` — `FcmPushSender` (it lazily inits the admin app on first send; if unconfigured, a real send throws at call time — acceptable, only affects real pushes).
- `notification.service.ts`: `interface NotifyDeps { sender: PushSender }`; `type JobKind = 'workout' | 'meal' | 'inbody'`;
  - `notifyJobComplete(userId: string, kind: JobKind, deps: NotifyDeps): Promise<void>` — `listTokens(userId)`; if none, return; resolve the user's language via `findByAuthId(userId)` (default `en`); build a localized `PushMessage` from a `MESSAGES` map keyed by `[kind]['complete'][lang]`; `sender.send(tokens, msg)`. **Wrap the whole thing in try/catch and swallow** (log) — never throw.
  - `notifyJobError(userId, kind, deps): Promise<void>` — same, using `[kind]['error'][lang]`.
  - `MESSAGES`: for each kind × {complete,error} × {en,vi}, a `{ title, body }` (e.g. workout complete en `{ title: 'Workout plan ready', body: 'Your AI workout plan is ready.' }`, vi equivalents; error variants).
- `notifying-enqueuer.ts`: `notifyingEnqueuer(inner: TaskEnqueuer, kind: JobKind, deps: NotifyDeps): TaskEnqueuer` — returns `async (jobId) => { try { await inner(jobId); } finally { try { const job = await findJobById(jobId); if (!job) return; if (job.status === JobStatus.DONE) await notifyJobComplete(job.userId, kind, deps); else if (job.status === JobStatus.FAILED) await notifyJobError(job.userId, kind, deps); } catch { /* swallow */ } } }` (imports `TaskEnqueuer` from the E7 route module, `findJobById` from E7 `generation-job.repo`, `JobStatus` from shared).
- `app.ts`: `const pushSender = buildPushSender();` wrap each job enqueuer: `enqueue: notifyingEnqueuer(inlineWorkoutEnqueuer({engine}), 'workout', { sender: pushSender })` (and meal `'meal'`, inbody `'inbody'`). Route factories unchanged.

- [ ] **Step 1: Failing tests** — `notification.service.test.ts` (memory mongo: seed a user + device tokens; a FAKE sender records calls; `notifyJobComplete` sends to the user's tokens with the right localized title; no tokens → no send; sender that throws → does NOT throw) and `notifying-enqueuer.test.ts` (a fake inner that marks a job DONE → the wrapper calls the fake notifier's complete; inner that throws with the job left FAILED → wrapper still notifies error and rethrows the inner error). Use a fake `PushSender`.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** all modules; wire `app.ts` (`.js` imports; no `any`; swallow notification errors).
- [ ] **Step 4: Run — expect PASS**; `pnpm typecheck && pnpm build && pnpm test` green. (If `lib/firebase.ts` doesn't already export an app getter, add a small `export function getFirebaseApp()` there — do not change existing verify behavior.)
- [ ] **Step 5: Commit — Ngọc Danh**

```bash
git add apps/api/src/modules/notification/push-sender.ts apps/api/src/modules/notification/push-sender.factory.ts apps/api/src/modules/notification/notification.service.ts apps/api/src/modules/notification/notification.service.test.ts apps/api/src/modules/notification/notifying-enqueuer.ts apps/api/src/modules/notification/notifying-enqueuer.test.ts apps/api/src/app.ts apps/api/src/lib/firebase.ts
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "feat(api): send FCM on job complete/error via notifying enqueuer"
```

---

### Task 4: Workout reminder service + cron endpoint — TDD — [Quan]

**Files:** create `reminder.service.ts`, `reminder.service.test.ts`, `cron.routes.ts`, `cron.routes.test.ts`; modify `app.ts`.

**Interfaces — Produces:**
- `reminder.service.ts`:
  - `findUsersDueForWorkoutReminder(now: Date, thresholdDays = 3): Promise<string[]>` — the set of `userId`s that (a) have ≥1 device token, (b) have ≥1 **completed** `training_session`, and (c) whose most recent completed session `finishedAt` (or `startedAt` if unset) is older than `now - thresholdDays`. (Query `device_tokens` distinct userIds; per user, look up the latest completed session.)
  - `sendWorkoutReminders(now: Date, deps: { sender: PushSender }): Promise<{ notified: number }>` — for each due user, `listTokens` + send a localized "time to train" `PushMessage` (add a `reminder` entry to a message map with en/vi); swallow per-user send errors; return the count attempted.
- `cron.routes.ts`: `makeCronRoutes({ sender }): Hono` — applies `internalAuth()` on `'*'`; `POST /workout-reminders` → `sendWorkoutReminders(new Date(), { sender })` → `apiSuccess(result)`.
- `app.ts`: mount `app.route('/internal/cron', makeCronRoutes({ sender: pushSender }))` before `notFound`.

- [ ] **Step 1: Failing tests** — `reminder.service.test.ts` (memory mongo: a user with a token + a completed session 5 days ago is due; a user trained today is not; a user with a token but no completed session is not; `sendWorkoutReminders` notifies the due one via a fake sender) and `cron.routes.test.ts` (without the `X-CloudTasks-QueueName`/internal header → 401; with it → 200 `apiSuccess({ notified })`). Pass `now` explicitly to make "days ago" deterministic.

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** both modules + wire `app.ts` (`.js` imports; reuse E10 `listTokens`, `PushSender`, E1 `internalAuth`; `noUncheckedIndexedAccess` guards; no `any`).
- [ ] **Step 4: Run — expect PASS**; `pnpm typecheck && pnpm build && pnpm test` green.
- [ ] **Step 5: Commit — Quan**

```bash
git add apps/api/src/modules/notification/reminder.service.ts apps/api/src/modules/notification/reminder.service.test.ts apps/api/src/modules/notification/cron.routes.ts apps/api/src/modules/notification/cron.routes.test.ts apps/api/src/app.ts
git -c user.name="Luong Hong Quan" -c user.email="lhongquan.1998@gmail.com" commit -m "feat(api): add workout reminder service and cron endpoint"
```

---

### Task 5: Docs — README endpoints + roadmap — [Ngọc Danh]

- [ ] **Step 1: Read `README.md`, then update**
- Status: note E10 (notifications backend) complete.
- API Endpoints — add a **Notifications** subsection: `POST /api/notifications/device-token` (body `{ token, platform? }`; register an FCM token; 201), `DELETE /api/notifications/device-token/:token` (remove); and note that a bilingual push is sent automatically when a workout/meal/InBody generation job completes or fails. Add an internal `POST /internal/cron/workout-reminders` (internalAuth; triggered by Cloud Scheduler at deploy) that pushes "time to train" reminders to inactive users.
- Note: FCM sending uses firebase-admin (needs Firebase credentials, same as auth); notifications never block the job/HTTP flow and are covered by `pnpm test` with a fake sender.
- Roadmap: mark E10 Notifications ✅ (backend); note E10-S3 (FE FCM setup) → E13, Cloud Scheduler trigger → deploy.

- [ ] **Step 2: Commit — Ngọc Danh**

```bash
git add README.md
git -c user.name="Ngo Ngoc Danh" -c user.email="218212775+danh98it@users.noreply.github.com" commit -m "docs: document notifications endpoints and job-complete push"
```

---

## Self-Review

**1. Spec coverage (E10 backend):** E10-S1 device token API → T1/T2; E10-S2 FCM on job complete/error → T3 (service + `notifyingEnqueuer` wrapping the inline job enqueuers in `app.ts`, without touching E7/E8/E9 route factories or services); E10-S4 reminders → T4 (service + internal cron endpoint). E10-S3 UI + Cloud Scheduler trigger deferred (documented). Notifications never break the job/HTTP flow (swallowed).

**2. Placeholder scan:** service/sender/enqueuer specified by exhaustive Interfaces + explicit swallow-on-error + the localized `MESSAGES` map (concrete en/vi text); schema/repo steps have literal code + exact tests. Deferrals (Cloud Scheduler, FE, Cloud-Tasks-path notify) explicitly stated.

**3. Type consistency:** `DevicePlatform`/`zDeviceToken`/`zRegisterDeviceTokenInput` (T1) → repo/routes (T2). `PushSender`/`PushMessage`/`FcmPushSender` (T3) consumed by `NotificationService`, `notifyingEnqueuer` (T3), reminder service (T4), cron routes (T4), and `app.ts` wiring. `notifyingEnqueuer` reuses the E7 `TaskEnqueuer` type + `findJobById` + shared `JobStatus`; wraps the E7/E9/E8 inline enqueuers at `app.ts` (their route factories/tests untouched). Reuses E2 `findByAuthId` (user language) + E2 admin app, E1 `internalAuth`, E10 `listTokens`. `user.authId` matches E2. `.js` ESM; injected sender so tests need no Firebase.

**Assignees:** T1–T2 Thanh Minh (S1); T3, T5 Ngọc Danh (S2 + docs); T4 Quan (S4). Commit authors set per task.
