# EventBuddy Infrastructure as Code

This directory contains Terraform configuration for managing EventBuddy infrastructure on Google Cloud Platform (GCP).

## 🏗️ Architecture

```
terraform/
├── modules/                    # Reusable Terraform modules
│   ├── gke-cluster/           # GKE cluster with node pools
│   ├── eventbuddy-namespace/  # Kubernetes namespace + secrets
│   └── eventbuddy-app/        # Application deployments + services
├── environments/              # Environment-specific configurations
│   ├── staging/              # Cost-optimized with in-cluster DBs
│   └── production/           # High-availability with managed DBs
└── scripts/                  # Management scripts
    ├── deploy-staging.sh     # Deploy staging environment
    ├── destroy-staging.sh    # Destroy staging (save costs)
    ├── deploy-production.sh  # Deploy production environment
    └── switch-environment.sh # Switch kubectl context
```

## 🚀 Quick Start

### Prerequisites

1. **Install required tools:**
   ```bash
   # Terraform
   brew install terraform
   
   # Google Cloud CLI
   brew install google-cloud-sdk
   
   # kubectl
   brew install kubectl
   ```

2. **Authenticate with GCP:**
   ```bash
   gcloud auth login
   gcloud config set project hypnotic-surfer-468513-a0
   ```

3. **Set up GitHub Secrets (for CI/CD integration):**
   - `GCP_SA_KEY` - Service account JSON key
   - `GCP_PROJECT_ID` - Your GCP project ID
   - `GKE_CLUSTER_NAME` - Cluster name (eventbuddy-cluster)
   - `GKE_ZONE` - Zone (us-central1-a)

### Deploy Staging Environment

```bash
# Deploy staging (uses existing cluster + in-cluster databases)
./terraform/scripts/deploy-staging.sh

# Access the API
kubectl port-forward service/eventbuddy-api-service-staging 8080:80 -n eventbuddy-staging
curl http://localhost:8080/api/v1/health

# Destroy staging to save costs (~$48-78/month savings)
./terraform/scripts/destroy-staging.sh
```

### Deploy Production Environment

```bash
# Set required production secrets
export JWT_SECRET="$(openssl rand -base64 32)"
export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
export SENDGRID_API_KEY="your-sendgrid-key"  # Optional

# Deploy production (creates managed databases)
./terraform/scripts/deploy-production.sh

# Access via Load Balancer IP (shown in output)
curl http://LOAD_BALANCER_IP/api/v1/health
```

## 🌍 Environment Differences

| Feature | Staging | Production |
|---------|---------|------------|
| **Cluster** | Uses existing cluster | Can create dedicated cluster |
| **Database** | In-cluster PostgreSQL/Redis | Cloud SQL + Memorystore |
| **Replicas** | 2 API pods | 3 API pods |
| **Service** | ClusterIP (internal) | LoadBalancer (external) |
| **Cost** | ~$25-50/month | ~$100-183/month |
| **Data** | Ephemeral (lost on destroy) | Persistent with backups |
| **Availability** | Single zone | Regional HA |

## 💰 Cost Management

### Staging Cost Optimization
- **Deploy when needed:** Use staging only during development
- **Destroy regularly:** Save ~$48-78/month when not in use
- **In-cluster databases:** Avoid managed service costs

### Production Cost Monitoring
- **Cloud SQL:** ~$7-15/month (db-f1-micro)
- **Memorystore:** ~$25/month (1GB Redis)
- **Load Balancer:** ~$18/month
- **GKE Nodes:** ~$50-125/month (2-5 nodes)
- **Total:** ~$100-183/month

## 📋 Management Scripts

### Deploy Staging
```bash
./terraform/scripts/deploy-staging.sh
```
- Creates staging namespace with in-cluster databases
- Deploys 2 API replicas
- Uses existing GKE cluster
- Cost: ~$25-50/month

