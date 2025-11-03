import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { DynamoDBAdapter } from './dynamoDBAdapter.js';

// File paths for persistence
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const DATASTORE_FILE = path.join(DATA_DIR, 'datastore.json');

// Check if we should use DynamoDB
const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true';
const dynamoDBAdapter = USE_DYNAMODB ? new DynamoDBAdapter() : null;

// Debouncing for save operations
let saveTimeout = null;

class DataStore {
  constructor() {
    this.teams = new Map();
    this.achievements = new Map();
    this.payoutRows = new Map();
    this.leagueSettings = new Map();
    this.teamMappings = new Map();
    this.owners = new Map();
    this.draftPicks = new Map();
    this.initialized = false;
    
    // Initialize with existing data asynchronously
    this.initializeData();
  }

  async initializeData() {
    if (this.initialized) return;
    
    // Load existing data from file
    await this.loadDataStore();
    
    // Clean up any duplicate teams that might exist
    this.cleanupDuplicateTeams();
    
    // Initialize base structures if not loaded from file
    if (this.payoutRows.size === 0) {
      this.initializePayoutStructures();
    }
    if (this.leagueSettings.size === 0) {
      this.initializeLeagueSettings();
    }
    if (this.owners.size === 0) {
      this.initializeOwners();
    }
    
    // Only populate NCAA teams from mappings if no teams exist
    if (this.teams.size === 0) {
      console.log('🔄 No existing teams found, initializing from external sources...');
      await this.populateNcaaTeamsFromMapping();
    }
    
    this.initialized = true;
    console.log('📊 DataStore initialized with', this.teams.size, 'teams');
  }

  // Clean up duplicate teams that might exist in the datastore
  cleanupDuplicateTeams() {
    console.log('🧹 Checking for duplicate teams...');
    
    const teamsByKey = {};
    const duplicatesToRemove = [];
    
    // Group teams by name + league + season
    Array.from(this.teams.entries()).forEach(([id, team]) => {
      const key = `${team.name}|${team.league}|${team.season}`;
      
      if (!teamsByKey[key]) {
        teamsByKey[key] = [];
      }
      teamsByKey[key].push({ id, team });
    });
    
    // Find duplicates and mark older ones for removal
    Object.entries(teamsByKey).forEach(([key, teams]) => {
      if (teams.length > 1) {
        console.log(`🔍 Found ${teams.length} duplicates for: ${key}`);
        
        // Sort by creation date (keep newest) or by completeness (keep most complete)
        teams.sort((a, b) => {
          // Prefer teams with owners
          if (a.team.owner && !b.team.owner) return -1;
          if (!a.team.owner && b.team.owner) return 1;
          
          // Prefer teams with odds
          if (a.team.odds && !b.team.odds) return -1;
          if (!a.team.odds && b.team.odds) return 1;
          
          // Prefer newer teams
          return new Date(b.team.createdAt) - new Date(a.team.createdAt);
        });
        
        // Keep the first (best) team, mark others for removal
        for (let i = 1; i < teams.length; i++) {
          duplicatesToRemove.push(teams[i].id);
        }
      }
    });
    
    // Remove duplicates
    if (duplicatesToRemove.length > 0) {
      console.log(`🗑️ Removing ${duplicatesToRemove.length} duplicate teams`);
      duplicatesToRemove.forEach(id => {
        this.teams.delete(id);
      });
      this.saveDataStore();
    } else {
      console.log('✅ No duplicate teams found');
    }
  }

  // This method is now deprecated - teams are loaded from persisted data or external APIs
  // Keeping for backward compatibility but it should not be used
  initializeTeams() {
    console.log('⚠️  initializeTeams() is deprecated - teams should be loaded from persisted data');
  }

