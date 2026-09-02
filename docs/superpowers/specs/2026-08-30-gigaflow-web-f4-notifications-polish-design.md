# GigaFlow Web F4 — Notifications Settings + Polish (Design)

**Date:** 2026-08-30
**Status:** Approved for implementation
**Scope:** The last remaining product code (infra deferred): a Notifications settings UI (web push register/unregister over the existing device-token endpoints) plus three carried-over polish fast-follows. Frontend-centric, with one contained `packages/shared` change for the date fix.

## 1. Goal

Finish the app's code surface. Add a Notifications settings screen so a user can enable/disable workout-reminder web push (request permission → obtain an FCM token → register it; disable → unregister). Build the full client flow and tests now, injecting the Firebase Messaging layer so it is testable; defer only the real VAPID key + push delivery (that is Firebase/infra provisioning). Also clear three quality items: an inline set editor (replace `window.prompt`), a shared preset-picker (dedupe Home/Plans), and a robust date-handling fix (drop the fragile web JSON reviver in favor of schema coercion).

## 2. Locked decisions

- **Notifications is code-complete but delivery-deferred.** The permission/token/register/unregister flow is built and unit-tested with an injected messaging seam (mirrors how `authStore` injects the auth seam). The service worker is committed as a template. What is deferred to the infra phase: the real Firebase project, the VAPID public key (`VITE_FIREBASE_VAPID_KEY`), and actual message delivery. Without them the toggle still runs its flow but the browser/SW won't receive real pushes.
- **Backend unchanged** except the shared date-schema tweak. Notification endpoints already exist: `POST /notifications/device-token` (`{token, platform?}`) and `DELETE /notifications/device-token/:token`. `DevicePlatform.WEB` is the platform sent.
- **Date fix = `z.coerce.date()` in shared, drop the web reviver.** All 17 `z.date()` timestamp fields across the 9 shared schemas become `z.coerce.date()` (accepts a Date — as Mongo returns on the api side — or an ISO string — as JSON delivers on the web side). The web api client then parses plain JSON (no `reviveDates`), and each schema coerces its own date fields; a free-text `z.string()` field holding an ISO-looking value stays a string (the bug the old blanket reviver could hit). Must keep **all three suites green** (shared, api, web).
- Stack unchanged: React + Vite + TS + Tailwind tokens + TanStack Query + i18next; Firebase JS SDK (add `firebase/messaging`). Tests: Vitest, mock `@/lib/api` and the messaging seam, no real network/Firebase.

## 3. Notifications — client flow & pieces

### 3.1 Messaging seam (`apps/web/src/lib/firebase.ts`)
Add (thin, real-SDK, NOT unit-tested — same treatment as the auth helpers): `getMessagingToken(vapidKey: string): Promise<string | null>` — request `Notification.permission` if needed; if granted, `getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration })`; return null if denied/unsupported. `onForegroundMessage(cb): () => void` — `onMessage`. `deleteMessagingToken(): Promise<void>` — `deleteToken`. Reads `import.meta.env.VITE_FIREBASE_VAPID_KEY`. Guard `isSupported()` (messaging unsupported in some browsers/SSR) and return a no-op/null gracefully.

### 3.2 Service worker (`apps/web/public/firebase-messaging-sw.js`)
A committed template: imports the compat messaging SDK, `initializeApp` from the same public web config (placeholders / read at build), `onBackgroundMessage` → `showNotification`. Documented as requiring the real Firebase config to function. `vite-plugin-pwa` must not clobber it (register it as an additional SW or keep it a static asset — configure so both the PWA SW and this messaging SW coexist, or fold background handling into the PWA SW if simpler; the plan picks the least-fragile option).

