#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

// API configuration
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;

const SPORT = "americanfootball_ncaaf_championship_winner";
const REGIONS = "us";
const ODDS_FORMAT = "american";
const MARKETS = "outrights";
const DATE_FORMAT = "iso";

// GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// Manual mapping of abbreviated names to full team names
const TEAM_NAME_MAPPING = {
  // Major teams that should be in Odds API
  'ABK': 'Army Black Knights',
  'ACT': 'Auburn Tigers', // Assuming this is Auburn
  'AFF': 'Air Force Falcons',
  'AR': 'Arkansas Razorbacks',
  'ASM': 'Arizona State Sun Devils',
  'ASRW': 'Arkansas State Red Wolves',
  'ASSD': 'Arizona State Sun Devils',
  'AW': 'Arizona Wildcats',
  'BB': 'Buffalo Bulls',
  'BCE': 'Boston College Eagles',
  'BGF': 'Bowling Green Falcons',
  'BSB': 'Boise State Broncos',
  'BSC': 'Baylor Bears',
  'BYUC': 'BYU Cougars',
  'C49': 'Charlotte 49ers',
  'CB': 'California Golden Bears',
  'CCC': 'Cincinnati Bearcats',
  'CGB': 'California Golden Bears',
  'CMC': 'Central Michigan Chippewas',
  'CT': 'Clemson Tigers',
  'DBD': 'Duke Blue Devils',
  'ECP': 'East Carolina Pirates',
  'EME': 'Eastern Michigan Eagles',
  'FAO': 'Florida Atlantic Owls',
  'FG': 'Florida Gators',
  'FIP': 'Florida International Panthers',
  'FSS': 'Florida State Seminoles',
  'GB': 'Georgia Bulldogs',
  'GSE': 'Georgia Southern Eagles',
  'GSP': 'Georgia State Panthers',
  'GTYJ': 'Georgia Tech Yellow Jackets',
  'HRW': 'Hawaii Rainbow Warriors',
  'HS': 'Houston Cougars',
  'IH': 'Iowa Hawkeyes',
  'IFI': 'Illinois Fighting Illini',
  'ISC': 'Iowa State Cyclones',
  'JMD': 'James Madison Dukes',
  'JSG': 'Jacksonville State Gamecocks',
  'KJ': 'Kansas Jayhawks',
  'KSO': 'Kennesaw State Owls',
  'KSW': 'Kansas State Wildcats',
  'LF': 'Liberty Flames',
  'LRC': 'Louisiana Ragin Cajuns',
  'LSUT': 'LSU Tigers',
  'LTB': 'Louisiana Tech Bulldogs',
  'MGG': 'Minnesota Golden Gophers',
  'MOHRH': 'Miami (OH) RedHawks',
  'MTH': 'Marshall Thundering Herd',
  'MTBR': 'Middle Tennessee Blue Raiders',
  'NCSW': 'NC State Wolfpack',
  'NDFI': 'Notre Dame Fighting Irish',
  'NHL': 'Northern Illinois Huskies',
  'NML': 'New Mexico Lobos',
  'NMSA': 'New Mexico State Aggies',
  'NTMG': 'North Texas Mean Green',
  'NWP': 'Nevada Wolf Pack',
  'OB': 'Ohio Bobcats',
  'ODM': 'Old Dominion Monarchs',
  'OMR': 'Ole Miss Rebels',
  'OSB': 'Oregon State Beavers',
  'OSC': 'Oklahoma State Cowboys',
  'PB': 'Purdue Boilermakers',
  'PSNL': 'Penn State Nittany Lions',
  'RO': 'Rice Owls',
  'RSK': 'Rutgers Scarlet Knights',
  'SAJ': 'South Alabama Jaguars',
  'SCG': 'South Carolina Gamecocks',
  'SDSA': 'San Diego State Aztecs',
  'SFB': 'South Florida Bulls',
  'SHSB': 'Sam Houston State Bearkats',
  'SJSS': 'San Jose State Spartans',
  'SMGE': 'Southern Mississippi Golden Eagles',
  'SMUM': 'SMU Mustangs',
  'TAMA': 'Texas A&M Aggies',
  'TGH': 'Tulsa Golden Hurricane',
  'TO': 'Temple Owls',
  'TR': 'Troy Trojans',
  'TSB': 'Texas State Bobcats',
  'TTRR': 'Texas Tech Red Raiders',
  'TV': 'Tennessee Volunteers',
  'UABB': 'UAB Blazers',
  'UCFK': 'UCF Knights',
  'UCH': 'UConn Huskies',
  'ULMW': 'UL Monroe Warhawks',
  'UMM': 'UMass Minutemen',
  'USCT': 'USC Trojans',
  'USC': 'USC Trojans',
  'UTSAR': 'UTSA Roadrunners',
  'UTEPM': 'UTEP Miners',
  'UU': 'Utah Utes',
  'VC': 'Virginia Cavaliers',
  'VTH': 'Virginia Tech Hokies',
  'WB': 'Washington Huskies',
  'WKH': 'Western Kentucky Hilltoppers',
  'WMB': 'Western Michigan Broncos',
  'WSC': 'Washington State Cougars',
  'WFDD': 'Wake Forest Demon Deacons',
  'WH': 'Wisconsin Badgers',
  'WVM': 'West Virginia Mountaineers'
};

