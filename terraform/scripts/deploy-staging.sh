#!/bin/bash
# EventBuddy Infrastructure Deployment (Simplified)
# Creates/manages only GKE cluster and networking
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
TERRAFORM_DIR="${SCRIPT_DIR}/../environments/staging"
PROJECT_ID="${GCP_PROJECT_ID:-hypnotic-surfer-468513-a0}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-eventbuddy-cluster}"
ZONE="${GKE_ZONE:-us-central1-a}"

echo -e "${BLUE}🏗️  EventBuddy Infrastructure Deployment${NC}"
echo "============================================="
echo -e "${YELLOW}ℹ️  This script manages ONLY infrastructure (GKE cluster)${NC}"
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
    echo -e "${YELLOW}⚠️  GKE cluster not found - will create new one${NC}"
    USE_EXISTING_CLUSTER=false
fi

# Change to Terraform directory
cd "${TERRAFORM_DIR}"

echo -e "${YELLOW}📂 Working directory: ${TERRAFORM_DIR}${NC}"

# Initialize Terraform
echo -e "${YELLOW}🏗️  Initializing Terraform...${NC}"
terraform init

# Show what will be deployed
echo -e "${YELLOW}📋 Planning infrastructure deployment...${NC}"
echo -e "${BLUE}ℹ️  This will deploy:${NC}"
if [ "${USE_EXISTING_CLUSTER}" = "false" ]; then
    echo -e "  - GKE cluster: ${CLUSTER_NAME} (new cluster)"
    echo -e "  - Node pool with e2-small instances"
    echo -e "  - Service accounts and IAM roles"
else
    echo -e "  - Using existing cluster: ${CLUSTER_NAME}"
    echo -e "  - No infrastructure changes needed"
fi

# Confirm deployment
echo ""
echo -e "${YELLOW}⚡ Ready to deploy infrastructure${NC}"
if [ "${USE_EXISTING_CLUSTER}" = "false" ]; then
    echo -e "${BLUE}ℹ️  This will create GKE cluster and networking resources${NC}"
    echo ""
    read -p "Continue with deployment? (yes/no): " -r CONFIRM

    if [[ $CONFIRM != "yes" ]]; then
        echo -e "${YELLOW}⏹️  Deployment cancelled${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}✅ No infrastructure changes needed - cluster already exists${NC}"
fi

# Deploy infrastructure
if [ "${USE_EXISTING_CLUSTER}" = "false" ]; then
    echo -e "${YELLOW}🚀 Creating GKE cluster infrastructure...${NC}"
    terraform apply \
        -var="project_id=${PROJECT_ID}" \
        -var="cluster_name=${CLUSTER_NAME}" \
        -var="zone=${ZONE}" \
        -var="use_existing_cluster=false" \
        -auto-approve
    
    echo -e "${GREEN}✅ GKE cluster created successfully!${NC}"
else
    echo -e "${GREEN}✅ Using existing cluster - no infrastructure changes${NC}"
fi

# Show outputs
echo ""
echo -e "${BLUE}📤 Infrastructure Information:${NC}"
terraform output

echo ""
echo -e "${GREEN}🎉 Infrastructure deployment completed!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "  1. ${YELLOW}Push code to 'develop' branch${NC} to trigger CI/CD deployment"
echo -e "  2. ${YELLOW}Monitor GitHub Actions${NC} for application deployment progress"
echo -e "  3. ${YELLOW}Check deployment status${NC}: kubectl get pods -n eventbuddy-staging"
echo ""
echo -e "${BLUE}🔗 Useful Commands:${NC}"
echo -e "  Configure kubectl: ${YELLOW}$(terraform output -raw kubectl_command)${NC}"
echo -e "  Check cluster: ${YELLOW}kubectl get nodes${NC}"
echo -e "  View namespaces: ${YELLOW}kubectl get namespaces${NC}"
echo ""