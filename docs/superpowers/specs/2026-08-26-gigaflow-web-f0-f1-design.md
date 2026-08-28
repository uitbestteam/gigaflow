# GigaFlow Web — F0 Foundation + F1 Core Training Loop (Design)

**Date:** 2026-08-26
**Status:** Approved for implementation
**Scope:** `apps/web` — the React PWA foundation (F0) and the core training-loop screens (F1). Later passes: F2 (plans & catalog UI), F3 (AI/meal/InBody/stats UI).

## 1. Goal

Stand up the GigaFlow web app: it boots, signs a guest in (Firebase anonymous), talks to the existing `/api` backend, and lets a user run the **core loop** — see today's plan, start a session with pre-filled targets, log sets 2-tap, finish, and see a summary with PRs. Dark, data-forward UI per `gymflow-docs/ui-design-prompt.md`.

## 2. Locked decisions

- **Stack:** Vite + React 18 + TypeScript; **Tailwind CSS + hand-built components** (CSS-variable design tokens; dark-only); **TanStack Query** (server state) + **Zustand** (session-local UI state); **React Router v6**; **i18next** (en/vi); **Firebase JS SDK** (auth); **vite-plugin-pwa**.
- **API/auth:** a typed `fetch` client that attaches the Firebase ID token as `Authorization: Bearer` and validates responses with **`@gigaflow/shared` Zod schemas** (single source; no `hono/client` cross-app wiring).
- **Firebase config** from `import.meta.env.VITE_FIREBASE_*` (public web config; provided by the user at run time). Tests mock Firebase + fetch.
- **Verification:** build + `pnpm typecheck` + Vitest (jsdom + Testing Library). No browser/visual verification this pass; components are built to the design tokens/structure.
- **Design language:** `gymflow-docs/ui-design-prompt.md` — palette, typography, 2-tap UX, component set.

## 3. `apps/web` structure

```
apps/web/
  index.html                      # replaces the placeholder
  vite.config.ts                  # React + PWA plugin + @ alias + vitest config (jsdom)
  tsconfig.json                   # extends base; DOM libs; @gigaflow/shared via src alias
  package.json                    # deps below
  .env.example                    # VITE_API_BASE_URL, VITE_FIREBASE_* (commented)
  src/
    main.tsx                      # bootstrap: providers + auth init + router
    App.tsx                       # router + protected shell
    styles/tokens.css             # CSS variables (the palette)  + Tailwind layers
    lib/
      firebase.ts                 # initApp from env; auth helpers (anon/google/password/link)
      api.ts                      # typed fetch client (Bearer + Zod-validated responses)
      queryClient.ts              # TanStack QueryClient
    store/
      authStore.ts                # Zustand: user, token, status
      sessionStore.ts             # Zustand: active-session set state + rest timer
    i18n/
      index.ts                    # i18next init
      en.ts / vi.ts               # message catalogs
    components/                   # design-system primitives (Tailwind + tokens)
      Button.tsx, Card.tsx, Spinner.tsx, ColorDot.tsx, ...
      SetBox.tsx, ExerciseRow.tsx, SessionQueueItem.tsx, ProgressionBadge.tsx, SummaryRow.tsx, RestTimer.tsx, RirPicker.tsx
    features/
      auth/         AuthGate.tsx, UpgradePrompt.tsx, hooks
      home/         HomePage.tsx (+ empty-state preset bootstrap)
      session/      ActiveSessionPage.tsx, SummaryPage.tsx, hooks
    routes.ts                     # path constants + route config
```

## 4. Design tokens (`styles/tokens.css`) — from the design prompt

`:root` CSS variables (dark-only): `--bg #0f0f0f`, `--surface #1a1a1a`, `--surface-elevated #242424`, `--border-subtle #2a2a2a`, `--border #333333`, `--text #f0f0f0`, `--text-secondary #888888`, `--text-muted #555555`, `--accent #3b82f6` (target/blue), `--success #22c55e` (done/green), `--warning #f59e0b` (hold/amber), `--push #ef4444`, `--pull #22c55e`, `--legs #f59e0b`. Typography: `font-family` Inter/system-ui; numbers/set-values `font-variant-numeric: tabular-nums`; touch targets ≥ 44px; respect `prefers-reduced-motion`. Tailwind `theme.extend.colors` maps to these vars so utilities like `bg-surface`/`text-accent` work.

