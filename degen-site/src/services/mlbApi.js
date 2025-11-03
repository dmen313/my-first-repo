// MLB teams will be fetched from GraphQL instead of static data

const MLB_API_BASE = 'https://statsapi.mlb.com/api/v1';
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || 'YOUR_API_KEY';

// MLB World Series odds (as of December 2024)
const teamOddsMap = {
  'los angeles dodgers': '+310',
  'philadelphia phillies': '+600',
  'milwaukee brewers': '+850',
  'detroit tigers': '+1000',
  'seattle mariners': '+1000',
  'toronto blue jays': '+1100',
  'new york yankees': '+1200',
  'san diego padres': '+1200',
  'houston astros': '+1400',
  'chicago cubs': '+1600',
  'atlanta braves': '+1800',
  'new york mets': '+2000',
  'baltimore orioles': '+2200',
  'cleveland guardians': '+2500',
  'boston red sox': '+3000',
  'kansas city royals': '+3500',
  'arizona diamondbacks': '+4000',
  'minnesota twins': '+4500',
  'st louis cardinals': '+5000',
  'tampa bay rays': '+5500',
  'texas rangers': '+6000',
  'san francisco giants': '+6500',
  'cincinnati reds': '+7000',
  'washington nationals': '+8000',
  'miami marlins': '+8500',
  'pittsburgh pirates': '+9000',
  'los angeles angels': '+10000',
  'oakland athletics': '+12000',
  'chicago white sox': '+15000',
  'colorado rockies': '+20000'
};

// Team name to owner mapping
const teamOwnerMap = {
  'los angeles dodgers': 'Hurls',
  'texas rangers': 'Hurls',
  'baltimore orioles': 'Hurls',
  'toronto blue jays': 'Hurls',
  'detroit tigers': 'Hurls',
  'los angeles angels': 'Hurls',
  'pittsburgh pirates': 'Hurls',
  'new york yankees': 'Dev',
  'san diego padres': 'Dev',
  'seattle mariners': 'Dev',
  'cleveland guardians': 'Dev',
  'minnesota twins': 'Dev',
  'oakland athletics': 'Dev',
  'oakland as': 'Dev',
  'st louis cardinals': 'Dev',
  'atlanta braves': 'TG',
  'houston astros': 'TG',
  'chicago cubs': 'TG',
  'kansas city royals': 'TG',
  'tampa bay rays': 'TG',
  'miami marlins': 'TG',
  'milwaukee brewers': 'TG',
  'philadelphia phillies': 'Mike',
  'new york mets': 'Mike',
  'boston red sox': 'Mike',
  'arizona diamondbacks': 'Mike',
  'cincinnati reds': 'Mike',
  'san francisco giants': 'Mike',
  'washington nationals': 'Mike',
  'chicago white sox': 'No Owner',
  'colorado rockies': 'No Owner'
};

function getOwnerForTeam(teamName, teamId) {
  // Normalize team name for lookup
  const normalizedName = teamName.toLowerCase().replace(/[^a-z\s]/g, '');
  
  // Check direct mapping first
  if (teamOwnerMap[normalizedName]) {
    return teamOwnerMap[normalizedName];
  }
  
  // Special handling for Athletics (team ID 133)
  if (teamId === 133) {
    return 'Dev';
  }
  
  // Fallback to "Unknown"
  return 'Unknown';
}

// Fetch live odds from The Odds API
export async function fetchLiveOdds() {
  const startTime = Date.now();
  
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

    const response = await fetch(
      `${ODDS_API_BASE}/sports/baseball_mlb_world_series_winner/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status}`);
    }

    const data = await response.json();
    
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
        apiEndpoint: 'baseball_mlb_world_series_winner/odds'
      }
    };
  } catch (error) {
    console.error('Failed to fetch live odds:', error);
    return {
      oddsMap: null,
      metadata: {
        source: 'The Odds API',
        error: error.message,
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
  
  // Check static mapping as fallback
  if (teamOddsMap[normalizedName]) {
    return teamOddsMap[normalizedName];
  }
  
  // Final fallback odds for teams not in any map
  return '+10000';
}

export async function getCurrentStandings() {
  const overallStartTime = Date.now();
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch live odds first
  const oddsResult = await fetchLiveOdds();
  const liveOddsMap = oddsResult?.oddsMap || null;
  const oddsMetadata = oddsResult?.metadata || {};
  
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
          metadata: {
            standings: standingsMetadata,
            odds: oddsMetadata,
            totalFetchTime: Date.now() - overallStartTime,
            dataRetrievedAt: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      console.warn(`Failed to fetch data for ${strategy.year}:`, error);
      continue;
    }
  }
  
  // If all strategies fail, return fallback data with live odds if available
  return await getFallbackData(liveOddsMap, oddsMetadata, Date.now() - overallStartTime);
}

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

export async function getFallbackData(liveOddsMap = null, oddsMetadata = {}, totalFetchTime = 0) {
  // Fetch MLB teams from GraphQL
  let mlbTeams = [];
  try {
    const response = await fetch('http://localhost:4000/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "mlb", season: "2025") {
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
    mlbTeams = data.data?.getTeams || [];
  } catch (error) {
    console.error('Error fetching MLB teams for fallback data:', error);
    mlbTeams = [];
  }

  // Add odds to fallback data
  const teamsWithOdds = mlbTeams.map(team => ({
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
    seasonYear: 2024,
    asOf: new Date().toISOString(),
    oddsSource: liveOddsMap ? 'live' : 'static',
    metadata: {
      standings: {
        source: 'Static fallback data',
        strategy: 'Hardcoded team data (API unavailable)',
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

export async function diagnose() {
  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];
  
  const endpoints = [
    {
      name: `Current Season (${currentYear}) with Date`,
      url: `${MLB_API_BASE}/standings?leagueId=103,104&season=${currentYear}&date=${today}`
    },
    {
      name: `Current Season (${currentYear}) without Date`,
      url: `${MLB_API_BASE}/standings?leagueId=103,104&season=${currentYear}`
    },
    {
      name: `Previous Season (${currentYear - 1}) with Date`,
      url: `${MLB_API_BASE}/standings?leagueId=103,104&season=${currentYear - 1}&date=${today}`
    },
    {
      name: `Previous Season (${currentYear - 1}) without Date`,
      url: `${MLB_API_BASE}/standings?leagueId=103,104&season=${currentYear - 1}`
    }
  ];
  
  const results = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url);
      const data = await response.json();
      
      let teamCount = 0;
      if (data.records) {
        for (const division of data.records) {
          teamCount += division.teamRecords ? division.teamRecords.length : 0;
        }
      }
      
      results.push({
        name: endpoint.name,
        status: response.status,
        ok: response.ok,
        teamCount,
        hasData: teamCount > 0,
        error: null
      });
    } catch (error) {
      results.push({
        name: endpoint.name,
        status: 'Error',
        ok: false,
        teamCount: 0,
        hasData: false,
        error: error.message
      });
    }
  }
  
  return results;
}
