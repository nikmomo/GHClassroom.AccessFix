#!/bin/bash

# GitHub Classroom Access Fixer - Quick Deploy Script
# Usage: ./deploy.sh [platform]
# Platforms: railway, heroku, docker

set -e

PLATFORM=${1:-docker}
APP_NAME="ghclassroom-fix"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}GitHub Classroom Access Fixer - Deployment Script${NC}"
echo "================================================"

# Check for required environment variables
check_env() {
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${RED}Error: GITHUB_TOKEN is not set${NC}"
        echo "Please set: export GITHUB_TOKEN=ghp_your_token_here"
        exit 1
    fi
    
    if [ -z "$GITHUB_ORG" ]; then
        echo -e "${RED}Error: GITHUB_ORG is not set${NC}"
        echo "Please set: export GITHUB_ORG=your_org_name"
        exit 1
    fi
    
    if [ -z "$WEBHOOK_SECRET" ]; then
        echo -e "${YELLOW}Warning: WEBHOOK_SECRET is not set, generating one...${NC}"
        export WEBHOOK_SECRET=$(openssl rand -hex 32)
        echo "Generated webhook secret: $WEBHOOK_SECRET"
    fi
}

# Deploy to Railway
deploy_railway() {
    echo -e "${GREEN}Deploying to Railway...${NC}"
    
    # Check if Railway CLI is installed
    if ! command -v railway &> /dev/null; then
        echo "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    # Login to Railway
    railway login
    
    # Create new project or link existing
    railway link || railway init
    
    # Set environment variables
    railway variables set GITHUB_TOKEN="$GITHUB_TOKEN"
    railway variables set GITHUB_ORG="$GITHUB_ORG"
    railway variables set WEBHOOK_SECRET="$WEBHOOK_SECRET"
    railway variables set PORT=3000
    railway variables set NODE_ENV=production
    railway variables set DRY_RUN=false
    
    # Deploy
    railway up
    
    # Get deployment URL
    echo -e "${GREEN}Deployment complete!${NC}"
    railway open
}

# Deploy to Heroku
deploy_heroku() {
    echo -e "${GREEN}Deploying to Heroku...${NC}"
    
    # Check if Heroku CLI is installed
    if ! command -v heroku &> /dev/null; then
        echo -e "${RED}Heroku CLI is not installed${NC}"
        echo "Please install from: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
    
    # Create app if doesn't exist
    heroku create $APP_NAME-$(date +%s) || true
    
    # Set environment variables
    heroku config:set \
        GITHUB_TOKEN="$GITHUB_TOKEN" \
        GITHUB_ORG="$GITHUB_ORG" \
        WEBHOOK_SECRET="$WEBHOOK_SECRET" \
        NODE_ENV=production \
        DRY_RUN=false
    
    # Deploy using container
    heroku container:login
    heroku container:push web
    heroku container:release web
    
    # Open app
    echo -e "${GREEN}Deployment complete!${NC}"
    heroku open
}

# Build and run Docker locally
deploy_docker() {
    echo -e "${GREEN}Building Docker image...${NC}"
    
    # Build Docker image
    docker build -t $APP_NAME:latest .
    
    # Stop existing container if running
    docker stop $APP_NAME 2>/dev/null || true
    docker rm $APP_NAME 2>/dev/null || true
    
    # Run new container
    echo -e "${GREEN}Starting Docker container...${NC}"
    docker run -d \
        --name $APP_NAME \
        --restart unless-stopped \
        -p 3000:3000 \
        -e GITHUB_TOKEN="$GITHUB_TOKEN" \
        -e GITHUB_ORG="$GITHUB_ORG" \
        -e WEBHOOK_SECRET="$WEBHOOK_SECRET" \
        -e PORT=3000 \
        -e NODE_ENV=production \
        -e DRY_RUN=false \
        $APP_NAME:latest
    
    echo -e "${GREEN}Container started!${NC}"
    echo "Access the service at: http://localhost:3000"
    echo "Health check: http://localhost:3000/health"
    echo ""
    echo "To view logs: docker logs -f $APP_NAME"
    echo "To stop: docker stop $APP_NAME"
}

# Build Docker image only
build_docker() {
    echo -e "${GREEN}Building Docker image...${NC}"
    docker build -t $APP_NAME:latest .
    echo -e "${GREEN}Docker image built successfully!${NC}"
    echo "Image name: $APP_NAME:latest"
}

# Main execution
check_env

case $PLATFORM in
    railway)
        deploy_railway
        ;;
    heroku)
        deploy_heroku
        ;;
    docker)
        deploy_docker
        ;;
    build)
        build_docker
        ;;
    *)
        echo -e "${RED}Invalid platform: $PLATFORM${NC}"
        echo "Usage: $0 [railway|heroku|docker|build]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Configure GitHub webhook at: https://github.com/organizations/$GITHUB_ORG/settings/hooks"
echo "2. Webhook URL: <your-deployed-url>/webhook/github"
echo "3. Webhook Secret: $WEBHOOK_SECRET"
echo "4. Select 'Repositories' events"