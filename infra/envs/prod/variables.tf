variable "project_id" {
  type        = string
  description = "GCP project id."
  default     = "gigaflow-prod"
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
