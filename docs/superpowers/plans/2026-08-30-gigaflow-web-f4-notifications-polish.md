# GigaFlow Web F4 — Notifications Settings + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — plain branch `web-f4-notifications` (already created).

**Goal:** Finish the app's product code (infra deferred): a Notifications settings screen (web-push register/unregister over existing device-token endpoints, messaging seam injected so it's testable) + three polish fast-follows (inline set editor, shared preset picker, robust date handling).

**Architecture:** Frontend-centric on `apps/web`, with one contained `packages/shared` change (date schemas → `z.coerce.date()`). Firebase Messaging added behind an injectable seam like the auth seam; a committed service-worker template. Verify by Vitest (web mocks `@/lib/api` + the seam; shared + api suites for the date task), typecheck, build. Real VAPID/delivery deferred to infra.

**Tech Stack:** React 18 + Vite + TS + Tailwind tokens + TanStack Query + Zustand + i18next; Firebase JS SDK (+ `firebase/messaging`); Vitest.

**Spec:** `docs/superpowers/specs/2026-08-30-gigaflow-web-f4-notifications-polish-design.md`

## Global Constraints

- TypeScript strict, NO `any`, `noUncheckedIndexedAccess`.
- `@gigaflow/shared` is the single source of truth; import existing types (`RegisterDeviceTokenInput`, `zDeviceToken`/`DeviceToken`, `DevicePlatform`). The ONE allowed shared change is the date task (§Task 5) — `z.date()` → `z.coerce.date()`.
- Reuse F0–F3: `apiFetch`, `queryClient`, primitives, `resolveTranslatable`, the injected-deps pattern from `authStore`, existing `home.preset*` i18n keys. `@/` alias → `apps/web/src`.
- Dark-only tokens; ≥44px; tnum for numeric inputs; en/vi i18n in sync via `TranslationSchema`.
- Tests: no real network/Firebase; mock `@/lib/api` and inject the messaging seam; deterministic; pristine. The messaging real-SDK helpers in `firebase.ts` and the service worker are NOT unit-tested (like the auth helpers).
- Each task ends green: `pnpm --filter @gigaflow/web build && pnpm --filter @gigaflow/web test` + root `pnpm typecheck`; **Task 5 additionally** `pnpm --filter @gigaflow/shared test` and `pnpm --filter @gigaflow/api test`.
- Conventional Commits. Author = assignee: Bảo Hân → `Đặng Bảo Hân <030537210074@st.buh.edu.vn>`; Thành Duy → `Duong Thanh Duy <duongduyy1512@gmail.com>`.

## File Structure
`apps/web/src/lib/{firebase.ts,api.ts}`; `apps/web/src/store/notificationStore.ts`; `apps/web/src/features/account/{AccountPage,NotificationsSettings}.tsx`; `apps/web/public/firebase-messaging-sw.js`; `apps/web/src/features/session/ActiveSessionPage.tsx` (+ `SetEditor`); `apps/web/src/features/plans/PresetPicker.tsx`; `apps/web/src/features/{home,plans}/*` (consume PresetPicker); `packages/shared/src/schemas/*`; `apps/web/src/{routes.ts,App.tsx,i18n/{en,vi}.ts}`.

---

### Task 1: Messaging seam + api helpers + notificationStore — TDD — [Thành Duy]

**Files:** modify `apps/web/src/lib/firebase.ts`, `apps/web/src/lib/api.ts`; create `apps/web/src/store/notificationStore.ts`, `apps/web/src/store/notificationStore.test.ts`; test `apps/web/src/lib/api.notif.test.ts`.

