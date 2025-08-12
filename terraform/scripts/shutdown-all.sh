#!/bin/bash
# EventBuddy Staging Shutdown Script
# Deletes GKE cluster to save costs (staging only - does NOT touch production databases)

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

echo -e "${RED}🌙 EventBuddy Staging Shutdown (Cost Savings)${NC}"
echo "==============================================="
echo -e "${YELLOW}⚠️  This script is for STAGING only${NC}"
echo -e "${YELLOW}⚠️  Production managed databases will NOT be touched${NC}"
echo ""

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

# Check for production resources
echo -e "${YELLOW}🔍 Checking for production resources...${NC}"
PROD_SQL=$(gcloud sql instances list --filter="name~eventbuddy-postgres-production" --format="value(name)" 2>/dev/null || echo "")
PROD_REDIS=$(gcloud redis instances list --region=us-central1 --filter="name~eventbuddy-redis-production" --format="value(name)" 2>/dev/null || echo "")

if [ -n "${PROD_SQL}" ] || [ -n "${PROD_REDIS}" ]; then
    echo -e "${YELLOW}⚠️  Production databases detected:${NC}"
    [ -n "${PROD_SQL}" ] && echo -e "  - Cloud SQL: ${PROD_SQL}"
    [ -n "${PROD_REDIS}" ] && echo -e "  - Redis: ${PROD_REDIS}"
    echo -e "${GREEN}✅ These will NOT be deleted (production protection)${NC}"
    echo ""
fi

# Show current cluster status
echo -e "${YELLOW}🔍 Current staging cluster status:${NC}"
if gcloud container clusters describe "${CLUSTER_NAME}" --zone="${ZONE}" &>/dev/null; then
    echo -e "${GREEN}✅ Cluster is running${NC}"
    
    # Show current costs
    NODES=$(gcloud compute instances list --filter="name~gke-${CLUSTER_NAME}" --format="value(name)" | wc -l)
    echo -e "${BLUE}💰 Current staging infrastructure:${NC}"
    echo -e "  - Cluster: ${CLUSTER_NAME}"
    echo -e "  - Nodes: ${NODES} instances"
    echo -e "  - Estimated cost: ~$20-40/month"
    echo ""
    
    # Show what will be deleted
    echo -e "${YELLOW}⚠️  This will DELETE (staging only):${NC}"
    echo -e "  - GKE cluster: ${CLUSTER_NAME}"
    echo -e "  - All worker nodes (compute instances)"
    echo -e "  - All staging applications and data"
    echo -e "  - Load balancers and persistent disks"
    echo ""
    echo -e "${GREEN}💰 Cost savings: ~$20-40/month while shut down${NC}"
    echo -e "${BLUE}🔄 Recreate staging: ./deploy-staging.sh + push to develop branch${NC}"
    echo ""
    
    # Production safety check
    echo -e "${GREEN}✅ PRODUCTION SAFETY:${NC}"
    echo -e "  - Production databases will remain running"
    echo -e "  - Only staging cluster will be deleted"
    echo -e "  - This is safe for overnight cost savings"
    echo ""
    
    # Confirmation
    echo -e "${RED}🚨 FINAL CONFIRMATION${NC}"
    echo -e "${YELLOW}This will delete the staging GKE cluster only${NC}"
    read -p "Type 'shutdown staging' to confirm: " -r CONFIRM
    
    if [[ "$CONFIRM" != "shutdown staging" ]]; then
        echo -e "${GREEN}✅ Shutdown cancelled - infrastructure preserved${NC}"
        exit 0
    fi
    
    echo -e "${RED}💥 Shutting down staging cluster...${NC}"
    gcloud container clusters delete "${CLUSTER_NAME}" --zone="${ZONE}" --quiet
    
    echo ""
    echo -e "${GREEN}🌙 Staging shutdown successful!${NC}"
    echo -e "${BLUE}💰 Cost savings: Active (~$20-40/month saved)${NC}"
    echo -e "${BLUE}🔄 To restart staging:${NC}"
    echo -e "  1. Run: ./deploy-staging.sh"
    echo -e "  2. Push to develop branch to deploy applications"
    echo ""
    if [ -n "${PROD_SQL}" ] || [ -n "${PROD_REDIS}" ]; then
        echo -e "${GREEN}✅ Production databases remain running and safe${NC}"
    fi
    
else
    echo -e "${YELLOW}⚠️  No staging cluster found - already shut down${NC}"
    echo -e "${GREEN}💰 Cost savings: Already active${NC}"
    if [ -n "${PROD_SQL}" ] || [ -n "${PROD_REDIS}" ]; then
        echo -e "${BLUE}📊 Production databases still running (as expected)${NC}"
    fi
fi