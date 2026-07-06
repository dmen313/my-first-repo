#!/usr/bin/env node

/**
 * Backfill WC tracker with slate plays (≥5% EV) and grade settled matches.
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE = 'sports-hub-wc-corners';
const SEASON = '2026';
const LEAGUE = 'wc-corners';
const PREFIX = `${LEAGUE}-${SEASON}`;

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function loadModel() {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON },
  }));

  const items = result.Items || [];
  const parameters = {};
  items.filter((i) => i.entityType === 'parameters').forEach((i) => Object.assign(parameters, i.data || {}));
  const dashboard = items
    .filter((i) => i.entityType === 'team')
    .map((i) => i.dashboard)
    .sort((a, b) => a.team.localeCompare(b.team));
  const teams = {};
  items.filter((i) => i.entityType === 'team').forEach((i) => {
    teams[i.team] = { games: i.games || [] };
  });
  const fixtures = items.filter((i) => i.entityType === 'fixture').map((i) => i.fixture);
  const bets = items.filter((i) => i.entityType === 'bet');

  return { items, parameters, dashboard, teams, fixtures, bets };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { buildSlate } = await import('../src/utils/wc2026SlateBuilder.js');
  const { enrichBet, computeTrackerSummary } = await import('../src/utils/wc2026Tracker.js');
  const {
    findMatchResult,
    playToBetInput,
    playBetKey,
    betDedupeKey,
  } = await import('../src/utils/wc2026BetGrading.js');

  const model = await loadModel();
  const allPlays = buildSlate(model.fixtures, model.dashboard, model.parameters);

  // One bet per unique selection — best EV book
  const bestBySelection = {};
  allPlays.forEach((play) => {
    const key = playBetKey(play);
    const cur = bestBySelection[key];
    if (!cur || play.evPct > cur.evPct) bestBySelection[key] = play;
  });
  const plays = Object.values(bestBySelection);

  const existingKeys = new Set(
    model.bets.map((b) => betDedupeKey(b.bet))
  );

  const toAdd = [];
  const skipped = [];
  const pending = [];

  for (const play of plays) {
    const [homeTeam, awayTeam] = play.match.split('/');
    const result = findMatchResult(model.teams, homeTeam, awayTeam, play.kickoff);
    const key = playBetKey(play);

    if (existingKeys.has(playBetKey(play))) {
      skipped.push({ play, reason: 'already logged' });
      continue;
    }

    const betInput = playToBetInput(play, result);
    if (!result) {
      pending.push(play);
      continue;
    }

    toAdd.push({ play, betInput, result, key });
  }

  console.log(`Slate plays (≥5% EV, deduped by selection): ${plays.length} (${allPlays.length} raw across books)`);
  console.log(`Already in tracker: ${skipped.length}`);
  console.log(`Pending (no result yet): ${pending.length}`);
  console.log(`New graded bets to add: ${toAdd.length}`);

  for (const { play, betInput, result } of toAdd) {
    const grade = betInput.result;
    console.log(
      `  ${betInput.date} ${play.match} · ${play.selection} @ ${play.odds} (${play.book})`
      + ` → actual ${result.cornersHome}-${result.cornersAway} → ${grade}`
    );
  }

  if (pending.length) {
    console.log('\nPending plays (match not finished / no corner data):');
    pending.forEach((p) => {
      console.log(`  ${(p.kickoff || '').slice(0, 10)} ${p.match} · ${p.selection}`);
    });
  }

  if (dryRun) {
    console.log('\n(dry-run — no DynamoDB writes)');
    return;
  }

  if (!toAdd.length) {
    console.log('\n✅ Nothing new to add');
    return;
  }

  const now = new Date().toISOString();
  let nextIndex = model.bets.length + 1;
  const allBetRecords = model.bets.map((b) => enrichBet(b.bet));

  for (const { betInput } of toAdd) {
    const bet = enrichBet(betInput);
    const id = `${PREFIX}-bet-${String(nextIndex).padStart(3, '0')}`;
    nextIndex += 1;
    await docClient.send(new PutCommand({
      TableName: TABLE,
      Item: {
        id,
        league: LEAGUE,
        season: SEASON,
        entityType: 'bet',
        bet,
        updatedAt: now,
      },
    }));
    allBetRecords.push(bet);
    existingKeys.add(betDedupeKey(betInput));
  }

  const summary = computeTrackerSummary(allBetRecords);
  const summaryItem = model.items.find((i) => i.entityType === 'tracker-summary');
  await docClient.send(new PutCommand({
    TableName: TABLE,
    Item: {
      id: `${PREFIX}-tracker-summary`,
      league: LEAGUE,
      season: SEASON,
      entityType: 'tracker-summary',
      summary,
      createdAt: summaryItem?.createdAt || now,
      updatedAt: now,
    },
  }));

  console.log(`\n✅ Added ${toAdd.length} bets. Tracker: ${summary.record}, ${summary.unitsPL?.toFixed(2)}u, ROI ${((summary.roi || 0) * 100).toFixed(1)}%`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
