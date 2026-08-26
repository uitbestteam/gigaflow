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
