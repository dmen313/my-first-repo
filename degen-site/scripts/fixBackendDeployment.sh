#!/bin/bash
# Manual deployment script to fix the backend

INSTANCE_IP="52.91.16.1"
KEY_FILE="$HOME/.ssh/sports-hub-key.pem"
DEPLOYMENT_BUCKET="sports-hub-deploy-1762143096241"

echo "🔧 Fixing backend deployment on EC2 instance..."

# Upload deployment package
echo "📤 Uploading deployment package..."
scp -i "$KEY_FILE" deploy.zip ec2-user@$INSTANCE_IP:/tmp/deploy.zip

# SSH and deploy
ssh -i "$KEY_FILE" ec2-user@$INSTANCE_IP << 'ENDSSH'
set -e

echo "📦 Setting up environment..."

# Install Node.js 18 if not installed
if ! command -v node &> /dev/null || ! node --version | grep -q "v18"; then
    echo "Installing Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs git unzip
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install AWS CLI if not installed
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip"
    unzip -q /tmp/awscliv2.zip -d /tmp
    sudo /tmp/aws/install
fi

# Create app directory
mkdir -p /home/ec2-user/sports-hub
cd /home/ec2-user/sports-hub

# Stop existing processes
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Extract deployment package
echo "📦 Extracting deployment package..."
if [ -f /tmp/deploy.zip ]; then
    unzip -q -o /tmp/deploy.zip -d .
    rm /tmp/deploy.zip
else
    echo "⚠️  Deploy zip not found, trying to download from S3..."
    # Get the latest deployment bucket
    LATEST_BUCKET=$(aws s3 ls | grep "sports-hub-deploy" | sort | tail -1 | awk '{print $3}')
    if [ -n "$LATEST_BUCKET" ]; then
        echo "Downloading from s3://$LATEST_BUCKET/deploy.zip"
        aws s3 cp s3://$LATEST_BUCKET/deploy.zip /tmp/deploy.zip
        unzip -q -o /tmp/deploy.zip -d .
        rm /tmp/deploy.zip
    else
        echo "❌ Could not find deployment package. Please upload deploy.zip manually."
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create logs directory
mkdir -p logs

# Start with PM2
echo "🚀 Starting GraphQL server..."
pm2 start ecosystem.config.js
pm2 save

# Enable auto-start
echo "⚙️  Setting up auto-start..."
sudo pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

# Check status
echo ""
echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "📝 Recent logs:"
pm2 logs --lines 20 --nostream

ENDSSH

echo ""
echo "✅ Deployment fix complete!"
echo "🌐 Backend should be available at: http://$INSTANCE_IP:4000/graphql"
echo "🏥 Health check: http://$INSTANCE_IP:4000/health"

