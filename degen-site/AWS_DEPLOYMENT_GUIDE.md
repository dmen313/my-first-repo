# AWS Deployment Guide

This guide provides multiple options for deploying your Sports Hub application to AWS, from simple to production-ready solutions.

## Application Architecture

- **Frontend**: React application (build output: static files)
- **Backend**: Node.js GraphQL server (Express + Apollo Server)
- **Data Storage**: File-based JSON store (`data/datastore.json`)
- **External APIs**: The Odds API (requires API key)

---

## Option 1: Simple & Cost-Effective (Recommended for MVP)

**Best for**: Personal projects, low traffic, cost-conscious deployments

### Architecture
- **Frontend**: AWS S3 + CloudFront
- **Backend**: AWS EC2 (t3.micro or t3.small) or Elastic Beanstalk
- **Storage**: EFS (Elastic File System) for persistent data

### Steps

#### 1. Frontend Deployment (S3 + CloudFront)

```bash
# Build the React app
npm run build

# Install AWS CLI if not already installed
# aws configure (set up your credentials)

# Create S3 bucket
aws s3 mb s3://your-sports-hub-app

# Upload build files
aws s3 sync build/ s3://your-sports-hub-app --delete

# Enable static website hosting
aws s3 website s3://your-sports-hub-app --index-document index.html --error-document index.html

# Create CloudFront distribution (optional but recommended)
# Use AWS Console: CloudFront > Create Distribution
# Origin: your S3 bucket
# Default root object: index.html
# Error pages: redirect 403/404 to /index.html (for React Router)
```

**Important**: Update your frontend `.env` to point to your backend:
```env
REACT_APP_GRAPHQL_ENDPOINT=https://your-api-domain.com/graphql
```

#### 2. Backend Deployment (EC2)

**Option A: Manual EC2 Setup**

```bash
# Launch EC2 instance (Amazon Linux 2)
# Instance type: t3.micro (free tier eligible) or t3.small

# SSH into instance
ssh -i your-key.pem ec2-user@your-instance-ip

# Install Node.js (using NodeSource)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install git
sudo yum install -y git

# Clone your repository
git clone https://github.com/yourusername/degen-site.git
cd degen-site

# Install dependencies
npm install

# Set up environment variables
nano .env
# Add:
# REACT_APP_ODDS_API_KEY=your_api_key
# REACT_APP_GRAPHQL_ENDPOINT=https://your-domain.com/graphql
# GRAPHQL_PORT=4000

# Set up EFS for persistent storage (optional but recommended)
# Mount EFS volume to /home/ec2-user/degen-site/data
# Follow AWS EFS setup guide

# Install PM2 for process management
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'graphql-server',
    script: 'scripts/startGraphQLServer.js',
    env: {
      NODE_ENV: 'production',
      GRAPHQL_PORT: 4000
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start on reboot

# Configure security group to allow:
# - Port 4000 from CloudFront or your frontend domain
# - Port 22 for SSH
```

**Option B: Elastic Beanstalk (Easier)**

```bash
# Install EB CLI
pip install awsebcli

# Initialize EB
eb init -p node.js-18 -r us-east-1 sports-hub-api

# Create environment
eb create sports-hub-api-prod

# Set environment variables
eb setenv REACT_APP_ODDS_API_KEY=your_key GRAPHQL_PORT=4000

# Deploy
eb deploy
```

#### 3. Set Up Reverse Proxy (Nginx) - Recommended

On your EC2 instance:

```bash
# Install Nginx
sudo yum install -y nginx

# Configure Nginx
sudo nano /etc/nginx/conf.d/graphql.conf
```

Add:
```nginx
server {
    listen 80;
    server_name your-api-domain.com;

    location /graphql {
        proxy_pass http://localhost:4000;
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

```bash
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 4. SSL Certificate (HTTPS) - Required for Production

Use AWS Certificate Manager (ACM) with Application Load Balancer or CloudFront.

**For API (with ALB):**
1. Request certificate in ACM
2. Create Application Load Balancer
3. Add HTTPS listener with your certificate
4. Target Group → EC2 instance:4000

**For Frontend (CloudFront):**
1. Request certificate in ACM (us-east-1 region required for CloudFront)
2. In CloudFront distribution settings, add certificate

---

## Option 2: Production-Ready (Scalable)

**Best for**: Production applications with traffic, need for scaling

### Architecture
- **Frontend**: AWS Amplify or S3 + CloudFront
- **Backend**: AWS ECS (Fargate) or App Runner
- **Database**: AWS RDS (PostgreSQL) or DynamoDB
- **Storage**: S3 for file backups
- **CI/CD**: GitHub Actions or AWS CodePipeline

### Steps

#### 1. Migrate from File Storage to Database

**Option A: PostgreSQL (RDS)**

```bash
# Install pg package
npm install pg

# Create migration script to move data from JSON to PostgreSQL
# Update dataStore.js to use PostgreSQL instead of file system
```

**Option B: DynamoDB** (NoSQL, easier migration)

```bash
# Install AWS SDK
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb

# Create tables for teams, achievements, payouts, etc.
# Update dataStore.js to use DynamoDB
```

#### 2. Backend with ECS Fargate

**Create Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 4000

# Start server
CMD ["node", "scripts/startGraphQLServer.js"]
```

**Build and push to ECR:**

```bash
# Create ECR repository
aws ecr create-repository --repository-name sports-hub-api

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and tag
docker build -t sports-hub-api .
docker tag sports-hub-api:latest YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/sports-hub-api:latest

