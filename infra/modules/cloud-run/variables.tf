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

variable "env_vars" {
  type        = map(string)
  description = "Map of ENV_NAME => literal value to inject as Cloud Run env vars. Secret values passed here land in Cloud Run env AND Terraform state as plaintext — protect the state backend and restrict run.viewer."
  sensitive   = true
  default     = {}
}
