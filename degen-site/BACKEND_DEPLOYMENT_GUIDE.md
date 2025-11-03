# Backend Deployment Guide

## Overview

Your deployment package has been prepared and is ready. Since your AWS user doesn't have EC2 creation permissions, you'll need to either:
1. Request IAM permissions from your AWS administrator
2. Use AWS Console to launch the instance manually
3. Ask your administrator to set up the EC2 instance

## Option 1: Manual EC2 Setup via AWS Console

### Step 1: Launch EC2 Instance

1. Go to AWS Console > EC2 > Instances > Launch Instance
2. Configure:
   - **Name**: `sports-hub-graphql`
   - **AMI**: Amazon Linux 2 (latest)
   - **Instance Type**: `t3.micro` (free tier eligible) or `t3.small`
   - **Key Pair**: Create new or select existing (you'll need the .pem file)
   - **Network Settings**: 
     - Allow SSH (port 22) from your IP
     - Allow HTTP (port 4000) from anywhere (0.0.0.0/0)
   - **Storage**: 8 GB should be enough

### Step 2: Connect to Instance

Once the instance is running:

```bash
ssh -i ~/.ssh/your-key.pem ec2-user@<instance-public-ip>
```

### Step 3: Download and Deploy

On the EC2 instance:

```bash
# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git unzip

# Install PM2
sudo npm install -g pm2

# Download deployment package from S3
aws s3 cp s3://sports-hub-deploy-1762142464593/deploy.zip /home/ec2-user/deploy.zip

# Or if you don't have AWS CLI on EC2, upload via SCP from your local machine:
# (From your local machine, not EC2)
# scp -i ~/.ssh/your-key.pem deploy.zip ec2-user@<instance-ip>:/home/ec2-user/

# Extract and setup
cd /home/ec2-user
unzip -q deploy.zip -d sports-hub
cd sports-hub
npm install --production
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save

# Enable auto-start on boot
sudo pm2 startup systemd -u ec2-user --hp /home/ec2-user
# Run the command that PM2 outputs above

# Check status
pm2 status
pm2 logs
```

### Step 4: Test Endpoint

```bash
# Test health endpoint
curl http://localhost:4000/health

# Test GraphQL endpoint (should return GraphQL playground)
curl http://localhost:4000/graphql
```

From your browser, visit:
- Health: `http://<instance-ip>:4000/health`
- GraphQL: `http://<instance-ip>:4000/graphql`

### Step 5: Update Frontend

Update your frontend `.env` file:

```env
REACT_APP_GRAPHQL_ENDPOINT=http://<instance-ip>:4000/graphql
```

Then rebuild and redeploy:

```bash
npm run build
npm run deploy-frontend
```

## Option 2: Request IAM Permissions

Ask your AWS administrator to grant these permissions to your IAM user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:DescribeInstances",
        "ec2:DescribeVpcs",
        "ec2:DescribeSecurityGroups",
        "ec2:CreateSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:CreateKeyPair",
        "ec2:DescribeKeyPairs",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:CreateInstanceProfile",
        "iam:AddRoleToInstanceProfile"
      ],
      "Resource": "*"
    }
  ]
}
```

Then run:
```bash
npm run setup-backend-ec2
```

## Option 3: Use AWS Elastic Beanstalk (Easier)

### Via Console:

1. Go to AWS Console > Elastic Beanstalk
2. Create new application: `sports-hub-api`
3. Create environment: `Web server environment`
4. Platform: `Node.js`
5. Upload your code:
   - You can zip the entire project (excluding node_modules)
   - Or connect a Git repository
6. Configure:
   - Environment variables:
     - `NODE_ENV=production`
     - `GRAPHQL_PORT=4000`
     - `REACT_APP_ODDS_API_KEY=<your-key>`
     - `REACT_APP_NFL_API_KEY=<your-key>`
   - Health check URL: `/health`
7. Deploy

The endpoint will be something like:
`http://sports-hub-api.us-east-1.elasticbeanstalk.com/graphql`

## Deployment Package Location

- **Local**: `/Users/devmenon/coding/project1/degen-site/deploy.zip`
- **S3**: `s3://sports-hub-deploy-1762142464593/deploy.zip`

## Troubleshooting

### Can't connect via SSH
- Check security group allows port 22 from your IP
- Verify key file permissions: `chmod 400 ~/.ssh/your-key.pem`
- Make sure you're using `ec2-user` as username (not `ubuntu`)

### Application not starting
- Check PM2 logs: `pm2 logs`
- Check if port 4000 is in use: `sudo netstat -tlnp | grep 4000`
- Verify .env file exists and has correct values
- Check Node.js version: `node --version` (should be v18+)

### GraphQL endpoint not accessible
- Check security group allows port 4000 from internet
- Verify application is running: `pm2 status`
- Check EC2 instance has public IP
- Test locally on instance: `curl http://localhost:4000/graphql`

### Data not persisting
- Check `/home/ec2-user/sports-hub/data` directory exists
- Verify PM2 is running as ec2-user (not root)
- Check file permissions: `ls -la /home/ec2-user/sports-hub/data`

## Next Steps After Deployment

1. ✅ Backend deployed and accessible
2. ⏭️ Update frontend `.env` with backend endpoint
3. ⏭️ Rebuild and redeploy frontend
4. ⏭️ Test full application flow
5. ⏭️ Set up custom domain (optional)
6. ⏭️ Enable HTTPS with SSL certificate (recommended for production)

## Cost Estimate

- **EC2 t3.micro**: ~$7-8/month (or free tier for first 12 months)
- **Data transfer**: First 100GB/month free
- **Estimated total**: $0-8/month for development use

