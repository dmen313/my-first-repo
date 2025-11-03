#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const REGION = process.env.AWS_REGION || 'us-east-1';
const INSTANCE_TYPE = process.env.EC2_INSTANCE_TYPE || 't3.micro';
const KEY_NAME = process.env.EC2_KEY_NAME;
const SECURITY_GROUP_NAME = process.env.SECURITY_GROUP_NAME || 'sports-hub-graphql-sg';

console.log('🚀 Deploying GraphQL Backend to AWS EC2\n');
console.log(`Region: ${REGION}`);
console.log(`Instance Type: ${INSTANCE_TYPE}\n`);

if (!KEY_NAME) {
  console.error('❌ Error: EC2_KEY_NAME environment variable is required');
  console.error('   Set it in .env file: EC2_KEY_NAME=your-key-name');
  console.error('   Or create a new key pair first');
  process.exit(1);
}

async function main() {
  try {
    // Step 1: Create deployment package
    console.log('📦 Creating deployment package...');
    const packageDir = path.join(__dirname, '..', 'deploy');
    if (fs.existsSync(packageDir)) {
      execSync(`rm -rf ${packageDir}`, { stdio: 'ignore' });
    }
    fs.mkdirSync(packageDir, { recursive: true });

    // Copy necessary files
    const filesToCopy = [
      'src',
      'scripts',
      'package.json',
      'ecosystem.config.js'
    ];

    filesToCopy.forEach(file => {
      const src = path.join(__dirname, '..', file);
      const dest = path.join(packageDir, file);
      if (fs.existsSync(src)) {
        if (fs.statSync(src).isDirectory()) {
          execSync(`cp -r "${src}" "${dest}"`, { stdio: 'ignore' });
        } else {
          fs.copyFileSync(src, dest);
        }
      }
    });

    // Create data directory
    fs.mkdirSync(path.join(packageDir, 'data'), { recursive: true });

    // Create .env file for production
    const envContent = `NODE_ENV=production
GRAPHQL_PORT=4000
REACT_APP_ODDS_API_KEY=${process.env.REACT_APP_ODDS_API_KEY || ''}
REACT_APP_NFL_API_KEY=${process.env.REACT_APP_NFL_API_KEY || ''}
AWS_REGION=${REGION}
`;

    fs.writeFileSync(path.join(packageDir, '.env'), envContent);

    // Create deployment script
    const deployScript = `#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Install Node.js 18 if not already installed
if ! command -v node &> /dev/null || ! node --version | grep -q "v18"; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Install git if needed
if ! command -v git &> /dev/null; then
    sudo yum install -y git
fi

# Navigate to app directory
cd /home/ec2-user/sports-hub || (mkdir -p /home/ec2-user/sports-hub && cd /home/ec2-user/sports-hub)

# Stop existing PM2 processes
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Extract deployment package (if uploaded as zip)
if [ -f /tmp/sports-hub-deploy.zip ]; then
    echo "📦 Extracting deployment package..."
    unzip -q -o /tmp/sports-hub-deploy.zip -d .
    rm /tmp/sports-hub-deploy.zip
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Create logs directory
mkdir -p logs

# Start application with PM2
echo "🚀 Starting GraphQL server..."
pm2 start ecosystem.config.js
pm2 save

# Set up PM2 to start on boot
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user | grep "sudo" | bash || true

echo "✅ Deployment complete!"
echo "🌐 GraphQL endpoint will be available at: http://\$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):4000/graphql"
`;

    fs.writeFileSync(path.join(packageDir, 'deploy.sh'), deployScript);
    execSync(`chmod +x ${path.join(packageDir, 'deploy.sh')}`, { stdio: 'ignore' });

    // Create zip file
    console.log('📦 Creating deployment zip...');
    const zipPath = path.join(__dirname, '..', 'deploy-package.zip');
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`✅ Deployment package created: ${zipPath} (${archive.pointer()} bytes)\n`);
        resolve();
      });

      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(packageDir, false);
      archive.finalize();
    }).then(() => {
      // Step 2: Find or create EC2 instance
      console.log('🔍 Checking for existing EC2 instance...');
      
      try {
        // Try to find existing instance
        const instances = JSON.parse(execSync(`aws ec2 describe-instances --region ${REGION} --filters "Name=tag:Name,Values=sports-hub-graphql" "Name=instance-state-name,Values=running,stopped" --query "Reservations[*].Instances[*].[InstanceId,PublicIpAddress,State.Name]" --output json`, { encoding: 'utf-8' }));
        
        if (instances && instances.length > 0 && instances[0].length > 0) {
          const [instanceId, publicIp, state] = instances[0][0];
          console.log(`Found existing instance: ${instanceId} (${state})`);
          
          if (state === 'stopped') {
            console.log('Starting instance...');
            execSync(`aws ec2 start-instances --instance-ids ${instanceId} --region ${REGION}`, { stdio: 'inherit' });
            console.log('Waiting for instance to start...');
            execSync(`aws ec2 wait instance-running --instance-ids ${instanceId} --region ${REGION}`, { stdio: 'inherit' });
            
            // Get new IP
            const newInstances = JSON.parse(execSync(`aws ec2 describe-instances --instance-ids ${instanceId} --region ${REGION} --query "Reservations[*].Instances[*].PublicIpAddress" --output json`, { encoding: 'utf-8' }));
            const newIp = newInstances[0][0];
            console.log(`✅ Instance started. Public IP: ${newIp}\n`);
            
            deployToInstance(newIp, zipPath);
          } else {
            console.log(`✅ Instance is running. Public IP: ${publicIp || 'Getting...'}\n`);
            const currentIp = publicIp || JSON.parse(execSync(`aws ec2 describe-instances --instance-ids ${instanceId} --region ${REGION} --query "Reservations[*].Instances[*].PublicIpAddress" --output json`, { encoding: 'utf-8' }))[0][0];
            deployToInstance(currentIp, zipPath);
          }
        } else {
          console.log('No existing instance found. Creating new instance...\n');
          createAndDeployInstance(zipPath);
        }
      } catch (error) {
        console.log('Creating new instance...\n');
        createAndDeployInstance(zipPath);
      }
    });

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure AWS CLI is configured');
    console.error('   2. Check IAM permissions for EC2');
    console.error('   3. Verify key pair exists');
    process.exit(1);
  }
}

