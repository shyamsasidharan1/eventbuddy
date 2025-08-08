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
- `GCP_PROJECT_ID`
- `GCP_SA_KEY` (Service Account JSON)
- `GKE_CLUSTER_NAME`
- `GKE_ZONE` or `GKE_REGION`

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