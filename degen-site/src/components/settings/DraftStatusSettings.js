import React, { useState, useEffect } from 'react';
import { getAllDraftStatuses, updateDraftStatus } from '../../services/dynamoDBService';
import './DraftStatusSettings.css';

const STATUS_OPTIONS = [
  'Draft In Progress',
  'Draft Completed',
  'Payout Pending',
  'Payout Completed'
];

const DRAFT_LEAGUES = [
  { league: 'nfl', season: '2025', label: 'NFL 2025', color: '#059669' },
  { league: 'mlb', season: '2025', label: 'MLB 2025', color: '#1e3a8a' },
  { league: 'mlb', season: '2024', label: 'MLB 2024', color: '#1e3a8a' },
  { league: 'nba', season: '2025', label: 'NBA 2025', color: '#dc2626' },
  { league: 'nba', season: '2024', label: 'NBA 2024', color: '#dc2626' },
  { league: 'ncaa', season: '2025', label: 'NCAA 2025', color: '#7c3aed' },
  { league: 'ncaa-tourney', season: '2025', label: 'NCAA Tournament 2025', color: '#f59e0b' },
  { league: 'ncaa-tourney', season: '2026', label: 'NCAA Tournament 2026', color: '#f59e0b' },
  { league: 'ncaa-tourney-4', season: '2026', label: 'NCAA Tournament 2026 (4-Player)', color: '#8b5cf6' },
  { league: 'nhl', season: '2025', label: 'NHL 2025', color: '#0891b2' },
  { league: 'nfl-mvp', season: '2025', label: 'NFL MVP 2025', color: '#2563eb' },
  { league: 'ncaa-survivor', season: '2026', label: 'NCAA Survivor 2026', color: '#dc2626' }
];

const DraftStatusSettings = ({ onBack, embedded = false }) => {
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadStatuses();
  }, []);

  const loadStatuses = async () => {
    setLoading(true);
    setError('');
    try {
      const allStatuses = await getAllDraftStatuses();
      const statusMap = {};
      allStatuses.forEach(status => {
        const key = `${status.league}-${status.season}`;
        statusMap[key] = status.status;
      });
      setStatuses(statusMap);
    } catch (err) {
      console.error('Error loading draft statuses:', err);
      setError(`Failed to load draft statuses: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (league, season, newStatus, label) => {
    const key = `${league}-${season}`;
    setSaving(prev => ({ ...prev, [key]: true }));
    setError('');
    setSuccessMessage('');

    try {
      await updateDraftStatus(league, season, newStatus);
      setStatuses(prev => ({
        ...prev,
        [key]: newStatus
      }));
      setSuccessMessage(`${label} status updated to "${newStatus}"`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating draft status:', err);
      setError(`Failed to update status: ${err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const getStatusForDraft = (league, season) => {
    const key = `${league}-${season}`;
    return statuses[key] || 'Draft In Progress';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Draft In Progress': return '⏳';
      case 'Draft Completed': return '✅';
      case 'Payout Pending': return '💰';
      case 'Payout Completed': return '🏆';
      default: return '📋';
    }
  };

  return (
    <div className="draft-status-settings">
      {!embedded && (
        <div className="section-header">
          <button onClick={onBack} className="back-button">
            ← Back to Settings
          </button>
        </div>
      )}
      
      <div className="section-title">
        <div className="title-row">
          <div>
            <h1>Draft Status Management</h1>
            <p>Manage the status phase for each draft</p>
          </div>
          <button 
            onClick={loadStatuses} 
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {successMessage && (
        <div className="alert alert-success">{successMessage}</div>
      )}

      {loading ? (
        <div className="loading-state">Loading draft statuses...</div>
      ) : (
        <div className="draft-cards-grid">
          {DRAFT_LEAGUES.map(({ league, season, label, color }) => {
            const key = `${league}-${season}`;
            const currentStatus = getStatusForDraft(league, season);
            const isSaving = saving[key];

            return (
              <div key={key} className="draft-card">
                <div className="draft-card-header">
                  <div className="draft-color-bar" style={{ backgroundColor: color }} />
                  <div className="draft-info">
                    <span className="draft-label">{label}</span>
                    <span className="draft-status-icon">{getStatusIcon(currentStatus)}</span>
                  </div>
                </div>
                <div className="draft-card-body">
                  <div className="current-status">
                    <span className="status-label">Current Status</span>
                    <span className={`status-value status-${currentStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                      {currentStatus}
                    </span>
                  </div>
                  <div className="status-selector">
                    <label htmlFor={`status-${key}`}>Change To</label>
                    <div className="select-wrapper">
                      <select
                        id={`status-${key}`}
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(league, season, e.target.value, label)}
                        disabled={isSaving}
                        className="status-select"
                      >
                        {STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {isSaving && <span className="saving-spinner">...</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DraftStatusSettings;

