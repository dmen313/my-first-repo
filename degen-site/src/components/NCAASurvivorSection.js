import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SurvivorCountdown from './SurvivorCountdown';
import SurvivorAdminBoard from './SurvivorAdminBoard';
import SurvivorDayPicker from './SurvivorDayPicker';
import { getTournamentDayLabel, canBuyBack, getRequiredPicks } from '../utils/survivorRules';
import {
  getSurvivorEntries,
  getSurvivorPicks,
  getSurvivorSchedule,
  createSurvivorEntry,
  createSurvivorPick,
  updateSurvivorEntry
} from '../services/dynamoDBService';
import './NCAASurvivorSection.css';

const NCAASurvivorSection = ({ leagueId, onBack, user }) => {
  const isSiteAdmin = user?.isSiteAdmin || false;
  const [entries, setEntries] = useState([]);
  const [picks, setPicks] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [pickingEntry, setPickingEntry] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const parts = leagueId.split('-');
  const season = parts[parts.length - 1];
  const league = parts.slice(0, -1).join('-');

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [entriesData, picksData, scheduleData] = await Promise.all([
        getSurvivorEntries(league, season),
        getSurvivorPicks(league, season),
        getSurvivorSchedule(league, season)
      ]);
      setEntries(entriesData);
      setPicks(picksData);
      setSchedule(scheduleData);

      // Auto-select the current day or the latest day with data
      if (scheduleData.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todaySchedule = scheduleData.find(d => d.gameDay === today);
        if (todaySchedule) {
          setSelectedDay(todaySchedule.gameDay);
        } else {
          // Select the latest day
          const sorted = [...scheduleData].sort((a, b) => b.gameDay.localeCompare(a.gameDay));
          setSelectedDay(sorted[0]?.gameDay || null);
        }
      }
    } catch (err) {
      console.error('Error loading survivor data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [league, season]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const currentScheduleDay = useMemo(
    () => schedule.find(d => d.gameDay === selectedDay) || null,
    [schedule, selectedDay]
  );

  const nextDayLockedAt = useMemo(() => {
    if (!currentScheduleDay) return null;
    const nextDay = schedule.find(d => d.dayIndex === currentScheduleDay.dayIndex + 1);
    return nextDay?.lockedAt || null;
  }, [schedule, currentScheduleDay]);

  const handleMakePicks = (entry) => {
    setPickingEntry(entry);
  };

  const handleSubmitPicks = async (teamNames, isBuyingBack) => {
    if (!pickingEntry || !currentScheduleDay) return;

    try {
      const entry = pickingEntry;
      const required = getRequiredPicks(entry, currentScheduleDay.dayIndex, isBuyingBack);

      if (isBuyingBack) {
        await updateSurvivorEntry(entry.id, {
          status: 'alive',
          buyBackCount: (entry.buyBackCount || 0) + 1,
          totalCost: (entry.totalCost || 10) + 10,
          lastBuyBackDay: selectedDay,
          usedTeams: [...(entry.usedTeams || []), ...teamNames]
        });
      } else {
        await updateSurvivorEntry(entry.id, {
          usedTeams: [...(entry.usedTeams || []), ...teamNames]
        });
      }

      const results = {};
      teamNames.forEach(t => { results[t] = 'pending'; });

      await createSurvivorPick({
        entryId: entry.id,
        league,
        season,
        playerName: entry.playerName,
        gameDay: selectedDay,
        teamNames,
        requiredPicks: required,
        results
      });

      setPickingEntry(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Error submitting picks:', err);
      alert('Error submitting picks: ' + err.message);
    }
  };

  const handleBuyBack = async (entry) => {
    if (!currentScheduleDay) {
      alert('No schedule loaded for today. Cannot buy back.');
      return;
    }

    if (!canBuyBack(entry, currentScheduleDay.dayIndex)) {
      alert('Buy-back is not available for this entry at this point in the tournament.');
      return;
    }

    setPickingEntry(entry);
  };

  const handleAddEntry = async () => {
    const name = prompt('Player name:');
    if (!name) return;
    const email = prompt('Player email:');

    const existingForPlayer = entries.filter(e => e.playerName === name);
    const entryNumber = existingForPlayer.length + 1;

    try {
      await createSurvivorEntry({
        league,
        season,
        playerName: name,
        entryNumber,
        email: email || null,
        status: 'alive',
        buyBackCount: 0,
        totalCost: 10
      });
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Error adding entry:', err);
      alert('Error adding entry: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="survivor-section">
        <div className="survivor-loading">Loading Survivor Pool...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="survivor-section">
        <div className="survivor-error">
          <p>Error loading data: {error}</p>
          <button onClick={() => setRefreshKey(k => k + 1)}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="survivor-section">
      {/* Header */}
      <div className="survivor-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="header-info">
          <h1>NCAA Survivor Pool {season}</h1>
          <p className="header-subtitle">$10 entry • Last man standing wins</p>
        </div>
        <button className="refresh-btn" onClick={() => setRefreshKey(k => k + 1)}>
          ⟳ Refresh
        </button>
      </div>

      {/* Countdown */}
      <SurvivorCountdown
        lockedAt={currentScheduleDay?.lockedAt}
        tournamentDay={currentScheduleDay ? getTournamentDayLabel(currentScheduleDay.dayIndex) : null}
      />

      {/* Day Selector */}
      {schedule.length > 0 && (
        <div className="day-selector">
          {schedule.map(day => (
            <button
              key={day.gameDay}
              className={`day-tab ${day.gameDay === selectedDay ? 'active' : ''}`}
              onClick={() => { setSelectedDay(day.gameDay); setPickingEntry(null); }}
            >
              <span className="day-label">{getTournamentDayLabel(day.dayIndex)}</span>
              <span className="day-date">{new Date(day.gameDay + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </button>
          ))}
        </div>
      )}

      {/* Day Picker (modal-like overlay) */}
      {pickingEntry && currentScheduleDay && (
        <div className="picker-overlay">
          <SurvivorDayPicker
            entry={pickingEntry}
            scheduleDay={currentScheduleDay}
            entryPicks={picks.filter(p => p.entryId === pickingEntry.id)}
            onSubmit={handleSubmitPicks}
            onCancel={() => setPickingEntry(null)}
          />
        </div>
      )}

      {/* Survivor Board */}
      <SurvivorAdminBoard
        entries={entries}
        picks={picks}
        currentDay={selectedDay}
        currentScheduleDay={currentScheduleDay}
        nextDayLockedAt={nextDayLockedAt}
        onAddEntry={isSiteAdmin ? handleAddEntry : null}
        onBuyBack={isSiteAdmin ? handleBuyBack : null}
        onSelectEntry={handleMakePicks}
        isSiteAdmin={isSiteAdmin}
      />

      {/* No schedule message */}
      {schedule.length === 0 && (
        <div className="no-schedule-message">
          <h3>No schedule loaded yet</h3>
          <p>Run the ESPN schedule fetcher to populate game data:</p>
          <code>node scripts/fetchNcaaSurvivorSchedule.js</code>
        </div>
      )}
    </div>
  );
};

export default NCAASurvivorSection;
