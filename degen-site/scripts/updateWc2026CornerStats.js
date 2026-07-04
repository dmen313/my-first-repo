#!/usr/bin/env node

/**
 * Pull per-team corner stats for FIFA World Cup fixtures from API-Football (api-sports.io)
 * and append finished matches to WC team game logs in DynamoDB.
 *
 * Free tier: 100 requests/day — only fetches statistics for new finished fixtures.
 *
 * Env: API_FOOTBALL_KEY or APISPORTS_KEY (from https://dashboard.api-football.com)
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = 'sports-hub-wc-corners';
const SEASON = '2026';
const LEAGUE = 'wc-corners';
const PREFIX = `${LEAGUE}-${SEASON}`;
const API_BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE_ID = Number(process.env.API_FOOTBALL_WC_LEAGUE_ID || 1);
const WC_SEASON = Number(process.env.API_FOOTBALL_WC_SEASON || 2026);
const REQUEST_DELAY_MS = Number(process.env.API_FOOTBALL_DELAY_MS || 400);

const API_KEY = process.env.API_FOOTBALL_KEY
  || process.env.APISPORTS_KEY
  || process.env.REACT_APP_API_FOOTBALL_KEY;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const fixtureLimit = limitArg ? Number(limitArg.split('=')[1]) : null;

/** API-Football / common labels → dashboard team name. */
const API_NAME_TO_DASHBOARD = {
  'Cape Verde': 'Cabo Verde',
  'Cape Verde Islands': 'Cabo Verde',
  'United States': 'USA',
  Turkey: 'Turkiye',
  Türkiye: 'Turkiye',
  'Bosnia and Herzegovina': 'Bosnia',
  'Bosnia-Herzegovina': 'Bosnia',
  'Bosnia & Herzegovina': 'Bosnia',
  Curaçao: 'Curacao',
  Curacao: 'Curacao',
  'Korea Republic': 'South Korea',
  'South Korea': 'South Korea',
  'Republic of Ireland': 'Ireland',
  'Ivory Coast': 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'Czech Republic': 'Czechia',
  Czechia: 'Czechia',
  'DR Congo': 'DR Congo',
  'Congo DR': 'DR Congo',
};

let requestCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTeamName(name) {
  if (!name) return '';
  return API_NAME_TO_DASHBOARD[name] || name;
}

function isRealTeamName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('PRIOR') || name.includes('fotmob')) return false;
  return true;
}

