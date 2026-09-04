# GigaFlow — Setup Guide

End-to-end setup: local dev → GCP + Firebase + MongoDB Atlas → deploy.
Secrets are managed via **`terraform.tfvars`** (not Secret Manager) and injected
as plain Cloud Run env vars — see the security note in step 7.

- Region: `asia-southeast1` · API service: `gigaflow-api` · Project (dev): `gigaflow-dev`
- Stack: pnpm 10 + Turborepo monorepo — `apps/api` (Hono + MongoDB + Zod + Firebase Admin),
  `apps/web` (React + Vite PWA), `packages/shared` (Zod), `infra/` (Terraform).

---

## 0. Prerequisites

```bash
gcloud --version        # Google Cloud SDK
terraform --version     # >= 1.5
firebase --version      # npm i -g firebase-tools
node --version          # >= 20 ; corepack/pnpm 10
gcloud auth login
gcloud auth application-default login   # ADC (used by Vertex + local Firebase admin)
```

## 1. Run locally (no cloud needed)

```bash
pnpm install
```
```bash
cp .env.example .env                 # api env
cp apps/web/.env.example apps/web/.env
```
```bash
pnpm --filter @gigaflow/api dev      # needs a Mongo (local or an Atlas URI in .env)
```
```bash
pnpm --filter @gigaflow/web dev      # set VITE_API_BASE_URL + VITE_FIREBASE_* for real auth
```
Tests run fully offline (mongodb-memory-server + mocked AI/Firebase):
```bash
pnpm test && pnpm typecheck
```

## 2. Create the GCP + Firebase project

```bash
gcloud projects create gigaflow-dev --name="GigaFlow Dev"
gcloud config set project gigaflow-dev
gcloud billing projects link gigaflow-dev --billing-account=<BILLING_ACCOUNT_ID>
```
Add Firebase to the **same** project at <https://console.firebase.google.com> → Add project → pick `gigaflow-dev`.

## 3. Enable APIs — Terraform-managed

No manual step: Terraform enables all required APIs (`run`, `cloudtasks`,
`cloudscheduler`, `artifactregistry`, `cloudbuild`, `aiplatform`, `iam`) via
`google_project_service` on the first apply (step 7). A billed project already
has `serviceusage`/`cloudresourcemanager` on, which is all Terraform needs to
bootstrap.

## 4. Firebase — Auth, Web config, FCM

- **Auth providers — Terraform-managed** (`firebase-auth.tf`): **Anonymous** +
  **Email/Password** are enabled automatically by `terraform apply` (step 7).
  **Google** sign-in needs an OAuth 2.0 Web client — create one (APIs & Services →
  Credentials → OAuth client ID → Web), put `google_oauth_client_id` /
  `google_oauth_client_secret` in `terraform.tfvars`, set
  `enable_google_signin = true`, and `terraform apply`. (First apply may need
  Firebase Console → Authentication → **Get started** once to initialize Identity
  Platform, then re-apply.)
- **Web config** (Project settings → your web app) → into `apps/web/.env`:
  ```bash
  VITE_FIREBASE_API_KEY=…
  VITE_FIREBASE_AUTH_DOMAIN=gigaflow-dev.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=gigaflow-dev
  VITE_FIREBASE_APP_ID=…
  ```
- **Backend auth**: Cloud Run uses ADC automatically. For **local** api, download a
  service-account key (Project settings → Service accounts → Generate key) and set
  `GOOGLE_APPLICATION_CREDENTIALS=/abs/path.json` in `.env`.
- **Notifications (F4 web push)**: Project settings → Cloud Messaging → generate a
  **Web Push certificate (VAPID key)**, then add to `apps/web/.env`:
  `VITE_FIREBASE_VAPID_KEY=…` and `VITE_FIREBASE_MESSAGING_SENDER_ID=…`.
  (Push delivery only works once these + the committed `apps/web/public/firebase-messaging-sw.js` are wired.)

## 5. MongoDB Atlas

Create a cluster (Atlas = replica set → enables multi-doc transactions later), a DB user,
and network access. Copy the SRV connection string `mongodb+srv://USER:PASS@cluster/gigaflow`
(use a **fresh** password). It goes into `terraform.tfvars` in step 6/7 — not Secret Manager.

## 6. Terraform state bucket (one-time, manual)

Only the very first state bucket can't be Terraform-managed (chicken-and-egg —
Terraform needs it to store state). Everything else (APIs, **Artifact Registry**,
IAM, Cloud Tasks, Cloud Run, Cloud Scheduler, Cloud Build trigger) is Terraform.
```bash
gcloud storage buckets create gs://gigaflow-tfstate-dev \
  --project=gigaflow-dev --location=asia-southeast1 --uniform-bucket-level-access
```

