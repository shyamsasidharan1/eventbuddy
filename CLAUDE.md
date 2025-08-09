# EventBuddy - Claude Code Project Context

## Project Overview
EventBuddy is a microservices-based event management application designed for deployment on Google Kubernetes Engine (GKE). This is Phase 1 - a production-ready foundation with a simple API service.

## Architecture
- **Platform**: Google Kubernetes Engine (GKE)
- **Language**: Node.js 18+
- **Framework**: Express.js
- **Container**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions
- **Registry**: Google Artifact Registry (us-central1-docker.pkg.dev)

## Project Structure
```
eventbuddy/
├── src/                    # Application source code
│   └── app.js             # Main Express application
├── k8s/                   # Kubernetes manifests
│   ├── namespace.yaml     # EventBuddy namespace
│   ├── configmap.yaml     # Configuration
│   ├── deployment.yaml    # API deployment
│   └── service.yaml       # Service definition
├── terraform/             # Infrastructure as Code (future)
├── .github/workflows/     # CI/CD pipelines
│   └── ci-cd.yml         # Main pipeline
├── docs/                  # Documentation
├── logs/                  # Application logs
├── Dockerfile            # Container definition
└── package.json          # Node.js dependencies
```

## Development Guidelines

### Local Development
1. **Prerequisites**: Node.js 18+, Docker, kubectl, Google Cloud CLI (gcloud)
2. **Setup**: 
   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```
3. **Testing**: `npm test`
4. **Linting**: `npm run lint`

### Docker Operations
- **Build for local**: `npm run docker:build`
- **Build for GKE (AMD64)**: `docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/hypnotic-surfer-468513-a0/eventbuddy-repo/eventbuddy:latest .`
- **Push to Artifact Registry**: `docker push us-central1-docker.pkg.dev/hypnotic-surfer-468513-a0/eventbuddy-repo/eventbuddy:latest`
- **Run locally**: `npm run docker:run`
- **Health check**: `http://localhost:3000/health`

**Important**: GKE nodes use AMD64 architecture. If building on Apple Silicon (ARM64), use `--platform linux/amd64` flag.

### Kubernetes Deployment
```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n eventbuddy
kubectl logs -f deployment/eventbuddy-api -n eventbuddy
```

### API Endpoints
- `GET /` - Welcome message with service info
- `GET /health` - Health check with uptime and status
- `GET /ready` - Readiness probe for K8s

### Environment Configuration
- **NODE_ENV**: Environment (development/staging/production)
- **PORT**: Server port (default: 3000)
- **LOG_LEVEL**: Winston log level (default: info)

## Production Considerations

### Security
- Non-root container user (uid: 1001)
- Security contexts in K8s
- Helmet.js for HTTP security headers
- Container vulnerability scanning with Trivy

### Observability
- Structured logging with Winston
- Health and readiness probes
- Resource limits and requests
- Graceful shutdown handling

### Scaling
- Horizontal Pod Autoscaling ready
- Resource-based scaling metrics
- Multi-architecture builds (AMD64/ARM64)

## CI/CD Pipeline

### Triggers
- **Push to main**: Deploy to production
- **Push to develop**: Deploy to staging
- **Pull requests**: Run tests and build

### Stages
1. **Test**: Lint, unit tests
2. **Build**: Docker image, multi-arch
3. **Security**: Vulnerability scanning
4. **Deploy**: Rolling updates to GKE

### Required Secrets
- `GCP_PROJECT_ID` (set to: `571710042020`)
- `GCP_SA_KEY` (Service Account JSON)
- `GKE_CLUSTER_NAME` (your cluster name)
- `GKE_ZONE` (e.g., `us-central1-a`) or `GKE_REGION` (e.g., `us-central1`)

## Next Phase Planning

### Microservices Architecture
- User service
- Event service  
- Notification service
- Payment service (future)

### Database Integration
- PostgreSQL for relational data
- Redis for caching and sessions
- Database migrations

### Advanced Features
- API Gateway/Ingress
- Service mesh (Istio)
- Monitoring (Prometheus/Grafana)
- Distributed tracing
- Message queues (Cloud Pub/Sub)

