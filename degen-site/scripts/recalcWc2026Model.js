#!/usr/bin/env node

/**
 * Full recalc of WC corner model dashboard stats from team game logs in DynamoDB.
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = 'sports-hub-wc-corners';
const SEASON = '2026';
const LEAGUE = 'wc-corners';
const PREFIX = `${LEAGUE}-${SEASON}`;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function main() {
  const items = (await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON },
  }))).Items || [];

  const parameters = {};
  const dashboard = [];
  const teams = {};
  items.forEach((item) => {
    if (item.entityType === 'parameters') Object.assign(parameters, item.data || {});
    if (item.entityType === 'team') {
      dashboard.push(item.dashboard);
      teams[item.team] = { games: item.games || [], summary: item.summary || {} };
    }
  });

  const eloItem = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id: `${PREFIX}-elo-ratings` },
  }));

  const { recalcWcModel } = await import('../src/utils/wc2026RecalcEngine.js');
  const recalced = recalcWcModel({
    teams,
    dashboard,
    parameters,
    eloRatings: eloItem.Item?.ratings || [],
  });

  const now = new Date().toISOString();
  let count = 0;
  for (const item of items.filter((i) => i.entityType === 'team')) {
    if (!item.team || item.team.includes('PRIOR')) continue;
    const teamData = recalced.teams[item.team];
    const dashRow = recalced.dashboard.find((r) => r.team === item.team);
    if (!teamData || !dashRow) continue;
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: {
        ...item,
        games: teamData.games,
        summary: teamData.summary,
        dashboard: { ...item.dashboard, ...dashRow },
        updatedAt: now,
      },
    }));
    count += 1;
  }

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id: `${PREFIX}-parameters`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'parameters',
      data: recalced.parameters,
      updatedAt: now,
    },
  }));

  const meta = items.find((i) => i.entityType === 'meta');
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id: `${PREFIX}-meta`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'meta',
      title: meta?.title || 'WC 2026 — Corner Kick Model',
      readme: meta?.readme || [],
      lastOddsSync: meta?.lastOddsSync,
      oddsEventCount: meta?.oddsEventCount,
      lastEloSync: meta?.lastEloSync,
      lastCornerStatsSync: meta?.lastCornerStatsSync,
      lastModelRecalc: now,
      winsorCap: recalced.winsorCap,
      createdAt: meta?.createdAt || now,
      updatedAt: now,
    },
  }));

  console.log(`✅ Recalced ${count} teams · winsor cap ${recalced.winsorCap?.toFixed(2)}`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
