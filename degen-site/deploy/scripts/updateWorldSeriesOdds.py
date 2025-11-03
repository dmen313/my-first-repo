#!/usr/bin/env python3

"""
World Series Odds Updater Script (Python Version)

This script fetches the latest World Series odds from multiple sources
and updates the GraphQL database with current odds data.

Usage: python3 scripts/updateWorldSeriesOdds.py

Requirements:
    pip install requests python-dotenv beautifulsoup4 gql aiohttp

"""

import os
import sys
import json
import asyncio
from datetime import datetime
from typing import Dict, Optional, List

import requests
from dotenv import load_dotenv
from gql import gql, Client
from gql.transport.aiohttp import AIOHTTPTransport

# Load environment variables
load_dotenv()

# GraphQL client setup
GRAPHQL_URL = "http://localhost:4000/graphql"

# GraphQL mutation to update team odds
UPDATE_TEAM_ODDS = gql("""
    mutation UpdateTeamOdds($teamId: ID!, $odds: String!) {
        updateTeam(input: { id: $teamId, odds: $odds }) {
            id
            name
            odds
            updatedAt
        }
    }
""")

GET_TEAMS = gql("""
    query GetMLBTeams {
        getTeams(league: "mlb", season: "2025") {
            id
            name
            odds
        }
    }
""")

# MLB team mappings for odds lookup
TEAM_MAPPINGS = {
    # American League
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
    
    # National League
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
}

# Current World Series favorites (updated based on recent performance)
FALLBACK_ODDS = {
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
}

