# Cloud Deployment Guide

This guide provides step-by-step instructions for deploying the GitHub Classroom Access Fixer to various cloud platforms.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Railway Deployment](#railway-deployment)
- [Heroku Deployment](#heroku-deployment)
- [AWS EC2 Deployment](#aws-ec2-deployment)
- [Google Cloud Run](#google-cloud-run)
- [Azure Container Instances](#azure-container-instances)
- [DigitalOcean App Platform](#digitalocean-app-platform)

## Prerequisites

### Required Secrets
Before deploying, you'll need:
- `GITHUB_TOKEN`: Your GitHub Personal Access Token with repo and admin:org permissions
- `GITHUB_ORG`: Your GitHub organization name (e.g., "VTECE")
- `WEBHOOK_SECRET`: A secure random string for webhook verification

### Build the Docker Image Locally
```bash
# Build the Docker image
docker build -t ghclassroom-fix:latest .

# Test locally
docker run -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  -e GITHUB_ORG=your_org \
  -e WEBHOOK_SECRET=your_secret \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e DRY_RUN=false \
  ghclassroom-fix:latest
```

---

## Railway Deployment (Recommended - Easiest)

Railway provides the simplest deployment with automatic HTTPS and easy environment management.

### Steps:
1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set GITHUB_TOKEN=ghp_your_token_here
   railway variables set GITHUB_ORG=VTECE
   railway variables set WEBHOOK_SECRET=your_secret_here
   railway variables set PORT=3000
   railway variables set NODE_ENV=production
   railway variables set DRY_RUN=false
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Get Your URL**
   ```bash
   railway open
   ```

Your webhook URL will be: `https://your-app.railway.app/webhook/github`

---

## Heroku Deployment

### Steps:
1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Windows
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Create Heroku App**
   ```bash
   heroku create ghclassroom-fix-yourname
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set GITHUB_TOKEN=ghp_your_token_here
   heroku config:set GITHUB_ORG=VTECE
   heroku config:set WEBHOOK_SECRET=your_secret_here
   heroku config:set NODE_ENV=production
   heroku config:set DRY_RUN=false
   ```

4. **Deploy Using Container Registry**
   ```bash
   # Login to Container Registry
   heroku container:login
   
   # Push and release
   heroku container:push web
   heroku container:release web
   ```

5. **Open App**
   ```bash
   heroku open
   ```

Your webhook URL will be: `https://ghclassroom-fix-yourname.herokuapp.com/webhook/github`

---

## AWS EC2 Deployment

### Using AWS CLI and Docker:

1. **Launch EC2 Instance**
   ```bash
   # Use Amazon Linux 2 or Ubuntu
   # Instance type: t2.micro (free tier eligible)
   # Security group: Allow inbound HTTP (80), HTTPS (443), and your SSH port
   ```

2. **Connect to Instance**
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```

3. **Install Docker**
   ```bash
   # Amazon Linux 2
   sudo yum update -y
   sudo amazon-linux-extras install docker -y
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   
   # Ubuntu
   sudo apt update
   sudo apt install docker.io -y
   sudo systemctl start docker
   sudo usermod -aG docker ubuntu
   ```

4. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/GHClassroom.AccessFix.git
   cd GHClassroom.AccessFix
   ```

5. **Create Environment File**
   ```bash
   cat > .env.production << EOF
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_ORG=VTECE
   WEBHOOK_SECRET=your_secret_here
   PORT=3000
   NODE_ENV=production
   DRY_RUN=false
   EOF
   ```

6. **Build and Run**
   ```bash
   docker build -t ghclassroom-fix .
   docker run -d \
     --name ghclassroom-fix \
     --restart always \
     -p 80:3000 \
     --env-file .env.production \
     ghclassroom-fix
   ```

7. **Setup HTTPS with Nginx and Certbot**
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx -y
   # Configure nginx and get SSL certificate
   sudo certbot --nginx -d your-domain.com
   ```

Your webhook URL will be: `https://your-domain.com/webhook/github`

---

## Google Cloud Run

### Steps:

1. **Install gcloud CLI**
   ```bash
   # Follow instructions at https://cloud.google.com/sdk/docs/install
   ```

2. **Initialize gcloud**
   ```bash
   gcloud init
   gcloud auth configure-docker
   ```

3. **Build and Push Image**
   ```bash
   # Set project ID
   export PROJECT_ID=your-project-id
   
   # Build image
   docker build -t gcr.io/$PROJECT_ID/ghclassroom-fix .
   
   # Push to Container Registry
   docker push gcr.io/$PROJECT_ID/ghclassroom-fix
   ```

4. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy ghclassroom-fix \
     --image gcr.io/$PROJECT_ID/ghclassroom-fix \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "GITHUB_TOKEN=ghp_your_token,GITHUB_ORG=VTECE,WEBHOOK_SECRET=your_secret,NODE_ENV=production,DRY_RUN=false"
   ```

Your webhook URL will be provided after deployment.

---

## Azure Container Instances

### Using Azure CLI:

1. **Login to Azure**
   ```bash
   az login
   ```

2. **Create Resource Group**
   ```bash
   az group create --name ghclassroom-rg --location eastus
   ```

3. **Create Container Registry**
   ```bash
   az acr create --resource-group ghclassroom-rg \
     --name ghclassroomreg --sku Basic
   ```

4. **Build and Push Image**
   ```bash
   az acr build --registry ghclassroomreg \
     --image ghclassroom-fix .
   ```

5. **Deploy Container Instance**
   ```bash
   az container create \
     --resource-group ghclassroom-rg \
     --name ghclassroom-fix \
     --image ghclassroomreg.azurecr.io/ghclassroom-fix:latest \
     --dns-name-label ghclassroom-fix \
     --ports 3000 \
     --environment-variables \
       GITHUB_TOKEN=ghp_your_token \
       GITHUB_ORG=VTECE \
       WEBHOOK_SECRET=your_secret \
       NODE_ENV=production \
       DRY_RUN=false
   ```

Your webhook URL will be: `http://ghclassroom-fix.eastus.azurecontainer.io:3000/webhook/github`

---

## DigitalOcean App Platform

### Steps:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy to DigitalOcean"
   git push origin main
   ```

2. **Create App in DigitalOcean Console**
   - Go to https://cloud.digitalocean.com/apps
   - Click "Create App"
   - Choose GitHub as source
   - Select your repository
   - Choose Dockerfile as build method

3. **Configure Environment Variables**
   In the app settings, add:
   - `GITHUB_TOKEN`
   - `GITHUB_ORG`
   - `WEBHOOK_SECRET`
   - `NODE_ENV=production`
   - `DRY_RUN=false`

4. **Deploy**
   Click "Deploy"

Your webhook URL will be: `https://your-app.ondigitalocean.app/webhook/github`

---

## Post-Deployment Steps

### 1. Configure GitHub Webhook

Go to your GitHub Organization settings:
- Navigate to: `https://github.com/organizations/YOUR_ORG/settings/hooks`
- Click "Add webhook"
- Payload URL: `https://your-deployed-url/webhook/github`
- Content type: `application/json`
- Secret: Your `WEBHOOK_SECRET` value
- Events: Select "Repositories"
- Active: ✅

### 2. Test the Deployment

```bash
# Check health endpoint
curl https://your-deployed-url/health

# Check metrics
curl https://your-deployed-url/metrics
```

### 3. Monitor Logs

Each platform has its own logging solution:
- **Railway**: `railway logs`
- **Heroku**: `heroku logs --tail`
- **AWS**: CloudWatch Logs
- **Google Cloud**: `gcloud logging read`
- **Azure**: `az container logs`
- **DigitalOcean**: App Platform Logs in Console

---

## Security Best Practices

1. **Use Secrets Management**
   - Never commit `.env` files with real tokens
   - Use platform-specific secret management (AWS Secrets Manager, Google Secret Manager, etc.)

2. **Set Up Monitoring**
   - Configure alerts for errors
   - Monitor API rate limits
   - Track successful/failed webhook processing

3. **Enable HTTPS**
   - Always use HTTPS for webhook endpoints
   - Most platforms provide automatic SSL

4. **Rotate Tokens Regularly**
   - Update GitHub Personal Access Token every 90 days
   - Rotate webhook secrets periodically

5. **Implement Rate Limiting**
   - Use platform-specific rate limiting features
   - Consider adding CloudFlare for DDoS protection

---

## Troubleshooting

### Common Issues:

1. **401 Unauthorized Errors**
   - Verify GitHub token is valid
   - Check token has required permissions
   - Ensure organization name is correct

2. **Webhook Not Receiving Events**
   - Verify webhook URL is correct
   - Check webhook secret matches
   - Ensure service is running
   - Check GitHub webhook delivery logs

3. **Container Fails to Start**
   - Check environment variables are set
   - Verify port configuration
   - Check application logs

4. **Out of Memory Errors**
   - Increase container memory limits
   - Check for memory leaks
   - Implement connection pooling

---

## Cost Estimates

- **Railway**: Free tier available, ~$5-10/month for basic usage
- **Heroku**: Free tier discontinued, ~$7/month for Eco dyno
- **AWS EC2**: t2.micro free tier for 12 months, then ~$8/month
- **Google Cloud Run**: Free tier includes 2M requests/month
- **Azure Container Instances**: ~$0.0012/vCPU/hour
- **DigitalOcean**: $5/month for basic app

---

## Support

For issues specific to:
- Application bugs: Create issue on GitHub repository
- Platform issues: Contact platform support
- GitHub API: Check GitHub API documentation