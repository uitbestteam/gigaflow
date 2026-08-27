# GigaFlow infra (Terraform)

Terraform skeleton for the GCP resources backing `gigaflow-api`: Cloud Run
service, Secret Manager secrets, and the runtime service account + IAM.

Layout:

```
infra/
  envs/dev/            # dev environment root module
  modules/secrets/     # Secret Manager secrets
  modules/cloud-run/   # Cloud Run v2 service + public invoker IAM
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

2. **Enable required GCP APIs** (one-time, manual):
   ```bash
   gcloud services enable run.googleapis.com secretmanager.googleapis.com \
     cloudtasks.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
     --project=gigaflow-dev
   ```

3. **Create the Atlas cluster (dev)** by hand in MongoDB Atlas, then add its
   connection string as the `mongodb-uri` secret version:
   ```bash
   printf '%s' "mongodb+srv://USER:PASS@cluster.mongodb.net/gigaflow" | \
     gcloud secrets versions add mongodb-uri --data-file=- --project=gigaflow-dev
   ```
   Note: the secret resource itself is created by `terraform apply` (step 5
   below) — add the version *after* apply, or after the secret exists.

4. **Add the `gemini-api-key` and `openai-api-key` secret versions** the same
   way, using real provider API keys:
   ```bash
   printf '%s' "<gemini-api-key>" | gcloud secrets versions add gemini-api-key --data-file=- --project=gigaflow-dev
   printf '%s' "<openai-api-key>" | gcloud secrets versions add openai-api-key --data-file=- --project=gigaflow-dev
   ```

5. **Init with the real backend and apply**:
   ```bash
   cd infra/envs/dev
   cp terraform.tfvars.example terraform.tfvars   # fill in the real image URL
   terraform init                                  # uses the GCS backend (needs step 1 done)
   terraform validate
   terraform plan
   terraform apply
   ```

Ordering note: `terraform apply` creates the Secret Manager secret
*resources* (empty, no versions) as well as the Cloud Run service, service
account, and IAM bindings. The Cloud Run revision will fail to start until
each secret has at least one version, so add the secret versions (steps 3-4)
either right after `apply`, or before deploying real traffic to the service.

6. **Firebase Hosting deployment**:
   ```bash
   firebase deploy --only hosting --project gigaflow-dev
   ```
   Verify rewrite to Cloud Run works: `curl https://<hosting-url>/api/health`
   (deferred until Cloud Run is deployed and verified).

## Deferred CI/CD setup

The following Cloud Build and GitHub integration steps are **deferred to a human**:

1. **Create Artifact Registry repository** (one-time, manual):
   ```bash
   gcloud artifacts repositories create gigaflow --repository-format=docker \
     --location=asia-southeast1 --project=gigaflow-dev
   ```

2. **Connect GitHub repository to Cloud Build** (one-time, manual):
   Use the GCP Console to create a Cloud Build trigger on branch `main`, or run:
   ```bash
   gcloud builds triggers create github \
     --name=gigaflow-main-deploy \
     --repo-owner=<github-org> \
     --repo-name=gigaflow \
     --branch-pattern="^main$" \
     --build-config=cloudbuild.yaml \
     --project=gigaflow-dev
   ```

3. **Grant Cloud Build service account permissions**:
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe gigaflow-dev --format='value(projectNumber)')
   CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
   
   # Grant Cloud Run admin
   gcloud projects add-iam-policy-binding gigaflow-dev \
     --member="serviceAccount:${CLOUD_BUILD_SA}" \
     --role="roles/run.admin"
   
   # Grant Firebase Hosting admin
   gcloud projects add-iam-policy-binding gigaflow-dev \
     --member="serviceAccount:${CLOUD_BUILD_SA}" \
     --role="roles/firebase.admin"
   ```

Note: GitHub Actions workflow (`.github/workflows/ci.yaml`) runs on pull requests
to main for fast local test feedback (no GCP resources needed). Cloud Build
(`cloudbuild.yaml`) runs on main branch merges to build, push image to Artifact
Registry, deploy to Cloud Run, and deploy Firebase Hosting.

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
3. **Cloud Tasks + Cloud Scheduler switch-over** — AI generation
   (workout/meal/InBody) currently runs **inline in-process** rather than
   through the provisioned Cloud Tasks queues (`workout-gen`, `meal-gen`,
   `inbody-ocr`), and the workout-reminder cron is not yet wired to Cloud
   Scheduler. Before production traffic: replace the inline enqueuers with
   real Cloud Tasks task creation calling an internal HTTP handler, add the
   missing **InBody internal task handler** (workout and meal already have
   internal routes; InBody's analysis currently only runs inline), and
   point Cloud Scheduler at `POST /internal/cron/workout-reminders`.
4. **Rotate any exposed secrets** — any Atlas connection string / password
   used during development or shared in chat, docs, or `.env` files should
   be rotated before go-live, since local `.env` values are not treated as
   production secrets. Only `gcloud secrets versions add` into Secret
   Manager (per the steps above) should hold the production credentials.

## Firebase auth (deferred)

The backend API implements Firebase ID token verification for the `/api/auth/session` endpoint. Setup steps:

1. **Enable providers in Firebase Console** (one-time, manual):
   - Go to the Firebase project console (`gigaflow-dev`).
   - In **Authentication → Sign-in method**, enable:
     - **Anonymous** — for guest mode (zero migration path).
     - **Google** — for social sign-in.
     - **Email/Password** — for email + password sign-in.

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
