# Manual Backend Fix Instructions

Since SSH and EC2 Instance Connect aren't working, here's how to fix the backend manually using AWS Systems Manager:

## Option 1: Use AWS Systems Manager Run Command (Recommended)

### Step 1: Enable Systems Manager
1. Go to AWS Console → IAM → Roles
2. Find role: `sports-hub-ec2-role`
3. Attach policy: `AmazonSSMManagedInstanceCore`
4. Wait 2-3 minutes for instance to register

### Step 2: Use Run Command
1. Go to AWS Console → Systems Manager → Run Command
2. Click "Run command"
3. Select document: `AWS-RunShellScript`
4. Select instance: `i-0bbfbda3cf0b210e7`
5. Paste this script:

```bash
#!/bin/bash
set -e

# Install Node.js 18
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs git unzip
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Install AWS CLI if needed
if ! command -v aws &> /dev/null; then
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

# Download deployment
aws s3 cp s3://sports-hub-deploy-1762143096241/deploy.zip /tmp/deploy.zip
unzip -q -o /tmp/deploy.zip -d .
rm /tmp/deploy.zip

# Install dependencies
npm install --production

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Enable auto-start
sudo pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

# Show status
pm2 status
curl -s http://localhost:4000/health || echo "Health check failed"
```

6. Click "Run"
7. Wait for execution to complete
8. Check output for any errors

### Step 3: Verify
After the command completes:
1. Test endpoint: `http://52.91.16.1:4000/health`
2. Should return JSON with status "ok"

## Option 2: Use Systems Manager Session Manager

1. Go to AWS Console → Systems Manager → Session Manager
2. Click "Start session"
3. Select instance: `i-0bbfbda3cf0b210e7`
4. Click "Start session"
5. This opens a browser-based terminal
6. Run the commands from the script above manually

## Option 3: Create New Instance with Fixed Configuration

If the above don't work, we can create a new instance:

```bash
npm run setup-backend-ec2
```

But first, terminate the old one:
```bash
aws ec2 terminate-instances --instance-ids i-0bbfbda3cf0b210e7 --region us-east-1
```

## Quick Test Commands

Once you have access (via SSM or new instance):

```bash
# Check Node.js
node --version

# Check PM2
pm2 --version

# Check app status
pm2 status
pm2 logs

# Test locally
curl http://localhost:4000/health

# Test from outside
curl http://52.91.16.1:4000/health
```

## Troubleshooting

**If Run Command fails:**
- Check IAM role has `AmazonSSMManagedInstanceCore` policy
- Check instance is running
- Wait 2-3 minutes after attaching IAM policy

**If application doesn't start:**
- Check PM2 logs: `pm2 logs`
- Check if port 4000 is listening: `sudo netstat -tlnp | grep 4000`
- Check deployment package exists: `ls -la /home/ec2-user/sports-hub`

