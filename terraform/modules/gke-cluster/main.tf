# GKE Cluster Module
# Replicates your current eventbuddy-cluster configuration

resource "google_container_cluster" "eventbuddy_cluster" {
  name     = var.cluster_name
  location = var.zone
  
  # Remove default node pool
  remove_default_node_pool = true
  initial_node_count       = 1

  # Network configuration
  network    = "default"
  subnetwork = "default"

  # Cluster configuration
  min_master_version = "1.33"
  
  # Enable necessary APIs
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = true
    }
  }

  # Workload Identity for secure pod authentication
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = "2023-01-01T09:00:00Z"
      end_time   = "2023-01-01T17:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }

  # Logging and monitoring
  logging_service    = "logging.googleapis.com/kubernetes"
  monitoring_service = "monitoring.googleapis.com/kubernetes"
}

# Node Pool - matches your current e2-small setup
resource "google_container_node_pool" "eventbuddy_nodes" {
  name       = "${var.cluster_name}-${var.node_pool_name}"
  location   = var.zone
  cluster    = google_container_cluster.eventbuddy_cluster.name
  
  # Node count and autoscaling
  initial_node_count = var.min_nodes
  
  autoscaling {
    min_node_count = var.min_nodes
    max_node_count = var.max_nodes
  }

  # Node configuration
  node_config {
    preemptible  = var.preemptible
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = "pd-standard"

    # Service account
    service_account = google_service_account.eventbuddy_cluster_sa.email
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Security
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Labels and tags
    labels = {
      environment = var.environment
      project     = "eventbuddy"
    }

    tags = ["eventbuddy-cluster", var.environment]
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  # Lifecycle management
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Service Account for cluster nodes
resource "google_service_account" "eventbuddy_cluster_sa" {
  account_id   = "${var.cluster_name}-sa"
  display_name = "EventBuddy Cluster Service Account"
  description  = "Service account for EventBuddy GKE cluster nodes"
}

# IAM bindings for service account
resource "google_project_iam_member" "eventbuddy_cluster_sa_bindings" {
  for_each = toset([
    "roles/container.nodeServiceAccount",
    "roles/artifactregistry.reader",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer"
  ])
  
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.eventbuddy_cluster_sa.email}"
}