// Conference mapping for major teams
const CONFERENCE_MAPPING = {
  'Alabama': 'SEC',
  'Georgia': 'SEC',
  'Texas': 'SEC',
  'LSU': 'SEC',
  'Florida': 'SEC',
  'Auburn': 'SEC',
  'Ole Miss': 'SEC',
  'Tennessee': 'SEC',
  'South Carolina': 'SEC',
  'Kentucky': 'SEC',
  'Missouri': 'SEC',
  'Vanderbilt': 'SEC',
  'Mississippi State': 'SEC',
  'Arkansas': 'SEC',
  'Texas A&M': 'SEC',
  
  'Ohio State': 'Big Ten',
  'Ohio': 'Big Ten',
  'Michigan': 'Big Ten',
  'Penn State': 'Big Ten',
  'Penn': 'Big Ten',
  'Wisconsin': 'Big Ten',
  'Iowa': 'Big Ten',
  'Michigan State': 'Big Ten',
  'Indiana': 'Big Ten',
  'Illinois': 'Big Ten',
  'Minnesota': 'Big Ten',
  'Nebraska': 'Big Ten',
  'Northwestern': 'Big Ten',
  'Purdue': 'Big Ten',
  'Maryland': 'Big Ten',
  'Rutgers': 'Big Ten',
  'UCLA': 'Big Ten',
  'USC': 'Big Ten',
  'Oregon': 'Big Ten',
  'Washington': 'Big Ten',
  
  'Clemson': 'ACC',
  'Florida State': 'ACC',
  'Miami': 'ACC',
  'Virginia Tech': 'ACC',
  'North Carolina': 'ACC',
  'Duke': 'ACC',
  'Wake Forest': 'ACC',
  'Boston College': 'ACC',
  'Boston': 'ACC',
  'Syracuse': 'ACC',
  'Pittsburgh': 'ACC',
  'Virginia': 'ACC',
  'Louisville': 'ACC',
  'Georgia Tech': 'ACC',
  'NC State': 'ACC',
  'NC': 'ACC',
  
  'Oklahoma': 'Big 12',
  'Texas Tech': 'Big 12',
  'Baylor': 'Big 12',
  'TCU': 'Big 12',
  'Kansas': 'Big 12',
  'Kansas State': 'Big 12',
  'Iowa State': 'Big 12',
  'West Virginia': 'Big 12',
  'Oklahoma State': 'Big 12',
  'BYU': 'Big 12',
  'Cincinnati': 'Big 12',
  'Houston': 'Big 12',
  'UCF': 'Big 12',
  
  'Notre Dame': 'Independent',
  'Army': 'Independent',
  'Navy': 'Independent',
  'Liberty': 'Independent',
  'UConn': 'Independent',
  'UMass': 'Independent',
  
  'Oregon State': 'Pac-12',
  'Washington State': 'Pac-12',
  'Stanford': 'Pac-12',
  'California': 'Pac-12',
  'Arizona': 'Pac-12',
  'Arizona State': 'Pac-12',
  'Utah': 'Pac-12',
  'Colorado': 'Pac-12',
  'UCLA': 'Pac-12',
  'USC': 'Pac-12',
  'Oregon': 'Pac-12',
  'Washington': 'Pac-12'
};