## 7. Terraform apply (SA, IAM, Cloud Tasks, Cloud Run + env from tfvars)

```bash
cd infra/envs/dev
cp terraform.tfvars.example terraform.tfvars     # then edit it
```
Fill `terraform.tfvars`:
```hcl
project_id     = "gigaflow-dev"
image          = "asia-southeast1-docker.pkg.dev/gigaflow-dev/gigaflow/api:latest"
mongodb_db     = "gigaflow"
mongodb_uri    = "mongodb+srv://USER:PASS@cluster/gigaflow"
gemini_api_key = "…"   # optional
openai_api_key = "…"   # optional
ai_provider_order = "" # "" = default (gemini,openai); "vertex,gemini" = use Vertex (see §Vertex)
```
```bash
terraform init                      # uses the GCS backend (needs step 6)
# First apply just the APIs + Artifact Registry so you can push an image in step 8
# (Cloud Run needs the image to exist before it deploys):
terraform apply -target=google_project_service.services -target=google_artifact_registry_repository.docker
# …do step 8 (build & push the image)…
terraform apply                     # full apply
```
Terraform creates: **APIs** (`google_project_service`); **Artifact Registry** repo;
SA `gigaflow-api`; IAM (`cloudtasks.enqueuer`, `aiplatform.user`, and the **Cloud
Build SA** roles); Cloud Tasks queues; the **Cloud Run** service with
`MONGODB_URI` / `GEMINI_API_KEY` / `OPENAI_API_KEY` / `MONGODB_DB` / `AI_PROVIDER_ORDER`
etc. as **plain env vars** from `terraform.tfvars`; and the **Cloud Scheduler** job
for the workout-reminder cron.

> ⚠️ **Security trade-off (chosen):** secret values live in `terraform.tfvars`
> **and** in the Terraform state as plaintext, and are readable by anyone with
> `run.viewer`/console access. Keep the **state bucket private** (restricted IAM),
> and **never commit `terraform.tfvars`** (it is gitignored via `*.tfvars`).
> Rotate a secret by editing `terraform.tfvars` and re-running `terraform apply`.

## Deploy — manual, no Cloud Build (recommended)

One command does the whole rollout (build+push API image → `terraform apply` →
build web → `firebase deploy` → health check):
```bash
./scripts/deploy.sh dev          # or: prod
```
Prereqs: `gcloud auth login`, `firebase login`, `infra/envs/<env>/terraform.tfvars`
filled + `terraform init` done, and `apps/web/.env` filled (its `VITE_*` are baked
into the web build). Useful flags: `AUTO_APPROVE=1` (skip the terraform prompt),
`SKIP_WEB=1` (api only), `SKIP_API=1` (web only), `TAG=<tag>` (image tag; default = git short SHA).

Steps 8–9 below are exactly what the script runs, if you prefer to do them by hand.
**Cloud Build (step 10) is optional** — the trigger is off by default
(`enable_build_trigger = false`); use the script instead of CI if you want.

## 8. Build & push the API image, then roll out

```bash
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
docker build -f apps/api/Dockerfile -t asia-southeast1-docker.pkg.dev/gigaflow-dev/gigaflow/api:latest .
docker push asia-southeast1-docker.pkg.dev/gigaflow-dev/gigaflow/api:latest
cd infra/envs/dev && terraform apply     # sets the new image + any env changes on Cloud Run
```
Verify: `curl https://<cloud-run-url>/api/health`.

## 9. Firebase Hosting (the web app)

```bash
pnpm --filter @gigaflow/web build        # produces apps/web/dist (served per firebase.json)
firebase deploy --only hosting --project gigaflow-dev
curl https://gigaflow-dev.web.app/api/health   # confirms the /api/** rewrite → Cloud Run
```

## 10. CI/CD (Cloud Build trigger — OPTIONAL; use `scripts/deploy.sh` instead if you prefer manual)