### 3.3 API helpers (`apps/web/src/lib/api.ts`)
`registerDeviceToken(input: RegisterDeviceTokenInput)` → `POST /notifications/device-token` → `zDeviceToken`; `deleteDeviceToken(token: string)` → `DELETE /notifications/device-token/:token` → `z.object({ deleted: z.boolean() })` (confirm the handler's response shape; match it).

### 3.4 State (`apps/web/src/store/notificationStore.ts`, Zustand + injected deps)
State `{ status: 'idle'|'enabling'|'enabled'|'denied'|'error'|'disabling'; token?: string; error?: string }`. Actions (deps injected: `{ getMessagingToken, deleteMessagingToken, registerDeviceToken, deleteDeviceToken }`, defaults wire firebase.ts + api): `enable()` — getMessagingToken(vapid) → null ⇒ 'denied'; else registerDeviceToken({token, platform: WEB}) → persist token in localStorage (`gf.fcmToken`) → 'enabled'. `disable()` — read stored token → deleteDeviceToken(token) + deleteMessagingToken() → clear localStorage → 'idle'. `init()` — reflect stored token + `Notification.permission` into status on load. Errors → 'error' with message. LocalStorage reads/writes wrapped in try/catch.

### 3.5 UI (`apps/web/src/features/account/`)
- `AccountPage.tsx` — the `/account` route becomes an account screen composing the existing `UpgradePrompt` (account upgrade) + a new `NotificationsSettings`. (Currently `/account` renders `UpgradePrompt` bare; wrap both.)
- `NotificationsSettings.tsx` — a card: title + explanation; a primary toggle button that reads `notificationStore.status`: 'idle'/'denied'/'error' → "Enable reminders" (calls `enable()`); 'enabled' → "Disable reminders" (calls `disable()`); shows a spinner while 'enabling'/'disabling'; a hint line for 'denied' ("allow notifications in your browser") and 'error'. Dark tokens, ≥44px, i18n `notif.*`.

## 4. Polish fast-follows

### 4.1 Inline set editor (`apps/web/src/features/session/ActiveSessionPage.tsx` + a `SetEditor`)
Replace the two `window.prompt` calls (ActiveSessionPage.tsx:173,175) with an inline editor: tapping a done/edited `SetBox` (its `onEdit`) opens a small inline form (weight + reps number inputs, tnum, ≥44px, prefilled from the current set) → Save calls `sessionStore.editSet(slotId, setIndex, {weightKg, repsDone})` → closes; Cancel closes. Component `SetEditor({ initial:{weightKg,repsDone}, onSave, onCancel })` (feature-local or shared). No `window.prompt` remains. i18n the labels. Keep the existing 2-tap logging behavior intact; add/adjust a test that editing via the inline form updates the set (no prompt).

### 4.2 Shared preset picker (`apps/web/src/features/plans/PresetPicker.tsx`)
Extract the duplicated preset row (identical `PRESETS` array + `createPlanFromTemplate` mutation + button row in `HomePage.tsx` and `PlansPage.tsx`) into one component: `PresetPicker({ onCreated? })` — renders the 3 preset buttons, runs the `createPlanFromTemplate` mutation, invalidates `['plans']` + `['activePlan']` on success, calls `onCreated?`. Both HomePage and PlansPage consume it; remove their local `PRESETS`/mutation duplicates. Reuse the existing `home.preset*` i18n keys (single source). Existing HomePage/Plans tests must still pass (adjust to the shared component where needed).

### 4.3 Date handling (`packages/shared/src/schemas/*` + `apps/web/src/lib/api.ts`)
Change every `z.date()` timestamp field to `z.coerce.date()` (9 files, 17 sites). Remove `reviveDates` + `ISO_DATE_RE` from `api.ts`; parse plain JSON (`JSON.parse(text)`), letting schemas coerce. Add a shared test proving `z.coerce.date()` accepts both a `Date` and an ISO string, and a web api test proving a response with a free-text field containing an ISO-8601 string keeps it a string while a real date field becomes a `Date`. **Run all three suites; all green.** If an api test regresses unexpectedly, the fallback is to keep `z.coerce.date()` (correct) and fix the test's expectation — do not revert to the blanket reviver.

## 5. Testing
- Notifications: `notificationStore` (enable→register→enabled+token persisted; denied path; disable→delete+clear; init reflects stored/permission) with injected deps — no real firebase. `NotificationsSettings`/`AccountPage` render (toggle reflects status; enable/disable call the store; UpgradePrompt still present). firebase.ts messaging + the SW are not unit-tested (real SDK/browser).
- Polish: inline `SetEditor` (edit updates the set, no prompt); `PresetPicker` (buttons call createPlanFromTemplate + invalidate; used by both pages — existing tests pass); date fix (shared coerce test + web string-vs-date test).
- Every task green on its suite(s) + `pnpm typecheck`; the date task green on shared + api + web.

## 6. Non-goals / deferred
- Real Firebase project / VAPID key / actual push delivery / verifying pushes in a browser (infra).
- Per-user reminder scheduling/time preferences — no backend endpoint exists (cron sends a fixed reminder); only enable/disable is offered.
- iOS/Android native push (`DevicePlatform.WEB` only here).
- Notification history/inbox UI.

## 7. Task decomposition (for writing-plans)
1. **Messaging seam + api helpers + notificationStore** (firebase.ts messaging fns; registerDeviceToken/deleteDeviceToken; notificationStore with injected deps) — TDD. [Thành Duy]
2. **NotificationsSettings + AccountPage + service-worker template** (+ `/account` → AccountPage, i18n `notif.*`) — TDD. [Bảo Hân]
3. **Inline set editor** (replace window.prompt in ActiveSessionPage) — TDD. [Thành Duy]
4. **Shared PresetPicker** (dedupe Home/Plans) — TDD. [Bảo Hân]
5. **Date fix** (shared `z.coerce.date()` + drop web reviver; shared+api+web green) — TDD. [Thành Duy]
6. **Docs** — README (Notifications settings; note delivery needs FCM infra) + roadmap. [Bảo Hân]

**Assignees:** 1,3,5 → Thành Duy; 2,4,6 → Bảo Hân.