function numParam(parameters, key, fallback) {
  const raw = parameters?.[key]?.value ?? parameters?.[key] ?? fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function apiGet(path, params = {}, attempt = 1) {
  if (!API_KEY) {
    throw new Error('API_FOOTBALL_KEY not configured (get a free key at dashboard.api-football.com)');
  }

  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  if (requestCount > 0) await sleep(REQUEST_DELAY_MS);
  requestCount += 1;

  const response = await fetch(url, {
    headers: {
      'x-apisports-key': API_KEY,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (attempt < 3) {
      await sleep(1500 * attempt);
      requestCount -= 1;
      return apiGet(path, params, attempt + 1);
    }
    throw new Error(`API-Football ${path}: invalid JSON response (${response.status})`);
  }

  const apiError = formatApiErrors(data.errors);
  if (!response.ok || apiError) {
    if (attempt < 3 && /rate|limit|too many/i.test(String(apiError || ''))) {
      await sleep(2000 * attempt);
      requestCount -= 1;
      return apiGet(path, params, attempt + 1);
    }
    throw new Error(`API-Football ${path}: ${apiError || data.message || `HTTP ${response.status}`}`);
  }

  return data;
}

function formatApiErrors(errors) {
  if (!errors) return null;
  if (typeof errors === 'string') return errors;
  if (Array.isArray(errors)) return errors.filter(Boolean).join('; ');
  if (errors.token) return errors.token;
  if (errors.plan) return errors.plan;
  return Object.values(errors).filter(Boolean).join('; ') || null;
}

function cornersFromStatistics(blocks) {
  const result = {};
  (blocks || []).forEach((block) => {
    const teamName = normalizeTeamName(block.team?.name);
    const stat = (block.statistics || []).find((s) => {
      const t = String(s.type || '').toLowerCase();
      return t === 'corner kicks' || t === 'corners' || t.includes('corner');
    });
    const value = stat?.value;
    const corners = value === null || value === undefined ? null : Number(value);
    if (teamName && Number.isFinite(corners)) {
      result[teamName] = corners;
    }
  });
  return result;
}

function venueForTeam(fixture, teamId) {
  if (fixture.league?.id === WC_LEAGUE_ID) return 'N';
  if (fixture.teams?.home?.id === teamId) return 'H';
  if (fixture.teams?.away?.id === teamId) return 'A';
  return 'N';
}

function fixtureDate(fixture) {
  return (fixture.fixture?.date || '').slice(0, 10);
}

function existingFixtureKeys(teamItems) {
  const keys = new Set();
  teamItems.forEach((item) => {
    (item.games || []).forEach((game) => {
      if (game.apiFixtureId) {
        keys.add(`id:${game.apiFixtureId}`);
      }
      if (game.comp === 'WC' && game.date && game.opponent) {
        keys.add(`wc:${game.date}:${normalizeTeamName(game.opponent)}`);
      }
    });
  });
  return keys;
}

function fixtureAlreadyStored(keys, fixtureId, date, home, away) {
  if (keys.has(`id:${fixtureId}`)) return true;
  return keys.has(`wc:${date}:${home}`) || keys.has(`wc:${date}:${away}`);
}

function renumberGames(games) {
  const sorted = [...games].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return sorted.map((game, index) => ({ ...game, num: index + 1 }));
}

function applyRecencyWeights(games, decay) {
  const included = games.filter((g) => g.included);
  const n = included.length;
  if (!n) return games;

  const includedSorted = [...included].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const weightByKey = new Map();
  includedSorted.forEach((game, index) => {
    const key = game.apiFixtureId || `${game.date}-${game.opponent}`;
    weightByKey.set(key, decay ** (n - 1 - index));
  });

  return games.map((game) => {
    const key = game.apiFixtureId || `${game.date}-${game.opponent}`;
    if (!game.included || !weightByKey.has(key)) return game;
    return { ...game, wt: weightByKey.get(key) };
  });
}

function recalcDashboardRow(dashboard, games, parameters) {
  const included = games.filter((g) => g.included);
  const n = included.length;
  const minGames = numParam(parameters, 'MIN_GAMES', 3);
  const rawFor = n ? included.reduce((sum, g) => sum + (g.cf || 0), 0) / n : null;
  const rawAg = n ? included.reduce((sum, g) => sum + (g.ca || 0), 0) / n : null;

  return {
    ...dashboard,
    games: n,
    rawFor,
    rawAg,
    source: n >= minGames ? `DATA(${n}) / DATA(${n})` : dashboard.source,
  };
}

async function loadTeamItems() {
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
  return (result.Items || []).filter((item) => isRealTeamName(item.team));
}

async function loadParameters() {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON },
  }));
  const item = (result.Items || []).find((i) => i.entityType === 'parameters');
  return item?.data || {};
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

function buildEloLookup(teamItems, eloRatingsItem) {
  const byName = {};
  teamItems.forEach((item) => {
    if (item.dashboard?.elo != null) byName[item.team] = item.dashboard.elo;
  });
  (eloRatingsItem?.ratings || []).forEach((row) => {
    const name = normalizeTeamName(row.team);
    if (row.elo != null) byName[name] = row.elo;
  });
  return byName;
}

async function fetchFinishedFixtures() {
  const data = await apiGet('/fixtures', {
    league: WC_LEAGUE_ID,
    season: WC_SEASON,
    status: 'FT',
  });
  return data.response || [];
}

async function fetchFixtureCorners(fixtureId) {
  const data = await apiGet('/fixtures/statistics', { fixture: fixtureId });
  return cornersFromStatistics(data.response);
}

