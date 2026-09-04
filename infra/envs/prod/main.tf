provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "gigaflow-api"
  display_name = "GigaFlow API runtime"
}

resource "google_project_iam_member" "sa_cloud_tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "sa_vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.api.email}"
}

module "cloud_tasks" {
  source     = "../../modules/cloud-tasks"
  project_id = var.project_id
  region     = var.region
  queues     = ["workout-gen", "meal-gen", "inbody-ocr"]
  depends_on = [google_project_service.services]
}

module "cloud_run" {
  source          = "../../modules/cloud-run"
  project_id      = var.project_id
  region          = var.region
  image           = var.image
  service_account = google_service_account.api.email
  env_vars = {
    NODE_ENV          = "production"
    GCP_PROJECT_ID    = var.project_id
    MONGODB_URI       = var.mongodb_uri
    MONGODB_DB        = var.mongodb_db
    GEMINI_API_KEY    = var.gemini_api_key
    OPENAI_API_KEY    = var.openai_api_key
    AI_PROVIDER_ORDER = var.ai_provider_order
  }
  depends_on = [google_project_service.services]
}

output "api_url" {
  value = module.cloud_run.url
}
