#!/usr/bin/env node

/**
 * List users in Cognito User Pool for testing
 */

require('dotenv').config();
const { CognitoIdentityProviderClient, ListUsersCommand } = require('@aws-sdk/client-cognito-identity-provider');

const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_MI78r8fcJ';
const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';

const client = new CognitoIdentityProviderClient({ region: REGION });

async function listUsers() {
  try {
    console.log(`👥 Listing users in User Pool: ${USER_POOL_ID}\n`);
    
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 10
    });
    
    const response = await client.send(command);
    
    if (!response.Users || response.Users.length === 0) {
      console.log('❌ No users found in User Pool');
      console.log('\n💡 Create a user in AWS Console or via CLI');
      return;
    }
    
    console.log(`Found ${response.Users.length} user(s):\n`);
    
    response.Users.forEach((user, index) => {
      const email = user.Attributes?.find(attr => attr.Name === 'email')?.Value || 'No email';
      const username = user.Username;
      
      console.log(`${index + 1}. Username: ${username}`);
      console.log(`   Email: ${email}`);
      console.log(`   Status: ${user.UserStatus}`);
      console.log(`   Enabled: ${user.Enabled ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    console.log('💡 You can use either the username or email to log in\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listUsers();

