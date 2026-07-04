#!/usr/bin/env node

/**
 * Fetch FIFA World Cup corner odds from The Odds API and store in DynamoDB.
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = 'sports-hub-wc-corners';
const SEASON = '2026';
const LEAGUE = 'wc-corners';
const PREFIX = `${LEAGUE}-${SEASON}`;
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const SPORT_KEY = 'soccer_fifa_world_cup';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const TEAM_ALIASES = {
  'Cape Verde': 'Cabo Verde',
  'United States': 'USA',
};

function normalizeTeam(name) {
  return TEAM_ALIASES[name] || name;
}

function impliedProb(price) {
  const n = Number(price);
  if (!n) return null;
  return n > 0 ? 100 / (n + 100) : Math.abs(n) / (Math.abs(n) + 100);
}

async function oddsFetch(path) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${ODDS_API_BASE}${path}${sep}apiKey=${ODDS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || data.error_code) {
    throw new Error(data.message || `Odds API ${response.status}`);
  }
  return data;
}

function flattenMarkets(bookmakers) {
  const byMarket = {};
  (bookmakers || []).forEach((bookmaker) => {
    (bookmaker.markets || []).forEach((market) => {
      if (!byMarket[market.key]) byMarket[market.key] = { key: market.key, lines: [] };
      (market.outcomes || []).forEach((outcome) => {
        byMarket[market.key].lines.push({
          bookmaker: bookmaker.title || bookmaker.key,
          name: outcome.name,
          description: outcome.description || null,
          point: outcome.point,
          price: outcome.price,
          impliedProb: impliedProb(outcome.price),
        });
      });
    });
  });
  return Object.values(byMarket);
}

async function fetchAllFixtures() {
  const events = await oddsFetch(`/sports/${SPORT_KEY}/events`);
  const fixtures = [];
  const markets = 'alternate_totals_corners,alternate_team_totals_corners,alternate_spreads_corners';

  for (const event of events) {
    const oddsPayload = await oddsFetch(
      `/sports/${SPORT_KEY}/events/${event.id}/odds?regions=us&oddsFormat=american&markets=${markets}`
    );
    fixtures.push({
      eventId: event.id,
      homeTeam: normalizeTeam(event.home_team),
      awayTeam: normalizeTeam(event.away_team),
      homeTeamRaw: event.home_team,
      awayTeamRaw: event.away_team,
      commenceTime: event.commence_time,
      markets: flattenMarkets(oddsPayload.bookmakers),
      fetchedAt: new Date().toISOString(),
    });
  }

  let kalshiMerged = 0;
  try {
    const { fetchKalshiWcCornerOdds, mergeKalshiIntoFixtures } = await import('../src/services/wcKalshiOddsApi.js');
    const kalshiFixtures = await fetchKalshiWcCornerOdds();
    kalshiMerged = mergeKalshiIntoFixtures(fixtures, kalshiFixtures);
    console.log(`Kalshi: merged ${kalshiMerged} fixture(s)`);
  } catch (err) {
    console.warn('Kalshi corner odds skipped:', err.message);
  }

  return {
    fixtures,
    eventCount: events.length,
    fetchedAt: new Date().toISOString(),
    kalshiMerged,
  };
}

async function saveFixtures(fixtures, syncMeta) {
  const now = new Date().toISOString();
  const writes = fixtures.map((fixture) => ({
    PutRequest: {
      Item: {
        id: `${PREFIX}-fixture-${fixture.eventId}`,
        league: LEAGUE,
        season: SEASON,
        entityType: 'fixture',
        fixture,
        updatedAt: now,
      },
    },
  }));

  for (let i = 0; i < writes.length; i += 25) {
    await docClient.send(new BatchWriteCommand({
      RequestItems: { [TABLE]: writes.slice(i, i + 25) },
    }));
  }

  const metaQuery = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON },
  }));
  const metaItem = (metaQuery.Items || []).find((i) => i.entityType === 'meta');

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id: `${PREFIX}-meta`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'meta',
      title: metaItem?.title || 'WC 2026 — Corner Kick Model',
      readme: metaItem?.readme || [],
      lastOddsSync: syncMeta.fetchedAt,
      oddsEventCount: syncMeta.eventCount,
      createdAt: metaItem?.createdAt || now,
      updatedAt: now,
    },
  }));
}

async function main() {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    console.error('ODDS_API_KEY not configured');
    process.exit(1);
  }
  console.log('Fetching WC corner odds...');
  const payload = await fetchAllFixtures();
  await saveFixtures(payload.fixtures, payload);
  console.log(`✅ Stored ${payload.fixtures.length} fixtures (${payload.eventCount} events)`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
