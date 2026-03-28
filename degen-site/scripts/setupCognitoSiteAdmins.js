#!/usr/bin/env node
/**
 * Set up "SiteAdmins" Cognito group and add the initial site admin user.
 * Idempotent — safe to re-run.
 */

require('dotenv').config();
const {
  CognitoIdentityProviderClient,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminGetUserCommand
} = require('@aws-sdk/client-cognito-identity-provider');

const REGION = process.env.AWS_REGION || 'us-east-1';
const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_MI78r8fcJ';
const GROUP_NAME = 'SiteAdmins';
const INITIAL_ADMIN_EMAIL = 'dev.menon@yahoo.com';

const client = new CognitoIdentityProviderClient({ region: REGION });

async function findUsernameByEmail(email) {
  // Cognito usernames may differ from emails — look up by email attribute
  const { execSync } = require('child_process');
  const raw = execSync(
    `aws cognito-idp list-users --user-pool-id ${USER_POOL_ID} --filter "email = \\"${email}\\"" --region ${REGION}`,
    { encoding: 'utf-8' }
  );
  const result = JSON.parse(raw);
  if (!result.Users || result.Users.length === 0) return null;
  return result.Users[0].Username;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🛡️  Cognito Site Admins Setup');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   User Pool:  ${USER_POOL_ID}`);
  console.log(`   Group:      ${GROUP_NAME}`);
  console.log(`   Admin:      ${INITIAL_ADMIN_EMAIL}`);
  console.log('');

  // 1. Create the SiteAdmins group
  console.log('▶ Creating SiteAdmins group...');
  try {
    await client.send(new CreateGroupCommand({
      GroupName: GROUP_NAME,
      UserPoolId: USER_POOL_ID,
      Description: 'Site-wide administrators with full access'
    }));
    console.log('   ✅ Group created');
  } catch (err) {
    if (err.name === 'GroupExistsException') {
      console.log('   ✅ Group already exists — skipping');
    } else {
      throw err;
    }
  }

  // 2. Find the Cognito username for the admin email
  console.log(`\n▶ Looking up user: ${INITIAL_ADMIN_EMAIL}...`);
  const username = await findUsernameByEmail(INITIAL_ADMIN_EMAIL);
  if (!username) {
    console.error(`   ❌ No Cognito user found with email ${INITIAL_ADMIN_EMAIL}`);
    console.error('   Make sure this user exists in the User Pool first.');
    process.exit(1);
  }
  console.log(`   ✅ Found username: ${username}`);

  // 3. Add user to the group
  console.log(`\n▶ Adding ${username} to ${GROUP_NAME}...`);
  try {
    await client.send(new AdminAddUserToGroupCommand({
      GroupName: GROUP_NAME,
      UserPoolId: USER_POOL_ID,
      Username: username
    }));
    console.log('   ✅ User added to group');
  } catch (err) {
    if (err.name === 'UserNotFoundException') {
      console.error(`   ❌ User ${username} not found`);
      process.exit(1);
    }
    throw err;
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Site admin setup complete!');
  console.log('   The user must sign out and sign back in to get the updated token.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
