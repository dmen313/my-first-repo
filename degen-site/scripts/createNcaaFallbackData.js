const fs = require('fs');
const path = require('path');

// NCAA Football fallback data
const ncaaTeams = [
  { name: "Alabama", odds: "+500" },
  { name: "Georgia", odds: "+600" },
  { name: "Ohio State", odds: "+800" },
  { name: "Michigan", odds: "+1000" },
  { name: "Texas", odds: "+1200" },
  { name: "Oregon", odds: "+1500" },
  { name: "LSU", odds: "+1800" },
  { name: "Penn State", odds: "+2000" },
  { name: "Oklahoma", odds: "+2500" },
  { name: "Notre Dame", odds: "+3000" },
  { name: "Florida State", odds: "+3500" },
  { name: "USC", odds: "+4000" },
  { name: "Clemson", odds: "+4500" },
  { name: "Tennessee", odds: "+5000" },
  { name: "Auburn", odds: "+5500" },
  { name: "Texas A&M", odds: "+6000" },
  { name: "Wisconsin", odds: "+6500" },
  { name: "Iowa", odds: "+7000" },
  { name: "Utah", odds: "+7500" },
  { name: "Ole Miss", odds: "+8000" },
  { name: "Arkansas", odds: "+8500" },
  { name: "Kentucky", odds: "+9000" },
  { name: "Missouri", odds: "+9500" },
  { name: "South Carolina", odds: "+10000" },
  { name: "Mississippi State", odds: "+11000" },
  { name: "Vanderbilt", odds: "+12000" },
  { name: "Indiana", odds: "+13000" },
  { name: "Purdue", odds: "+14000" },
  { name: "Illinois", odds: "+15000" },
  { name: "Minnesota", odds: "+16000" },
  { name: "Nebraska", odds: "+17000" },
  { name: "Northwestern", odds: "+18000" },
  { name: "Michigan State", odds: "+19000" },
  { name: "Maryland", odds: "+20000" },
  { name: "Rutgers", odds: "+25000" }
];

const ncaaData = {
  teams: ncaaTeams.map((team, index) => ({
    id: `ncaa-${team.name.toLowerCase().replace(/\s+/g, '-')}`,
    name: team.name,
    record: "0-0",
    league: "NCAA",
    division: "FBS",
    wins: 0,
    losses: 0,
    gamesBack: "0",
    wildCardGamesBack: "0",
    owner: "NA",
    odds: team.odds
  })),
  playoffFormat: {
    description: "NCAA Football Playoff Format 2025",
    teams: 12,
    structure: {
      "First Round": 8,
      "Quarterfinals": 8,
      "Semifinals": 4,
      "Championship": 2
    }
  },
  payoutStructure: [
    {
      id: "ncaa-championship-winner",
      level: "Win Championship",
      teams: 1,
      percentage: 10,
      description: "Team that wins the NCAA Championship"
    },
    {
      id: "ncaa-championship-runner-up",
      level: "Make Championship",
      teams: 2,
      percentage: 30,
      description: "Teams that make it to the championship game"
    },
    {
      id: "ncaa-semifinals",
      level: "Make Semifinals",
      teams: 4,
      percentage: 25,
      description: "Teams that make it to the semifinals"
    },
    {
      id: "ncaa-quarterfinals",
      level: "Make Quarterfinals",
      teams: 8,
      percentage: 20,
      description: "Teams that make it to the quarterfinals"
    },
    {
      id: "ncaa-playoffs",
      level: "Make Playoffs",
      teams: 12,
      percentage: 15,
      description: "All teams that make the playoffs"
    }
  ]
};

// Write to file
const outputPath = path.join(__dirname, '../src/ncaaData.js');
const content = `// NCAA Football teams data
export const ncaaTeams = ${JSON.stringify(ncaaData.teams, null, 2)};

// NCAA playoff format information
export const ncaaPlayoffFormat = ${JSON.stringify(ncaaData.playoffFormat, null, 2)};

// NCAA-specific payout structure
export const ncaaPayoutStructure = ${JSON.stringify(ncaaData.payoutStructure, null, 2)};
`;

fs.writeFileSync(outputPath, content);
console.log('✅ NCAA fallback data created successfully!');
console.log(`📁 File: ${outputPath}`);
console.log(`🏈 Teams: ${ncaaData.teams.length}`);






