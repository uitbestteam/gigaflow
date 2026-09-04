# GigaFlow

AI-powered fitness app — workout planning with automatic progressive-overload
suggestions, meal planning, InBody OCR, and analytics. Backend-first with cloud
sync; guest mode works with no sign-up.

> **Status:** E14 — Testing & Hardening ✅ (backend), E12 — Subscription & Quota ✅, E10 Notifications ✅ (backend), E8 InBody OCR + Weight Log backend ✅ complete, E13 — Web app F0–F4 ✅ (frontend product complete). Remaining: notifications delivery (FCM) + cloud infra (GCP/Firebase/Atlas) + deploy;
> see the [feature roadmap](docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md).

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | [Hono](https://hono.dev) on Cloud Run (Node 22) |
| Data access | MongoDB Atlas via the native driver + Zod validation |
| Shared types | `@gigaflow/shared` — Zod schemas as the single source of truth |
| Frontend | React + Vite PWA (Tailwind) — F0+F1 shipped, see [Web app](#web-app) below |
| Auth | Firebase Auth — Google + email/password + anonymous (guest → link) |
| Jobs | Cloud Tasks (no Redis) |
| Files | Cloud Storage |
| Web hosting | Firebase Hosting (rewrites `/api/**` → Cloud Run, same-origin) |
| Infra | Terraform (all GCP resources except Atlas) |
| AI | Gemini-first, OpenAI fallback (meal = Gemini only) |
| i18n | English + Vietnamese |

## Repository layout

```
apps/
  api/          Hono backend → Cloud Run (routes under /api)
  web/          React + Vite PWA — F0 (foundation) + F1 (core training loop) shipped
packages/
  shared/       Zod schemas + inferred types + enums (shared by api & web)
infra/          Terraform (Cloud Run, Secret Manager, Cloud Tasks, IAM) — see infra/README.md
.github/        CI (PR test gate)
cloudbuild.yaml Cloud Build deploy pipeline
docs/           Architecture spec, feature spec, plans
```

## Prerequisites

- Node.js ≥ 20 (containers run Node 22)
- pnpm 10 (`corepack enable`)
- For infra/deploy: Docker, gcloud CLI, Terraform ≥ 1.9, Firebase CLI

## Getting started

```bash
pnpm install
```

```bash
pnpm build        # turbo: builds packages/shared then apps/api
```

## Running locally

Three levels, from zero-setup to full stack. The API mounts every route under
`/api` (matching the Firebase Hosting rewrite).

### Level 1 — Automated tests (no external services)

The fastest way to verify the whole backend. Repositories, middleware, and
routes are covered with an in-memory MongoDB (`mongodb-memory-server`) and a
**fake Firebase verifier**, so no real Mongo or Firebase is needed.

```bash
pnpm test
```

First run downloads a MongoDB binary (~66MB, needs network); later runs are
fast. Also useful: `pnpm typecheck` and `pnpm build`.

### Level 2 — Run the API, health only (no Mongo / no Firebase)

```bash
pnpm --filter @gigaflow/api dev
```

```bash
curl http://localhost:8080/api/health
```

With no `MONGODB_URI` set, the server still boots and skips the DB connection.
Auth-protected routes return **401** without a token (expected).

### Level 3 — Full API with MongoDB

Start a local MongoDB (Docker):

```bash
docker run -d --name gf-mongo -p 27017:27017 mongo:7
```

Create `.env` at the repo root:

```
PORT=8080
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=gigaflow
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json  # only for real Firebase token verification

# AI Generation (E7) — optional for local development
GEMINI_API_KEY=your-gemini-key-here          # Primary AI provider
GEMINI_MODEL=gemini-2.0-flash                # (optional) override default
OPENAI_API_KEY=your-openai-key-here          # (optional) fallback provider
OPENAI_MODEL=gpt-4o-mini                     # (optional) override default
```

```bash
pnpm --filter @gigaflow/api dev
```

On startup the server ensures indexes (and, from E3 on, seeds the exercise
catalog). DB-backed reads/writes now work.

### AI Generation (E7 Workout, E9 Meal, E8 InBody OCR)

Plan generation (workout and meal) and InBody OCR run **inline in-process** by default (no
Cloud Tasks or external job queue needed). Workouts support Gemini-first with
OpenAI fallback; meals and InBody use **Gemini only** (vision for InBody). Set `GEMINI_API_KEY` in your `.env`
to enable real generation and InBody image analysis. Optionally set `OPENAI_API_KEY` for workout
fallback. Optionally override model names with `GEMINI_MODEL` or
`OPENAI_MODEL` (defaults: `gemini-2.0-flash` and `gpt-4o-mini`).

The entire `POST /api/workout/generate` → `GET /api/workout/jobs/:id`,
`POST /api/meal/generate` → `GET /api/meal/jobs/:id`, and
`POST /api/inbody/analyze` → `GET /api/inbody/jobs/:id` flows are covered by
`pnpm test` with fake engines (no real API calls), so you can verify the
endpoints without keys.

#### Vertex AI provider (optional)

The Vertex AI Gemini provider runs alongside AI Studio Gemini and OpenAI
(text and InBody vision) as an alternative way to reach the same Gemini
models through Google Cloud. Select and order providers with
`AI_PROVIDER_ORDER` (e.g. `vertex,gemini,openai`) — the order is the
fallback priority; leaving it unset keeps the existing default
(`gemini,openai`), so this feature is entirely opt-in with no behavior
change if you don't set it. Vertex authenticates via Application Default
Credentials rather than an API key: locally run
`gcloud auth application-default login`, and on Cloud Run the runtime
service account supplies ADC (granted `roles/aiplatform.user` by
Terraform). Configure it with `VERTEX_PROJECT_ID` (defaults to
`GCP_PROJECT_ID`), `VERTEX_LOCATION` (default `global`), and
`VERTEX_MODEL` (default `gemini-2.5-flash`). Requests go to Google's
`aiplatform.googleapis.com` endpoint, so usage runs through Vertex/GCP
billing — credit-eligible if your GCP promotion covers Vertex Gemini
SKUs.

### Calling auth-protected endpoints

The running server verifies **real Firebase ID tokens**, so `POST /api/auth/session`
and the exercise routes need both `GOOGLE_APPLICATION_CREDENTIALS` (a Firebase
service-account JSON) **and** a client-issued Firebase ID token sent as
`Authorization: Bearer <token>`. You can exercise this logic through the
[web app](#web-app) (real Firebase ID tokens) or through **Level 1 tests**
(which inject a fake verifier) rather than curl.

## API Endpoints

**Auth:**
- `POST /api/auth/session` — Exchange Firebase ID token for a user session. Requires `Authorization: Bearer <Firebase ID token>` header. Upserts the user (creates if new, updates provider/email if upgrading) and returns the user object.
- `GET /api/auth/session` — Retrieve the current user session. Requires `Authorization: Bearer <Firebase ID token>` header.

**Health:**
- `GET /api/health` — Health check.

**Exercises:**
- `GET /api/exercises?muscleGroup=&q=` — List preset and custom exercises. Requires `Authorization: Bearer <Firebase ID token>` header. Guests (anonymous users) included. Query params: `muscleGroup` (optional, ignored if invalid), `q` (optional, filters by name).
- `POST /api/exercises` — Create a custom exercise. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ name: { en: string, vi: string }, muscleGroup: string, equipmentType: string, defaultIncrement?: number, videoUrl?: string }`. Returns 201 on success, 409 on duplicate slug.

**Plans:**
- `POST /api/plans/from-template` — Create a plan from a preset split template. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ templateType: "ppl" | "upper_lower" | "full_body" }`. Creates a plan with workout templates and exercise slots nested; sets the plan as active and returns it as 201. Returns 400 for unknown or `custom` template type.
- `GET /api/plans/active` — Retrieve the caller's active plan with templates and slots nested. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ data: Plan | null }` if no active plan exists.

**Sessions:**
- `POST /api/sessions/start` — Start a new session from a workout template. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ templateId }`. Returns the created session with prefilled slot targets (weightSuggested/repsSuggested from last performance).
- `GET /api/sessions/active` — Retrieve the current in-progress session, or null if none. Requires `Authorization: Bearer <Firebase ID token>` header.
- `POST /api/sessions/:id/sets` — Log or replace sets in an active session. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ sets: [...] }`. Replaces the session's logged sets.
- `POST /api/sessions/:id/finish` — Finish a session, computing volume/duration rollup and refreshing the progression cache. Requires `Authorization: Bearer <Firebase ID token>` header.
- `POST /api/sessions/:id/cancel` — Cancel a session. Requires `Authorization: Bearer <Firebase ID token>` header.
- `GET /api/exercises/:id/last` — Retrieve the last performance for an exercise (used as the progression source for prefill). Requires `Authorization: Bearer <Firebase ID token>` header.

**AI Generation — Workout:**
- `POST /api/workout/generate` — Enqueue a background AI job to generate a workout plan. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ goal: string, experienceLevel: "beginner" | "intermediate" | "advanced", daysPerWeek: number }`. Returns **202** with `{ jobId: string }` on success. Returns **429** if quota exceeded (workout limit: 10 per 30 days). Returns **400** for invalid body. Generation runs inline in-process (no Cloud Tasks by default) and uses Gemini (or OpenAI fallback) via `GEMINI_API_KEY` / `OPENAI_API_KEY` environment variables. The plan is created using the same E4 slot model and set as the user's active plan when generation completes.
- `GET /api/workout/jobs/:id` — Poll job status. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ status: "queued" | "processing" | "done" | "failed", resultId?: string }`. When `status === "done"`, `resultId` is the created plan's ID.

