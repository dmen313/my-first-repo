#!/usr/bin/env node

/**
 * NCAA Tournament 2026 Survivor Pool Setup Script
 * Creates DynamoDB tables, league settings, draft status, access, entries, and seed picks.
 * 11 players, 16 entries, Thursday results finalized, Friday picks pending.
 */

require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const LEAGUE = 'ncaa-survivor';
const SEASON = '2026';

const TABLES = {
  survivorEntries: 'sports-hub-survivor-entries',
  survivorPicks: 'sports-hub-survivor-picks',
  survivorSchedule: 'sports-hub-survivor-schedule',
  leagueSettings: 'sports-hub-league-settings',
  draftStatuses: 'sports-hub-draft-statuses',
  draftAccess: 'sports-hub-draft-access'
};

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ──────────────────────────────────────────────
// Player & Seed Data
// ──────────────────────────────────────────────

const PLAYERS = [
  { name: 'Paul',    email: 'paul.krueger@gmail.com' },
  { name: 'Dev',     email: 'dev.menon@yahoo.com' },
  { name: 'Andy',    email: 'andy.test@example.com' },
  { name: 'Scooter', email: 'scooter.test@example.com' },
  { name: 'David',   email: 'david.test@example.com' },
  { name: 'Joe T',   email: 'joet.test@example.com' },
  { name: 'Jake',    email: 'jake.test@example.com' },
  { name: 'Steve',   email: 'steve.test@example.com' },
  { name: 'Matt',    email: 'matt.test@example.com' },
  { name: 'Beau',    email: 'beau.test@example.com' },
  { name: 'Crane',   email: 'crane.test@example.com' }
];

const THU_DATE = '2026-03-19';
const FRI_DATE = '2026-03-20';

