#!/usr/bin/env node

/**
 * Update NBA 2025 Payout Structure - Direct DynamoDB Access
 * Deletes existing payouts and creates new ones based on the provided values
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
  DynamoDBDocumentClient, 
  QueryCommand, 
  DeleteCommand, 
  PutCommand 
} = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-payouts';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function updateNba2025Payouts() {
  console.log('🏀 Updating NBA 2025 Payout Structure\n');

  try {
    // Step 1: Query existing NBA 2025 payouts
    console.log('🔍 Querying existing NBA 2025 payouts...');
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
    console.log(`   Found ${existingPayouts.length} existing payouts\n`);

    // Step 2: Delete existing payouts
    if (existingPayouts.length > 0) {
      console.log('🗑️  Deleting existing NBA 2025 payouts...');
      for (const payout of existingPayouts) {
        const deleteCommand = new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id: payout.id }
        });
        await docClient.send(deleteCommand);
        console.log(`   ✓ Deleted: ${payout.level}`);
      }
      console.log('✅ Existing payouts deleted\n');
    }

    // Step 3: Create new NBA 2025 payouts
    console.log('📝 Creating new NBA 2025 payouts...');
    
    const newPayouts = [
      { level: 'Round 1', teams: 16, percentage: 16.00 },
      { level: 'Round 2', teams: 8, percentage: 16.00 },
      { level: 'Conference', teams: 4, percentage: 18.00 },
      { level: 'Finals', teams: 2, percentage: 17.50 },
      { level: 'Winner', teams: 1, percentage: 18.50 },
      { level: 'Worst Team', teams: 1, percentage: 2.50 },
      { level: '1st place in west and east conf', teams: 2, percentage: 7.50 },
      { level: '2nd place in west and east conf', teams: 2, percentage: 4.00 }
    ];

    const now = new Date().toISOString();
    
    for (const payout of newPayouts) {
      const item = {
        id: generateId(),
        league: 'nba',
        season: '2025',
        level: payout.level,
        teams: payout.teams,
        percentage: payout.percentage,
        createdAt: now,
        updatedAt: now
      };
      
      const putCommand = new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      });
      
      await docClient.send(putCommand);
      console.log(`   ✓ Created: ${payout.level} - ${payout.teams} teams - ${payout.percentage}%`);
    }

    console.log('\n✅ NBA 2025 Payout Structure Updated Successfully!');
    console.log('\n📊 Summary:');
    console.log('   Total Pool: $2,000');
    console.log('   Payout Levels: 8');
    console.log('   Total Percentage: 100.00%\n');

    // Verify the new structure
    console.log('🔍 Verifying new structure...');
    const verifyResult = await docClient.send(queryCommand);
    const verifyPayouts = verifyResult.Items || [];
    console.log(`   Found ${verifyPayouts.length} payouts after update`);
    
    const totalPercentage = verifyPayouts.reduce((sum, p) => sum + p.percentage, 0);
    console.log(`   Total percentage: ${totalPercentage.toFixed(2)}%`);
    
    if (Math.abs(totalPercentage - 100) < 0.01) {
      console.log('   ✅ Percentage total is correct!\n');
    } else {
      console.warn(`   ⚠️  Warning: Total percentage is ${totalPercentage}%, expected 100%\n`);
    }

    console.log('📋 New Payout Structure:');
    verifyPayouts
      .sort((a, b) => b.percentage - a.percentage)
      .forEach(p => {
        console.log(`   • ${p.level}: ${p.teams} teams @ ${p.percentage}%`);
      });

  } catch (error) {
    console.error('❌ Error updating NBA 2025 payouts:', error);
    process.exit(1);
  }
}

updateNba2025Payouts();

