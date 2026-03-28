#!/usr/bin/env node

/**
 * Enable CORS on API Gateway for GraphQL endpoint
 */

const { execSync } = require('child_process');

const API_ID = process.env.API_GATEWAY_ID || 'kubm8uzctg';
const REGION = process.env.AWS_REGION || 'us-east-1';

console.log('🔧 Enabling CORS on API Gateway...\n');
console.log(`API Gateway ID: ${API_ID}`);
console.log(`Region: ${REGION}\n`);

try {
  // Get GraphQL resource ID
  const graphqlResourceId = execSync(
    `aws apigateway get-resources --rest-api-id ${API_ID} --region ${REGION} --query "items[?path=='/graphql'].id" --output text`,
    { encoding: 'utf-8' }
  ).trim();

  if (!graphqlResourceId) {
    throw new Error('Could not find /graphql resource');
  }

  console.log(`✅ Found GraphQL resource: ${graphqlResourceId}\n`);

  // Enable CORS using AWS CLI (this creates OPTIONS method and integration)
  console.log('🌐 Enabling CORS on /graphql resource...');
  
  try {
    execSync(
      `aws apigateway put-method-response --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method OPTIONS --status-code 200 --response-parameters method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false --region ${REGION}`,
      { stdio: 'inherit' }
    );
  } catch (e) {
    // May already exist
  }

  // Create OPTIONS method if it doesn't exist
  try {
    execSync(
      `aws apigateway put-method --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method OPTIONS --authorization-type NONE --region ${REGION}`,
      { stdio: 'inherit' }
    );
    console.log('✅ Created OPTIONS method');
  } catch (e) {
    console.log('⚠️  OPTIONS method may already exist');
  }

  // Create MOCK integration for OPTIONS (to handle preflight)
  try {
    execSync(
      `aws apigateway put-integration --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region ${REGION}`,
      { stdio: 'inherit' }
    );
    console.log('✅ Created MOCK integration for OPTIONS');
  } catch (e) {
    console.log('⚠️  Integration may already exist, updating...');
    execSync(
      `aws apigateway put-integration --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region ${REGION}`,
      { stdio: 'inherit' }
    );
  }

  // Set integration response for OPTIONS
  try {
    execSync(
      `aws apigateway put-integration-response --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'\''Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'\''","method.response.header.Access-Control-Allow-Methods":"'\''GET,POST,OPTIONS'\''","method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' --region ${REGION}`,
      { stdio: 'inherit' }
    );
    console.log('✅ Set OPTIONS integration response');
  } catch (e) {
    console.log('⚠️  Integration response may already exist');
  }

  // Also add CORS headers to actual responses (GET, POST)
  const methods = ['GET', 'POST', 'ANY'];
  
  for (const method of methods) {
    try {
      // Add method response headers
      execSync(
        `aws apigateway put-method-response --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method ${method} --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false}' --region ${REGION}`,
        { stdio: 'ignore' }
      );
      
      // Add integration response headers
      execSync(
        `aws apigateway put-integration-response --rest-api-id ${API_ID} --resource-id ${graphqlResourceId} --http-method ${method} --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'\''*'\''"}' --region ${REGION}`,
        { stdio: 'ignore' }
      );
      
      console.log(`✅ Added CORS headers to ${method} method`);
    } catch (e) {
      // Method may not exist or headers already set
    }
  }

  // Deploy API to make changes take effect
  console.log('\n🚀 Deploying API Gateway...');
  execSync(
    `aws apigateway create-deployment --rest-api-id ${API_ID} --stage-name prod --region ${REGION}`,
    { stdio: 'inherit' }
  );

  console.log('\n✅ CORS enabled successfully!');
  console.log(`🌐 Endpoint: https://${API_ID}.execute-api.${REGION}.amazonaws.com/prod/graphql`);
  console.log('\n💡 Note: It may take a few seconds for changes to propagate');

} catch (error) {
  console.error('\n❌ Failed to enable CORS:', error.message);
  console.error(error.stack);
  process.exit(1);
}