**Interfaces — Produces:**
- firebase.ts (real SDK, not unit-tested): `getMessagingToken(vapidKey: string): Promise<string | null>` (guard `isSupported()`; request permission; register `/firebase-messaging-sw.js` via `navigator.serviceWorker.register` and pass it as `serviceWorkerRegistration` to `getToken({vapidKey, serviceWorkerRegistration})`; return null on denied/unsupported), `onForegroundMessage(cb): () => void`, `deleteMessagingToken(): Promise<void>`. Reads `import.meta.env.VITE_FIREBASE_VAPID_KEY`.
- api.ts: `registerDeviceToken(input: RegisterDeviceTokenInput, fetchImpl?)` → `POST /notifications/device-token` → `zDeviceToken`; `deleteDeviceToken(token: string, fetchImpl?)` → `DELETE /notifications/device-token/:token` → `z.object({deleted: z.boolean()})`.
- `notificationStore` (Zustand): state `{ status:'idle'|'enabling'|'enabled'|'denied'|'error'|'disabling'; token?; error? }`; actions `enable(deps?)`, `disable(deps?)`, `init(deps?)`; `deps = { getMessagingToken, deleteMessagingToken, registerDeviceToken, deleteDeviceToken }` (defaults wire firebase.ts + api, resolved lazily via dynamic import so importing the store in a test does NOT load the firebase SDK — mirror how `authStore` does its default deps).

- [ ] **Step 1: Read** `apps/web/src/store/authStore.ts` (the lazy-dynamic-import default-deps pattern + Zustand style) and `apps/web/src/lib/api.ts` (helper style). Confirm `zDeviceToken`/`RegisterDeviceTokenInput`/`DevicePlatform` exports and the DELETE response `{deleted:boolean}`.

- [ ] **Step 2: Failing api test — `api.notif.test.ts`** (fake fetchImpl):
```typescript
it('registerDeviceToken posts token+platform', async () => {
  let seen: Request | undefined;
  const dt = { id:'d1', userId:'u1', token:'t1', platform:'web', createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
  const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => { seen = new Request(i, init); return new Response(JSON.stringify({ success:true, data: dt }), { status:201 }); }) as typeof fetch;
  const out = await registerDeviceToken({ token:'t1', platform: DevicePlatform.WEB }, fetchImpl);
  expect(out.token).toBe('t1'); expect(seen?.method).toBe('POST'); expect(new URL(seen!.url).pathname).toContain('/notifications/device-token');
});
it('deleteDeviceToken DELETEs the token', async () => {
  let seen: Request | undefined;
  const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => { seen = new Request(i, init); return new Response(JSON.stringify({ success:true, data:{ deleted:true } }), { status:200 }); }) as typeof fetch;
  expect((await deleteDeviceToken('t1', fetchImpl)).deleted).toBe(true); expect(seen?.method).toBe('DELETE');
});
```
Run: `pnpm --filter @gigaflow/web test api.notif` → FAIL.

- [ ] **Step 3: Implement** the two api helpers. Run → PASS.

- [ ] **Step 4: Failing store test — `notificationStore.test.ts`** (all deps faked; firebase SDK never loaded):
```typescript
const deps = { getMessagingToken: async () => 'fcm1', deleteMessagingToken: async () => {}, registerDeviceToken: async () => ({ id:'d', userId:'u', token:'fcm1', platform:'web', createdAt:new Date(), updatedAt:new Date() }), deleteDeviceToken: async () => ({ deleted:true }) };
it('enable registers a token and becomes enabled', async () => {
  await useNotificationStore.getState().enable(deps);
  const s = useNotificationStore.getState();
  expect(s.status).toBe('enabled'); expect(s.token).toBe('fcm1');
});
it('enable with denied permission becomes denied', async () => {
  await useNotificationStore.getState().enable({ ...deps, getMessagingToken: async () => null });
  expect(useNotificationStore.getState().status).toBe('denied');
});
it('disable clears the token', async () => {
  await useNotificationStore.getState().enable(deps);
  await useNotificationStore.getState().disable(deps);
  expect(useNotificationStore.getState().status).toBe('idle'); expect(useNotificationStore.getState().token).toBeUndefined();
});
```
Run → FAIL.

