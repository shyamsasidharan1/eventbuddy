# EventBuddy Namespace Module Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
}

variable "namespace_prefix" {
  description = "Prefix for namespace name"
  type        = string
  default     = "eventbuddy"
}

# Application Configuration
variable "log_level" {
  description = "Winston log level"
  type        = string
  default     = "info"
}

variable "bcrypt_rounds" {
  description = "Password hashing rounds"
  type        = string
  default     = "12"
}

variable "rate_limit_window_ms" {
  description = "Rate limiting window in milliseconds"
  type        = string
  default     = "900000"  # 15 minutes
}

variable "rate_limit_max" {
  description = "Maximum requests per window"
  type        = string
  default     = "100"
}

# Sensitive Configuration (should be provided via environment variables)
variable "database_url" {
  description = "PostgreSQL database connection URL"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "sendgrid_api_key" {
  description = "SendGrid API key for email notifications"
  type        = string
  sensitive   = true
  default     = ""
}

# Database deployment option
variable "deploy_in_cluster_db" {
  description = "Deploy PostgreSQL and Redis inside the cluster (staging only)"
  type        = bool
  default     = false
}