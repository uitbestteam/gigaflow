# GigaFlow

AI-powered fitness app — workout planning with automatic progressive-overload
suggestions, meal planning, InBody OCR, and analytics. Backend-first with cloud
sync; guest mode works with no sign-up.

> **Status:** E2 — Backend auth ✅ complete. Building toward the full app; see the
> [feature roadmap](docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md).

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
pnpm build        # turbo: builds packages/shared then apps/api
pnpm test         # all workspaces (Vitest)
pnpm typecheck
```

Run the API locally:

```bash
cp .env.example .env          # set PORT, MONGODB_URI (optional locally), etc.
pnpm --filter @gigaflow/api dev
# health check:
curl http://localhost:8080/api/health
```

The API mounts all routes under `/api` (matching the Firebase Hosting rewrite).
If `MONGODB_URI` is unset, the server still boots (DB connection is skipped).

## API Endpoints

**Auth:**
- `POST /api/auth/session` — Exchange Firebase ID token for a user session. Requires `Authorization: Bearer <Firebase ID token>` header. Upserts the user (creates if new, updates provider/email if upgrading) and returns the user object.
- `GET /api/auth/session` — Retrieve the current user session. Requires `Authorization: Bearer <Firebase ID token>` header.

**Health:**
- `GET /api/health` — Health check.

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

E1 Foundation ✅ · E2 Backend Auth ✅ · E3 Exercise Catalog · E4 Workout Plans ·
E5 Session Logging & Progression · E6 Rest Timer & RIR · E7 AI Workout Planner ·
E8 InBody OCR · E9 Meal Planner · E10 Notifications · E11 Analytics ·
E12 Subscription & Quota · E13 UI/UX Design System & Frontend Auth · E14 Testing & Hardening.

*Note: Frontend auth (anonymous sign-in, Google/password sign-in/link, account upgrade UI) is deferred to E13, after the web app is scaffolded.*