- [ ] **Step 5: Implement `notificationStore`** — `enable`: 'enabling'; `getMessagingToken(vapid)` (read `import.meta.env.VITE_FIREBASE_VAPID_KEY` in the default dep) → null ⇒ 'denied'; else `registerDeviceToken({token, platform: DevicePlatform.WEB})`, persist token to `localStorage['gf.fcmToken']` (try/catch), 'enabled'. `disable`: 'disabling'; read stored token; if present `deleteDeviceToken(token)` + `deleteMessagingToken()`; clear localStorage; 'idle'. `init`: set status/token from stored token + (guarded) `Notification.permission` ('enabled' if a stored token + granted; 'denied' if permission denied; else 'idle'). Errors → 'error' + message. Default deps lazily `await import('../lib/firebase')`/`'../lib/api'`. No `any`. Run → PASS.

- [ ] **Step 6: Verify + commit — Thành Duy.**
```bash
pnpm --filter @gigaflow/web build && pnpm typecheck
git add apps/web/src/lib apps/web/src/store/notificationStore.ts apps/web/src/store/notificationStore.test.ts
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): add messaging seam, device-token api, and notification store"
```

---

### Task 2: NotificationsSettings + AccountPage + SW template — TDD — [Bảo Hân]

**Files:** create `apps/web/src/features/account/{AccountPage.tsx,NotificationsSettings.tsx,account.test.tsx}`, `apps/web/public/firebase-messaging-sw.js`; modify `apps/web/src/{App.tsx}`, `apps/web/src/i18n/{en,vi}.ts`.

**Interfaces — Consumes:** `notificationStore` (Task 1), existing `UpgradePrompt`, primitives, `ROUTES.account`. **Produces:** `AccountPage` (route `/account`), `NotificationsSettings`.

- [ ] **Step 1: Failing test — `account.test.tsx`** (drive `useNotificationStore` state directly; MemoryRouter):
  - status 'idle' → an "Enable reminders" button; clicking it calls the store's `enable` (spy/mock the action).
  - status 'enabled' → a "Disable reminders" button; clicking calls `disable`.
  - status 'denied' → shows the denied hint.
  - `AccountPage` renders both `NotificationsSettings` and the existing `UpgradePrompt` (assert an element from each).

Run → FAIL.

