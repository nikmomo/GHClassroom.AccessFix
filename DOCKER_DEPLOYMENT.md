# Docker Deployment Guide

## Quick Start

### 1. Build the Docker Image
```bash
docker build -t ghclassroom-fix:latest .
```

### 2. Run with Docker

#### Option A: Using docker run
```bash
docker run -d \
  --name ghclassroom-fix \
  --restart unless-stopped \
  -p 3000:3000 \
  -e GITHUB_TOKEN=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 \
  -e GITHUB_ORG=VTECE \
  -e WEBHOOK_SECRET=your_webhook_secret_12345 \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e DRY_RUN=false \
  ghclassroom-fix:latest
```

#### Option B: Using docker-compose
1. Create `.env.docker` file:
```bash
GITHUB_TOKEN=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
GITHUB_ORG=VTECE
WEBHOOK_SECRET=your_webhook_secret_12345
```

2. Run with docker-compose:
```bash
docker-compose -f docker-compose.prod.yml --env-file .env.docker up -d
```

### 3. Verify Deployment
```bash
# Check if container is running
docker ps

# Check logs
docker logs -f ghclassroom-fix

# Test health endpoint
curl http://localhost:3000/health

# Check metrics
curl http://localhost:3000/metrics
```

## Deploy to Cloud VPS (AWS EC2, DigitalOcean, Linode, etc.)

### Prerequisites
- VPS with Docker installed
- Domain name (optional, for HTTPS)
- SSH access to your server

### Step 1: Transfer Files to Server
```bash
# Option 1: Use git
ssh your-server
git clone https://github.com/yourusername/GHClassroom.AccessFix.git
cd GHClassroom.AccessFix

# Option 2: Copy files directly
scp -r . user@your-server:/home/user/ghclassroom-fix/
```

### Step 2: Build on Server
```bash
ssh your-server
cd /home/user/ghclassroom-fix
docker build -t ghclassroom-fix:latest .
```

### Step 3: Run with Systemd (Recommended)

Create systemd service file:
```bash
sudo nano /etc/systemd/system/ghclassroom-fix.service
```

Add content:
```ini
[Unit]
Description=GitHub Classroom Access Fixer
After=docker.service
Requires=docker.service

[Service]
Restart=always
RestartSec=10
ExecStartPre=-/usr/bin/docker stop ghclassroom-fix
ExecStartPre=-/usr/bin/docker rm ghclassroom-fix
ExecStart=/usr/bin/docker run \
  --name ghclassroom-fix \
  --rm \
  -p 3000:3000 \
  -e GITHUB_TOKEN=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 \
  -e GITHUB_ORG=VTECE \
  -e WEBHOOK_SECRET=your_webhook_secret_12345 \
  -e NODE_ENV=production \
  -e DRY_RUN=false \
  ghclassroom-fix:latest
ExecStop=/usr/bin/docker stop ghclassroom-fix

[Install]
WantedBy=multi-user.target
```

Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable ghclassroom-fix
sudo systemctl start ghclassroom-fix
sudo systemctl status ghclassroom-fix
```

### Step 4: Setup HTTPS with Nginx

Install Nginx and Certbot:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

Create Nginx config:
```bash
sudo nano /etc/nginx/sites-available/ghclassroom-fix
```

Add content:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and get SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/ghclassroom-fix /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

## Docker Management Commands

### View Logs
```bash
# Live logs
docker logs -f ghclassroom-fix

# Last 100 lines
docker logs --tail 100 ghclassroom-fix
```

### Stop/Start Container
```bash
# Stop
docker stop ghclassroom-fix

# Start
docker start ghclassroom-fix

# Restart
docker restart ghclassroom-fix
```

### Update Application
```bash
# Pull latest code
git pull

# Rebuild image
docker build -t ghclassroom-fix:latest .

# Stop old container
docker stop ghclassroom-fix
docker rm ghclassroom-fix

# Start new container
docker run -d \
  --name ghclassroom-fix \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.docker \
  ghclassroom-fix:latest
```

### Backup and Restore
```bash
# Backup Docker image
docker save ghclassroom-fix:latest | gzip > ghclassroom-fix-backup.tar.gz

# Restore Docker image
docker load < ghclassroom-fix-backup.tar.gz
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| GITHUB_TOKEN | Yes | - | GitHub Personal Access Token |
| GITHUB_ORG | Yes | - | GitHub Organization name |
| WEBHOOK_SECRET | Yes | - | Secret for webhook verification |
| PORT | No | 3000 | Server port |
| NODE_ENV | No | production | Environment mode |
| DRY_RUN | No | false | Test mode without making changes |
| LOG_LEVEL | No | info | Logging level |
| LOG_FORMAT | No | json | Log format (json/pretty) |

## Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-09-06T20:00:00.000Z",
  "version": "1.0.0",
  "github": {
    "connected": true,
    "rateLimit": {
      "remaining": 4985,
      "reset": "2025-09-06T21:00:00.000Z"
    }
  }
}
```

### Docker Stats
```bash
# Resource usage
docker stats ghclassroom-fix

# Inspect container
docker inspect ghclassroom-fix
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs ghclassroom-fix

# Check if port is in use
lsof -i :3000
```

### 401 Unauthorized
- Verify GitHub token is valid
- Check token permissions (needs repo and admin:org)
- Ensure organization name is correct

### Webhook not receiving
- Check firewall rules (port 3000 or 443 if using HTTPS)
- Verify webhook secret matches
- Check GitHub webhook delivery logs

### Out of memory
```bash
# Run with memory limit
docker run -d \
  --name ghclassroom-fix \
  --memory="512m" \
  --memory-swap="1g" \
  ...
```

## Security Best Practices

1. **Use secrets management**
   ```bash
   # Create Docker secret
   echo "ghp_token" | docker secret create github_token -
   ```

2. **Run as non-root user** (already configured in Dockerfile)

3. **Use read-only filesystem**
   ```bash
   docker run --read-only \
     --tmpfs /tmp \
     ...
   ```

4. **Network isolation**
   ```bash
   # Create custom network
   docker network create ghclassroom-net
   
   # Run container in network
   docker run --network ghclassroom-net ...
   ```

5. **Regular updates**
   ```bash
   # Update base image
   docker pull node:20-alpine
   
   # Rebuild application
   docker build --no-cache -t ghclassroom-fix:latest .
   ```

## Support

For issues:
1. Check container logs: `docker logs ghclassroom-fix`
2. Verify environment variables are set correctly
3. Test webhook manually using test script
4. Check GitHub webhook delivery status