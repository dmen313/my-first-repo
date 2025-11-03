import React from 'react';
import './MLBTracker.css';

const MLBTracker = ({ teams, selectedDivision, setSelectedDivision, divisions }) => {
  const getLeagueStats = () => {
    const americanLeague = teams.filter(team => team.league === 'American League');
    const nationalLeague = teams.filter(team => team.league === 'National League');
    
    const alStats = {
      totalTeams: americanLeague.length,
      totalWins: americanLeague.reduce((sum, team) => sum + team.wins, 0),
      totalLosses: americanLeague.reduce((sum, team) => sum + team.losses, 0),
      avgWinPct: americanLeague.length > 0 
        ? (americanLeague.reduce((sum, team) => sum + parseFloat(team.winPercentage), 0) / americanLeague.length).toFixed(3)
        : '0.000'
    };
    
    const nlStats = {
      totalTeams: nationalLeague.length,
      totalWins: nationalLeague.reduce((sum, team) => sum + team.wins, 0),
      totalLosses: nationalLeague.reduce((sum, team) => sum + team.losses, 0),
      avgWinPct: nationalLeague.length > 0 
        ? (nationalLeague.reduce((sum, team) => sum + parseFloat(team.winPercentage), 0) / nationalLeague.length).toFixed(3)
        : '0.000'
    };
    
    return { alStats, nlStats };
  };

  const getTopTeams = () => {
    const sortedTeams = [...teams].sort((a, b) => {
      const aWinPct = parseFloat(a.winPercentage);
      const bWinPct = parseFloat(b.winPercentage);
      return bWinPct - aWinPct;
    });
    
    return sortedTeams.slice(0, 5);
  };

  const getDivisionStats = () => {
    const divisionStats = {};
    
    teams.forEach(team => {
      if (!divisionStats[team.division]) {
        divisionStats[team.division] = {
          teams: [],
          totalWins: 0,
          totalLosses: 0
        };
      }
      
      divisionStats[team.division].teams.push(team);
      divisionStats[team.division].totalWins += team.wins;
      divisionStats[team.division].totalLosses += team.losses;
    });
    
    return divisionStats;
  };

  const { alStats, nlStats } = getLeagueStats();
  const topTeams = getTopTeams();
  const divisionStats = getDivisionStats();

  return (
    <div className="mlb-tracker">
      <div className="tracker-header">
        <h2>MLB Season Overview</h2>
        <p>Real-time statistics and standings</p>
      </div>
      
      <div className="league-overview">
        <div className="league-card al">
          <h3>American League</h3>
          <div className="league-stats">
            <div className="stat">
              <span className="label">Teams:</span>
              <span className="value">{alStats.totalTeams}</span>
            </div>
            <div className="stat">
              <span className="label">Total Wins:</span>
              <span className="value">{alStats.totalWins}</span>
            </div>
            <div className="stat">
              <span className="label">Total Losses:</span>
              <span className="value">{alStats.totalLosses}</span>
            </div>
            <div className="stat">
              <span className="label">Avg Win %:</span>
              <span className="value">{alStats.avgWinPct}</span>
            </div>
          </div>
        </div>
        
        <div className="league-card nl">
          <h3>National League</h3>
          <div className="league-stats">
            <div className="stat">
              <span className="label">Teams:</span>
              <span className="value">{nlStats.totalTeams}</span>
            </div>
            <div className="stat">
              <span className="label">Total Wins:</span>
              <span className="value">{nlStats.totalWins}</span>
            </div>
            <div className="stat">
              <span className="label">Total Losses:</span>
              <span className="value">{nlStats.totalLosses}</span>
            </div>
            <div className="stat">
              <span className="label">Avg Win %:</span>
              <span className="value">{nlStats.avgWinPct}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="top-teams">
        <h3>Top 5 Teams by Win Percentage</h3>
        <div className="top-teams-list">
          {topTeams.map((team, index) => (
            <div key={team.id} className="top-team-item">
              <span className="rank">#{index + 1}</span>
              <span className="team-name">{team.name}</span>
              <span className="record">{team.wins}-{team.losses}</span>
              <span className="win-pct">{parseFloat(team.winPercentage).toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="division-breakdown">
        <h3>Division Breakdown</h3>
        <div className="divisions-grid">
          {Object.entries(divisionStats).map(([division, stats]) => (
            <div key={division} className="division-card">
              <h4>{division}</h4>
              <div className="division-stats">
                <div className="stat">
                  <span className="label">Teams:</span>
                  <span className="value">{stats.teams.length}</span>
                </div>
                <div className="stat">
                  <span className="label">Wins:</span>
                  <span className="value">{stats.totalWins}</span>
                </div>
                <div className="stat">
                  <span className="label">Losses:</span>
                  <span className="value">{stats.totalLosses}</span>
                </div>
                <div className="stat">
                  <span className="label">Win %:</span>
                  <span className="value">
                    {stats.totalWins + stats.totalLosses > 0 
                      ? ((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1) + '%'
                      : '0.0%'
                    }
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MLBTracker;
