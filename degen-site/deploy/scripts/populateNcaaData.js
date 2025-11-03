require('dotenv').config();

const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const CFBD_API_KEY = process.env.CFBD_API_KEY;

if (!ODDS_API_KEY) {
  console.error('❌ ODDS_API_KEY environment variable is required');
  process.exit(1);
}

if (!CFBD_API_KEY) {
  console.error('❌ CFBD_API_KEY environment variable is required');
  process.exit(1);
}

const SPORT = "americanfootball_ncaaf_championship_winner";
const REGIONS = "us";
const MARKETS = "outrights";
const ODDS_FORMAT = "american";
const DATE_FORMAT = "iso";
const YEAR = 2025;

// Improved team name aliases based on the provided script
const ALIASES = {
  OLEMISS: "Mississippi",
  UCONN: "Connecticut",
  UMASS: "Massachusetts",
  UTSA: "UTSA",
  UNLV: "UNLV",
  HAWAII: "Hawai'i",
  APPSTATE: "Appalachian State",
  NCSTATE: "NC State",
  PITTSBURGH: "Pitt",
  ALABAMABIRMINGHAM: "UAB",
  LOUISIANA: "Louisiana",
  LOUISIANALAFAYETTE: "Louisiana",
  LOUISIANAMONROE: "UL Monroe",
  TEXASSANANTONIO: "UTSA",
  MIAMIFL: "Miami",
  MIAMIOH: "Miami (OH)",
  BOISEST: "Boise State",
  SANJOSEST: "San José State",
  FRESNOST: "Fresno State",
  "TEXASA&M": "Texas A&M",
  PENNSTATE: "Penn State",
  OHIOST: "Ohio State",
  OKLAHOMAST: "Oklahoma State",
  MICHIGANST: "Michigan State",
  MISSISSIPPST: "Mississippi State",
  COLORADOST: "Colorado State",
  ARIZONAST: "Arizona State",
  UTAHST: "Utah State",
  KANSASST: "Kansas State",
  IOWAST: "Iowa State",
  BALLST: "Ball State",
  KENTST: "Kent State",
  OKLAST: "Oklahoma State",
  AKRONZIPS: "Akron",
};

