#!/usr/bin/env node

/**
 * Script to get Cognito Client ID for a User Pool
 */

require('dotenv').config();
const { CognitoIdentityProviderClient, ListUserPoolClientsCommand } = require('@aws-sdk/client-cognito-identity-provider');

const USER_POOL_ID = process.argv[2] || process.env.REACT_APP_COGNITO_USER_POOL_ID || 'simplesiteb37ba593_userpool_b37ba593-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new CognitoIdentityProviderClient({ region: REGION });

async function getClientIds() {
  try {
    console.log(`🔍 Fetching Cognito Client IDs for User Pool: ${USER_POOL_ID}\n`);
    
    const command = new ListUserPoolClientsCommand({
      UserPoolId: USER_POOL_ID,
      MaxResults: 10
    });
    
    const response = await client.send(command);
    
    if (!response.UserPoolClients || response.UserPoolClients.length === 0) {
      console.log('❌ No client apps found for this User Pool');
      console.log('\n💡 You may need to create a client app in the AWS Console:');
      console.log(`   https://console.aws.amazon.com/cognito/v2/idp/user-pools/${USER_POOL_ID}/app-clients?region=${REGION}`);
      return;
    }
    
    console.log(`✅ Found ${response.UserPoolClients.length} client app(s):\n`);
    
    response.UserPoolClients.forEach((client, index) => {
      console.log(`Client ${index + 1}:`);
      console.log(`  Name: ${client.ClientName}`);
      console.log(`  Client ID: ${client.ClientId}`);
      console.log('');
    });
    
    const firstClient = response.UserPoolClients[0];
    console.log('\n📋 Add this to your .env file:');
    console.log(`REACT_APP_COGNITO_USER_POOL_ID=${USER_POOL_ID}`);
    console.log(`REACT_APP_COGNITO_CLIENT_ID=${firstClient.ClientId}`);
    console.log(`REACT_APP_AWS_REGION=${REGION}`);
    
  } catch (error) {
    console.error('❌ Error fetching client IDs:', error.message);
    
    if (error.name === 'ResourceNotFoundException') {
      console.error(`\n💡 User Pool not found: ${USER_POOL_ID}`);
      console.error('   Make sure the User Pool ID is correct.');
    } else if (error.name === 'AccessDeniedException') {
      console.error('\n💡 Access denied. Check your IAM permissions:');
      console.error('   Required permission: cognito-idp:ListUserPoolClients');
    }
  }
}

getClientIds();

