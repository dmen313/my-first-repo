#!/usr/bin/env node

/**
 * Script to sync NCAA 2025 team owners from draft picks
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TEAMS_TABLE = 'sports-hub-teams';
const DRAFT_PICKS_TABLE = 'sports-hub-draft-picks';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function syncNcaaOwners() {
  console.log('🏈 Syncing NCAA 2025 team owners from draft picks...\n');

  try {
    // Get all draft picks for NCAA 2025
    const draftPicksScan = await docClient.send(new ScanCommand({
      TableName: DRAFT_PICKS_TABLE,
      FilterExpression: '#league = :ncaa AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':ncaa': 'ncaa', ':season': '2025' }
    }));
    
    const draftPicks = draftPicksScan.Items || [];
    console.log(`📋 Found ${draftPicks.length} draft picks for NCAA 2025`);
    
    // Filter to only picks with teams assigned
    const assignedPicks = draftPicks.filter(p => p.teamId && p.teamName);
    console.log(`✅ ${assignedPicks.length} picks have teams assigned\n`);
    
    // Sort by round and pick number
    assignedPicks.sort((a, b) => {
      if (a.round !== b.round) return parseInt(a.round) - parseInt(b.round);
      return parseInt(a.pickNumber) - parseInt(b.pickNumber);
    });
    
    // Update each team with the owner from the draft pick
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const pick of assignedPicks) {
      try {
        // First check if the team exists and get current owner
        const teamResult = await docClient.send(new GetCommand({
          TableName: TEAMS_TABLE,
          Key: { id: pick.teamId }
        }));
        
        if (!teamResult.Item) {
          console.log(`⚠️  Team not found: ${pick.teamName} (${pick.teamId})`);
          skippedCount++;
          continue;
        }
        
        const currentOwner = teamResult.Item.owner;
        
        // Skip if already has the correct owner
        if (currentOwner === pick.owner) {
          skippedCount++;
          continue;
        }
        
        // Update the team with the owner
        await docClient.send(new UpdateCommand({
          TableName: TEAMS_TABLE,
          Key: { id: pick.teamId },
          UpdateExpression: 'SET #owner = :owner, #updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#owner': 'owner', '#updatedAt': 'updatedAt' },
          ExpressionAttributeValues: { 
            ':owner': pick.owner, 
            ':updatedAt': new Date().toISOString() 
          }
        }));
        
        console.log(`✅ Updated: ${pick.teamName} -> ${pick.owner} (Round ${pick.round}, Pick ${pick.pickNumber})`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error updating ${pick.teamName}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Sync Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Teams updated: ${updatedCount}`);
    console.log(`⏭️  Teams skipped (already correct): ${skippedCount}`);
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
    console.error('\n❌ Error syncing owners:', error.message);
    console.error(error);
    process.exit(1);
  }
}

syncNcaaOwners();

