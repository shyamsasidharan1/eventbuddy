# EventBuddy Staging Infrastructure
# Simplified Terraform - Infrastructure Only
# Application deployments handled by CI/CD pipeline

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Backend configuration for Terraform state
  # Uncomment and configure after creating the GCS bucket
  # backend "gcs" {
  #   bucket = "eventbuddy-terraform-state"
  #   prefix = "staging"
  # }
}

# Configure the Google Cloud Provider
provider "google" {
  project      = var.project_id
  region       = var.region
  zone         = var.zone
  access_token = var.access_token
}

# Data source for existing GKE cluster
data "google_container_cluster" "existing_cluster" {
  count    = var.use_existing_cluster ? 1 : 0
  name     = var.cluster_name
  location = var.zone
}

# Create GKE cluster (only if it doesn't exist)
module "gke_cluster" {
  count  = var.use_existing_cluster ? 0 : 1
  source = "../../modules/gke-cluster"

  project_id    = var.project_id
  cluster_name  = var.cluster_name
  zone          = var.zone
  region        = var.region
  environment   = var.environment
  
  # Staging-specific configuration
  min_nodes     = var.min_nodes
  max_nodes     = var.max_nodes
  machine_type  = var.machine_type
  preemptible   = var.preemptible
}

# Networking resources (future)
# Add VPC, subnets, firewall rules here when needed