## GCP Setup Instructions

### 1. Create GKE Cluster
```bash
# Set project
gcloud config set project 571710042020

# Enable required APIs
gcloud services enable container.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Create GKE cluster (production-tested configuration)
gcloud container clusters create eventbuddy-cluster \
    --zone=us-central1-a \
    --num-nodes=2 \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=3 \
    --machine-type=e2-small \
    --disk-size=15GB \
    --enable-autorepair \
    --enable-autoupgrade \
    --preemptible

# Note: e2-micro nodes (1GB RAM) are insufficient for GKE system pods + applications
# e2-small (2GB RAM) is the minimum for reliable operation
```

### 2. Create Service Account for GitHub Actions
```bash
# Create service account
gcloud iam service-accounts create docker-pusher \
    --description="Service account for Docker image pushing and GitHub Actions" \
    --display-name="Docker Pusher"

# Add required roles  
gcloud projects add-iam-policy-binding hypnotic-surfer-468513-a0 \
    --member="serviceAccount:docker-pusher@hypnotic-surfer-468513-a0.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding hypnotic-surfer-468513-a0 \
    --member="serviceAccount:docker-pusher@hypnotic-surfer-468513-a0.iam.gserviceaccount.com" \
    --role="roles/container.developer"

# Create and download key
gcloud iam service-accounts keys create ~/docker-key.json \
    --iam-account=docker-pusher@hypnotic-surfer-468513-a0.iam.gserviceaccount.com
```

### 3. Configure GitHub Secrets
Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- **GCP_PROJECT_ID**: `hypnotic-surfer-468513-a0`
- **GCP_SA_KEY**: Contents of `~/docker-key.json` file
- **GKE_CLUSTER_NAME**: `eventbuddy-cluster`
- **GKE_ZONE**: `us-central1-a`

## Troubleshooting

### Common Issues
1. **Container fails to start**: Check logs and resource limits
2. **Health check fails**: Verify endpoints and network policies
3. **Deploy fails**: Check GCP credentials and cluster access
4. **Image pull fails**: Verify GCR/Artifact Registry permissions

### Debugging Commands
```bash
# Check pod status
kubectl describe pod -l app=eventbuddy -n eventbuddy

# View logs
kubectl logs -f deployment/eventbuddy-api -n eventbuddy

# Port forward for local testing
kubectl port-forward svc/eventbuddy-api-service 8080:80 -n eventbuddy
```

## Deployment Lessons Learned

### Memory and Node Sizing
- **Issue**: e2-micro nodes (1GB RAM) caused "Insufficient memory" errors during pod scheduling
- **Solution**: Upgraded to e2-small nodes (2GB RAM) - minimum viable for GKE system pods + application pods
- **Key Insight**: GKE system pods (kube-proxy, fluentd, etc.) consume ~70% of node resources, leaving insufficient space for application workloads on micro instances

### Platform Architecture Compatibility  
- **Issue**: ARM64 Docker images failed on GKE with "no match for platform in manifest" error
- **Solution**: Use `--platform linux/amd64` flag when building on Apple Silicon for GKE deployment
- **Commands**: 
  ```bash
  # For GKE (AMD64 required)
  docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/hypnotic-surfer-468513-a0/eventbuddy-repo/eventbuddy:latest .
  ```

### Authentication and Registry
- **Issue**: Google Container Registry authentication failures and deprecated service
- **Solution**: Migrated to Google Artifact Registry with service account JSON key authentication
- **Best Practice**: Use dedicated service accounts with minimal required permissions for CI/CD

### Resource Optimization
- Container resource limits tuned for e2-small nodes:
  - **Requests**: 64Mi memory, 50m CPU  
  - **Limits**: 128Mi memory, 100m CPU
- **Rationale**: Allows 3 replicas per node with room for system pods

## Development Notes for Claude
- Always run `npm run lint` after code changes
- Use structured logging with Winston
- Follow security best practices
- Test locally with Docker before K8s deployment
- Update this document when adding new features or changing architecture
- Use production-tested configurations documented in this file