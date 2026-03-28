import React, { useState, useMemo } from 'react';
import './NCAADraftTable.css';

// Owner colors - distinct colors for easy identification
const OWNER_COLORS = {
  // 8-owner NCAA 2026 draft
  'DM': '#22c55e',  // Green
  'DB': '#ef4444',  // Red
  'BM': '#3b82f6',  // Blue
  'MJ': '#f97316',  // Orange
  'JK': '#a855f7',  // Purple
  'TM': '#ec4899',  // Pink
  'KB': '#14b8a6',  // Teal
  'MS': '#eab308',  // Yellow
  // 4-owner NCAA 2026 draft
  'TG': '#ec4899',  // Pink
  'KH': '#3b82f6',  // Blue
  'MC': '#a855f7',  // Purple
  // Legacy/other drafts
  'JR': '#f97316',  // Orange
  'BW': '#14b8a6',  // Teal
  'AS': '#eab308',  // Yellow
  'RL': '#ef4444'   // Red
};

// Owner display names
const OWNER_DISPLAY_NAMES = {
  'DM': 'Dev Menon',
  'MC': 'Matt Civello',
  'KH': 'Kevin Hagerty',
  'TG': 'Terry Gallagher',
  'JR': 'Jim Robertson',
  'BW': 'Brandon Williams',
  'AS': 'Adam Smith',
  'RL': 'Ryan Lee'
};

