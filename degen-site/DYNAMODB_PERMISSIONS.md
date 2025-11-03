# DynamoDB Setup - Permission Request

You need DynamoDB permissions to create tables. Here are two options:

## Option 1: Request DynamoDB Permissions

Ask your AWS administrator to add this to your IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DescribeTable",
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem",
        "dynamodb:ListTables"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:503561456148:table/sports-hub-*",
        "arn:aws:dynamodb:us-east-1:503561456148:table/sports-hub-*/index/*"
      ]
    }
  ]
}
```

Or attach the managed policy: `AmazonDynamoDBFullAccess`

## Option 2: Create Tables Manually via AWS Console

If you have console access, create these tables manually:

### 1. Go to AWS Console → DynamoDB → Tables → Create table

### 2. Create each table:

#### Table: `sports-hub-teams`
- Partition key: `id` (String)
- Sort key: (none)
- Table settings: Use default settings
- Additional settings:
  - Add GSI: Name `league-season-index`
    - Partition key: `league` (String)
    - Sort key: `season` (String)

#### Table: `sports-hub-achievements`
- Partition key: `id` (String)

#### Table: `sports-hub-payouts`
- Partition key: `id` (String)

#### Table: `sports-hub-league-settings`
- Partition key: `id` (String)

#### Table: `sports-hub-team-mappings`
- Partition key: `id` (String)

#### Table: `sports-hub-owners`
- Partition key: `id` (String)

#### Table: `sports-hub-draft-picks`
- Partition key: `id` (String)

### 3. After tables are created, migrate data:

```bash
npm run migrate-to-dynamodb
```

This will copy your data from `data/datastore.json` to DynamoDB.

## Next Steps After Tables Are Created

1. ✅ Tables created (manual or via script)
2. ⏭️ Migrate data: `npm run migrate-to-dynamodb`
3. ⏭️ Deploy Lambda function: `npm run deploy-lambda`
4. ⏭️ Update frontend with Lambda endpoint

