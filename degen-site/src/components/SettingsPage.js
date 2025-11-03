import React, { useMemo, useState, useEffect } from 'react';
import './SettingsPage.css';
import { diagnose, getCurrentStandings, getFallbackData } from '../services/mlbApi';
import MappingTableSettings from './MappingTableSettings';

const SettingsPage = ({ onTeamOwnersClick, onAdminClick }) => {
  const [activeSection, setActiveSection] = useState('main');
  
  const [mlbTeams, setMlbTeams] = useState([]);
  
  // Fetch MLB teams from GraphQL
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('http://localhost:4000/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query {
                getTeams(league: "mlb", season: "2025") {
                  id
                  name
                  owner
                  league
                  division
                }
              }
            `
          })
        });
        const data = await response.json();
        setMlbTeams(data.data?.getTeams || []);
      } catch (error) {
        console.error('Error fetching MLB teams:', error);
      }
    };
    
    fetchTeams();
  }, []);
  
  // Reference Data aggregations
  const { teamCount, ownersSummary, leaguesSummary, divisionsSummary } = useMemo(() => {
    const teamCount = mlbTeams.length;

    const ownersSummary = mlbTeams.reduce((acc, t) => {
      acc[t.owner] = (acc[t.owner] || 0) + 1;
      return acc;
    }, {});

    const leaguesSummary = mlbTeams.reduce((acc, t) => {
      acc[t.league] = (acc[t.league] || 0) + 1;
      return acc;
    }, {});

    const divisionsSummary = mlbTeams.reduce((acc, t) => {
      const key = `${t.league} • ${t.division}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return { teamCount, ownersSummary, leaguesSummary, divisionsSummary };
  }, [mlbTeams]);

  // Diagnostics
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState(null);
  const [testTeams, setTestTeams] = useState([]);
  const [testMeta, setTestMeta] = useState(null);

  const runDiagnostics = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    setTestTeams([]);
    setTestMeta(null);
    try {
      const result = await diagnose();
      setDiagResult(result);
      try {
        const standings = await getCurrentStandings();
        setTestTeams(standings.teams);
        setTestMeta({ seasonYear: standings.seasonYear, asOf: standings.asOf, fallback: false });
      } catch (err) {
        // If API fails, indicate fallback but do not display cached data in output table
        const fallback = getFallbackData();
        setTestTeams([]);
        setTestMeta({ seasonYear: fallback.seasonYear, asOf: fallback.asOf, fallback: true });
      }
    } catch (e) {
      setDiagResult({ ok: false, error: 'Diagnostics failed to run.' });
    } finally {
      setDiagLoading(false);
    }
  };

  const shouldShowResultsTable = testMeta && !testMeta.fallback && testTeams.length > 0;

  return (
    <div className="settings-page">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-section">
        <h2>Team Management</h2>
        <div className="management-links">
          <button onClick={onTeamOwnersClick} className="management-link">
            <div className="link-icon">📋</div>
            <div className="link-content">
              <h3>MLB Team Owners</h3>
              <p>View all MLB 2025 teams and their assigned owners</p>
            </div>
            <div className="link-arrow">→</div>
          </button>
          
          <button onClick={() => setActiveSection('mappings')} className="management-link">
            <div className="link-icon">🔗</div>
            <div className="link-content">
              <h3>Team Mapping Table</h3>
              <p>Manage team mappings between CFBD and Odds APIs</p>
            </div>
            <div className="link-arrow">→</div>
          </button>

          <button onClick={onAdminClick} className="management-link">
            <div className="link-icon">🔍</div>
            <div className="link-content">
              <h3>Admin: All Teams</h3>
              <p>View all teams with all attributes for debugging</p>
            </div>
            <div className="link-arrow">→</div>
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Reference Data</h2>
        <div className="card-grid">
          <div className="stat-card">
            <div className="stat-label">Teams</div>
            <div className="stat-value">{teamCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Leagues</div>
            <div className="stat-value">{Object.keys(leaguesSummary).length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Owners</div>
            <div className="stat-value">{Object.keys(ownersSummary).length}</div>
          </div>
        </div>

        <div className="lists-grid">
          <div className="list-card">
            <h3>Owners Distribution</h3>
            <ul>
              {Object.entries(ownersSummary).map(([owner, count]) => (
                <li key={owner}>
                  <span className="item-name">{owner}</span>
                  <span className="item-count">{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="list-card">
            <h3>By League</h3>
            <ul>
              {Object.entries(leaguesSummary).map(([league, count]) => (
                <li key={league}>
                  <span className="item-name">{league}</span>
                  <span className="item-count">{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="list-card">
            <h3>By Division</h3>
            <ul>
              {Object.entries(divisionsSummary).map(([div, count]) => (
                <li key={div}>
                  <span className="item-name">{div}</span>
                  <span className="item-count">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Testing</h2>
        <div className="diag-controls">
          <button className="diag-button" onClick={runDiagnostics} disabled={diagLoading}>
            {diagLoading ? 'Running API Test…' : 'Run MLB API Test'}
          </button>
        </div>

        {diagResult && (
          <div className={`diag-panel ${diagResult.length > 0 ? 'ok' : 'fail'}`}>
            {diagResult.map((result, index) => (
              <div key={index} className="diag-row">
                <strong>{result.name}:</strong> {result.ok ? `OK (${result.teamCount} teams)` : `Failed (${result.status})`}
                {result.error && ` - ${result.error}`}
              </div>
            ))}
          </div>
        )}

        {testMeta && (
          <div className="results-meta">
            {testMeta.fallback ? (
              <span>API unavailable. Cached data detected — hiding results to show only API-sourced data.</span>
            ) : (
              <span>Results • Season {testMeta.seasonYear} • Last updated: {new Date(testMeta.asOf).toLocaleString()} • Teams: {testTeams.length}</span>
            )}
          </div>
        )}

        {shouldShowResultsTable && (
          <div className="results-table-wrapper">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Record</th>
                  <th>League</th>
                  <th>Division</th>
                </tr>
              </thead>
              <tbody>
                {testTeams.map((t) => (
                  <tr key={`${t.league}-${t.division}-${t.name}`}>
                    <td className="team-col">{t.name}</td>
                    <td className="record-col">{t.record}</td>
                    <td className="league-col">{t.league}</td>
                    <td className="division-col">{t.division}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Mapping Table Management Section */}
      {activeSection === 'mappings' && (
        <section className="settings-section">
          <div className="section-header">
            <button 
              onClick={() => setActiveSection('main')} 
              className="back-button"
            >
              ← Back to Settings
            </button>
            <h2>Team Mapping Table Management</h2>
          </div>
          <MappingTableSettings />
        </section>
      )}
    </div>
  );
};

export default SettingsPage;