// Each entry: [playerName, entryNumber, totalCost, status, buyBackCount, thuPicks, thuResults, friPicks, friRequired]
// thuResults: map of teamName -> 'win'|'loss'
// friPicks: null means eliminated and no buy-back
const SEED_ENTRIES = [
  {
    player: 'Paul', entry: 1, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Houston', 'Illinois'], thuResults: { Houston: 'win', Illinois: 'win' },
    fri: ['Virginia', 'Kansas'], friRequired: 2
  },
  {
    player: 'Paul', entry: 2, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Nebraska', 'Arkansas'], thuResults: { Nebraska: 'win', Arkansas: 'win' },
    fri: ['Mich St', 'Iowa St'], friRequired: 2
  },
  {
    player: 'Andy', entry: 1, cost: 10, status: 'alive', buyBacks: 1,
    thu: ['Nebraska', 'Wisconsin'], thuResults: { Nebraska: 'win', Wisconsin: 'loss' },
    fri: ['Virginia', 'Alabama', 'UCLA', 'Tennessee'], friRequired: 4,
    lastBuyBackDay: FRI_DATE
  },
  {
    player: 'Andy', entry: 2, cost: 20, status: 'alive', buyBacks: 0,
    thu: ['Vanderbilt', 'Gonzaga'], thuResults: { Vanderbilt: 'win', Gonzaga: 'win' },
    fri: ['Texas Tech', 'St. Johns'], friRequired: 2
  },
  {
    player: 'Scooter', entry: 1, cost: 20, status: 'alive', buyBacks: 1,
    thu: ['BYU', 'Gonzaga'], thuResults: { BYU: 'loss', Gonzaga: 'win' },
    fri: ['Virginia', 'St. Johns', 'Florida', 'Alabama'], friRequired: 4,
    lastBuyBackDay: FRI_DATE
  },
  {
    player: 'Scooter', entry: 2, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Nebraska', 'Arkansas'], thuResults: { Nebraska: 'win', Arkansas: 'win' },
    fri: ['Kansas', 'Purdue'], friRequired: 2
  },
  {
    player: 'David', entry: 1, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Houston', 'Michigan St'], thuResults: { Houston: 'win', 'Michigan St': 'win' },
    fri: ['Kansas', 'Alabama'], friRequired: 2
  },
  {
    player: 'Joe T', entry: 1, cost: 10, status: 'eliminated', buyBacks: 0,
    thu: ['Nebraska', 'Wisconsin'], thuResults: { Nebraska: 'win', Wisconsin: 'loss' },
    fri: null, friRequired: 0,
    eliminatedOnDay: THU_DATE
  },
  {
    player: 'Jake', entry: 1, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Nebraska', 'Illinois'], thuResults: { Nebraska: 'win', Illinois: 'win' },
    fri: ['Virginia', 'Iowa St'], friRequired: 2
  },
  {
    player: 'Steve', entry: 1, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Nebraska', 'Vanderbilt'], thuResults: { Nebraska: 'win', Vanderbilt: 'win' },
    fri: ['Kansas', 'St. Johns'], friRequired: 2
  },
  {
    player: 'Steve', entry: 2, cost: 20, status: 'alive', buyBacks: 1,
    thu: ['St. Marys', 'Arkansas'], thuResults: { 'St. Marys': 'loss', Arkansas: 'loss' },
    fri: ['Virginia', 'Alabama', 'Santa Clara', 'Tennessee'], friRequired: 4,
    lastBuyBackDay: FRI_DATE
  },
  {
    player: 'Matt', entry: 1, cost: 10, status: 'alive', buyBacks: 1,
    thu: ['Vanderbilt', 'Wisconsin'], thuResults: { Vanderbilt: 'win', Wisconsin: 'loss' },
    fri: ['Virginia', 'Kansas', 'UConn', 'Alabama'], friRequired: 4,
    lastBuyBackDay: FRI_DATE
  },
  {
    player: 'Beau', entry: 1, cost: 10, status: 'eliminated', buyBacks: 0,
    thu: ['Nebraska', 'Wisconsin'], thuResults: { Nebraska: 'win', Wisconsin: 'loss' },
    fri: null, friRequired: 0,
    eliminatedOnDay: THU_DATE
  },
  {
    player: 'Crane', entry: 1, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Vanderbilt', 'Nebraska'], thuResults: { Vanderbilt: 'win', Nebraska: 'win' },
    fri: ['Texas Tech', 'Purdue'], friRequired: 2
  },
  {
    player: 'Dev', entry: 1, cost: 10, status: 'alive', buyBacks: 0,
    thu: ['Michigan', 'Illinois'], thuResults: { Michigan: 'win', Illinois: 'win' },
    fri: ['Kansas', 'Iowa St'], friRequired: 2
  }
];

// ──────────────────────────────────────────────
// Table Creation
// ──────────────────────────────────────────────

async function ensureTableExists(tableName, extraGSIs = []) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    console.log(`   ✅ ${tableName} exists`);
    return false;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`   📋 Creating ${tableName}...`);

      const gsis = [
        {
          IndexName: 'league-season-index',
          KeySchema: [
            { AttributeName: 'league', KeyType: 'HASH' },
            { AttributeName: 'season', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        },
        ...extraGSIs
      ];

      const attrDefs = [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'league', AttributeType: 'S' },
        { AttributeName: 'season', AttributeType: 'S' }
      ];

      // Add any extra attributes needed by GSIs
      for (const gsi of extraGSIs) {
        for (const key of gsi.KeySchema) {
          if (!attrDefs.find(a => a.AttributeName === key.AttributeName)) {
            attrDefs.push({ AttributeName: key.AttributeName, AttributeType: 'S' });
          }
        }
      }

      await client.send(new CreateTableCommand({
        TableName: tableName,
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: attrDefs,
        GlobalSecondaryIndexes: gsis,
        BillingMode: 'PAY_PER_REQUEST'
      }));

      console.log(`   ✅ ${tableName} created`);
      return true;
    }
    throw error;
  }
}

