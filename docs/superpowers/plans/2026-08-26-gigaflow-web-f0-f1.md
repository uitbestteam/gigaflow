# GigaFlow Web F0+F1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — plain branch `web-f0f1` (already created).

**Goal:** Build the `apps/web` React PWA foundation (F0) and the core training-loop screens (F1) — boot → guest sign-in → talk to `/api` → Home/Today → start session → 2-tap logging → finish → summary with PRs.

**Architecture:** Vite + React + TS PWA; Tailwind + hand-built components on CSS-variable tokens (dark-only, per the design prompt); TanStack Query (server) + Zustand (session-local); typed `fetch` client validating responses with `@gigaflow/shared` Zod schemas; Firebase JS SDK auth (anonymous→link) injected so tests mock it. Verify by build + typecheck + Vitest (jsdom); no browser QA.

**Tech Stack:** React 18, Vite 5, TypeScript, Tailwind v3, TanStack Query v5, Zustand, React Router v6, i18next/react-i18next, firebase v11, vite-plugin-pwa, Vitest + @testing-library/react + jsdom.

**Spec:** `docs/superpowers/specs/2026-08-26-gigaflow-web-f0-f1-design.md`

## Global Constraints

- Node ≥ 20; pnpm workspaces; TypeScript strict, NO `any`, explicit exported types.
- Dark-only; design tokens per `gymflow-docs/ui-design-prompt.md` (bg `#0f0f0f`, accent/blue `#3b82f6`=target, success/green `#22c55e`=done, warning/amber `#f59e0b`=hold; tabular-nums for numbers; touch targets ≥ 44px; wrap animations in `prefers-reduced-motion`).
- Reuse `@gigaflow/shared` Zod schemas/types (import `@gigaflow/shared`) — never redefine server shapes.
- No real network/Firebase in tests — inject/mock them. Every task ends green: `pnpm --filter @gigaflow/web build && pnpm --filter @gigaflow/web test && pnpm typecheck` (root turbo).
- `.js` extensions are NOT needed in `apps/web` (bundler resolution via Vite/Vitest); use normal TS imports + the `@/` alias for `src`.
- Commit author = the task's assignee. Bảo Hân → `Đặng Bảo Hân <030537210074@st.buh.edu.vn>`; Thành Duy → `Duong Thanh Duy <duongduyy1512@gmail.com>`. Conventional Commits.

---

## File Structure
(see spec §3 — this plan creates those files across the tasks below.)

---

### Task 1: Scaffold `apps/web` (Vite + TS + Tailwind + PWA + Vitest) + tokens — [Bảo Hân]

**Files:** create `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,postcss.config.js,tailwind.config.js,.env.example}`, `apps/web/src/{main.tsx,App.tsx,styles/tokens.css}`, `apps/web/src/smoke.test.tsx`.

**Interfaces — Produces:** a buildable Vite React app; `@/` → `apps/web/src` alias (vite + tsconfig + vitest); Tailwind with `theme.extend.colors` mapping to CSS vars; a passing smoke test proving jsdom + Testing Library work.

- [ ] **Step 1: `apps/web/package.json`**

```json
{
  "name": "@gigaflow/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gigaflow/shared": "workspace:*",
    "@tanstack/react-query": "^5.59.0",
    "firebase": "^11.0.0",
    "i18next": "^23.16.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-i18next": "^15.1.0",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json`** (extends base; DOM libs; `@/` paths; jsx)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: `vite.config.ts`** (React + PWA + `@` alias + vitest jsdom)

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'GigaFlow', short_name: 'GigaFlow', theme_color: '#0f0f0f', background_color: '#0f0f0f', display: 'standalone', icons: [] } })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/test-setup.ts'] },
});
```

- [ ] **Step 4: `src/test-setup.ts`** → `import '@testing-library/jest-dom';`

- [ ] **Step 5: `postcss.config.js`** (`export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`) and **`tailwind.config.js`**:

```javascript
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-elevated': 'var(--surface-elevated)',
        'border-subtle': 'var(--border-subtle)', border: 'var(--border)',
        text: 'var(--text)', 'text-secondary': 'var(--text-secondary)', 'text-muted': 'var(--text-muted)',
        accent: 'var(--accent)', success: 'var(--success)', warning: 'var(--warning)',
        push: 'var(--push)', pull: 'var(--pull)', legs: 'var(--legs)',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['ui-monospace', 'monospace'] },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: `src/styles/tokens.css`** — `@tailwind base/components/utilities;` + `:root { --bg:#0f0f0f; --surface:#1a1a1a; --surface-elevated:#242424; --border-subtle:#2a2a2a; --border:#333333; --text:#f0f0f0; --text-secondary:#888888; --text-muted:#555555; --accent:#3b82f6; --success:#22c55e; --warning:#f59e0b; --push:#ef4444; --pull:#22c55e; --legs:#f59e0b; }` + `body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;} .tnum{font-variant-numeric:tabular-nums;}`

