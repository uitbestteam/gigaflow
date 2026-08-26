variable "project_id" {
  type        = string
  description = "GCP project id."
}

variable "region" {
  type        = string
  description = "GCP region for the Cloud Run service."
}

variable "image" {
  type        = string
  description = "Container image URL (Artifact Registry / gcr)."
}

variable "service_account" {
  type        = string
  description = "Runtime service account email for the Cloud Run service."
}

variable "secret_env" {
  type        = map(string)
  description = "Map of ENV_NAME => secret_id to inject as env vars from Secret Manager."
  default     = {}
}
