import React, { useState, useEffect } from 'react';
import { useLeagueData } from '../hooks/useGraphQL';
import './TeamOwners.css';

const TeamOwners = () => {
  const [selectedLeague, setSelectedLeague] = useState('mlb-2025');
  const [ownersData, setOwnersData] = useState({});
  const [summaryStats, setSummaryStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Get teams data from GraphQL
  const { teams, loading: teamsLoading } = useLeagueData(selectedLeague);

  // Owner abbreviations and full names - using useMemo to prevent recreation on every render
  const ownerInfo = React.useMemo(() => ({
    'TG': 'Trev G',
    'KH': 'Kevin H',
    'DM': 'Dev M',
    'MC': 'Mike C',
    'No Owner': 'No Owner'
  }), []);

  // Owner colors for CSS classes
  const getOwnerClass = (owner) => {
    switch (owner) {
      case 'TG': return 'owner-tg';
      case 'KH': return 'owner-kh';
      case 'DM': return 'owner-dm';
      case 'MC': return 'owner-mc';
      case 'No Owner': return 'owner-none';
      default: return 'owner-other';
    }
  };

  // Process teams data to group by owner
  useEffect(() => {
    if (!teamsLoading && teams.length > 0) {
      const owners = {};
      const stats = {
        totalTeams: teams.length,
        totalWins: 0,
        totalLosses: 0,
        averageWinPercentage: 0
      };

      // Group teams by owner
      teams.forEach(team => {
        const owner = team.owner || 'No Owner';
        if (!owners[owner]) {
          owners[owner] = {
            name: ownerInfo[owner] || owner,
            abbreviation: owner,
            teams: []
          };
        }
        owners[owner].teams.push(team);

        // Calculate stats
        if (team.wins && team.losses) {
          stats.totalWins += team.wins;
          stats.totalLosses += team.losses;
        }
      });

      // Calculate average win percentage
      if (stats.totalWins + stats.totalLosses > 0) {
        stats.averageWinPercentage = ((stats.totalWins / (stats.totalWins + stats.totalLosses)) * 100).toFixed(1);
      }

      setOwnersData(owners);
      setSummaryStats(stats);
      setLoading(false);
    }
  }, [teams, teamsLoading, ownerInfo]);

  // Handle league change
  const handleLeagueChange = (leagueId) => {
    setSelectedLeague(leagueId);
    setLoading(true);
  };

  if (loading || teamsLoading) {
    return (
      <div className="team-owners-container">
        <div className="loading">Loading team owners data...</div>
      </div>
    );
  }



  return (
    <div className="team-owners-container">
      <h2>Team Owners</h2>
      <p className="page-description">
        View all team owners and their assigned teams across different leagues.
      </p>

      {/* League Selector */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <select 
          value={selectedLeague} 
          onChange={(e) => handleLeagueChange(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #ddd',
            fontSize: '1rem'
          }}
        >
          <option value="mlb-2024">MLB 2024</option>
          <option value="mlb-2025">MLB 2025</option>
          <option value="nba-2024">NBA 2024</option>
          <option value="nba-2025">NBA 2025</option>
          <option value="nfl-2025">NFL 2025</option>
          <option value="ncaa-2025">NCAA Football 2025</option>
        </select>
      </div>

      {/* Summary Statistics */}
      <div className="summary-stats">
        <h3>League Summary</h3>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Teams:</span>
            <span className="stat-value">{summaryStats.totalTeams}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Wins:</span>
            <span className="stat-value">{summaryStats.totalWins}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Losses:</span>
            <span className="stat-value">{summaryStats.totalLosses}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Win %:</span>
            <span className="stat-value">{summaryStats.averageWinPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Owners Grid */}
      <div className="owners-grid">
        {Object.entries(ownersData).map(([ownerAbbr, ownerData]) => (
          <div key={ownerAbbr} className={`owner-section ${getOwnerClass(ownerAbbr)}`}>
            <div className="owner-name">
              {ownerData.name}
              <span className="team-count">{ownerData.teams.length} teams</span>
            </div>
            
            <div className="teams-list">
              {ownerData.teams.map(team => (
                <div key={team.id} className="team-item">
                  <div className="team-info">
                    <div className="team-name">{team.name}</div>
                    <div className="team-details">
                      {team.division} • {team.league}
                    </div>
                  </div>
                  <div className="team-record">
                    {team.record}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TeamOwners;
