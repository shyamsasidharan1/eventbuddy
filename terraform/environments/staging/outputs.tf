# EventBuddy Staging Infrastructure Outputs
# Simplified - Infrastructure Only

# Cluster Information
output "cluster_name" {
  description = "Name of the GKE cluster"
  value       = var.use_existing_cluster ? var.cluster_name : module.gke_cluster[0].cluster_name
}

output "cluster_zone" {
  description = "Zone of the GKE cluster"
  value       = var.zone
}

output "cluster_location" {
  description = "Location of the GKE cluster"
  value       = var.use_existing_cluster ? var.zone : module.gke_cluster[0].cluster_location
}

output "cluster_endpoint" {
  description = "Endpoint of the GKE cluster"
  value       = var.use_existing_cluster ? data.google_container_cluster.existing_cluster[0].endpoint : module.gke_cluster[0].cluster_endpoint
  sensitive   = true
}

output "project_id" {
  description = "The GCP project ID"
  value       = var.project_id
}

# Connection Information
output "kubectl_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${var.cluster_name} --zone ${var.zone} --project ${var.project_id}"
}