- [ ] **Step 7: `index.html`** (root div + `<script type=module src=/src/main.tsx>`), **`src/main.tsx`** (render `<App/>` into `#root`, import tokens.css), **`src/App.tsx`** (`export function App(){ return <div>GigaFlow</div>; }`).

- [ ] **Step 8: `src/smoke.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import { App } from './App';
it('renders app', () => { render(<App />); expect(screen.getByText('GigaFlow')).toBeInTheDocument(); });
```

- [ ] **Step 9:** `pnpm install`; run `pnpm --filter @gigaflow/web test` (smoke passes), `pnpm --filter @gigaflow/web build` green, root `pnpm typecheck` clean.
- [ ] **Step 10: Commit — Bảo Hân**

```bash
git add apps/web pnpm-lock.yaml
git -c user.name="Đặng Bảo Hân" -c user.email="030537210074@st.buh.edu.vn" commit -m "chore(web): scaffold Vite React PWA app with Tailwind tokens"
```

---

### Task 2: Design-system primitives — [Bảo Hân]

**Files:** create `apps/web/src/components/{Button.tsx,Card.tsx,Spinner.tsx,ColorDot.tsx,LanguageToggle.tsx}` + `apps/web/src/components/primitives.test.tsx`.

**Interfaces — Produces:** `Button({variant?:'solid'|'ghost', ...})`, `Card`, `Spinner`, `ColorDot({tag: ColorTag})` (maps push/pull/legs/upper/lower/full/custom → bg color class), `LanguageToggle` (uses i18n later — for now a controlled toggle stub taking `value/onChange`). All Tailwind + tokens, ≥44px targets.

- [ ] **Step 1: Failing test** — render `Button` (has role button, applies solid classes), `ColorDot` for `ColorTag.PUSH` has the push color class, `Spinner` present.

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';
import { ColorDot } from './ColorDot';
import { ColorTag } from '@gigaflow/shared';
it('renders a solid button', () => { render(<Button>Go</Button>); expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument(); });
it('color dot uses tag color', () => { const { container } = render(<ColorDot tag={ColorTag.PUSH} />); expect(container.firstChild).toHaveClass('bg-push'); });
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** the primitives (Tailwind classes off the tokens; `Button` height ≥44px `min-h-11`, `rounded-[10px]`, solid=`bg-accent text-white`, ghost=`text-text-secondary`; `ColorDot` 28px circle, `bg-{tag}` via a map; `Spinner` a reduced-motion-safe spinner). No `any`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Bảo Hân** (`feat(web): add design-system primitives`).

---

### Task 3: Firebase auth lib + authStore — TDD — [Bảo Hân]

**Files:** create `apps/web/src/lib/firebase.ts`, `apps/web/src/store/authStore.ts`, `apps/web/src/store/authStore.test.ts`.

**Interfaces — Produces:**
- `firebase.ts`: `initFirebase()`, `ensureSignedIn(): Promise<string /*uid*/>`, `getIdToken(): Promise<string>`, `linkGoogle(): Promise<void>`, `linkEmailPassword(email,password): Promise<void>`, `onAuthChanged(cb)`. Reads `import.meta.env.VITE_FIREBASE_*`. This module is **mocked in tests**.
- `authStore.ts` (Zustand): state `{ status:'loading'|'guest'|'user'|'error'; uid?:string; token?:string; user?:User; isGuest:boolean }`; actions `bootstrap(deps?)`, `refreshToken(deps?)`, `upgradeGoogle(deps?)`, `upgradeEmail(email,pw,deps?)`. `deps` injects `{ ensureSignedIn, getIdToken, postAuthSession, linkGoogle, linkEmailPassword }` (defaults wire the real firebase.ts + api client) so tests pass fakes. `bootstrap`: ensureSignedIn → getIdToken → postAuthSession(token) → set `{status: user.isGuest?'guest':'user', uid, token, user, isGuest}`. Errors → `status:'error'`.
- Export `getAuthToken(): string | undefined` (reads store) for the api client to consume.

