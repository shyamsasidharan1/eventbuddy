#!/bin/bash
# EventBuddy Environment Switcher
# Easily switch kubectl context between staging and production

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

echo -e "${BLUE}🔄 EventBuddy Environment Switcher${NC}"
echo "===================================="

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud CLI is not installed${NC}"
    exit 1
fi

# Show current context
echo -e "${YELLOW}📍 Current kubectl context:${NC}"
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
echo -e "  ${GREEN}${CURRENT_CONTEXT}${NC}"

# Show current namespace
CURRENT_NAMESPACE=$(kubectl config view --minify --output 'jsonpath={..namespace}' 2>/dev/null || echo "default")
echo -e "${YELLOW}📁 Current namespace:${NC}"
echo -e "  ${GREEN}${CURRENT_NAMESPACE}${NC}"

# Show available environments
echo ""
echo -e "${BLUE}🌍 Available EventBuddy Environments:${NC}"

# Check staging
if kubectl get namespace eventbuddy-staging &>/dev/null; then
    STAGING_PODS=$(kubectl get pods -n eventbuddy-staging --no-headers 2>/dev/null | wc -l | tr -d ' ')
    STAGING_RUNNING=$(kubectl get pods -n eventbuddy-staging --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✅ staging${NC} - ${STAGING_RUNNING}/${STAGING_PODS} pods running"
else
    echo -e "  ${RED}❌ staging${NC} - not deployed"
fi

# Check production
if kubectl get namespace eventbuddy &>/dev/null; then
    PROD_PODS=$(kubectl get pods -n eventbuddy --no-headers 2>/dev/null | wc -l | tr -d ' ')
    PROD_RUNNING=$(kubectl get pods -n eventbuddy --field-selector=status.phase=Running --no-headers 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}✅ production${NC} - ${PROD_RUNNING}/${PROD_PODS} pods running"
else
    echo -e "  ${RED}❌ production${NC} - not deployed"
fi

# Environment selection
echo ""
echo -e "${YELLOW}🎯 Select environment to switch to:${NC}"
echo -e "  ${BLUE}1)${NC} staging (eventbuddy-staging namespace)"
echo -e "  ${BLUE}2)${NC} production (eventbuddy namespace)"
echo -e "  ${BLUE}3)${NC} show environment info"
echo -e "  ${BLUE}q)${NC} quit"

read -p "Enter your choice [1-3,q]: " -r CHOICE

case $CHOICE in
    1)
        ENVIRONMENT="staging"
        NAMESPACE="eventbuddy-staging"
        SERVICE_NAME="eventbuddy-api-service-staging"
        ;;
    2)
        ENVIRONMENT="production"
        NAMESPACE="eventbuddy"
        SERVICE_NAME="eventbuddy-api-service-production"
        ;;
    3)
        echo ""
        echo -e "${BLUE}🔍 Environment Information:${NC}"
        
        if kubectl get namespace eventbuddy-staging &>/dev/null; then
            echo ""
            echo -e "${YELLOW}📊 Staging Environment:${NC}"
            kubectl get pods,services -n eventbuddy-staging
        fi
        
        if kubectl get namespace eventbuddy &>/dev/null; then
            echo ""
            echo -e "${YELLOW}📊 Production Environment:${NC}"
            kubectl get pods,services -n eventbuddy
        fi
        
        exit 0
        ;;
    q|Q)
        echo -e "${GREEN}✅ No changes made${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Check if target environment exists
if ! kubectl get namespace "${NAMESPACE}" &>/dev/null; then
    echo -e "${RED}❌ Environment '${ENVIRONMENT}' is not deployed${NC}"
    echo ""
    if [ "${ENVIRONMENT}" = "staging" ]; then
        echo -e "${BLUE}💡 Deploy staging with: terraform/scripts/deploy-staging.sh${NC}"
    else
        echo -e "${BLUE}💡 Deploy production with: terraform/scripts/deploy-production.sh${NC}"
    fi
    exit 1
fi

# Get cluster credentials (refresh)
echo -e "${YELLOW}🔐 Refreshing cluster credentials...${NC}"
gcloud container clusters get-credentials "${CLUSTER_NAME}" --zone "${ZONE}" --project "${PROJECT_ID}"

# Switch namespace
echo -e "${YELLOW}🔄 Switching to ${ENVIRONMENT} environment...${NC}"
kubectl config set-context --current --namespace="${NAMESPACE}"

# Verify switch
echo -e "${GREEN}✅ Switched to ${ENVIRONMENT} environment${NC}"

# Show environment status
echo ""
echo -e "${BLUE}📊 Current Environment Status:${NC}"
kubectl get pods,services

# Show connection commands
echo ""
echo -e "${BLUE}🔗 Connection Commands:${NC}"
echo -e "  Port forward: ${YELLOW}kubectl port-forward service/${SERVICE_NAME} 8080:80${NC}"

if [ "${ENVIRONMENT}" = "production" ]; then
    # Try to get load balancer IP
    LB_IP=$(kubectl get service "${SERVICE_NAME}" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "${LB_IP}" ]; then
        echo -e "  External URL: ${GREEN}http://${LB_IP}/api/v1${NC}"
        echo -e "  Health check: ${GREEN}curl http://${LB_IP}/api/v1/health${NC}"
    else
        echo -e "  ${YELLOW}Load Balancer IP still being assigned...${NC}"
    fi
fi

# Show useful commands
echo ""
echo -e "${BLUE}📋 Useful Commands:${NC}"
echo -e "  View logs: ${YELLOW}kubectl logs -f deployment/eventbuddy-api-${ENVIRONMENT}${NC}"
echo -e "  Describe pods: ${YELLOW}kubectl describe pods${NC}"
echo -e "  Get events: ${YELLOW}kubectl get events --sort-by=.metadata.creationTimestamp${NC}"
echo -e "  Port forward: ${YELLOW}kubectl port-forward service/${SERVICE_NAME} 8080:80${NC}"

echo ""
echo -e "${GREEN}🎉 Now working in ${ENVIRONMENT} environment!${NC}"