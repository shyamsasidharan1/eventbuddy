# EventBuddy Namespace Module
# Creates namespace and core Kubernetes resources

# Create namespace
resource "kubernetes_namespace" "eventbuddy" {
  metadata {
    name = "${var.namespace_prefix}${var.environment == "production" ? "" : "-${var.environment}"}"
    
    labels = {
      name        = "eventbuddy"
      environment = var.environment
      app         = "eventbuddy"
    }
  }
}

# ConfigMap for application configuration
resource "kubernetes_config_map" "eventbuddy_config" {
  metadata {
    name      = "eventbuddy-${var.environment}-config"
    namespace = kubernetes_namespace.eventbuddy.metadata[0].name
    
    labels = {
      app         = "eventbuddy"
      environment = var.environment
    }
  }

  data = {
    NODE_ENV                = var.environment
    PORT                    = "3001"
    LOG_LEVEL              = var.log_level
    BCRYPT_ROUNDS          = var.bcrypt_rounds
    RATE_LIMIT_WINDOW_MS   = var.rate_limit_window_ms
    RATE_LIMIT_MAX         = var.rate_limit_max
    GCP_PROJECT_ID         = var.project_id
  }
}

# Secrets for sensitive configuration
resource "kubernetes_secret" "eventbuddy_secrets" {
  metadata {
    name      = "eventbuddy-${var.environment}-secrets"
    namespace = kubernetes_namespace.eventbuddy.metadata[0].name
    
    labels = {
      app         = "eventbuddy"
      environment = var.environment
    }
  }

  type = "Opaque"

  data = {
    database-url     = var.database_url
    redis-url        = var.redis_url
    jwt-secret       = var.jwt_secret
    sendgrid-api-key = var.sendgrid_api_key
  }
}

# ConfigMap for database initialization scripts
resource "kubernetes_config_map" "postgres_init_scripts" {
  count = var.deploy_in_cluster_db ? 1 : 0
  
  metadata {
    name      = "postgres-init-scripts"
    namespace = kubernetes_namespace.eventbuddy.metadata[0].name
    
    labels = {
      app         = "eventbuddy"
      environment = var.environment
      component   = "database"
    }
  }

  data = {
    "init-db.sql" = file("${path.root}/../../../scripts/init-db.sql")
  }
}