- [ ] **Step 1: Failing test — `authStore.test.ts`** (all deps faked; no firebase import executed):

```typescript
import { useAuthStore } from './authStore';
const deps = {
  ensureSignedIn: async () => 'uid_1',
  getIdToken: async () => 'tok_1',
  postAuthSession: async () => ({ authId: 'uid_1', authSource: 'firebase', authProvider: 'anonymous', isGuest: true, timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: new Date(), updatedAt: new Date() }),
  linkGoogle: async () => {}, linkEmailPassword: async () => {},
};
it('bootstrap resolves a guest', async () => {
  await useAuthStore.getState().bootstrap(deps);
  const s = useAuthStore.getState();
  expect(s.status).toBe('guest'); expect(s.token).toBe('tok_1'); expect(s.isGuest).toBe(true);
});
it('bootstrap error sets error status', async () => {
  await useAuthStore.getState().bootstrap({ ...deps, ensureSignedIn: async () => { throw new Error('x'); } });
  expect(useAuthStore.getState().status).toBe('error');
});
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `firebase.ts` (real SDK calls; not unit-tested) + `authStore.ts` (deps-injected, defaults wire firebase + api `postAuthSession`). No `any`; `User` type from `@gigaflow/shared`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Bảo Hân** (`feat(web): add firebase auth lib and auth store`).

---

### Task 4: Typed API client + queryClient — TDD — [Thành Duy]

**Files:** create `apps/web/src/lib/api.ts`, `apps/web/src/lib/api.test.ts`, `apps/web/src/lib/queryClient.ts`.

**Interfaces — Produces:**
- `class ApiError extends Error { status: number }`.
- `configureApi({ getToken, onUnauthorized, baseUrl? })` — sets module deps (token getter from authStore, a 401 hook, base default `import.meta.env.VITE_API_BASE_URL ?? '/api'`).
- `apiFetch<T>(path, opts?: { method?, body?, schema?: ZodType<T>, fetchImpl?: typeof fetch }): Promise<T>` — attaches `Authorization: Bearer <getToken()>` when present + `Content-Type: application/json`; parses `{success,data,message}`; `!res.ok || !success` → throw `ApiError(res.status, message)`; if `schema`, return `schema.parse(json.data)` else return `json.data as T`; on 401 call `onUnauthorized()` once then retry once. `fetchImpl` injectable for tests (defaults global `fetch`).
- Typed endpoint helpers (each calls apiFetch with the matching `@gigaflow/shared` schema): `postAuthSession()`, `getActivePlan()` (zPlanWithTemplates.nullable), `createPlanFromTemplate(templateType)`, `startSession(templateId)` (zSessionStartResult), `getSession`/`logSets(id, sets)`, `finishSession(id)`, `cancelSession(id)`, `getPrs()` (array of zPersonalRecord).
- `queryClient.ts`: `export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })`.

- [ ] **Step 1: Failing test — `api.test.ts`** (fake `fetchImpl`):

```typescript
import { apiFetch, ApiError, configureApi } from './api';
import { z } from 'zod';
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });
beforeEach(() => configureApi({ getToken: () => 'tok', onUnauthorized: async () => {}, baseUrl: '/api' }));
it('attaches bearer and parses envelope + schema', async () => {
  let seen: Request | undefined;
  const fetchImpl = (async (input: RequestInfo, init?: RequestInit) => { seen = new Request(input, init); return ok({ n: 5 }); }) as typeof fetch;
  const out = await apiFetch('/x', { schema: z.object({ n: z.number() }), fetchImpl });
  expect(out.n).toBe(5); expect(seen?.headers.get('authorization')).toBe('Bearer tok');
});
it('throws ApiError on success:false', async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 400 })) as typeof fetch;
  await expect(apiFetch('/x', { fetchImpl })).rejects.toMatchObject({ status: 400, message: 'nope' });
});
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `api.ts` (+ endpoint helpers using shared schemas — for `getActivePlan` use `zPlanWithTemplates` and allow `null`) + `queryClient.ts`. No `any`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Thành Duy** (`feat(web): add typed API client and query client`).