// Improved normalization function
const norm = (s) =>
  (s || "")
    .toUpperCase()
    .replace("&AMP;", "&")
    .replace(/ STATE/g, " ST")
    .replace(/ ST\./g, " ST")
    .replace(/SAINT/g, "ST")
    .replace(/[''`]/g, "'")
    .replace(/[^A-Z0-9]/g, "");



// Teams that should have 999999 odds (not major teams)
const MINOR_TEAMS = [
  'Texas Lutheran',
  'Old Dominion',
  'Missouri Western',
  'Texas State Bobcats',
  'North Texas Mean Green',
  'North Texas',
  'Middle Tennessee Blue Raiders',
  'Arkansas State Red Wolves',
  'Southern Mississippi Golden Eagles',
  'San Diego State Aztecs',
  'Rice Owls',
  'Nevada Wolf Pack',
  'Temple Owls',
  'Florida International Panthers',
  'Kent State Golden Flashes',
  'Central Michigan Chippewas',
  'Kennesaw State Owls',
  'New Mexico State Aggies',
  'Western Michigan Broncos',
  'Tulsa Golden Hurricane',
  'UL Monroe Warhawks',
  'Ball State Cardinals',
  'UTEP Miners',
  'Eastern Michigan Eagles',
  'Miami (OH) RedHawks',
  'Marshall Thundering Herd',
  'Hawaii Rainbow Warriors',
  'Wyoming Cowboys',
  'Georgia Southern Eagles',
  'Florida Atlantic Owls',
  'Coastal Carolina Chanticleers',
  'Charlotte 49ers',
  'Buffalo Bulls',
  'UAB Blazers',
  'Troy Trojans',
  'South Alabama Jaguars',
  'San Jose State Spartans',
  'Sam Houston State Bearkats',
  'Northern Illinois Huskies',
  'Air Force Falcons',
  'Bowling Green Falcons',
  'Toledo Rockets',
  'Army Black Knights',
  'UConn Huskies',
  'Wake Forest Demon Deacons',
  'East Carolina Pirates',
  'Fresno State Bulldogs',
  'Western Kentucky Hilltoppers',
  'Jacksonville State Gamecocks',
  'Liberty Flames',
  'Navy Midshipmen',
  'Northwestern Wildcats',
  'South Florida Bulls',
  'Stanford Cardinal',
  'Appalachian State Mountaineers',
  'Boston College Eagles',
  'UTSA Roadrunners',
  'James Madison Dukes',
  'Mississippi State Bulldogs',
  'Rutgers Scarlet Knights',
  'Georgia State Panthers'
];

// Conference mapping for teams
const CONFERENCE_MAPPING = {
  'Alabama': 'SEC',
  'Alabama Crimson Tide': 'SEC',
  'Arkansas': 'SEC',
  'Texas A&M': 'SEC',
  'Texas A&M Aggies': 'SEC',
  'Texas State': 'FBS',
  'Texas Tech': 'Big 12',
  'Texas Tech Red Raiders': 'Big 12',
  'Ohio State': 'Big Ten',
  'Michigan': 'Big Ten',
  'Penn State': 'Big Ten',
  'Georgia': 'SEC',
  'Georgia Bulldogs': 'SEC',
  'Florida': 'SEC',
  'LSU': 'SEC',
  'Auburn': 'SEC',
  'Tennessee': 'SEC',
  'Ole Miss': 'SEC',
  'Mississippi State': 'SEC',
  'South Carolina': 'SEC',
  'Kentucky': 'SEC',
  'Missouri': 'SEC',
  'Vanderbilt': 'SEC',
  'Texas': 'SEC',
  'Texas Longhorns': 'SEC',
  'Oklahoma': 'Big 12',
  'Kansas': 'Big 12',
  'Kansas State': 'Big 12',
  'Iowa State': 'Big 12',
  'Baylor': 'Big 12',
  'TCU': 'Big 12',
  'West Virginia': 'Big 12',
  'Oklahoma State': 'Big 12',
  'Houston': 'Big 12',
  'Cincinnati': 'Big 12',
  'BYU': 'Big 12',
  'UCF': 'Big 12',
  'Florida State': 'ACC',
  'Miami': 'ACC',
  'North Carolina': 'ACC',
  'Duke': 'ACC',
  'Virginia Tech': 'ACC',
  'NC State': 'ACC',
  'Georgia Tech': 'ACC',
  'Pittsburgh': 'ACC',
  'Syracuse': 'ACC',
  'Boston College': 'ACC',
  'Virginia': 'ACC',
  'Wake Forest': 'ACC',
  'Louisville': 'ACC',
  'Maryland': 'Big Ten',
  'Rutgers': 'Big Ten',
  'Indiana': 'Big Ten',
  'Purdue': 'Big Ten',
  'Illinois': 'Big Ten',
  'Northwestern': 'Big Ten',
  'Iowa': 'Big Ten',
  'Minnesota': 'Big Ten',
  'Wisconsin': 'Big Ten',
  'Nebraska': 'Big Ten',
  'Michigan State': 'Big Ten',
  'Oregon': 'Pac-12',
  'USC': 'Pac-12',
  'Washington': 'Pac-12',
  'UCLA': 'Pac-12',
  'Utah': 'Pac-12',
  'Colorado': 'Pac-12',
  'Arizona': 'Pac-12',
  'Arizona State': 'Pac-12',
  'California': 'Pac-12',
  'Stanford': 'Pac-12',
  'Washington State': 'Pac-12',
  'Oregon State': 'Pac-12',
  'Notre Dame': 'Independent',
  'Navy': 'Independent',
  'Army': 'Independent',
  'Liberty': 'Independent',
  'UMass': 'Independent',
  'UConn': 'Independent',
  'Boise State': 'FBS',
  'SMU': 'FBS',
  'Tulane': 'FBS',
  'Memphis': 'FBS',
  'UNLV': 'FBS',
  'Fresno State': 'FBS',
  'San Diego State': 'FBS',
  'Utah State': 'FBS',
  'Wyoming': 'FBS',
  'Air Force': 'FBS',
  'Colorado State': 'FBS',
  'Nevada': 'FBS',
  'San José State': 'FBS',
  'Hawai\'i': 'FBS',
  'Appalachian State': 'FBS',
  'Coastal Carolina': 'FBS',
  'Georgia Southern': 'FBS',
  'Georgia State': 'FBS',
  'Troy': 'FBS',
  'South Alabama': 'FBS',
  'Louisiana': 'FBS',
  'UL Monroe': 'FBS',
  'Arkansas State': 'FBS',
  'Southern Mississippi': 'FBS',
  'UAB': 'FBS',
  'Rice': 'FBS',
  'North Texas': 'FBS',
  'UTSA': 'FBS',
  'Charlotte': 'FBS',
  'Florida Atlantic': 'FBS',
  'Florida International': 'FBS',
  'Marshall': 'FBS',
  'Western Kentucky': 'FBS',
  'Middle Tennessee': 'FBS',
  'Old Dominion': 'FBS',
  'Buffalo': 'FBS',
  'Kent State': 'FBS',
  'Bowling Green': 'FBS',
  'Toledo': 'FBS',
  'Eastern Michigan': 'FBS',
  'Central Michigan': 'FBS',
  'Western Michigan': 'FBS',
  'Northern Illinois': 'FBS',
  'Ball State': 'FBS',
  'Miami (OH)': 'FBS',
  'Ohio': 'FBS',
  'Akron': 'FBS',
  'Temple': 'FBS',
  'East Carolina': 'FBS',
  'South Florida': 'FBS',
  'Tulsa': 'FBS',
  'James Madison': 'FBS',
  'Jacksonville State': 'FBS',
  'Sam Houston State': 'FBS',
  'Kennesaw State': 'FBS',
  'New Mexico State': 'FBS',
  'UTEP': 'FBS',
  'New Mexico': 'FBS',
  'Louisiana Tech': 'FBS'
};

// GraphQL client for Node.js
async function graphqlRequest(query, variables = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch teams from GraphQL
async function fetchExistingTeams() {
  const data = await graphqlRequest(`
    query GetTeams($league: String!, $season: String!) {
      getTeams(league: $league, season: $season) {
        id
        name
        odds
        division
        owner
      }
    }
  `, { league: 'ncaa', season: '2025' });

  return data.getTeams || [];
}

// Update or create team in GraphQL
async function updateOrCreateTeam(teamName, odds, conference) {
  const existingTeams = await fetchExistingTeams();
  
  // Find matching team using improved logic
  let matchingTeam = null;
  
  // First try exact match (case insensitive)
  matchingTeam = existingTeams.find(team => 
    team.name.toLowerCase() === teamName.toLowerCase()
  );
  
  // Then try normalized match
  if (!matchingTeam) {
    const normalizedTeamName = norm(teamName);
    matchingTeam = existingTeams.find(team => 
      norm(team.name) === normalizedTeamName
    );
  }
  
  // Then try alias match
  if (!matchingTeam) {
    const alias = ALIASES[norm(teamName)];
    if (alias) {
      matchingTeam = existingTeams.find(team => 
        team.name.toLowerCase() === alias.toLowerCase()
      );
    }
  }
  
  // Then try partial match (but be more strict)
  if (!matchingTeam) {
    // Only match if one name is contained within the other AND they're similar length
    matchingTeam = existingTeams.find(team => {
      const teamLower = team.name.toLowerCase();
      const nameLower = teamName.toLowerCase();
      const lengthDiff = Math.abs(teamLower.length - nameLower.length);
      
      return (teamLower.includes(nameLower) || nameLower.includes(teamLower)) &&
             lengthDiff <= 5; // Only match if names are similar length
    });
  }

  if (matchingTeam) {
    // Update existing team
    const updateData = {
      odds: odds >= 0 ? `+${odds}` : odds.toString(), // Standardize odds format
      division: conference
    };
    
    const result = await graphqlRequest(`
      mutation UpdateTeam($input: UpdateTeamInput!) {
        updateTeam(input: $input) {
          id
          name
          odds
          division
        }
      }
    `, { input: { id: matchingTeam.id, odds: updateData.odds, division: updateData.division } });
    
    console.log(`✅ Updated ${teamName} → ${matchingTeam.name} (${odds})`);
    return result.updateTeam;
  } else {
    // Check if this is a minor team that should have 999999 odds
    const isMinorTeam = MINOR_TEAMS.some(minorTeam => 
      teamName.toLowerCase().includes(minorTeam.toLowerCase()) ||
      minorTeam.toLowerCase().includes(teamName.toLowerCase())
    );
    
    // Only create new teams if odds are reasonable (not too high) and not a minor team
    if (odds <= 50000 && !isMinorTeam) {
      const createData = {
        name: teamName,
        record: "0-0",
        league: "ncaa",
        division: conference,
        wins: 0,
        losses: 0,
        gamesBack: "0",
        wildCardGamesBack: "0",
        owner: "NA",
        odds: odds >= 0 ? `+${odds}` : odds.toString()
      };
      
      const result = await graphqlRequest(`
        mutation CreateTeam($input: TeamInput!) {
          createTeam(input: $input) {
            id
            name
            odds
            division
          }
        }
      `, { input: createData });
      
      console.log(`✅ Created ${teamName} (${odds})`);
      return result.createTeam;
    } else {
      console.log(`⏭️ Skipped ${teamName} (odds too high: ${odds})`);
      return null;
    }
  }
}

// Fetch odds from The Odds API
async function fetchOdds() {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds?apiKey=${ODDS_API_KEY}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=${ODDS_FORMAT}&dateFormat=${DATE_FORMAT}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

// Aggregate best odds from multiple bookmakers
function aggregateBestOdds(outrights) {
  const oddsMap = new Map();
  
  for (const event of outrights || []) {
    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        if (market.key !== 'outrights') continue;
        
        for (const outcome of market.outcomes || []) {
          const teamName = outcome.name;
          const odds = outcome.price;
          
          if (!oddsMap.has(teamName)) {
            oddsMap.set(teamName, {
              name: teamName,
              odds: odds,
              bookmaker: bookmaker.title
            });
          } else {
            const existing = oddsMap.get(teamName);
            // Keep the better odds (higher positive or less negative)
            if ((odds >= 0 && existing.odds >= 0 && odds > existing.odds) ||
                (odds < 0 && existing.odds < 0 && odds > existing.odds) ||
                (odds >= 0 && existing.odds < 0)) {
              oddsMap.set(teamName, {
                name: teamName,
                odds: odds,
                bookmaker: bookmaker.title
              });
            }
          }
        }
      }
    }
  }
  
  return oddsMap;
}

// Get conference for team
function getConferenceForTeam(teamName) {
  // Try exact match first
  if (CONFERENCE_MAPPING[teamName]) {
    return CONFERENCE_MAPPING[teamName];
  }
  
  // Try normalized match
  const normalizedName = norm(teamName);
  for (const [key, value] of Object.entries(CONFERENCE_MAPPING)) {
    if (norm(key) === normalizedName) {
      return value;
    }
  }
  
  // Try alias match
  const alias = ALIASES[normalizedName];
  if (alias && CONFERENCE_MAPPING[alias]) {
    return CONFERENCE_MAPPING[alias];
  }
  
  return 'FBS'; // Default fallback
}

// Main function
async function main() {
  try {
    console.log('🏈 Starting NCAA Football 2025 data population...');
    
    // Fetch odds from The Odds API
    console.log('📡 Fetching NCAAF outrights from The Odds API...');
    const outrights = await fetchOdds();
    console.log(`✅ Fetched ${outrights.length} outright events`);
    
    // Aggregate best odds
    const oddsMap = aggregateBestOdds(outrights);
    console.log(`📈 Found odds for ${oddsMap.size} teams from Odds API`);
    
    // Filter out minor teams and display summary
    console.log('\n📊 NCAA Football 2025 Teams Summary:');
    console.log('Team,Conference,Best_Odds(Book)');
    
    const sortedTeams = Array.from(oddsMap.values())
      .filter(team => {
        // Filter out minor teams that should have 999999 odds
        const isMinorTeam = MINOR_TEAMS.some(minorTeam => 
          team.name.toLowerCase().includes(minorTeam.toLowerCase()) ||
          minorTeam.toLowerCase().includes(team.name.toLowerCase())
        );
        return !isMinorTeam;
      })
      .sort((a, b) => {
        const aOdds = a.odds ?? 999999;
        const bOdds = b.odds ?? 999999;
        const aGroup = aOdds < 0 ? 0 : 1;
        const bGroup = bOdds < 0 ? 0 : 1;
        if (aGroup !== bGroup) return aGroup - bGroup;
        return Math.abs(aOdds) - Math.abs(bOdds);
      });
    
    for (const team of sortedTeams) {
      const conference = getConferenceForTeam(team.name);
      console.log(`${team.name},${conference},${team.odds} (${team.bookmaker})`);
    }
    
    // Update GraphQL database
    console.log('\n🔄 Updating GraphQL database...');
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const team of sortedTeams) {
      try {
        const conference = getConferenceForTeam(team.name);
        const result = await updateOrCreateTeam(team.name, team.odds, conference);
        
        if (result) {
          updatedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${team.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n✅ NCAA Football 2025 data population complete!');
    console.log(`📈 Successfully updated: ${updatedCount} teams`);
    console.log(`⏭️ Skipped (high odds): ${skippedCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
