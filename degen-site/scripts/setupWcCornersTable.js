#!/usr/bin/env node

/**
 * Create DynamoDB table for WC 2026 corner model data.
 */

require('dotenv').config();
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-wc-corners';

const TABLE_DEF = {
  TableName: TABLE_NAME,
  KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
  AttributeDefinitions: [
    { AttributeName: 'id', AttributeType: 'S' },
    { AttributeName: 'league', AttributeType: 'S' },
    { AttributeName: 'season', AttributeType: 'S' },
    { AttributeName: 'entityType', AttributeType: 'S' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'league-season-index',
      KeySchema: [
        { AttributeName: 'league', KeyType: 'HASH' },
        { AttributeName: 'season', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'entity-type-index',
      KeySchema: [
        { AttributeName: 'entityType', KeyType: 'HASH' },
        { AttributeName: 'season', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
  BillingMode: 'PAY_PER_REQUEST',
};

async function main() {
  const client = new DynamoDBClient({ region: REGION });
  const sts = new STSClient({ region: REGION });
  const identity = await sts.send(new GetCallerIdentityCommand({}));
  console.log(`AWS account: ${identity.Account}`);
  console.log(`Creating table ${TABLE_NAME}...`);
  try {
    await client.send(new CreateTableCommand(TABLE_DEF));
    console.log(`✅ Table ${TABLE_NAME} created`);
    console.log('   Waiting for table to become active...');
    await new Promise((resolve) => setTimeout(resolve, 8000));
  } catch (err) {
    if (err.name === 'ResourceInUseException') {
      console.log(`⏭️  Table ${TABLE_NAME} already exists`);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
