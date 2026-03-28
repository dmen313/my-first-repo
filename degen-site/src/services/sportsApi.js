import { updateTeamApiData } from '../graphql/client.js';

// Helper function to fetch teams from GraphQL
async function fetchTeamsFromGraphQL(league, season) {
  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "${league}", season: "${season}") {
              id
              name
              record
              league
              division
              wins
              losses
              gamesBack
              wildCardGamesBack
              owner
              odds
            }
          }
        `
      })
    });
    const data = await response.json();
    return data.data?.getTeams || [];
  } catch (error) {
    console.error(`Error fetching ${league} teams:`, error);
    return [];
  }
}

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || 'YOUR_API_KEY';
const NFL_API_BASE = 'https://nfl-api-data.p.rapidapi.com';
const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY;
const NBA_API_BASE = 'https://stats.nba.com/stats';

// Owner mapping for MLB teams
const getOwnerForTeam = (teamName, teamId) => {
  // Owner assignments based on team name or ID
  const ownerMap = {
    147: 'DM',         // New York Yankees
    111: 'MC',         // Boston Red Sox  
    141: 'KH',         // Toronto Blue Jays
    139: 'TG',         // Tampa Bay Rays
    110: 'KH',         // Baltimore Orioles
    116: 'KH',         // Detroit Tigers
    145: 'No Owner',   // Chicago White Sox
    114: 'DM',         // Cleveland Guardians
    142: 'DM',         // Minnesota Twins
    118: 'TG',         // Kansas City Royals
    117: 'TG',         // Houston Astros
    136: 'DM',         // Seattle Mariners
    140: 'KH',         // Texas Rangers
    108: 'KH',         // Los Angeles Angels
    133: 'DM',         // Oakland Athletics
    143: 'MC',         // Philadelphia Phillies
    144: 'TG',         // Atlanta Braves
    146: 'TG',         // Miami Marlins
    121: 'MC',         // New York Mets
    120: 'MC',         // Washington Nationals
    158: 'TG',         // Milwaukee Brewers
    112: 'TG',         // Chicago Cubs
    113: 'MC',         // Cincinnati Reds
    134: 'KH',         // Pittsburgh Pirates
    138: 'DM',         // St. Louis Cardinals
    119: 'KH',         // Los Angeles Dodgers
    135: 'DM',         // San Diego Padres
    137: 'MC',         // San Francisco Giants
    115: 'No Owner',   // Colorado Rockies
    109: 'MC'          // Arizona Diamondbacks
  };
  
  return ownerMap[teamId] || 'No Owner';
};

// League configurations
const LEAGUE_CONFIG = {
  'mlb-2024': {
    name: 'Major League Baseball 2024',
    league: 'mlb',
    season: '2024',
    oddsEndpoint: 'baseball_mlb_world_series_winner',
    hasLiveData: true, // Uses API for standings
    showColumns: {
      gamesBack: true,
      wildCardGamesBack: true,
      odds: true
    },
    achievementLevels: [
      { level: 'Wild Card', teams: 4, pct: 5.00 },
      { level: 'Division', teams: 8, pct: 20.00 },
      { level: 'League', teams: 4, pct: 24.00 },
      { level: 'World Series', teams: 2, pct: 24.00 },
      { level: 'Winner', teams: 1, pct: 27.00 }
    ]
  },
  'mlb-2025': {
    name: 'Major League Baseball 2025',
    league: 'mlb',
    season: '2025',
    oddsEndpoint: 'baseball_mlb_world_series_winner',
    hasLiveData: true, // Uses API for standings
    showColumns: {
      gamesBack: true,
      wildCardGamesBack: true,
      odds: true
    },
    achievementLevels: [
      { level: 'Wild Card', teams: 4, pct: 5.00 },
      { level: 'Division', teams: 8, pct: 20.00 },
      { level: 'League', teams: 4, pct: 24.00 },
      { level: 'World Series', teams: 2, pct: 24.00 },
      { level: 'Winner', teams: 1, pct: 22.50 },
      { level: 'Worst Record', teams: 1, pct: 4.50 }
    ]
  },
  'nba-2024': {
    name: 'National Basketball Association 2024',
    league: 'nba',
    season: '2024',
    oddsEndpoint: 'basketball_nba_championship',
    hasLiveData: true, // Uses NBA API for standings
    showColumns: {
      gamesBack: false,
      wildCardGamesBack: false,
      odds: false
    },
    achievementLevels: [
      { level: 'Play-In', teams: 4, pct: 5.00 },
      { level: 'Playoffs', teams: 16, pct: 12.00 },
      { level: 'Conference Semis', teams: 8, pct: 18.00 },
      { level: 'Conference Finals', teams: 4, pct: 20.00 },
      { level: 'NBA Finals', teams: 2, pct: 20.00 },
      { level: 'Champion', teams: 1, pct: 8.00 },
      { level: 'Worst Team', teams: 1, pct: 3.00 },
      { level: '1st West All-Star', teams: 1, pct: 5.00 },
      { level: '1st East All-Star', teams: 1, pct: 5.00 },
      { level: '2nd West All-Star', teams: 1, pct: 2.00 },
      { level: '2nd East All-Star', teams: 1, pct: 2.00 }
    ]
  },
  'nba-2025': {
    name: 'National Basketball Association 2025',
    league: 'nba',
    season: '2025',
    oddsEndpoint: 'basketball_nba_championship',
    hasLiveData: true, // Uses NBA API for standings
    showColumns: {
      gamesBack: false,
      wildCardGamesBack: false,
      odds: true
    },
    achievementLevels: [
      { level: 'Play-In', teams: 4, pct: 5.00 },
      { level: 'Playoffs', teams: 16, pct: 12.00 },
      { level: 'Conference Semis', teams: 8, pct: 18.00 },
      { level: 'Conference Finals', teams: 4, pct: 20.00 },
      { level: 'NBA Finals', teams: 2, pct: 20.00 },
      { level: 'Champion', teams: 1, pct: 8.00 },
      { level: 'Worst Team', teams: 1, pct: 3.00 },
      { level: '1st West All-Star', teams: 1, pct: 5.00 },
      { level: '1st East All-Star', teams: 1, pct: 5.00 },
      { level: '2nd West All-Star', teams: 1, pct: 2.00 },
      { level: '2nd East All-Star', teams: 1, pct: 2.00 }
    ]
  },
  'nfl-2025': {
    name: 'National Football League 2025',
    league: 'nfl',
    season: '2025',
    oddsEndpoint: 'americanfootball_nfl_super_bowl_winner',
    hasLiveData: true, // Uses NFL API for standings
    showColumns: {
      gamesBack: true,
      wildCardGamesBack: true,
      odds: true
    },
    achievementLevels: [
      { level: 'Make it to First Round', teams: 12, pct: 12.50 },
      { level: 'First Round Bye', teams: 2, pct: 1.50 },
      { level: 'Make it to Divisional Round', teams: 8, pct: 14.00 },
      { level: 'Make it to Conference', teams: 4, pct: 16.00 },
      { level: 'Make it to Superbowl', teams: 2, pct: 20.00 },
      { level: 'Win Superbowl', teams: 1, pct: 22.00 },
      { level: 'Last team to lose a game', teams: 1, pct: 5.00 },
      { level: 'Last team to win a game', teams: 1, pct: 5.00 },
      { level: 'Division winners', teams: 8, pct: 0.00 },
      { level: 'Drafter that picks most total wins', teams: 1, pct: 0.00 }
    ]
  },
  'ncaa-2025': {
    name: 'NCAA Football 2025',
    teams: [], // Will be populated from CFBD API
    oddsEndpoint: 'americanfootball_ncaaf_championship_winner',
    hasLiveData: true, // Uses CFBD API for records and Odds API for odds
    showColumns: {
      gamesBack: false,
      wildCardGamesBack: false,
      odds: true
    },
    achievementLevels: [
      { level: 'Make Playoffs', teams: 12, pct: 15.00 },
      { level: 'Make Quarterfinals', teams: 8, pct: 20.00 },
      { level: 'Make Semifinals', teams: 4, pct: 25.00 },
      { level: 'Make Championship', teams: 2, pct: 30.00 },
      { level: 'Win Championship', teams: 1, pct: 10.00 }
    ]
  },
  'nhl-2025': {
    name: 'National Hockey League 2025',
    league: 'nhl',
    season: '2025',
    oddsEndpoint: 'icehockey_nhl_championship_winner',
    hasLiveData: false, // Will load from DynamoDB
    showColumns: {
      gamesBack: false,
      wildCardGamesBack: false,
      odds: true
    },
    achievementLevels: [
      { level: 'Round 1', teams: 16, pct: 16.00 },
      { level: 'Round 2', teams: 8, pct: 20.00 },
      { level: 'Conference', teams: 4, pct: 24.00 },
      { level: 'Stanley Cup', teams: 2, pct: 16.00 },
      { level: 'Winner', teams: 1, pct: 16.00 },
      { level: '1st Seed in Each Division', teams: 4, pct: 8.00 }
    ]
  },
  'nfl-mvp-2025': {
    name: 'NFL MVP 2025',
    league: 'nfl-mvp',
    season: '2025',
    oddsEndpoint: 'americanfootball_nfl_mvp',
    hasLiveData: false, // Will load from DynamoDB
    showColumns: {
      gamesBack: false,
      wildCardGamesBack: false,
      odds: true
    },
    achievementLevels: [
      { level: '1st Place (MVP Winner)', teams: 1, pct: 60.00 },
      { level: '2nd Place', teams: 1, pct: 30.00 },
      { level: '3rd Place', teams: 1, pct: 10.00 }
    ]
  }
};



// Fetch live odds from The Odds API
export async function fetchLiveOdds(leagueId) {
  const startTime = Date.now();
  const config = LEAGUE_CONFIG[leagueId];
  
  if (!config) {
    return {
      oddsMap: null,
      metadata: {
        source: 'none',
        error: 'Unsupported league',
        fetchTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    // Check if API key is properly configured
    if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY' || ODDS_API_KEY.includes('your_api_key_here')) {
      console.warn('Odds API key not configured properly. Please set REACT_APP_ODDS_API_KEY in your .env file. Using fallback odds.');
      return {
        oddsMap: null,
        metadata: {
          source: 'none',
          error: 'API key not configured',
          fetchTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }

    // For NBA, try multiple possible endpoints since championship futures may not be available
    let response = null;
    let data = null;
    
    if (config.league === 'nba') {
      const possibleEndpoints = [
        'basketball_nba_championship_winner',
        'basketball_nba_championship',
        'basketball_nba_futures',
        'basketball_nba'
      ];
      
      let success = false;
      for (const endpoint of possibleEndpoints) {
        try {
          // First try with markets=outrights parameter
          let oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&markets=outrights&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
          response = await fetch(oddsUrl);
          
          // If that fails, try without markets parameter
          if (!response.ok || response.status === 404) {
            oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
            response = await fetch(oddsUrl);
          }
          
          if (response.ok) {
            data = await response.json();
            // Check if response indicates an error
            if (data && !data.error_code && Array.isArray(data)) {
              success = true;
              break; // Success, stop trying other endpoints
            } else if (data && data.error_code) {
              // API returned an error, try next endpoint
              continue;
            }
          } else if (response.status === 404) {
            // Sport not found, try next endpoint
            continue;
          }
        } catch (error) {
          // Try next endpoint
          continue;
        }
      }
      
      // If all endpoints failed, return error
      if (!success) {
        return {
          oddsMap: null,
          metadata: {
            source: 'none',
            error: '404 - Unknown sport (NBA championship futures may not be available)',
            fetchTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }
    } else {
      // For other leagues, use the configured endpoint
      response = await fetch(
        `${ODDS_API_BASE}/sports/${config.oddsEndpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`
      );
      data = await response.json();
    }
    
    // Check for specific API errors (like quota exceeded)
    if (!response.ok || (data && data.error_code)) {
      if (data && data.error_code === 'OUT_OF_USAGE_CREDITS') {
        console.warn('🚫 Odds API quota exceeded. Using fallback data.');
        return {
          oddsMap: null,
          metadata: {
            source: 'fallback',
            error: 'API quota exceeded - please upgrade your plan at https://the-odds-api.com',
            fetchTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            quotaExceeded: true
          }
        };
      }
      throw new Error(`Odds API error: ${response.status} - ${data?.message || 'Unknown error'}`);
    }
    
    // Transform API data to our format
    const oddsMap = {};
    let totalOutcomes = 0;
    let bookmakerName = '';
    
    if (data && data.length > 0) {
      data.forEach(game => {
        if (game.bookmakers && game.bookmakers.length > 0) {
          // Use the first bookmaker's odds
          const bookmaker = game.bookmakers[0];
          bookmakerName = bookmaker.title || bookmaker.key || 'Unknown';
          
          if (bookmaker.markets && bookmaker.markets.length > 0) {
            const market = bookmaker.markets[0];
            if (market.outcomes) {
              market.outcomes.forEach(outcome => {
                const teamName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '');
                const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                oddsMap[teamName] = odds;
                totalOutcomes++;
              });
            }
          }
        }
      });
    }

    return {
      oddsMap,
      metadata: {
        source: 'The Odds API',
        bookmaker: bookmakerName,
        teamsWithOdds: totalOutcomes,
        fetchTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        apiEndpoint: config.oddsEndpoint
      }
    };
  } catch (error) {
    console.error('Failed to fetch live odds:', error);
    
    // For NBA, if it's a 404 or "Unknown sport" error, it's expected
    const isNba404 = config.league === 'nba' && (
      error.message.includes('404') || 
      error.message.includes('Unknown sport') ||
      error.message.includes('Unknown error')
    );
    
    return {
      oddsMap: null,
      metadata: {
        source: 'The Odds API',
        error: isNba404 
          ? 'NBA championship futures may not be available from The Odds API'
          : error.message,
        fetchTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
  }
}

function getOddsForTeam(teamName, liveOddsMap = null) {
  // Normalize team name for lookup
  const normalizedName = teamName.toLowerCase().replace(/[^a-z\s]/g, '');
  
  // Check live odds first if available
  if (liveOddsMap && liveOddsMap[normalizedName]) {
    return liveOddsMap[normalizedName];
  }
  
  // Return default odds for teams not in any map
  return '+5000';
}

// Fetch MLB standings from the MLB Stats API
async function fetchMLBStandings(liveOddsMap, oddsMetadata, totalFetchTime) {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];
  
  // Try multiple strategies to get standings data
  const strategies = [
    { year: currentYear, date: today, name: `${currentYear} season with current date` },
    { year: currentYear, date: null, name: `${currentYear} season (latest available)` },
    { year: currentYear - 1, date: today, name: `${currentYear - 1} season with current date` },
    { year: currentYear - 1, date: null, name: `${currentYear - 1} season (latest available)` }
  ];
  
  let standingsMetadata = {};
  
  for (const strategy of strategies) {
    try {
      const standingsStartTime = Date.now();
      let url = `${MLB_API_BASE}/standings?leagueId=103,104&season=${strategy.year}`;
      if (strategy.date) {
        url += `&date=${strategy.date}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      
      const data = await response.json();
      if (data.records && data.records.length > 0) {
        const teams = await transformStandingsData(data.records, liveOddsMap);
        
        // Count teams by division/league
        const leagues = {};
        const divisions = {};
        teams.forEach(team => {
          if (team.league) {
            leagues[team.league] = (leagues[team.league] || 0) + 1;
          }
          if (team.division) {
            divisions[team.division] = (divisions[team.division] || 0) + 1;
          }
        });
        
        standingsMetadata = {
          source: 'MLB Stats API',
          strategy: strategy.name,
          endpoint: url.replace(MLB_API_BASE, ''),
          totalTeams: teams.length,
          leagues: Object.keys(leagues).length,
          divisions: Object.keys(divisions).length,
          fetchTime: Date.now() - standingsStartTime,
          timestamp: new Date().toISOString()
        };
        
        return {
          teams,
          seasonYear: strategy.year,
          asOf: new Date().toISOString(),
          oddsSource: liveOddsMap ? 'live' : 'static',
          achievementLevels: LEAGUE_CONFIG['mlb-2025'].achievementLevels,
          metadata: {
            standings: standingsMetadata,
            odds: oddsMetadata,
            totalFetchTime: Date.now() - totalFetchTime,
            dataRetrievedAt: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch MLB data for ${strategy.year}:`, error);
      continue;
    }
  }
  
  // If all strategies fail, return null to trigger fallback
  return null;
}

// Fetch NFL standings from the NFL API
async function fetchNFLStandings(liveOddsMap, oddsMetadata, totalFetchTime) {
  const currentYear = new Date().getFullYear();
  
  // Check if API key is available
  if (!NFL_API_KEY) {
    console.warn('NFL API key not found in environment variables');
    return null;
  }
  
  try {
    const standingsStartTime = Date.now();
    
    // First, get the team listing to get all team IDs
    const teamsUrl = `${NFL_API_BASE}/nfl-team-listing/v1/data`;
    const teamsResponse = await fetch(teamsUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        'x-rapidapi-key': NFL_API_KEY
      }
    });
    
    if (!teamsResponse.ok) {
      console.warn('NFL teams API response not ok:', teamsResponse.status, teamsResponse.statusText);
      return null;
    }
    
    const teamsData = await teamsResponse.json();
    console.log('NFL teams API response:', teamsData);
    
    if (!teamsData || !Array.isArray(teamsData)) {
      console.warn('Invalid teams data structure');
      return null;
    }
    
    // Now fetch records for each team
    const teamsWithRecords = [];
    const year = currentYear; // Use current year (2025) for current standings
    
    for (const teamItem of teamsData) {
      try {
        const teamData = teamItem.team;
        if (!teamData || !teamData.id) continue;
        
        // Fetch team record for the specified year
        const recordUrl = `${NFL_API_BASE}/nfl-team-record?id=${teamData.id}&year=${year}`;
        const recordResponse = await fetch(recordUrl, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
            'x-rapidapi-key': NFL_API_KEY
          }
        });
        
        if (recordResponse.ok) {
          const recordData = await recordResponse.json();
          console.log(`Team ${teamData.displayName} record:`, recordData);
          
          teamsWithRecords.push({
            team: teamData,
            record: recordData
          });
        } else {
          console.warn(`Failed to get record for team ${teamData.displayName}:`, recordResponse.status);
          // Still include team without record data
          teamsWithRecords.push({
            team: teamData,
            record: null
          });
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Error fetching record for team:`, error);
      }
    }
    
    const teams = await transformNFLStandingsData(teamsWithRecords, liveOddsMap, year);
    
    // Count teams by conference/division
    const conferences = {};
    const divisions = {};
    teams.forEach(team => {
      if (team.league) {
        conferences[team.league] = (conferences[team.league] || 0) + 1;
      }
      if (team.division) {
        divisions[team.division] = (divisions[team.division] || 0) + 1;
      }
    });
    
    const standingsMetadata = {
      source: 'NFL API (RapidAPI)',
      endpoints: ['/nfl-team-listing/v1/data', `/nfl-team-record?id=X&year=${year}`],
      totalTeams: teams.length,
      conferences: Object.keys(conferences).length,
      divisions: Object.keys(divisions).length,
      fetchTime: Date.now() - standingsStartTime,
      timestamp: new Date().toISOString(),
      year: year
    };
    
    return {
      teams,
      seasonYear: year,
      asOf: new Date().toISOString(),
      oddsSource: liveOddsMap ? 'live' : 'static',
      achievementLevels: LEAGUE_CONFIG['nfl-2025'].achievementLevels,
      metadata: {
        standings: standingsMetadata,
        odds: oddsMetadata,
        totalFetchTime: Date.now() - totalFetchTime,
        dataRetrievedAt: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('Failed to fetch NFL standings:', error);
  }
  
  // If API fails, return null to trigger fallback
  return null;
}

// Transform NBA standings data to our format
async function transformNBAStandingsData(apiData, liveOddsMap = null, seasonYear = null) {
  const teams = [];
  
  if (!apiData || !apiData.resultSets || apiData.resultSets.length === 0) {
    return teams;
  }
  
  // NBA API returns standings in resultSets[0]
  const standingsData = apiData.resultSets[0];
  const headers = standingsData.headers || [];
  const rowSet = standingsData.rowSet || [];
  
  // Find column indices (NBA API uses mixed case headers)
  const teamNameIndex = headers.indexOf('TeamName');
  const teamCityIndex = headers.indexOf('TeamCity');
  const winsIndex = headers.indexOf('WINS');
  const lossesIndex = headers.indexOf('LOSSES');
  const conferenceIndex = headers.indexOf('Conference');
  const divisionIndex = headers.indexOf('Division');
  const gamesBackIndex = headers.indexOf('GB');
  const conferenceRankIndex = headers.indexOf('CONF_RANK');
  const divisionRankIndex = headers.indexOf('DIV_RANK');
  
  // Team name mapping from NBA API to our format
  const teamNameMap = {
    'Atlanta Hawks': 'Atlanta Hawks',
    'Boston Celtics': 'Boston Celtics',
    'Brooklyn Nets': 'Brooklyn Nets',
    'Charlotte Hornets': 'Charlotte Hornets',
    'Chicago Bulls': 'Chicago Bulls',
    'Cleveland Cavaliers': 'Cleveland Cavaliers',
    'Dallas Mavericks': 'Dallas Mavericks',
    'Denver Nuggets': 'Denver Nuggets',
    'Detroit Pistons': 'Detroit Pistons',
    'Golden State Warriors': 'Golden State Warriors',
    'Houston Rockets': 'Houston Rockets',
    'Indiana Pacers': 'Indiana Pacers',
    'LA Clippers': 'LA Clippers',
    'Los Angeles Lakers': 'Los Angeles Lakers',
    'Memphis Grizzlies': 'Memphis Grizzlies',
    'Miami Heat': 'Miami Heat',
    'Milwaukee Bucks': 'Milwaukee Bucks',
    'Minnesota Timberwolves': 'Minnesota Timberwolves',
    'New Orleans Pelicans': 'New Orleans Pelicans',
    'New York Knicks': 'New York Knicks',
    'Oklahoma City Thunder': 'Oklahoma City Thunder',
    'Orlando Magic': 'Orlando Magic',
    'Philadelphia 76ers': 'Philadelphia 76ers',
    'Phoenix Suns': 'Phoenix Suns',
    'Portland Trail Blazers': 'Portland Trail Blazers',
    'Sacramento Kings': 'Sacramento Kings',
    'San Antonio Spurs': 'San Antonio Spurs',
    'Toronto Raptors': 'Toronto Raptors',
    'Utah Jazz': 'Utah Jazz',
    'Washington Wizards': 'Washington Wizards'
  };
  
  rowSet.forEach((row, index) => {
    const teamCity = teamCityIndex >= 0 ? (row[teamCityIndex] || '') : '';
    const teamName = teamNameIndex >= 0 ? (row[teamNameIndex] || '') : '';
    const fullTeamName = teamCity && teamName ? `${teamCity} ${teamName}` : teamName;
    const wins = winsIndex >= 0 ? (row[winsIndex] || 0) : 0;
    const losses = lossesIndex >= 0 ? (row[lossesIndex] || 0) : 0;
    const conference = conferenceIndex >= 0 ? (row[conferenceIndex] || '') : '';
    const division = divisionIndex >= 0 ? (row[divisionIndex] || '') : '';
    const gamesBack = gamesBackIndex >= 0 && row[gamesBackIndex] !== undefined && row[gamesBackIndex] !== null ? row[gamesBackIndex] : '—';
    const conferenceRank = conferenceRankIndex >= 0 ? (row[conferenceRankIndex] || null) : null;
    const divisionRank = divisionRankIndex >= 0 ? (row[divisionRankIndex] || null) : null;
    
    // Normalize team name
    const normalizedTeamName = teamNameMap[fullTeamName] || fullTeamName;
    
    // Get odds for team
    const odds = getOddsForTeam(normalizedTeamName, liveOddsMap);
    
    // Format record
    const record = `${wins}-${losses}`;
    
    // Format division name (e.g., "Atlantic" -> "Atlantic")
    const divisionName = division || conference;
    
    teams.push({
      name: normalizedTeamName,
      record: record,
      wins: wins,
      losses: losses,
      league: conference || 'NBA',
      division: divisionName,
      gamesBack: gamesBack,
      wildCardGamesBack: null, // Not applicable for NBA
      owner: null, // Will be populated from database
      odds: odds,
      conferenceRank: conferenceRank,
      divisionRank: divisionRank
    });
  });
  
  return teams;
}

// Fetch NBA standings from NBA.com Stats API
async function fetchNBAStandings(liveOddsMap, oddsMetadata, totalFetchTime, leagueId = 'nba-2025') {
  const currentYear = new Date().getFullYear();
  // Determine season based on leagueId or current date
  let seasonYear = currentYear;
  if (leagueId === 'nba-2024') {
    seasonYear = 2024;
  } else if (leagueId === 'nba-2025') {
    seasonYear = 2025;
  }
  
  // NBA season format: "2025-26" for our 2025 season (starts in 2025, ends in 2026)
  // "2024-25" for our 2024 season (starts in 2024, ends in 2025)
  const seasonEnd = seasonYear + 1;
  const season = `${seasonYear}-${String(seasonEnd).slice(-2)}`;
  
  try {
    const standingsStartTime = Date.now();
    
    // NBA.com API endpoint for standings
    // Note: NBA.com API may have CORS restrictions, so we might need a proxy
    const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular%20Season`;
    
    try {
      const response = await fetch(standingsUrl, {
        method: 'GET',
        headers: {
          'Referer': 'https://www.nba.com/',
          'Origin': 'https://www.nba.com',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      
      if (!response.ok) {
        console.warn('NBA API response not ok:', response.status, response.statusText);
        // NBA.com API has CORS restrictions, so we'll use fallback
        return null;
      }
      
      const data = await response.json();
      
      if (!data || !data.resultSets) {
        console.warn('Invalid NBA standings data structure');
        return null;
      }
      
      const teams = await transformNBAStandingsData(data, liveOddsMap, seasonYear);
      
      // Get achievement levels from config
      const config = LEAGUE_CONFIG[leagueId] || LEAGUE_CONFIG['nba-2025'];
      
      // Count teams by conference/division
      const conferences = {};
      const divisions = {};
      teams.forEach(team => {
        if (team.league) {
          conferences[team.league] = (conferences[team.league] || 0) + 1;
        }
        if (team.division) {
          divisions[team.division] = (divisions[team.division] || 0) + 1;
        }
      });
      
      const standingsMetadata = {
        source: 'NBA.com Stats API',
        endpoint: `/leaguestandingsv3?LeagueID=00&Season=${season}&SeasonType=Regular%20Season`,
        totalTeams: teams.length,
        conferences: Object.keys(conferences).length,
        divisions: Object.keys(divisions).length,
        fetchTime: Date.now() - standingsStartTime,
        timestamp: new Date().toISOString(),
        season: season
      };
      
      return {
        teams,
        seasonYear: seasonYear,
        asOf: new Date().toISOString(),
        oddsSource: liveOddsMap ? 'live' : 'static',
        achievementLevels: config.achievementLevels,
        metadata: {
          standings: standingsMetadata,
          odds: oddsMetadata,
          totalFetchTime: Date.now() - totalFetchTime,
          dataRetrievedAt: new Date().toISOString()
        }
      };
      
    } catch (fetchError) {
      // CORS or network error - NBA.com API has CORS restrictions
      console.warn('NBA API fetch failed (likely CORS):', fetchError.message);
      console.warn('💡 Tip: Use a server-side script to update NBA data, or set up a Lambda proxy');
      return null;
    }
    
  } catch (error) {
    console.error('Failed to fetch NBA standings:', error);
    return null;
  }
}

// Fetch NCAA teams from CFBD API and Odds API using mapping table
async function fetchNCAATeams(liveOddsMap, oddsMetadata, totalFetchTime) {
  const currentYear = new Date().getFullYear();
  const CFBD_API_KEY = process.env.CFBD_API_KEY;
  
  try {
    const standingsStartTime = Date.now();
    
    // First, get the team mappings from GraphQL to ensure proper name matching
    let teamMappings = [];
    try {
      const mappingsResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              getTeamMappings(league: "ncaa", season: "2025") {
                id
                cfbdName
                cfbdId
                cfbdConference
                oddsApiName
                oddsApiOdds
              }
            }
          `
        })
      });
      
      if (mappingsResponse.ok) {
        const mappingsData = await mappingsResponse.json();
        teamMappings = mappingsData.data?.getTeamMappings || [];
        console.log(`📊 Fetched ${teamMappings.length} team mappings from GraphQL`);
      } else {
        console.warn('⚠️ Failed to fetch team mappings from GraphQL');
      }
    } catch (error) {
      console.error('❌ Error fetching team mappings:', error);
    }
    
    // Create lookup maps for efficient matching
    const cfbdNameToMapping = {};
    const oddsApiNameToMapping = {};
    teamMappings.forEach(mapping => {
      if (mapping.cfbdName) {
        cfbdNameToMapping[mapping.cfbdName] = mapping;
      }
      if (mapping.oddsApiName) {
        oddsApiNameToMapping[mapping.oddsApiName] = mapping;
      }
    });
    
    // Fetch teams from CFBD API (FBS only)
    let cfbdTeams = [];
    if (CFBD_API_KEY) {
      try {
        const response = await fetch('https://api.collegefootballdata.com/teams/fbs', {
          headers: {
            'Authorization': `Bearer ${CFBD_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          cfbdTeams = await response.json();
          console.log(`📊 Fetched ${cfbdTeams.length} teams from CFBD API`);
        } else {
          console.warn('⚠️ CFBD API request failed:', response.status);
        }
      } catch (error) {
        console.error('❌ Error fetching CFBD teams:', error);
      }
    } else {
      console.warn('⚠️ CFBD_API_KEY not found, using fallback data');
    }
    
    // Fetch current season records from CFBD API
    let teamRecords = {};
    if (CFBD_API_KEY) {
      try {
        const recordsResponse = await fetch(`https://api.collegefootballdata.com/records?year=${currentYear}`, {
          headers: {
            'Authorization': `Bearer ${CFBD_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (recordsResponse.ok) {
          const records = await recordsResponse.json();
          records.forEach(record => {
            if (record.team && record.total) {
              teamRecords[record.team] = {
                wins: record.total.wins || 0,
                losses: record.total.losses || 0,
                record: `${record.total.wins || 0}-${record.total.losses || 0}`
              };
            }
          });
          console.log(`📊 Fetched records for ${Object.keys(teamRecords).length} teams from CFBD API`);
        } else {
          console.warn('⚠️ CFBD records API request failed:', recordsResponse.status);
        }
      } catch (error) {
        console.error('❌ Error fetching CFBD records:', error);
      }
    }
    
    // Combine data using mapping table for proper name matching
    const teams = [];
    
    // Process each team mapping to ensure we get the right data
    teamMappings.forEach(mapping => {
      const cfbdName = mapping.cfbdName;
      const oddsApiName = mapping.oddsApiName;
      
      // Find CFBD team data
      let cfbdTeam = null;
      if (cfbdName && cfbdTeams.length > 0) {
        cfbdTeam = cfbdTeams.find(team => 
          team.school === cfbdName || 
          team.name === cfbdName ||
          team.school?.toLowerCase() === cfbdName.toLowerCase() ||
          team.name?.toLowerCase() === cfbdName.toLowerCase()
        );
      }
      
      // Get record from CFBD API
      const record = teamRecords[cfbdName] || { wins: 0, losses: 0, record: '0-0' };
      
      // Get odds from live odds map using the correct odds API name
      let odds = null;
      if (liveOddsMap && oddsApiName) {
        // Try exact match first
        if (liveOddsMap[oddsApiName]) {
          odds = liveOddsMap[oddsApiName];
        } else {
          // Try partial matches
          const oddsTeamName = Object.keys(liveOddsMap).find(oddsName => 
            oddsName.toLowerCase().includes(oddsApiName.toLowerCase()) ||
            oddsApiName.toLowerCase().includes(oddsName.toLowerCase())
          );
          if (oddsTeamName) {
            odds = liveOddsMap[oddsTeamName];
          }
        }
      }
      
      // Use mapping odds as fallback
      if (!odds && mapping.oddsApiOdds) {
        odds = mapping.oddsApiOdds;
      }
      
      teams.push({
        id: `ncaa-${mapping.cfbdId || cfbdName?.toLowerCase().replace(/\s+/g, '-')}`,
        name: cfbdName || 'Unknown Team',
        record: record.record,
        league: 'NCAA',
        division: mapping.cfbdConference || cfbdTeam?.conference || 'FBS',
        wins: record.wins,
        losses: record.losses,
        gamesBack: '0',
        wildCardGamesBack: '0',
        owner: 'NA', // All NCAA teams assigned to NA for now
        odds: odds || '999999'
      });
    });
    
    // If no mappings available, fall back to CFBD teams
    if (teams.length === 0 && cfbdTeams.length > 0) {
      cfbdTeams.forEach(cfbdTeam => {
        const teamName = cfbdTeam.school || cfbdTeam.name;
        const record = teamRecords[teamName] || { wins: 0, losses: 0, record: '0-0' };
        
        // Find matching odds by team name
        let odds = null;
        if (liveOddsMap) {
          const oddsTeamName = Object.keys(liveOddsMap).find(oddsName => 
            oddsName.toLowerCase().includes(teamName.toLowerCase()) ||
            teamName.toLowerCase().includes(oddsName.toLowerCase())
          );
          if (oddsTeamName) {
            odds = liveOddsMap[oddsTeamName];
          }
        }
        
        teams.push({
          id: `ncaa-${cfbdTeam.id || teamName.toLowerCase().replace(/\s+/g, '-')}`,
          name: teamName,
          record: record.record,
          league: 'NCAA',
          division: cfbdTeam.conference || 'FBS',
          wins: record.wins,
          losses: record.losses,
          gamesBack: '0',
          wildCardGamesBack: '0',
          owner: 'NA',
          odds: odds || '999999'
        });
      });
    }
    
    // If still no teams, fall back to odds data
    if (teams.length === 0 && liveOddsMap) {
      Object.entries(liveOddsMap).forEach(([teamName, odds]) => {
        const cleanName = teamName
          .replace(/\b(University|College|State|Tech|Institute)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        teams.push({
          id: `ncaa-${cleanName.toLowerCase().replace(/\s+/g, '-')}`,
          name: cleanName,
          record: '0-0',
          league: 'NCAA',
          division: 'FBS',
          wins: 0,
          losses: 0,
          gamesBack: '0',
          wildCardGamesBack: '0',
          owner: 'NA',
          odds: odds
        });
      });
    }
    
    const standingsMetadata = {
      source: 'CFBD API + The Odds API',
      endpoint: 'https://api.collegefootballdata.com/teams',
      totalTeams: teams.length,
      conferences: 1,
      divisions: 1,
      fetchTime: Date.now() - standingsStartTime,
      timestamp: new Date().toISOString()
    };
    
    return {
      teams,
      seasonYear: currentYear,
      asOf: new Date().toISOString(),
      oddsSource: liveOddsMap ? 'live' : 'static',
      achievementLevels: LEAGUE_CONFIG['ncaa-2025'].achievementLevels,
      metadata: {
        standings: standingsMetadata,
        odds: oddsMetadata,
        totalFetchTime: Date.now() - totalFetchTime,
        dataRetrievedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Failed to fetch NCAA teams:', error);
  }
  
  // If API fails, return null to trigger fallback
  return null;
}

// Transform MLB API standings data
async function transformStandingsData(records, liveOddsMap = null) {
  const teams = [];
  
  for (const division of records) {
    for (const teamRecord of division.teamRecords) {
      const team = teamRecord.team;
      const teamId = team.id;
      
      // Get league and division info
      let league = '';
      let divisionName = '';
      
      try {
        if (teamRecord.league && teamRecord.league.name) {
          league = teamRecord.league.name;
        }
        if (division.division && division.division.name) {
          divisionName = division.division.name;
        }
        
        // If we don't have league/division info, fetch from teams endpoint
        if (!league || !divisionName) {
          const teamResponse = await fetch(`${MLB_API_BASE}/teams/${teamId}`);
          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            if (teamData.teams && teamData.teams[0]) {
              const teamInfo = teamData.teams[0];
              if (!league && teamInfo.league) {
                league = teamInfo.league.name;
              }
              if (!divisionName && teamInfo.division) {
                divisionName = teamInfo.division.name;
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch team details for ${team.name}:`, error);
      }
      
      teams.push({
        id: teamId,
        name: team.name,
        record: `${teamRecord.wins}-${teamRecord.losses}`,
        league: league,
        division: divisionName,
        wins: teamRecord.wins,
        losses: teamRecord.losses,
        gamesBack: teamRecord.gamesBack || '0',
        wildCardGamesBack: teamRecord.wildCardGamesBack || '0',
        owner: getOwnerForTeam(team.name, teamId),
        odds: getOddsForTeam(team.name, liveOddsMap)
      });
    }
  }
  
  return teams;
}

// Transform NFL API standings data
async function transformNFLStandingsData(data, liveOddsMap = null, year = null) {
  const teams = [];
  
  // NFL API returns an array of team objects with nested team data and records
  for (const item of data) {
    try {
      const teamData = item.team;
      const recordData = item.record;
      
      if (!teamData) continue;
      
      // Extract team information from the API response
      const teamName = teamData.displayName || teamData.name || 'Unknown Team';
      const teamId = teamData.id || `nfl-${teamName.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Extract record information from the record data
      let wins = 0;
      let losses = 0;
      let ties = 0;
      let record = '0-0';
      
      if (recordData && recordData.items && Array.isArray(recordData.items)) {
        // Find the overall record (first item with name "overall")
        const overallRecord = recordData.items.find(item => item.name === 'overall');
        if (overallRecord && overallRecord.summary) {
          // Parse the record string (e.g., "4-13" or "9-8-0")
          const recordParts = overallRecord.summary.split('-');
          if (recordParts.length >= 2) {
            wins = parseInt(recordParts[0]) || 0;
            losses = parseInt(recordParts[1]) || 0;
            ties = recordParts.length > 2 ? (parseInt(recordParts[2]) || 0) : 0;
            record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
          }
        }
      }
      
      // Try to determine conference/division from team name or use static mapping
      let league = 'Unknown';
      let division = 'Unknown';
      
      // Static mapping based on team names
      const teamMappings = {
        'Arizona Cardinals': { league: 'NFC', division: 'West' },
        'Atlanta Falcons': { league: 'NFC', division: 'South' },
        'Baltimore Ravens': { league: 'AFC', division: 'North' },
        'Buffalo Bills': { league: 'AFC', division: 'East' },
        'Carolina Panthers': { league: 'NFC', division: 'South' },
        'Chicago Bears': { league: 'NFC', division: 'North' },
        'Cincinnati Bengals': { league: 'AFC', division: 'North' },
        'Cleveland Browns': { league: 'AFC', division: 'North' },
        'Dallas Cowboys': { league: 'NFC', division: 'East' },
        'Denver Broncos': { league: 'AFC', division: 'West' },
        'Detroit Lions': { league: 'NFC', division: 'North' },
        'Green Bay Packers': { league: 'NFC', division: 'North' },
        'Houston Texans': { league: 'AFC', division: 'South' },
        'Indianapolis Colts': { league: 'AFC', division: 'South' },
        'Jacksonville Jaguars': { league: 'AFC', division: 'South' },
        'Kansas City Chiefs': { league: 'AFC', division: 'West' },
        'Las Vegas Raiders': { league: 'AFC', division: 'West' },
        'Los Angeles Chargers': { league: 'AFC', division: 'West' },
        'Los Angeles Rams': { league: 'NFC', division: 'West' },
        'Miami Dolphins': { league: 'AFC', division: 'East' },
        'Minnesota Vikings': { league: 'NFC', division: 'North' },
        'New England Patriots': { league: 'AFC', division: 'East' },
        'New Orleans Saints': { league: 'NFC', division: 'South' },
        'New York Giants': { league: 'NFC', division: 'East' },
        'New York Jets': { league: 'AFC', division: 'East' },
        'Philadelphia Eagles': { league: 'NFC', division: 'East' },
        'Pittsburgh Steelers': { league: 'AFC', division: 'North' },
        'San Francisco 49ers': { league: 'NFC', division: 'West' },
        'Seattle Seahawks': { league: 'NFC', division: 'West' },
        'Tampa Bay Buccaneers': { league: 'NFC', division: 'South' },
        'Tennessee Titans': { league: 'AFC', division: 'South' },
        'Washington Commanders': { league: 'NFC', division: 'East' }
      };
      
      const mapping = teamMappings[teamName];
      if (mapping) {
        league = mapping.league;
        division = mapping.division;
      }
      
      // Calculate games back (simplified for NFL - would need more complex logic for actual standings)
      const gamesBack = '0'; // Placeholder - would need division leader data
      const wildCardGamesBack = '0'; // Placeholder - would need wild card standings
      
      teams.push({
        id: teamId,
        name: teamName,
        record: record,
        league: league,
        division: division,
        wins: wins,
        losses: losses,
        gamesBack: gamesBack,
        wildCardGamesBack: wildCardGamesBack,
        owner: 'NA', // All NFL teams are assigned to NA for now
        odds: getOddsForTeam(teamName, liveOddsMap)
      });
    } catch (error) {
      console.warn(`Failed to process NFL team data:`, error);
    }
  }
  
  return teams;
}

export async function getCurrentStandings(leagueId) {
  const overallStartTime = Date.now();
  const config = LEAGUE_CONFIG[leagueId];
  
  if (!config) {
    return await getFallbackData(leagueId, null, {}, Date.now() - overallStartTime);
  }

  // Fetch live odds first
  const oddsResult = await fetchLiveOdds(leagueId);
  const liveOddsMap = oddsResult?.oddsMap || null;
  const oddsMetadata = oddsResult?.metadata || {};

  // For MLB, try to fetch live data from MLB API
  if (leagueId === 'mlb-2025') {
    try {
      const mlbData = await fetchMLBStandings(liveOddsMap, oddsMetadata, Date.now() - overallStartTime);
      if (mlbData) {
        return mlbData;
      }
    } catch (error) {
      console.error('Failed to fetch MLB standings, using fallback:', error);
    }
  }
  
  // For NFL, try to fetch live data from NFL API
  if (leagueId === 'nfl-2025') {
    try {
      const nflData = await fetchNFLStandings(liveOddsMap, oddsMetadata, Date.now() - overallStartTime);
      if (nflData) {
        return nflData;
      }
    } catch (error) {
      console.error('Failed to fetch NFL standings, using fallback:', error);
    }
  }
  
  // For NBA, try to fetch live data from NBA API
  if (leagueId === 'nba-2024' || leagueId === 'nba-2025') {
    try {
      const nbaData = await fetchNBAStandings(liveOddsMap, oddsMetadata, Date.now() - overallStartTime, leagueId);
      if (nbaData) {
        return nbaData;
      }
    } catch (error) {
      console.error('Failed to fetch NBA standings, using fallback:', error);
    }
  }
  
  // For NCAA, try to fetch teams from Odds API
  if (leagueId === 'ncaa-2025') {
    try {
      const ncaaData = await fetchNCAATeams(liveOddsMap, oddsMetadata, Date.now() - overallStartTime);
      if (ncaaData) {
        return ncaaData;
      }
    } catch (error) {
      console.error('Failed to fetch NCAA teams, using fallback:', error);
    }
  }
  
  // For NBA or if MLB API fails, use fallback data
  return await getFallbackData(leagueId, liveOddsMap, oddsMetadata, Date.now() - overallStartTime);
}

export async function getFallbackData(leagueId, liveOddsMap = null, oddsMetadata = {}, totalFetchTime = 0) {
  const config = LEAGUE_CONFIG[leagueId];
  
  if (!config) {
    return {
      teams: [],
      seasonYear: new Date().getFullYear(),
      asOf: new Date().toISOString(),
      oddsSource: 'static',
      metadata: {
        standings: {
          source: 'No data available',
          strategy: 'Unsupported league',
          endpoint: 'N/A',
          totalTeams: 0,
          leagues: 0,
          divisions: 0,
          fetchTime: 0,
          timestamp: new Date().toISOString()
        },
        odds: oddsMetadata,
        totalFetchTime,
        dataRetrievedAt: new Date().toISOString()
      }
    };
  }

  // Fetch teams from GraphQL
  const teams = await fetchTeamsFromGraphQL(config.league, config.season);

  // Add odds to fallback data
  const teamsWithOdds = teams.map(team => ({
    ...team,
    odds: getOddsForTeam(team.name, liveOddsMap)
  }));
  
  // Count teams by division/league for fallback data
  const leagues = {};
  const divisions = {};
  teamsWithOdds.forEach(team => {
    if (team.league) {
      leagues[team.league] = (leagues[team.league] || 0) + 1;
    }
    if (team.division) {
      divisions[team.division] = (divisions[team.division] || 0) + 1;
    }
  });
  
  return {
    teams: teamsWithOdds,
    seasonYear: leagueId.includes('2024') ? 2024 : 2025,
    asOf: new Date().toISOString(),
    oddsSource: liveOddsMap ? 'live' : 'static',
    achievementLevels: config.achievementLevels,
    metadata: {
      standings: {
        source: 'Static fallback data',
        strategy: `${config.name} hardcoded team data`,
        endpoint: 'N/A',
        totalTeams: teamsWithOdds.length,
        leagues: Object.keys(leagues).length,
        divisions: Object.keys(divisions).length,
        fetchTime: 0,
        timestamp: new Date().toISOString()
      },
      odds: oddsMetadata,
      totalFetchTime,
      dataRetrievedAt: new Date().toISOString()
    }
  };
}

// Get league configuration
export function getLeagueConfig(leagueId) {
  return LEAGUE_CONFIG[leagueId] || null;
}

// Get all available leagues
export function getAvailableLeagues() {
  return Object.keys(LEAGUE_CONFIG).map(id => ({
    id,
    name: LEAGUE_CONFIG[id].name
  }));
}

// New hybrid function: Fetch API data and save to GraphQL
export async function fetchAndSaveApiData(leagueId, teams) {
  console.log('🔄 Fetching API data and saving to GraphQL...', { leagueId, teamsCount: teams.length });
  
  // Check if this is an NBA league
  const isNBA = leagueId === 'nba-2024' || leagueId === 'nba-2025';
  
  try {
    // For NBA leagues, handle separately due to CORS restrictions
    if (isNBA) {
      return await fetchAndSaveNbaData(leagueId, teams);
    }
    
    // Get fresh API data using existing function
    const apiData = await getCurrentStandings(leagueId);
    
    if (!apiData || !apiData.teams) {
      console.warn('⚠️ No API data received, skipping GraphQL update');
      return { success: false, error: 'No API data received' };
    }

    // Get team mappings for proper name matching
    let teamMappings = [];
    try {
      const mappingsResponse = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query {
              getTeamMappings(league: "ncaa", season: "2025") {
                id
                cfbdName
                oddsApiName
              }
            }
          `
        })
      });
      
      if (mappingsResponse.ok) {
        const mappingsData = await mappingsResponse.json();
        teamMappings = mappingsData.data?.getTeamMappings || [];
        console.log(`📊 Fetched ${teamMappings.length} team mappings for API matching`);
      }
    } catch (error) {
      console.error('❌ Error fetching team mappings for API matching:', error);
    }
    
    // Create lookup maps for efficient matching
    const cfbdNameToMapping = {};
    const oddsApiNameToMapping = {};
    teamMappings.forEach(mapping => {
      if (mapping.cfbdName) {
        cfbdNameToMapping[mapping.cfbdName] = mapping;
      }
      if (mapping.oddsApiName) {
        oddsApiNameToMapping[mapping.oddsApiName] = mapping;
      }
    });
    
    // Update each team in GraphQL with fresh API data
    const updatePromises = teams.map(async (team) => {
      // Find matching team from API data using mapping table
      let apiTeam = null;
      
      // First try to find by exact name match
      apiTeam = apiData.teams.find(t => 
        t.name === team.name || 
        t.id === team.id ||
        t.name.toLowerCase() === team.name.toLowerCase()
      );
      
      // If not found, try using mapping table
      if (!apiTeam) {
        // Find mapping for this team
        const mapping = teamMappings.find(m => m.cfbdName === team.name);
        if (mapping) {
          // Try to find API team by CFBD name or Odds API name
          apiTeam = apiData.teams.find(t => 
            t.name === mapping.cfbdName ||
            t.name === mapping.oddsApiName ||
            t.name.toLowerCase() === mapping.cfbdName?.toLowerCase() ||
            t.name.toLowerCase() === mapping.oddsApiName?.toLowerCase()
          );
        }
      }
      
      // If still not found, try partial matching
      if (!apiTeam) {
        apiTeam = apiData.teams.find(t => 
          t.name.toLowerCase().includes(team.name.toLowerCase()) ||
          team.name.toLowerCase().includes(t.name.toLowerCase())
        );
      }

      if (apiTeam) {
        // Extract API-specific data
        const apiUpdateData = {
          record: apiTeam.record,
          wins: apiTeam.wins,
          losses: apiTeam.losses,
          gamesBack: apiTeam.gamesBack,
          wildCardGamesBack: apiTeam.wildCardGamesBack,
          odds: apiTeam.odds
        };

        console.log(`📡 Updating ${team.name} with API data:`, apiUpdateData);
        
        try {
          await updateTeamApiData(team.id, apiUpdateData);
          return { teamId: team.id, success: true };
        } catch (error) {
          console.error(`❌ Failed to update ${team.name}:`, error);
          return { teamId: team.id, success: false, error: error.message };
        }
      } else {
        console.warn(`⚠️ No API data found for team: ${team.name}`);
        return { teamId: team.id, success: false, error: 'No matching API data' };
      }
    });

    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ API data sync complete: ${successCount}/${teams.length} teams updated`);
    
    return {
      success: true,
      results,
      successCount,
      totalCount: teams.length,
      metadata: apiData.metadata
    };

  } catch (error) {
    console.error('❌ Error in fetchAndSaveApiData:', error);
    return { success: false, error: error.message };
  }
}

// Special function for NBA leagues that handles CORS and updates odds
async function fetchAndSaveNbaData(leagueId, teams) {
  console.log('🏀 Fetching NBA data (via server-side GraphQL mutation)...');
  
  const league = leagueId.split('-')[0];
  const season = leagueId.split('-')[1];
  
  try {
    // Check if we're using direct DynamoDB (no GraphQL server)
    const { USE_DIRECT_DYNAMODB } = await import('../config/dataSource.js');
    
    // Always use GraphQL endpoint from environment variable (works for both local and S3 deployment)
    // For S3 deployment, this should be set to your Lambda/API Gateway endpoint
    const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
    
    if (USE_DIRECT_DYNAMODB) {
      // If using direct DynamoDB, call GraphQL endpoint directly via fetch
      // This works for both local development and S3 deployment
      console.log(`📡 Calling GraphQL mutation at ${GRAPHQL_ENDPOINT}...`);
      
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation UpdateNbaTeamsFromApi($league: String!, $season: String!) {
              updateNbaTeamsFromApi(league: $league, season: $season) {
                success
                teamsUpdated
                oddsUpdated
                recordsUpdated
                totalTeams
                error
                message
              }
            }
          `,
          variables: {
            league,
            season
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`GraphQL endpoint returned ${response.status}: ${response.statusText}. Make sure REACT_APP_GRAPHQL_ENDPOINT is set correctly.`);
      }
      
      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      
      if (!result.data || !result.data.updateNbaTeamsFromApi) {
        throw new Error('Invalid response from GraphQL endpoint');
      }
      
      const updateResult = result.data.updateNbaTeamsFromApi;
      
      if (updateResult.success) {
        console.log(`✅ NBA update complete: ${updateResult.message}`);
        console.log(`   - Records updated: ${updateResult.recordsUpdated}`);
        console.log(`   - Odds updated: ${updateResult.oddsUpdated}`);
        
        return {
          success: true,
          successCount: updateResult.teamsUpdated,
          totalCount: updateResult.totalTeams,
          metadata: {
            odds: {
              source: 'The Odds API (via server)',
              teamsWithOdds: updateResult.oddsUpdated,
              timestamp: new Date().toISOString()
            },
            standings: {
              source: 'NBA.com Stats API (via server)',
              totalTeams: updateResult.recordsUpdated,
              timestamp: new Date().toISOString()
            },
            oddsUpdated: updateResult.oddsUpdated,
            recordsUpdated: updateResult.recordsUpdated,
            message: updateResult.message
          }
        };
      } else {
        throw new Error(updateResult.error || 'Failed to update NBA teams');
      }
    } else {
      // Use Apollo Client mutation
      const { UPDATE_NBA_TEAMS_FROM_API } = await import('../graphql/client.js');
      const { client } = await import('../graphql/client.js');
      
      console.log(`📡 Calling updateNbaTeamsFromApi mutation for ${league} ${season}...`);
      
      const { data } = await client.mutate({
        mutation: UPDATE_NBA_TEAMS_FROM_API,
        variables: {
          league,
          season
        }
      });
      
      const result = data.updateNbaTeamsFromApi;
      
      if (result.success) {
        console.log(`✅ NBA update complete: ${result.message}`);
        console.log(`   - Records updated: ${result.recordsUpdated}`);
        console.log(`   - Odds updated: ${result.oddsUpdated}`);
        
        return {
          success: true,
          successCount: result.teamsUpdated,
          totalCount: result.totalTeams,
          metadata: {
            odds: {
              source: 'The Odds API (via server)',
              teamsWithOdds: result.oddsUpdated,
              timestamp: new Date().toISOString()
            },
            standings: {
              source: 'NBA.com Stats API (via server)',
              totalTeams: result.recordsUpdated,
              timestamp: new Date().toISOString()
            },
            oddsUpdated: result.oddsUpdated,
            recordsUpdated: result.recordsUpdated,
            message: result.message
          }
        };
      } else {
        throw new Error(result.error || 'Failed to update NBA teams');
      }
    }
    
  } catch (error) {
    console.error('❌ Error in fetchAndSaveNbaData:', error);
    
    // Fallback: try to update odds from browser (will work even if standings fail)
    // Note: NBA championship odds may not be available from Odds API
    try {
      console.log('📊 Fallback: Attempting to update odds from browser...');
      const oddsResult = await fetchLiveOdds(leagueId);
      const liveOddsMap = oddsResult?.oddsMap || {};
      const oddsMetadata = oddsResult?.metadata || {};
      
      let oddsUpdatedCount = 0;
      
      // Only try to update odds if we got some from the API
      if (oddsMetadata && !oddsMetadata.error && liveOddsMap && Object.keys(liveOddsMap).length > 0) {
        for (const team of teams) {
          try {
            const normalizedName = team.name.toLowerCase().replace(/[^a-z\s]/g, '');
            const odds = liveOddsMap[normalizedName] || null;
            
            if (odds) {
              await updateTeamApiData(team.id, { odds });
              oddsUpdatedCount++;
            }
          } catch (updateError) {
            console.error(`❌ Failed to update odds for ${team.name}:`, updateError);
          }
        }
      }
      
      // Return success even if odds couldn't be fetched (NBA championship odds may not be available)
      return {
        success: true,
        successCount: oddsUpdatedCount,
        totalCount: teams.length,
        metadata: {
          odds: oddsMetadata || {
            error: 'Odds API does not support NBA championship futures',
            note: 'NBA championship odds may not be available from The Odds API. Team records will still be updated.'
          },
          standings: {
            error: error.message,
            note: 'NBA standings update failed. Make sure GraphQL server is running and try again.'
          },
          oddsUpdated: oddsUpdatedCount,
          recordsUpdated: 0
        }
      };
    } catch (fallbackError) {
      // If fallback also fails, return error but don't show Odds API errors to user
      const errorMessage = fallbackError.message || error.message;
      const isOddsApiError = errorMessage.includes('Odds API') || errorMessage.includes('Unknown sport');
      
      if (isOddsApiError) {
        // Odds API error is expected - NBA championship futures may not be available
        console.warn('⚠️ Odds API error (expected for NBA championship futures):', fallbackError.message);
        return {
          success: true,
          successCount: 0,
          totalCount: teams.length,
          metadata: {
            odds: {
              error: 'Odds API does not support NBA championship futures',
              note: 'NBA championship odds may not be available from The Odds API.'
            },
            standings: {
              error: error.message,
              note: 'NBA standings update failed. Make sure REACT_APP_GRAPHQL_ENDPOINT is set to your Lambda/API Gateway endpoint.'
            },
            oddsUpdated: 0,
            recordsUpdated: 0
          }
        };
      }
      
      console.error('❌ Fallback also failed:', fallbackError);
      return { success: false, error: error.message };
    }
  }
}
