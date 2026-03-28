#!/usr/bin/env node

/**
 * Create CloudWatch log group for Lambda function
 * Run this script if the log group doesn't exist (requires admin permissions)
 */

require('dotenv').config();
const { execSync } = require('child_process');

const FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'sports-hub-graphql';
const REGION = process.env.AWS_REGION || 'us-east-1';
const LOG_GROUP_NAME = `/aws/lambda/${FUNCTION_NAME}`;

console.log('📝 Creating CloudWatch log group for Lambda...\n');
console.log(`Function: ${FUNCTION_NAME}`);
console.log(`Log Group: ${LOG_GROUP_NAME}`);
console.log(`Region: ${REGION}\n`);

try {
  // Check if log group already exists
  console.log('🔍 Checking if log group exists...');
  try {
    const existing = execSync(
      `aws logs describe-log-groups --log-group-name-prefix "${LOG_GROUP_NAME}" --region ${REGION} --query "logGroups[?logGroupName=='${LOG_GROUP_NAME}'].logGroupName" --output text`,
      { encoding: 'utf-8', stdio: 'pipe' }
    ).trim();
    
    if (existing === LOG_GROUP_NAME) {
      console.log('✅ Log group already exists!\n');
      process.exit(0);
    }
  } catch (e) {
    // Log group doesn't exist, continue to create it
    console.log('📝 Log group does not exist, creating...\n');
  }

  // Create log group
  console.log('🔨 Creating log group...');
  execSync(
    `aws logs create-log-group --log-group-name "${LOG_GROUP_NAME}" --region ${REGION}`,
    { stdio: 'inherit' }
  );
  console.log('✅ Log group created!\n');

  // Set retention policy (7 days)
  console.log('⚙️  Setting retention policy (7 days)...');
  try {
    execSync(
      `aws logs put-retention-policy --log-group-name "${LOG_GROUP_NAME}" --retention-in-days 7 --region ${REGION}`,
      { stdio: 'inherit' }
    );
    console.log('✅ Retention policy set!\n');
  } catch (e) {
    console.warn('⚠️  Could not set retention policy (this is okay)\n');
  }

  console.log('✅ All done! The log group is ready for Lambda to write logs.');
  console.log(`\n📊 View logs with:`);
  console.log(`   aws logs tail ${LOG_GROUP_NAME} --follow --region ${REGION}`);
  console.log(`\nOr in AWS Console:`);
  console.log(`   CloudWatch → Log groups → ${LOG_GROUP_NAME}`);

} catch (error) {
  console.error('\n❌ Failed to create log group:', error.message);
  
  if (error.message.includes('AccessDenied') || error.message.includes('not authorized')) {
    console.error('\n💡 You need admin permissions to create log groups.');
    console.error('   Ask your AWS administrator to run this script or create the log group manually:');
    console.error(`   aws logs create-log-group --log-group-name "${LOG_GROUP_NAME}" --region ${REGION}`);
  }
  
  process.exit(1);
}

