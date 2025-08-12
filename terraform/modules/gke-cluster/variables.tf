# GKE Cluster Module Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "eventbuddy-cluster"
}

variable "zone" {
  description = "GCP zone for the cluster"
  type        = string
  default     = "us-central1-a"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

# Node Pool Configuration
variable "node_pool_name" {
  description = "Name of the node pool"
  type        = string
  default     = "e2-small-pool"
}

variable "machine_type" {
  description = "Machine type for cluster nodes"
  type        = string
  default     = "e2-small"
}

variable "min_nodes" {
  description = "Minimum number of nodes in the cluster"
  type        = number
  default     = 1
}

variable "max_nodes" {
  description = "Maximum number of nodes in the cluster"
  type        = number
  default     = 3
}

variable "disk_size_gb" {
  description = "Disk size for cluster nodes in GB"
  type        = number
  default     = 20  # Increased from 10GB to meet GKE image requirements (min 12GB) with buffer
}

variable "preemptible" {
  description = "Use preemptible nodes for cost savings"
  type        = bool
  default     = false
}