#!/bin/bash
yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git unzip

# Install PM2
npm install -g pm2

# Create app directory
mkdir -p /home/ec2-user/sports-hub
cd /home/ec2-user/sports-hub

# Download deployment package from S3
aws s3 cp s3://sports-hub-deploy-1762143096241/deploy.zip /tmp/deploy.zip

# Extract
unzip -q /tmp/deploy.zip -d .
rm /tmp/deploy.zip

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

echo "✅ Deployment complete"
