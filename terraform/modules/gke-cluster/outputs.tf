# GKE Cluster Module Outputs

output "cluster_name" {
  description = "Name of the GKE cluster"
  value       = google_container_cluster.eventbuddy_cluster.name
}

output "cluster_location" {
  description = "Location of the GKE cluster"
  value       = google_container_cluster.eventbuddy_cluster.location
}

output "cluster_endpoint" {
  description = "Endpoint of the GKE cluster"
  value       = google_container_cluster.eventbuddy_cluster.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "CA certificate of the GKE cluster"
  value       = base64decode(google_container_cluster.eventbuddy_cluster.master_auth.0.cluster_ca_certificate)
  sensitive   = true
}

output "node_pool_name" {
  description = "Name of the primary node pool"
  value       = google_container_node_pool.eventbuddy_nodes.name
}

output "service_account_email" {
  description = "Email of the cluster service account"
  value       = google_service_account.eventbuddy_cluster_sa.email
}