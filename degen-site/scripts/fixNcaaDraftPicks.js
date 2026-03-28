#!/usr/bin/env node

/**
 * Script to fix NCAA 2025 draft picks to use correct team IDs
 * and then sync owners to teams
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TEAMS_TABLE = 'sports-hub-teams';
const DRAFT_PICKS_TABLE = 'sports-hub-draft-picks';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function fixNcaaDraftPicks() {
  console.log('🏈 Fixing NCAA 2025 draft picks and syncing owners...\n');

  try {
    // Step 1: Get all NCAA 2025 teams
    console.log('📋 Step 1: Getting current NCAA 2025 teams...');
    const teamsScan = await docClient.send(new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: '#league = :NCAA AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':NCAA': 'NCAA', ':season': '2025' }
    }));
    
    const teams = teamsScan.Items || [];
    console.log(`   Found ${teams.length} teams`);
    
    // Create a map of team name -> team
    const teamsByName = {};
    teams.forEach(team => {
      teamsByName[team.name.toLowerCase()] = team;
    });

    // Step 2: Get all draft picks for NCAA 2025
    console.log('\n📋 Step 2: Getting draft picks...');
    const draftPicksScan = await docClient.send(new ScanCommand({
      TableName: DRAFT_PICKS_TABLE,
      FilterExpression: '#league = :ncaa AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':ncaa': 'ncaa', ':season': '2025' }
    }));
    
    const draftPicks = draftPicksScan.Items || [];
    const assignedPicks = draftPicks.filter(p => p.teamName);
    console.log(`   Found ${draftPicks.length} draft picks (${assignedPicks.length} with teams)`);

    // Step 3: Fix draft picks with wrong team IDs
    console.log('\n📋 Step 3: Fixing draft pick team IDs...');
    let picksFixed = 0;
    
    for (const pick of assignedPicks) {
      const team = teamsByName[pick.teamName.toLowerCase()];
      
      if (!team) {
        console.log(`⚠️  Team not found in database: ${pick.teamName}`);
        continue;
      }
      
      // Check if team ID needs to be updated
      if (pick.teamId !== team.id) {
        await docClient.send(new UpdateCommand({
          TableName: DRAFT_PICKS_TABLE,
          Key: { id: pick.id },
          UpdateExpression: 'SET #teamId = :teamId, #updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#teamId': 'teamId', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: { 
            ':teamId': team.id, 
            ':updatedAt': new Date().toISOString() 
          }
        }));
        console.log(`✅ Fixed: ${pick.teamName} (${pick.teamId} -> ${team.id})`);
        picksFixed++;
      }
    }
    
    console.log(`\n   Fixed ${picksFixed} draft picks`);

    // Step 4: Sync owners from draft picks to teams
    console.log('\n📋 Step 4: Syncing owners to teams...');
    let ownersUpdated = 0;
    
    for (const pick of assignedPicks) {
      const team = teamsByName[pick.teamName.toLowerCase()];
      
      if (!team) continue;
      
      // Update team owner if different
      if (team.owner !== pick.owner) {
        await docClient.send(new UpdateCommand({
          TableName: TEAMS_TABLE,
          Key: { id: team.id },
          UpdateExpression: 'SET #owner = :owner, #updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#owner': 'owner', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: { 
            ':owner': pick.owner, 
            ':updatedAt': new Date().toISOString() 
          }
        }));
        console.log(`✅ ${team.name}: ${team.owner || 'None'} -> ${pick.owner}`);
        ownersUpdated++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Fix Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Draft picks fixed: ${picksFixed}`);
    console.log(`📊 Team owners updated: ${ownersUpdated}`);
    console.log('='.repeat(60));

    // Show owner summary
    console.log('\n📋 Owner Summary:');
    const ownerCounts = { TG: 0, KH: 0, DM: 0, MC: 0 };
    assignedPicks.forEach(p => {
      if (ownerCounts[p.owner] !== undefined) {
        ownerCounts[p.owner]++;
      }
    });
    Object.entries(ownerCounts).forEach(([owner, count]) => {
      console.log(`   ${owner}: ${count} teams`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixNcaaDraftPicks();