async function ensureTablesExist() {
  console.log('\n🗄️  Ensuring DynamoDB tables exist...');

  const picksExtraGSI = [{
    IndexName: 'league-day-index',
    KeySchema: [
      { AttributeName: 'league', KeyType: 'HASH' },
      { AttributeName: 'gameDay', KeyType: 'RANGE' }
    ],
    Projection: { ProjectionType: 'ALL' }
  }];

  const created = [];
  if (await ensureTableExists(TABLES.survivorEntries)) created.push('entries');
  if (await ensureTableExists(TABLES.survivorPicks, picksExtraGSI)) created.push('picks');
  if (await ensureTableExists(TABLES.survivorSchedule)) created.push('schedule');

  if (created.length > 0) {
    console.log(`   ⏳ Waiting 15s for table(s) to become active...`);
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
}

// ──────────────────────────────────────────────
// Data Cleanup
// ──────────────────────────────────────────────

async function deleteFromTable(tableName, indexName) {
  try {
    const command = new QueryCommand({
      TableName: tableName,
      IndexName: indexName || 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
    });
    const result = await docClient.send(command);
    for (const item of result.Items || []) {
      await docClient.send(new DeleteCommand({ TableName: tableName, Key: { id: item.id } }));
    }
    return result.Items?.length || 0;
  } catch (e) {
    return 0;
  }
}

async function deleteExistingData() {
  console.log('\n🗑️  Cleaning existing survivor data...');
  const counts = {};
  counts.entries = await deleteFromTable(TABLES.survivorEntries);
  counts.picks = await deleteFromTable(TABLES.survivorPicks);
  counts.schedule = await deleteFromTable(TABLES.survivorSchedule);
  counts.statuses = await deleteFromTable(TABLES.draftStatuses);
  counts.settings = await deleteFromTable(TABLES.leagueSettings);
  counts.access = await deleteFromTable(TABLES.draftAccess);

  for (const [key, count] of Object.entries(counts)) {
    if (count > 0) console.log(`   ✓ Deleted ${count} ${key}`);
  }
}

// ──────────────────────────────────────────────
// Config Records
// ──────────────────────────────────────────────

async function createLeagueSettings() {
  console.log('\n⚙️  Creating league settings...');
  const now = new Date().toISOString();
  const totalPool = SEED_ENTRIES.reduce((sum, e) => sum + e.cost, 0);

  await docClient.send(new PutCommand({
    TableName: TABLES.leagueSettings,
    Item: {
      id: generateId(),
      league: LEAGUE,
      season: SEASON,
      buyInPerTeam: 10,
      numTeams: SEED_ENTRIES.length,
      totalPool: totalPool,
      createdAt: now,
      updatedAt: now
    }
  }));
  console.log(`   ✅ Pool: ${SEED_ENTRIES.length} entries, $${totalPool} pot`);
}

async function setDraftStatus() {
  console.log('\n📊 Setting draft status...');
  const now = new Date().toISOString();
  await docClient.send(new PutCommand({
    TableName: TABLES.draftStatuses,
    Item: {
      id: generateId(),
      league: LEAGUE,
      season: SEASON,
      status: 'Draft In Progress',
      createdAt: now,
      updatedAt: now
    }
  }));
  console.log('   ✅ Status: Draft In Progress');
}

async function setDraftAccess() {
  console.log('\n🔐 Setting draft access...');
  const now = new Date().toISOString();
  const emails = PLAYERS.map(p => p.email);
  await docClient.send(new PutCommand({
    TableName: TABLES.draftAccess,
    Item: {
      id: `${LEAGUE}-${SEASON}-${Date.now()}`,
      league: LEAGUE,
      season: SEASON,
      userEmails: emails,
      createdAt: now,
      updatedAt: now
    }
  }));
  console.log(`   ✅ Access granted to ${emails.length} users`);
}

// ──────────────────────────────────────────────
// Entries & Picks
// ──────────────────────────────────────────────

async function createEntries() {
  console.log('\n👥 Creating survivor entries...');
  const now = new Date().toISOString();
  let aliveCount = 0;
  let eliminatedCount = 0;

  for (const seed of SEED_ENTRIES) {
    const player = PLAYERS.find(p => p.name === seed.player);
    const entryId = `${LEAGUE}-${SEASON}-${seed.player}-${seed.entry}`;

    // Build usedTeams from all picks
    const usedTeams = [...seed.thu];
    if (seed.fri) usedTeams.push(...seed.fri);

    const item = {
      id: entryId,
      league: LEAGUE,
      season: SEASON,
      playerName: seed.player,
      entryNumber: seed.entry,
      email: player?.email || null,
      status: seed.status,
      buyBackCount: seed.buyBacks,
      totalCost: seed.cost,
      usedTeams: usedTeams,
      eliminatedOnDay: seed.eliminatedOnDay || null,
      lastBuyBackDay: seed.lastBuyBackDay || null,
      createdAt: now,
      updatedAt: now
    };

    await docClient.send(new PutCommand({ TableName: TABLES.survivorEntries, Item: item }));

    const statusIcon = seed.status === 'alive' ? '🟢' : '🔴';
    const buyBackNote = seed.buyBacks > 0 ? ` (bought back ×${seed.buyBacks})` : '';
    const label = seed.entry > 1 ? `${seed.player} #${seed.entry}` : seed.player;
    console.log(`   ${statusIcon} ${label.padEnd(14)} $${seed.cost.toString().padStart(2)}${buyBackNote}`);

    if (seed.status === 'alive') aliveCount++;
    else eliminatedCount++;
  }

  console.log(`\n   ✅ ${SEED_ENTRIES.length} entries: ${aliveCount} alive, ${eliminatedCount} eliminated`);
}

async function createSeedPicks() {
  console.log('\n🏀 Creating seed picks...');
  const now = new Date().toISOString();
  let thuCount = 0;
  let friCount = 0;

  for (const seed of SEED_ENTRIES) {
    const entryId = `${LEAGUE}-${SEASON}-${seed.player}-${seed.entry}`;

    // Thursday picks (all entries have these, results finalized)
    const thuPassed = Object.values(seed.thuResults).every(r => r === 'win');
    await docClient.send(new PutCommand({
      TableName: TABLES.survivorPicks,
      Item: {
        id: `${entryId}-${THU_DATE}`,
        entryId: entryId,
        league: LEAGUE,
        season: SEASON,
        playerName: seed.player,
        gameDay: THU_DATE,
        teamNames: seed.thu,
        requiredPicks: 2,
        results: seed.thuResults,
        passed: thuPassed,
        submittedAt: now,
        updatedAt: now
      }
    }));
    thuCount++;

    // Friday picks (only alive entries that have picks)
    if (seed.fri && seed.fri.length > 0) {
      const friResults = {};
      seed.fri.forEach(t => { friResults[t] = 'pending'; });

      await docClient.send(new PutCommand({
        TableName: TABLES.survivorPicks,
        Item: {
          id: `${entryId}-${FRI_DATE}`,
          entryId: entryId,
          league: LEAGUE,
          season: SEASON,
          playerName: seed.player,
          gameDay: FRI_DATE,
          teamNames: seed.fri,
          requiredPicks: seed.friRequired,
          results: friResults,
          passed: null,
          submittedAt: now,
          updatedAt: now
        }
      }));
      friCount++;
    }
  }

  console.log(`   ✅ Thursday picks: ${thuCount} (results finalized)`);
  console.log(`   ✅ Friday picks: ${friCount} (pending)`);
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏀 NCAA Survivor Pool 2026 Setup');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    await ensureTablesExist();
    await deleteExistingData();
    await createLeagueSettings();
    await setDraftStatus();
    await setDraftAccess();
    await createEntries();
    await createSeedPicks();

    const totalPool = SEED_ENTRIES.reduce((sum, e) => sum + e.cost, 0);
    const aliveCount = SEED_ENTRIES.filter(e => e.status === 'alive').length;

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ NCAA Survivor Pool 2026 Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Summary:');
    console.log(`   - Players: ${PLAYERS.length}`);
    console.log(`   - Entries: ${SEED_ENTRIES.length} (${aliveCount} alive)`);
    console.log(`   - Pool: $${totalPool}`);
    console.log(`   - Thu R1: All picks in, results finalized`);
    console.log(`   - Fri R1: ${SEED_ENTRIES.filter(e => e.fri).length} entries with picks submitted (pending)`);
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