function createAndDeployInstance(zipPath) {
  console.log('🚀 This requires manual setup. Here are the steps:\n');
  console.log('1. Launch an EC2 instance:');
  console.log('   - Instance type: t3.micro (free tier)');
  console.log('   - AMI: Amazon Linux 2');
  console.log('   - Key pair: ' + KEY_NAME);
  console.log('   - Security group: Allow ports 22 (SSH) and 4000 (HTTP)');
  console.log('   - User data: (see user-data.sh in deploy directory)\n');
  
  console.log('2. After instance is running, upload the deployment package:');
  console.log(`   scp -i ~/.ssh/${KEY_NAME}.pem ${zipPath} ec2-user@<instance-ip>:/tmp/sports-hub-deploy.zip\n`);
  
  console.log('3. SSH into the instance and deploy:');
  console.log(`   ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@<instance-ip>`);
  console.log('   unzip /tmp/sports-hub-deploy.zip -d /home/ec2-user/sports-hub');
  console.log('   cd /home/ec2-user/sports-hub');
  console.log('   bash deploy.sh\n');
  
  console.log('4. Your GraphQL endpoint will be:');
  console.log('   http://<instance-ip>:4000/graphql\n');
}

function deployToInstance(ip, zipPath) {
  console.log(`📤 Deploying to instance at ${ip}...`);
  console.log('\n⚠️  Automatic deployment requires:');
  console.log('   1. SSH access configured');
  console.log('   2. Key file at ~/.ssh/' + KEY_NAME + '.pem');
  console.log('\nManual deployment steps:\n');
  console.log(`1. Upload package: scp -i ~/.ssh/${KEY_NAME}.pem ${zipPath} ec2-user@${ip}:/tmp/sports-hub-deploy.zip`);
  console.log(`2. SSH: ssh -i ~/.ssh/${KEY_NAME}.pem ec2-user@${ip}`);
  console.log('3. Deploy: unzip /tmp/sports-hub-deploy.zip -d /home/ec2-user/sports-hub && cd /home/ec2-user/sports-hub && bash deploy.sh');
  console.log(`\n✅ GraphQL endpoint: http://${ip}:4000/graphql\n`);
}

main();

