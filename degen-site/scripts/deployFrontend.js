#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sports-hub-frontend-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';

console.log('🚀 Deploying frontend to S3...\n');
console.log(`Bucket: ${BUCKET_NAME}`);
console.log(`Region: ${REGION}\n`);

try {
  // Build React app
  console.log('🏗️  Building React app...');
  process.chdir(path.join(__dirname, '..'));
  execSync('npm run build', { stdio: 'inherit' });
  
  // Upload to S3
  console.log('\n📤 Uploading to S3...');
  const buildDir = path.join(__dirname, '..', 'build');
  execSync(`aws s3 sync ${buildDir}/ s3://${BUCKET_NAME}/ --delete --region ${REGION}`, {
    stdio: 'inherit'
  });
  
  const websiteUrl = REGION === 'us-east-1' 
    ? `http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com`
    : `http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com`;
  
  console.log('\n✅ Deployment complete!');
  console.log(`🌐 Website URL: ${websiteUrl}\n`);
  
} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}

