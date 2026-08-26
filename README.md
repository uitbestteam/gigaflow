# GigaFlow

AI-powered fitness app — workout planning with automatic progressive-overload
suggestions, meal planning, InBody OCR, and analytics. Backend-first with cloud
sync; guest mode works with no sign-up.

> **Status:** E7 — AI Workout Planner backend ✅ complete. Building toward the full app;
> see the [feature roadmap](docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md).

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | [Hono](https://hono.dev) on Cloud Run (Node 22) |
| Data access | MongoDB Atlas via the native driver + Zod validation |
| Shared types | `@gigaflow/shared` — Zod schemas as the single source of truth |
| Frontend | React + Vite PWA (shadcn/ui + Tailwind) — *coming in a later epic* |
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
  web/          React + Vite PWA (placeholder for now)
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

### AI Generation (E7)

Workout plan generation runs **inline in-process** by default (no Cloud Tasks
or external job queue needed). To call a real AI model (Gemini-first, OpenAI
fallback), set `GEMINI_API_KEY` (and optionally `OPENAI_API_KEY`) in your
`.env`. Without a key configured, generation jobs fail with a clear error
message "no AI provider configured". Optionally override model names with
`GEMINI_MODEL` or `OPENAI_MODEL` (defaults: `gemini-2.0-flash` and
`gpt-4o-mini`).

The entire `POST /api/workout/generate` → `GET /api/workout/jobs/:id` flow is
covered by `pnpm test` with a fake engine (no real API calls), so you can
verify the endpoints without keys.

### Calling auth-protected endpoints

The running server verifies **real Firebase ID tokens**, so `POST /api/auth/session`
and the exercise routes need both `GOOGLE_APPLICATION_CREDENTIALS` (a Firebase
service-account JSON) **and** a client-issued Firebase ID token sent as
`Authorization: Bearer <token>`. Until the web app (E13) exists, exercise this
logic through **Level 1 tests** (which inject a fake verifier) rather than curl.

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

**AI Generation:**
- `POST /api/workout/generate` — Enqueue a background AI job to generate a workout plan. Requires `Authorization: Bearer <Firebase ID token>` header. Request body: `{ goal: string, experienceLevel: "beginner" | "intermediate" | "advanced", daysPerWeek: number }`. Returns **202** with `{ jobId: string }` on success. Returns **429** if quota exceeded (workout limit: 10 per 30 days). Returns **400** for invalid body. Generation runs inline in-process (no Cloud Tasks by default) and uses Gemini (or OpenAI fallback) via `GEMINI_API_KEY` / `OPENAI_API_KEY` environment variables. The plan is created using the same E4 slot model and set as the user's active plan when generation completes.
- `GET /api/workout/jobs/:id` — Poll job status. Requires `Authorization: Bearer <Firebase ID token>` header. Returns `{ status: "queued" | "processing" | "done" | "failed", resultId?: string }`. When `status === "done"`, `resultId` is the created plan's ID.

**Quota:**
AI generation is limited per 30-day period per user. FREE plan limits: workout 10 / meal 10 / inbody 5. Guests and registered users share the same basic limits. The `quotaGuard(type)` middleware returns **429** when exceeded and is applied to the AI-generation routes in E7. Usage is incremented on job enqueue and rolled back on job failure.

## Testing

Vitest across the workspace. The `apps/api` DB test uses
`mongodb-memory-server`, which downloads a MongoDB binary on first run (needs
network; the vitest hook timeout is raised for it).

```bash
pnpm test                          # everything
pnpm --filter @gigaflow/api test   # api only
pnpm --filter @gigaflow/shared test
```

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
E8 InBody OCR · E9 Meal Planner · E10 Notifications · E11 Analytics ·
E12 Subscription & Quota ✅ (backend) · E13 UI/UX Design System & Frontend Auth · E14 Testing & Hardening.

*Notes:*
- *E3-S4 Exercise library UI is deferred to E13 (web app frontend).*
- *E4-S3 Custom plan builder UI and E4-S5 Home/Today queue UI are deferred to E13 (web app frontend).*
- *E5-S6 Active Session UI and E5-S7 Session Summary UI are deferred to E13 (web app frontend).*
- *E7-S5 Generate-plan UI (request form + job polling) is deferred to E13 (web app frontend).*
- *E7 Cloud Tasks enqueuer (real job queuing for long-running plans) + FCM notify integration are deferred to E10 (Notifications).*
- *Frontend auth (anonymous sign-in, Google/password sign-in/link, account upgrade UI) is deferred to E13, after the web app is scaffolded.*
