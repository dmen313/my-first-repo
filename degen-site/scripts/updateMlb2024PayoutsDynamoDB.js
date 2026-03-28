#!/usr/bin/env node
/**
 * Update MLB 2024 payout structure directly in DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, DeleteCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-payouts';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// New MLB 2024 payout structure
const newPayouts = [
  { level: 'Wild Card', teams: 4, percentage: 5.00 },
  { level: 'Division', teams: 8, percentage: 20.00 },
  { level: 'League', teams: 4, percentage: 24.00 },
  { level: 'World Series', teams: 2, percentage: 24.00 },
  { level: 'Winner', teams: 1, percentage: 27.00 }
];

async function updatePayouts() {
  console.log('💰 Updating MLB 2024 payout structure in DynamoDB...\n');

  try {
    // Query existing payouts for MLB 2024
    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': 'mlb',
        ':season': '2024'
      }
    });

    const queryResult = await docClient.send(queryCommand);
    const existingPayouts = queryResult.Items || [];

    console.log(`Found ${existingPayouts.length} existing payouts for MLB 2024`);

    // Delete existing payouts
    for (const payout of existingPayouts) {
      const deleteCommand = new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: payout.id }
      });
      await docClient.send(deleteCommand);
    }

    console.log(`✅ Deleted ${existingPayouts.length} existing payouts\n`);

    // Create new payouts
    for (const payout of newPayouts) {
      const newPayout = {
        id: uuidv4(),
        league: 'mlb',
        season: '2024',
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

    console.log('\n✅ MLB 2024 payout structure updated successfully!');
    console.log('\nNew structure:');
    newPayouts.forEach(p => {
      console.log(`  - ${p.level}: ${p.teams} teams, ${p.percentage}%`);
    });
    console.log(`\nTotal: ${newPayouts.reduce((sum, p) => sum + p.percentage, 0)}%`);

  } catch (error) {
    console.error('❌ Error updating payouts:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

updatePayouts();

