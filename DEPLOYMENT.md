# EventBuddy CI/CD Deployment Guide

## 🚀 CI/CD Pipeline Overview

EventBuddy now has a complete production-ready CI/CD pipeline with:
- **Multi-stage Docker builds** with security optimizations
- **Automated testing** with database and Redis services
- **Security scanning** with Trivy vulnerability detection
- **Database migrations** automated in deployment process
- **Environment-specific configurations** for staging and production
- **Health checks** and monitoring built-in

## 🛠️ Prerequisites

### GitHub Secrets Required
Set these secrets in your GitHub repository settings:

```bash
# Google Cloud Platform
GCP_PROJECT_ID="your-gcp-project-id"
GCP_SA_KEY="<service-account-json-key>"

# Kubernetes Cluster
GKE_CLUSTER_NAME="your-cluster-name" 
GKE_ZONE="us-central1-a"

# Optional: Code Coverage
CODECOV_TOKEN="your-codecov-token"
```

### Service Account Permissions
Your GCP service account needs these roles:
- `Kubernetes Engine Developer`
- `Artifact Registry Writer` 
- `Cloud SQL Admin` (if using Cloud SQL)
- `Secret Manager Secret Accessor`

## 🌟 Deployment Environments

### Local Development
```bash
# Database services only
docker-compose up -d postgres redis

# Full stack (API + Database + Nginx)
docker-compose --profile full-stack up -d

# With database management tools
docker-compose --profile tools up -d pgadmin
```

### Staging Environment
- **Trigger**: Push to `develop` branch
- **Image Tag**: `develop-<commit-sha>`
- **Config**: `eventbuddy-staging-config`
- **Replicas**: 2 pods
- **Resources**: Higher limits for testing

### Production Environment
- **Trigger**: Push to `main` branch  
- **Image Tag**: `latest`
- **Config**: `eventbuddy-config`
- **Replicas**: 3 pods
- **Resources**: Production-optimized

## ⚡ Pipeline Stages

### 1. Test & Quality (Every PR/Push)
- ✅ Node.js 18 with npm cache
- ✅ PostgreSQL 15 + Redis 7 services
- ✅ Prisma client generation
- ✅ ESLint code quality checks  
- ✅ Jest test suite (76 tests)
- ✅ Code coverage reporting

### 2. Build Docker Image 
- ✅ Multi-stage optimized build
- ✅ Security: Non-root user, minimal base
- ✅ Platform: `linux/amd64` for GKE
- ✅ Registry: Google Artifact Registry
- ✅ Caching: GitHub Actions cache

### 3. Security Scanning
- ✅ Trivy vulnerability scanning  
- ✅ Image security analysis
- ✅ Continue on non-critical issues

### 4. Database Migration
- ✅ Prisma migrate deploy
- ✅ Kubernetes Job execution
- ✅ Environment-specific credentials

### 5. Deployment
- ✅ Rolling updates with zero downtime
- ✅ Health check validation
- ✅ Automatic rollback on failure

## 🔧 Configuration Management

### Environment Variables
```bash
# Application
NODE_ENV=production|staging|development
PORT=3001
LOG_LEVEL=info|debug

# Security  
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX=100           # requests per window
JWT_EXPIRES_IN=7d

# Email (SendGrid)
FROM_EMAIL=noreply@eventbuddy.app
FROM_NAME=EventBuddy
```

### Kubernetes Secrets
```bash
# Create secrets (replace with actual values)
kubectl create secret generic eventbuddy-secrets \
  --from-literal=database-url="postgresql://user:pass@host:5432/db" \
  --from-literal=redis-url="redis://host:6379" \
  --from-literal=jwt-secret="your-strong-secret" \
  --from-literal=sendgrid-api-key="your-api-key" \
  --namespace=eventbuddy
```

## 🏗️ Kubernetes Architecture

### Production Deployment
```yaml
# 3 API pods with resource limits
resources:
  requests: { memory: "64Mi", cpu: "50m" }  
  limits: { memory: "128Mi", cpu: "100m" }

# Health checks at /health endpoint
# Startup + Liveness + Readiness probes
# Security: Non-root user, dropped capabilities
```

### Network & Security
```yaml
# ClusterIP service on port 80 → 3001
# Security headers via Helmet middleware
# Rate limiting: 100 requests/15min
# CORS configured for production origins
```

## 📊 Monitoring & Health Checks

### Built-in Endpoints
- `GET /health` - Application health status
- `GET /ready` - Kubernetes readiness probe
- `GET /` - API information and version

### Kubernetes Probes
```yaml
startupProbe:   # Initial container startup (30s timeout)  
livenessProbe:  # Container health (restart if failing)
readinessProbe: # Traffic routing (remove from service if failing)
```

## 🔒 Security Features

