import React, { useMemo, useState, useEffect } from 'react';
import './SettingsPage.css';
import AccountSecurity from './settings/AccountSecurity';
import UserManagement from './settings/UserManagement';
import DraftStatusSettings from './settings/DraftStatusSettings';
import DraftAccessSettings from './settings/DraftAccessSettings';
import LeaguesBrowser from './settings/LeaguesBrowser';
import activityLogService from '../services/activityLogService';
import { getAllDraftStatuses } from '../services/dynamoDBService';
import { listSiteAdmins, addSiteAdmin, removeSiteAdmin, listAllUsers } from '../services/cognitoUserService';

// All leagues configuration
const ALL_LEAGUES = [
  { id: 'nfl-2025', league: 'nfl', season: '2025', name: 'NFL', fullName: 'National Football League', color: '#059669' },
  { id: 'mlb-2025', league: 'mlb', season: '2025', name: 'MLB', fullName: 'Major League Baseball', color: '#1e3a8a' },
  { id: 'mlb-2024', league: 'mlb', season: '2024', name: 'MLB', fullName: 'Major League Baseball', color: '#1e3a8a' },
  { id: 'nba-2025', league: 'nba', season: '2025', name: 'NBA', fullName: 'National Basketball Association', color: '#dc2626' },
  { id: 'nba-2024', league: 'nba', season: '2024', name: 'NBA', fullName: 'National Basketball Association', color: '#dc2626' },
  { id: 'ncaa-2025', league: 'ncaa', season: '2025', name: 'NCAA', fullName: 'NCAA Football', color: '#7c3aed' },
  { id: 'ncaa-tourney-2025', league: 'ncaa-tourney', season: '2025', name: 'NCAA Tourney', fullName: 'NCAA Tournament', color: '#f59e0b' },
  { id: 'ncaa-tourney-2026', league: 'ncaa-tourney', season: '2026', name: 'NCAA Tourney', fullName: 'NCAA Tournament 2026', color: '#f59e0b' },
  { id: 'ncaa-tourney-4-2026', league: 'ncaa-tourney-4', season: '2026', name: 'NCAA (4)', fullName: 'NCAA Tournament 2026 (4-Player)', color: '#8b5cf6' },
  { id: 'nhl-2025', league: 'nhl', season: '2025', name: 'NHL', fullName: 'National Hockey League', color: '#0891b2' },
  { id: 'nfl-mvp-2025', league: 'nfl-mvp', season: '2025', name: 'MVP', fullName: 'NFL MVP Awards', color: '#2563eb' }
];

const BASE_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'leagues', label: 'Leagues & Teams', icon: '🏆' },
  { id: 'draft-status', label: 'Draft Status', icon: '📋' },
  { id: 'draft-access', label: 'Draft Access', icon: '🔒' },
  { id: 'users', label: 'User Management', icon: '👥' },
  { id: 'site-admins', label: 'Site Admins', icon: '🛡️', adminOnly: true },
  { id: 'activity-log', label: 'Activity Log', icon: '📝' },
  { id: 'account', label: 'Account & Security', icon: '🔐' }
];

const SettingsPage = ({ onTeamOwnersClick, onAdminClick, isSiteAdmin }) => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [draftStatuses, setDraftStatuses] = useState({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);

  // Load draft statuses for dashboard
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const statuses = await getAllDraftStatuses();
        const statusMap = {};
        statuses.forEach(s => {
          statusMap[`${s.league}-${s.season}`] = s.status;
        });
        setDraftStatuses(statusMap);
      } catch (err) {
        console.error('Error loading draft statuses:', err);
      } finally {
        setIsLoadingStatuses(false);
      }
    };
    loadStatuses();
  }, []);

  // Dashboard stats
  const dashboardStats = useMemo(() => {
    const statusCounts = {
      'Draft In Progress': 0,
      'Draft Completed': 0,
      'Payout Pending': 0,
      'Payout Completed': 0
    };

    ALL_LEAGUES.forEach(league => {
      const status = draftStatuses[league.id] || 'Draft In Progress';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      totalLeagues: ALL_LEAGUES.length,
      activeLeagues: ALL_LEAGUES.filter(l => {
        const status = draftStatuses[l.id];
        return status === 'Draft In Progress' || status === 'Payout Pending';
      }).length,
      completedLeagues: statusCounts['Draft Completed'] + statusCounts['Payout Completed'],
      statusCounts
    };
  }, [draftStatuses]);

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardSection 
          stats={dashboardStats} 
          draftStatuses={draftStatuses}
          isLoading={isLoadingStatuses}
          onNavigate={setActiveSection}
        />;
      case 'leagues':
        return <LeaguesBrowser leagues={ALL_LEAGUES} draftStatuses={draftStatuses} />;
      case 'draft-status':
        return <DraftStatusSettings onBack={() => setActiveSection('dashboard')} embedded />;
      case 'draft-access':
        return <DraftAccessSettings isSiteAdmin={isSiteAdmin} />;
      case 'users':
        return <UserManagement onBack={() => setActiveSection('dashboard')} embedded isSiteAdmin={isSiteAdmin} />;
      case 'site-admins':
        return isSiteAdmin ? <SiteAdminsSection /> : null;
      case 'activity-log':
        return <ActivityLogSection />;
      case 'account':
        return <AccountSecurity embedded />;
      default:
        return <DashboardSection stats={dashboardStats} draftStatuses={draftStatuses} />;
    }
  };

  return (
    <div className="settings-layout">
      {/* Sidebar Navigation */}
      <aside className="settings-sidebar">
        <div className="sidebar-header">
          <h2>Settings</h2>
        </div>
        <nav className="sidebar-nav">
          {BASE_NAV_ITEMS.filter(item => !item.adminOnly || isSiteAdmin).map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={onAdminClick} className="nav-item secondary">
            <span className="nav-icon">🔍</span>
            <span className="nav-label">Admin Tools</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="settings-content">
        {renderContent()}
      </main>
    </div>
  );
};

