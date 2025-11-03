# DynamoDB Quick Start

Your AWS CLI is already installed and configured! ✅

## Quick Setup (3 Steps)

### Step 1: Create DynamoDB Tables

```bash
npm run setup-dynamodb
```

This creates 7 tables with on-demand pricing (you only pay for what you use).

### Step 2: Migrate Your Data

```bash
npm run migrate-to-dynamodb
```

This copies all data from `data/datastore.json` to DynamoDB.

### Step 3: Enable DynamoDB in Your App

Add to your `.env` file:

```env
USE_DYNAMODB=true
AWS_REGION=us-east-1
```

Then update `src/graphql/dataStore.js` to use the DynamoDB adapter when this flag is set.

## What Was Created

### Scripts
- ✅ `scripts/setupDynamoDB.js` - Creates all DynamoDB tables
- ✅ `scripts/migrateToDynamoDB.js` - Migrates data from JSON to DynamoDB

### Code
- ✅ `src/graphql/dynamoDBAdapter.js` - DynamoDB adapter class with all CRUD operations

### Documentation
- ✅ `DYNAMODB_SETUP.md` - Complete setup guide
- ✅ `AWS_DEPLOYMENT_GUIDE.md` - Full AWS deployment guide

## Next Steps

1. **Run setup** (creates tables):
   ```bash
   npm run setup-dynamodb
   ```

2. **Migrate data** (copies your data):
   ```bash
   npm run migrate-to-dynamodb
   ```

3. **Integrate into code** - Update `dataStore.js` to conditionally use DynamoDB

4. **Test locally** - Make sure everything works

5. **Deploy to AWS** - Use the AWS Deployment Guide

## Cost

With on-demand pricing:
- **~$0.30/month** for typical usage
- No upfront costs
- Pay only for reads/writes you use

## Need Help?

Check `DYNAMODB_SETUP.md` for detailed instructions and troubleshooting.