### Destroy Staging
```bash
./terraform/scripts/destroy-staging.sh
```
- Safely destroys all staging resources
- Saves ~$48-78/month in costs
- Preserves application code and CI/CD
- Can be recreated anytime

### Deploy Production
```bash
# Required environment variables
export JWT_SECRET="strong-unique-secret"
export POSTGRES_PASSWORD="strong-db-password"

./terraform/scripts/deploy-production.sh
```
- Creates managed Cloud SQL and Memorystore
- Deploys 3 API replicas with HA
- Creates external Load Balancer
- Enables deletion protection
- Cost: ~$100-183/month

### Switch Environments
```bash
./terraform/scripts/switch-environment.sh
```
- Interactive environment switcher
- Shows environment status
- Configures kubectl context
- Provides connection commands

## 🔒 Security Best Practices

### Staging
- Uses basic secrets for development
- In-cluster databases (isolated)
- No external access (port-forward only)
- Lower security requirements

### Production
- Strong JWT secrets required
- Managed databases with encryption
- External Load Balancer with firewall
- Deletion protection on critical resources
- VPC-native networking

## 🔄 CI/CD Integration

The Terraform configuration works with your existing GitHub Actions pipeline:

### Staging Workflow
1. **Manual deployment:** `./deploy-staging.sh` when needed
2. **CI/CD continues:** Deploys applications to existing cluster
3. **Manual destruction:** `./destroy-staging.sh` to save costs

### Production Workflow
1. **One-time setup:** `./deploy-production.sh` creates infrastructure
2. **CI/CD deployment:** Continues to deploy applications automatically
3. **Always available:** Production infrastructure stays up 24/7

## 🛠️ Customization

### Staging Environment Variables
```bash
# Override defaults in terraform/environments/staging/variables.tf
export TF_VAR_api_replicas=1          # Reduce replicas
export TF_VAR_machine_type="e2-micro" # Smaller nodes
export TF_VAR_preemptible=true        # Use preemptible nodes
```

### Production Environment Variables
```bash
# Override defaults in terraform/environments/production/variables.tf
export TF_VAR_postgres_tier="db-n1-standard-1"  # Larger database
export TF_VAR_redis_memory_size_gb=2             # More Redis memory
export TF_VAR_api_replicas=5                     # More replicas
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication errors:**
   ```bash
   gcloud auth login
   gcloud config set project hypnotic-surfer-468513-a0
   ```

2. **Cluster not found:**
   ```bash
   gcloud container clusters get-credentials eventbuddy-cluster --zone us-central1-a
   ```

3. **Terraform state issues:**
   ```bash
   cd terraform/environments/staging
   terraform init
   ```

### Useful Commands

```bash
# Check cluster status
kubectl get nodes
kubectl get namespaces

# View all resources
kubectl get all -n eventbuddy-staging

# Check resource usage
kubectl top nodes
kubectl top pods -n eventbuddy-staging

# View logs
kubectl logs -f deployment/eventbuddy-api-staging -n eventbuddy-staging

# Port forward to API
kubectl port-forward service/eventbuddy-api-service-staging 8080:80 -n eventbuddy-staging
```

## 🎯 Next Steps

1. **Test staging deployment:**
   ```bash
   ./terraform/scripts/deploy-staging.sh
   ```

2. **Set up production secrets:**
   ```bash
   export JWT_SECRET="$(openssl rand -base64 32)"
   export POSTGRES_PASSWORD="$(openssl rand -base64 24)"
   ```

3. **Deploy production when ready:**
   ```bash
   ./terraform/scripts/deploy-production.sh
   ```

4. **Integrate with CI/CD:**
   - Infrastructure deployment remains manual
   - Application deployment continues via GitHub Actions

## 📚 Additional Resources

- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GKE Terraform Examples](https://github.com/terraform-google-modules/terraform-google-kubernetes-engine)
- [EventBuddy CI/CD Pipeline](../.github/workflows/ci-cd.yml)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)