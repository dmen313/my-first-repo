#!/usr/bin/env node

/**
 * Test script to validate ESPN NFL API response and compare seasons
 */

require('dotenv').config();

async function testEspnApi() {
  const fetch = globalThis.fetch || (await import('node-fetch')).default;
  
  // Try different season parameters
  const seasons = ['2024', '2025'];
  
  for (const season of seasons) {
    const url = `https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${season}`;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🏈 Testing ESPN NFL API for season ${season}...`);
    console.log('URL:', url);
    console.log('='.repeat(60));
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });
      
      const data = await response.json();
      const apiSeason = data.children?.[0]?.standings?.season;
      const seasonType = data.children?.[0]?.standings?.seasonType;
      const seasonDisplayName = data.children?.[0]?.standings?.seasonDisplayName;
      
      console.log(`API Season: ${apiSeason}, Type: ${seasonType}, Display: ${seasonDisplayName}`);
      
      // Extract all teams with records
      const teams = [];
      
      if (data.children) {
        for (const conf of data.children) {
          if (conf.standings && conf.standings.entries) {
            for (const entry of conf.standings.entries) {
              const team = entry.team;
              const stats = entry.stats || [];
              
              let wins = 0, losses = 0, ties = 0;
              
              for (const stat of stats) {
                const statName = (stat.name || '').toLowerCase();
                if (statName === 'wins') wins = parseInt(stat.value) || 0;
                else if (statName === 'losses') losses = parseInt(stat.value) || 0;
                else if (statName === 'ties') ties = parseInt(stat.value) || 0;
              }
              
              const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
              teams.push({ name: team.displayName, record, wins, losses, ties });
            }
          }
        }
      }
      
      console.log(`\nTotal teams: ${teams.length}`);
      
      // Show specific teams we care about
      const teamsOfInterest = ['San Francisco 49ers', 'Kansas City Chiefs', 'Detroit Lions', 'Buffalo Bills', 'Philadelphia Eagles'];
      console.log('\nKey teams:');
      for (const teamName of teamsOfInterest) {
        const team = teams.find(t => t.name === teamName);
        if (team) {
          console.log(`  ${team.name}: ${team.record}`);
        }
      }
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
  
  // Also try the scoreboard/schedule to see real current data
  console.log('\n' + '='.repeat(60));
  console.log('🏈 Checking ESPN NFL Teams API...');
  console.log('='.repeat(60));
  
  const teamsUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
  
  try {
    const response = await fetch(teamsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    const data = await response.json();
    
    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      const teams = data.sports[0].leagues[0].teams;
      console.log(`Found ${teams.length} teams`);
      
      // Find 49ers
      const niners = teams.find(t => t.team?.displayName?.includes('49ers'));
      if (niners && niners.team) {
        console.log('\n49ers data:');
        console.log('  Name:', niners.team.displayName);
        console.log('  Record:', niners.team.record?.items?.[0]?.summary);
      }
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testEspnApi().catch(console.error);
