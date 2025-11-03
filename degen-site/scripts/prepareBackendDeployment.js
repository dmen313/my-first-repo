#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const REGION = process.env.AWS_REGION || 'us-east-1';

console.log('📦 Preparing Backend Deployment Package\n');
console.log(`Region: ${REGION}\n`);

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
    ['src', 'scripts', 'package.json', 'ecosystem.config.js'].forEach(file => {
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

    fs.mkdirSync(path.join(packageDir, 'data'), { recursive: true });

    // Create .env
    const envContent = `NODE_ENV=production
GRAPHQL_PORT=4000
REACT_APP_ODDS_API_KEY=${process.env.REACT_APP_ODDS_API_KEY || ''}
REACT_APP_NFL_API_KEY=${process.env.REACT_APP_NFL_API_KEY || ''}
AWS_REGION=${REGION}
`;
    fs.writeFileSync(path.join(packageDir, '.env'), envContent);

    // Create deployment instructions
    const instructions = `# Backend Deployment Instructions

## Prerequisites
- AWS EC2 instance (t3.micro or larger)
- Amazon Linux 2 AMI
- Security Group with ports 22 (SSH) and 4000 (HTTP) open

## Deployment Steps

### 1. Upload deployment package to EC2

From your local machine:
\`\`\`bash
scp -i ~/.ssh/your-key.pem deploy.zip ec2-user@<your-ec2-ip>:/home/ec2-user/
\`\`\`

### 2. SSH into EC2 instance

\`\`\`bash
ssh -i ~/.ssh/your-key.pem ec2-user@<your-ec2-ip>
\`\`\`

### 3. Install Node.js 18

\`\`\`bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git
\`\`\`

### 4. Install PM2

\`\`\`bash
sudo npm install -g pm2
\`\`\`

### 5. Extract and setup application

\`\`\`bash
cd /home/ec2-user
unzip -q deploy.zip -d sports-hub
cd sports-hub
npm install --production
mkdir -p logs
\`\`\`

### 6. Start application with PM2

\`\`\`bash
pm2 start ecosystem.config.js
pm2 save
sudo pm2 startup systemd -u ec2-user --hp /home/ec2-user
# Run the command that PM2 outputs to enable auto-start on boot
\`\`\`

### 7. Verify it's running

\`\`\`bash
pm2 status
pm2 logs
\`\`\`

### 8. Test the endpoint

From your browser or curl:
\`\`\`bash
curl http://<your-ec2-ip>:4000/health
curl http://<your-ec2-ip>:4000/graphql
\`\`\`

## GraphQL Endpoint

Once deployed, your GraphQL endpoint will be:
\`\`\`
http://<your-ec2-ip>:4000/graphql
\`\`\`

## Update Frontend

After deployment, update your frontend .env file:
\`\`\`
REACT_APP_GRAPHQL_ENDPOINT=http://<your-ec2-ip>:4000/graphql
\`\`\`

Then rebuild and redeploy the frontend.

## Troubleshooting

- Check PM2 logs: \`pm2 logs\`
- Restart service: \`pm2 restart graphql-server\`
- Check if port 4000 is listening: \`sudo netstat -tlnp | grep 4000\`
- Check security group allows port 4000 from internet
`;

    fs.writeFileSync(path.join(packageDir, 'DEPLOYMENT.md'), instructions);

    // Create zip
    console.log('📦 Creating deployment zip...');
    const zipPath = path.join(__dirname, '..', 'deploy.zip');
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on('close', () => {
        const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        console.log(`✅ Deployment package created: ${zipPath} (${sizeMB} MB)\n`);
        resolve();
      });
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(packageDir, false);
      archive.finalize();
    });

    // Try to upload to S3 for easier access
    console.log('📤 Uploading to S3 for easier access...');
    try {
      const bucketName = `sports-hub-deploy-${Date.now()}`;
      execSync(`aws s3 mb s3://${bucketName} --region ${REGION}`, { stdio: 'ignore' });
      execSync(`aws s3 cp ${zipPath} s3://${bucketName}/deploy.zip --region ${REGION}`, { stdio: 'inherit' });
      console.log(`✅ Also uploaded to: s3://${bucketName}/deploy.zip`);
      console.log(`   You can download it from S3 console or use AWS CLI\n`);
    } catch (error) {
      console.log('⚠️  Could not upload to S3 (permissions issue). Package is ready locally.\n');
    }

    console.log('✅ Deployment package ready!');
    console.log('\n📋 Next Steps:');
    console.log('1. Launch an EC2 instance (t3.micro recommended)');
    console.log('   - AMI: Amazon Linux 2');
    console.log('   - Security Group: Allow ports 22 (SSH) and 4000 (HTTP)');
    console.log('2. Follow instructions in deploy/DEPLOYMENT.md');
    console.log(`3. Package location: ${zipPath}\n`);

  } catch (error) {
    console.error('\n❌ Preparation failed:', error.message);
    process.exit(1);
  }
}

main();

