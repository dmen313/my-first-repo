import React from 'react';
import './TeamCard.css';

const TeamCard = ({ team }) => {
  const getTeamColor = (teamName) => {
    const teamColors = {
      'New York Yankees': '#003087',
      'Boston Red Sox': '#BD3039',
      'Toronto Blue Jays': '#134A8E',
      'Tampa Bay Rays': '#092C5C',
      'Baltimore Orioles': '#DF4601',
      'Cleveland Guardians': '#E31937',
      'Minnesota Twins': '#002B5C',
      'Detroit Tigers': '#0C2340',
      'Chicago White Sox': '#000000',
      'Kansas City Royals': '#174885',
      'Houston Astros': '#EB6E1F',
      'Texas Rangers': '#003278',
      'Los Angeles Angels': '#BA0021',
      'Oakland Athletics': '#003831',
      'Seattle Mariners': '#0C2C56',
      'Atlanta Braves': '#CE1141',
      'New York Mets': '#FF5910',
      'Philadelphia Phillies': '#E81828',
      'Washington Nationals': '#AB0003',
      'Miami Marlins': '#00A3E0',
      'St. Louis Cardinals': '#C41E3A',
      'Milwaukee Brewers': '#12284B',
      'Chicago Cubs': '#0E3386',
      'Cincinnati Reds': '#C6011F',
      'Pittsburgh Pirates': '#FDB827',
      'Los Angeles Dodgers': '#005A9C',
      'San Francisco Giants': '#FD5A1E',
      'San Diego Padres': '#2F241D',
      'Colorado Rockies': '#33006F',
      'Arizona Diamondbacks': '#A71930'
    };
    return teamColors[team.name] || '#666666';
  };

  const getWinPercentageColor = (winPct) => {
    const pct = parseFloat(winPct);
    if (pct >= 0.600) return '#28a745'; // Green for good records
    if (pct >= 0.500) return '#ffc107'; // Yellow for average records
    return '#dc3545'; // Red for below average records
  };

  const formatGamesBack = (gamesBack) => {
    if (gamesBack === '0.0' || gamesBack === 0) return '--';
    return gamesBack;
  };

  return (
    <div 
      className="team-card"
      style={{ borderLeftColor: getTeamColor(team.name) }}
    >
      <div className="team-header">
        <h3 className="team-name">{team.name}</h3>
        <span className="team-league">{team.league}</span>
      </div>
      
      <div className="team-division">
        <span className="division-badge">{team.division}</span>
      </div>
      
      <div className="team-record">
        <div className="record-main">
          <span className="wins">{team.wins}</span>
          <span className="record-separator">-</span>
          <span className="losses">{team.losses}</span>
        </div>
        
        <div className="win-percentage">
          <span 
            className="win-pct"
            style={{ color: getWinPercentageColor(team.winPercentage) }}
          >
            {parseFloat(team.winPercentage).toFixed(3)}
          </span>
        </div>
      </div>
      
      <div className="team-standings">
        <div className="games-back">
          <span className="label">GB:</span>
          <span className="value">{formatGamesBack(team.gamesBack)}</span>
        </div>
        
        {team.standing && (
          <div className="standing-position">
            <span className="label">Position:</span>
            <span className="value">{team.standing.divisionRank || 'N/A'}</span>
          </div>
        )}
      </div>
      
      <div className="team-details">
        <div className="detail-item">
          <span className="label">Venue:</span>
          <span className="value">{team.venue?.name || 'N/A'}</span>
        </div>
        
        <div className="detail-item">
          <span className="label">City:</span>
          <span className="value">{team.venue?.city || 'N/A'}</span>
        </div>
      </div>
      
      {team.standing && team.standing.leagueRecord && (
        <div className="league-record">
          <span className="label">League:</span>
          <span className="value">
            {team.standing.leagueRecord.wins}-{team.standing.leagueRecord.losses}
          </span>
        </div>
      )}
    </div>
  );
};

export default TeamCard;
