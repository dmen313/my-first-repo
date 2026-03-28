#!/usr/bin/env node

/**
 * Script to initialize default draft statuses for all existing drafts
 * Sets status to "Draft In Progress" for any drafts that don't have a status yet
 */

require('dotenv').config();

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const DRAFT_PICKS_TABLE = 'sports-hub-draft-picks';
const DRAFT_STATUSES_TABLE = 'sports-hub-draft-statuses';
const DEFAULT_STATUS = 'Draft In Progress';

async function getAllDraftLeaguesAndSeasons() {
  console.log('📊 Scanning for all draft picks...');
  
  const leaguesSeasons = new Set();
  let lastEvaluatedKey = null;

  do {
    const command = new ScanCommand({
      TableName: DRAFT_PICKS_TABLE,
      ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {})
    });

    const result = await docClient.send(command);
    
    if (result.Items) {
      result.Items.forEach(pick => {
        if (pick.league && pick.season) {
          leaguesSeasons.add(`${pick.league}-${pick.season}`);
        }
      });
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Parse the set to get league and season pairs
  const draftPairs = Array.from(leaguesSeasons).map(key => {
    const parts = key.split('-');
    return {
      league: parts[0],
      season: parts.slice(1).join('-') // Handle cases like 'nfl-2025'
    };
  });

  console.log(`✅ Found ${draftPairs.length} unique draft(s):`, draftPairs.map(d => `${d.league}-${d.season}`).join(', '));
  return draftPairs;
}

async function checkExistingStatus(league, season) {
  try {
    const command = new QueryCommand({
      TableName: DRAFT_STATUSES_TABLE,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': league,
        ':season': season
      },
      Limit: 1
    });
    const result = await docClient.send(command);
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.error(`❌ Table ${DRAFT_STATUSES_TABLE} does not exist! Please run setupDynamoDB.js first.`);
      throw error;
    }
    throw error;
  }
}

async function createDraftStatus(league, season, status) {
  const id = `${league}-${season}`;
  const statusItem = {
    id,
    league,
    season,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const command = new PutCommand({
    TableName: DRAFT_STATUSES_TABLE,
    Item: statusItem
  });

  await docClient.send(command);
  return statusItem;
}

async function initializeDraftStatuses() {
  console.log('🚀 Initializing default draft statuses...\n');

  try {
    // Get all unique league-season combinations from draft picks
    const draftPairs = await getAllDraftLeaguesAndSeasons();

    if (draftPairs.length === 0) {
      console.log('ℹ️  No drafts found. Nothing to initialize.');
      return;
    }

    console.log(`\n📝 Checking and initializing statuses...\n`);

    let created = 0;
    let skipped = 0;

    for (const { league, season } of draftPairs) {
      const existing = await checkExistingStatus(league, season);
      
      if (existing) {
        console.log(`⏭️  ${league}-${season}: Status already exists (${existing.status})`);
        skipped++;
      } else {
        await createDraftStatus(league, season, DEFAULT_STATUS);
        console.log(`✅ ${league}-${season}: Created with status "${DEFAULT_STATUS}"`);
        created++;
      }
    }

    console.log(`\n✅ Initialization complete!`);
    console.log(`   Created: ${created} status(es)`);
    console.log(`   Skipped: ${skipped} status(es) (already exist)`);

  } catch (error) {
    console.error('\n❌ Error initializing draft statuses:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Also add some common drafts that might not have picks yet
async function initializeCommonDrafts() {
  console.log('\n📋 Initializing common draft combinations...\n');

  const commonDrafts = [
    { league: 'nfl', season: '2025' },
    { league: 'mlb', season: '2025' },
    { league: 'mlb', season: '2024' },
    { league: 'nba', season: '2025' },
    { league: 'nba', season: '2024' },
    { league: 'ncaa', season: '2025' }
  ];

  let created = 0;
  let skipped = 0;

  for (const { league, season } of commonDrafts) {
    try {
      const existing = await checkExistingStatus(league, season);
      
      if (existing) {
        console.log(`⏭️  ${league}-${season}: Status already exists (${existing.status})`);
        skipped++;
      } else {
        await createDraftStatus(league, season, DEFAULT_STATUS);
        console.log(`✅ ${league}-${season}: Created with status "${DEFAULT_STATUS}"`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${league}-${season}:`, error.message);
    }
  }

  console.log(`\n✅ Common drafts initialization complete!`);
  console.log(`   Created: ${created} status(es)`);
  console.log(`   Skipped: ${skipped} status(es) (already exist)`);
}

async function main() {
  await initializeDraftStatuses();
  await initializeCommonDrafts();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




