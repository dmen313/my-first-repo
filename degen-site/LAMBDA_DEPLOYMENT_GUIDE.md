# Lambda + DynamoDB Deployment Guide

Deploy your GraphQL backend to AWS Lambda (serverless) with DynamoDB for data storage. No EC2, no glibc issues!

## Prerequisites

1. **DynamoDB Tables Created** - See `DYNAMODB_PERMISSIONS.md`
2. **Data Migrated** - Run `npm run migrate-to-dynamodb`

## Step 1: Set Up DynamoDB

### Option A: Request Permissions (Recommended)

Ask your AWS administrator to add DynamoDB permissions (see `DYNAMODB_PERMISSIONS.md`), then run:

```bash
npm run setup-dynamodb
npm run migrate-to-dynamodb
```

### Option B: Create Tables Manually

1. Go to AWS Console → DynamoDB → Create table
2. Create each table (see `DYNAMODB_PERMISSIONS.md` for details)
3. After tables are created:
   ```bash
   npm run migrate-to-dynamodb
   ```

## Step 2: Deploy Lambda Function

Once DynamoDB is set up:

```bash
npm run deploy-lambda
```

This will:
1. ✅ Create Lambda function
2. ✅ Create API Gateway
3. ✅ Set up integration
4. ✅ Deploy API
5. ✅ Provide you with the endpoint URL

## Step 3: Update Frontend

After deployment, update your `.env`:

```env
REACT_APP_GRAPHQL_ENDPOINT=https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/graphql
```

Then rebuild and redeploy frontend:

```bash
npm run deploy-frontend
```

## Benefits of Lambda + DynamoDB

- ✅ **No server management** - Fully serverless
- ✅ **No glibc issues** - Lambda runs Node.js 18 runtime
- ✅ **Auto-scaling** - Handles traffic automatically
- ✅ **Pay per request** - Very cost-effective
- ✅ **No SSH/deployment issues** - Just upload code

## Cost Estimate

**Lambda:**
- First 1M requests/month: FREE
- After that: ~$0.20 per 1M requests

**API Gateway:**
- First 1M requests/month: FREE (REST API)
- After that: ~$3.50 per 1M requests

**DynamoDB (on-demand):**
- Reads: ~$0.25 per million
- Writes: ~$1.25 per million
- Storage: ~$0.25 per GB/month

**Total for typical usage: < $5/month**

## Troubleshooting

### "Access Denied" when creating tables
- Request DynamoDB permissions (see `DYNAMODB_PERMISSIONS.md`)
- Or create tables manually via console

### Lambda deployment fails
- Check IAM permissions for Lambda and API Gateway
- Ensure you have permissions to create functions and APIs

### Data not showing
- Make sure `USE_DYNAMODB=true` in Lambda environment variables
- Verify data migration completed: `npm run migrate-to-dynamodb`
- Check CloudWatch logs for errors

## Next Steps

1. ✅ Create DynamoDB tables
2. ✅ Migrate data to DynamoDB
3. ✅ Deploy Lambda function
4. ✅ Update frontend endpoint
5. ✅ Test the application

Your backend will be fully serverless! 🚀