function buildGameRecord({
  fixture,
  teamId,
  opponent,
  cornersFor,
  cornersAgainst,
  oppElo,
}) {
  return {
    date: fixtureDate(fixture),
    opponent,
    comp: 'WC',
    venue: venueForTeam(fixture, teamId),
    cf: cornersFor,
    ca: cornersAgainst,
    included: true,
    oppElo: oppElo ?? null,
    apiFixtureId: String(fixture.fixture.id),
    source: 'api-football',
    fetchedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log(`Fetching WC ${WC_SEASON} fixtures (league ${WC_LEAGUE_ID}) from API-Football...`);

  const teamItems = dryRun ? [] : await loadTeamItems();
  if (!dryRun && !teamItems.length) {
    throw new Error(`No team items in ${TABLE}. Run npm run migrate-wc-corners first.`);
  }

  const parameters = dryRun ? { DECAY: { value: 0.9 } } : await loadParameters();
  const decay = numParam(parameters, 'DECAY', 0.9);

  let eloLookup = {};
  if (!dryRun) {
    const eloItem = await docClient.send(new GetCommand({
      TableName: TABLE,
      Key: { id: `${PREFIX}-elo-ratings` },
    }));
    eloLookup = buildEloLookup(teamItems, eloItem.Item);
  }

  const knownKeys = dryRun ? new Set() : existingFixtureKeys(teamItems);
  const fixtures = await fetchFinishedFixtures();
  const pending = fixtures.filter((f) => {
    const id = String(f.fixture?.id || '');
    const date = fixtureDate(f);
    const home = normalizeTeamName(f.teams?.home?.name);
    const away = normalizeTeamName(f.teams?.away?.name);
    return id && !fixtureAlreadyStored(knownKeys, id, date, home, away);
  });

  if (fixtureLimit != null) {
    pending.splice(fixtureLimit);
  }

  console.log(`Found ${fixtures.length} finished fixtures; ${pending.length} new (${requestCount} API requests so far)`);

  if (!pending.length) {
    console.log('✅ No new WC corner stats to import');
    return;
  }

  const teamByName = new Map(teamItems.map((item) => [item.team, item]));
  const pendingUpdates = new Map();
  const imported = [];

  for (const fixture of pending) {
    const fixtureId = fixture.fixture?.id;
    const home = normalizeTeamName(fixture.teams?.home?.name);
    const away = normalizeTeamName(fixture.teams?.away?.name);

    if (!fixtureId || !home || !away) continue;

    const corners = await fetchFixtureCorners(fixtureId);
    const homeCf = corners[home];
    const awayCf = corners[away];

    if (!Number.isFinite(homeCf) || !Number.isFinite(awayCf)) {
      console.warn(`  ⚠️  Fixture ${fixtureId} (${home} vs ${away}): missing corner stats, skipping`);
      continue;
    }

    const summary = {
      fixtureId,
      date: fixtureDate(fixture),
      home,
      away,
      homeCorners: homeCf,
      awayCorners: awayCf,
    };
    imported.push(summary);

    if (dryRun) {
      console.log(`  [dry-run] ${summary.date} ${home} ${homeCf}-${awayCf} ${away} (fixture ${fixtureId})`);
      continue;
    }

    [
      { team: home, opponent: away, cf: homeCf, ca: awayCf, teamId: fixture.teams.home.id },
      { team: away, opponent: home, cf: awayCf, ca: homeCf, teamId: fixture.teams.away.id },
    ].forEach(({ team, opponent, cf, ca, teamId }) => {
      if (!teamByName.has(team)) {
        console.warn(`  ⚠️  No dashboard team for "${team}" (${home} vs ${away})`);
        return;
      }

      const item = pendingUpdates.get(team) || { ...teamByName.get(team) };
      const games = [...(item.games || [])];
      games.push(buildGameRecord({
        fixture,
        teamId,
        opponent,
        cornersFor: cf,
        cornersAgainst: ca,
        oppElo: eloLookup[opponent],
      }));

      item.games = games;
      pendingUpdates.set(team, item);
    });
  }

  if (dryRun) {
    console.log(`Dry run complete — would import ${imported.length} fixtures (${requestCount} API requests)`);
    return;
  }

  const now = new Date().toISOString();

  // Merge new games into in-memory model, then full recalc (adj attack/defense, winsor, φ)
  pendingUpdates.forEach((item, teamName) => {
    teamByName.set(teamName, item);
  });

  const teams = {};
  const dashboard = [];
  teamItems.forEach((item) => {
    const current = teamByName.get(item.team) || item;
    teams[item.team] = { games: current.games || [], summary: current.summary || {} };
    dashboard.push({ ...(current.dashboard || {}), team: item.team });
  });

  const eloRatingsItem = await docClient.send(new GetCommand({
    TableName: TABLE,
    Key: { id: `${PREFIX}-elo-ratings` },
  }));

  const { recalcWcModel } = await import('../src/utils/wc2026RecalcEngine.js');
  const recalced = recalcWcModel({
    teams,
    dashboard,
    parameters,
    eloRatings: eloRatingsItem.Item?.ratings || [],
  });

  let teamsUpdated = 0;
  for (const item of teamItems) {
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
    if (pendingUpdates.has(item.team)) {
      teamsUpdated += 1;
      console.log(`  ${item.team}: recalced → ${dashRow.games} games, adj ${dashRow.adjAttack?.toFixed(2)}/${dashRow.adjDefense?.toFixed(2)}`);
    }
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
      lastEloSync: meta?.lastEloSync,
      eloRatingCount: meta?.eloRatingCount,
      lastCornerStatsSync: now,
      lastModelRecalc: now,
      winsorCap: recalced.winsorCap,
      cornerStatsFixtureCount: imported.length,
      cornerStatsApiRequests: requestCount,
      createdAt: meta?.createdAt || now,
      updatedAt: now,
    },
  }));

  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id: `${PREFIX}-corner-fixtures`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'corner-fixtures',
      fixtures: imported,
      source: 'api-football',
      fetchedAt: now,
      updatedAt: now,
    },
  }));

  console.log(`✅ Imported ${imported.length} WC fixtures → ${teamsUpdated} teams updated (${requestCount} API requests)`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