The Cloud Build **SA IAM** and the **trigger** are Terraform-managed; only the
GitHub↔Cloud Build OAuth connection is manual (Terraform can't do the handshake):

1. GCP Console → **Cloud Build → Repositories → Connect** `uitbestteam/gigaflow`
   (installs the Cloud Build GitHub App).
2. In `terraform.tfvars` set `enable_build_trigger = true` → `terraform apply`.
   Terraform creates the `gigaflow-main-deploy` trigger (branch `^main$`,
   `cloudbuild.yaml`) and grants the Cloud Build SA `run.admin` /
   `iam.serviceAccountUser` / `artifactregistry.writer` / `firebasehosting.admin`.

(`.github/workflows/ci.yaml` runs tests on PRs; Cloud Build deploys on merge.)

## 11. Post-provision switch-overs (see `infra/README.md`)

- **Cloud Tasks (code)**: AI generation still runs **inline in-process**; swap the
  inline enqueuers for real Cloud Tasks calls and add the missing **InBody internal
  task handler**. (The Cloud Scheduler job for the reminder cron is already
  Terraform-managed — no manual wiring.)
- **Multi-doc transactions**: wrap the active-toggle / `replaceSetLogs` / session-finish
  writes in `withTransaction` (Atlas is a replica set).
- **Prod**: `infra/envs/prod/` mirrors dev — repeat steps 6–9 against `gigaflow-prod`.

---

## Using Vertex AI (instead of / alongside AI Studio Gemini)

The AI engine (workout, meal, InBody vision) supports three providers — AI Studio
Gemini (`GEMINI_API_KEY`), OpenAI, and **Vertex AI Gemini** — selected by the
**`AI_PROVIDER_ORDER`** switch. Vertex reaches the same Gemini models through Google
Cloud with **ADC auth (no API key)**, so usage runs through Vertex/GCP billing
(credit-eligible if your GCP promotion covers Vertex Gemini SKUs).

**Prereqs (already handled if you followed the steps):**
- `aiplatform.googleapis.com` enabled (step 3).
- The Cloud Run SA has `roles/aiplatform.user` (Terraform, step 7).
- Locally, `gcloud auth application-default login` (step 0).

**Turn it on — one line in `terraform.tfvars`:**
```hcl
ai_provider_order = "vertex,gemini"   # try Vertex first, fall back to AI Studio Gemini
# or "vertex" (only Vertex) / "gemini,vertex" (prefer AI Studio) / "" (default: gemini,openai)
```
```bash
cd infra/envs/dev && terraform apply    # sets AI_PROVIDER_ORDER on Cloud Run — no code change
```
That's it. `VERTEX_PROJECT_ID` defaults to `GCP_PROJECT_ID` (already set), `VERTEX_LOCATION`
defaults to `global`, and `VERTEX_MODEL` defaults to `gemini-2.5-flash` — override them by
adding `VERTEX_LOCATION` / `VERTEX_MODEL` to the `env_vars` block in `infra/envs/<env>/main.tf`
if needed.

**Local dev with Vertex:** in `apps/api/.env` set `AI_PROVIDER_ORDER=vertex,gemini` and
`GCP_PROJECT_ID=gigaflow-dev`, and make sure `gcloud auth application-default login` is done.

**Verify Vertex works + credit is consumed:**
```bash
TOKEN=$(gcloud auth print-access-token)
curl -s -X POST \
  "https://aiplatform.googleapis.com/v1/projects/gigaflow-dev/locations/global/publishers/google/models/gemini-2.5-flash:generateContent" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"hi"}]}]}'
```
A JSON `candidates` response = Vertex Gemini works. Then check **Billing → Reports**
(filter Service = Vertex AI) after a few hours to confirm whether your credit offsets the
Vertex Gemini SKU. If it does, keep `ai_provider_order = "vertex,…"`; if the credit only
covers Agent Builder/Discovery Engine, Vertex still works but is billed normally.

---

## Env var reference

**API (`.env` locally / Cloud Run env via tfvars):**
`PORT`, `MONGODB_URI`, `MONGODB_DB`, `GCP_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (local only),
`GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`,
`AI_PROVIDER_ORDER`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION`, `VERTEX_MODEL`.

**Web (`apps/web/.env`, build-time `VITE_*`):**
`VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY`,
`VITE_FIREBASE_MESSAGING_SENDER_ID`.

## Known gaps to close before a working deploy

1. **`cloudbuild.yaml` doesn't build the web app** before `firebase deploy` (placeholder
   step) → Hosting would ship a stale/empty `apps/web/dist`. This affects **only the
   optional Cloud Build path** — `scripts/deploy.sh` builds the web app correctly. If
   you enable Cloud Build, add `pnpm install && pnpm --filter @gigaflow/web build`
   (with the `VITE_*` build envs) to `cloudbuild.yaml` first.
2. **`apps/web/.env.example`** is missing `VITE_FIREBASE_VAPID_KEY` / `VITE_FIREBASE_MESSAGING_SENDER_ID`
   (needed for F4 push).
