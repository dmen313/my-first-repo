#!/usr/bin/env node

/**
 * Debug script to check NFL odds matching
 */

require('dotenv').config();

const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

async function debugOdds() {
  const fetch = globalThis.fetch || (await import('node-fetch')).default;
  
  console.log('🔍 Debugging NFL Super Bowl Odds Matching...\n');
  
  const nflEndpoint = 'americanfootball_nfl_super_bowl_winner';
  const oddsUrl = `${ODDS_API_BASE}/sports/${nflEndpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
  
  const response = await fetch(oddsUrl);
  const oddsData = await response.json();
  
  // Build oddsMap exactly like the update script does
  const oddsMap = {};
  
  if (oddsData && oddsData[0] && oddsData[0].bookmakers) {
    const bookmaker = oddsData[0].bookmakers[0];
    const market = bookmaker.markets[0];
    
    market.outcomes.forEach(outcome => {
      const exactName = outcome.name;
      const normalizedName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
      
      // Store exact name
      oddsMap[exactName] = odds;
      
      // Store normalized name
      oddsMap[normalizedName] = odds;
      
      // Store variations
      const nameParts = normalizedName.split(/\s+/);
      if (nameParts.length > 1) {
        oddsMap[nameParts[nameParts.length - 1]] = odds;
        if (nameParts.length >= 2) {
          oddsMap[nameParts.slice(-2).join(' ')] = odds;
        }
      }
    });
  }
  
  console.log('='.repeat(60));
  console.log('ALL KEYS IN ODDSMAP:');
  console.log('='.repeat(60));
  Object.entries(oddsMap).forEach(([key, value]) => {
    console.log(`  "${key}" -> ${value}`);
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('MATCHING LOGIC FOR PROBLEM TEAMS:');
  console.log('='.repeat(60));
  
  const teamsToDebug = ['Las Vegas Raiders', 'Washington Commanders'];
  
  for (const dbTeamName of teamsToDebug) {
    console.log(`\n🔍 Matching: "${dbTeamName}"`);
    
    // Step 1: Exact match
    if (oddsMap[dbTeamName]) {
      console.log(`   ✅ EXACT MATCH: ${oddsMap[dbTeamName]}`);
      continue;
    }
    console.log(`   ❌ No exact match`);
    
    // Step 2: Normalized match
    const normalizedName = dbTeamName.toLowerCase().replace(/[^a-z\s]/g, '').trim();
    console.log(`   Normalized name: "${normalizedName}"`);
    if (oddsMap[normalizedName]) {
      console.log(`   ✅ NORMALIZED MATCH: ${oddsMap[normalizedName]}`);
      continue;
    }
    console.log(`   ❌ No normalized match`);
    
    // Step 3: Partial matching
    console.log(`   Checking partial matches...`);
    const oddsKeys = Object.keys(oddsMap);
    
    for (const apiName of oddsKeys) {
      // Check if apiName contains dbTeamName
      if (apiName.toLowerCase().includes(dbTeamName.toLowerCase())) {
        console.log(`   🔶 PARTIAL MATCH (apiName contains team): "${apiName}" -> ${oddsMap[apiName]}`);
      }
      
      // Check if dbTeamName contains apiName
      if (dbTeamName.toLowerCase().includes(apiName.toLowerCase())) {
        console.log(`   🔶 PARTIAL MATCH (team contains apiName): "${apiName}" -> ${oddsMap[apiName]}`);
      }
      
      // Check word matching
      const dbWords = dbTeamName.split(' ').filter(w => w.length > 3);
      for (const dbWord of dbWords) {
        if (apiName.toLowerCase().includes(dbWord.toLowerCase())) {
          console.log(`   🔷 WORD MATCH: word "${dbWord}" found in "${apiName}" -> ${oddsMap[apiName]}`);
        }
      }
    }
    
    // Step 4: Last word match
    const nameParts = normalizedName.split(/\s+/);
    const lastWord = nameParts[nameParts.length - 1];
    console.log(`   Last word: "${lastWord}"`);
    if (oddsMap[lastWord]) {
      console.log(`   ✅ LAST WORD MATCH: ${oddsMap[lastWord]}`);
    } else {
      console.log(`   ❌ No last word match`);
    }
  }
}

debugOdds().catch(console.error);
