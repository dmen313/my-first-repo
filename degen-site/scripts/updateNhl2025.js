#!/usr/bin/env node

/**
 * Update NHL 2025 - Fix team name and draft order
 * - Change Arizona Coyotes to Utah Mammoth
 * - Change draft order to DM, MC, KH, TG
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  teams: 'sports-hub-teams',
  draftPicks: 'sports-hub-draft-picks'
};

// New draft order
const OWNERS = ['DM', 'MC', 'KH', 'TG'];

// Generate unique ID
function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function updateTeamName() {
  console.log('🏒 Updating Arizona Coyotes to Utah Mammoth...\n');
  
  // Find the Arizona Coyotes team
  const scanCommand = new ScanCommand({
    TableName: TABLES.teams,
    FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague AND #name = :name',
    ExpressionAttributeNames: {
      '#season': 'season',
      '#sportsLeague': 'sportsLeague',
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':season': '2025',
      ':sportsLeague': 'NHL',
      ':name': 'Arizona Coyotes'
    }
  });
  
  const result = await docClient.send(scanCommand);
  
  if (!result.Items || result.Items.length === 0) {
    console.log('   ⚠️  Arizona Coyotes not found - may already be updated');
    return;
  }
  
  const team = result.Items[0];
  
  // Update the team name
  const updateCommand = new UpdateCommand({
    TableName: TABLES.teams,
    Key: { id: team.id },
    UpdateExpression: 'SET #name = :newName, updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#name': 'name'
    },
    ExpressionAttributeValues: {
      ':newName': 'Utah Mammoth',
      ':updatedAt': new Date().toISOString()
    }
  });
  
  await docClient.send(updateCommand);
  console.log('   ✅ Updated: Arizona Coyotes → Utah Mammoth');
}

async function recreateDraftPicks() {
  console.log('\n📋 Recreating draft picks with new order...\n');
  console.log(`   New draft order: ${OWNERS.join(' → ')}\n`);
  
  // First, delete existing draft picks
  const queryCommand = new QueryCommand({
    TableName: TABLES.draftPicks,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': 'nhl',
      ':season': '2025'
    }
  });
  
  const existingPicks = await docClient.send(queryCommand);
  
  if (existingPicks.Items && existingPicks.Items.length > 0) {
    console.log(`   Deleting ${existingPicks.Items.length} existing draft picks...`);
    
    for (const pick of existingPicks.Items) {
      const deleteCommand = new DeleteCommand({
        TableName: TABLES.draftPicks,
        Key: { id: pick.id }
      });
      await docClient.send(deleteCommand);
    }
    console.log('   ✓ Existing picks deleted\n');
  }
  
  // Create new draft picks with updated order
  const now = new Date().toISOString();
  const totalTeams = 32;
  const ownersCount = OWNERS.length;
  const totalRounds = Math.ceil(totalTeams / ownersCount); // 8 rounds
  
  let pickNumber = 1;
  
  for (let round = 1; round <= totalRounds; round++) {
    // Snake draft: reverse order on even rounds
    const roundOwners = round % 2 === 0 ? [...OWNERS].reverse() : [...OWNERS];
    
    for (const owner of roundOwners) {
      const pick = {
        id: generateId(),
        league: 'nhl',
        season: '2025',
        round: round,
        pickNumber: pickNumber,
        owner: owner,
        teamId: null,
        teamName: null,
        createdAt: now,
        updatedAt: now
      };
      
      const putCommand = new PutCommand({
        TableName: TABLES.draftPicks,
        Item: pick
      });
      
      await docClient.send(putCommand);
      pickNumber++;
    }
    
    console.log(`   ✅ Round ${round}: ${roundOwners.join(' → ')}`);
  }
  
  console.log(`\n   ✅ Created ${pickNumber - 1} draft picks`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏒 NHL 2025 Update');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    await updateTeamName();
    await recreateDraftPicks();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ NHL 2025 Update Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📋 Draft order: ${OWNERS.join(' → ')}`);
    console.log('🏒 Utah Mammoth replaces Arizona Coyotes');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

