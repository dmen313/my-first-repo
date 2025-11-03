# GraphQL Setup Guide

This project now includes a GraphQL-like setup that mimics AWS AppSync functionality for storing and retrieving sports data.

## 🚀 Quick Start

### 1. Start the GraphQL Server

```bash
# Start GraphQL server only
npm run graphql:start

# Start both GraphQL server and React app
npm run dev

# Open GraphQL Playground
npm run graphql:playground
```

### 2. GraphQL Endpoints

- **Server**: http://localhost:4000/graphql
- **Playground**: http://localhost:4000/graphql (interactive query interface)

## 📋 Schema Overview

### Types

- **Team**: Individual team data (name, record, owner, achievements)
- **Achievement**: Team achievements (playoffs, championships, etc.)
- **PayoutRow**: Payout structure configuration
- **Owner**: Owner information and statistics

### Key Queries

```graphql
# Get all teams for a league/season
query GetTeams($league: String, $season: String) {
  getTeams(league: $league, season: $season) {
    id
    name
    record
    owner
    achievements {
      achievementType
      achieved
    }
  }
}

# Get payout structure
query GetPayoutRows($league: String!, $season: String!) {
  getPayoutRows(league: $league, season: $season) {
    level
    teams
    percentage
  }
}
```

### Key Mutations

```graphql
# Update team achievements
mutation UpdateTeamAchievements($teamId: ID!, $achievements: [AchievementInput!]!) {
  updateTeamAchievements(teamId: $teamId, achievements: $achievements) {
    id
    achievementType
    achieved
  }
}

# Update team data
mutation UpdateTeam($input: UpdateTeamInput!) {
  updateTeam(input: $input) {
    id
    name
    record
    owner
  }
}
```

## 🔧 Integration Examples

### Using React Hooks

```javascript
import { useLeagueData } from '../hooks/useGraphQL';

const MyComponent = ({ leagueId }) => {
  const {
    teams,
    payoutRows,
    achievements,
    loading,
    updateTeamAchievement,
    getTeamAchievement
  } = useLeagueData(leagueId);

  const handleAchievementChange = async (teamId, achievementType, achieved) => {
    try {
      await updateTeamAchievement(teamId, achievementType, achieved);
    } catch (error) {
      console.error('Failed to update achievement:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {teams.map(team => (
        <div key={team.id}>
          <h3>{team.name}</h3>
          <p>Owner: {team.owner}</p>
          <p>Record: {team.record}</p>
        </div>
      ))}
    </div>
  );
};
```

### Direct Client Usage

```javascript
import { client, fetchTeamsByLeague } from '../graphql/client';

// Fetch teams
const teams = await fetchTeamsByLeague('mlb', '2025');

// Direct query
const { data } = await client.query({
  query: GET_TEAMS,
  variables: { league: 'nba', season: '2024' }
});
```

## 🏗️ Architecture

### Data Flow

1. **Data Store**: In-memory storage with Maps for teams, achievements, payouts
2. **GraphQL Layer**: Schema, resolvers, and server setup
3. **React Integration**: Hooks and components for seamless data management
4. **Real-time Updates**: Optimistic UI updates with GraphQL sync

### File Structure

```
src/
├── graphql/
│   ├── schema.js          # GraphQL type definitions
│   ├── resolvers.js       # Query/mutation resolvers
│   ├── dataStore.js       # In-memory data storage
│   ├── server.js          # Apollo Server setup
│   └── client.js          # Apollo Client setup
├── hooks/
│   └── useGraphQL.js      # React hooks for GraphQL
├── components/
│   └── GraphQLTeamTable.js # Example GraphQL-enabled component
└── scripts/
    └── startGraphQLServer.js # Server startup script
```

## 🔄 Data Persistence

Currently using **in-memory storage** for simplicity. To add persistence:

### Option 1: Local File Storage
```javascript
// In dataStore.js
saveToFile() {
  const data = {
    teams: Array.from(this.teams.entries()),
    achievements: Array.from(this.achievements.entries()),
    payoutRows: Array.from(this.payoutRows.entries())
  };
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}
```

### Option 2: Database Integration
```javascript
// Replace Maps with database calls
async getTeam(id) {
  return await db.teams.findById(id);
}

async createTeam(teamData) {
  return await db.teams.create(teamData);
}
```

### Option 3: AWS DynamoDB (AppSync-like)
```javascript
import AWS from 'aws-sdk';

const dynamodb = new AWS.DynamoDB.DocumentClient();

async getTeam(id) {
  const result = await dynamodb.get({
    TableName: 'Teams',
    Key: { id }
  }).promise();
  return result.Item;
}
```

## 🎯 Features

- ✅ **Full CRUD operations** for teams, achievements, and payouts
- ✅ **Real-time updates** with optimistic UI
- ✅ **GraphQL Playground** for testing queries
- ✅ **React hooks** for easy component integration
- ✅ **Type-safe schema** with input validation
- ✅ **Flexible querying** by league, season, owner
- ✅ **Bulk operations** for efficiency
- ✅ **Error handling** and rollback support

## 🚀 Next Steps

1. **Add Authentication**: Implement user-based access control
2. **Add Subscriptions**: Real-time updates across clients
3. **Add Persistence**: Connect to a real database
4. **Add Caching**: Implement Redis or similar for performance
5. **Add Validation**: Enhanced input validation and sanitization
6. **Deploy**: Set up production GraphQL endpoint

## 🧪 Testing Queries

Visit http://localhost:4000/graphql and try these queries:

```graphql
# Get all MLB teams
{
  getTeams(league: "mlb", season: "2025") {
    id
    name
    owner
    record
  }
}

# Get NBA payout structure
{
  getPayoutRows(league: "nba", season: "2024") {
    level
    teams
    percentage
  }
}

# Get all owners with their teams
{
  getOwners {
    abbreviation
    totalAchievements
    teams {
      name
      league
    }
  }
}
```