// Dashboard Section Component
const DashboardSection = ({ stats, draftStatuses, isLoading, onNavigate }) => {
  const recentLeagues = ALL_LEAGUES.slice(0, 5);

  return (
    <div className="dashboard-section">
      <div className="section-title">
        <h1>Configuration Dashboard</h1>
        <p>Overview of all leagues, drafts, and system status</p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-value">{stats.totalLeagues}</div>
            <div className="stat-label">Total Leagues</div>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-value">{stats.completedLeagues}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-value">{stats.activeLeagues}</div>
            <div className="stat-label">In Progress</div>
          </div>
        </div>
        <div className="stat-card info">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <div className="stat-value">{stats.statusCounts['Payout Pending'] || 0}</div>
            <div className="stat-label">Payout Pending</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <button className="action-button" onClick={() => onNavigate('leagues')}>
              <span className="action-icon">🏆</span>
              <span className="action-text">
                <strong>Browse Leagues</strong>
                <small>View all leagues and teams</small>
              </span>
            </button>
            <button className="action-button" onClick={() => onNavigate('draft-status')}>
              <span className="action-icon">📋</span>
              <span className="action-text">
                <strong>Manage Draft Status</strong>
                <small>Update draft phases</small>
              </span>
            </button>
            <button className="action-button" onClick={() => onNavigate('users')}>
              <span className="action-icon">👥</span>
              <span className="action-text">
                <strong>User Management</strong>
                <small>Manage user accounts</small>
              </span>
            </button>
          </div>
        </div>

        {/* Recent Leagues Overview */}
        <div className="dashboard-card">
          <div className="card-header">
            <h3>League Status Overview</h3>
            <button className="text-button" onClick={() => onNavigate('leagues')}>View All</button>
          </div>
          <div className="leagues-mini-list">
            {isLoading ? (
              <div className="loading-state">Loading...</div>
            ) : (
              recentLeagues.map(league => {
                const status = draftStatuses[league.id] || 'Draft In Progress';
                return (
                  <div key={league.id} className="league-mini-item">
                    <div className="league-mini-info">
                      <span 
                        className="league-color-dot" 
                        style={{ backgroundColor: league.color }}
                      />
                      <span className="league-mini-name">{league.name} {league.season}</span>
                    </div>
                    <span className={`status-pill ${status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="dashboard-card full-width">
        <div className="card-header">
          <h3>Draft Status Breakdown</h3>
        </div>
        <div className="status-breakdown">
          {Object.entries(stats.statusCounts).map(([status, count]) => (
            <div key={status} className="status-breakdown-item">
              <div className="breakdown-bar">
                <div 
                  className={`breakdown-fill ${status.toLowerCase().replace(/\s+/g, '-')}`}
                  style={{ width: `${(count / stats.totalLeagues) * 100}%` }}
                />
              </div>
              <div className="breakdown-label">
                <span className="breakdown-status">{status}</span>
                <span className="breakdown-count">{count} league{count !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Activity Log Section Component
const ActivityLogSection = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const initialLogs = await activityLogService.getLogs();
        setLogs(initialLogs);
      } catch (error) {
        console.error('Error loading activity logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();

    const unsubscribe = activityLogService.subscribe((updatedLogs) => {
      setLogs(updatedLogs);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all activity logs? This action cannot be undone.')) {
      try {
        setLoading(true);
        await activityLogService.clearLogs();
        setLogs([]);
      } catch (error) {
        console.error('Error clearing logs:', error);
        alert('Error clearing logs: ' + (error.message || 'Unknown error'));
      } finally {
        setLoading(false);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'log-success';
      case 'error': return 'log-error';
      default: return 'log-info';
    }
  };

  return (
    <div className="activity-section">
      <div className="section-title">
        <div className="title-row">
          <div>
            <h1>Activity Log</h1>
            <p>View system events and draft actions</p>
          </div>
          <button onClick={handleClearLogs} className="danger-button" disabled={loading || logs.length === 0}>
            Clear All Logs
          </button>
        </div>
      </div>

      <div className="activity-log-container">
        {loading ? (
          <div className="empty-state">
            <p>Loading activity logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            <p>No activity logs yet</p>
            <small>Actions like draft picks and system events will appear here</small>
          </div>
        ) : (
          <div className="activity-log-list">
            {logs.map((log) => (
              <div key={log.id} className={`activity-log-entry ${getStatusClass(log.status)}`}>
                <span className="log-entry-icon">{getStatusIcon(log.status)}</span>
                <span className="log-entry-action">{log.action}</span>
                <span className="log-entry-time">
                  {activityLogService.formatTimestamp(log.timestamp)}
                </span>
                <span className="log-entry-message" title={log.message}>{log.message}</span>
                {log.data && Object.keys(log.data).length > 0 && (
                  <details className="log-entry-details">
                    <summary>+</summary>
                    <pre className="log-entry-data">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Site Admins Section — manage Cognito SiteAdmins group
const SiteAdminsSection = () => {
  const [admins, setAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [freeformEmail, setFreeformEmail] = useState('');
  const [inputMode, setInputMode] = useState('dropdown');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [adminList, userList] = await Promise.all([
        listSiteAdmins().catch(() => []),
        listAllUsers().catch(() => [])
      ]);
      setAdmins(adminList);
      setAllUsers(userList.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || '')));
      if (userList.length === 0) setInputMode('freeform');
    } catch (err) {
      setError('Failed to load site admin data');
    } finally {
      setLoading(false);
    }
  };

  const getAvailableUsers = () => {
    const adminUsernames = new Set(admins.map(a => a.username));
    return allUsers.filter(u => !adminUsernames.has(u.username));
  };

  const handleAdd = async (username) => {
    if (!username) return;
    try {
      setSaving(true);
      setError(null);
      await addSiteAdmin(username);
      setSuccess(`Added ${username} as site admin. They must sign out and back in for changes to take effect.`);
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
      setSelectedUser('');
      setFreeformEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (username) => {
    if (!window.confirm(`Remove ${username} from site admins?`)) return;
    try {
      setSaving(true);
      setError(null);
      await removeSiteAdmin(username);
      setSuccess(`Removed ${username} from site admins. They must sign out and back in for changes to take effect.`);
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="settings-section"><div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px' }}>Loading site admins...</div></div>;
  }

  return (
    <div className="settings-section">
      <div className="section-header">
        <h2>Site Admins</h2>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '8px 0 0' }}>
          Manage users in the Cognito SiteAdmins group. Site admins bypass password gates, see all drafts, and have access to admin controls.
        </p>
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem' }}>{success}</div>}

      <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <h3 style={{ color: '#f3f4f6', fontSize: '1rem', fontWeight: 600, margin: 0, flex: 1 }}>Current Site Admins</h3>
          <span style={{ color: '#6b7280', fontSize: '0.75rem', background: '#252525', padding: '4px 10px', borderRadius: '12px' }}>
            {admins.length} admin{admins.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', minHeight: '32px' }}>
          {admins.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '0.8125rem', fontStyle: 'italic' }}>No site admins configured</div>
          ) : (
            admins.map(admin => (
              <div key={admin.username} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '20px', padding: '6px 8px 6px 12px' }}>
                <span style={{ fontSize: '0.6875rem' }}>🛡️</span>
                <span style={{ color: '#d1d5db', fontSize: '0.8125rem' }}>{admin.email || admin.username}</span>
                <button
                  onClick={() => handleRemove(admin.username)}
                  disabled={saving}
                  title="Remove admin"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '50%', color: '#f87171', fontSize: '14px', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add admin controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {allUsers.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', background: '#111', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
              <button
                className={`mode-btn ${inputMode === 'dropdown' ? 'active' : ''}`}
                onClick={() => setInputMode('dropdown')}
                disabled={saving}
              >
                Select User
              </button>
              <button
                className={`mode-btn ${inputMode === 'freeform' ? 'active' : ''}`}
                onClick={() => setInputMode('freeform')}
                disabled={saving}
              >
                Enter Username
              </button>
            </div>
          )}

          {inputMode === 'dropdown' && allUsers.length > 0 ? (
            <div className="add-user-form">
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                disabled={saving}
                className="user-select"
              >
                <option value="">Select a user...</option>
                {getAvailableUsers().map(u => (
                  <option key={u.username} value={u.username}>
                    {u.name || u.email || u.username} ({u.email || u.username})
                  </option>
                ))}
              </select>
              <button
                className="add-user-btn admin-add-btn"
                onClick={() => handleAdd(selectedUser)}
                disabled={saving || !selectedUser}
              >
                {saving ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          ) : (
            <div className="add-user-form">
              <input
                type="text"
                placeholder="Enter Cognito username..."
                value={freeformEmail}
                onChange={e => setFreeformEmail(e.target.value)}
                onKeyPress={e => { if (e.key === 'Enter') handleAdd(freeformEmail.trim()); }}
                disabled={saving}
              />
              <button
                className="add-user-btn admin-add-btn"
                onClick={() => handleAdd(freeformEmail.trim())}
                disabled={saving || !freeformEmail.trim()}
              >
                {saving ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
