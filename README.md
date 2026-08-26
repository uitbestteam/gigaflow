# GigaFlow

AI-powered fitness app — workout planning with automatic progressive-overload
suggestions, meal planning, InBody OCR, and analytics. Backend-first with cloud
sync; guest mode works with no sign-up.

> **Status:** E3 — Exercise catalog backend ✅ complete. Building toward the full app;
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
```

```bash
pnpm --filter @gigaflow/api dev
```

On startup the server ensures indexes (and, from E3 on, seeds the exercise
catalog). DB-backed reads/writes now work.

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

E1 Foundation ✅ · E2 Backend Auth ✅ · E3 Exercise Catalog ✅ · E4 Workout Plans ·
E5 Session Logging & Progression · E6 Rest Timer & RIR · E7 AI Workout Planner ·
E8 InBody OCR · E9 Meal Planner · E10 Notifications · E11 Analytics ·
E12 Subscription & Quota · E13 UI/UX Design System & Frontend Auth · E14 Testing & Hardening.

*Notes:*
- *E3-S4 Exercise library UI is deferred to E13 (web app frontend).*
- *Frontend auth (anonymous sign-in, Google/password sign-in/link, account upgrade UI) is deferred to E13, after the web app is scaffolded.*
