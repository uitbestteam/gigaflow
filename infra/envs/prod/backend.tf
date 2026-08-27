terraform {
  required_version = ">= 1.9"

  backend "gcs" {
    bucket = "gigaflow-tfstate-prod"
    prefix = "env/prod"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
