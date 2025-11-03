#!/usr/bin/env node

/**
 * Test script to verify Cognito configuration
 */

require('dotenv').config();

console.log('🧪 Testing Cognito Configuration...\n');

const userPoolId = process.env.REACT_APP_COGNITO_USER_POOL_ID;
const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
const region = process.env.REACT_APP_AWS_REGION || 'us-east-1';

console.log('Environment Variables:');
console.log(`  REACT_APP_COGNITO_USER_POOL_ID: ${userPoolId || '❌ NOT SET'}`);
console.log(`  REACT_APP_COGNITO_CLIENT_ID: ${clientId ? `${clientId.substring(0, 10)}...` : '❌ NOT SET'}`);
console.log(`  REACT_APP_AWS_REGION: ${region}\n`);

if (!userPoolId || !clientId) {
  console.error('❌ Missing required environment variables!');
  console.error('   Please check your .env file.');
  process.exit(1);
}

// Verify User Pool exists
const { CognitoIdentityProviderClient, DescribeUserPoolCommand } = require('@aws-sdk/client-cognito-identity-provider');
const client = new CognitoIdentityProviderClient({ region });

async function testConnection() {
  try {
    console.log('🔍 Verifying User Pool exists...');
    const command = new DescribeUserPoolCommand({
      UserPoolId: userPoolId
    });
    
    const response = await client.send(command);
    
    if (response.UserPool) {
      console.log('✅ User Pool found:');
      console.log(`   Name: ${response.UserPool.Name}`);
      console.log(`   ID: ${response.UserPool.Id}`);
      console.log(`   Status: ${response.UserPool.Status}\n`);
      
      // Verify client exists
      const { ListUserPoolClientsCommand } = require('@aws-sdk/client-cognito-identity-provider');
      const clientCommand = new ListUserPoolClientsCommand({
        UserPoolId: userPoolId,
        MaxResults: 10
      });
      
      const clientResponse = await client.send(clientCommand);
      const foundClient = clientResponse.UserPoolClients?.find(c => c.ClientId === clientId);
      
      if (foundClient) {
        console.log('✅ Client App found:');
        console.log(`   Name: ${foundClient.ClientName}`);
        console.log(`   Client ID: ${foundClient.ClientId}\n`);
        console.log('✅ Configuration is valid!\n');
        console.log('💡 You can now test login in your app.');
        return true;
      } else {
        console.log('❌ Client ID not found in User Pool');
        console.log('   Available clients:');
        clientResponse.UserPoolClients?.forEach((c, i) => {
          console.log(`   ${i + 1}. ${c.ClientName} - ${c.ClientId}`);
        });
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.name === 'ResourceNotFoundException') {
      console.error('   User Pool not found. Check the User Pool ID.');
    } else if (error.name === 'AccessDeniedException') {
      console.error('   Access denied. Check your IAM permissions.');
    }
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});

