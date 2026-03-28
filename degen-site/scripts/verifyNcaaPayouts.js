#!/usr/bin/env node

/**
 * Script to verify NCAA 2025 payout table matches achievements
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TEAMS_TABLE = 'sports-hub-teams';
const ACHIEVEMENTS_TABLE = 'sports-hub-achievements';
const PAYOUTS_TABLE = 'sports-hub-payouts';
const SETTINGS_TABLE = 'sports-hub-league-settings';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function verifyNcaaPayouts() {
  console.log('🏈 Verifying NCAA 2025 Payout Table...\n');

  try {
    // Get league settings
    const settingsScan = await docClient.send(new ScanCommand({
      TableName: SETTINGS_TABLE,
      FilterExpression: '#league = :ncaa AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':ncaa': 'ncaa', ':season': '2025' }
    }));
    
    const settings = settingsScan.Items?.[0];
    const totalPool = settings?.totalPool || 6000;
    console.log(`💰 Total Pool: $${totalPool.toLocaleString()}\n`);

    // Get payout structure
    const payoutsScan = await docClient.send(new ScanCommand({
      TableName: PAYOUTS_TABLE,
      FilterExpression: '#league = :ncaa AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':ncaa': 'ncaa', ':season': '2025' }
    }));
    
    const payouts = payoutsScan.Items || [];
    
    // Sort payouts by percentage (highest first)
    payouts.sort((a, b) => b.percentage - a.percentage);
    
    console.log('📊 Payout Structure:');
    console.log('='.repeat(70));
    payouts.forEach(p => {
      const amount = (totalPool * p.percentage / 100).toFixed(0);
      const perTeam = p.teams > 0 ? (amount / p.teams).toFixed(0) : 0;
      console.log(`  ${p.level.padEnd(30)} | ${p.teams} team(s) | ${p.percentage}% | $${amount} ($${perTeam}/team)`);
    });
    console.log('='.repeat(70));

    // Get achievements
    const achievementsScan = await docClient.send(new ScanCommand({
      TableName: ACHIEVEMENTS_TABLE,
      FilterExpression: '#league = :ncaa AND #season = :season AND #achieved = :true',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season', '#achieved': 'achieved' },
      ExpressionAttributeValues: { ':ncaa': 'ncaa', ':season': '2025', ':true': true }
    }));
    
    const achievements = achievementsScan.Items || [];
    
    // Get team names for achievements
    const teamIds = [...new Set(achievements.map(a => a.teamId))];
    const teams = {};
    
    for (const teamId of teamIds) {
      const teamResult = await docClient.send(new GetCommand({
        TableName: TEAMS_TABLE,
        Key: { id: teamId }
      }));
      if (teamResult.Item) {
        teams[teamId] = teamResult.Item;
      }
    }
    
    // Group achievements by type
    const achievementsByType = {};
    achievements.forEach(a => {
      if (!achievementsByType[a.achievementType]) {
        achievementsByType[a.achievementType] = [];
      }
      const team = teams[a.teamId];
      achievementsByType[a.achievementType].push({
        teamId: a.teamId,
        teamName: team?.name || 'Unknown',
        owner: team?.owner || 'Unowned'
      });
    });
    
    console.log('\n📋 Achievements Awarded:');
    console.log('='.repeat(70));
    
    // Map payout levels to achievement types
    const levelToType = {
      'First seed in playoffs': 'firstseedinplayoffs',
      '2nd seed in playoffs': '2ndseedinplayoffs',
      '3rd seed in playoffs': '3rdseedinplayoffs',
      '4th seed in playoffs': '4thseedinplayoffs',
      '5th seed in playoffs': '5thseedinplayoffs',
      'Made CFP - 12 teams': 'madecfp-12teams',
      'Made Top 25 not in playoff': 'madetop25notinplayoff'
    };
    
    let totalPayout = 0;
    const ownerPayouts = { TG: 0, KH: 0, DM: 0, MC: 0 };
    
    for (const payout of payouts) {
      const achievementType = levelToType[payout.level];
      const teamsWithAchievement = achievementsByType[achievementType] || [];
      const expectedTeams = payout.teams;
      const actualTeams = teamsWithAchievement.length;
      const status = actualTeams === expectedTeams ? '✅' : (actualTeams > 0 ? '⚠️' : '❌');
      
      const payoutAmount = totalPool * payout.percentage / 100;
      const perTeamPayout = actualTeams > 0 ? payoutAmount / actualTeams : 0;
      
      console.log(`\n${status} ${payout.level} (Expected: ${expectedTeams}, Actual: ${actualTeams})`);
      console.log(`   Payout: $${payoutAmount.toFixed(0)} total ($${perTeamPayout.toFixed(0)}/team)`);
      
      teamsWithAchievement.forEach(t => {
        console.log(`   - ${t.teamName} (${t.owner})`);
        if (t.owner && ownerPayouts[t.owner] !== undefined) {
          ownerPayouts[t.owner] += perTeamPayout;
        }
        totalPayout += perTeamPayout;
      });
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('💵 Owner Payouts:');
    console.log('='.repeat(70));
    Object.entries(ownerPayouts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([owner, payout]) => {
        console.log(`  ${owner}: $${payout.toFixed(2)}`);
      });
    
    console.log(`\n📊 Total Distributed: $${totalPayout.toFixed(2)} of $${totalPool}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Error verifying payouts:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyNcaaPayouts();

