# EventBuddy Namespace Module Outputs

output "namespace_name" {
  description = "Name of the created namespace"
  value       = kubernetes_namespace.eventbuddy.metadata[0].name
}

output "config_map_name" {
  description = "Name of the configuration ConfigMap"
  value       = kubernetes_config_map.eventbuddy_config.metadata[0].name
}

output "secrets_name" {
  description = "Name of the secrets Secret"
  value       = kubernetes_secret.eventbuddy_secrets.metadata[0].name
}

output "postgres_init_configmap_name" {
  description = "Name of the PostgreSQL init scripts ConfigMap"
  value       = var.deploy_in_cluster_db ? kubernetes_config_map.postgres_init_scripts[0].metadata[0].name : null
}