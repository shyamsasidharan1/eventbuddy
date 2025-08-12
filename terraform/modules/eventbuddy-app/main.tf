# EventBuddy Application Module
# Deploys the EventBuddy API and optional in-cluster databases

# PostgreSQL deployment (staging only)
resource "kubernetes_deployment" "postgres" {
  count = var.deploy_in_cluster_db ? 1 : 0
  
  metadata {
    name      = "postgres-${var.environment}"
    namespace = var.namespace_name
    
    labels = {
      app         = "postgres"
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app         = "postgres"
        environment = var.environment
      }
    }

    template {
      metadata {
        labels = {
          app         = "postgres"
          environment = var.environment
        }
      }

      spec {
        container {
          image = "postgres:15"
          name  = "postgres"

          port {
            container_port = 5432
            name           = "postgres"
          }

          env {
            name  = "POSTGRES_DB"
            value = "eventbuddy"
          }
          env {
            name  = "POSTGRES_USER"
            value = "eventbuddy_user"
          }
          env {
            name  = "POSTGRES_PASSWORD"
            value = "eventbuddy_pass"
          }
          env {
            name  = "PGDATA"
            value = "/var/lib/postgresql/data/pgdata"
          }

          volume_mount {
            name       = "postgres-storage"
            mount_path = "/var/lib/postgresql/data"
          }
          
          volume_mount {
            name       = "postgres-init-scripts"
            mount_path = "/docker-entrypoint-initdb.d"
          }

          resources {
            requests = {
              memory = "128Mi"
              cpu    = "100m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "200m"
            }
          }

          liveness_probe {
            exec {
              command = ["pg_isready", "-U", "eventbuddy_user", "-d", "eventbuddy"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["pg_isready", "-U", "eventbuddy_user", "-d", "eventbuddy"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }

        volume {
          name = "postgres-storage"
          empty_dir {}
        }
        
        volume {
          name = "postgres-init-scripts"
          config_map {
            name = var.postgres_init_configmap_name
          }
        }
      }
    }
  }
}

# Redis deployment (staging only)
resource "kubernetes_deployment" "redis" {
  count = var.deploy_in_cluster_db ? 1 : 0
  
  metadata {
    name      = "redis-${var.environment}"
    namespace = var.namespace_name
    
    labels = {
      app         = "redis"
      environment = var.environment
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app         = "redis"
        environment = var.environment
      }
    }

    template {
      metadata {
        labels = {
          app         = "redis"
          environment = var.environment
        }
      }

      spec {
        container {
          image = "redis:7-alpine"
          name  = "redis"

          port {
            container_port = 6379
            name           = "redis"
          }

          command = ["redis-server", "--appendonly", "yes"]

          volume_mount {
            name       = "redis-storage"
            mount_path = "/data"
          }

          resources {
            requests = {
              memory = "64Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "128Mi"
              cpu    = "100m"
            }
          }

          liveness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          readiness_probe {
            exec {
              command = ["redis-cli", "ping"]
            }
            initial_delay_seconds = 5
            period_seconds        = 5
          }
        }

        volume {
          name = "redis-storage"
          empty_dir {}
        }
      }
    }
  }
}

# EventBuddy API deployment
resource "kubernetes_deployment" "eventbuddy_api" {
  metadata {
    name      = "eventbuddy-api-${var.environment}"
    namespace = var.namespace_name
    
    labels = {
      app         = "eventbuddy"
      component   = "api"
      environment = var.environment
    }
  }

  spec {
    replicas = var.api_replicas

    selector {
      match_labels = {
        app         = "eventbuddy"
        component   = "api"
        environment = var.environment
      }
    }

    template {
      metadata {
        labels = {
          app         = "eventbuddy"
          component   = "api"
          environment = var.environment
        }
      }

      spec {
        container {
          image             = var.api_image
          name              = "eventbuddy-api"
          image_pull_policy = "Always"

          port {
            container_port = 3001
            name           = "http"
          }

          env_from {
            config_map_ref {
              name = var.config_map_name
            }
          }

          env {
            name = "DATABASE_URL"
            value_from {
              secret_key_ref {
                name = var.secrets_name
                key  = "database-url"
              }
            }
          }
          env {
            name = "REDIS_URL"
            value_from {
              secret_key_ref {
                name = var.secrets_name
                key  = "redis-url"
              }
            }
          }
          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = var.secrets_name
                key  = "jwt-secret"
              }
            }
          }
          env {
            name = "SENDGRID_API_KEY"
            value_from {
              secret_key_ref {
                name = var.secrets_name
                key  = "sendgrid-api-key"
              }
            }
          }

          resources {
            requests = {
              memory = "64Mi"
              cpu    = "50m"
            }
            limits = {
              memory = "256Mi"
              cpu    = "200m"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/v1/health"
              port = 3001
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/v1/health"
              port = 3001
            }
            initial_delay_seconds = 5
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          startup_probe {
            http_get {
              path = "/api/v1/health"
              port = 3001
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 6
          }

          security_context {
            allow_privilege_escalation = false
            run_as_non_root           = true
            run_as_user               = 1001
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        security_context {
          fs_group = 1001
        }
      }
    }
  }
}

# Services
resource "kubernetes_service" "postgres" {
  count = var.deploy_in_cluster_db ? 1 : 0
  
  metadata {
    name      = "postgres"
    namespace = var.namespace_name
    
    labels = {
      app         = "postgres"
      environment = var.environment
    }
  }

  spec {
    selector = {
      app         = "postgres"
      environment = var.environment
    }

    port {
      name        = "postgres"
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "redis" {
  count = var.deploy_in_cluster_db ? 1 : 0
  
  metadata {
    name      = "redis"
    namespace = var.namespace_name
    
    labels = {
      app         = "redis"
      environment = var.environment
    }
  }

  spec {
    selector = {
      app         = "redis"
      environment = var.environment
    }

    port {
      name        = "redis"
      port        = 6379
      target_port = 6379
    }

    type = "ClusterIP"
  }
}

resource "kubernetes_service" "eventbuddy_api" {
  metadata {
    name      = "eventbuddy-api-service-${var.environment}"
    namespace = var.namespace_name
    
    labels = {
      app         = "eventbuddy"
      component   = "api"
      environment = var.environment
    }
  }

  spec {
    selector = {
      app         = "eventbuddy"
      component   = "api"
      environment = var.environment
    }

    port {
      name        = "http"
      port        = 80
      target_port = 3001
      protocol    = "TCP"
    }

    type = var.service_type
  }
}