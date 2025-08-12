#!/bin/bash
# EventBuddy Production Infrastructure Deployment (Simplified)
# Creates/manages infrastructure only (GKE cluster + managed databases)
# Application deployments handled by CI/CD pipeline

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="${SCRIPT_DIR}/../environments/production"
PROJECT_ID="${GCP_PROJECT_ID:-hypnotic-surfer-468513-a0}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-eventbuddy-cluster}"
ZONE="${GKE_ZONE:-us-central1-a}"

echo -e "${BLUE}🏢 EventBuddy Production Infrastructure Deployment${NC}"
echo "====================================================="
echo -e "${YELLOW}ℹ️  This script manages ONLY infrastructure (GKE + databases)${NC}"
echo -e "${YELLOW}ℹ️  Application deployments are handled by CI/CD pipeline${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed${NC}"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud CLI is not installed${NC}"
    exit 1
fi

# Production safety checks
echo -e "${YELLOW}🔒 Production safety checks...${NC}"

# Check for required production secrets
if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo -e "${RED}❌ POSTGRES_PASSWORD environment variable is required for production${NC}"
    echo -e "${BLUE}💡 Set a strong database password:${NC}"
    echo -e "   export POSTGRES_PASSWORD=\"$(openssl rand -base64 24)\""
    exit 1
fi

echo -e "${GREEN}✅ Required database password provided${NC}"

# Check authentication
echo -e "${YELLOW}🔐 Checking GCP authentication...${NC}"

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${GCP_SA_KEY:-}" ]; then
    echo -e "${YELLOW}⚠️  No GCP service account credentials found${NC}"
    echo -e "${BLUE}ℹ️  Using gcloud default credentials${NC}"
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        echo -e "${RED}❌ No active gcloud authentication found${NC}"
        echo -e "${BLUE}💡 Run: gcloud auth login${NC}"
        exit 1
    fi
    
    # Use access token from current gcloud session
    echo -e "${YELLOW}🔐 Using access token from current gcloud session...${NC}"
    export TF_VAR_access_token=$(gcloud auth print-access-token)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Access token obtained successfully${NC}"
    else
        echo -e "${RED}❌ Failed to get access token${NC}"
        exit 1
    fi
