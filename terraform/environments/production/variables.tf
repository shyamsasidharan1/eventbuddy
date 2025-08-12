# EventBuddy Production Infrastructure Variables
# Simplified - Infrastructure Only

# Authentication
variable "access_token" {
  description = "GCP access token for authentication"
  type        = string
  sensitive   = true
  default     = ""
}

# GCP Configuration
variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "hypnotic-surfer-468513-a0"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Cluster Configuration
variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "eventbuddy-cluster"
}

variable "use_existing_cluster" {
  description = "Use existing cluster instead of creating a new one"
  type        = bool
  default     = true
}

variable "min_nodes" {
  description = "Minimum number of nodes in the cluster"
  type        = number
  default     = 2
}

variable "max_nodes" {
  description = "Maximum number of nodes in the cluster"
  type        = number
  default     = 5
}

variable "machine_type" {
  description = "Machine type for cluster nodes"
  type        = string
  default     = "e2-standard-2"  # Larger for production
}

# Managed Database Configuration
variable "deploy_managed_db" {
  description = "Deploy managed Cloud SQL and Memorystore instances"
  type        = bool
  default     = true
}

variable "postgres_tier" {
  description = "Cloud SQL tier for PostgreSQL"
  type        = string
  default     = "db-f1-micro"  # Start small, can upgrade
}

variable "postgres_password" {
  description = "Password for PostgreSQL user"
  type        = string
  sensitive   = true
  default     = ""  # Must be provided
}

variable "redis_memory_size_gb" {
  description = "Memory size for Redis instance in GB"
  type        = number
  default     = 1
}