terraform {
  required_version = ">= 1.9"

  backend "gcs" {
    bucket = "gigaflow-tfstate-dev"
    prefix = "env/dev"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
