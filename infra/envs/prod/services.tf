# Project services (APIs), Artifact Registry, Cloud Build CI trigger + IAM,
# and the workout-reminder Cloud Scheduler job — all Terraform-managed.

data "google_project" "this" {
  project_id = var.project_id
}

locals {
  services = [
    "run.googleapis.com",
    "cloudtasks.googleapis.com",
    "cloudscheduler.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "aiplatform.googleapis.com",
    "iam.googleapis.com",
  ]
  cloudbuild_sa = "serviceAccount:${data.google_project.this.number}@cloudbuild.gserviceaccount.com"
}

resource "google_project_service" "services" {
  for_each           = toset(local.services)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Docker repo for the API image.
resource "google_artifact_registry_repository" "docker" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_id
  format        = "DOCKER"
  description   = "GigaFlow API container images"
  depends_on    = [google_project_service.services]
}

# Cloud Build service account permissions (deploy Cloud Run + Firebase Hosting, push images).
resource "google_project_iam_member" "cloudbuild_roles" {
  for_each = toset([
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
    "roles/artifactregistry.writer",
    "roles/firebasehosting.admin",
  ])
  project    = var.project_id
  role       = each.value
  member     = local.cloudbuild_sa
  depends_on = [google_project_service.services]
}

# CI/CD trigger on main. Requires the GitHub repo to be connected to Cloud Build
# ONCE via the console (the Cloud Build GitHub App OAuth handshake cannot be
# Terraformed). After connecting, set enable_build_trigger = true and apply.
resource "google_cloudbuild_trigger" "main_deploy" {
  count    = var.enable_build_trigger ? 1 : 0
  project  = var.project_id
  name     = "gigaflow-main-deploy"
  filename = "cloudbuild.yaml"
  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = "^main$"
    }
  }
  depends_on = [google_project_service.services]
}

# Daily workout-reminder cron → the internal Cloud Run endpoint.
resource "google_cloud_scheduler_job" "workout_reminders" {
  project   = var.project_id
  region    = var.region
  name      = "gigaflow-workout-reminders"
  schedule  = var.reminders_cron
  time_zone = var.reminders_time_zone

  http_target {
    http_method = "POST"
    uri         = "${module.cloud_run.url}/api/internal/cron/workout-reminders"
    headers = {
      "X-CloudTasks-QueueName" = "scheduler"
    }
    oidc_token {
      service_account_email = google_service_account.api.email
    }
  }

  depends_on = [google_project_service.services, module.cloud_run]
}