# Push
docker push YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/sports-hub-api:latest
```

**Create ECS Task Definition and Service** (use AWS Console or Terraform)

#### 3. Frontend with AWS Amplify

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Initialize Amplify
amplify init

# Add hosting
amplify add hosting

# Publish
amplify publish
```

**Or use Amplify Console:**
1. Connect your GitHub repository
2. Build settings: Use `npm run build`
3. Output directory: `build`
4. Add environment variables

---

## Option 3: Serverless (Lambda + API Gateway)

**Best for**: Very cost-effective, auto-scaling, minimal maintenance

### Architecture
- **Frontend**: S3 + CloudFront
- **Backend**: AWS Lambda + API Gateway
- **Database**: DynamoDB (perfect for serverless)

**Note**: Requires refactoring GraphQL server to work with Lambda. Consider using `apollo-server-lambda`:

```javascript
import { ApolloServer } from 'apollo-server-lambda';
// ... rest of setup
export const handler = server.createHandler();
```

---

## Environment Variables Setup

### AWS Systems Manager Parameter Store (Recommended)

```bash
# Store secrets
aws ssm put-parameter \
  --name "/sports-hub/odds-api-key" \
  --value "your_api_key" \
  --type "SecureString"

# In your application
aws ssm get-parameter --name "/sports-hub/odds-api-key" --with-decryption
```

### AWS Secrets Manager (For production)

```bash
aws secretsmanager create-secret \
  --name sports-hub/odds-api-key \
  --secret-string "your_api_key"
```

---

## CI/CD Setup

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - name: Deploy to S3
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: aws s3 sync build/ s3://your-sports-hub-app --delete
      - run: aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Elastic Beanstalk
        uses: einaregilsson/beanstalk-deploy@v22
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: sports-hub-api
          environment_name: sports-hub-api-prod
          version_label: ${{ github.sha }}
          region: us-east-1
```

---

## Cost Estimates (Monthly)

### Option 1 (EC2 + S3):
- EC2 t3.micro: ~$8-10/month (free tier: $0 first year)
- S3 storage: ~$0.023/GB
- CloudFront: ~$0.085/GB data transfer
- EFS (optional): ~$0.30/GB
- **Total**: ~$10-20/month (after free tier)

### Option 2 (ECS Fargate + RDS):
- ECS Fargate: ~$15-30/month (depending on usage)
- RDS db.t3.micro: ~$15/month
- S3 + CloudFront: ~$5/month
- **Total**: ~$35-50/month

### Option 3 (Lambda + DynamoDB):
- Lambda: Pay per request (~$0.20 per 1M requests)
- DynamoDB: On-demand ~$1.25 per million reads
- API Gateway: ~$3.50 per million requests
- S3 + CloudFront: ~$5/month
- **Total**: ~$5-20/month (depends on traffic)

---

## Security Best Practices

1. **Never commit API keys** - Use Parameter Store or Secrets Manager
2. **Enable HTTPS everywhere** - Use ACM certificates
3. **Restrict security groups** - Only allow necessary ports
4. **Use IAM roles** - Don't use root credentials
5. **Enable CloudWatch logging** - Monitor errors and access
6. **Set up VPC** - Isolate backend resources (Option 2)
7. **Enable WAF** - Protect against common attacks (CloudFront)

---

## Monitoring & Logging

### CloudWatch Setup

```javascript
// In your GraphQL server
import CloudWatchLogs from 'aws-sdk/clients/cloudwatchlogs';

const logGroup = '/aws/ec2/sports-hub-graphql';
// Configure logging
```

### Health Checks

Add health check endpoint:

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## Recommended First Steps

1. **Start with Option 1 (EC2 + S3)** - Easiest to set up
2. **Set up domain name** - Use Route 53 or external provider
3. **Enable HTTPS** - Required for production
4. **Set up monitoring** - CloudWatch basic metrics
5. **Backup strategy** - Regular EFS snapshots or S3 backups
6. **Scale up later** - Move to ECS/DynamoDB when needed

---

## Troubleshooting

### GraphQL endpoint not accessible
- Check security group allows port 4000
- Verify CORS settings
- Check CloudFront origin settings

### Data not persisting
- Verify EFS is mounted correctly
- Check file permissions on data directory
- Ensure PM2 or your process manager restarts properly

### Build fails
- Check Node.js version (18+ required)
- Verify all dependencies in package.json
- Check build logs in CloudWatch or GitHub Actions

---

## Additional Resources

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS Elastic Beanstalk Guide](https://docs.aws.amazon.com/elasticbeanstalk/)
- [AWS Amplify Documentation](https://docs.amplify.aws/)
- [Apollo Server AWS Lambda](https://www.apollographql.com/docs/apollo-server/deployment/lambda/)

---

## Quick Start Checklist

- [ ] AWS account created
- [ ] IAM user with appropriate permissions
- [ ] AWS CLI configured
- [ ] Domain name purchased (optional but recommended)
- [ ] API keys secured (Parameter Store/Secrets Manager)
- [ ] Frontend built and deployed to S3
- [ ] Backend deployed to EC2/EB/ECS
- [ ] HTTPS enabled (ACM certificate)
- [ ] Monitoring set up (CloudWatch)
- [ ] Backup strategy in place
- [ ] CI/CD pipeline configured

Good luck with your deployment! 🚀

