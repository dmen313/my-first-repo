#!/usr/bin/env node

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'sports-hub-frontend-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;

/**
 * Increment the version in package.json.
 * Patch rolls over at 99: 0.3.99 → 0.4.0, 0.4.99 → 0.5.0, etc.
 * Minor rolls over at 99: 0.99.99 → 1.0.0
 */
function incrementVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const oldVersion = packageJson.version;
  let [major, minor, patch] = oldVersion.split('.').map(Number);

  patch += 1;
  if (patch > 99) {
    patch = 0;
    minor += 1;
  }
  if (minor > 99) {
    minor = 0;
    major += 1;
  }

  const newVersion = `${major}.${minor}.${patch}`;
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  
  console.log(`📦 Version incremented: ${oldVersion} → ${newVersion}\n`);
  return newVersion;
}

console.log('🚀 Deploying frontend to S3...\n');
console.log('═══════════════════════════════════════════════════════');

try {
  // Increment version before building
  const newVersion = incrementVersion();
  
  console.log('📦 DEPLOYMENT TARGET:');
  console.log(`   Version: ${newVersion}`);
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Region: ${REGION}`);
  if (CLOUDFRONT_DISTRIBUTION_ID) {
    console.log(`   CloudFront Distribution: ${CLOUDFRONT_DISTRIBUTION_ID}`);
  } else {
    console.log(`   CloudFront: Not configured`);
  }
  console.log('═══════════════════════════════════════════════════════\n');

  // Build React app
  console.log('🏗️  Building React app...');
  process.chdir(path.join(__dirname, '..'));
  execSync('npm run build', { stdio: 'inherit' });
  
  // Upload to S3 with proper cache headers
  console.log('\n📤 Uploading to S3 with cache headers...');
  const buildDir = path.join(__dirname, '..', 'build');
  
  // First, upload all files (this handles deletions)
  console.log('   Syncing all files...');
  execSync(`aws s3 sync ${buildDir}/ s3://${BUCKET_NAME}/ --delete --region ${REGION}`, {
    stdio: 'inherit'
  });
  
  // Set no-cache headers for HTML files
  console.log('   Setting cache headers for HTML files...');
  try {
    execSync(`aws s3 cp ${buildDir}/index.html s3://${BUCKET_NAME}/index.html --cache-control "no-cache, no-store, must-revalidate" --content-type "text/html" --metadata-directive REPLACE --region ${REGION}`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.warn('   Warning: Could not update HTML cache headers:', error.message);
  }
  
  // Set long cache headers for static assets (JS, CSS, images)
  console.log('   Setting cache headers for static assets...');
  const staticExtensions = ['js', 'css', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot'];
  staticExtensions.forEach(ext => {
    try {
      execSync(`aws s3 sync ${buildDir}/ s3://${BUCKET_NAME}/ --exclude "*" --include "*.${ext}" --cache-control "public, max-age=31536000, immutable" --metadata-directive REPLACE --region ${REGION}`, {
        stdio: 'pipe' // Use pipe to reduce noise
      });
    } catch (error) {
      // Ignore errors for extensions that don't exist
    }
  });
  
  // Invalidate CloudFront cache if distribution ID is provided
  if (CLOUDFRONT_DISTRIBUTION_ID) {
    console.log('\n🔄 Invalidating CloudFront cache...');
    try {
      execSync(`aws cloudfront create-invalidation --distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} --paths "/*" --region ${REGION}`, {
        stdio: 'inherit'
      });
      console.log('✅ CloudFront cache invalidation initiated');
    } catch (error) {
      console.warn('⚠️  CloudFront invalidation failed (this is okay if you\'re not using CloudFront):', error.message);
    }
  } else {
    console.log('\n💡 Tip: Set CLOUDFRONT_DISTRIBUTION_ID in .env to auto-invalidate CloudFront cache');
  }
  
  const websiteUrl = REGION === 'us-east-1' 
    ? `http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com`
    : `http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com`;
  
  console.log('\n✅ Deployment complete!');
  console.log(`🌐 Website URL: ${websiteUrl}`);
  if (CLOUDFRONT_DISTRIBUTION_ID) {
    console.log(`📡 CloudFront invalidation in progress (may take a few minutes to propagate)`);
  }
  console.log();
  
} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}

