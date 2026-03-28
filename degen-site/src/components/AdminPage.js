import React, { useState, useEffect } from 'react';
import './AdminPage.css';
import NbaOddsTestPage from './NbaOddsTestPage';

const AdminPage = ({ onBackToHome }) => {
  const [showNbaOddsTest, setShowNbaOddsTest] = useState(false);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLeague, setFilterLeague] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('all');
  const [selectedSportsLeague, setSelectedSportsLeague] = useState('all');
  const [selectedSeason, setSelectedSeason] = useState('all');

  useEffect(() => {
    fetchAllTeams();
  }, []);

  const fetchAllTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetAllTeams {
              getTeams {
                id
                name
                record
                league
                division
                sportsLeague
                wins
                losses
                gamesBack
                wildCardGamesBack
                owner
                odds
                season
                createdAt
                updatedAt
              }
            }
          `
        })
      });
      
      const data = await response.json();
      const allTeams = data.data?.getTeams || [];
      
      // Sort by league, then season, then name
      allTeams.sort((a, b) => {
        if (a.league !== b.league) {
          return (a.league || '').localeCompare(b.league || '');
        }
        if ((a.season || '') !== (b.season || '')) {
          return (a.season || '').localeCompare(b.season || '');
        }
        return (a.name || '').localeCompare(b.name || '');
      });
      
      setTeams(allTeams);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setLoading(false);
    }
  };

  // Get unique leagues, sports leagues, and seasons for filters
  const leagues = [...new Set(teams.map(t => t.league).filter(Boolean))].sort();
  const sportsLeagues = [...new Set(teams.map(t => t.sportsLeague).filter(Boolean))].sort();
  const seasons = [...new Set(teams.map(t => t.season).filter(Boolean))].sort();

  // Filter teams
  const filteredTeams = teams.filter(team => {
    if (selectedLeague !== 'all' && team.league !== selectedLeague) return false;
    if (selectedSportsLeague !== 'all' && team.sportsLeague !== selectedSportsLeague) return false;
    if (selectedSeason !== 'all' && team.season !== selectedSeason) return false;
    if (filterLeague && !team.league?.toLowerCase().includes(filterLeague.toLowerCase())) return false;
    if (filterSeason && !team.season?.includes(filterSeason)) return false;
    return true;
  });

  // Check if a value is missing/null/empty
  const isMissing = (value) => {
    return value === null || value === undefined || value === '' || value === 'null' || value === 'NA';
  };

  // Format value for display
  const formatValue = (value) => {
    if (isMissing(value)) return <span className="missing-value">NULL</span>;
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '[]';
    return String(value);
  };

  // Get stats
  const stats = {
    total: teams.length,
    withSportsLeague: teams.filter(t => t.sportsLeague && t.sportsLeague !== 'null').length,
    withoutSportsLeague: teams.filter(t => !t.sportsLeague || t.sportsLeague === 'null').length,
    withSeason: teams.filter(t => t.season && t.season !== 'null').length,
    withoutSeason: teams.filter(t => !t.season || t.season === 'null').length,
    withOwner: teams.filter(t => t.owner && t.owner !== 'NA').length,
    withoutOwner: teams.filter(t => !t.owner || t.owner === 'NA').length,
    withOdds: teams.filter(t => t.odds && t.odds !== '999999' && t.odds !== 'null').length,
    withoutOdds: teams.filter(t => !t.odds || t.odds === '999999' || t.odds === 'null').length,
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading">Loading teams data...</div>
      </div>
    );
  }

  // If showing NBA Odds Test page
  if (showNbaOddsTest) {
    return <NbaOddsTestPage onBackToHome={() => setShowNbaOddsTest(false)} />;
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <button className="back-button" onClick={onBackToHome}>
          ← Back to Home
        </button>
        <h1>Admin: All Teams</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="refresh-button" onClick={fetchAllTeams}>
            🔄 Refresh
          </button>
          <button 
            className="refresh-button" 
            onClick={() => setShowNbaOddsTest(true)}
            style={{ backgroundColor: '#2196F3', color: 'white' }}
          >
            🏀 Test NBA Odds API
          </button>
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <div className="stat-label">Total Teams</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">With Sports League</div>
          <div className="stat-value">{stats.withSportsLeague}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Missing Sports League</div>
          <div className="stat-value">{stats.withoutSportsLeague}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">With Season</div>
          <div className="stat-value">{stats.withSeason}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Missing Season</div>
          <div className="stat-value">{stats.withoutSeason}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">With Owner</div>
          <div className="stat-value">{stats.withOwner}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Missing Owner</div>
          <div className="stat-value">{stats.withoutOwner}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">With Odds</div>
          <div className="stat-value">{stats.withOdds}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Missing Odds</div>
          <div className="stat-value">{stats.withoutOdds}</div>
        </div>
      </div>

      <div className="admin-filters">
        <div className="filter-group">
          <label>Filter by Sports League:</label>
          <select 
            value={selectedSportsLeague} 
            onChange={(e) => setSelectedSportsLeague(e.target.value)}
          >
            <option value="all">All Sports Leagues</option>
            {sportsLeagues.map(sportsLeague => (
              <option key={sportsLeague} value={sportsLeague}>{sportsLeague}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Filter by League:</label>
          <select 
            value={selectedLeague} 
            onChange={(e) => setSelectedLeague(e.target.value)}
          >
            <option value="all">All Leagues</option>
            {leagues.map(league => (
              <option key={league} value={league}>{league}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Filter by Season:</label>
          <select 
            value={selectedSeason} 
            onChange={(e) => setSelectedSeason(e.target.value)}
          >
            <option value="all">All Seasons</option>
            {seasons.map(season => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Search League:</label>
          <input
            type="text"
            value={filterLeague}
            onChange={(e) => setFilterLeague(e.target.value)}
            placeholder="Search league name..."
          />
        </div>

        <div className="filter-group">
          <label>Search Season:</label>
          <input
            type="text"
            value={filterSeason}
            onChange={(e) => setFilterSeason(e.target.value)}
            placeholder="Search season..."
          />
        </div>
      </div>

      <div className="admin-info">
        <p>Showing {filteredTeams.length} of {teams.length} teams</p>
      </div>

      <div className="admin-table-container">
        <table className="admin-teams-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Sports League</th>
              <th>League</th>
              <th>Division</th>
              <th>Season</th>
              <th>Record</th>
              <th>Wins</th>
              <th>Losses</th>
              <th>Games Back</th>
              <th>Wild Card GB</th>
              <th>Owner</th>
              <th>Odds</th>
              <th>Created At</th>
              <th>Updated At</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map((team) => (
              <tr 
                key={team.id}
                className={
                  isMissing(team.season) || isMissing(team.owner) || isMissing(team.odds) 
                    ? 'row-missing-data' 
                    : ''
                }
              >
                <td className="col-id">{team.id.substring(0, 8)}...</td>
                <td className="col-name">{formatValue(team.name)}</td>
                <td className={isMissing(team.sportsLeague) ? 'missing' : ''}>{formatValue(team.sportsLeague)}</td>
                <td className={isMissing(team.league) ? 'missing' : ''}>{formatValue(team.league)}</td>
                <td className={isMissing(team.division) ? 'missing' : ''}>{formatValue(team.division)}</td>
                <td className={isMissing(team.season) ? 'missing' : ''}>{formatValue(team.season)}</td>
                <td>{formatValue(team.record)}</td>
                <td>{formatValue(team.wins)}</td>
                <td>{formatValue(team.losses)}</td>
                <td className={isMissing(team.gamesBack) ? 'missing' : ''}>{formatValue(team.gamesBack)}</td>
                <td className={isMissing(team.wildCardGamesBack) ? 'missing' : ''}>{formatValue(team.wildCardGamesBack)}</td>
                <td className={isMissing(team.owner) ? 'missing' : ''}>{formatValue(team.owner)}</td>
                <td className={isMissing(team.odds) ? 'missing' : ''}>{formatValue(team.odds)}</td>
                <td className="col-date">{formatValue(team.createdAt)}</td>
                <td className="col-date">{formatValue(team.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTeams.length === 0 && (
        <div className="no-results">
          <p>No teams match the current filters.</p>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

