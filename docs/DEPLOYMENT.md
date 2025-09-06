# Deployment Guide

## Table of Contents
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Production Checklist](#production-checklist)
- [Monitoring Setup](#monitoring-setup)

## Local Development

### Using ngrok

1. Start the application:
```bash
npm run dev
```

2. Install and start ngrok:
```bash
ngrok http 3000
```

3. Configure GitHub webhook with the ngrok URL:
   - URL: `https://xxx.ngrok.io/webhook/github`
   - Secret: Your webhook secret
   - Events: Repository creation

### Using localtunnel

```bash
npm install -g localtunnel
lt --port 3000 --subdomain github-classroom-fixer
```

## Docker Deployment

### Single Container

```bash
# Build the image
docker build -t github-classroom-fixer:latest .

# Run with environment file
docker run -d \
  --name github-classroom-fixer \
  -p 3000:3000 \
  -p 9090:9090 \
  --restart unless-stopped \
  --env-file .env \
  github-classroom-fixer:latest
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes
docker-compose down -v
```

## Cloud Deployment

### AWS ECS

1. Build and push to ECR:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_URI
docker build -t github-classroom-fixer .
docker tag github-classroom-fixer:latest $ECR_URI/github-classroom-fixer:latest
docker push $ECR_URI/github-classroom-fixer:latest
```

2. Create task definition (`task-definition.json`):
```json
{
  "family": "github-classroom-fixer",
  "taskRoleArn": "arn:aws:iam::xxx:role/ecsTaskRole",
  "executionRoleArn": "arn:aws:iam::xxx:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "app",
    "image": "${ECR_URI}/github-classroom-fixer:latest",
    "portMappings": [
      {"containerPort": 3000, "protocol": "tcp"},
      {"containerPort": 9090, "protocol": "tcp"}
    ],
    "environment": [],
    "secrets": [
      {"name": "GITHUB_TOKEN", "valueFrom": "arn:aws:secretsmanager:xxx"},
      {"name": "WEBHOOK_SECRET", "valueFrom": "arn:aws:secretsmanager:xxx"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/github-classroom-fixer",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "ecs"
      }
    }
  }]
}
```

3. Deploy service:
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
aws ecs create-service \
  --cluster default \
  --service-name github-classroom-fixer \
  --task-definition github-classroom-fixer:1 \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Google Cloud Run

```bash
# Build and push to GCR
gcloud builds submit --tag gcr.io/$PROJECT_ID/github-classroom-fixer

# Deploy
gcloud run deploy github-classroom-fixer \
  --image gcr.io/$PROJECT_ID/github-classroom-fixer \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="GITHUB_TOKEN=github-token:latest,WEBHOOK_SECRET=webhook-secret:latest"
```

### Azure Container Instances

```bash
# Create resource group
az group create --name github-classroom-rg --location eastus

# Create container
az container create \
  --resource-group github-classroom-rg \
  --name github-classroom-fixer \
  --image ghcr.io/yourusername/github-classroom-fixer:latest \
  --dns-name-label github-classroom-fixer \
  --ports 3000 9090 \
  --environment-variables NODE_ENV=production \
  --secure-environment-variables GITHUB_TOKEN=$GITHUB_TOKEN WEBHOOK_SECRET=$WEBHOOK_SECRET
```

### Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create github-classroom-fixer

# Set environment variables
heroku config:set GITHUB_TOKEN=xxx
heroku config:set WEBHOOK_SECRET=xxx
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Scale
heroku ps:scale web=1
```

### Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Create `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/dist/index.js"
    }
  ]
}
```

3. Deploy:
```bash
vercel --prod
```

## Production Checklist

### Security
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up IP whitelisting
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Use secrets management service
- [ ] Enable audit logging
- [ ] Set up intrusion detection

### Performance
- [ ] Configure auto-scaling
- [ ] Set up CDN (if applicable)
- [ ] Enable compression
- [ ] Configure caching
- [ ] Set resource limits
- [ ] Enable connection pooling

### Monitoring
- [ ] Set up application monitoring
- [ ] Configure log aggregation
- [ ] Set up alerts
- [ ] Enable performance monitoring
- [ ] Configure uptime monitoring
- [ ] Set up error tracking

### Backup & Recovery
- [ ] Configure automated backups
- [ ] Test restore procedures
- [ ] Document recovery process
- [ ] Set up disaster recovery plan

## Monitoring Setup

### Prometheus

1. Configure Prometheus (`prometheus.yml`):
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'github-classroom-fixer'
    static_configs:
      - targets: ['app:9090']
```

2. Start Prometheus:
```bash
docker run -d \
  --name prometheus \
  -p 9091:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

### Grafana

1. Import dashboard:
   - Login to Grafana (admin/admin)
   - Import dashboard from `monitoring/grafana/dashboards/`
   - Configure Prometheus data source

2. Set up alerts:
   - Configure notification channels
   - Set alert thresholds
   - Test alert delivery

### ELK Stack

1. Configure Filebeat:
```yaml
filebeat.inputs:
- type: container
  paths:
    - '/var/lib/docker/containers/*/*.log'

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

2. Start ELK stack:
```bash
docker-compose -f docker-compose.elk.yml up -d
```

## Environment-Specific Configuration

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
DRY_RUN=true
```

### Staging
```env
NODE_ENV=staging
LOG_LEVEL=info
DRY_RUN=false
ENABLE_METRICS=true
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
DRY_RUN=false
ENABLE_METRICS=true
RATE_LIMIT_MAX_RETRIES=5
```

## Troubleshooting Deployment

### Container won't start
- Check logs: `docker logs github-classroom-fixer`
- Verify environment variables
- Check port availability
- Verify image build

### Webhook not receiving events
- Verify webhook URL is accessible
- Check webhook secret matches
- Verify GitHub webhook configuration
- Check firewall/security group rules

### High memory usage
- Check for memory leaks
- Adjust Node.js heap size
- Enable memory profiling
- Check for unclosed connections