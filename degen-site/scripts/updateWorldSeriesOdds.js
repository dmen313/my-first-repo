#!/usr/bin/env node

/**
 * World Series Odds Updater Script
 * 
 * This script fetches the latest World Series odds from multiple sources
 * and updates the GraphQL database with current odds data.
 * 
 * Usage: node scripts/updateWorldSeriesOdds.js
 */

const { ApolloClient, InMemoryCache, gql } = require('@apollo/client/core');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

// GraphQL client setup
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
  fetch: fetch
});

// GraphQL mutation to update team odds
const UPDATE_TEAM_ODDS = gql`
  mutation UpdateTeamOdds($teamId: ID!, $odds: String!) {
    updateTeam(input: { id: $teamId, odds: $odds }) {
      id
      name
      odds
      updatedAt
    }
  }
`;

// MLB team mappings for odds lookup
const TEAM_MAPPINGS = {
  // American League
  'Los Angeles Angels': ['Angels', 'LAA', 'Los Angeles Angels'],
  'Houston Astros': ['Astros', 'HOU', 'Houston Astros'],
  'Oakland Athletics': ['Athletics', 'OAK', 'Oakland Athletics', 'A\'s'],
  'Seattle Mariners': ['Mariners', 'SEA', 'Seattle Mariners'],
  'Texas Rangers': ['Rangers', 'TEX', 'Texas Rangers'],
  'Minnesota Twins': ['Twins', 'MIN', 'Minnesota Twins'],
  'Chicago White Sox': ['White Sox', 'CWS', 'Chicago White Sox'],
  'Cleveland Guardians': ['Guardians', 'CLE', 'Cleveland Guardians'],
  'Detroit Tigers': ['Tigers', 'DET', 'Detroit Tigers'],
  'Kansas City Royals': ['Royals', 'KC', 'Kansas City Royals'],
  'New York Yankees': ['Yankees', 'NYY', 'New York Yankees'],
  'Boston Red Sox': ['Red Sox', 'BOS', 'Boston Red Sox'],
  'Toronto Blue Jays': ['Blue Jays', 'TOR', 'Toronto Blue Jays'],
  'Baltimore Orioles': ['Orioles', 'BAL', 'Baltimore Orioles'],
  'Tampa Bay Rays': ['Rays', 'TB', 'Tampa Bay Rays'],
  
  // National League
  'Los Angeles Dodgers': ['Dodgers', 'LAD', 'Los Angeles Dodgers'],
  'San Diego Padres': ['Padres', 'SD', 'San Diego Padres'],
  'San Francisco Giants': ['Giants', 'SF', 'San Francisco Giants'],
  'Colorado Rockies': ['Rockies', 'COL', 'Colorado Rockies'],
  'Arizona Diamondbacks': ['Diamondbacks', 'AZ', 'Arizona Diamondbacks'],
  'St. Louis Cardinals': ['Cardinals', 'STL', 'St. Louis Cardinals'],
  'Milwaukee Brewers': ['Brewers', 'MIL', 'Milwaukee Brewers'],
  'Chicago Cubs': ['Cubs', 'CHC', 'Chicago Cubs'],
  'Cincinnati Reds': ['Reds', 'CIN', 'Cincinnati Reds'],
  'Pittsburgh Pirates': ['Pirates', 'PIT', 'Pittsburgh Pirates'],
  'Atlanta Braves': ['Braves', 'ATL', 'Atlanta Braves'],
  'Miami Marlins': ['Marlins', 'MIA', 'Miami Marlins'],
  'New York Mets': ['Mets', 'NYM', 'New York Mets'],
  'Philadelphia Phillies': ['Phillies', 'PHI', 'Philadelphia Phillies'],
  'Washington Nationals': ['Nationals', 'WAS', 'Washington Nationals']
};

