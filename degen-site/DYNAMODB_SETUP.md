# DynamoDB Setup Guide

This guide will help you set up your Sports Hub application to use AWS DynamoDB instead of file-based storage.

## Prerequisites

1. **AWS Account** - You need an active AWS account
2. **AWS CLI Installed** - Already done! ✅
3. **AWS Credentials Configured** - Already done! ✅

## Step 1: Verify AWS Setup

```bash
# Check AWS CLI is configured
aws configure list

# Test AWS connection
aws sts get-caller-identity
```

You should see your AWS account ID. If not, run:
```bash
aws configure
```

Enter:
- AWS Access Key ID
- AWS Secret Access Key  
- Default region: `us-east-1` (or your preferred region)
- Default output format: `json`

## Step 2: Create DynamoDB Tables

Run the setup script to create all necessary DynamoDB tables:

```bash
npm run setup-dynamodb
```

This will create 7 tables:
- `sports-hub-teams` - Stores all team data
- `sports-hub-achievements` - Team achievements
- `sports-hub-payouts` - Payout structures
- `sports-hub-league-settings` - League configuration
- `sports-hub-team-mappings` - Team mapping data
- `sports-hub-owners` - Owner information
- `sports-hub-draft-picks` - Draft pick data

**Note**: Tables are created with **on-demand pricing** (pay per request), so you only pay for what you use.

## Step 3: Migrate Existing Data

Migrate your existing data from `data/datastore.json` to DynamoDB:

```bash
npm run migrate-to-dynamodb
```

This script will:
- Load data from `data/datastore.json`
- Upload all data to DynamoDB tables
- Show progress and confirmation

## Step 4: Update Environment Variables

Add to your `.env` file:

```env
USE_DYNAMODB=true
AWS_REGION=us-east-1
```

## Step 5: Update DataStore to Use DynamoDB

The `DynamoDBAdapter` class is already created. You'll need to modify `src/graphql/dataStore.js` to use DynamoDB when the environment variable is set.

**Option A: Conditional Import (Recommended)**
```javascript
// At the top of dataStore.js
import { DynamoDBAdapter } from './dynamoDBAdapter.js';

const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true';
const dbAdapter = USE_DYNAMODB ? new DynamoDBAdapter() : null;
```

**Option B: Separate DataStore Class**
Create a new `DynamoDBDataStore` class that extends or wraps the adapter.

## Step 6: Test the Setup

1. Restart your GraphQL server
2. Test queries to ensure data is loading from DynamoDB
3. Check CloudWatch logs for any errors

## Verification

### Check Tables in AWS Console

1. Go to AWS Console → DynamoDB
2. Click "Tables" in the sidebar
3. You should see all 7 tables listed

### Verify Data

```bash
# Check if teams were migrated
aws dynamodb scan --table-name sports-hub-teams --limit 5
```

## Cost Estimate

With on-demand pricing (default):
- **Write requests**: $1.25 per million writes
- **Read requests**: $0.25 per million reads
- **Storage**: $0.25 per GB-month

**Example monthly costs** (typical usage):
- 100,000 reads/month: ~$0.03
- 10,000 writes/month: ~$0.01
- 1 GB storage: ~$0.25
- **Total: ~$0.30/month** for light usage

For heavier usage, consider provisioned capacity:
- 5 RCU / 5 WCU: ~$1.50/month base + usage

## Troubleshooting

### "Access Denied" Error
- Check IAM permissions - your user needs DynamoDB permissions
- Create IAM policy with `dynamodb:*` permissions (or specific table permissions)

### "Table not found" Error
- Make sure tables were created successfully
- Check table names match exactly
- Verify AWS region is correct

### Migration fails
- Check `data/datastore.json` exists and is valid JSON
- Verify AWS credentials are valid
- Check CloudWatch logs for detailed errors

### Data not showing up
- Check if migration completed successfully
- Verify `USE_DYNAMODB=true` in `.env`
- Restart GraphQL server after changing env vars

## Next Steps

1. ✅ Tables created
2. ✅ Data migrated
3. ⏭️ Update code to use DynamoDB adapter
4. ⏭️ Deploy to AWS
5. ⏭️ Set up CloudWatch monitoring

## Useful AWS CLI Commands

```bash
# List all tables
aws dynamodb list-tables

# Get table info
aws dynamodb describe-table --table-name sports-hub-teams

# Count items in table
aws dynamodb scan --table-name sports-hub-teams --select COUNT

# Query by league and season
aws dynamodb query \
  --table-name sports-hub-teams \
  --index-name league-season-index \
  --key-condition-expression "league = :league AND season = :season" \
  --expression-attribute-values '{":league":{"S":"mlb"},":season":{"S":"2025"}}'
```

## IAM Policy Example

If you need to create an IAM policy for DynamoDB access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/sports-hub-*",
        "arn:aws:dynamodb:*:*:table/sports-hub-*/index/*"
      ]
    }
  ]
}
```

Good luck! 🚀

