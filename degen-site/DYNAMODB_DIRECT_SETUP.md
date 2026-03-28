# Direct DynamoDB Access Setup

This guide explains how to configure the frontend to access DynamoDB directly, bypassing the Lambda/GraphQL layer.

## Setup Steps

### 1. Set Up Cognito Identity Pool

Run the setup script to create a Cognito Identity Pool:

```bash
npm run setup-cognito-identity-pool
```

This will:
- Create a Cognito Identity Pool
- Create an IAM role for authenticated users
- Grant DynamoDB read/write permissions
- Output the Identity Pool ID

### 2. Update Environment Variables

Add to your `.env` file:

```env
REACT_APP_USE_DIRECT_DYNAMODB=true
REACT_APP_COGNITO_IDENTITY_POOL_ID=<identity-pool-id-from-step-1>
REACT_APP_AWS_REGION=us-east-1
```

### 3. Rebuild and Deploy

```bash
npm run build
npm run deploy-frontend
```

## How It Works

When `REACT_APP_USE_DIRECT_DYNAMODB=true`:
- The frontend uses AWS SDK to access DynamoDB directly
- Uses Cognito Identity Pool for authentication
- All GraphQL queries/mutations are replaced with direct DynamoDB calls
- No Lambda/API Gateway layer needed

## Benefits

- ✅ No CORS issues (direct DynamoDB access)
- ✅ Lower latency (no API Gateway/Lambda overhead)
- ✅ Lower costs (no Lambda invocations)
- ✅ Simpler architecture

## Disadvantages

- ❌ Less flexible (can't easily add business logic)
- ❌ Requires IAM permissions setup
- ❌ No GraphQL schema validation

## Reverting to Lambda/GraphQL

Set `REACT_APP_USE_DIRECT_DYNAMODB=false` or remove it from `.env` to use the GraphQL endpoint.