## 5. F0 — Foundation

### 5.1 API client (`lib/api.ts`)
- `apiFetch<T>(path, { method, body, schema })` — prefixes `VITE_API_BASE_URL` (default `/api`); sets `Authorization: Bearer <token>` from the auth store's current token (via a `getToken()` injectable so tests don't need Firebase); parses the `{ success, data, message }` envelope; on `success:false`/non-2xx throws `ApiError(status, message)`; when a Zod `schema` is passed, `schema.parse(json.data)` (reusing `@gigaflow/shared`). Typed helpers per endpoint (e.g. `getActivePlan()`, `startSession(templateId)`, `logSets(id, sets)`, `finishSession(id)`, `createPlanFromTemplate(t)`, `getPrs()`, `postAuthSession()`).
- On 401, call the auth store's `refreshToken()` once and retry; if still 401, surface an auth error.

### 5.2 Firebase auth (`lib/firebase.ts` + `store/authStore.ts`)
- `initFirebase()` from `VITE_FIREBASE_*`; `ensureSignedIn()` → `signInAnonymously` if no current user; `getIdToken()`; `linkGoogle()` (`linkWithPopup`/`GoogleAuthProvider`), `linkEmailPassword(email,pw)` (`linkWithCredential`/`EmailAuthProvider`); `signOutUser()`.
- `authStore` (Zustand): `{ status: 'loading'|'guest'|'user'|'error', firebaseUid, token, user (from POST /auth/session), isGuest }` + actions `bootstrap()` (ensureSignedIn → getToken → postAuthSession → set user), `refreshToken()`, `upgradeGoogle()`, `upgradeEmail()`. The api client reads `token` via an injected getter.
- Boot flow (`main.tsx`): render a splash while `bootstrap()` runs; then the router. Tests mock the firebase module.

### 5.3 App shell + routing (`App.tsx`, `routes.ts`)
- Routes: `/` Home, `/session/:id` ActiveSession, `/session/:id/summary` Summary, `/account` (UpgradePrompt). All are "protected" = require a resolved auth state (guest counts). A `<MainLayout>` provides the dark app frame + header (app name + a language toggle + an account/upgrade entry).
- `AuthGate`: while `status==='loading'` show a splash; on `error` show a retry.

### 5.4 i18n, PWA
- i18next init with `en`/`vi` catalogs + a `localeStore` (persist choice). All F1 copy uses keys; `Translatable {en,vi}` server fields render by current language.
- vite-plugin-pwa: manifest (name, dark theme color, icons placeholder), workbox app-shell precache; an install prompt component (lightweight).

## 6. F1 — Core training loop