---

### Task 5: i18n + app shell/router + AuthGate/MainLayout/UpgradePrompt — [Bảo Hân]

**Files:** create `apps/web/src/i18n/{index.ts,en.ts,vi.ts}`, `apps/web/src/store/localeStore.ts`, `apps/web/src/routes.ts`, `apps/web/src/features/auth/{AuthGate.tsx,UpgradePrompt.tsx}`, `apps/web/src/components/MainLayout.tsx`; modify `apps/web/src/{main.tsx,App.tsx}`; test `apps/web/src/features/auth/auth-gate.test.tsx`.

**Interfaces — Produces:** i18n init (en/vi, keys for F1 copy), `localeStore` (persist), `AuthGate` (renders splash on `status==='loading'`, retry on `'error'`, children otherwise), `MainLayout` (dark frame, header: "GigaFlow" + `LanguageToggle` + account link), `UpgradePrompt` (Google + email/password forms calling `authStore.upgradeGoogle/upgradeEmail`), `routes.ts` path constants, `App.tsx` router (BrowserRouter + Routes wrapped in `AuthGate`+`MainLayout`, QueryClientProvider). `main.tsx` calls `configureApi({ getToken: getAuthToken, onUnauthorized: refreshToken })` + `initFirebase()` + `authStore.bootstrap()`.

- [ ] **Step 1: Failing test — `auth-gate.test.tsx`** — with authStore forced to `status:'loading'` shows a splash (testid `auth-splash`); set to `'guest'` renders children.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** i18n + localeStore + AuthGate + MainLayout + UpgradePrompt + routes + wire App/main (route stubs for `/`,`/session/:id`,`/session/:id/summary`,`/account` pointing at placeholder elements for now, real pages land in F1). No `any`.
- [ ] **Step 4: Run — PASS**; `pnpm --filter @gigaflow/web build` green; typecheck clean.
- [ ] **Step 5: Commit — Bảo Hân** (`feat(web): add i18n, app shell, routing, and auth gate`).

---

### Task 6: sessionStore (set-state machine) — TDD — [Thành Duy]

**Files:** create `apps/web/src/store/sessionStore.ts`, `apps/web/src/store/sessionStore.test.ts`.

**Interfaces — Produces (session-local, no network):**
- `type SetState = { status:'pending'|'active'|'done'|'edited'; weightKg:number; repsDone:number; restSeconds?:number; rir?:number }`.
- `initFromSlots(session, slots: SlotTarget[])` — builds, per slot, `setsTarget` `SetState`s seeded `{status:'pending', weightKg:weightSuggested, repsDone:repsSuggested}`; the first set of the first slot is `active`.
- `markDone(slotId, setIndex)` — set → `done` keeping current weight/reps; activate the next pending set.
- `editSet(slotId, setIndex, {weightKg, repsDone})` — set → `edited` with new values.
- `setRest(slotId, setIndex, seconds)` / `setRir(slotId, setIndex, rir)`.
- `toLogSetInput(): LogSetInput[]` — flatten every non-pending set to `LogSetInput` (`slotId, exerciseId, setNumber (1-based within slot), weightKg, repsDone, weightSuggested, repsSuggested, restSeconds?, rir?, isCompleted:true`). Keep `weightSuggested/repsSuggested` from the seed.
- `reset()`.

- [ ] **Step 1: Failing test** — initFromSlots (first set active), markDone (activates next; status done), editSet (status edited + new values), toLogSetInput (only non-pending, correct setNumber + isCompleted). Use a 1-slot, 3-set fixture.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** `sessionStore` (Zustand; immutable updates; guard array indices — noUncheckedIndexedAccess). No `any`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Thành Duy** (`feat(web): add active-session set-state store`).

---

### Task 7: Domain components — [Bảo Hân]

**Files:** create `apps/web/src/components/{SetBox.tsx,ExerciseRow.tsx,SessionQueueItem.tsx,ProgressionBadge.tsx,SummaryRow.tsx,RestTimer.tsx,RirPicker.tsx}` + `apps/web/src/components/domain.test.tsx`.

