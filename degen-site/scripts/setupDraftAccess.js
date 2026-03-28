#!/usr/bin/env node
/**
 * Setup Draft Access - Create table and give dev.menon@yahoo.com access to all drafts
 */

require('dotenv').config();

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-draft-access';
const ADMIN_EMAIL = 'dev.menon@yahoo.com';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// All leagues to set up access for
const ALL_LEAGUES = [
  { league: 'nfl', season: '2025' },
  { league: 'mlb', season: '2025' },
  { league: 'mlb', season: '2024' },
  { league: 'nba', season: '2025' },
  { league: 'nba', season: '2024' },
  { league: 'ncaa', season: '2025' },
  { league: 'nhl', season: '2025' },
  { league: 'nfl-mvp', season: '2025' }
];

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      return false;
    }
    throw err;
  }
}

async function createTable() {
  console.log(`📋 Creating table: ${TABLE_NAME}`);
  
  const command = new CreateTableCommand({
    TableName: TABLE_NAME,
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
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  });
  
  await client.send(command);
  console.log(`✅ Table created successfully`);
  
  // Wait for table to be active
  console.log('⏳ Waiting for table to be active...');
  let tableActive = false;
  while (!tableActive) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const desc = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    if (desc.Table.TableStatus === 'ACTIVE') {
      tableActive = true;
    }
  }
  console.log('✅ Table is active');
}

async function grantAccessToAllDrafts(email) {
  console.log(`\n🔐 Granting access to ${email} for all drafts...`);
  
  const now = new Date().toISOString();
  
  for (const { league, season } of ALL_LEAGUES) {
    const id = `${league}-${season}-access`;
    
    const item = {
      id,
      league,
      season,
      userEmails: [email],
      createdAt: now,
      updatedAt: now
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));
    
    console.log(`   ✅ ${league}-${season}: Added ${email}`);
  }
  
  console.log(`\n✅ ${email} now has access to all ${ALL_LEAGUES.length} drafts`);
}

async function listCurrentAccess() {
  console.log('\n📋 Current access settings:');
  
  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME
  }));
  
  if (!result.Items || result.Items.length === 0) {
    console.log('   No access records found');
    return;
  }
  
  result.Items.forEach(item => {
    console.log(`   ${item.league}-${item.season}: ${(item.userEmails || []).join(', ') || 'No users'}`);
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔐 Draft Access Setup Script');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Check if table exists
    const exists = await tableExists();
    
    if (!exists) {
      await createTable();
    } else {
      console.log(`✅ Table ${TABLE_NAME} already exists`);
    }
    
    // Grant access to admin email
    await grantAccessToAllDrafts(ADMIN_EMAIL);
    
    // Show current access
    await listCurrentAccess();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ Setup complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
