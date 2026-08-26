provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "gigaflow-api"
  display_name = "GigaFlow API runtime"
}

module "secrets" {
  source     = "../../modules/secrets"
  project_id = var.project_id
  secret_ids = ["mongodb-uri", "gemini-api-key", "openai-api-key"]
}

resource "google_project_iam_member" "sa_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "sa_cloud_tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

module "cloud_run" {
  source          = "../../modules/cloud-run"
  project_id      = var.project_id
  region          = var.region
  image           = var.image
  service_account = google_service_account.api.email
  secret_env = {
    MONGODB_URI    = "mongodb-uri"
    GEMINI_API_KEY = "gemini-api-key"
    OPENAI_API_KEY = "openai-api-key"
  }
  depends_on = [module.secrets, google_project_iam_member.sa_secret_accessor]
}

output "api_url" {
  value = module.cloud_run.url
}
