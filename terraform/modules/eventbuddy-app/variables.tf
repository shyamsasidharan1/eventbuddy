# EventBuddy Application Module Variables

variable "namespace_name" {
  description = "Kubernetes namespace name"
  type        = string
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "config_map_name" {
  description = "Name of the configuration ConfigMap"
  type        = string
}

variable "secrets_name" {
  description = "Name of the secrets Secret"
  type        = string
}

variable "postgres_init_configmap_name" {
  description = "Name of the PostgreSQL init scripts ConfigMap"
  type        = string
  default     = null
}

# Application Configuration
variable "api_image" {
  description = "Docker image for EventBuddy API"
  type        = string
  default     = "us-central1-docker.pkg.dev/hypnotic-surfer-468513-a0/eventbuddy-repo/eventbuddy:latest"
}

variable "api_replicas" {
  description = "Number of API replicas"
  type        = number
  default     = 2
}

variable "service_type" {
  description = "Kubernetes service type (ClusterIP, NodePort, LoadBalancer)"
  type        = string
  default     = "ClusterIP"
}

# Database deployment option
variable "deploy_in_cluster_db" {
  description = "Deploy PostgreSQL and Redis inside the cluster (staging only)"
  type        = bool
  default     = false
}