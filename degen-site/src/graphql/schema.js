import { gql } from 'apollo-server-express';

const typeDefs = gql`
  type Team {
    id: ID!
    name: String!
    record: String!
    league: String!
    division: String!
    wins: Int!
    losses: Int!
    gamesBack: String
    wildCardGamesBack: String
    owner: String
    odds: String
    season: String
    achievements: [Achievement!]!
    createdAt: String!
    updatedAt: String!
  }

  type Achievement {
    id: ID!
    teamId: ID!
    achievementType: String!
    achieved: Boolean!
    season: String!
    league: String!
    createdAt: String!
    updatedAt: String!
  }

  type PayoutRow {
    id: ID!
    league: String!
    season: String!
    level: String!
    teams: Int!
    percentage: Float!
    createdAt: String!
    updatedAt: String!
  }

  type LeagueSettings {
    id: ID!
    league: String!
    season: String!
    buyInPerTeam: Float!
    numTeams: Int!
    totalPool: Float!
    createdAt: String!
    updatedAt: String!
  }

  type TeamMapping {
    id: ID!
    cfbdId: Int!
    cfbdName: String!
    cfbdMascot: String
    cfbdConference: String
    cfbdAbbreviation: String
    oddsApiName: String!
    oddsApiOdds: String
    league: String!
    season: String!
    matchType: String!
    createdAt: String!
    updatedAt: String!
  }

  type Owner {
    id: ID!
    name: String!
    abbreviation: String!
    teams: [Team!]!
    totalAchievements: Int!
    createdAt: String!
    updatedAt: String!
  }

  type DraftPick {
    id: ID!
    league: String!
    season: String!
    round: Int!
    pickNumber: Int!
    owner: String!
    teamId: ID
    teamName: String
    createdAt: String!
    updatedAt: String!
  }

  input TeamInput {
    name: String!
    record: String!
    league: String!
    division: String!
    wins: Int!
    losses: Int!
    gamesBack: String
    wildCardGamesBack: String
    owner: String
    odds: String
    season: String
  }

  input UpdateTeamInput {
    id: ID!
    name: String
    record: String
    league: String
    division: String
    wins: Int
    losses: Int
    gamesBack: String
    wildCardGamesBack: String
    owner: String
    odds: String
    season: String
  }

  input AchievementInput {
    teamId: ID!
    achievementType: String!
    achieved: Boolean!
    season: String!
    league: String!
  }

  input UpdateAchievementInput {
    id: ID!
    achieved: Boolean!
  }

  input PayoutRowInput {
    league: String
    season: String
    level: String
    teams: Int
    percentage: Float
  }

  input LeagueSettingsInput {
    league: String!
    season: String!
    buyInPerTeam: Float!
    numTeams: Int!
    totalPool: Float!
  }

  input UpdateLeagueSettingsInput {
    id: ID!
    buyInPerTeam: Float
    numTeams: Int
    totalPool: Float
  }

  input TeamMappingInput {
    cfbdId: Int!
    cfbdName: String!
    cfbdMascot: String
    cfbdConference: String
    cfbdAbbreviation: String
    oddsApiName: String!
    oddsApiOdds: String
    league: String!
    season: String!
    matchType: String!
  }

  input UpdateTeamMappingInput {
    id: ID!
    cfbdId: Int
    cfbdName: String
    cfbdMascot: String
    cfbdConference: String
    cfbdAbbreviation: String
    oddsApiName: String
    oddsApiOdds: String
    matchType: String
  }

  input DraftPickInput {
    league: String!
    season: String!
    round: Int!
    pickNumber: Int!
    owner: String!
    teamId: ID
    teamName: String
  }

  input UpdateDraftPickInput {
    id: ID!
    teamId: ID
    teamName: String
  }

  input TeamApiDataInput {
    record: String
    wins: Int
    losses: Int
    gamesBack: String
    wildCardGamesBack: String
    odds: String
  }

  type CfbdRecord {
    team: String!
    wins: Int!
    losses: Int!
    record: String!
  }

  type Query {
    # Teams
    getTeams(league: String, season: String): [Team!]!
    getTeam(id: ID!): Team
    getTeamsByOwner(owner: String!): [Team!]!
    
    # Achievements
    getAchievements(teamId: ID, league: String, season: String): [Achievement!]!
    getAchievement(id: ID!): Achievement
    
    # Payout Structure
    getPayoutRows(league: String!, season: String!): [PayoutRow!]!
    
    # League Settings
    getLeagueSettings(league: String!, season: String!): LeagueSettings
    
    # Team Mappings
    getTeamMappings(league: String, season: String): [TeamMapping!]!
    getTeamMapping(id: ID!): TeamMapping
    getTeamMappingByCfbdId(cfbdId: Int!): TeamMapping
    getTeamMappingByOddsApiName(oddsApiName: String!): TeamMapping
    
    # Owners
    getOwners: [Owner!]!
    getOwner(id: ID!): Owner
    
    # Draft
    getDraftPicks(league: String!, season: String!): [DraftPick!]!
    getDraftPick(id: ID!): DraftPick
    
    # External APIs
    getCfbdRecords(year: Int!): [CfbdRecord!]!
  }

  type Mutation {
    # Teams
    createTeam(input: TeamInput!): Team!
    updateTeam(input: UpdateTeamInput!): Team!
    updateTeamApiData(id: ID!, input: TeamApiDataInput!): Team!
    deleteTeam(id: ID!): Boolean!
    
    # Achievements
    createAchievement(input: AchievementInput!): Achievement!
    updateAchievement(input: UpdateAchievementInput!): Achievement!
    deleteAchievement(id: ID!): Boolean!
    
    # Bulk update achievements for a team
    updateTeamAchievements(teamId: ID!, achievements: [AchievementInput!]!): [Achievement!]!
    
    # Payout Structure
    createPayoutRow(input: PayoutRowInput!): PayoutRow!
    updatePayoutRow(id: ID!, input: PayoutRowInput!): PayoutRow!
    deletePayoutRow(id: ID!): Boolean!
    
    # League Settings
    createLeagueSettings(input: LeagueSettingsInput!): LeagueSettings!
    updateLeagueSettings(input: UpdateLeagueSettingsInput!): LeagueSettings!
    deleteLeagueSettings(id: ID!): Boolean!
    
    # Team Mappings
    createTeamMapping(input: TeamMappingInput!): TeamMapping!
    updateTeamMapping(input: UpdateTeamMappingInput!): TeamMapping!
    deleteTeamMapping(id: ID!): Boolean!
    
    # Draft
    createDraftPick(input: DraftPickInput!): DraftPick!
    updateDraftPick(input: UpdateDraftPickInput!): DraftPick!
    deleteDraftPick(id: ID!): Boolean!
    initializeDraft(league: String!, season: String!, owners: [String!]!): [DraftPick!]!
    reorderDraftPicks(league: String!, season: String!, owners: [String!]!): [DraftPick!]!
    
    # Bulk operations
    initializeLeagueData(league: String!, season: String!): Boolean!
    exportMappings: String!
  }

  type Subscription {
    teamUpdated(league: String): Team!
    achievementUpdated(teamId: ID): Achievement!
  }
`;

export { typeDefs };