const NCAADraftTable = ({ 
  draftPicks = [], 
  teams = [], 
  owners = [],
  onSelectTeam,
  canMakePick,
  disabled = false
}) => {
  const [activeTooltip, setActiveTooltip] = useState(null); // { type: 'team'|'owner', id: string }
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // Get team by ID
  const getTeamById = (teamId) => {
    return teams.find(t => t.id === teamId);
  };
  
  // Check if a team is already drafted
  const isTeamDrafted = (teamId) => {
    return draftPicks.some(pick => pick.teamId === teamId);
  };
  
  // Get available teams for drafting
  const availableTeams = useMemo(() => {
    return teams
      .filter(team => !isTeamDrafted(team.id))
      .sort((a, b) => {
        // Sort by seed first
        const seedDiff = (a.seed || 16) - (b.seed || 16);
        if (seedDiff !== 0) return seedDiff;
        // Then by name
        return a.name.localeCompare(b.name);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, draftPicks]);
  
  // Organize picks by round
  const draftRounds = useMemo(() => {
    const rounds = {};
    draftPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });
    
    // Sort picks within each round by pick number
    Object.keys(rounds).forEach(round => {
      rounds[round].sort((a, b) => a.pickNumber - b.pickNumber);
    });
    
    return rounds;
  }, [draftPicks]);
  
  // Calculate total points and team stats per owner
  const ownerStats = useMemo(() => {
    const stats = {};
    owners.forEach(owner => {
      stats[owner] = { 
        total: 0, 
        breakdown: {},
        totalTeams: 0,
        activeTeams: 0,
        eliminatedTeams: 0
      };
    });
    
    draftPicks.forEach(pick => {
      if (pick.teamId && pick.owner) {
        const team = getTeamById(pick.teamId);
        if (team) {
          // Count teams
          stats[pick.owner].totalTeams++;
          if (team.eliminated) {
            stats[pick.owner].eliminatedTeams++;
          } else {
            stats[pick.owner].activeTeams++;
          }
          
          // Calculate points
          if (team.totalPoints) {
            stats[pick.owner].total += team.totalPoints;
            
            // Add to breakdown
            if (team.pointBreakdown) {
              try {
                const breakdown = typeof team.pointBreakdown === 'string' 
                  ? JSON.parse(team.pointBreakdown) 
                  : team.pointBreakdown;
                stats[pick.owner].breakdown[team.name] = {
                  points: team.totalPoints,
                  detail: breakdown,
                  eliminated: team.eliminated
                };
              } catch (e) {
                stats[pick.owner].breakdown[team.name] = {
                  points: team.totalPoints,
                  detail: {},
                  eliminated: team.eliminated
                };
              }
            }
          }
        }
      }
    });
    
    return stats;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPicks, teams, owners]);
  
  // Alias for backwards compatibility
  const ownerPoints = ownerStats;
  
  // Get points breakdown data for owner table
  const getOwnerBreakdownData = (owner) => {
    const data = ownerStats[owner];
    if (!data) return [];
    
    const rows = [];
    const roundOrder = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];
    
    // Get all teams for this owner from draftPicks
    draftPicks.forEach(pick => {
      if (pick.owner === owner && pick.teamId) {
        const team = getTeamById(pick.teamId);
        if (team) {
          // Get breakdown details
          let breakdown = {};
          if (team.pointBreakdown) {
            try {
              breakdown = typeof team.pointBreakdown === 'string' 
                ? JSON.parse(team.pointBreakdown) 
                : team.pointBreakdown;
            } catch (e) {
              breakdown = {};
            }
          }
          
          // Create a row for each round the team won
          roundOrder.forEach(round => {
            if (breakdown[round] && breakdown[round].total > 0) {
              rows.push({
                team: team.name,
                seed: team.seed,
                eliminated: team.eliminated,
                round: round,
                base: breakdown[round].base || 0,
                upset: breakdown[round].bonus || 0,
                total: breakdown[round].total || 0
              });
            }
          });
          
          // If team has no wins yet, add a placeholder row
          if (Object.keys(breakdown).length === 0 || !team.totalPoints) {
            rows.push({
              team: team.name,
              seed: team.seed,
              eliminated: team.eliminated,
              round: '-',
              base: 0,
              upset: 0,
              total: 0
            });
          }
        }
      }
    });
    
    return rows;
  };
  
  // Handle info button click for owner tooltip
  const handleOwnerInfoClick = (e, owner) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: Math.min(rect.left - 100, window.innerWidth - 360),
      y: rect.bottom + 8
    });
    
    // Toggle tooltip
    if (activeTooltip?.type === 'owner' && activeTooltip?.id === owner) {
      setActiveTooltip(null);
    } else {
      setActiveTooltip({ type: 'owner', id: owner });
    }
  };
  
  // Close tooltip when clicking outside
  const closeTooltip = () => {
    setActiveTooltip(null);
  };

  // Render pick cell
  const PickCell = ({ pick, ownerColor }) => {
    const team = pick.teamId ? getTeamById(pick.teamId) : null;
    const canPick = canMakePick ? canMakePick(pick) : false;
    const isDisabled = disabled || !canPick;
    
    return (
      <div className={`pick-cell ${pick.teamId ? 'picked' : ''} ${isDisabled ? 'disabled' : ''}`}>
        <span className="pick-number">#{pick.pickNumber}</span>
        
        {pick.teamId && team ? (
          <div className="picked-team">
            <span className={`team-name ${team.eliminated ? 'eliminated' : ''}`}>
              #{team.seed} {team.name}
            </span>
            {team.totalPoints > 0 && (
              <span className="team-points">
                {team.totalPoints} pts
              </span>
            )}
          </div>
        ) : (
          <select
            className="team-select"
            value=""
            onChange={(e) => onSelectTeam && onSelectTeam(pick, e.target.value)}
            disabled={isDisabled}
          >
            <option value="">Select team...</option>
            {availableTeams.map(team => (
              <option key={team.id} value={team.id}>
                #{team.seed} {team.name} ({team.region || '-'}) {team.odds || '-'}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };
  
  if (owners.length === 0) {
    return (
      <div className="ncaa-draft-table-empty">
        <p>No draft data available</p>
      </div>
    );
  }
  
  return (
    <div className="ncaa-draft-table-container">
      <div className="ncaa-draft-table">
        {/* Header Row */}
        <div className="draft-header" style={{ gridTemplateColumns: `60px repeat(${owners.length}, 1fr)` }}>
          <div className="round-header">Round</div>
          {owners.map(owner => (
            <div 
              key={owner} 
              className="owner-header"
              style={{ borderBottomColor: OWNER_COLORS[owner] || '#6b7280' }}
            >
              {/* Line 1: Owner Initials in owner color */}
              <span 
                className="owner-initials" 
                style={{ color: OWNER_COLORS[owner] || '#6b7280' }}
                title={OWNER_DISPLAY_NAMES[owner] || owner}
              >
                {owner}
              </span>
              
              {/* Line 2: Points */}
              <span className="owner-points">
                {ownerStats[owner]?.total || 0} pts
              </span>
              
              {/* Line 3: Active / Out */}
              <span className="owner-teams-status">
                {ownerStats[owner]?.activeTeams || 0} active / {ownerStats[owner]?.eliminatedTeams || 0} out
              </span>
              
              {/* Line 4: Details button */}
              <button 
                className="details-button"
                onClick={(e) => handleOwnerInfoClick(e, owner)}
              >
                Details
              </button>
              
              {/* Points Table Tooltip */}
              {activeTooltip?.type === 'owner' && activeTooltip?.id === owner && (
                <div 
                  className="points-tooltip"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`
                  }}
                >
                  <button className="tooltip-close" onClick={closeTooltip}>✕</button>
                  <div className="tooltip-header">
                    <span style={{ color: OWNER_COLORS[owner] }}>{owner}</span> - Points Breakdown
                  </div>
                  <div className="tooltip-scroll-content">
                    <table className="breakdown-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          <th>Round</th>
                          <th>Pts</th>
                          <th>Upset</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getOwnerBreakdownData(owner).map((row, idx) => (
                          <tr key={idx} className={row.eliminated ? 'eliminated-row' : ''}>
                            <td className="team-cell">
                              <span className="team-seed">#{row.seed}</span> {row.team}
                            </td>
                            <td>{row.round}</td>
                            <td>{row.base}</td>
                            <td>{row.upset > 0 ? `+${row.upset}` : '-'}</td>
                            <td className="total-cell">{row.total}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan="4" className="total-label">Total Points</td>
                          <td className="grand-total">{ownerStats[owner]?.total || 0}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Draft Rows */}
        {Object.keys(draftRounds).sort((a, b) => Number(a) - Number(b)).map(roundNum => {
          const roundPicks = draftRounds[roundNum];
          
          return (
            <div 
              key={roundNum} 
              className="draft-row"
              style={{ gridTemplateColumns: `60px repeat(${owners.length}, 1fr)` }}
            >
              <div className="round-number">{roundNum}</div>
              {owners.map(owner => {
                const pick = roundPicks.find(p => p.owner === owner);
                if (!pick) return <div key={owner} className="pick-cell empty"></div>;
                
                return (
                  <PickCell 
                    key={pick.id} 
                    pick={pick} 
                    ownerColor={OWNER_COLORS[owner]}
                  />
                );
              })}
            </div>
          );
        })}
        
        {/* Totals Row */}
        <div 
          className="draft-row totals-row"
          style={{ gridTemplateColumns: `60px repeat(${owners.length}, 1fr)` }}
        >
          <div className="round-number">Total</div>
          {owners.map(owner => (
            <div 
              key={owner} 
              className="pick-cell total-cell"
              style={{ borderTopColor: OWNER_COLORS[owner] || '#6b7280' }}
            >
              <span className="total-points">{ownerPoints[owner]?.total || 0} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NCAADraftTable;