// Simple GraphQL client using fetch
async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  } catch (error) {
    throw new Error(`GraphQL request failed: ${error.message}`);
  }
}

// Fetch NCAAF outrights from The Odds API
async function fetchNcaafOutrights() {
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds`;
  const params = new URLSearchParams({
    apiKey: ODDS_API_KEY,
    regions: REGIONS,
    markets: MARKETS,
    oddsFormat: ODDS_FORMAT,
    dateFormat: DATE_FORMAT,
  });

  try {
    console.log('📡 Fetching NCAAF outrights from The Odds API...');
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`✅ Fetched ${data.length} outright events`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching NCAAF outrights:', error.message);
    throw error;
  }
}

// Get existing NCAA teams from GraphQL
async function getExistingNcaaTeams() {
  try {
    const query = `
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          owner
          odds
          division
        }
      }
    `;
    
    const data = await graphqlRequest(query);
    return data.getTeams || [];
  } catch (error) {
    console.error('❌ Error fetching existing NCAA teams:', error.message);
    return [];
  }
}

// Clean team name for matching
function cleanTeamName(name) {
  if (!name) return '';
  return name
    .replace(/\b(University|College|State|Tech|Institute)\b/gi, '')
    .replace(/\b(Longhorns|Bulldogs|Buckeyes|Nittany Lions|Tigers|Crimson Tide|Fighting Irish|Ducks|Wolverines|Gators|Aggies|Hurricanes|Rebels|Volunteers|Sooners|Gamecocks|Hoosiers|Trojans|Red Raiders|Sun Devils|Cardinals|Utes|Mustangs|Wildcats|Fighting Illini|Yellow Jackets|Cornhuskers|Hawkeyes|Bears|Cyclones|Seminoles|Huskies|Broncos|Horned Frogs|Jayhawks|Hokies|Blue Devils|Buffaloes|Cougars|Tar Heels|Bruins|Razorbacks|Wolfpack|Golden Gophers|Spartans|Badgers|Mountaineers|Commodores|Knights|Green Wave|Orange|Panthers|Cowboys|Scarlet Knights|Bulldogs|Tigers|Dukes|Cavaliers|Roadrunners|Bearcats|Golden Bears|Eagles|Bobcats|Wildcats|Mountaineers|Cardinal|Bulls|Midshipmen|Terrapins|Ragin Cajuns|Flames|Gamecocks|Hilltoppers|Pirates|Rams|Huskies|Falcons|Black Knights|Rockets|Eagles|Jaguars|Spartans|Bearkats|Boilermakers|Beavers|Monarchs|Bobcats|Huskies|Mean Green|RedHawks|Thundering Herd|Rainbow Warriors|Cowboys|Panthers|Eagles|Owls|Golden Flashes|Chippewas|Owls|Aggies|Bulldogs|Broncos|Blue Raiders|Golden Hurricane|Warhawks|Lobos|Cardinals|Minutemen|Miners|Eagles)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Get conference for team
function getConferenceForTeam(teamName) {
  const cleanName = cleanTeamName(teamName);
  return CONFERENCE_MAPPING[cleanName] || 'FBS';
}

// Update team in GraphQL
async function updateTeam(id, updateData) {
  try {
    const mutation = `
      mutation UpdateTeam($input: UpdateTeamInput!) {
        updateTeam(input: $input) {
          id
          name
          owner
          odds
          division
          updatedAt
        }
      }
    `;
    
    const data = await graphqlRequest(mutation, {
      input: {
        id,
        ...updateData
      }
    });
    return data.updateTeam;
  } catch (error) {
    throw new Error(`Failed to update team: ${error.message}`);
  }
}

// Main function
async function main() {
  console.log('🏈 Starting NCAA Football 2025 team name and data fix...');
  
  if (!ODDS_API_KEY) {
    console.error('❌ ODDS_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    // Fetch fresh odds data
    const outrights = await fetchNcaafOutrights();
    
    // Get existing teams
    const existingTeams = await getExistingNcaaTeams();
    console.log(`📊 Found ${existingTeams.length} existing NCAA teams`);

    // Process odds data
    const oddsMap = new Map();
    for (const event of outrights) {
      for (const bookmaker of event.bookmakers || []) {
        for (const market of bookmaker.markets || []) {
          if (market.key !== 'outrights') continue;
          
          for (const outcome of market.outcomes || []) {
            const name = outcome.name;
            const price = outcome.price;
            
            if (!name || price === undefined) continue;
            
            const cleanName = cleanTeamName(name);
            if (!oddsMap.has(cleanName)) {
              oddsMap.set(cleanName, {
                name: cleanName,
                fullName: name,
                bestPrice: price,
                bestBook: bookmaker.title,
                prices: []
              });
            }
            
            const teamOdds = oddsMap.get(cleanName);
            teamOdds.prices.push({
              bookmaker: bookmaker.title,
              price: price
            });
            
            // Choose the most favorable price
            if (teamOdds.bestPrice === null || price < teamOdds.bestPrice) {
              teamOdds.bestPrice = price;
              teamOdds.bestBook = bookmaker.title;
            }
          }
        }
      }
    }

    console.log(`📈 Found odds for ${oddsMap.size} teams from Odds API`);

    // Update teams with proper names, odds, and divisions
    let updatedCount = 0;
    let errorCount = 0;

    for (const team of existingTeams) {
      try {
        let updateData = {};
        let shouldUpdate = false;

        // Check if we have a mapping for this abbreviated name
        if (TEAM_NAME_MAPPING[team.name]) {
          const fullName = TEAM_NAME_MAPPING[team.name];
          const cleanName = cleanTeamName(fullName);
          
          // Check if this team has odds in the Odds API
          if (oddsMap.has(cleanName)) {
            const oddsData = oddsMap.get(cleanName);
            const oddsString = oddsData.bestPrice >= 0 ? `+${oddsData.bestPrice}` : oddsData.bestPrice.toString();
            const conference = getConferenceForTeam(cleanName);
            
            updateData = {
              name: fullName,
              odds: oddsString,
              division: conference
            };
            shouldUpdate = true;
            
            console.log(`✅ Updated ${team.name} → ${fullName} (${oddsString}) - ${conference}`);
          } else {
            // Team has proper name but no odds
            const conference = getConferenceForTeam(cleanName);
            updateData = {
              name: fullName,
              odds: '999999',
              division: conference
            };
            shouldUpdate = true;
            
            console.log(`📝 Fixed name ${team.name} → ${fullName} (no odds) - ${conference}`);
          }
        } else {
          // No mapping found, set odds to 999999
          updateData = {
            odds: '999999'
          };
          shouldUpdate = true;
          
          console.log(`🔢 Set ${team.name} odds to 999999 (no mapping)`);
        }

        if (shouldUpdate) {
          await updateTeam(team.id, updateData);
          updatedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to update ${team.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ NCAA Football 2025 team name and data fix complete!');
    console.log(`📈 Successfully updated: ${updatedCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error in main execution:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };

