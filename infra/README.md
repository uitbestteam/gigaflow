# GigaFlow infra (Terraform)

Terraform for the GCP resources backing `gigaflow-api`. Terraform-managed:
**project APIs** (`google_project_service`), **Artifact Registry** repo,
runtime service account + IAM, **Cloud Tasks** queues, the **Cloud Run**
service (plain env vars), the **Cloud Scheduler** reminder job, the **Cloud
Build** SA IAM + CI trigger, and **Firebase Auth** sign-in methods (Identity
Platform: Anonymous + Email/Password, optional Google). Manual (can't be
Terraformed): the first GCS state bucket, the GitHub↔Cloud Build OAuth
connection, the Google OAuth client for social sign-in, the image build/push,
and `firebase deploy` of the web app.

**Secrets:** this setup does NOT use Secret Manager. Secret values
(`mongodb_uri`, `gemini_api_key`, `openai_api_key`) are passed via
`terraform.tfvars` and injected as plain Cloud Run **env vars**. Trade-off:
those values live in `terraform.tfvars` (gitignored) AND in Terraform state
as plaintext, and are visible to anyone with `run.viewer`/console access —
so **protect the state backend** (private GCS bucket, restricted IAM) and
never commit `terraform.tfvars`.

Layout:

```
infra/
  envs/dev/            # dev root module (main.tf + services.tf: APIs, Artifact
  envs/prod/           #   Registry, Cloud Build trigger+IAM, Cloud Scheduler)
  modules/cloud-tasks/ # Cloud Tasks queues
  modules/cloud-run/   # Cloud Run v2 service + public invoker IAM (plain env vars)
```

This skeleton was authored and statically validated (`terraform fmt`,
`terraform init -backend=false`, `terraform validate`) without touching any
real GCP project. The following steps are **deferred to a human** because
they provision real cloud resources, cost money, or need credentials/data
that don't exist yet:

1. **Create the GCS state bucket** (one-time, manual):
   ```bash
   gcloud storage buckets create gs://gigaflow-tfstate-dev \
     --project=gigaflow-dev --location=asia-southeast1 --uniform-bucket-level-access
   ```

2. **APIs are now Terraform-managed** (`google_project_service`) — no manual
   `gcloud services enable` needed. (The `serviceusage`/`cloudresourcemanager`
   APIs, on by default for a billed project, are all Terraform needs to bootstrap.)

3. **Create the Atlas cluster (dev)** by hand in MongoDB Atlas and copy its
   SRV connection string — you'll put it in `terraform.tfvars` (step 4), not
   Secret Manager.

4. **Fill `terraform.tfvars`, init, and apply**:
   ```bash
   cd infra/envs/dev
   cp terraform.tfvars.example terraform.tfvars   # fill image URL + mongodb_uri + gemini/openai keys
   # terraform.tfvars is gitignored — never commit it.
   terraform init                                 # uses the GCS backend (needs step 1 done)
   # First apply: create the APIs + Artifact Registry so you can push an image
   # (Cloud Run needs the image to exist before it can deploy):
   terraform apply -target=google_project_service.services -target=google_artifact_registry_repository.docker
   # …build & push the API image (see "Build & push" in docs/SETUP.md)…
   terraform apply                                # full apply: SA, IAM, queues, Cloud Run, scheduler
   ```
   Terraform now creates: **APIs**, **Artifact Registry** repo, service account,
   Cloud Tasks queues, IAM (incl. the Cloud Build SA roles), the **Cloud Run**
   service with `mongodb_uri`/`gemini_api_key`/`openai_api_key`/`ai_provider_order`
   from `terraform.tfvars` as plain env vars, and the **Cloud Scheduler** job for
   workout reminders. Re-run `apply` after building a new image (update `image`)
   to roll out image + env. Secret/AI-switch rotation = edit `terraform.tfvars`
   and `terraform apply`.

6. **Firebase Hosting deployment**:
   ```bash
   firebase deploy --only hosting --project gigaflow-dev
   ```
   Verify rewrite to Cloud Run works: `curl https://<hosting-url>/api/health`
   (deferred until Cloud Run is deployed and verified).

## Deploy

**Manual (no Cloud Build):** `./scripts/deploy.sh dev` (or `prod`) — builds &
pushes the API image, `terraform apply`s (Cloud Run image + env from tfvars),
builds the web app, `firebase deploy`s hosting, and health-checks. This is the
recommended path; the Cloud Build trigger below is optional (off by default).

## CI/CD (optional — Cloud Build, one manual OAuth step)

