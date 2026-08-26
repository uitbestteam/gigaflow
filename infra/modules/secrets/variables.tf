variable "project_id" {
  type        = string
  description = "GCP project id that owns the secrets."
}

variable "secret_ids" {
  type        = list(string)
  description = "Secret Manager secret ids to create."
}