**AI Generation — Meal:**
- `POST /api/meal/generate` — Enqueue a background AI job to generate a 7-day meal plan. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ goal: string, gender: "male" | "female" | "other", age: number, heightCm: number, weightKg: number, activityLevel: "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active" }`. Computes TDEE and macronutrient targets, then generates meals via **Gemini only** (no OpenAI fallback). Returns **202** with `{ jobId: string }` on success. Returns **429** if quota exceeded (meal limit: 10 per 30 days). Returns **400** for invalid body. Generation runs inline in-process and requires `GEMINI_API_KEY` to be configured for real generation. The meal plan is created and set as the user's active plan when generation completes.
- `GET /api/meal/jobs/:id` — Poll meal generation job status. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ status: "queued" | "processing" | "done" | "failed", resultId?: string }`. When `status === "done"`, `resultId` is the created meal plan's ID.
- `GET /api/meal/active` — Retrieve the caller's active meal plan, or null if none exists. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ data: MealPlan | null }`.

**Quota:**
AI generation is limited per 30-day period per user. FREE plan limits: workout 10 / meal 10 / inbody 5. Guests and registered users share the same basic limits. The `quotaGuard(type)` middleware returns **429** when exceeded and is applied to the AI-generation routes in E7. Usage is incremented on job enqueue and rolled back on job failure.

