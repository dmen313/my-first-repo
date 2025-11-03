#!/usr/bin/env node

/**
 * Script to create DynamoDB tables for Sports Hub application
 * Run this once to set up your DynamoDB infrastructure
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, CreateTableCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = [
  {
    TableName: 'sports-hub-teams',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'league', AttributeType: 'S' },
      { AttributeName: 'season', AttributeType: 'S' },
      { AttributeName: 'name', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'league-season-index',
        KeySchema: [
          { AttributeName: 'league', KeyType: 'HASH' },
          { AttributeName: 'season', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      },
      {
        IndexName: 'name-index',
        KeySchema: [
          { AttributeName: 'name', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST' // On-demand pricing
  },
  {
    TableName: 'sports-hub-achievements',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'teamId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'teamId-index',
        KeySchema: [
          { AttributeName: 'teamId', KeyType: 'HASH' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'sports-hub-payouts',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'league', AttributeType: 'S' },
      { AttributeName: 'season', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'league-season-index',
        KeySchema: [
          { AttributeName: 'league', KeyType: 'HASH' },
          { AttributeName: 'season', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'sports-hub-league-settings',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'league', AttributeType: 'S' },
      { AttributeName: 'season', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'league-season-index',
        KeySchema: [
          { AttributeName: 'league', KeyType: 'HASH' },
          { AttributeName: 'season', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'sports-hub-team-mappings',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'sports-hub-owners',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  },
  {
    TableName: 'sports-hub-draft-picks',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'league', AttributeType: 'S' },
      { AttributeName: 'season', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'league-season-index',
        KeySchema: [
          { AttributeName: 'league', KeyType: 'HASH' },
          { AttributeName: 'season', KeyType: 'RANGE' }
        ],
        Projection: {
          ProjectionType: 'ALL'
        }
      }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  }
];

async function createTable(tableDef) {
  try {
    console.log(`📦 Creating table: ${tableDef.TableName}...`);
    
    // Use low-level client for table creation
    const { DynamoDBClient: LowLevelClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
    const lowLevelClient = new LowLevelClient({ 
      region: process.env.AWS_REGION || 'us-east-1' 
    });
    
    const command = new CreateTableCommand(tableDef);
    await lowLevelClient.send(command);
    
    console.log(`✅ Table ${tableDef.TableName} created successfully`);
    
    // Wait for table to be active (simple wait, in production use DescribeTable)
    console.log(`   Waiting for table to become active...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return true;
  } catch (error) {
    if (error.name === 'ResourceInUseException') {
      console.log(`⏭️  Table ${tableDef.TableName} already exists, skipping...`);
      return false;
    } else {
      console.error(`❌ Error creating table ${tableDef.TableName}:`, error.message);
      throw error;
    }
  }
}

async function main() {
  console.log('🚀 Setting up DynamoDB tables for Sports Hub...\n');
  
  try {
    // Verify AWS credentials
    const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
    const stsClient = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    console.log(`✅ AWS credentials verified (Account: ${identity.Account})\n`);
    
    let created = 0;
    let skipped = 0;
    
    for (const tableDef of TABLES) {
      const result = await createTable(tableDef);
      if (result) {
        created++;
      } else {
        skipped++;
      }
      console.log('');
    }
    
    console.log('✅ DynamoDB setup complete!');
    console.log(`📊 Created: ${created} tables`);
    console.log(`⏭️  Skipped (already exist): ${skipped} tables`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Run: npm run migrate-to-dynamodb`);
    console.log(`   2. Update your .env to set: USE_DYNAMODB=true`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.code === 'CredentialsError' || error.code === 'UnknownEndpoint') {
      console.error('\n💡 Make sure AWS credentials are configured:');
      console.error('   aws configure');
    }
    process.exit(1);
  }
}

main();

