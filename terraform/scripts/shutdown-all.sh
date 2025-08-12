#!/bin/bash
# EventBuddy Complete Shutdown Script
# Deletes entire GKE cluster to save costs overnight

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-hypnotic-surfer-468513-a0}"
CLUSTER_NAME="${GKE_CLUSTER_NAME:-eventbuddy-cluster}"
ZONE="${GKE_ZONE:-us-central1-a}"

echo -e "${RED}🌙 EventBuddy Complete Shutdown (Cost Savings)${NC}"
echo "=============================================="

# Check authentication
echo -e "${YELLOW}🔐 Checking GCP authentication...${NC}"

if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [ -z "${GCP_SA_KEY:-}" ]; then
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        echo -e "${RED}❌ No active gcloud authentication found${NC}"
        echo -e "${BLUE}💡 Run: gcloud auth login${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Using gcloud default credentials${NC}"
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
    gcloud config set project "${PROJECT_ID}" &>/dev/null
fi

# Show current cluster status
echo -e "${YELLOW}🔍 Current cluster status:${NC}"
if gcloud container clusters describe "${CLUSTER_NAME}" --zone="${ZONE}" &>/dev/null; then
    echo -e "${GREEN}✅ Cluster is running${NC}"
    
    # Show current costs
    NODES=$(gcloud compute instances list --filter="name~gke-${CLUSTER_NAME}" --format="value(name)" | wc -l)
    echo -e "${BLUE}💰 Current infrastructure:${NC}"
    echo -e "  - Cluster: ${CLUSTER_NAME}"
    echo -e "  - Nodes: ${NODES} instances"
    echo -e "  - Estimated cost: ~$25-30/month"
    echo ""
    
    # Show what will be deleted
    echo -e "${YELLOW}⚠️  This will DELETE:${NC}"
    echo -e "  - Complete GKE cluster"
    echo -e "  - All worker nodes (compute instances)"
    echo -e "  - All applications and data"
    echo -e "  - Load balancers and persistent disks"
    echo ""
    echo -e "${GREEN}💰 Cost savings: ~$25-30/month while shut down${NC}"
    echo -e "${BLUE}🔄 Recreate tomorrow: ./deploy-staging.sh${NC}"
    echo ""
    
    # Confirmation
    echo -e "${RED}🚨 FINAL WARNING: This will delete EVERYTHING!${NC}"
    read -p "Type 'shutdown now' to confirm complete deletion: " -r CONFIRM
    
    if [[ "$CONFIRM" != "shutdown now" ]]; then
        echo -e "${GREEN}✅ Shutdown cancelled - infrastructure preserved${NC}"
        exit 0
    fi
    
    echo -e "${RED}💥 Shutting down complete infrastructure...${NC}"
    gcloud container clusters delete "${CLUSTER_NAME}" --zone="${ZONE}" --quiet
    
    echo ""
    echo -e "${GREEN}🌙 Complete shutdown successful!${NC}"
    echo -e "${BLUE}💰 Cost savings: Active (no running infrastructure)${NC}"
    echo -e "${BLUE}🔄 To restart tomorrow: ./deploy-staging.sh${NC}"
    
else
    echo -e "${YELLOW}⚠️  No cluster found - already shut down${NC}"
    echo -e "${GREEN}💰 Cost savings: Already active${NC}"
fi