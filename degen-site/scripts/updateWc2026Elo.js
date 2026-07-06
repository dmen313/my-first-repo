#!/usr/bin/env node

/**
 * Fetch World Football Elo ratings from eloratings.net and update WC corner model teams in DynamoDB.
 *
 * Data sources (public TSV files, same as the website):
 *   https://www.eloratings.net/World.tsv
 *   https://www.eloratings.net/en.teams.tsv
 *   https://www.eloratings.net/teams.tsv  (legacy code → current code)
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = 'sports-hub-wc-corners';
const SEASON = '2026';
const LEAGUE = 'wc-corners';
const PREFIX = `${LEAGUE}-${SEASON}`;
const BASE_URL = 'https://www.eloratings.net';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

/** Dashboard team name → eloratings.net primary team name(s). */
const DASHBOARD_TO_ELO_NAMES = {
  Turkiye: ['Turkey'],
  'Cabo Verde': ['Cape Verde'],
  USA: ['United States', 'USA'],
  Bosnia: ['Bosnia and Herzegovina'],
  Curacao: ['Curaçao', 'Curacao'],
};

const dryRun = process.argv.includes('--dry-run');

async function fetchText(path, { optional = false } = {}) {
  const url = `${BASE_URL}/${path}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'degen-site-wc-elo-updater/1.0',
      Accept: 'text/plain,*/*',
    },
  });
  if (!response.ok) {
    if (optional) {
      console.warn(`⚠️  Skipping optional ${path}: HTTP ${response.status}`);
      return '';
    }
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  return response.text();
}

function parseSuccessorMap(tsv) {
  const successor = {};
  tsv.split('\n').forEach((line) => {
    const [oldCode, newCode] = line.split('\t');
    if (oldCode && newCode) successor[oldCode.trim()] = newCode.trim();
  });
  return successor;
}

function resolveCode(code, successor) {
  return successor[code] || code;
}

function parseTeamDictionary(tsv) {
  const byCode = {};
  const nameToCode = {};

  tsv.split('\n').forEach((line) => {
    if (!line.trim()) return;
    const values = line.split('\t');
    const code = values.shift();
    if (!code || code.endsWith('_loc')) return;

    const names = values.map((v) => v.trim()).filter(Boolean);
    if (!names.length) return;

    byCode[code] = { code, primary: names[0], aliases: names };
    names.forEach((name) => {
      if (!nameToCode[name]) nameToCode[name] = code;
    });
  });

  return { byCode, nameToCode };
}

function parseWorldRatings(tsv, successor, byCode) {
  const byCodeRating = {};
  const byName = {};

  tsv.split('\n').forEach((line) => {
    if (!line.trim()) return;
    const fields = line.split('\t');
    const rawCode = fields[2];
    const rating = Number(fields[3]);
    if (!rawCode || !Number.isFinite(rating)) return;

    const code = resolveCode(rawCode.trim(), successor);
    const team = byCode[code];
    const primary = team?.primary || code;

    byCodeRating[code] = { code, rating, rank: Number(fields[1]) || null, primary };
    byName[primary] = { code, rating, rank: Number(fields[1]) || null, primary };
    (team?.aliases || []).forEach((alias) => {
      byName[alias] = { code, rating, rank: Number(fields[1]) || null, primary };
    });
  });

  return { byCodeRating, byName };
}

function lookupEloForDashboardTeam(teamName, byName, nameToCode, byCodeRating, successor) {
  const candidates = [teamName, ...(DASHBOARD_TO_ELO_NAMES[teamName] || [])];

  for (const candidate of candidates) {
    const direct = byName[candidate];
    if (direct) return direct;
  }

  const code = nameToCode[teamName];
  if (code) {
    const resolved = resolveCode(code, successor);
    const fromCode = byCodeRating[resolved];
    if (fromCode) return fromCode;
  }

  for (const candidate of candidates) {
    const mappedCode = nameToCode[candidate];
    if (!mappedCode) continue;
    const resolved = resolveCode(mappedCode, successor);
    const fromCode = byCodeRating[resolved];
    if (fromCode) return fromCode;
  }

  return null;
}

function isRealTeamName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('PRIOR') || name.includes('fotmob')) return false;
  return true;
}

async function loadDashboardTeams() {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    FilterExpression: '#entityType = :entityType',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season',
      '#entityType': 'entityType',
    },
    ExpressionAttributeValues: {
      ':league': LEAGUE,
      ':season': SEASON,
      ':entityType': 'team',
    },
  }));

  return (result.Items || []).sort((a, b) => a.team.localeCompare(b.team));
}

async function loadMeta() {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON },
  }));
  return (result.Items || []).find((item) => item.entityType === 'meta') || null;
}

async function main() {
  console.log('Fetching Elo ratings from eloratings.net...');
  const [worldTsv, teamsTsv, successorTsv] = await Promise.all([
    fetchText('World.tsv'),
    fetchText('en.teams.tsv'),
    fetchText('teams.tsv', { optional: true }),
  ]);

  const successor = parseSuccessorMap(successorTsv);
  const { byCode, nameToCode } = parseTeamDictionary(teamsTsv);
  const { byCodeRating, byName } = parseWorldRatings(worldTsv, successor, byCode);

  const allRatings = Object.values(byCodeRating)
    .map((row) => ({
      team: row.primary,
      code: row.code,
      elo: row.rating,
      rank: row.rank,
    }))
    .sort((a, b) => b.elo - a.elo);

  console.log(`Parsed ${allRatings.length} national team ratings (top: ${allRatings[0]?.team} ${allRatings[0]?.elo})`);

  const dashboardTeams = dryRun
    ? []
    : await loadDashboardTeams();

  if (!dryRun && !dashboardTeams.length) {
    throw new Error(`No team items in ${TABLE}. Run npm run migrate-wc-corners first.`);
  }

  const now = new Date().toISOString();
  const updates = [];
  const unmatched = [];

  const teamsToProcess = dryRun
    ? Object.keys(DASHBOARD_TO_ELO_NAMES).concat(['Spain', 'England', 'USA', 'Cabo Verde', 'Curacao', 'Turkiye'])
    : dashboardTeams.map((item) => item.team);

  teamsToProcess.forEach((teamName) => {
    const match = lookupEloForDashboardTeam(teamName, byName, nameToCode, byCodeRating, successor);
    if (!match) {
      unmatched.push(teamName);
      return;
    }
    updates.push({ team: teamName, elo: match.rating, eloRank: match.rank, eloSource: match.primary });
  });

  if (dryRun) {
    console.log('Dry run — sample lookups:');
    updates.forEach((row) => {
      console.log(`  ${row.team}: ${row.elo} (from ${row.eloSource}, rank ${row.eloRank})`);
    });
    if (unmatched.length) console.log('Unmatched:', unmatched.join(', '));
    return;
  }

  let changed = 0;
  for (const item of dashboardTeams) {
    if (!isRealTeamName(item.team)) continue;
    const match = lookupEloForDashboardTeam(item.team, byName, nameToCode, byCodeRating, successor);
    if (!match) {
      unmatched.push(item.team);
      continue;
    }

    const prevElo = item.dashboard?.elo;
    const nextElo = match.rating;
    if (prevElo === nextElo) continue;

    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: {
        ...item,
        dashboard: { ...item.dashboard, elo: nextElo },
        eloMeta: {
          rank: match.rank,
          sourceName: match.primary,
          sourceCode: match.code,
          fetchedAt: now,
        },
        updatedAt: now,
      },
    }));
    changed += 1;
    console.log(`  ${item.team}: ${prevElo ?? '—'} → ${nextElo}`);
  }

  const meta = await loadMeta();
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
      lastEloSync: now,
      eloRatingCount: allRatings.length,
      eloTeamsUpdated: changed,
      createdAt: meta?.createdAt || now,
      updatedAt: now,
    },
  }));

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id: `${PREFIX}-elo-ratings`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'elo-ratings',
      ratings: allRatings,
      source: `${BASE_URL}/World.tsv`,
      fetchedAt: now,
      updatedAt: now,
    },
  }));

  console.log(`✅ Elo sync complete: ${changed} dashboard teams updated, ${allRatings.length} ratings stored`);
  if (unmatched.length) {
    console.warn(`⚠️  No Elo match for: ${unmatched.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