// Default odds in case APIs fail
const FALLBACK_ODDS = {
  'Los Angeles Dodgers': '+350',
  'New York Yankees': '+450',
  'Philadelphia Phillies': '+650',
  'Atlanta Braves': '+750',
  'Houston Astros': '+850',
  'Baltimore Orioles': '+900',
  'San Diego Padres': '+1000',
  'New York Mets': '+1100',
  'Milwaukee Brewers': '+1200',
  'Arizona Diamondbacks': '+1400',
  'Seattle Mariners': '+1600',
  'Boston Red Sox': '+1800',
  'Cleveland Guardians': '+2000',
  'Toronto Blue Jays': '+2200',
  'St. Louis Cardinals': '+2500',
  'Tampa Bay Rays': '+2800',
  'Minnesota Twins': '+3000',
  'Chicago Cubs': '+3500',
  'Texas Rangers': '+4000',
  'San Francisco Giants': '+4500',
  'Kansas City Royals': '+5000',
  'Detroit Tigers': '+6000',
  'Cincinnati Reds': '+7000',
  'Washington Nationals': '+8000',
  'Miami Marlins': '+10000',
  'Pittsburgh Pirates': '+12000',
  'Chicago White Sox': '+15000',
  'Oakland Athletics': '+20000',
  'Colorado Rockies': '+25000',
  'Los Angeles Angels': '+30000'
};

/**
 * Fetch odds from The Odds API (if available)
 */