### Application Security
- ✅ **Helmet**: Security headers (CSP, HSTS, etc.)
- ✅ **CORS**: Production origin restrictions
- ✅ **Rate Limiting**: 100 requests per 15 minutes
- ✅ **Input Validation**: Class-validator with whitelisting
- ✅ **JWT Authentication**: Secure token-based auth

### Container Security  
- ✅ **Non-root user**: UID 1001, capability dropping
- ✅ **Read-only filesystem**: Temporary directories only
- ✅ **Security scanning**: Trivy vulnerability detection
- ✅ **Minimal base**: Alpine Linux with essential packages

### Kubernetes Security
- ✅ **Network policies**: Pod-to-pod communication control
- ✅ **RBAC**: Role-based access control
- ✅ **Secrets management**: External secret store integration
- ✅ **Resource limits**: Memory and CPU constraints

## 🚀 Deployment Commands

### Initial Setup
```bash
# Create namespace and apply configurations
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# Create secrets from template (update values first!)
kubectl apply -f k8s/secrets.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### Staging Deployment  
```bash
# Use staging-specific configurations
kubectl apply -f k8s/configmap.yaml  # Contains both prod and staging
kubectl apply -f k8s/deployment-staging.yaml
```

### Manual Migration
```bash
# Run database migration manually
kubectl create job eventbuddy-migrate-$(date +%s) \
  --from=cronjob/eventbuddy-migrate \
  --namespace=eventbuddy
```

## 📋 Deployment Checklist

### Pre-deployment
- [ ] Update `GCP_PROJECT_ID` in workflow if needed
- [ ] Configure GitHub secrets
- [ ] Review environment configurations  
- [ ] Test pipeline on feature branch

### Post-deployment  
- [ ] Verify health check endpoints respond
- [ ] Check application logs for errors
- [ ] Test API endpoints functionality
- [ ] Validate database connections
- [ ] Monitor resource usage

### Rollback Process
```bash
# View deployment history
kubectl rollout history deployment/eventbuddy-api -n eventbuddy

# Rollback to previous version  
kubectl rollout undo deployment/eventbuddy-api -n eventbuddy

# Rollback to specific revision
kubectl rollout undo deployment/eventbuddy-api --to-revision=2 -n eventbuddy
```

## 🐞 Troubleshooting

### Common Issues

**Pipeline Failures:**
```bash
# Check GitHub Actions logs
# Verify GCP service account permissions
# Ensure Kubernetes cluster access

# Test locally:
docker build -t eventbuddy-test .
docker run --rm eventbuddy-test npm test
```

**Deployment Issues:**
```bash
# Check pod status
kubectl get pods -n eventbuddy

# View pod logs  
kubectl logs -f deployment/eventbuddy-api -n eventbuddy

# Describe deployment for events
kubectl describe deployment eventbuddy-api -n eventbuddy
```

**Database Connection:**
```bash
# Test database connectivity
kubectl exec -it deployment/eventbuddy-api -n eventbuddy -- \
  npx prisma db push --preview-feature

# Check secrets
kubectl get secret eventbuddy-secrets -o yaml -n eventbuddy
```

## 📈 Performance Optimization

### Resource Tuning
```yaml
# Start with minimal resources, scale based on metrics
resources:
  requests: { memory: "64Mi", cpu: "50m" }
  limits: { memory: "256Mi", cpu: "200m" }

# Enable horizontal pod autoscaling
kubectl autoscale deployment eventbuddy-api \
  --cpu-percent=70 --min=2 --max=10 -n eventbuddy
```

### Database Optimization
- Use connection pooling
- Enable query optimization
- Monitor slow queries
- Configure read replicas for reports

## 🔄 Maintenance

### Regular Tasks
- **Security**: Update base images monthly
- **Dependencies**: Keep Node.js and packages current  
- **Monitoring**: Review error rates and performance
- **Backup**: Ensure database backup strategy
- **Documentation**: Keep deployment docs current

### Automated Updates
The pipeline automatically:
- Tests all changes before deployment
- Scans for security vulnerabilities  
- Runs database migrations
- Validates health checks before traffic routing
- Enables easy rollback if issues occur

---

## 🎯 Next Steps

Your EventBuddy application now has enterprise-grade CI/CD infrastructure! 

**Ready for:**
- ✅ Production deployments with zero downtime
- ✅ Automated security scanning and compliance  
- ✅ Database migrations and rollback capabilities
- ✅ Horizontal scaling based on traffic
- ✅ Frontend integration when ready

**Consider adding:**
- [ ] Centralized logging (ELK/Fluentd)
- [ ] Metrics collection (Prometheus/Grafana)  
- [ ] Advanced security scanning (SAST/DAST)
- [ ] Multi-region deployment
- [ ] Blue-green deployment strategy