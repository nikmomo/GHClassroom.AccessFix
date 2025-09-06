#!/bin/bash

# Docker Installation and Deployment Script for Debian/Ubuntu
# This script will install Docker and deploy the GitHub Classroom Access Fixer

set -e

echo "========================================="
echo "GitHub Classroom Access Fixer Deployment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Install Docker
echo -e "${GREEN}Step 1: Installing Docker...${NC}"

# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

echo -e "${GREEN}✓ Docker installed successfully!${NC}"

# Step 2: Load Docker image (if exists)
if [ -f "ghclassroom-fix.tar.gz" ]; then
    echo -e "${GREEN}Step 2: Loading Docker image...${NC}"
    sudo docker load < ghclassroom-fix.tar.gz
    echo -e "${GREEN}✓ Docker image loaded!${NC}"
else
    echo -e "${YELLOW}No Docker image found. You'll need to build or pull it.${NC}"
fi

# Step 3: Create environment file
echo -e "${GREEN}Step 3: Creating environment configuration...${NC}"

cat > .env.production << 'EOF'
# GitHub Configuration
GITHUB_TOKEN=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
GITHUB_ORG=VTECE
WEBHOOK_SECRET=your_webhook_secret_12345

# Server Configuration
PORT=3000
NODE_ENV=production

# Features
DRY_RUN=false
AUTO_ADD_COLLABORATOR=true
DEFAULT_PERMISSION=push

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
EOF

echo -e "${GREEN}✓ Environment file created!${NC}"

# Step 4: Create systemd service
echo -e "${GREEN}Step 4: Creating systemd service...${NC}"

sudo tee /etc/systemd/system/ghclassroom-fix.service > /dev/null << 'EOF'
[Unit]
Description=GitHub Classroom Access Fixer
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
User=root
ExecStartPre=-/usr/bin/docker stop ghclassroom-fix
ExecStartPre=-/usr/bin/docker rm ghclassroom-fix
ExecStart=/usr/bin/docker run \
  --name ghclassroom-fix \
  --rm \
  -p 3000:3000 \
  --env-file /home/shin_z/ghclassroom-fix/.env.production \
  ghclassroom-fix:latest
ExecStop=/usr/bin/docker stop ghclassroom-fix

[Install]
WantedBy=multi-user.target
EOF

# Update the service file with correct home directory
sudo sed -i "s|/home/shin_z|$HOME|g" /etc/systemd/system/ghclassroom-fix.service

echo -e "${GREEN}✓ Systemd service created!${NC}"

# Step 5: Install Nginx for reverse proxy (optional)
echo -e "${YELLOW}Step 5: Installing Nginx for reverse proxy...${NC}"
read -p "Do you want to install Nginx for HTTPS support? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    sudo apt-get install -y nginx certbot python3-certbot-nginx
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/ghclassroom-fix > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

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

    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF
    
    # Enable the site
    sudo ln -sf /etc/nginx/sites-available/ghclassroom-fix /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl restart nginx
    
    echo -e "${GREEN}✓ Nginx installed and configured!${NC}"
fi

# Step 6: Start the service
echo -e "${GREEN}Step 6: Starting the service...${NC}"

# Check if we need to relogin for docker group
if ! groups | grep -q docker; then
    echo -e "${YELLOW}Note: You need to log out and back in for docker group changes to take effect.${NC}"
    echo -e "${YELLOW}For now, we'll use sudo to run docker commands.${NC}"
fi

# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl enable ghclassroom-fix

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. If you have the Docker image file (ghclassroom-fix.tar.gz):"
echo "   sudo docker load < ghclassroom-fix.tar.gz"
echo ""
echo "2. Or build from source:"
echo "   git clone https://github.com/yourusername/GHClassroom.AccessFix.git"
echo "   cd GHClassroom.AccessFix"
echo "   sudo docker build -t ghclassroom-fix:latest ."
echo ""
echo "3. Start the service:"
echo "   sudo systemctl start ghclassroom-fix"
echo "   sudo systemctl status ghclassroom-fix"
echo ""
echo "4. Check logs:"
echo "   sudo journalctl -u ghclassroom-fix -f"
echo ""
echo "5. Test the service:"
echo "   curl http://localhost:3000/health"
echo ""
echo "6. Configure GitHub webhook:"
echo "   URL: http://YOUR_SERVER_IP:3000/webhook/github"
echo "   or with Nginx: http://YOUR_SERVER_IP/webhook/github"
echo ""
echo -e "${YELLOW}Important: Update the .env.production file with your actual GitHub token if needed!${NC}"