else
    if [ -n "${GCP_SA_KEY:-}" ]; then
        echo -e "${GREEN}✅ Using GCP_SA_KEY for authentication${NC}"
        export GOOGLE_CREDENTIALS="${GCP_SA_KEY}"
    elif [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
        echo -e "${GREEN}✅ Using GOOGLE_APPLICATION_CREDENTIALS for authentication${NC}"
    fi
fi

# Set project
if [ -n "${PROJECT_ID}" ]; then
    gcloud config set project "${PROJECT_ID}"
    export GOOGLE_PROJECT="${PROJECT_ID}"
fi

# Check if cluster exists
echo -e "${YELLOW}🔍 Checking existing infrastructure...${NC}"
if gcloud container clusters describe "${CLUSTER_NAME}" --zone="${ZONE}" &>/dev/null; then
    echo -e "${GREEN}✅ Found existing GKE cluster: ${CLUSTER_NAME}${NC}"
    USE_EXISTING_CLUSTER=true
else
    echo -e "${YELLOW}⚠️  GKE cluster not found - will create production cluster${NC}"
    USE_EXISTING_CLUSTER=false
fi

# Change to Terraform directory
cd "${TERRAFORM_DIR}"
echo -e "${YELLOW}📂 Working directory: ${TERRAFORM_DIR}${NC}"

# Initialize Terraform
echo -e "${YELLOW}🏗️  Initializing Terraform...${NC}"
terraform init

# Set Terraform variables
export TF_VAR_postgres_password="${POSTGRES_PASSWORD}"

# Plan deployment
echo -e "${YELLOW}📋 Planning production infrastructure...${NC}"
terraform plan

# Show cost estimation
echo ""
echo -e "${BLUE}💰 Estimated Monthly Costs:${NC}"
echo -e "  - Cloud SQL PostgreSQL (db-f1-micro): ${YELLOW}~$7-15/month${NC}"
echo -e "  - Memorystore Redis (1GB): ${YELLOW}~$25/month${NC}"
echo -e "  - GKE nodes (2-5 × e2-standard-2): ${YELLOW}~$50-125/month${NC}"
echo -e "  ${GREEN}Total estimated: $82-165/month${NC}"

# Show what will be created
echo ""
echo -e "${BLUE}🏗️  Production Infrastructure Plan:${NC}"
if [ "${USE_EXISTING_CLUSTER}" = "false" ]; then
    echo -e "  - Create production GKE cluster (e2-standard-2 nodes)"
    echo -e "  - Configure node pools with autoscaling (2-5 nodes)"
else
    echo -e "  - Using existing GKE cluster: ${CLUSTER_NAME}"
fi
echo -e "  - Create Cloud SQL PostgreSQL instance (managed, HA)"
echo -e "  - Create Memorystore Redis instance (managed)"
echo -e "  - Configure private networking"
echo -e "  - Enable deletion protection on databases"

# Production deployment warning
echo ""
echo -e "${RED}⚠️  PRODUCTION INFRASTRUCTURE WARNING${NC}"
echo -e "${YELLOW}📊 This deployment will:${NC}"
echo -e "  - Create billable GCP resources (~$82+/month)"
echo -e "  - Use managed databases with backups and HA"
echo -e "  - Configure production-grade security settings"
echo -e "  - Set deletion protection on critical resources"
echo ""
echo -e "${BLUE}ℹ️  Applications will be deployed separately via CI/CD${NC}"

# Confirmation
echo ""
read -p "Deploy production infrastructure? (yes/no): " -r CONFIRM

if [[ $CONFIRM != "yes" ]]; then
    echo -e "${YELLOW}⏹️  Production deployment cancelled${NC}"
    exit 0
fi

# Final production confirmation
echo ""
echo -e "${RED}🔥 FINAL PRODUCTION CONFIRMATION${NC}"
echo -e "${YELLOW}This will create production resources with ongoing costs${NC}"
read -p "Type 'deploy production' to confirm: " -r FINAL_CONFIRM

if [[ "$FINAL_CONFIRM" != "deploy production" ]]; then
    echo -e "${GREEN}✅ Production deployment cancelled${NC}"
    exit 0
fi

# Deploy infrastructure
echo -e "${YELLOW}🚀 Deploying production infrastructure...${NC}"
terraform apply \
    -var="project_id=${PROJECT_ID}" \
    -var="cluster_name=${CLUSTER_NAME}" \
    -var="zone=${ZONE}" \
    -var="use_existing_cluster=${USE_EXISTING_CLUSTER}" \
    -var="postgres_password=${POSTGRES_PASSWORD}" \
    -auto-approve

# Show outputs
echo ""
echo -e "${BLUE}📤 Infrastructure Information:${NC}"
terraform output

echo ""
echo -e "${GREEN}🎉 Production infrastructure deployment completed!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "  1. ${YELLOW}Add production secrets${NC} to GitHub repository:"
echo -e "     - PRODUCTION_DATABASE_URL (from Terraform outputs)"
echo -e "     - PRODUCTION_REDIS_URL (from Terraform outputs)" 
echo -e "     - PRODUCTION_JWT_SECRET (strong random string)"
echo -e "     - SENDGRID_API_KEY (for email notifications)"
echo -e "  2. ${YELLOW}Push code to 'main' branch${NC} to trigger production deployment"
echo -e "  3. ${YELLOW}Monitor GitHub Actions${NC} for application deployment"
echo ""
echo -e "${BLUE}🔗 Useful Commands:${NC}"
echo -e "  Configure kubectl: ${YELLOW}$(terraform output -raw kubectl_command)${NC}"
echo -e "  Check cluster: ${YELLOW}kubectl get nodes${NC}"
echo -e "  View namespaces: ${YELLOW}kubectl get namespaces${NC}"
echo ""
echo -e "${RED}⚠️  Remember: This creates ongoing costs ($(terraform output -raw estimated_monthly_cost | jq -r .total_estimate))${NC}"
echo ""