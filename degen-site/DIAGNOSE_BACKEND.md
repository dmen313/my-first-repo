# Backend Deployment Diagnosis

## Current Status

**Instance**: `i-0bbfbda3cf0b210e7`  
**IP**: `52.91.16.1`  
**Status**: Running  
**Issue**: Backend not responding, SSH access failing

## Diagnosis Steps

### 1. Check Instance Status in AWS Console

1. Go to AWS Console → EC2 → Instances
2. Find instance `i-0bbfbda3cf0b210e7`
3. Check:
   - Instance state (should be "running")
   - Status checks (should show 2/2 checks passed)
   - Security group rules (ports 22 and 4000 should be open)
   - Key pair name (should match `sports-hub-key`)

### 2. Check Security Group

The security group `sg-0e2846e6555bdce30` should allow:
- **Port 22 (SSH)**: From your IP or 0.0.0.0/0
- **Port 4000 (HTTP)**: From 0.0.0.0/0

If these rules are missing, add them in the EC2 Console.

### 3. Check User Data Execution

The instance should have executed user-data script on first boot. To check:

1. Go to EC2 Console → Instance → `i-0bbfbda3cf0b210e7`
2. Click "Actions" → "Instance settings" → "Get system log"
3. Look for:
   - Node.js installation messages
   - PM2 installation
   - Application startup messages
   - Any error messages

### 4. Manual SSH Access

Try connecting via AWS Console:

1. Go to EC2 Console → Instances
2. Select the instance
3. Click "Connect" button
4. Try "EC2 Instance Connect" (browser-based SSH)
5. Or use "Session Manager" if enabled

### 5. Common Issues & Fixes

#### Issue: User Data Script Failed

**Symptoms**: Application not running, no PM2 processes

**Fix**: 
```bash
# SSH into instance and manually run:
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git unzip
sudo npm install -g pm2

# Download and extract deployment
cd /home/ec2-user
wget https://s3.amazonaws.com/sports-hub-deploy-*/deploy.zip
unzip deploy.zip -d sports-hub
cd sports-hub
npm install --production
pm2 start ecosystem.config.js
pm2 save
```

#### Issue: Port 4000 Not Accessible

**Symptoms**: Connection refused on port 4000

**Fix**:
1. Check security group allows port 4000
2. Check if app is running: `pm2 status`
3. Check if port is listening: `sudo netstat -tlnp | grep 4000`
4. Check firewall: `sudo iptables -L`

#### Issue: Application Crashed

**Symptoms**: PM2 shows "errored" or "stopped"

**Fix**:
```bash
pm2 logs  # Check error logs
pm2 restart graphql-server
pm2 save
```

### 6. Alternative: Use AWS Systems Manager Session Manager

If SSH isn't working, enable Session Manager:

1. Go to EC2 Console → Instances → Select instance
2. Click "Actions" → "Security" → "Modify IAM role"
3. Attach IAM role with `AmazonSSMManagedInstanceCore` policy
4. Wait a few minutes
5. Go to Systems Manager → Session Manager → Start session

### 7. Manual Deployment Script

If you can access the instance, run the fix script:

```bash
# From your local machine:
cd /Users/devmenon/coding/project1/degen-site
./scripts/fixBackendDeployment.sh
```

Or manually upload and deploy:

```bash
# Upload deployment package
scp -i ~/.ssh/sports-hub-key.pem deploy.zip ec2-user@52.91.16.1:/tmp/

# SSH in and deploy
ssh -i ~/.ssh/sports-hub-key.pem ec2-user@52.91.16.1
# Then follow the manual deployment steps above
```

## Quick Test Commands

Once you can access the instance:

```bash
# Check if Node.js is installed
node --version

# Check if PM2 is installed
pm2 --version

# Check application status
pm2 status
pm2 logs

# Check if port 4000 is listening
sudo netstat -tlnp | grep 4000

# Test health endpoint locally
curl http://localhost:4000/health
```

## Next Steps

1. ✅ Check AWS Console for instance status
2. ✅ Verify security group rules
3. ✅ Check system logs for user-data execution
4. ✅ Try EC2 Instance Connect or Session Manager
5. ✅ Manually deploy if user-data failed

Let me know what you find in the AWS Console and we can troubleshoot further!

