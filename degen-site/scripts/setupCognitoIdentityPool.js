#!/usr/bin/env node
/**
 * Set up Cognito Identity Pool for frontend to access DynamoDB directly
 */

require('dotenv').config();
const { execSync } = require('child_process');

const REGION = process.env.AWS_REGION || 'us-east-1';
const IDENTITY_POOL_NAME = 'sports-hub-identity-pool';
const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_MI78r8fcJ';

async function setupIdentityPool() {
  console.log('🔐 Setting up Cognito Identity Pool for DynamoDB access...\n');

  try {
    // Check if identity pool exists
    let identityPoolId;
    try {
      const pools = JSON.parse(execSync(`aws cognito-identity list-identity-pools --max-results 10 --region ${REGION} --query "IdentityPools[?IdentityPoolName=='${IDENTITY_POOL_NAME}'].IdentityPoolId" --output json`, { encoding: 'utf-8' }));
      if (pools && pools.length > 0) {
        identityPoolId = pools[0];
        console.log(`✅ Using existing Identity Pool: ${identityPoolId}`);
      }
    } catch (e) {
      // Pool doesn't exist
    }

    if (!identityPoolId) {
      // Create identity pool
      console.log('Creating new Identity Pool...');
      const poolConfig = {
        IdentityPoolName: IDENTITY_POOL_NAME,
        AllowUnauthenticatedIdentities: false,
        CognitoIdentityProviders: [{
          ProviderName: `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
          ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || ''
        }]
      };

      const poolResult = JSON.parse(execSync(
        `aws cognito-identity create-identity-pool --identity-pool-name "${IDENTITY_POOL_NAME}" --allow-unauthenticated-identities --region ${REGION} --output json`,
        { encoding: 'utf-8' }
      ));
      identityPoolId = poolResult.IdentityPoolId;
      console.log(`✅ Created Identity Pool: ${identityPoolId}`);
    }

    // Create IAM role for authenticated users
    const authenticatedRoleName = 'sports-hub-authenticated-role';
    let authenticatedRoleArn;

    try {
      authenticatedRoleArn = execSync(`aws iam get-role --role-name ${authenticatedRoleName} --query "Role.Arn" --output text --region ${REGION}`, { encoding: 'utf-8' }).trim();
      if (authenticatedRoleArn && authenticatedRoleArn !== 'None') {
        console.log(`✅ Using existing IAM role: ${authenticatedRoleArn}`);
      }
    } catch (e) {
      // Create role
      console.log('Creating IAM role for authenticated users...');
      const trustPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: {
            Federated: 'cognito-identity.amazonaws.com'
          },
          Action: 'sts:AssumeRoleWithWebIdentity',
          Condition: {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': identityPoolId
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated'
            }
          }
        }]
      };

      const fs = require('fs');
      fs.writeFileSync('/tmp/trust-policy.json', JSON.stringify(trustPolicy));
      execSync(`aws iam create-role --role-name ${authenticatedRoleName} --assume-role-policy-document file:///tmp/trust-policy.json --region ${REGION}`, { stdio: 'ignore' });

      // Attach DynamoDB read/write policy
      const dynamoPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Action: [
            'dynamodb:GetItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
          ],
          Resource: [
            'arn:aws:dynamodb:*:*:table/sports-hub-*',
            'arn:aws:dynamodb:*:*:table/sports-hub-*/index/*'
          ]
        }]
      };

      fs.writeFileSync('/tmp/dynamo-policy.json', JSON.stringify(dynamoPolicy));
      execSync(`aws iam put-role-policy --role-name ${authenticatedRoleName} --policy-name DynamoDBAccess --policy-document file:///tmp/dynamo-policy.json --region ${REGION}`, { stdio: 'ignore' });

      authenticatedRoleArn = execSync(`aws iam get-role --role-name ${authenticatedRoleName} --query "Role.Arn" --output text --region ${REGION}`, { encoding: 'utf-8' }).trim();
      console.log(`✅ Created IAM role: ${authenticatedRoleArn}`);
    }

    // Set identity pool roles
    console.log('Setting Identity Pool roles...');
    execSync(`aws cognito-identity set-identity-pool-roles --identity-pool-id ${identityPoolId} --roles authenticated=${authenticatedRoleArn} --region ${REGION}`, { stdio: 'ignore' });
    console.log('✅ Identity Pool roles configured');

    console.log('\n✅ Setup Complete!');
    console.log(`\n📝 Add to your .env file:`);
    console.log(`REACT_APP_COGNITO_IDENTITY_POOL_ID=${identityPoolId}`);
    console.log(`REACT_APP_AWS_REGION=${REGION}`);

  } catch (error) {
    console.error('❌ Error setting up Identity Pool:', error.message);
    process.exit(1);
  }
}

setupIdentityPool();