Artifact Registry, the Cloud Build **SA IAM** (`run.admin`,
`iam.serviceAccountUser`, `artifactregistry.writer`, `firebasehosting.admin`),
and the Cloud Build **trigger** are all Terraform (`services.tf`). The only part
Terraform cannot do is the **GitHub ↔ Cloud Build OAuth handshake** (connecting
the repo to the Cloud Build GitHub App), so:

1. **Connect the repo once** in the GCP Console → Cloud Build → Repositories →
   Connect `uitbestteam/gigaflow` (the GitHub App install / OAuth).
2. **Enable the trigger** — set `enable_build_trigger = true` in `terraform.tfvars`
   and `terraform apply`. Terraform then creates `gigaflow-main-deploy`
   (branch `^main$`, `cloudbuild.yaml`). Override `github_owner`/`github_repo` in
   tfvars if they differ from the defaults.

Note: GitHub Actions (`.github/workflows/ci.yaml`) runs tests on PRs (no GCP
needed). Cloud Build (`cloudbuild.yaml`) runs on main merges to build, push the
image, deploy Cloud Run, and deploy Firebase Hosting.

## Remaining before production

The following are explicitly deferred, with the blocker for each:

1. **Multi-document transactions** — `plan`/`meal`/`inbody` active-toggle
   (deactivating the previous active record while activating the new one),
   `replaceSetLogs`, and session `finish` + progression-cache refresh each
   touch more than one document and are **not yet wrapped in a MongoDB
   transaction**. This needs a **replica set** (or MongoDB Atlas, which is
   always a replica set) — the standalone/`mongodb-memory-server` instance
   used for local dev and unit tests does not support transactions. Wrap
   these multi-document writes in `withTransaction` once the target
   deployment is on a replica set / Atlas.
2. **Terraform prod `apply`** — `infra/envs/prod/` is a files-only skeleton
   (mirrors `infra/envs/dev/`, `terraform fmt`'d, never `init`'d or
   `apply`'d). Provisioning the real `gigaflow-prod` project, state bucket,
   and resources is deferred to a human following the same steps as dev
   (see above), against the prod project/bucket.
3. **Cloud Tasks switch-over (code)** — AI generation (workout/meal/InBody)
   currently runs **inline in-process** rather than through the provisioned
   Cloud Tasks queues (`workout-gen`, `meal-gen`, `inbody-ocr`). Before
   production traffic: replace the inline enqueuers with real Cloud Tasks task
   creation calling an internal HTTP handler, and add the missing **InBody
   internal task handler** (workout and meal already have internal routes;
   InBody's analysis currently only runs inline). The **Cloud Scheduler** job
   for `POST /api/internal/cron/workout-reminders` is already Terraform-managed
   (`services.tf`); it will work once the Cloud Run service is deployed.
4. **Rotate any exposed secrets** — any Atlas connection string / password
   used during development or shared in chat, docs, or `.env` files should
   be rotated before go-live. Production credentials live in
   `infra/envs/<env>/terraform.tfvars` (gitignored) and, once applied, in the
   Terraform state and Cloud Run env — so keep the state backend private and
   the `terraform.tfvars` files off git.

## Firebase auth

The backend API verifies Firebase ID tokens for `/api/auth/session`.

1. **Sign-in providers — Terraform-managed** (`firebase-auth.tf`, Identity Platform):
   - **Anonymous** (guest) and **Email/Password** are enabled by `terraform apply`.
   - **Google** (social) is gated behind `enable_google_signin` because it needs an
     OAuth 2.0 Web client: create the client (Console → APIs & Services →
     Credentials → OAuth client ID → Web), set `google_oauth_client_id` /
     `google_oauth_client_secret` in `terraform.tfvars`, set
     `enable_google_signin = true`, and `terraform apply`.
   - One-time init: if the first apply errors on `google_identity_platform_config`,
     open Firebase Console → Authentication → **Get started** once, then re-apply.

2. **Cloud Run runtime credentials** (automatic in production):
   - The Cloud Run service account (created by Terraform) has the `roles/iam.serviceAccountTokenCreator` role bound to it.
   - At runtime, `firebase-admin` uses **Application Default Credentials (ADC)** to verify ID tokens — no key file in the container.
   - Credentials are automatically injected by the Cloud Run environment.

3. **Local development**:
   - Download a service account JSON key from the Firebase project console (**Project Settings → Service Accounts → Generate new private key**).
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of the key file (see `.env.example`).
   - The `firebase-admin` SDK uses this to verify real Firebase ID tokens during local development.

4. **Unit tests**:
   - Tests use a fake token verifier (no real Firebase credentials needed).
   - Tests run in isolation and do not call Firebase services.
