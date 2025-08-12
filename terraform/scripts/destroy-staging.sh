#!/bin/bash
# EventBuddy Staging Infrastructure Destruction
# Safely destroys staging environment to save costs

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

echo -e "${RED}💥 EventBuddy Staging Infrastructure Destruction${NC}"
echo "=================================================="

# Check prerequisites
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}❌ Terraform is not installed${NC}"
    exit 1
fi

# Change to Terraform directory
cd "${TERRAFORM_DIR}"
echo -e "${YELLOW}📂 Working directory: ${TERRAFORM_DIR}${NC}"

# Check if Terraform state exists
if [ ! -f "terraform.tfstate" ] && [ ! -f ".terraform/terraform.tfstate" ]; then
    echo -e "${YELLOW}⚠️  No Terraform state found${NC}"
    echo -e "${BLUE}ℹ️  Nothing to destroy${NC}"
    exit 0
fi

# Show current infrastructure
echo -e "${YELLOW}🔍 Current infrastructure:${NC}"
terraform show -no-color | grep -E "^(# |resource)" | head -20 || true

# Calculate potential savings
echo ""
echo -e "${BLUE}💰 Cost Savings:${NC}"
echo -e "  - GKE cluster nodes: ${GREEN}~$25-50/month${NC}"
echo -e "  - In-cluster databases: ${GREEN}~$5-10/month${NC}"
echo -e "  - LoadBalancer (if any): ${GREEN}~$18/month${NC}"
echo -e "  ${GREEN}Total potential savings: ~$48-78/month${NC}"

# Warning message
echo ""
echo -e "${RED}⚠️  WARNING: This will DESTROY all staging infrastructure!${NC}"
echo -e "${YELLOW}📊 This will remove:${NC}"
echo -e "  - eventbuddy-staging namespace and all resources"
echo -e "  - PostgreSQL and Redis data (if in-cluster)"
echo -e "  - All staging configurations and secrets"
echo -e "  - Load balancer IP address (if any)"
echo ""
echo -e "${BLUE}ℹ️  Your application code and CI/CD pipeline will be unaffected${NC}"
echo -e "${GREEN}✅ You can recreate this environment anytime with: ${SCRIPT_DIR}/deploy-staging.sh${NC}"

# Double confirmation
echo ""
echo -e "${YELLOW}🤔 Are you absolutely sure?${NC}"
echo -e "${RED}Type 'destroy staging' to confirm complete destruction:${NC}"
read -r CONFIRM

if [[ "$CONFIRM" != "destroy staging" ]]; then
    echo -e "${GREEN}✅ Destruction cancelled - infrastructure preserved${NC}"
    exit 0
fi

# Set up authentication (same as deploy script)
echo -e "${YELLOW}🔐 Checking GCP authentication...${NC}"

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${GCP_SA_KEY:-}" ]; then
    echo -e "${BLUE}ℹ️  Using gcloud default credentials${NC}"
    
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        echo -e "${RED}❌ No active gcloud authentication found${NC}"
        echo -e "${BLUE}💡 Run: gcloud auth login${NC}"
        exit 1
    fi
    
    # Use access token from current gcloud session instead of application default credentials
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

if [ -n "${PROJECT_ID}" ]; then
    gcloud config set project "${PROJECT_ID}"
    export GOOGLE_PROJECT="${PROJECT_ID}"
fi

# Initialize Terraform (in case of state backend changes)
echo -e "${YELLOW}🏗️  Initializing Terraform...${NC}"
terraform init

# Plan destruction
echo -e "${YELLOW}📋 Planning infrastructure destruction...${NC}"
terraform plan -destroy \
    -var="project_id=${PROJECT_ID}" \
    -var="cluster_name=${CLUSTER_NAME}" \
    -var="zone=${ZONE}" \
    -var="use_existing_cluster=true" \
    -out=destroy.tfplan

# Show destroy plan
echo -e "${BLUE}📊 Destruction Plan:${NC}"
terraform show -no-color destroy.tfplan | grep -E "^(Plan:|# |will be destroyed)" | head -10 || true

# Final confirmation
echo ""
echo -e "${RED}🔥 FINAL CONFIRMATION REQUIRED${NC}"
echo -e "${YELLOW}This is your last chance to cancel!${NC}"
read -p "Proceed with destruction? (yes/no): " -r FINAL_CONFIRM

if [[ $FINAL_CONFIRM != "yes" ]]; then
    echo -e "${GREEN}✅ Destruction cancelled${NC}"
    rm -f destroy.tfplan
    exit 0
fi

# Execute destruction
echo -e "${RED}💥 Destroying staging infrastructure...${NC}"
terraform apply destroy.tfplan

# Clean up plan file
rm -f destroy.tfplan

# Verify destruction
echo -e "${YELLOW}🔍 Verifying destruction...${NC}"

# Check if namespace still exists
if kubectl get namespace eventbuddy-staging &>/dev/null; then
    echo -e "${YELLOW}⚠️  Namespace still exists, attempting manual cleanup...${NC}"
    kubectl delete namespace eventbuddy-staging --ignore-not-found=true --timeout=60s || true
fi

# Final status
echo ""
echo -e "${GREEN}🎉 Staging infrastructure destroyed successfully!${NC}"
echo ""
echo -e "${BLUE}📊 Status:${NC}"
echo -e "  - Infrastructure: ${RED}Destroyed${NC}"
echo -e "  - Costs: ${GREEN}Stopped${NC}"
echo -e "  - Application Code: ${GREEN}Preserved${NC}"
echo -e "  - CI/CD Pipeline: ${GREEN}Unchanged${NC}"
echo ""
echo -e "${BLUE}🔄 To recreate staging environment:${NC}"
echo -e "  ${YELLOW}${SCRIPT_DIR}/deploy-staging.sh${NC}"
echo ""
echo -e "${GREEN}💰 Monthly cost savings: ~$48-78${NC}"