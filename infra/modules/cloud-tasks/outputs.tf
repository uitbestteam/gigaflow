output "queue_names" { value = [for q in google_cloud_tasks_queue.q : q.name] }
