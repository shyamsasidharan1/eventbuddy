# EventBuddy Production Infrastructure
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
  #   prefix = "production"
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

# Get default network for managed databases
data "google_compute_network" "default" {
  name = "default"
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
  
  # Production-specific configuration
  min_nodes     = var.min_nodes
  max_nodes     = var.max_nodes
  machine_type  = var.machine_type
  preemptible   = false  # No preemptible nodes in production
}

# Cloud SQL PostgreSQL instance (production)
resource "google_sql_database_instance" "eventbuddy_postgres" {
  count = var.deploy_managed_db ? 1 : 0
  
  name             = "eventbuddy-postgres-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier                        = var.postgres_tier
    availability_type          = "REGIONAL"  # High availability
    
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"
      location                       = var.region
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                              = data.google_compute_network.default.id
      enable_private_path_for_google_cloud_services = true
    }
  }

  deletion_protection = true  # Prevent accidental deletion
}

# Cloud SQL database
resource "google_sql_database" "eventbuddy_db" {
  count = var.deploy_managed_db ? 1 : 0
  
  name     = "eventbuddy"
  instance = google_sql_database_instance.eventbuddy_postgres[0].name
}

# Cloud SQL user
resource "google_sql_user" "eventbuddy_user" {
  count = var.deploy_managed_db ? 1 : 0
  
  name     = "eventbuddy_user"
  instance = google_sql_database_instance.eventbuddy_postgres[0].name
  password = var.postgres_password
}

# Memorystore Redis instance (production)
resource "google_redis_instance" "eventbuddy_redis" {
  count = var.deploy_managed_db ? 1 : 0
  
  name           = "eventbuddy-redis-${var.environment}"
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region
  
  auth_enabled   = true
  redis_version  = "REDIS_7_0"
  
  authorized_network = data.google_compute_network.default.id
}

# Networking resources (future)
# Add VPC, subnets, firewall rules here when needed