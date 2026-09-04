variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  description = "GCP region for all resources."
  default     = "asia-southeast1"
}

variable "image" {
  type        = string
  description = "Cloud Run container image URL."
}

variable "api_base_url" {
  type        = string
  description = "Public base URL of the Cloud Run service (e.g. https://gigaflow-api-xxxx-as.a.run.app). Used as the Cloud Tasks target for async job processing. Set to the `api_url` output after the first deploy; empty disables Cloud Tasks (falls back to in-process background jobs)."
  default     = ""
}

variable "mongodb_db" {
  type        = string
  description = "MongoDB database name."
  default     = "gigaflow"
}

variable "mongodb_uri" {
  type        = string
  description = "MongoDB Atlas connection string (SRV URI). Set in terraform.tfvars (gitignored)."
  sensitive   = true
}

variable "gemini_api_key" {
  type        = string
  description = "Gemini (AI Studio) API key. Set in terraform.tfvars (gitignored). Empty disables the Gemini provider."
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  type        = string
  description = "OpenAI API key (workout fallback). Set in terraform.tfvars (gitignored). Empty disables OpenAI."
  sensitive   = true
  default     = ""
}

variable "ai_provider_order" {
  type        = string
  description = "AI provider priority list, e.g. \"vertex,gemini,openai\". Empty = default (gemini,openai). Set \"vertex,gemini\" to run AI through Vertex (uses the SA's ADC + roles/aiplatform.user)."
  default     = ""
}

variable "artifact_repo_id" {
  type        = string
  description = "Artifact Registry repository id for the API image."
  default     = "gigaflow"
}

variable "github_owner" {
  type        = string
  description = "GitHub org/user that owns the repo (for the Cloud Build trigger)."
  default     = "uitbestteam"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name (for the Cloud Build trigger)."
  default     = "gigaflow"
}

variable "enable_build_trigger" {
  type        = bool
  description = "Create the Cloud Build GitHub trigger. Set true only AFTER connecting the repo to Cloud Build once via the console (GitHub App OAuth)."
  default     = false
}

variable "reminders_cron" {
  type        = string
  description = "Cron schedule for the workout-reminder job."
  default     = "0 9 * * *"
}

variable "reminders_time_zone" {
  type        = string
  description = "IANA time zone for the reminder cron."
  default     = "Asia/Ho_Chi_Minh"
}

variable "enable_google_signin" {
  type        = bool
  description = "Enable Google sign-in (Identity Platform). Requires an OAuth 2.0 client — set google_oauth_client_id/secret first."
  default     = false
}

variable "google_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 Web client id for Google sign-in. Set in terraform.tfvars when enable_google_signin = true."
  default     = ""
}

variable "google_oauth_client_secret" {
  type        = string
  description = "OAuth 2.0 Web client secret for Google sign-in. Set in terraform.tfvars (gitignored)."
  sensitive   = true
  default     = ""
}
