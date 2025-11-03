# Fixed Backend Deployment Script (Amazon Linux 2 Compatible)

The previous script failed because Node.js 18 requires glibc 2.28, but Amazon Linux 2 has glibc 2.26. This script uses NVM to install Node.js, which handles compatibility better.

## Use This Script in AWS Systems Manager Run Command

1. Go to AWS Console → Systems Manager → Run Command
2. Click "Run command"
3. Select document: `AWS-RunShellScript`
4. Select instance: `i-0bbfbda3cf0b210e7`
5. Paste this complete script:

```bash
#!/bin/bash
set -e

echo "🔧 Deploying backend with compatible Node.js version..."

# Install NVM (Node Version Manager)
if [ ! -d "$HOME/.nvm" ]; then
    echo "📦 Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js 18 using NVM
echo "📦 Installing Node.js 18 via NVM..."
nvm install 18
nvm use 18
nvm alias default 18

# Verify installation
node --version
npm --version

# Install PM2 globally
echo "📦 Installing PM2..."
npm install -g pm2

# Install git and unzip
sudo yum install -y git unzip

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

# Setup PM2 startup with NVM path
echo "⚙️  Setting up auto-start..."
NODE_PATH=$(which node | sed 's|/bin/node||')
sudo env PATH=$PATH:$NODE_PATH/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

echo ""
echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "📝 Testing health endpoint..."
sleep 5
curl -s http://localhost:4000/health || echo "⚠️  Health endpoint not responding yet"
```

6. Click "Run"
7. Wait for execution (takes 3-5 minutes)
8. Check the output - you should see:
   - Node.js version installed
   - PM2 status showing running app
   - Health check response

## After Running

Test the endpoint:
```bash
curl http://52.91.16.1:4000/health
```

Should return: `{"status":"ok","timestamp":"...","uptime":...,"service":"graphql-server"}`

## Alternative: Use Node.js 16 (Also Compatible)

If NVM doesn't work, you can use Node.js 16 which is compatible with glibc 2.26. Just replace the NVM install line with:

```bash
# Use Node.js 16 instead
nvm install 16
nvm use 16
nvm alias default 16
```

