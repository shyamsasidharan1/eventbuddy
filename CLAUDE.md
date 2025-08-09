# EventBuddy - Claude Code Project Context

## Project Overview
EventBuddy is a microservices-based event management application designed for deployment on Google Kubernetes Engine (GKE). This is Phase 1 - a production-ready foundation with a simple API service.

## Architecture
- **Platform**: Google Kubernetes Engine (GKE)
- **Language**: Node.js 18+
- **Framework**: Express.js
- **Container**: Docker with multi-stage builds
- **CI/CD**: GitHub Actions
- **Registry**: Google Container Registry (GCR) or Artifact Registry

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
- **Build**: `npm run docker:build`
- **Run**: `npm run docker:run`
- **Health**: Check `http://localhost:3000/health`

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

# Create GKE cluster (cost-optimized)
gcloud container clusters create eventbuddy-cluster \
    --zone=us-central1-a \
    --num-nodes=2 \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=3 \
    --machine-type=e2-micro \
    --disk-size=10GB \
    --enable-autorepair \
    --enable-autoupgrade \
    --preemptible
```

### 2. Create Service Account for GitHub Actions
```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --description="Service account for GitHub Actions" \
    --display-name="GitHub Actions"

# Add required roles
gcloud projects add-iam-policy-binding 571710042020 \
    --member="serviceAccount:github-actions@571710042020.iam.gserviceaccount.com" \
    --role="roles/container.developer"

gcloud projects add-iam-policy-binding 571710042020 \
    --member="serviceAccount:github-actions@571710042020.iam.gserviceaccount.com" \
    --role="roles/storage.admin"

# Create and download key
gcloud iam service-accounts keys create ~/github-actions-key.json \
    --iam-account=github-actions@571710042020.iam.gserviceaccount.com
```

### 3. Configure GitHub Secrets
Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- **GCP_PROJECT_ID**: `571710042020`
- **GCP_SA_KEY**: Contents of `~/github-actions-key.json` file
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

## Development Notes for Claude
- Always run `npm run lint` after code changes
- Use structured logging with Winston
- Follow security best practices
- Test locally with Docker before K8s deployment
- Update this document when adding new features or changing architecture