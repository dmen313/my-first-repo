#!/usr/bin/env node

/**
 * Test script to check if NBA API is accessible
 * This will help us determine if we need a CORS proxy
 */

require('dotenv').config();

const NBA_API_BASE = 'https://stats.nba.com/stats';

async function testNbaApi() {
  console.log('🏀 Testing NBA.com Stats API...\n');
  
  // Test current season (2024-25)
  const currentYear = new Date().getFullYear();
  const seasonStart = currentYear - 1;
  const season = `${seasonStart}-${String(currentYear).slice(-2)}`;
  
  const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular%20Season`;
  
  console.log(`📡 Testing URL: ${standingsUrl}\n`);
  
  try {
    // Try fetching from Node.js (no CORS restrictions)
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(standingsUrl, {
      method: 'GET',
      headers: {
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    console.log(`✅ Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && data.resultSets && data.resultSets.length > 0) {
        const standingsData = data.resultSets[0];
        const headers = standingsData.headers || [];
        const rowSet = standingsData.rowSet || [];
        
        console.log(`\n✅ API is accessible!`);
        console.log(`📊 Found ${rowSet.length} teams`);
        console.log(`📋 Headers: ${headers.slice(0, 5).join(', ')}...`);
        
        if (rowSet.length > 0) {
          const firstTeam = rowSet[0];
          const teamNameIndex = headers.indexOf('TEAM_NAME');
          const winsIndex = headers.indexOf('W');
          const lossesIndex = headers.indexOf('L');
          
          if (teamNameIndex >= 0 && winsIndex >= 0 && lossesIndex >= 0) {
            console.log(`\n📝 Sample team data:`);
            console.log(`   Team: ${firstTeam[teamNameIndex]}`);
            console.log(`   Record: ${firstTeam[winsIndex]}-${firstTeam[lossesIndex]}`);
          }
        }
        
        console.log(`\n✅ NBA API is working from Node.js!`);
        console.log(`⚠️  However, browser-based requests will likely fail due to CORS.`);
        console.log(`💡 Solution: Create a Lambda function to proxy NBA API requests.\n`);
        
        return true;
      } else {
        console.error('❌ Invalid response structure');
        return false;
      }
    } else {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`Response: ${text.substring(0, 200)}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error testing NBA API:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

testNbaApi().then(success => {
  process.exit(success ? 0 : 1);
});

