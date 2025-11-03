# Scripts Documentation

## Mapping Table Management

### Repopulate Mapping Table
**File:** `repopulateMappingTable.js`  
**Command:** `npm run repopulate-mappings`

This script repopulates the team mapping table with hardcoded essential data and fetches additional information from external APIs.

#### What it does:
1. **Hardcoded Data:** Contains essential mapping data for 89+ NCAA teams including:
   - `cfbdId` - College Football Data API team ID
   - `cfbdName` - Team name in CFBD format
   - `oddsApiName` - Team name in Odds API format
   - `cfbdConference` - Conference affiliation

2. **API Data Fetching:**
   - **CFBD API:** Fetches team mascot and abbreviation
   - **Odds API:** Fetches current championship odds

3. **Database Population:** Creates `TeamMapping` records via GraphQL

#### Prerequisites:
- GraphQL server running on port 4000
- Environment variables:
  - `CFBD_API_KEY` (optional - for additional team data)
  - `REACT_APP_ODDS_API_KEY` (optional - for odds data)

#### Usage:
```bash
# Run the script
npm run repopulate-mappings

# Or run directly
node scripts/repopulateMappingTable.js
```

#### Coverage:
- **SEC:** 16 teams (Alabama, Georgia, LSU, Florida, Auburn, etc.)
- **Big Ten:** 18 teams (Michigan, Ohio State, Penn State, etc.)
- **ACC:** 18 teams (Clemson, Florida State, Miami, etc.)
- **Big 12:** 16 teams (Kansas State, Kansas, Iowa State, etc.)
- **Independent:** 1 team (Notre Dame)
- **Pac-12:** 2 teams (Oregon State, Washington State)

#### Features:
- **Rate Limiting:** 100ms delay between API calls
- **Error Handling:** Graceful handling of API failures
- **Duplicate Prevention:** Skips existing mappings
- **Progress Tracking:** Real-time status updates
- **Summary Report:** Final count of created/skipped/error mappings

#### When to use:
- After database truncation
- When adding new teams
- To refresh odds data
- During system recovery

### Export Mapping Table
**File:** `exportMappingTableToCSV.js`  
**Command:** `npm run export-mappings`

Exports the entire mapping table to a timestamped CSV file.

### Remove Duplicates
**File:** `removeDuplicateMappings.js` (temporary script)  
**Command:** `node scripts/removeDuplicateMappings.js`

Removes duplicate team mappings, keeping one entry per team.

## Team Table Management

### Repopulate NCAA Teams
**File:** `repopulateNcaaTeams.js`  
**Command:** `npm run repopulate-ncaa-teams`

This script truncates and repopulates NCAA 2025 teams in the team table using the mapping table and live API data.

#### What it does:
1. **Truncation:** Deletes all existing NCAA 2025 teams
2. **Mapping Integration:** Uses team mappings to get correct team names and IDs
3. **Live Data Fetching:**
   - **CFBD API:** Fetches current season records
   - **Odds API:** Fetches championship winner odds
4. **Team Creation:** Creates `Team` records with live data

#### Prerequisites:
- GraphQL server running on port 4000
- Team mappings must exist (run `repopulate-mappings` first if needed)
- Environment variables:
  - `CFBD_API_KEY` (optional - for live records)
  - `REACT_APP_ODDS_API_KEY` (optional - for live odds)

#### Usage:
```bash
# Run the script
npm run repopulate-ncaa-teams

# Or run directly
node scripts/repopulateNcaaTeams.js
```

#### Coverage:
- All 69 NCAA teams from the mapping table
- Live records from CFBD API (when available)
- Live championship odds from Odds API (when available)

#### Features:
- **Complete Refresh:** Truncates existing teams for clean slate
- **Live Data:** Fetches current records and odds
- **Rate Limiting:** 200ms delay between API calls
- **Error Handling:** Graceful handling of API failures
- **Progress Tracking:** Real-time status updates
- **Summary Report:** Final count of created/deleted/error teams

#### When to use:
- After mapping table updates
- To refresh team data with live records
- When switching seasons
- During system recovery

## Data Sources

### College Football Data API (CFBD)
- **Endpoint:** `https://api.collegefootballdata.com/teams`
- **Purpose:** Team metadata (mascot, abbreviation)
- **Authentication:** Bearer token

### The Odds API
- **Endpoint:** `https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds`
- **Purpose:** Championship winner odds
- **Authentication:** API key parameter

## Schema Reference

### TeamMapping Input
```graphql
input TeamMappingInput {
  cfbdId: Int!
  cfbdName: String!
  cfbdMascot: String
  cfbdConference: String!
  cfbdAbbreviation: String
  oddsApiName: String!
  oddsApiOdds: String
  league: String!
  season: String!
  matchType: String!
}
```

## Troubleshooting

### Common Issues:
1. **API Key Missing:** Script will warn and continue without API data
2. **Rate Limiting:** Built-in delays prevent API throttling
3. **Duplicate Errors:** Script handles gracefully and reports skipped items
4. **Network Issues:** Individual team failures don't stop the process

### Error Recovery:
- Check environment variables are set
- Verify GraphQL server is running
- Ensure API keys are valid
- Check network connectivity
