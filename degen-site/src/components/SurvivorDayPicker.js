import React, { useState, useMemo } from 'react';
import { getRequiredPicks, getAvailableTeams, validatePicks, canBuyBack, needsBuyBackPicks } from '../utils/survivorRules';

const SurvivorDayPicker = ({ entry, scheduleDay, entryPicks, onSubmit, onCancel }) => {
  const [selectedTeams, setSelectedTeams] = useState([]);

  const isNewBuyBack = entry.status === 'eliminated' && canBuyBack(entry, scheduleDay?.dayIndex);
  const hasBuyBackPenalty = isNewBuyBack || needsBuyBackPicks(entry, scheduleDay?.dayIndex, entryPicks || []);
  const required = scheduleDay ? getRequiredPicks(entry, scheduleDay.dayIndex, hasBuyBackPenalty) : 0;
  const availableTeams = useMemo(
    () => scheduleDay ? getAvailableTeams(entry, scheduleDay) : [],
    [entry, scheduleDay]
  );

  const toggleTeam = (teamName) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamName)) return prev.filter(t => t !== teamName);
      if (prev.length >= required) return prev;
      return [...prev, teamName];
    });
  };

  const isPastDeadline = scheduleDay?.lockedAt && new Date() >= new Date(scheduleDay.lockedAt);

  const handleSubmit = () => {
    const validation = validatePicks(entry, selectedTeams, scheduleDay, hasBuyBackPenalty);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }
    onSubmit(selectedTeams, isNewBuyBack);
  };

  if (!scheduleDay) {
    return (
      <div className="survivor-day-picker">
        <div className="picker-empty">
          <p>No schedule loaded for today.</p>
          <button className="cancel-btn" onClick={onCancel}>Back</button>
        </div>
      </div>
    );
  }

  const entryLabel = entry.entryNumber > 1
    ? `${entry.playerName} #${entry.entryNumber}`
    : entry.playerName;

  return (
    <div className="survivor-day-picker">
      <div className="picker-header">
        <h3>Pick Teams for {entryLabel}</h3>
        <p className="picker-subtitle">
          Select <strong>{required}</strong> team{required !== 1 ? 's' : ''} to win
          {isNewBuyBack && <span className="buyback-notice"> (Buy-back: ${10})</span>}
          {hasBuyBackPenalty && !isNewBuyBack && <span className="buyback-notice"> (Buy-back penalty)</span>}
        </p>
        <div className="selection-count">
          <span className={`count ${selectedTeams.length === required ? 'complete' : ''}`}>
            {selectedTeams.length} / {required}
          </span>
        </div>
      </div>

      {/* Past deadline soft warning */}
      {isPastDeadline && (
        <div className="deadline-warning">
          <span className="warning-icon">⏰</span>
          <span>The deadline has passed — these picks are being submitted late.</span>
        </div>
      )}

      {/* Already used teams warning */}
      {entry.usedTeams && entry.usedTeams.length > 0 && (
        <div className="used-teams-warning">
          <span className="warning-icon">⚠️</span>
          <span>Already used: {entry.usedTeams.join(', ')}</span>
        </div>
      )}

      {/* Games grid */}
      <div className="games-grid">
        {(scheduleDay.games || []).map((game, i) => {
          const team1Available = availableTeams.some(t => t.toLowerCase() === (game.team1Name || '').toLowerCase());
          const team2Available = availableTeams.some(t => t.toLowerCase() === (game.team2Name || '').toLowerCase());
          const team1Selected = selectedTeams.includes(game.team1Name);
          const team2Selected = selectedTeams.includes(game.team2Name);
          const atLimit = selectedTeams.length >= required;

          return (
            <div key={i} className="game-card">
              {game.startTime && (
                <div className="game-time">
                  {new Date(game.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              )}
              <div className="game-matchup">
                <button
                  className={`team-pick-btn ${team1Selected ? 'selected' : ''} ${!team1Available ? 'used' : ''}`}
                  onClick={() => team1Available && toggleTeam(game.team1Name)}
                  disabled={!team1Available || (atLimit && !team1Selected)}
                >
                  {game.team1Seed && <span className="seed">({game.team1Seed})</span>}
                  <span className="team-name">{game.team1Name || 'TBD'}</span>
                  {!team1Available && <span className="used-marker">used</span>}
                </button>
                <span className="vs">vs</span>
                <button
                  className={`team-pick-btn ${team2Selected ? 'selected' : ''} ${!team2Available ? 'used' : ''}`}
                  onClick={() => team2Available && toggleTeam(game.team2Name)}
                  disabled={!team2Available || (atLimit && !team2Selected)}
                >
                  {game.team2Seed && <span className="seed">({game.team2Seed})</span>}
                  <span className="team-name">{game.team2Name || 'TBD'}</span>
                  {!team2Available && <span className="used-marker">used</span>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {availableTeams.length < required && (
        <div className="auto-loss-warning">
          ⚠️ Not enough available teams ({availableTeams.length}) to meet the requirement ({required}).
          This entry will receive an automatic loss.
        </div>
      )}

      {/* Actions */}
      <div className="picker-actions">
        <button className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={selectedTeams.length !== required}
        >
          Submit {selectedTeams.length}/{required} Picks
          {isNewBuyBack && ' + Buy Back ($10)'}
        </button>
      </div>
    </div>
  );
};

export default SurvivorDayPicker;
