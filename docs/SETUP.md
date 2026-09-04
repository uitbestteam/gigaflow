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

## 3. Enable APIs

```bash
gcloud services enable run.googleapis.com \
  cloudtasks.googleapis.com cloudscheduler.googleapis.com \
  artifactregistry.googleapis.com cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  --project=gigaflow-dev
```

## 4. Firebase — Auth, Web config, FCM

- **Auth** (Console → Authentication → Sign-in method): enable **Anonymous**, **Google**, **Email/Password**.
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

## 6. Terraform state bucket + Artifact Registry (one-time, manual)

The very first state bucket can't be Terraform-managed (chicken-and-egg):
```bash
gcloud storage buckets create gs://gigaflow-tfstate-dev \
  --project=gigaflow-dev --location=asia-southeast1 --uniform-bucket-level-access
```
```bash
gcloud artifacts repositories create gigaflow --repository-format=docker \
  --location=asia-southeast1 --project=gigaflow-dev
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
terraform validate && terraform plan
terraform apply
```
Terraform creates: SA `gigaflow-api`; IAM (`cloudtasks.enqueuer`, `aiplatform.user`);
Cloud Tasks queues (`workout-gen`, `meal-gen`, `inbody-ocr`); the **Cloud Run** service
with `MONGODB_URI` / `GEMINI_API_KEY` / `OPENAI_API_KEY` / `MONGODB_DB` / `AI_PROVIDER_ORDER`
etc. set as **plain env vars** from `terraform.tfvars`.

> ⚠️ **Security trade-off (chosen):** secret values live in `terraform.tfvars`
> **and** in the Terraform state as plaintext, and are readable by anyone with
> `run.viewer`/console access. Keep the **state bucket private** (restricted IAM),
> and **never commit `terraform.tfvars`** (it is gitignored via `*.tfvars`).
> Rotate a secret by editing `terraform.tfvars` and re-running `terraform apply`.

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

## 10. CI/CD (Cloud Build trigger on `main`)

```bash
gcloud builds triggers create github --name=gigaflow-main-deploy \
  --repo-owner=uitbestteam --repo-name=gigaflow --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml --project=gigaflow-dev

PROJECT_NUMBER=$(gcloud projects describe gigaflow-dev --format='value(projectNumber)')
for role in run.admin firebase.admin iam.serviceAccountUser artifactregistry.writer; do
  gcloud projects add-iam-policy-binding gigaflow-dev \
    --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" --role="roles/$role"
done
```
(`.github/workflows/ci.yaml` runs tests on PRs; Cloud Build deploys on merge.)

## 11. Post-provision switch-overs (see `infra/README.md`)

- **Cloud Tasks / Scheduler**: AI generation still runs **inline in-process**; swap the
  inline enqueuers for real Cloud Tasks calls, add the missing **InBody internal task
  handler**, and point Cloud Scheduler at `POST /internal/cron/workout-reminders`.
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
   step) → Hosting ships a stale/empty `apps/web/dist`. Add
   `pnpm install && pnpm --filter @gigaflow/web build` (with the `VITE_*` build envs).
2. **`apps/web/.env.example`** is missing `VITE_FIREBASE_VAPID_KEY` / `VITE_FIREBASE_MESSAGING_SENDER_ID`
   (needed for F4 push).
