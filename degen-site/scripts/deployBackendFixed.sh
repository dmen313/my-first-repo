#!/bin/bash
# Fixed deployment script compatible with Amazon Linux 2 (glibc 2.26)

set -e

echo "🔧 Deploying backend with compatible Node.js version..."

# Install NVM (Node Version Manager) for better compatibility
if [ ! -d "$HOME/.nvm" ]; then
    echo "📦 Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 18 using NVM (handles dependencies better)
echo "📦 Installing Node.js 18 via NVM..."
nvm install 18
nvm use 18
nvm alias default 18

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install git and unzip if needed
sudo yum install -y git unzip || true

# Install AWS CLI if needed
if ! command -v aws &> /dev/null; then
    echo "📦 Installing AWS CLI..."
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

# Download deployment package
echo "📥 Downloading deployment package..."
DEPLOYMENT_BUCKET=$(aws s3 ls | grep "sports-hub-deploy" | sort | tail -1 | awk '{print $3}')
if [ -z "$DEPLOYMENT_BUCKET" ]; then
    DEPLOYMENT_BUCKET="sports-hub-deploy-1762143096241"
fi

echo "Using bucket: $DEPLOYMENT_BUCKET"
aws s3 cp s3://$DEPLOYMENT_BUCKET/deploy.zip /tmp/deploy.zip

# Extract
echo "📦 Extracting..."
unzip -q -o /tmp/deploy.zip -d .
rm /tmp/deploy.zip

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create logs directory
mkdir -p logs

# Start with PM2
echo "🚀 Starting GraphQL server..."
pm2 start ecosystem.config.js
pm2 save

# Enable auto-start (need to source nvm in startup script)
echo "⚙️  Setting up auto-start..."
# Create a wrapper script that sources nvm
cat > /home/ec2-user/start-app.sh << 'EOF'
#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /home/ec2-user/sports-hub
pm2 resurrect
EOF
chmod +x /home/ec2-user/start-app.sh

# Setup PM2 startup
sudo env PATH=$PATH:$HOME/.nvm/versions/node/$(node -v)/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

echo ""
echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Testing health endpoint..."
sleep 3
curl -s http://localhost:4000/health || echo "⚠️  Health endpoint not responding yet (may take a few seconds)"