- [ ] **Step 2: Implement** `NotificationsSettings` (reads `useNotificationStore`; toggle button per status; spinner while enabling/disabling; denied/error hint; `notif.*` i18n) + `AccountPage` (composes `UpgradePrompt` + `NotificationsSettings`, calls `notificationStore.init()` on mount). Point `/account` at `<AccountPage/>` in `App.tsx`. Add `notif.*` keys (title, description, enable, disable, deniedHint, error, navnothing) to en+vi. Create `public/firebase-messaging-sw.js` — a compat-SDK template (`importScripts` firebase-app-compat + firebase-messaging-compat, `initializeApp` with the public web config placeholders, `onBackgroundMessage` → `registration.showNotification`), with a header comment that it needs the real Firebase config to function. Run → PASS; `pnpm --filter @gigaflow/web build` green (SW is a static public asset; confirm the build still succeeds and doesn't error on it).

- [ ] **Step 3: Commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/features/account apps/web/public/firebase-messaging-sw.js apps/web/src/App.tsx apps/web/src/i18n
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "feat(web): add notifications settings and account page"
```

---

### Task 3: Inline set editor — TDD — [Thành Duy]

**Files:** create `apps/web/src/features/session/SetEditor.tsx`; modify `apps/web/src/features/session/ActiveSessionPage.tsx`; modify `apps/web/src/features/session/active-session.test.tsx`; i18n `apps/web/src/i18n/{en,vi}.ts`.

**Interfaces — Produces:** `SetEditor({ initial:{weightKg:number;repsDone:number}, onSave:(v:{weightKg:number;repsDone:number})=>void, onCancel:()=>void })` — weight + reps number inputs (tnum, ≥44px), Save/Cancel.

- [ ] **Step 1: Read** ActiveSessionPage.tsx around lines 165–185 (the current `window.prompt`-based `handleSetEdit`) to see how slotId/setIndex + `sessionStore.editSet` are wired.

- [ ] **Step 2: Failing test** — extend `active-session.test.tsx`: trigger a set's edit (open the inline `SetEditor` — via the SetBox `onEdit`/a dedicated edit affordance), change weight to 90, Save → assert the session store's set now has `weightKg: 90` and status 'edited' (and `logSets` on Finish carries it). No `window.prompt`. Run → FAIL (or the old prompt-based test is replaced).

- [ ] **Step 3: Implement** `SetEditor` + wire it into ActiveSessionPage: replace `handleSetEdit`'s two `window.prompt` calls with opening the inline editor for the `(slotId, setIndex)`; on Save call `sessionStore.editSet(slotId, setIndex, {weightKg, repsDone})` and close. Remove both `window.prompt` lines. i18n the labels (`session.editWeight`/`session.editReps`/`session.save`/`session.cancel` — reuse existing keys where present). No `any`. Run → PASS; build green.

- [ ] **Step 4: Commit — Thành Duy.**
```bash
pnpm typecheck
git add apps/web/src/features/session apps/web/src/i18n
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(web): replace window.prompt set edit with inline editor"
```

---

### Task 4: Shared PresetPicker — TDD — [Bảo Hân]

**Files:** create `apps/web/src/features/plans/PresetPicker.tsx`; modify `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/features/plans/PlansPage.tsx`; modify their tests as needed.

**Interfaces — Produces:** `PresetPicker({ onCreated? }: { onCreated?: () => void })` — renders the 3 preset buttons (PPL / Upper-Lower / Full-body via `home.presetPpl/presetUpperLower/presetFullBody`), a `useMutation(createPlanFromTemplate)` that on success invalidates `['plans']` + `['activePlan']` and calls `onCreated?`.

- [ ] **Step 1: Failing test** — a `preset-picker` test (or fold into an existing page test): render `PresetPicker` (QueryClientProvider), click a preset → `createPlanFromTemplate` called with that `PlanTemplateType`; on success `onCreated` fires. Run → FAIL.

- [ ] **Step 2: Implement** `PresetPicker`; refactor `HomePage` (empty-state) and `PlansPage` (header action) to render `<PresetPicker onCreated={...}/>` and DELETE their duplicated `PRESETS` arrays + preset mutations + button rows. Keep each page's other behavior. Update `home.test.tsx`/`plans-page.test.tsx` assertions to the shared component (the "clicking a preset calls createPlanFromTemplate" assertions still hold). No `any`. Run → PASS; build green.

- [ ] **Step 3: Commit — Bảo Hân.**
```bash
pnpm typecheck
git add apps/web/src/features/plans/PresetPicker.tsx apps/web/src/features/home apps/web/src/features/plans
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "refactor(web): extract shared PresetPicker for Home and Plans"
```

---

### Task 5: Date handling — coerce.date + drop web reviver — TDD — [Thành Duy]

**Files:** modify `packages/shared/src/schemas/{ai,inbody,meal,notification,plan,session,subscription,user,weight}.ts`; modify `apps/web/src/lib/api.ts`; test `packages/shared/src/schemas/common.test.ts` (or a new date test) + `apps/web/src/lib/api.test.ts`.

**Interfaces — Produces:** shared timestamp fields accept a Date OR an ISO string; the web api client no longer coerces via a JSON reviver.

- [ ] **Step 1: Failing shared test** — a test asserting a representative schema (e.g. `zWeightLog` / `zUser`) `.parse()` succeeds with `createdAt`/`loggedAt` given as an ISO string AND as a `Date`, both yielding a `Date` instance. Run: `pnpm --filter @gigaflow/shared test` → FAIL (current `z.date()` rejects the string).

- [ ] **Step 2: Failing web test** — in `api.test.ts`, a response whose payload has a real date field (ISO string → becomes `Date`) AND a free-text `z.string()` field holding a strict ISO-8601 string (must STAY a string) → assert the date field is a `Date` and the string field is still a string. (Pick a schema with both, e.g. a session with `notes`.) Run → FAIL (current blanket reviver coerces the notes string to a Date, failing `z.string()`).

- [ ] **Step 3: Implement** — replace every `z.date()` with `z.coerce.date()` across the 9 schema files (17 sites; grep to confirm none missed). In `api.ts`, remove `ISO_DATE_RE` + `reviveDates` and parse with plain `JSON.parse(text)`. Build shared. Run the shared + web tests → PASS.

- [ ] **Step 4: Full verification** — run **all three** suites: `pnpm --filter @gigaflow/shared test`, `pnpm --filter @gigaflow/api test`, `pnpm --filter @gigaflow/web test`, and root `pnpm typecheck` — all green. If an api test regresses, fix the test's expectation to the correct `Date`-coercion behavior (do NOT reintroduce the reviver). Run → all PASS.

- [ ] **Step 5: Commit — Thành Duy.**
```bash
git add packages/shared/src/schemas apps/web/src/lib/api.ts packages/shared/src/schemas/common.test.ts apps/web/src/lib/api.test.ts
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "fix(shared,web): coerce date schemas and drop fragile web JSON reviver"
```

---

### Task 6: Docs — README — [Bảo Hân]

**Files:** modify `README.md`.

- [ ] **Step 1:** Add a **Notifications** note under the Web app section: `/account` now has a Notifications settings section (enable/disable workout-reminder web push via `POST`/`DELETE /api/notifications/device-token`); note that actual push **delivery requires Firebase Cloud Messaging provisioning** (a real Firebase project, `VITE_FIREBASE_VAPID_KEY`, and the committed `firebase-messaging-sw.js`) — deferred to the infra phase. Mention the polish done (inline set editor, shared preset picker, `z.coerce.date()` date handling). Update the roadmap: frontend product code complete; remaining = notifications **delivery** + all GCP/Firebase/Atlas provisioning + deploy (infra). Verify names against the code.
- [ ] **Step 2: Commit — Bảo Hân.**
```bash
git add README.md
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "docs: document notifications settings and F4 polish"
```

---

## Self-Review

**1. Spec coverage:** messaging seam + api + store (T1); NotificationsSettings + AccountPage + SW (T2); inline set editor (T3); shared PresetPicker (T4); date fix across shared+web (T5); docs (T6). Non-goals (real VAPID/delivery, reminder scheduling, native push, notif history) left out per spec §6. Every spec §3/§4 piece mapped.

**2. Placeholder scan:** store/api/date have full code + concrete tests; UI tasks give exact props + concrete assertions + token/i18n rules; the SW is a described template (real-SDK, not unit-tested, like the auth helpers — stated). SW/PWA coexistence pinned: register `/firebase-messaging-sw.js` explicitly in `getMessagingToken` and keep it a static `public/` asset (independent of vite-plugin-pwa's SW). No vague directives.

**3. Type consistency:** `RegisterDeviceTokenInput`/`DeviceToken`/`DevicePlatform` from shared; `notificationStore` deps ({getMessagingToken,deleteMessagingToken,registerDeviceToken,deleteDeviceToken}) match firebase.ts (T1) + api (T1); `AccountPage` (T2) consumes the store; `SetEditor` (T3) feeds `sessionStore.editSet` (existing); `PresetPicker` (T4) uses `createPlanFromTemplate` + invalidates `['plans']`/`['activePlan']` (same keys HomePage/PlansPage used). T5 touches shared → run shared+api+web. Each task ends green on its suite(s) + typecheck. localStorage key `gf.fcmToken` consistent across enable/disable/init.

**Assignees:** T1,T3,T5 → Thành Duy; T2,T4,T6 → Bảo Hân.