  initializePayoutStructures() {
    // Clear existing payout rows to prevent duplicates
    this.payoutRows.clear();
    console.log('💰 Initializing payout structures...');
    
    // MLB 2024 payout structure (same as 2025)
    const mlb2024Payouts = [
      { level: 'Wild Card', teams: 4, percentage: 5.00 },
      { level: 'Division', teams: 8, percentage: 20.00 },
      { level: 'League', teams: 4, percentage: 24.00 },
      { level: 'World Series', teams: 2, percentage: 24.00 },
      { level: 'Winner', teams: 1, percentage: 22.50 },
      { level: 'Worst Record', teams: 1, percentage: 4.50 }
    ];

    mlb2024Payouts.forEach(payout => {
      const id = uuidv4();
      this.payoutRows.set(id, {
        id,
        league: 'mlb',
        season: '2024',
        ...payout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // MLB 2025 payout structure
    const mlbPayouts = [
      { level: 'Wild Card', teams: 4, percentage: 5.00 },
      { level: 'Division', teams: 8, percentage: 20.00 },
      { level: 'League', teams: 4, percentage: 24.00 },
      { level: 'World Series', teams: 2, percentage: 24.00 },
      { level: 'Winner', teams: 1, percentage: 22.50 },
      { level: 'Worst Record', teams: 1, percentage: 4.50 }
    ];

    mlbPayouts.forEach(payout => {
      const id = uuidv4();
      this.payoutRows.set(id, {
        id,
        league: 'mlb',
        season: '2025',
        ...payout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // NBA 2024 payout structure
    const nbaPayouts = [
      { level: 'Play-In', teams: 4, percentage: 5.00 },
      { level: 'Playoffs', teams: 16, percentage: 12.00 },
      { level: 'Conference Semis', teams: 8, percentage: 18.00 },
      { level: 'Conference Finals', teams: 4, percentage: 20.00 },
      { level: 'NBA Finals', teams: 2, percentage: 20.00 },
      { level: 'Champion', teams: 1, percentage: 8.00 },
      { level: 'Worst Team', teams: 1, percentage: 3.00 },
      { level: '1st West All-Star', teams: 1, percentage: 5.00 },
      { level: '1st East All-Star', teams: 1, percentage: 5.00 },
      { level: '2nd West All-Star', teams: 1, percentage: 2.00 },
      { level: '2nd East All-Star', teams: 1, percentage: 2.00 }
    ];

    nbaPayouts.forEach(payout => {
      const id = uuidv4();
      this.payoutRows.set(id, {
        id,
        league: 'nba',
        season: '2024',
        ...payout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // NBA 2025 payout structure (same as 2024)
    const nba2025Payouts = [
      { level: 'Play-In', teams: 4, percentage: 5.00 },
      { level: 'Playoffs', teams: 16, percentage: 12.00 },
      { level: 'Conference Semis', teams: 8, percentage: 18.00 },
      { level: 'Conference Finals', teams: 4, percentage: 20.00 },
      { level: 'NBA Finals', teams: 2, percentage: 20.00 },
      { level: 'Champion', teams: 1, percentage: 8.00 },
      { level: 'Worst Team', teams: 1, percentage: 3.00 },
      { level: '1st West All-Star', teams: 1, percentage: 5.00 },
      { level: '1st East All-Star', teams: 1, percentage: 5.00 },
      { level: '2nd West All-Star', teams: 1, percentage: 2.00 },
      { level: '2nd East All-Star', teams: 1, percentage: 2.00 }
    ];

    nba2025Payouts.forEach(payout => {
      const id = uuidv4();
      this.payoutRows.set(id, {
        id,
        league: 'nba',
        season: '2025',
        ...payout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // NFL 2025 payout structure
    const nflPayouts = [
      { level: 'Make it to First Round', teams: 12, percentage: 12.50 },
      { level: 'First Round Bye', teams: 2, percentage: 1.50 },
      { level: 'Make it to Divisional Round', teams: 8, percentage: 14.00 },
      { level: 'Make it to Conference', teams: 4, percentage: 16.00 },
      { level: 'Make it to Superbowl', teams: 2, percentage: 20.00 },
      { level: 'Win Superbowl', teams: 1, percentage: 22.00 },
      { level: 'Last team to lose a game', teams: 1, percentage: 5.00 },
      { level: 'Last team to win a game', teams: 1, percentage: 5.00 },
      { level: 'Division winners', teams: 8, percentage: 0.00 },
      { level: 'Drafter that picks most total wins', teams: 1, percentage: 0.00 }
    ];

    nflPayouts.forEach(payout => {
      const id = uuidv4();
      this.payoutRows.set(id, {
        id,
        league: 'nfl',
        season: '2025',
        ...payout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    // NCAA 2025 payout structure - $6,000 prize pool
    const ncaaPayouts = [
      { level: 'First seed in playoffs', teams: 1, percentage: 20.83 }, // $1,250
      { level: '2nd seed in playoffs', teams: 1, percentage: 12.50 },   // $750
      { level: '3rd seed in playoffs', teams: 1, percentage: 10.00 },   // $600
      { level: '4th seed in playoffs', teams: 1, percentage: 6.67 },    // $400
      { level: '5th seed in playoffs', teams: 1, percentage: 5.00 },    // $300
      { level: 'Made CFP - 12 teams', teams: 7, percentage: 23.33 },    // $1,400 (7 × $200)
      { level: 'Made Top 25 not in playoff', teams: 13, percentage: 21.67 } // $1,300 (13 × $100)
    ];

    ncaaPayouts.forEach(payout => {
      const id = uuidv4();
      this.payoutRows.set(id, {
        id,
        league: 'ncaa',
        season: '2025',
        ...payout,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  }

  initializeLeagueSettings() {
    // Clear existing league settings to prevent duplicates
    this.leagueSettings.clear();
    console.log('🏆 Initializing league settings...');
    
    // NCAA 2025 league settings with $6000 pool
    const ncaaSettings = {
      league: 'ncaa',
      season: '2025',
      buyInPerTeam: 1500.00, // $1500 per team
      numTeams: 4, // 4 owners
      totalPool: 6000.00 // $6000 total pool
    };

    const ncaaId = uuidv4();
    this.leagueSettings.set(ncaaId, {
      id: ncaaId,
      ...ncaaSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // MLB 2024 league settings
    const mlb2024Settings = {
      league: 'mlb',
      season: '2024',
      buyInPerTeam: 100.00,
      numTeams: 4,
      totalPool: 400.00
    };

    const mlb2024Id = uuidv4();
    this.leagueSettings.set(mlb2024Id, {
      id: mlb2024Id,
      ...mlb2024Settings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // MLB 2025 league settings
    const mlbSettings = {
      league: 'mlb',
      season: '2025',
      buyInPerTeam: 100.00,
      numTeams: 4,
      totalPool: 400.00
    };

    const mlbId = uuidv4();
    this.leagueSettings.set(mlbId, {
      id: mlbId,
      ...mlbSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // NBA 2024 league settings
    const nbaSettings = {
      league: 'nba',
      season: '2024',
      buyInPerTeam: 100.00,
      numTeams: 4,
      totalPool: 400.00
    };

    const nbaId = uuidv4();
    this.leagueSettings.set(nbaId, {
      id: nbaId,
      ...nbaSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // NBA 2025 league settings
    const nba2025Settings = {
      league: 'nba',
      season: '2025',
      buyInPerTeam: 100.00,
      numTeams: 4,
      totalPool: 400.00
    };

    const nba2025Id = uuidv4();
    this.leagueSettings.set(nba2025Id, {
      id: nba2025Id,
      ...nba2025Settings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // NFL 2025 league settings
    const nflSettings = {
      league: 'nfl',
      season: '2025',
      buyInPerTeam: 100.00,
      numTeams: 4,
      totalPool: 400.00
    };

    const nflId = uuidv4();
    this.leagueSettings.set(nflId, {
      id: nflId,
      ...nflSettings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  initializeOwners() {
    const ownersList = ['TG', 'KH', 'DM', 'MC'];
    
    ownersList.forEach(abbrev => {
      const id = uuidv4();
      this.owners.set(id, {
        id,
        name: this.getFullOwnerName(abbrev),
        abbreviation: abbrev,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  }

  mapOwnerName(oldName) {
    // Map old owner names to new abbreviations
    const ownerMapping = {
      'Dev': 'DM',
      'Mike': 'MC', 
      'Hurls': 'KH',
      'TG': 'TG', // TG stays the same
      'Grammer': 'TG' // Just in case
    };
    return ownerMapping[oldName] || oldName;
  }

  getFullOwnerName(abbrev) {
    const nameMap = {
      'TG': 'Team Grammer',
      'KH': 'Team Hurls', 
      'DM': 'Team Dev',
      'MC': 'Team Mike'
    };
    return nameMap[abbrev] || abbrev;
  }

  // Ensure initialization before operations
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeData();
    }
  }

  // Standardize team data structure
  standardizeTeam(teamData) {
    return {
      id: teamData.id || uuidv4(),
      name: teamData.name,
      record: teamData.record || '0-0',
      league: teamData.league,
      division: teamData.division || 'Unknown',
      wins: teamData.wins || 0,
      losses: teamData.losses || 0,
      gamesBack: teamData.gamesBack || '0',
      wildCardGamesBack: teamData.wildCardGamesBack || '0',
      season: teamData.season || '2025',
      owner: this.mapOwnerName(teamData.owner) || null,
      odds: teamData.odds || null,
      createdAt: teamData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  // Team operations
  async getAllTeams() {
    console.log('🔍 getAllTeams called, initialized:', this.initialized);
    
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getAllTeams();
    }
    
    await this.ensureInitialized();
    const teams = Array.from(this.teams.values());
    console.log(`✅ getAllTeams returning ${teams.length} teams`);
    return teams;
  }

  async getTeamsByLeague(league, season) {
    console.log('🔍 getTeamsByLeague called with:', { league, season });
    
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getTeamsByLeague(league, season);
    }
    
    await this.ensureInitialized();
    const teams = Array.from(this.teams.values()).filter(team => {
      if (league && season) {
        // First check if team season matches the requested season
        const seasonMatches = team.season === season;
        
        // NBA teams have league like "Eastern Conference" or "Western Conference"
        if (league.toLowerCase() === 'nba' && (season === '2024' || season === '2025')) {
          return seasonMatches && team.league.toLowerCase().includes('conference');
        }
        // MLB teams have league like "American League" or "National League"  
        if (league.toLowerCase() === 'mlb' && (season === '2024' || season === '2025')) {
          return seasonMatches && team.league.toLowerCase().includes('league') && !team.league.toLowerCase().includes('conference');
        }
        // NFL teams have league like "AFC" or "NFC"
        if (league.toLowerCase() === 'nfl' && season === '2025') {
          return seasonMatches && (team.league.toLowerCase() === 'afc' || team.league.toLowerCase() === 'nfc');
        }
        // NCAA teams have league "NCAA"
        if (league.toLowerCase() === 'ncaa' && season === '2025') {
          return seasonMatches && team.league.toLowerCase() === 'ncaa';
        }
        // Fallback to original logic - check both league and season
        return seasonMatches && team.league.toLowerCase().includes(league.toLowerCase());
      }
      return true;
    });
    console.log(`✅ getTeamsByLeague returning ${teams.length} teams`);
    return teams;
  }

  async getTeamsByOwner(owner) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      // DynamoDBAdapter doesn't have this method, so scan and filter
      const allTeams = await dynamoDBAdapter.getAllTeams();
      return allTeams.filter(team => team.owner === owner);
    }
    
    return Array.from(this.teams.values()).filter(team => team.owner === owner);
  }

  async getTeam(id) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getTeam(id);
    }
    
    return this.teams.get(id);
  }

  createTeam(teamData) {
    const team = this.standardizeTeam(teamData);
    
    // Check for existing team with same name, league, and season to prevent duplicates
    const existingTeam = Array.from(this.teams.values()).find(t => 
      t.name === team.name && 
      t.league === team.league && 
      t.season === team.season
    );
    
    if (existingTeam) {
      console.log(`⚠️ Team already exists: ${team.name} (${team.league} ${team.season}), updating instead of creating`);
      // Update existing team with new data
      const updatedTeam = {
        ...existingTeam,
        ...team,
        id: existingTeam.id, // Keep original ID
        createdAt: existingTeam.createdAt, // Keep original creation date
        updatedAt: new Date().toISOString()
      };
      this.teams.set(existingTeam.id, updatedTeam);
      this.saveDataStore();
      return updatedTeam;
    }
    
    this.teams.set(team.id, team);
    this.saveDataStore();
    return team;
  }

  async updateTeam(id, updateData) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.updateTeam(id, updateData);
    }
    
    const team = this.teams.get(id);
    if (!team) return null;
    
    const updatedTeam = {
      ...team,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.teams.set(id, updatedTeam);
    return updatedTeam;
  }

  deleteTeam(id) {
    return this.teams.delete(id);
  }

  // Achievement operations
  getAllAchievements() {
    return Array.from(this.achievements.values());
  }

  async getAchievementsByTeam(teamId) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getAchievementsByTeam(teamId);
    }
    
    return Array.from(this.achievements.values()).filter(achievement => achievement.teamId === teamId);
  }

  async getAchievementsByLeague(league, season) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      // Scan achievements table and filter
      const allAchievements = await dynamoDBAdapter.getAllAchievements();
      return allAchievements.filter(achievement => {
        return (!league || achievement.league === league) && (!season || achievement.season === season);
      });
    }
    
    return Array.from(this.achievements.values()).filter(achievement => {
      return (!league || achievement.league === league) && (!season || achievement.season === season);
    });
  }

  getAchievement(id) {
    return this.achievements.get(id);
  }

  createAchievement(achievementData) {
    const id = uuidv4();
    const achievement = {
      ...achievementData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.achievements.set(id, achievement);
    return achievement;
  }

  updateAchievement(id, updateData) {
    const achievement = this.achievements.get(id);
    if (!achievement) return null;
    
    const updatedAchievement = {
      ...achievement,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.achievements.set(id, updatedAchievement);
    return updatedAchievement;
  }

  deleteAchievement(id) {
    return this.achievements.delete(id);
  }

  // Payout operations
  async getPayoutRows(league, season) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getPayoutRows(league, season);
    }
    
    await this.ensureInitialized();
    return Array.from(this.payoutRows.values()).filter(row => {
      return (!league || row.league === league) && (!season || row.season === season);
    });
  }

  createPayoutRow(payoutData) {
    const id = uuidv4();
    const payout = {
      ...payoutData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.payoutRows.set(id, payout);
    return payout;
  }

  updatePayoutRow(id, updateData) {
    const payout = this.payoutRows.get(id);
    if (!payout) return null;
    
    const updatedPayout = {
      ...payout,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.payoutRows.set(id, updatedPayout);
    return updatedPayout;
  }

  deletePayoutRow(id) {
    return this.payoutRows.delete(id);
  }

  // League Settings operations
  async getLeagueSettings(league, season) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getLeagueSettings(league, season);
    }
    
    await this.ensureInitialized();
    return Array.from(this.leagueSettings.values()).find(setting => {
      return setting.league === league && setting.season === season;
    });
  }

  createLeagueSettings(settingsData) {
    const id = uuidv4();
    const settings = {
      ...settingsData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.leagueSettings.set(id, settings);
    return settings;
  }

  updateLeagueSettings(id, updateData) {
    const settings = this.leagueSettings.get(id);
    if (!settings) return null;
    
    const updatedSettings = {
      ...settings,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.leagueSettings.set(id, updatedSettings);
    return updatedSettings;
  }

  deleteLeagueSettings(id) {
    return this.leagueSettings.delete(id);
  }

  // Team Mapping operations
  async getTeamMappings(league, season) {
    await this.ensureInitialized();
    return Array.from(this.teamMappings.values()).filter(mapping => {
      return (!league || mapping.league === league) && (!season || mapping.season === season);
    });
  }

  getTeamMapping(id) {
    return this.teamMappings.get(id);
  }

  getTeamMappingByCfbdId(cfbdId) {
    return Array.from(this.teamMappings.values()).find(mapping => mapping.cfbdId === cfbdId);
  }

  getTeamMappingByOddsApiName(oddsApiName) {
    return Array.from(this.teamMappings.values()).find(mapping => mapping.oddsApiName === oddsApiName);
  }

  createTeamMapping(mappingData) {
    const id = uuidv4();
    const mapping = {
      ...mappingData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.teamMappings.set(id, mapping);
    
    // Save the datastore to persist the new mapping
    this.saveDataStore();
    
    return mapping;
  }

  updateTeamMapping(id, updateData) {
    const mapping = this.teamMappings.get(id);
    if (!mapping) return null;
    
    const updatedMapping = {
      ...mapping,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.teamMappings.set(id, updatedMapping);
    return updatedMapping;
  }

  deleteTeamMapping(id) {
    return this.teamMappings.delete(id);
  }

  // Populate NCAA teams using the mapping table
  async populateNcaaTeamsFromMapping() {
    console.log('🏈 Populating NCAA teams from mapping table...');
    
    // Get all team mappings for NCAA 2025
    const mappings = Array.from(this.teamMappings.values()).filter(mapping => 
      mapping.league === 'ncaa' && mapping.season === '2025'
    );
    
    if (mappings.length === 0) {
      console.log('⚠️  No team mappings found for NCAA 2025. Creating default mappings...');
      await this.createDefaultNcaaMappings();
      return;
    }
    
    console.log(`📊 Found ${mappings.length} team mappings for NCAA 2025`);
    
    // Remove any existing NCAA teams to prevent duplicates
    const existingNcaaTeams = Array.from(this.teams.entries()).filter(([id, team]) => 
      team.league === 'NCAA' && team.season === '2025'
    );
    
    if (existingNcaaTeams.length > 0) {
      console.log(`🧹 Removing ${existingNcaaTeams.length} existing NCAA teams to prevent duplicates`);
      existingNcaaTeams.forEach(([id]) => {
        this.teams.delete(id);
      });
    }
    
    // Create teams from mappings
    let createdCount = 0;
    for (const mapping of mappings) {
      const teamData = this.standardizeTeam({
        name: mapping.cfbdName,
        division: mapping.cfbdConference || 'FBS',
        league: 'NCAA',
        season: '2025',
        owner: null, // Will be set during draft
        odds: mapping.oddsApiOdds || null
      });
      this.teams.set(teamData.id, teamData);
      createdCount++;
    }
    
    console.log(`✅ Created ${createdCount} NCAA teams from mappings`);
  }

  // Create default NCAA mappings if none exist
  async createDefaultNcaaMappings() {
    console.log('🏈 Creating default NCAA team mappings...');
    
    // Note: Mappings should be created manually using the population scripts
    // This is just a fallback for basic functionality
    const defaultMappings = [
      { cfbdId: 333, cfbdName: 'Alabama', cfbdMascot: 'Crimson Tide', cfbdConference: 'SEC', cfbdAbbreviation: 'ALA', oddsApiName: 'Alabama', oddsApiOdds: '+600', league: 'ncaa', season: '2025', matchType: 'default' },
      { cfbdId: 59, cfbdName: 'Georgia', cfbdMascot: 'Bulldogs', cfbdConference: 'SEC', cfbdAbbreviation: 'UGA', oddsApiName: 'Georgia', oddsApiOdds: '+700', league: 'ncaa', season: '2025', matchType: 'default' },
      { cfbdId: 194, cfbdName: 'Ohio State', cfbdMascot: 'Buckeyes', cfbdConference: 'Big Ten', cfbdAbbreviation: 'OSU', oddsApiName: 'Ohio State', oddsApiOdds: '+800', league: 'ncaa', season: '2025', matchType: 'default' },
      { cfbdId: 130, cfbdName: 'Michigan', cfbdMascot: 'Wolverines', cfbdConference: 'Big Ten', cfbdAbbreviation: 'MICH', oddsApiName: 'Michigan', oddsApiOdds: '+1000', league: 'ncaa', season: '2025', matchType: 'default' },
      { cfbdId: 251, cfbdName: 'Texas', cfbdMascot: 'Longhorns', cfbdConference: 'SEC', cfbdAbbreviation: 'TEX', oddsApiName: 'Texas', oddsApiOdds: '+1200', league: 'ncaa', season: '2025', matchType: 'default' }
    ];
    
    for (const mapping of defaultMappings) {
      this.createTeamMapping(mapping);
    }
    
    console.log(`✅ Created ${defaultMappings.length} default NCAA mappings`);
    console.log('💡 For full NCAA team population, run: npm run populate-ncaa-with-mapping');
  }

  // Draft Pick operations
  async getDraftPicks(league, season) {
    console.log('🔍 getDraftPicks called with:', { league, season });
    
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      const picks = await dynamoDBAdapter.getDraftPicks(league, season);
      // Sort by pick number
      return picks.sort((a, b) => a.pickNumber - b.pickNumber);
    }
    
    if (!this.initialized) {
      console.log('⏳ Initializing data...');
      await this.initializeData();
    }
    const picks = Array.from(this.draftPicks.values()).filter(pick => {
      return pick.league === league && pick.season === season;
    }).sort((a, b) => a.pickNumber - b.pickNumber);
    console.log(`✅ getDraftPicks returning ${picks.length} picks`);
    return picks;
  }

  async getDraftPick(id) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.getDraftPick(id);
    }
    
    return this.draftPicks.get(id);
  }

  async createDraftPick(pickData) {
    const id = uuidv4();
    const pick = {
      ...pickData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.createDraftPick(pick);
    }
    
    this.draftPicks.set(id, pick);
    this.saveDataStore();
    return pick;
  }

  async updateDraftPick(id, updateData) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.updateDraftPick(id, updateData);
    }
    
    const pick = this.draftPicks.get(id);
    if (!pick) return null;
    
    const updatedPick = {
      ...pick,
      ...updateData,
      id,
      updatedAt: new Date().toISOString()
    };
    this.draftPicks.set(id, updatedPick);
    this.saveDataStore();
    return updatedPick;
  }

  async deleteDraftPick(id) {
    // Use DynamoDB if enabled
    if (USE_DYNAMODB && dynamoDBAdapter) {
      return await dynamoDBAdapter.deleteDraftPick(id);
    }
    
    return this.draftPicks.delete(id);
  }

  // Initialize draft with snake draft order
  async initializeDraft(league, season, owners) {
    // Clear existing picks for this league/season
    let existingPicks = [];
    if (USE_DYNAMODB && dynamoDBAdapter) {
      existingPicks = await dynamoDBAdapter.getDraftPicks(league, season);
      // Delete existing picks
      for (const pick of existingPicks) {
        await dynamoDBAdapter.deleteDraftPick(pick.id);
      }
    } else {
      existingPicks = Array.from(this.draftPicks.values()).filter(pick => 
        pick.league === league && pick.season === season
      );
      existingPicks.forEach(pick => {
        this.draftPicks.delete(pick.id);
      });
    }
    
    const picks = [];
    // Determine total rounds based on league
    let totalRounds;
    if (league === 'nfl') {
      totalRounds = 8; // 32 teams ÷ 4 owners = 8 rounds
    } else if (league === 'mlb') {
      totalRounds = 8; // 30 teams ÷ 4 owners = 7.5, round up to 8
    } else if (league === 'ncaa') {
      totalRounds = 12; // Keep existing for NCAA
    } else {
      totalRounds = 12; // Default fallback
    }
    
    console.log(`🏈 Initializing ${league} draft with ${totalRounds} rounds for ${owners.length} owners`);
    
    for (let round = 1; round <= totalRounds; round++) {
      const isReverseRound = round % 2 === 0; // Even rounds go in reverse order
      const roundOwners = isReverseRound ? [...owners].reverse() : [...owners];
      
      for (const owner of roundOwners) {
        const pickNumber = picks.length + 1;
        const pick = await this.createDraftPick({
          league,
          season,
          round,
          pickNumber,
          owner,
          teamId: null,
          teamName: null
        });
        picks.push(pick);
      }
    }
    
    if (!USE_DYNAMODB) {
      this.saveDataStore();
    }
    
    return picks;
  }

  // Reorder draft picks with new owner order (only if no teams have been drafted)
  async reorderDraftPicks(league, season, owners) {
    console.log('🔄 Reordering draft picks for:', { league, season, owners });
    
    // Get existing picks for this league/season
    let existingPicks = [];
    if (USE_DYNAMODB && dynamoDBAdapter) {
      existingPicks = await dynamoDBAdapter.getDraftPicks(league, season);
    } else {
      existingPicks = Array.from(this.draftPicks.values()).filter(pick => 
        pick.league === league && pick.season === season
      );
    }
    
    // Check if any teams have been drafted (have teamId)
    const hasDraftedTeams = existingPicks.some(pick => pick.teamId);
    if (hasDraftedTeams) {
      throw new Error('Cannot reorder draft after teams have been selected');
    }
    
    // Clear existing picks
    if (USE_DYNAMODB && dynamoDBAdapter) {
      for (const pick of existingPicks) {
        await dynamoDBAdapter.deleteDraftPick(pick.id);
      }
    } else {
      existingPicks.forEach(pick => {
        this.draftPicks.delete(pick.id);
      });
    }
    
    // Create new picks with the new owner order
    const picks = [];
    // Determine total rounds based on league (same logic as initializeDraft)
    let totalRounds;
    if (league === 'nfl') {
      totalRounds = 8; // 32 teams ÷ 4 owners = 8 rounds
    } else if (league === 'mlb') {
      totalRounds = 8; // 30 teams ÷ 4 owners = 7.5, round up to 8
    } else if (league === 'ncaa') {
      totalRounds = 12; // Keep existing for NCAA
    } else {
      totalRounds = 12; // Default fallback
    }
    
    for (let round = 1; round <= totalRounds; round++) {
      const isReverseRound = round % 2 === 0; // Even rounds go in reverse order
      const roundOwners = isReverseRound ? [...owners].reverse() : [...owners];
      
      for (const owner of roundOwners) {
        const pickNumber = picks.length + 1;
        const pick = await this.createDraftPick({
          league,
          season,
          round,
          pickNumber,
          owner,
          teamId: null,
          teamName: null
        });
        picks.push(pick);
      }
    }
    
    console.log(`✅ Reordered draft: ${picks.length} picks created with new order`);
    if (!USE_DYNAMODB) {
      this.saveDataStore();
    }
    
    return picks;
  }

  // Owner operations
  getAllOwners() {
    return Array.from(this.owners.values());
  }

  getOwner(id) {
    return this.owners.get(id);
  }

  // Persistence methods
  async saveDataStore() {
    // Only save if already initialized to prevent infinite loops
    if (!this.initialized) {
      return;
    }
    
    // Debounce saves to prevent excessive file writes
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
      try {
        // Ensure data directory exists
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        const dataToSave = {
          teams: Array.from(this.teams.values()),
          achievements: Array.from(this.achievements.values()),
          payoutRows: Array.from(this.payoutRows.values()),
          leagueSettings: Array.from(this.leagueSettings.values()),
          teamMappings: Array.from(this.teamMappings.values()),
          draftPicks: Array.from(this.draftPicks.values()),
          owners: Array.from(this.owners.values())
        };
        
        await fs.writeFile(DATASTORE_FILE, JSON.stringify(dataToSave, null, 2));
        console.log('💾 DataStore saved to file');
      } catch (error) {
        console.error('❌ Error saving DataStore:', error);
      }
    }, 1000); // Debounce for 1 second
  }

  async loadDataStore() {
    try {
      const data = await fs.readFile(DATASTORE_FILE, 'utf8');
      const savedData = JSON.parse(data);
      
      // Load teams
      if (savedData.teams) {
        this.teams.clear();
        savedData.teams.forEach(team => {
          this.teams.set(team.id, team);
        });
      }
      
      // Load achievements
      if (savedData.achievements) {
        this.achievements.clear();
        savedData.achievements.forEach(achievement => {
          this.achievements.set(achievement.id, achievement);
        });
      }
      
      // Load payout rows
      if (savedData.payoutRows) {
        this.payoutRows.clear();
        savedData.payoutRows.forEach(row => {
          this.payoutRows.set(row.id, row);
        });
      }
      
      // Load league settings
      if (savedData.leagueSettings) {
        this.leagueSettings.clear();
        savedData.leagueSettings.forEach(setting => {
          this.leagueSettings.set(setting.id, setting);
        });
      }
      
      // Load team mappings
      if (savedData.teamMappings) {
        this.teamMappings.clear();
        savedData.teamMappings.forEach(mapping => {
          this.teamMappings.set(mapping.id, mapping);
        });
      }
      
      // Load draft picks
      if (savedData.draftPicks) {
        this.draftPicks.clear();
        savedData.draftPicks.forEach(pick => {
          this.draftPicks.set(pick.id, pick);
        });
      }
      
      // Load owners
      if (savedData.owners) {
        this.owners.clear();
        savedData.owners.forEach(owner => {
          this.owners.set(owner.id, owner);
        });
      }
      
      console.log(`📂 Loaded DataStore from file: ${savedData.teams?.length || 0} teams, ${savedData.draftPicks?.length || 0} draft picks`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📂 No existing DataStore file found, starting fresh');
      } else {
        console.error('❌ Error loading DataStore:', error);
      }
    }
  }
}

// Singleton instance
const dataStore = new DataStore();

export { dataStore };

export { dataStore };
