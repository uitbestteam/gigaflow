resource "google_cloud_tasks_queue" "q" {
  for_each = toset(var.queues)
  project  = var.project_id
  location = var.region
  name     = each.value
  retry_config { max_attempts = 5 }
}
