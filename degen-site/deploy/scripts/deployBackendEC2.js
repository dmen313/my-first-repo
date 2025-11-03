#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const INSTANCE_TYPE = process.env.EC2_INSTANCE_TYPE || 't3.micro';
const KEY_NAME = process.env.EC2_KEY_NAME || 'sports-hub-key';
const SECURITY_GROUP_NAME = process.env.SECURITY_GROUP_NAME || 'sports-hub-graphql-sg';

console.log('🚀 AWS Backend Deployment Setup\n');
console.log(`Region: ${REGION}`);
console.log(`Instance Type: ${INSTANCE_TYPE}\n`);

// Check AWS CLI
try {
  execSync('aws --version', { stdio: 'ignore' });
} catch (error) {
  console.error('❌ AWS CLI not found. Please install it first.');
  process.exit(1);
}

async function main() {
  try {
    // Step 1: Create deployment package
    console.log('📦 Creating deployment package...');
    const packageDir = path.join(__dirname, '..', 'deploy-package');
    if (fs.existsSync(packageDir)) {
      execSync(`rm -rf ${packageDir}`, { stdio: 'inherit' });
    }
    fs.mkdirSync(packageDir, { recursive: true });

    // Copy necessary files
    execSync(`cp -r ${path.join(__dirname, '..', 'src')} ${packageDir}/`, { stdio: 'inherit' });
    execSync(`cp -r ${path.join(__dirname, '..', 'scripts')} ${packageDir}/`, { stdio: 'inherit' });
    execSync(`cp ${path.join(__dirname, '..', 'package.json')} ${packageDir}/`, { stdio: 'inherit' });
    execSync(`cp ${path.join(__dirname, '..', 'ecosystem.config.js')} ${packageDir}/`, { stdio: 'inherit' });
    execSync(`mkdir -p ${packageDir}/data`, { stdio: 'inherit' });

    // Create startup script
    const startupScript = `#!/bin/bash
cd /home/ec2-user/sports-hub
npm install
sudo npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup systemd -u ec2-user --hp /home/ec2-user
`;

    fs.writeFileSync(path.join(packageDir, 'start.sh'), startupScript);
    execSync(`chmod +x ${path.join(packageDir, 'start.sh')}`, { stdio: 'inherit' });

    // Create .env file template
    const envTemplate = `NODE_ENV=production
GRAPHQL_PORT=4000
REACT_APP_ODDS_API_KEY=${process.env.REACT_APP_ODDS_API_KEY || ''}
REACT_APP_NFL_API_KEY=${process.env.REACT_APP_NFL_API_KEY || ''}
AWS_REGION=${REGION}
`;

    fs.writeFileSync(path.join(packageDir, '.env.template'), envTemplate);

    // Create user data script for EC2
    const userDataScript = `#!/bin/bash
# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs git

# Create app directory
mkdir -p /home/ec2-user/sports-hub
cd /home/ec2-user/sports-hub

# Install PM2
npm install -g pm2

# The application files will be deployed separately
# This script just sets up the environment

# Create logs directory
mkdir -p logs

# Set permissions
chown -R ec2-user:ec2-user /home/ec2-user/sports-hub
`;

    fs.writeFileSync(path.join(packageDir, 'user-data.sh'), userDataScript);

    console.log('✅ Deployment package created\n');
    console.log('📋 Next Steps:');
    console.log('1. Launch an EC2 instance (t3.micro or t3.small recommended)');
    console.log('2. Use the user-data.sh script in EC2 User Data');
    console.log('3. Configure security group to allow:');
    console.log('   - Port 22 (SSH) from your IP');
    console.log('   - Port 4000 (HTTP) from anywhere (or restrict to S3/CloudFront)');
    console.log('4. SSH into the instance and run:');
    console.log('   - Upload the deploy-package folder');
    console.log('   - Copy files to /home/ec2-user/sports-hub');
    console.log('   - Run: bash start.sh');
    console.log('\nAlternatively, I can create an automated deployment script...\n');

    // Offer to create EC2 instance automatically
    console.log('Would you like me to:');
    console.log('A) Create EC2 instance automatically (requires AWS permissions)');
    console.log('B) Use AWS Elastic Beanstalk (easier, automated)');
    console.log('C) Provide manual setup instructions');
    
    // For now, let's use Elastic Beanstalk as it's easier
    console.log('\n💡 Recommendation: Using AWS Elastic Beanstalk (easiest option)');
    console.log('   This will be handled in a separate script...\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();

