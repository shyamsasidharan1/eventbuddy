#!/bin/bash
# EventBuddy Simple Staging Shutdown Script
# Quickly deletes GKE cluster to save costs

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

echo -e "${RED}🌙 EventBuddy Quick Staging Shutdown${NC}"
echo "===================================="

# Set project
if [ -n "${PROJECT_ID}" ]; then
    gcloud config set project "${PROJECT_ID}" &>/dev/null
fi

# Check if cluster exists
echo -e "${YELLOW}🔍 Checking cluster status...${NC}"
if gcloud container clusters describe "${CLUSTER_NAME}" --zone="${ZONE}" &>/dev/null; then
    echo -e "${GREEN}✅ Found cluster: ${CLUSTER_NAME}${NC}"
    
    # Show cost info
    echo -e "${BLUE}💰 Current estimated cost: ~$30-40/month${NC}"
    echo -e "${GREEN}💰 Savings after shutdown: ~$30-40/month${NC}"
    echo ""
    
    # Simple confirmation
    echo -e "${YELLOW}This will delete the staging GKE cluster${NC}"
    read -p "Continue? (y/N): " -r CONFIRM
    
    if [[ $CONFIRM =~ ^[Yy]$ ]]; then
        echo -e "${RED}💥 Deleting staging cluster...${NC}"
        gcloud container clusters delete "${CLUSTER_NAME}" --zone="${ZONE}" --quiet
        
        echo ""
        echo -e "${GREEN}🌙 Staging shutdown complete!${NC}"
        echo -e "${BLUE}💰 Cost savings: Active${NC}"
        echo ""
        echo -e "${BLUE}🔄 To restart:${NC}"
        echo -e "  1. Run: ./terraform/scripts/deploy-staging.sh"
        echo -e "  2. Push to develop branch for app deployment"
    else
        echo -e "${GREEN}✅ Shutdown cancelled${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠️  Cluster not found - already shut down${NC}"
    echo -e "${GREEN}💰 Cost savings: Already active${NC}"
fi