async function fetchOddsAPI() {
  const apiKey = process.env.REACT_APP_ODDS_API_KEY;
  
  if (!apiKey || apiKey === 'YOUR_API_KEY' || apiKey.includes('your_api_key_here')) {
    console.log('⚠️ Odds API key not configured, skipping API fetch');
    return null;
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb_world_series_winner/odds?regions=us&oddsFormat=american&apiKey=${apiKey}`;
    
    console.log('🔄 Fetching odds from The Odds API...');
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error_code) {
      if (data.error_code === 'OUT_OF_USAGE_CREDITS') {
        console.log('🚫 API quota exceeded, using fallback data');
        return null;
      }
      throw new Error(`API error: ${data.message || 'Unknown error'}`);
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No odds data received from API');
      return null;
    }

    // Parse API response
    const oddsMap = {};
    data.forEach(game => {
      if (game.bookmakers && game.bookmakers.length > 0) {
        const bookmaker = game.bookmakers[0]; // Use first bookmaker
        if (bookmaker.markets && bookmaker.markets.length > 0) {
          const market = bookmaker.markets[0]; // Use first market
          if (market.outcomes) {
            market.outcomes.forEach(outcome => {
              const teamName = outcome.name;
              const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
              
              // Find matching team in our mappings
              for (const [fullName, aliases] of Object.entries(TEAM_MAPPINGS)) {
                if (aliases.some(alias => 
                  teamName.toLowerCase().includes(alias.toLowerCase()) ||
                  alias.toLowerCase().includes(teamName.toLowerCase())
                )) {
                  oddsMap[fullName] = odds;
                  break;
                }
              }
            });
          }
        }
      }
    });

    console.log(`✅ Fetched odds for ${Object.keys(oddsMap).length} teams from API`);
    return oddsMap;

  } catch (error) {
    console.error('❌ Error fetching from Odds API:', error.message);
    return null;
  }
}

/**
 * Scrape odds from a backup source (ESPN or similar)
 */
async function scrapeBackupOdds() {
  try {
    console.log('🔄 Attempting to scrape backup odds...');
    
    // This is a placeholder for web scraping
    // In a real implementation, you might scrape from ESPN, CBS Sports, etc.
    // For now, we'll return null to fall back to default odds
    
    console.log('⚠️ Web scraping not implemented, using fallback odds');
    return null;
    
  } catch (error) {
    console.error('❌ Error scraping backup odds:', error.message);
    return null;
  }
}

/**
 * Get all teams from GraphQL
 */
async function getTeamsFromGraphQL() {
  const GET_TEAMS = gql`
    query GetMLBTeams {
      getTeams(league: "mlb", season: "2025") {
        id
        name
        odds
      }
    }
  `;

  try {
    const { data } = await client.query({ query: GET_TEAMS });
    return data.getTeams || [];
  } catch (error) {
    console.error('❌ Error fetching teams from GraphQL:', error.message);
    throw error;
  }
}

/**
 * Update team odds in GraphQL
 */
async function updateTeamOdds(teamId, odds) {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_TEAM_ODDS,
      variables: { teamId, odds }
    });
    return data.updateTeam;
  } catch (error) {
    console.error(`❌ Error updating odds for team ${teamId}:`, error.message);
    throw error;
  }
}

/**
 * Find best matching odds for a team
 */
function findTeamOdds(teamName, apiOdds, fallbackOdds) {
  // First try exact match
  if (apiOdds && apiOdds[teamName]) {
    return apiOdds[teamName];
  }
  
  // Try alias matching
  if (apiOdds && TEAM_MAPPINGS[teamName]) {
    for (const alias of TEAM_MAPPINGS[teamName]) {
      for (const [oddsTeam, odds] of Object.entries(apiOdds)) {
        if (oddsTeam.toLowerCase().includes(alias.toLowerCase()) ||
            alias.toLowerCase().includes(oddsTeam.toLowerCase())) {
          return odds;
        }
      }
    }
  }
  
  // Only use fallback if provided (null means preserve existing odds)
  if (fallbackOdds) {
    return fallbackOdds[teamName] || '+5000';
  }
  
  // Return null to indicate no API data available
  return null;
}

/**
 * Main execution function
 */
async function main() {
  const forceUpdate = process.argv.includes('--force-fallback');
  
  if (forceUpdate) {
    console.log('🚀 Starting World Series Odds Update (FORCE MODE - will use fallback odds)...');
  } else {
    console.log('🚀 Starting World Series Odds Update...');
  }
  
  try {
    // Step 1: Fetch current teams from GraphQL
    console.log('📊 Fetching teams from GraphQL...');
    const teams = await getTeamsFromGraphQL();
    console.log(`Found ${teams.length} MLB teams`);

    if (teams.length === 0) {
      throw new Error('No teams found in GraphQL database');
    }

    // Step 2: Try to fetch odds from API
    const apiOdds = await fetchOddsAPI();
    
    // Step 3: Try backup scraping if API failed
    const scrapedOdds = apiOdds ? null : await scrapeBackupOdds();
    
    // Step 4: Only proceed if we have real API data (unless forced)
    if (!apiOdds && !scrapedOdds && !forceUpdate) {
      console.log('⚠️ No live API data available - skipping odds update to preserve existing data');
      console.log('💡 Current odds will be preserved until fresh API data is available');
      console.log('💡 Use --force-fallback flag to update with researched fallback odds');
      console.log('\n📊 Update Summary:');
      console.log('✅ Successfully updated: 0 teams');
      console.log(`➡️ Preserved existing odds: ${teams.length} teams`);
      console.log('❌ Errors: 0 teams');
      console.log('📈 Odds source: None (API unavailable)');
      console.log(`🕒 Check completed at: ${new Date().toLocaleString()}`);
      console.log('\n📋 Existing odds preserved - no changes made.');
      return;
    }

    const oddsSource = apiOdds || scrapedOdds || (forceUpdate ? FALLBACK_ODDS : null);
    const sourceName = apiOdds ? 'The Odds API' : 
                      scrapedOdds ? 'Web Scraping' : 
                      'Fallback Data (Forced)';
    
    console.log(`📈 Using live odds from: ${sourceName}`);

    // Step 5: Update each team's odds
    let updatedCount = 0;
    let errorCount = 0;

    for (const team of teams) {
      try {
        const newOdds = findTeamOdds(team.name, oddsSource, forceUpdate ? FALLBACK_ODDS : null);
        
        if (newOdds && newOdds !== team.odds) {
          await updateTeamOdds(team.id, newOdds);
          console.log(`✅ Updated ${team.name}: ${team.odds} → ${newOdds}`);
          updatedCount++;
        } else if (newOdds) {
          console.log(`➡️ No change for ${team.name}: ${team.odds}`);
        } else {
          console.log(`⚠️ No API data for ${team.name} - preserving existing odds: ${team.odds}`);
        }
      } catch (error) {
        console.error(`❌ Failed to update ${team.name}:`, error.message);
        errorCount++;
      }
    }

    // Step 6: Summary
    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} teams`);
    console.log(`➡️ No changes needed: ${teams.length - updatedCount - errorCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`📈 Odds source: ${sourceName}`);
    console.log(`🕒 Update completed at: ${new Date().toLocaleString()}`);

    if (updatedCount > 0) {
      console.log('\n🎉 World Series odds have been updated successfully!');
    } else {
      console.log('\n📋 All odds were already up to date.');
    }

  } catch (error) {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main, fetchOddsAPI, FALLBACK_ODDS };
