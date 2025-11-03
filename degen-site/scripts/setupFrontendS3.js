#!/usr/bin/env node

/**
 * Script to set up S3 bucket for frontend hosting (development)
 */

require('dotenv').config();
const { S3Client, CreateBucketCommand, PutBucketWebsiteCommand, PutBucketPolicyCommand, PutPublicAccessBlockCommand, PutBucketCorsCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { execSync } = require('child_process');
const path = require('path');

const REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.S3_BUCKET_NAME || `sports-hub-frontend-dev-${Date.now()}`;

const s3Client = new S3Client({ region: REGION });

async function bucketExists(bucketName) {
  try {
    const command = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function createBucket() {
  console.log(`📦 Creating S3 bucket: ${BUCKET_NAME}...\n`);
  
  const exists = await bucketExists(BUCKET_NAME);
  if (exists) {
    console.log(`✅ Bucket ${BUCKET_NAME} already exists\n`);
    return;
  }
  
  try {
    const createParams = {
      Bucket: BUCKET_NAME,
      ...(REGION !== 'us-east-1' && { CreateBucketConfiguration: { LocationConstraint: REGION } })
    };
    
    const createCommand = new CreateBucketCommand(createParams);
    await s3Client.send(createCommand);
    console.log(`✅ Bucket ${BUCKET_NAME} created successfully\n`);
  } catch (error) {
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log(`✅ Bucket ${BUCKET_NAME} already exists\n`);
    } else {
      console.error(`❌ Error creating bucket:`, error.message);
      throw error;
    }
  }
}

async function configureStaticWebsite() {
  console.log('🌐 Configuring static website hosting...\n');
  
  try {
    const websiteConfig = {
      Bucket: BUCKET_NAME,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        ErrorDocument: { Key: 'index.html' } // For React Router
      }
    };
    
    const command = new PutBucketWebsiteCommand(websiteConfig);
    await s3Client.send(command);
    console.log('✅ Static website hosting configured\n');
  } catch (error) {
    console.error(`❌ Error configuring website:`, error.message);
    throw error;
  }
}

async function configureCORS() {
  console.log('🔓 Configuring CORS...\n');
  
  try {
    const corsConfig = {
      Bucket: BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'HEAD'],
            AllowedOrigins: ['*'],
            ExposeHeaders: [],
            MaxAgeSeconds: 3000
          }
        ]
      }
    };
    
    const command = new PutBucketCorsCommand(corsConfig);
    await s3Client.send(command);
    console.log('✅ CORS configured\n');
  } catch (error) {
    console.error(`❌ Error configuring CORS:`, error.message);
    throw error;
  }
}

async function configureBucketPolicy() {
  console.log('🔐 Configuring bucket policy for public read access...\n');
  
  try {
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
        }
      ]
    };
    
    const command = new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(bucketPolicy)
    });
    
    await s3Client.send(command);
    console.log('✅ Bucket policy configured (public read access)\n');
  } catch (error) {
    console.error(`❌ Error configuring bucket policy:`, error.message);
    throw error;
  }
}

async function configurePublicAccessBlock() {
  console.log('🔓 Configuring public access block...\n');
  
  try {
    // Allow public access for static website hosting
    const command = new PutPublicAccessBlockCommand({
      Bucket: BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false
      }
    });
    
    await s3Client.send(command);
    console.log('✅ Public access block configured\n');
  } catch (error) {
    if (error.name === 'AccessDenied' || error.message.includes('not authorized')) {
      console.log('⚠️  Cannot configure public access block (permissions required)');
      console.log('   You\'ll need to do this manually in AWS Console:\n');
      console.log(`   1. Go to: https://s3.console.aws.amazon.com/s3/buckets/${BUCKET_NAME}?region=${REGION}&tab=permissions`);
      console.log('   2. Click "Edit" on "Block public access"');
      console.log('   3. Uncheck all 4 boxes');
      console.log('   4. Save changes\n');
      console.log('   Then run this script again, or continue manually.\n');
      return false; // Return false to indicate manual step needed
    } else {
      console.error(`❌ Error configuring public access block:`, error.message);
    }
  }
  return true;
}

async function buildReactApp() {
  console.log('🏗️  Building React application...\n');
  
  try {
    process.chdir(path.join(__dirname, '..'));
    execSync('npm run build', { stdio: 'inherit' });
    console.log('\n✅ React app built successfully\n');
  } catch (error) {
    console.error('\n❌ Error building React app:', error.message);
    throw error;
  }
}

async function uploadBuild() {
  console.log('📤 Uploading build files to S3...\n');
  
  const buildDir = path.join(__dirname, '..', 'build');
  
  try {
    // Use AWS CLI sync command (more reliable for syncing directories)
    execSync(`aws s3 sync ${buildDir}/ s3://${BUCKET_NAME}/ --delete --region ${REGION}`, {
      stdio: 'inherit'
    });
    console.log('\n✅ Files uploaded successfully\n');
  } catch (error) {
    console.error('\n❌ Error uploading files:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Setting up S3 frontend hosting (Development)...\n');
  console.log(`📍 Region: ${REGION}`);
  console.log(`🪣 Bucket: ${BUCKET_NAME}\n`);
  
  try {
    // Step 1: Create bucket
    await createBucket();
    
    // Step 2: Configure static website hosting
    await configureStaticWebsite();
    
    // Step 3: Configure CORS
    await configureCORS();
    
    // Step 4: Configure public access
    const publicAccessConfigured = await configurePublicAccessBlock();
    
    // Step 5: Configure bucket policy (only if public access is configured)
    if (publicAccessConfigured) {
      await configureBucketPolicy();
    } else {
      console.log('⏭️  Skipping bucket policy (public access needs to be configured first)\n');
      console.log('💡 After configuring public access in AWS Console, run:');
      console.log(`   node scripts/configureBucketPolicy.js --bucket ${BUCKET_NAME}\n`);
    }
    
    // Step 6: Build React app
    await buildReactApp();
    
    // Step 7: Upload build
    await uploadBuild();
    
    // Website URL
    const websiteUrl = REGION === 'us-east-1' 
      ? `http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com`
      : `http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com`;
    
    console.log('\n✅ Frontend setup complete!\n');
    console.log('📋 Summary:');
    console.log(`   Bucket Name: ${BUCKET_NAME}`);
    console.log(`   Website URL: ${websiteUrl}`);
    console.log(`   Region: ${REGION}\n`);
    console.log('💡 Next steps:');
    console.log(`   1. Visit your site: ${websiteUrl}`);
    console.log('   2. Update .env file with your GraphQL endpoint URL');
    console.log('   3. Rebuild and redeploy when you make changes:');
    console.log('      npm run build && aws s3 sync build/ s3://' + BUCKET_NAME + '/ --delete');
    console.log('\n📝 Save this bucket name for future deployments!');
    console.log(`   Add to .env: S3_BUCKET_NAME=${BUCKET_NAME}`);
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.message.includes('credentials')) {
      console.error('\n💡 Make sure AWS credentials are configured:');
      console.error('   aws configure');
    }
    process.exit(1);
  }
}

main();

