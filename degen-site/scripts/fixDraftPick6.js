#!/usr/bin/env node

/**
 * Script to manually fix pick #6 for user MC in NBA 2025 draft
 * Clears the teamId and teamName so MC can pick again
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Use AWS CLI credentials directly (not Cognito)
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  draftPicks: 'sports-hub-draft-picks',
  teams: 'sports-hub-teams'
};

async function getDraftPicks(league, season) {
  const command = new QueryCommand({
    TableName: TABLES.draftPicks,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': league,
      ':season': season
    }
  });
  const result = await docClient.send(command);
  const picks = result.Items || [];
  return picks.sort((a, b) => a.pickNumber - b.pickNumber);
}

async function updateDraftPick(id, updateData) {
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.draftPicks,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  
  const result = await docClient.send(command);
  return result.Attributes;
}

async function updateTeam(id, updateData) {
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.teams,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  
  const result = await docClient.send(command);
  return result.Attributes;
}

async function fixPick6() {
  try {
    console.log('🔍 Fetching draft picks for NBA 2025...\n');
    
    const league = 'nba';
    const season = '2025';
    const picks = await getDraftPicks(league, season);
    
    console.log(`Found ${picks.length} total picks\n`);
    
    // Find pick #6 for user MC
    let pick6 = picks.find(pick => 
      pick.pickNumber === 6 && pick.owner === 'MC'
    );
    
    if (!pick6) {
      console.log('ℹ️  Pick #6 for MC does not exist. Creating it...\n');
      
      // Determine the round based on the draft order
      // Looking at picks: #1=KH, #2=TG, #3=MC, #4=DM, #5=DM, #7=TG
      // Round 1: KH, TG, MC, DM
      // Round 2 (reverse): DM, MC, TG, KH
      // So pick #6 should be MC in round 2
      const round = 2;
      
      // Create the pick
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      const { randomUUID } = require('crypto');
      
      const newPick = {
        id: randomUUID(),
        league: league,
        season: season,
        round: round,
        pickNumber: 6,
        owner: 'MC',
        teamId: null,
        teamName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const putCommand = new PutCommand({
        TableName: TABLES.draftPicks,
        Item: newPick
      });
      
      await docClient.send(putCommand);
      pick6 = newPick;
      
      console.log('✅ Created pick #6 for MC\n');
    }
    
    console.log('✅ Found pick #6 for MC:');
    console.log(`   ID: ${pick6.id}`);
    console.log(`   Round: ${pick6.round}`);
    console.log(`   Pick Number: ${pick6.pickNumber}`);
    console.log(`   Owner: ${pick6.owner}`);
    console.log(`   Current Team ID: ${pick6.teamId || 'null'}`);
    console.log(`   Current Team Name: ${pick6.teamName || 'null'}\n`);
    
    if (!pick6.teamId) {
      console.log('ℹ️  Pick #6 already has no team selected. Nothing to fix.');
      return;
    }
    
    // Clear the team's owner if it was set
    if (pick6.teamId) {
      console.log(`🔄 Clearing owner for team ${pick6.teamId}...`);
      try {
        await updateTeam(pick6.teamId, { owner: null });
        console.log('✅ Team owner cleared\n');
      } catch (err) {
        console.warn(`⚠️  Could not clear team owner: ${err.message}\n`);
      }
    }
    
    // Clear the pick's team selection
    console.log('🔄 Clearing team selection for pick #6...');
    const updatedPick = await updateDraftPick(pick6.id, {
      teamId: null,
      teamName: null
    });
    
    console.log('\n✅ Pick #6 updated successfully!');
    console.log(`   Team ID: ${updatedPick.teamId || 'null'}`);
    console.log(`   Team Name: ${updatedPick.teamName || 'null'}`);
    console.log('\n🎯 MC can now pick again for pick #6!\n');
    
  } catch (error) {
    console.error('\n❌ Error fixing pick #6:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixPick6();

