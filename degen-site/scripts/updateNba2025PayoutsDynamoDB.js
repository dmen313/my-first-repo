#!/usr/bin/env node

/**
 * Script to update NBA 2025 payout structure in DynamoDB to match NBA 2024
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-payouts';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// NBA 2024/2025 payout structure (same for both)
const nbaPayouts = [
  { level: 'Play-In', teams: 4, percentage: 5.00 },
  { level: 'Playoffs', teams: 16, percentage: 12.00 },
  { level: 'Conference Semis', teams: 8, percentage: 18.00 },
  { level: 'Conference Finals', teams: 4, percentage: 20.00 },
  { level: 'NBA Finals', teams: 2, percentage: 20.00 },
  { level: 'Champion', teams: 1, percentage: 8.00 },
  { level: 'Worst Team', teams: 1, percentage: 3.00 },
  { level: '1st West All-Star', teams: 1, percentage: 5.00 },
  { level: '1st East All-Star', teams: 1, percentage: 5.00 },
  { level: '2nd West All-Star', teams: 1, percentage: 2.00 },
  { level: '2nd East All-Star', teams: 1, percentage: 2.00 }
];

async function updatePayouts() {
  console.log('💰 Updating NBA 2025 payout structure in DynamoDB to match NBA 2024...\n');

  try {
    // Query existing payouts for NBA 2025
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': 'nba',
        ':season': '2025'
      }
    });

    const queryResult = await docClient.send(queryCommand);
    const existingPayouts = queryResult.Items || [];

    console.log(`Found ${existingPayouts.length} existing payouts for NBA 2025`);

    if (existingPayouts.length > 0) {
      // Delete existing payouts
      console.log('\n🗑️  Deleting existing payouts...');
      for (const payout of existingPayouts) {
        const deleteCommand = new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id: payout.id }
        });
        await docClient.send(deleteCommand);
        console.log(`   Deleted: ${payout.level}`);
      }
      console.log(`✅ Deleted ${existingPayouts.length} existing payouts\n`);
    }

    // Create new payouts matching NBA 2024 structure
    console.log('🔄 Creating new payout structure (matching NBA 2024)...');
    for (const payout of nbaPayouts) {
      const newPayout = {
        id: uuidv4(),
        league: 'nba',
        season: '2025',
        level: payout.level,
        teams: payout.teams,
        percentage: payout.percentage,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const putCommand = new PutCommand({
        TableName: TABLE_NAME,
        Item: newPayout
      });

      await docClient.send(putCommand);
      console.log(`✅ Created: ${payout.level} (${payout.teams} teams, ${payout.percentage}%)`);
    }

    console.log('\n✅ NBA 2025 payout structure updated successfully!');
    console.log('\nNew structure (matching NBA 2024):');
    nbaPayouts.forEach(p => {
      console.log(`  - ${p.level}: ${p.teams} teams, ${p.percentage}%`);
    });
    console.log(`\nTotal: ${nbaPayouts.reduce((sum, p) => sum + p.percentage, 0)}%`);

  } catch (error) {
    console.error('❌ Error updating payouts:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updatePayouts();

