#!/usr/bin/env node

/**
 * Helper script to configure bucket policy after public access is disabled
 */

require('dotenv').config();
const { S3Client, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

const BUCKET_NAME = process.argv.find(arg => arg.startsWith('--bucket='))?.split('=')[1] 
  || process.env.S3_BUCKET_NAME 
  || 'sports-hub-frontend-dev';

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: REGION });

async function configureBucketPolicy() {
  console.log(`🔐 Configuring bucket policy for ${BUCKET_NAME}...\n`);
  
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
    console.log('✅ Bucket policy configured successfully!\n');
    return true;
  } catch (error) {
    console.error(`❌ Error configuring bucket policy:`, error.message);
    if (error.message.includes('BlockPublicPolicy')) {
      console.error('\n💡 You need to disable "Block public policies" in S3 Console first:');
      console.error(`   https://s3.console.aws.amazon.com/s3/buckets/${BUCKET_NAME}?region=${REGION}&tab=permissions`);
    }
    return false;
  }
}

configureBucketPolicy().then(success => {
  process.exit(success ? 0 : 1);
});

