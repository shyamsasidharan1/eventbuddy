# EventBuddy Production Infrastructure Outputs
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

# Managed Database Information (for CI/CD)
output "postgres_instance_name" {
  description = "Name of the Cloud SQL PostgreSQL instance"
  value       = var.deploy_managed_db ? google_sql_database_instance.eventbuddy_postgres[0].name : null
}

output "postgres_connection_name" {
  description = "Connection name for Cloud SQL PostgreSQL instance"
  value       = var.deploy_managed_db ? google_sql_database_instance.eventbuddy_postgres[0].connection_name : null
}

output "postgres_private_ip" {
  description = "Private IP address of PostgreSQL instance"
  value       = var.deploy_managed_db ? google_sql_database_instance.eventbuddy_postgres[0].private_ip_address : null
  sensitive   = true
}

output "postgres_database_url" {
  description = "Complete database URL for CI/CD"
  value       = var.deploy_managed_db ? "postgresql://eventbuddy_user:${var.postgres_password}@${google_sql_database_instance.eventbuddy_postgres[0].private_ip_address}:5432/eventbuddy" : null
  sensitive   = true
}

output "redis_instance_name" {
  description = "Name of the Memorystore Redis instance"
  value       = var.deploy_managed_db ? google_redis_instance.eventbuddy_redis[0].name : null
}

output "redis_host" {
  description = "Host address of Redis instance"
  value       = var.deploy_managed_db ? google_redis_instance.eventbuddy_redis[0].host : null
  sensitive   = true
}

output "redis_auth_string" {
  description = "Auth string for Redis instance"
  value       = var.deploy_managed_db ? google_redis_instance.eventbuddy_redis[0].auth_string : null
  sensitive   = true
}

output "redis_url" {
  description = "Complete Redis URL for CI/CD"
  value       = var.deploy_managed_db ? "redis://:${google_redis_instance.eventbuddy_redis[0].auth_string}@${google_redis_instance.eventbuddy_redis[0].host}:${google_redis_instance.eventbuddy_redis[0].port}" : null
  sensitive   = true
}

# Connection Information
output "kubectl_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${var.cluster_name} --zone ${var.zone} --project ${var.project_id}"
}

# Cost Estimation
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown"
  value = {
    cloud_sql_postgres = var.deploy_managed_db ? "~$7-15/month (db-f1-micro)" : "$0"
    memorystore_redis  = var.deploy_managed_db ? "~$25/month (1GB)" : "$0"
    gke_nodes          = "${var.min_nodes}-${var.max_nodes} × e2-standard-2 nodes (~$25-60/month)"
    total_estimate     = var.deploy_managed_db ? "~$57-100/month" : "~$25-60/month"
  }
}