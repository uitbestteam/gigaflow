resource "google_cloud_run_v2_service" "api" {
  name                = "gigaflow-api"
  project             = var.project_id
  location            = var.region
  deletion_protection = false

  template {
    service_account = var.service_account

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      resources {
        # Request-based billing (serverless): CPU is allocated only while a
        # request is being handled. Async job processing runs via Cloud Tasks
        # hitting the /internal/tasks routes in their own requests, so no
        # cpu-always-on is needed. startup_cpu_boost speeds cold starts.
        cpu_idle          = true
        startup_cpu_boost = true
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      startup_probe {
        http_get {
          path = "/api/health/ready"
        }
        initial_delay_seconds = 5
        period_seconds        = 5
      }

      liveness_probe {
        http_get {
          path = "/api/health/live"
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
