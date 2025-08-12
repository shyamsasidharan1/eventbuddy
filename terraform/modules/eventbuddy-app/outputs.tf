# EventBuddy Application Module Outputs

output "api_deployment_name" {
  description = "Name of the API deployment"
  value       = kubernetes_deployment.eventbuddy_api.metadata[0].name
}

output "api_service_name" {
  description = "Name of the API service"
  value       = kubernetes_service.eventbuddy_api.metadata[0].name
}

output "postgres_service_name" {
  description = "Name of the PostgreSQL service"
  value       = var.deploy_in_cluster_db ? kubernetes_service.postgres[0].metadata[0].name : null
}

output "redis_service_name" {
  description = "Name of the Redis service"
  value       = var.deploy_in_cluster_db ? kubernetes_service.redis[0].metadata[0].name : null
}

output "api_service_load_balancer_ip" {
  description = "Load balancer IP address (if using LoadBalancer service type)"
  value       = var.service_type == "LoadBalancer" ? kubernetes_service.eventbuddy_api.status[0].load_balancer[0].ingress[0].ip : null
}