**Interfaces — Produces (presentational; state from props):**
- `SetBox({ target:{weightKg,repsDone}, actual?, status, onTap, onEdit })` — 72×56, `tnum`; pending=dark+blue target text, done=green tint+green, edited=amber dot; tap→onTap, double/long→onEdit.
- `ExerciseRow({ slot, sets, status, onSetTap, onSetEdit })` — name + muscle tag + `ProgressionBadge`; a row of SetBoxes.
- `SessionQueueItem({ template, status:'done'|'next'|'upcoming', onStart })` — `ColorDot`, name, status styling; "Start" CTA when `next`.
- `ProgressionBadge({ lastSet? })` — "prev: W × R" muted; nothing if no lastSet.
- `SummaryRow({ name, setCount, avgWeightKg, hasPR })` — name + "N sets · avg kg" + amber PR badge when hasPR.
- `RestTimer({ seconds, running, onToggle, onAdjust })` — countdown mm:ss (`tnum`), Pause/Resume, ±15s; reduced-motion safe.
- `RirPicker({ value?, onPick })` — 3 buttons 🙂(3)/💪(1)/😮‍💨(0) mapping to rir; optional.

- [ ] **Step 1: Failing test — `domain.test.tsx`** — SetBox done state has success class + calls onTap; SessionQueueItem `next` shows Start and calls onStart; SummaryRow with `hasPR` shows "PR"; ProgressionBadge renders "prev: 80 × 8". (Testing Library + user-event.)
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** the components per tokens (SetBox `min-h-14 min-w-[72px]`; statuses via classes; RestTimer formats mm:ss). No `any`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Bảo Hân** (`feat(web): add training-loop domain components`).

---

### Task 8: Home / Today page + preset bootstrap — TDD — [Thành Duy]

**Files:** create `apps/web/src/features/home/HomePage.tsx`, `apps/web/src/features/home/home.test.tsx`; wire the `/` route in `App.tsx`.

**Interfaces — Consumes:** `getActivePlan`/`createPlanFromTemplate`/`startSession` (api), `SessionQueueItem`, TanStack Query. **Produces:** HomePage rendering the active plan's templates as a queue (first = `next`, rest `upcoming`); empty state offering PPL/Upper-Lower/Full-body presets (→ `createPlanFromTemplate` → invalidate `['activePlan']`); Start → `startSession(templateId)` → put result in query cache key `['session', id]` + `navigate('/session/'+id)`.

- [ ] **Step 1: Failing test — `home.test.tsx`** (mock `@/lib/api`): with `getActivePlan` → a plan of 2 templates, renders 2 queue items and a "Start" on the first; with `getActivePlan` → null, renders the 3 preset options; clicking a preset calls `createPlanFromTemplate`. Wrap in `QueryClientProvider` + `MemoryRouter`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** HomePage (useQuery `['activePlan']`; mutations; i18n copy). No `any`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Thành Duy** (`feat(web): add Home/Today queue with preset bootstrap`).

---

### Task 9: Active Session page (2-tap + rest + RIR + finish) — TDD — [Thành Duy]

**Files:** create `apps/web/src/features/session/ActiveSessionPage.tsx`, `apps/web/src/features/session/active-session.test.tsx`; wire `/session/:id`.

**Interfaces — Consumes:** `sessionStore`, `logSets`/`finishSession`/`cancelSession` (api), `ExerciseRow`/`SetBox`/`RestTimer`/`RirPicker`, the `['session', id]` cache entry (start result). **Produces:** the screen — reads the start result (`{session, slots}`) from cache (if missing → redirect Home); `initFromSlots`; renders per-slot `ExerciseRow`s; header (name · `#num` · count-up timer · Finish); tapping sets drives `sessionStore.markDone`/`editSet`; after a done tap a `RestTimer` starts + optional `RirPicker`; **Finish** → `logSets(id, toLogSetInput())` → `finishSession(id)` → `navigate('/session/'+id+'/summary')` carrying the finished session in cache.

- [ ] **Step 1: Failing test — `active-session.test.tsx`** (mock api; seed `['session', id]` in the query cache with a 1-slot/2-set start result): renders the two SetBoxes with target text; tapping the first marks it done (green) and activates the second; clicking Finish calls `logSets` (with 2 completed inputs) then `finishSession` then navigates to the summary route. Use MemoryRouter with an initial entry `/session/s1` + a route capturing navigation.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** ActiveSessionPage (timer via `setInterval` in an effect; guards; i18n). No `any`.
- [ ] **Step 4: Run — PASS**; typecheck clean.
- [ ] **Step 5: Commit — Thành Duy** (`feat(web): add active session screen with 2-tap logging`).

