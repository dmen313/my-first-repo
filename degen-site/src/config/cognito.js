/**
 * AWS Cognito Configuration
 */

export const cognitoConfig = {
  region: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || 'simplesiteb37ba593_userpool_b37ba593-dev',
  userPoolWebClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || '', // Will need to be set in .env
};