### 6.1 Home / Today (`features/home/HomePage.tsx`)
- `useQuery(getActivePlan)` → if a plan exists, render its templates as a **queue** of `SessionQueueItem` (colored dot by `colorTag`, name, status: done/next/upcoming — "next" = the first not-yet-done this cycle; for F1, without per-cycle history, treat all as "upcoming" and highlight the first, and mark a template "done" if there's a completed session for it today via `/api/sessions/active` is not enough — keep it simple: highlight the first template as "next", others "upcoming"; a later pass refines done-state). CTA **"Start <template>"** → `startSession(templateId)` → navigate `/session/:id` carrying the start result via router state or a query cache entry.
- **Empty state** (no active plan): a card offering the three presets (PPL / Upper-Lower / Full-body) → `createPlanFromTemplate(type)` → refetch. (Minimal bootstrap borrowed from F2 so the loop works.)

### 6.2 Active Session (`features/session/ActiveSessionPage.tsx` + `sessionStore`)
- Source: the `startSession` result (`{ session, slots }`) — read from the query cache / router state; if absent (reload), refetch `getActivePlan` + `/sessions/active` to reconstruct (or redirect Home). `sessionStore` holds per-slot set state: for each slot, `setsTarget` boxes each `{ status: pending|active|done|edited, weightKg, repsDone, restSeconds?, rir? }` seeded from `weightSuggested/repsSuggested`.
- **Interactions:** `SetBox` grid (72×56, 4/row); tap a pending/active box → mark **done** with the target values (green); tap a done box → inline edit (weight/reps) → amber "edited" dot; the "prev vs target" line via `ProgressionBadge` (from `slot.lastSets`). Header: session name + `#sessionNumber` + count-up timer + a "Finish" text button; a progress bar `N/total exercises`.
- **Rest timer** (`RestTimer.tsx`): after a set is marked done, a Pause/Resume countdown starts (default by nothing fancy — a fixed 90s default, adjustable ±15s); on expiry a subtle cue (respect reduced-motion); records `restSeconds` onto the just-finished set.
- **RIR** (`RirPicker.tsx`, optional): after marking a set done, an optional 3-choice picker (🙂 3+ / 💪 1–2 / 😮‍💨 0) sets `rir`; skippable (never blocks).
- **Finish:** `logSets(id, <all logged sets flattened to LogSetInput[]>)` then `finishSession(id)` → navigate `/session/:id/summary`. Cancel → `POST /sessions/:id/cancel` → Home.

### 6.3 Session Summary (`features/session/SummaryPage.tsx`)
- From the finished `TrainingSession` (durationSeconds, totalVolume, totalSets) + `useQuery(getPrs)`: header "✓ <template> done", duration, total volume; `SummaryRow` per exercise (name + "N sets · avg kg"), **PR badge** (amber) when that exercise appears in `/api/stats/prs` as a fresh best; CTA "Back to home".

## 7. Components (design-system, `components/`)
`Button`, `Card`, `Spinner`, `ColorDot(colorTag)`, `LanguageToggle`; and the domain primitives from the design prompt: `SessionQueueItem(session,status,onStart)`, `ExerciseRow(slot, sets, status, onSetTap, onSetEdit)`, `SetBox(target, actual, status, onTap, onEdit)`, `ProgressionBadge(lastSet)`, `SummaryRow(exercise, sets, hasPR)`, `RestTimer`, `RirPicker`. All Tailwind + tokens, ≥44px touch targets, tabular-nums for numbers, keyboard-accessible, reduced-motion safe.

## 8. Testing
Vitest + jsdom + @testing-library/react. Cover: `api.ts` (Bearer attach, envelope parse, Zod validate, 401-retry — fetch mocked); `authStore` (bootstrap/upgrade with firebase mocked); `sessionStore` (set state transitions: tap→done, edit→edited, rest/rir recording, flatten to `LogSetInput[]`); key components (`SetBox` states, `SessionQueueItem`, `SummaryRow` PR badge); a HomePage + ActiveSession render/flow test with the api client mocked. No real network/Firebase.

## 9. Deferred (later passes)
F2: full plan builder/PlanSetup + exercise library (search/filter/custom). F3: AI generate-plan flow UI, meal planner UI, InBody capture (+ client image validation), stats/awards dashboard. Also deferred: real Firebase project config (user-provided), browser/visual QA, service-worker offline data (only app-shell precache now).

## 10. Task decomposition (for writing-plans)
**F0:** (1) scaffold apps/web (Vite/TS/Tailwind/PWA/vitest) + tokens; (2) design-system primitives; (3) firebase auth lib + authStore (TDD, mocked); (4) typed api client (TDD, mocked) + queryClient; (5) i18n + app shell/router + AuthGate/MainLayout + UpgradePrompt.
**F1:** (6) sessionStore (set-state machine, TDD); (7) domain components (SetBox/ExerciseRow/SessionQueueItem/ProgressionBadge/SummaryRow/RestTimer/RirPicker); (8) HomePage + preset bootstrap; (9) ActiveSessionPage (2-tap + rest + rir + finish); (10) SummaryPage; (11) docs (README web section + .env.example).

**Assignees:** design-system/auth-UI/summary/rest-timer → Bảo Hân; api/store/home/active-session/generate → Thành Duy; scaffold/i18n/docs → split (Bảo Hân scaffold+i18n, Thành Duy stores). (Set per task in the plan.)
