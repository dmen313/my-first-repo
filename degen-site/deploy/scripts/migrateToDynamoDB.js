#!/usr/bin/env node

/**
 * Migration script to move data from datastore.json to DynamoDB
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'us-east-1' 
});
const docClient = DynamoDBDocumentClient.from(client);

const DATASTORE_FILE = path.join(__dirname, '../data/datastore.json');

// Batch size for DynamoDB writes (max 25 items per batch)
const BATCH_SIZE = 25;

async function batchWrite(tableName, items) {
  if (items.length === 0) return;
  
  // Split into batches of 25
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    const writeRequests = batch.map(item => ({
      PutRequest: {
        Item: item
      }
    }));
    
    try {
      const command = new BatchWriteCommand({
        RequestItems: {
          [tableName]: writeRequests
        }
      });
      
      await docClient.send(command);
      console.log(`  ✅ Wrote batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items) to ${tableName}`);
      
      // Small delay to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`  ❌ Error writing batch to ${tableName}:`, error.message);
      throw error;
    }
  }
}

async function migrateTable(tableName, items) {
  if (!items || items.length === 0) {
    console.log(`⏭️  No items to migrate for ${tableName}`);
    return 0;
  }
  
  console.log(`\n📦 Migrating ${items.length} items to ${tableName}...`);
  
  try {
    await batchWrite(tableName, items);
    console.log(`✅ Successfully migrated ${items.length} items to ${tableName}`);
    return items.length;
  } catch (error) {
    console.error(`❌ Failed to migrate ${tableName}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting migration to DynamoDB...\n');
  
  // Check if datastore.json exists
  if (!fs.existsSync(DATASTORE_FILE)) {
    console.error(`❌ Data file not found: ${DATASTORE_FILE}`);
    console.error('   Make sure you have data in data/datastore.json');
    process.exit(1);
  }
  
  // Load data from JSON file
  console.log(`📂 Loading data from ${DATASTORE_FILE}...`);
  let data;
  try {
    const fileContent = fs.readFileSync(DATASTORE_FILE, 'utf8');
    data = JSON.parse(fileContent);
    console.log('✅ Data loaded successfully\n');
  } catch (error) {
    console.error(`❌ Error loading data file:`, error.message);
    process.exit(1);
  }
  
  // Verify AWS credentials
  try {
    const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
    const stsClient = new STSClient({ region: process.env.AWS_REGION || 'us-east-1' });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    console.log(`✅ AWS credentials verified (Account: ${identity.Account})\n`);
  } catch (error) {
    console.error('❌ AWS credentials error:', error.message);
    console.error('   Make sure AWS credentials are configured: aws configure');
    process.exit(1);
  }
  
  let totalMigrated = 0;
  
  try {
    // Migrate teams
    const teamsMigrated = await migrateTable('sports-hub-teams', data.teams || []);
    totalMigrated += teamsMigrated;
    
    // Migrate achievements
    const achievementsMigrated = await migrateTable('sports-hub-achievements', data.achievements || []);
    totalMigrated += achievementsMigrated;
    
    // Migrate payout rows
    const payoutsMigrated = await migrateTable('sports-hub-payouts', data.payoutRows || []);
    totalMigrated += payoutsMigrated;
    
    // Migrate league settings
    const settingsMigrated = await migrateTable('sports-hub-league-settings', data.leagueSettings || []);
    totalMigrated += settingsMigrated;
    
    // Migrate team mappings
    const mappingsMigrated = await migrateTable('sports-hub-team-mappings', data.teamMappings || []);
    totalMigrated += mappingsMigrated;
    
    // Migrate owners
    const ownersMigrated = await migrateTable('sports-hub-owners', data.owners || []);
    totalMigrated += ownersMigrated;
    
    // Migrate draft picks
    const draftPicksMigrated = await migrateTable('sports-hub-draft-picks', data.draftPicks || []);
    totalMigrated += draftPicksMigrated;
    
    console.log('\n✅ Migration complete!');
    console.log(`📊 Total items migrated: ${totalMigrated}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Test your application with DynamoDB');
    console.log('   2. Update your .env: USE_DYNAMODB=true');
    console.log('   3. Restart your GraphQL server');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();