---

### Task 10: Session Summary page — TDD — [Bảo Hân]

**Files:** create `apps/web/src/features/session/SummaryPage.tsx`, `apps/web/src/features/session/summary.test.tsx`; wire `/session/:id/summary`.

**Interfaces — Consumes:** the finished `TrainingSession` from cache (`['session', id]` updated on finish, or refetch), `getPrs` (api), `SummaryRow`. **Produces:** header "✓ <name> done" + duration (mm:ss from `durationSeconds`) + total volume (`totalVolume` tnum); a `SummaryRow` per exercise in the session (name + set count + avg weight) with a **PR badge** when that exercise id is in `getPrs()`; "Back to home" → `/`.

- [ ] **Step 1: Failing test — `summary.test.tsx`** (mock api; seed a finished session + `getPrs` → one PR): renders duration + total volume; a SummaryRow with the PR badge for the PR'd exercise and without it for another; "Back to home" navigates to `/`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** SummaryPage. No `any`.
- [ ] **Step 4: Run — PASS**; `pnpm --filter @gigaflow/web build` green; typecheck clean.
- [ ] **Step 5: Commit — Bảo Hân** (`feat(web): add session summary screen`).

---

### Task 11: Docs — README web section + .env.example — [Bảo Hân]

**Files:** modify `README.md`; ensure `apps/web/.env.example` documents `VITE_API_BASE_URL` + `VITE_FIREBASE_*`.

- [ ] **Step 1:** README — add a **Web app** section: `pnpm --filter @gigaflow/web dev` (needs the API running + `apps/web/.env` with `VITE_API_BASE_URL` and `VITE_FIREBASE_*` web config); note F0+F1 shipped (foundation + core loop: Home → session → summary), dark PWA, i18n en/vi; deferred F2/F3 UI. Update roadmap: E13 in progress (F0+F1 done).
- [ ] **Step 2:** confirm `apps/web/.env.example` lists `VITE_API_BASE_URL=/api` and commented `VITE_FIREBASE_{API_KEY,AUTH_DOMAIN,PROJECT_ID,APP_ID}`.
- [ ] **Step 3: Commit — Bảo Hân** (`docs: document the web app (F0+F1) and its env`).

---

## Self-Review

**1. Spec coverage:** F0 — scaffold+tokens (T1), design-system (T2, T7), firebase+authStore (T3), api client+queryClient (T4), i18n+shell+router+AuthGate+MainLayout+UpgradePrompt (T5), PWA (T1 vite-plugin-pwa). F1 — sessionStore (T6), Home+preset bootstrap (T8), Active Session 2-tap+rest+RIR+finish (T9), Summary+PR (T10). Docs (T11). Deferred F2/F3 per spec §9. All spec sections mapped.

**2. Placeholder scan:** config/logic/stores/api have full code + concrete tests; presentational components (T2/T7) are specified by exact props + token classes + concrete test assertions (render structure per the design prompt) rather than inlined full JSX — acceptable for UI, no vague "style it nicely" directives. Firebase real SDK + Vite PWA aren't unit-tested (need browser/keys) — stated, consistent with E2/E7 precedent.

**3. Type consistency:** `User`/`ColorTag`/`SlotTarget`/`LogSetInput`/`PlanWithTemplates`/`PersonalRecord`/`SessionStartResult`/`TrainingSession` all imported from `@gigaflow/shared` (server source of truth). `authStore` deps ({ensureSignedIn,getIdToken,postAuthSession,linkGoogle,linkEmailPassword}) match firebase.ts + api. `getAuthToken` (T3) consumed by `configureApi` (T4/T5). `sessionStore.toLogSetInput()` returns `LogSetInput[]` consumed by T9's `logSets`. `['session', id]` / `['activePlan']` cache keys consistent across T8/T9/T10. `@/` alias used throughout. Every task ends on a green build+test+typecheck.

**Assignees:** T1–T3, T5, T7, T10, T11 → Bảo Hân; T4, T6, T8, T9 → Thành Duy.
