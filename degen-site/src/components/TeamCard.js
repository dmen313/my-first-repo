import React from 'react';
import './TeamCard.css';

const TeamCard = ({ team }) => {
  return (
    <div className="team-card">
      <h3 className="team-name">{team.name}</h3>
      <div className="team-info">
        <p><strong>Record:</strong> {team.record}</p>
        <p><strong>League:</strong> {team.league}</p>
        <p><strong>Division:</strong> {team.division}</p>
        <p><strong>Owner:</strong> {team.owner}</p>
      </div>
    </div>
  );
};

export default TeamCard;