**InBody & Weight:**
- `POST /api/inbody/analyze` — Enqueue a background job to analyze an InBody scan image via Gemini vision. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ imageBase64: string, mimeType: string }`. Returns **202** with `{ jobId: string }` on success. Returns **429** if quota exceeded (inbody limit: 5 per 30 days). Returns **400** for invalid body. Image is passed inline as base64 to the Gemini vision API (no Cloud Storage upload needed to run); requires `GEMINI_API_KEY` configured. Fake analyzer is used in tests (no real API calls).
- `GET /api/inbody/jobs/:id` — Poll InBody job status. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ status: "queued" | "processing" | "done" | "failed", result?: InbodyResult }`. When `status === "done"`, `result` contains the parsed metrics (weight, body fat %, muscle mass %, etc.).
- `GET /api/inbody/latest` — Retrieve the latest completed InBody analysis for the user. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ data: InbodyResult | null }`.
- `POST /api/weight` — Log a weight entry. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ weightKg: number, loggedAt?: ISO8601 timestamp }`. Returns **201** with the created weight log entry. `loggedAt` defaults to now if omitted.
- `GET /api/weight/history` — Retrieve the user's weight log history. Requires `Authorization: Bearer <Firebase ID token>` header. Returns array of weight entries sorted by date descending.

