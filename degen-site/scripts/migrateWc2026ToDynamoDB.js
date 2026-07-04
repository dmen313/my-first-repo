#!/usr/bin/env node

/**
 * Seed WC 2026 corner model from spreadsheet export JSON into DynamoDB.
 * Run: python3 scripts/importWc2026Model.py [xlsx] && node scripts/migrateWc2026ToDynamoDB.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { DynamoDBClient, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = 'sports-hub-wc-corners';
const SEASON = '2026';
const LEAGUE = 'wc-corners';
const PREFIX = `${LEAGUE}-${SEASON}`;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'wc2026CornerModel.json');

function teamId(teamName) {
  return `${PREFIX}-team-${String(teamName).replace(/[^a-zA-Z0-9]+/g, '_')}`;
}

async function waitForTableActive(tableName, region) {
  const client = new DynamoDBClient({ region });
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const desc = await client.send(new DescribeTableCommand({ TableName: tableName }));
    if (desc.Table?.TableStatus === 'ACTIVE') return;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Table ${tableName} did not become ACTIVE in time`);
}

async function batchPut(items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } }));
    await client.send(new BatchWriteCommand({ RequestItems: { [TABLE]: chunk } }));
  }
}

async function main() {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Missing ${DATA_PATH}. Run: python3 scripts/importWc2026Model.py`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const now = new Date().toISOString();
  const items = [];

  await waitForTableActive(TABLE, REGION);

  items.push({
    id: `${PREFIX}-meta`,
    league: LEAGUE,
    season: SEASON,
    entityType: 'meta',
    title: data.meta?.title,
    readme: data.readme || [],
    exportedFrom: data.meta?.exportedFrom,
    exportedAt: data.meta?.exportedAt,
    createdAt: now,
    updatedAt: now,
  });

  items.push({
    id: `${PREFIX}-parameters`,
    league: LEAGUE,
    season: SEASON,
    entityType: 'parameters',
    data: data.parameters || {},
    createdAt: now,
    updatedAt: now,
  });

  items.push({
    id: `${PREFIX}-tracker-summary`,
    league: LEAGUE,
    season: SEASON,
    entityType: 'tracker-summary',
    summary: data.tracker?.summary || {},
    createdAt: now,
    updatedAt: now,
  });

  items.push({
    id: `${PREFIX}-accuracy-summary`,
    league: LEAGUE,
    season: SEASON,
    entityType: 'accuracy-summary',
    summary: data.accuracy?.summary || {},
    createdAt: now,
    updatedAt: now,
  });

  (data.dashboard || []).forEach((teamRow) => {
    const teamName = teamRow.team;
    const teamData = data.teams?.[teamName] || { games: [], summary: {} };
    items.push({
      id: teamId(teamName),
      league: LEAGUE,
      season: SEASON,
      entityType: 'team',
      team: teamName,
      dashboard: teamRow,
      games: teamData.games || [],
      summary: teamData.summary || {},
      createdAt: now,
      updatedAt: now,
    });
  });

  (data.tracker?.bets || []).forEach((bet, index) => {
    items.push({
      id: `${PREFIX}-bet-${String(index + 1).padStart(3, '0')}`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'bet',
      bet,
      createdAt: now,
      updatedAt: now,
    });
  });

  (data.accuracy?.log || []).forEach((entry, index) => {
    items.push({
      id: `${PREFIX}-accuracy-${String(index + 1).padStart(3, '0')}`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'accuracy',
      entry,
      createdAt: now,
      updatedAt: now,
    });
  });

  console.log(`Uploading ${items.length} items to ${TABLE}...`);
  await batchPut(items);
  console.log(`✅ Migrated WC corner model (${data.dashboard?.length || 0} teams, ${data.tracker?.bets?.length || 0} bets)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
