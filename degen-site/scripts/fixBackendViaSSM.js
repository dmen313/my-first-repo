#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const INSTANCE_ID = 'i-0bbfbda3cf0b210e7';
const DEPLOYMENT_BUCKET = 'sports-hub-deploy-1762143096241';

console.log('🔧 Fixing backend deployment via AWS Systems Manager\n');

// Check if SSM agent is available
async function checkSSM() {
  try {
    const result = execSync(`aws ssm describe-instance-information --filters "Key=InstanceIds,Values=${INSTANCE_ID}" --region ${REGION} --query "InstanceInformationList[0].PingStatus" --output text 2>&1`, { encoding: 'utf-8' });
    return result.trim() === 'Online';
  } catch (e) {
    return false;
  }
}

async function main() {
  try {
    // Check SSM status
    console.log('📡 Checking Systems Manager access...');
    const ssmAvailable = await checkSSM();
    
    if (!ssmAvailable) {
      console.log('⚠️  SSM agent not available. Setting up...\n');
      console.log('To enable SSM Session Manager:');
      console.log('1. The instance needs IAM role with AmazonSSMManagedInstanceCore policy');
      console.log('2. SSM agent comes pre-installed on Amazon Linux 2\n');
      console.log('Let\'s check and fix the IAM role...\n');
      
      // Attach SSM policy to existing role
      const roleName = 'sports-hub-ec2-role';
      try {
        execSync(`aws iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`, { stdio: 'inherit' });
        console.log('✅ Attached SSM policy to IAM role');
        console.log('⏳ Wait 1-2 minutes for the instance to register with SSM, then try again.\n');
        return;
      } catch (e) {
        console.log('❌ Could not attach SSM policy. You may need to:');
        console.log('   1. Manually attach AmazonSSMManagedInstanceCore policy to sports-hub-ec2-role');
        console.log('   2. Or create a new instance with SSM enabled\n');
        return;
      }
    }
    
    console.log('✅ SSM agent is online!\n');
    
    // Create deployment script
    const deployScript = `#!/bin/bash
set -e

echo "🔧 Starting backend deployment fix..."

# Install Node.js 18 if needed
if ! command -v node &> /dev/null || ! node --version | grep -q "v18"; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs git unzip
fi

# Install PM2 if needed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

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
aws s3 cp s3://${DEPLOYMENT_BUCKET}/deploy.zip /tmp/deploy.zip

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

# Enable auto-start
echo "⚙️  Setting up auto-start..."
sudo pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

echo ""
echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status
echo ""
echo "📝 Testing health endpoint..."
curl -s http://localhost:4000/health || echo "⚠️  Health endpoint not responding yet"
`;

    // Save script to temp file
    const scriptPath = '/tmp/deploy-fix.sh';
    fs.writeFileSync(scriptPath, deployScript);
    execSync(`chmod +x ${scriptPath}`);
    
    // Upload script to instance
    console.log('📤 Uploading deployment script to instance...');
    execSync(`aws ssm send-command --instance-ids ${INSTANCE_ID} --document-name "AWS-RunShellScript" --parameters "commands=['bash ${scriptPath}']" --region ${REGION} --output text --query "Command.CommandId"`, { stdio: 'inherit' });
    
    // Actually, better approach - send commands directly
    console.log('\n📤 Sending deployment commands via SSM...');
    
    const commands = deployScript.split('\n').filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('echo'));
    
    const commandParams = {
      commands: deployScript.split('\n').filter(line => line.trim())
    };
    
    const paramsFile = '/tmp/ssm-params.json';
    fs.writeFileSync(paramsFile, JSON.stringify(commandParams));
    
    const commandId = execSync(`aws ssm send-command --instance-ids ${INSTANCE_ID} --document-name "AWS-RunShellScript" --parameters file://${paramsFile} --region ${REGION} --output text --query "Command.CommandId"`, { encoding: 'utf-8' }).trim();
    
    console.log(`✅ Command sent! Command ID: ${commandId}`);
    console.log('\n⏳ Waiting 30 seconds for command to execute...');
    
    await new Promise(r => setTimeout(r, 30000));
    
    // Get command output
    console.log('\n📋 Command Output:');
    execSync(`aws ssm get-command-invocation --command-id ${commandId} --instance-id ${INSTANCE_ID} --region ${REGION} --query "[Status,StandardOutputContent,StandardErrorContent]" --output text`, { stdio: 'inherit' });
    
    fs.unlinkSync(paramsFile);
    fs.unlinkSync(scriptPath);
    
    console.log('\n✅ Deployment fix complete!');
    console.log('🌐 Backend should be available at: http://52.91.16.1:4000/graphql');
    console.log('🏥 Health check: http://52.91.16.1:4000/health\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Alternative: Use AWS Console → Systems Manager → Run Command');
    process.exit(1);
  }
}

main();