class WorldSeriesOddsUpdater:
    def __init__(self):
        self.client = None
        self.api_key = os.getenv('REACT_APP_ODDS_API_KEY')
        
    async def setup_client(self):
        """Initialize GraphQL client"""
        transport = AIOHTTPTransport(url=GRAPHQL_URL)
        self.client = Client(transport=transport, fetch_schema_from_transport=True)
        
    async def fetch_odds_api(self) -> Optional[Dict[str, str]]:
        """Fetch odds from The Odds API"""
        if not self.api_key or self.api_key in ['YOUR_API_KEY', 'your_api_key_here']:
            print('⚠️ Odds API key not configured, skipping API fetch')
            return None
            
        try:
            url = f"https://api.the-odds-api.com/v4/sports/baseball_mlb_world_series_winner/odds?regions=us&oddsFormat=american&apiKey={self.api_key}"
            
            print('🔄 Fetching odds from The Odds API...')
            response = requests.get(url, timeout=30)
            data = response.json()
            
            if not response.ok or data.get('error_code'):
                if data.get('error_code') == 'OUT_OF_USAGE_CREDITS':
                    print('🚫 API quota exceeded, using fallback data')
                    return None
                raise Exception(f"API error: {data.get('message', 'Unknown error')}")
                
            if not data:
                print('⚠️ No odds data received from API')
                return None
                
            # Parse API response
            odds_map = {}
            for game in data:
                if game.get('bookmakers'):
                    bookmaker = game['bookmakers'][0]  # Use first bookmaker
                    if bookmaker.get('markets'):
                        market = bookmaker['markets'][0]  # Use first market
                        if market.get('outcomes'):
                            for outcome in market['outcomes']:
                                team_name = outcome['name']
                                price = outcome['price']
                                odds = f"+{price}" if price > 0 else str(price)
                                
                                # Find matching team
                                for full_name, aliases in TEAM_MAPPINGS.items():
                                    if any(alias.lower() in team_name.lower() or 
                                          team_name.lower() in alias.lower() 
                                          for alias in aliases):
                                        odds_map[full_name] = odds
                                        break
                                        
            print(f'✅ Fetched odds for {len(odds_map)} teams from API')
            return odds_map
            
        except Exception as error:
            print(f'❌ Error fetching from Odds API: {error}')
            return None
            
    def scrape_backup_odds(self) -> Optional[Dict[str, str]]:
        """Scrape odds from backup sources"""
        try:
            print('🔄 Attempting to scrape backup odds...')
            
            # Example: Scrape from ESPN or other sports sites
            # This would require BeautifulSoup and specific site parsing
            # For now, return None to use fallback odds
            
            print('⚠️ Web scraping not implemented, using fallback odds')
            return None
            
        except Exception as error:
            print(f'❌ Error scraping backup odds: {error}')
            return None
            
    async def get_teams_from_graphql(self) -> List[Dict]:
        """Get all MLB teams from GraphQL"""
        try:
            result = await self.client.execute(GET_TEAMS)
            return result.get('getTeams', [])
        except Exception as error:
            print(f'❌ Error fetching teams from GraphQL: {error}')
            raise
            
    async def update_team_odds(self, team_id: str, odds: str) -> Dict:
        """Update team odds in GraphQL"""
        try:
            result = await self.client.execute(
                UPDATE_TEAM_ODDS,
                variable_values={"teamId": team_id, "odds": odds}
            )
            return result['updateTeam']
        except Exception as error:
            print(f'❌ Error updating odds for team {team_id}: {error}')
            raise
            
    def find_team_odds(self, team_name: str, api_odds: Optional[Dict], fallback_odds: Optional[Dict]) -> Optional[str]:
        """Find best matching odds for a team"""
        # First try exact match
        if api_odds and team_name in api_odds:
            return api_odds[team_name]
            
        # Try alias matching
        if api_odds and team_name in TEAM_MAPPINGS:
            for alias in TEAM_MAPPINGS[team_name]:
                for odds_team, odds in api_odds.items():
                    if (alias.lower() in odds_team.lower() or 
                        odds_team.lower() in alias.lower()):
                        return odds
                        
        # Only use fallback if provided (None means preserve existing odds)
        if fallback_odds:
            return fallback_odds.get(team_name, '+5000')
            
        # Return None to indicate no API data available
        return None
        
    async def run(self):
        """Main execution function"""
        print('🚀 Starting World Series Odds Update...')
        
        try:
            # Setup GraphQL client
            await self.setup_client()
            
            # Step 1: Fetch current teams from GraphQL
            print('📊 Fetching teams from GraphQL...')
            teams = await self.get_teams_from_graphql()
            print(f'Found {len(teams)} MLB teams')
            
            if not teams:
                raise Exception('No teams found in GraphQL database')
                
            # Step 2: Try to fetch odds from API
            api_odds = await self.fetch_odds_api()
            
            # Step 3: Try backup scraping if API failed
            scraped_odds = self.scrape_backup_odds() if not api_odds else None
            
            # Step 4: Only proceed if we have real API data
            if not api_odds and not scraped_odds:
                print('⚠️ No live API data available - skipping odds update to preserve existing data')
                print('💡 Current odds will be preserved until fresh API data is available')
                print('\n📊 Update Summary:')
                print('✅ Successfully updated: 0 teams')
                print(f'➡️ Preserved existing odds: {len(teams)} teams')
                print('❌ Errors: 0 teams')
                print('📈 Odds source: None (API unavailable)')
                print(f'🕒 Check completed at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
                print('\n📋 Existing odds preserved - no changes made.')
                return

            odds_source = api_odds or scraped_odds
            source_name = 'The Odds API' if api_odds else 'Web Scraping'
            
            print(f'📈 Using live odds from: {source_name}')
            
            # Step 5: Update each team's odds
            updated_count = 0
            error_count = 0
            
            for team in teams:
                try:
                    new_odds = self.find_team_odds(team['name'], odds_source, None)  # No fallback - only use API data
                    
                    if new_odds and new_odds != team.get('odds'):
                        await self.update_team_odds(team['id'], new_odds)
                        print(f"✅ Updated {team['name']}: {team.get('odds', 'N/A')} → {new_odds}")
                        updated_count += 1
                    elif new_odds:
                        print(f"➡️ No change for {team['name']}: {team.get('odds', 'N/A')}")
                    else:
                        print(f"⚠️ No API data for {team['name']} - preserving existing odds: {team.get('odds', 'N/A')}")
                        
                except Exception as error:
                    print(f"❌ Failed to update {team['name']}: {error}")
                    error_count += 1
                    
            # Step 6: Summary
            print('\n📊 Update Summary:')
            print(f'✅ Successfully updated: {updated_count} teams')
            print(f"➡️ No changes needed: {len(teams) - updated_count - error_count} teams")
            print(f'❌ Errors: {error_count} teams')
            print(f'📈 Odds source: {source_name}')
            print(f'🕒 Update completed at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
            
            if updated_count > 0:
                print('\n🎉 World Series odds have been updated successfully!')
            else:
                print('\n📋 All odds were already up to date.')
                
        except Exception as error:
            print(f'\n💥 Script failed: {error}')
            sys.exit(1)
            
        finally:
            if self.client:
                await self.client.close_async()

async def main():
    """Entry point"""
    updater = WorldSeriesOddsUpdater()
    await updater.run()

if __name__ == "__main__":
    asyncio.run(main())
