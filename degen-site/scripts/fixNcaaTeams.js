#!/usr/bin/env node

/**
 * Script to fix NCAA team records:
 * 1. Delete duplicate entries with lowercase "ncaa" league
 * 2. Update teams with NULL season to have season: "2025"
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TEAMS_TABLE = 'sports-hub-teams';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function fixNcaaTeams() {
  console.log('🏈 Fixing NCAA team records...\n');

  try {
    // Step 1: Find and delete all lowercase "ncaa" entries (duplicates)
    console.log('📋 Step 1: Finding lowercase "ncaa" entries to delete...');
    
    const lowercaseScan = await docClient.send(new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: '#league = :ncaa',
      ExpressionAttributeNames: { '#league': 'league' },
      ExpressionAttributeValues: { ':ncaa': 'ncaa' }
    }));
    
    const lowercaseTeams = lowercaseScan.Items || [];
    console.log(`   Found ${lowercaseTeams.length} duplicate entries with lowercase "ncaa"`);
    
    if (lowercaseTeams.length > 0) {
      console.log('\n🗑️  Deleting duplicate entries...');
      for (const team of lowercaseTeams) {
        await docClient.send(new DeleteCommand({
          TableName: TEAMS_TABLE,
          Key: { id: team.id }
        }));
        console.log(`   ❌ Deleted duplicate: ${team.name} (${team.id})`);
      }
      console.log(`\n✅ Deleted ${lowercaseTeams.length} duplicate entries\n`);
    }

    // Step 2: Find teams with NULL season and update to "2025"
    console.log('📋 Step 2: Finding teams with NULL season...');
    
    const nullSeasonScan = await docClient.send(new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: '#league = :NCAA AND (attribute_not_exists(#season) OR #season = :none)',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':NCAA': 'NCAA', ':none': 'None' }
    }));
    
    const nullSeasonTeams = nullSeasonScan.Items || [];
    console.log(`   Found ${nullSeasonTeams.length} teams with NULL/None season`);
    
    if (nullSeasonTeams.length > 0) {
      console.log('\n🔄 Updating teams with season: "2025"...');
      for (const team of nullSeasonTeams) {
        await docClient.send(new UpdateCommand({
          TableName: TEAMS_TABLE,
          Key: { id: team.id },
          UpdateExpression: 'SET #season = :season, #updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#season': 'season', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: { ':season': '2025', ':updatedAt': new Date().toISOString() }
        }));
        console.log(`   ✅ Updated: ${team.name} -> season: "2025"`);
      }
      console.log(`\n✅ Updated ${nullSeasonTeams.length} teams with season: "2025"\n`);
    }

    // Step 3: Verify the fix
    console.log('📋 Step 3: Verifying NCAA 2025 teams...');
    
    const verifyScan = await docClient.send(new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: '#league = :NCAA AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':NCAA': 'NCAA', ':season': '2025' }
    }));
    
    const ncaaTeams = verifyScan.Items || [];
    console.log(`✅ Total NCAA 2025 teams: ${ncaaTeams.length}`);
    
    // Check for Ohio State specifically
    const ohioState = ncaaTeams.find(t => t.name === 'Ohio State');
    if (ohioState) {
      console.log(`✅ Ohio State found: ${ohioState.name} (season: ${ohioState.season})`);
    } else {
      console.log('⚠️  Ohio State not found in NCAA 2025');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ NCAA team cleanup complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error fixing NCAA teams:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixNcaaTeams();

