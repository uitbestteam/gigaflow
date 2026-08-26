output "secret_ids" {
  value = [for s in google_secret_manager_secret.s : s.secret_id]
}