**Notifications:**
- `POST /api/notifications/device-token` — Register an FCM device token for push notifications. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ token: string, platform?: "android" | "ios" }`. Returns **201** on success. A bilingual (en/vi) push notification is automatically sent to registered devices when a workout, meal, or InBody generation job completes or fails (internal flow, does not block the job). Notifications are never blocking — failures are swallowed and logged.
- `DELETE /api/notifications/device-token/:token` — Unregister a device token (owner-scoped). Requires `Authorization: Bearer <Firebase ID token>` header. Returns **200** with `apiSuccess({ deleted })` on success.
- `POST /internal/cron/workout-reminders` — Internal endpoint triggered by Cloud Scheduler at deploy to push "time to train" reminders to inactive users. Requires `X-CloudTasks-QueueName` internal auth header. Queries recent inactivity and broadcasts reminders to opted-in devices. Returns **200** on completion.

*Implementation notes:* FCM push delivery uses `firebase-admin` SDK (same credentials as auth). Notifications never block request/job flows and are tested via `pnpm test` with a fake sender (no Firebase required for unit tests).

**Stats:**
- `GET /api/stats/summary` — Retrieve aggregated statistics: total completed sessions, total volume, personal records count, and exercise count. Requires `Authorization: Bearer <Firebase ID token>` header. Returns aggregated session and exercise data.
- `GET /api/stats/prs` — Retrieve personal records (best e1RM) per exercise, sorted by e1RM descending. Requires `Authorization: Bearer <Firebase ID token>` header. Returns array of performance records with exercise, weight, and e1RM estimate.
- `GET /api/stats/awards` — Retrieve the badge catalog with earned awards and progress toward unearned awards. Requires `Authorization: Bearer <Firebase ID token>` header. Returns earned and in-progress awards with target metrics.

## Web app

`apps/web` is a React + Vite PWA. **F0 (foundation)**, **F1 (core training
loop)**, and **F2 (plans builder + exercise library)** have shipped:

- Dark-themed, installable PWA shell (app-shell precache via `vite-plugin-pwa`)
  with English/Vietnamese i18n
- Firebase anonymous guest auth on first load, with an upgrade path to
  Google sign-in or email/password
- A typed fetch client (`src/lib/api.ts`) that validates every API response
  against the `@gigaflow/shared` Zod schemas
- Home/Today → start a session from the active plan → 2-tap set logging with
  a rest timer and optional RIR entry → finish session → summary screen with
  PR badges
- **Exercise Library** (`/exercises`): search exercises by name, filter by
  muscle group, create custom exercises (name in English/Vietnamese, muscle
  group, equipment type, default weight increment)
- **Plans management** (`/plans`): list plans with Active badge, Activate,
  Edit, Delete (inline two-step confirmation), create new plan, or start from
  preset template
- **Plan Builder** (`/plans/new`, `/plans/:id/edit`): edit plan name, manage
  per-day workout templates (name and color per day), add/remove/reorder
  exercises with exercise picker, edit sets, rep range, weight increment, and
  equipment per exercise slot, save to create or update the plan

**F3 (AI planning, meal, InBody, stats)** has shipped:

- **AI Generate Plan** (`/generate`): form to specify goal, experience level, and days per week
  → job polling → generated plan opens in the Plan Builder for review and editing
  (uses `POST /api/workout/generate` and `GET /api/workout/jobs/:id`)
- **Meal Planner** (`/meal`): TDEE-based form (goal, gender, age, height, weight, activity level)
  → job polling → 7-day meal plan with per-day macronutrient targets and meals
  (uses `POST /api/meal/generate`, `GET /api/meal/jobs/:id`, and `GET /api/meal/active`)
- **InBody Capture** (`/inbody`): photo upload (client-validated JPEG/PNG) → analysis job
  → body composition metrics (weight, body fat %, muscle mass %, etc.)
  (uses `POST /api/inbody/analyze`, `GET /api/inbody/jobs/:id`, and `GET /api/inbody/latest`)
- **Stats Dashboard** (`/stats`): aggregated statistics including total sessions, total volume,
  personal records count, awards with progress toward next badge, personal records per exercise,
  and bodyweight logging with a mini chart (uses `GET /api/stats/summary`, `GET /api/stats/prs`,
  `GET /api/stats/awards`, `POST /api/weight`, and `GET /api/weight/history`)

**F4 (notifications & polish)** has shipped:

- **Notifications Settings** (`/account`): enable/disable workout-reminder web push
  (uses `POST /api/notifications/device-token` and `DELETE /api/notifications/device-token/:token`).
  Client flow (permission request → FCM token → register/unregister) is complete; actual push
  **delivery requires Firebase Cloud Messaging provisioning** (a real Firebase project,
  `VITE_FIREBASE_VAPID_KEY`, and the committed `apps/web/public/firebase-messaging-sw.js`
  service worker) — provisioning is deferred to the infra phase.
- **Polish**: inline set editor (replaces `window.prompt` in active session), shared `PresetPicker`
  component (dedupes preset row across Home & Plans), and date handling switched to `z.coerce.date()`
  in shared schemas (dropped the web JSON date reviver).

**Frontend product code complete.** Remaining: notifications delivery (FCM setup), cloud infra
(GCP Cloud Run, Firebase project + Hosting, MongoDB Atlas + Secret Manager, Cloud Tasks/Scheduler),
and deploy.

### Running it

Needs the API running (see "Running locally" above) and an `apps/web/.env`
populated from `.env.example` with your Firebase web app config and API base
URL:

```bash
cp apps/web/.env.example apps/web/.env
```

```bash
pnpm --filter @gigaflow/web dev
```

Build and test:

```bash
pnpm --filter @gigaflow/web build
```

```bash
pnpm --filter @gigaflow/web test
```

## Testing

Vitest across the workspace. The `apps/api` DB test uses
`mongodb-memory-server`, which downloads a MongoDB binary on first run (needs
network; the vitest hook timeout is raised for it).

```bash
pnpm test                          # everything
pnpm --filter @gigaflow/api test   # api only
pnpm --filter @gigaflow/shared test
```

## Hardening

E14 closed out the following backend hardening gaps found during testing:

- **Atomic quota consume** — quota check-and-increment is a single atomic
  `findOneAndUpdate` (no more read-then-write TOCTOU window between checking
  and incrementing usage).
- **Atomic session numbering** — session numbers are assigned via an atomic
  counter increment instead of a read-max-then-write-next pattern, avoiding
  duplicate session numbers under concurrent starts.
- **InBody image size bound** — `POST /api/inbody/analyze` rejects
  oversized `imageBase64` payloads before they reach the Gemini vision call.
- **Gemini-only internal meal jobs** — the internal meal-generation job path
  is Gemini-only (no OpenAI fallback), matching the public API contract.
- **FCM stale-token pruning + reminder batching** — push delivery removes
  device tokens that Firebase reports as invalid/unregistered, and the
  workout-reminder broadcast sends in batches instead of one-by-one.
- **Request-id + structured JSON logging** — every request gets a
  `request-id` (generated or propagated from `X-Request-Id`), included in
  structured JSON logs and error responses for traceability.
- **End-to-end integration test** — an additional integration test exercises
  a full user flow (session → plan → sessions → stats) against the
  in-memory MongoDB to catch cross-route regressions the unit suite misses.

## Deployment

All cloud provisioning is Terraform-managed (except the Atlas cluster) and is
**not yet applied** — the steps are documented in [`infra/README.md`](infra/README.md):
create the GCP project, Atlas cluster + secrets in Secret Manager, `terraform
apply`, Artifact Registry + Cloud Build trigger, and Firebase Hosting deploy.

## Documentation

- [Cloud architecture design](docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md)
- [Feature spec (epics/stories)](docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md)
- [Jira import prompts](docs/superpowers/specs/2026-08-26-gigaflow-jira-import-prompts.md)
- [E1 Foundation plan](docs/superpowers/plans/2026-08-26-gigaflow-e1-foundation.md)
- [Infra / deploy runbook](infra/README.md)

## Roadmap

E1 Foundation ✅ · E2 Backend Auth ✅ · E3 Exercise Catalog ✅ · E4 Workout Plans ✅ ·
E5 Session Logging & Progression ✅ · E6 Rest Timer & RIR · E7 AI Workout Planner ✅ (backend) ·
E8 InBody OCR ✅ (backend + weight log) · E9 Meal Planner ✅ (backend) · E10 Notifications ✅ (backend) · E11 Analytics ✅ (backend) ·
E12 Subscription & Quota ✅ (backend) · E13 UI/UX Design System & Frontend Auth ✅ (web app F0–F4 complete) · E14 Testing & Hardening ✅ (backend).

*Notes:*
- *E3-S4 Exercise library UI shipped in E13-F2.*
- *E4-S3 Custom plan builder UI shipped in E13-F2; E4-S5 Home/Today queue UI shipped in E13-F1.*
- *E5-S6 Active Session UI and E5-S7 Session Summary UI shipped in E13-F1.*
- *E13-F3 shipped: E7-S5 Generate-plan UI (request form + job polling), E8-S3 InBody UI (scan upload), E9-S3 Meal planner UI (plan view), E11-S3 Statistics UI.*
- *E13-F4 shipped: E10 Notifications settings UI (enable/disable web push in `/account`), inline set editor, shared `PresetPicker` component, and `z.coerce.date()` schema updates. E10 FCM push delivery deferred to infra phase (Firebase Cloud Messaging provisioning).*
- *E7 Cloud Tasks enqueuer (real job queuing for long-running plans) is deferred to future backend work.*
- *E10 Cloud Scheduler trigger setup for workout reminders is deferred to deploy (Terraform + Cloud Build).*
- *E8-S1 Cloud Storage signed-URL upload for images is deferred to deploy (E8 backend uses inline base64).*
- *Frontend auth (anonymous sign-in, Google/password sign-in/link, account upgrade UI) shipped in E13-F0/F1.*
