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
