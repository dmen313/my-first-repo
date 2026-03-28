import React, { useState, useEffect } from 'react';
import { getAllDraftAccess, setDraftAccess, setDraftAdminAccess } from '../../services/dynamoDBService';
import { listAllUsers } from '../../services/cognitoUserService';
import './DraftAccessSettings.css';

// Password for Draft Access section
const DRAFT_ACCESS_PASSWORD = 'asdf';

// All leagues configuration
const ALL_LEAGUES = [
  { id: 'nfl-2025', league: 'nfl', season: '2025', name: 'NFL 2025', color: '#059669' },
  { id: 'mlb-2025', league: 'mlb', season: '2025', name: 'MLB 2025', color: '#1e3a8a' },
  { id: 'mlb-2024', league: 'mlb', season: '2024', name: 'MLB 2024', color: '#1e3a8a' },
  { id: 'nba-2025', league: 'nba', season: '2025', name: 'NBA 2025', color: '#dc2626' },
  { id: 'nba-2024', league: 'nba', season: '2024', name: 'NBA 2024', color: '#dc2626' },
  { id: 'ncaa-2025', league: 'ncaa', season: '2025', name: 'NCAA 2025', color: '#7c3aed' },
  { id: 'nhl-2025', league: 'nhl', season: '2025', name: 'NHL 2025', color: '#0891b2' },
  { id: 'nfl-mvp-2025', league: 'nfl-mvp', season: '2025', name: 'NFL MVP 2025', color: '#2563eb' },
  { id: 'ncaa-tourney-2025', league: 'ncaa-tourney', season: '2025', name: 'NCAA Tournament 2025', color: '#7c3aed' },
  { id: 'ncaa-tourney-2026', league: 'ncaa-tourney', season: '2026', name: 'NCAA Tournament 2026', color: '#7c3aed' },
  { id: 'ncaa-tourney-4-2026', league: 'ncaa-tourney-4', season: '2026', name: 'NCAA Tournament 2026 (4-Player)', color: '#8b5cf6' },
  { id: 'ncaa-survivor-2026', league: 'ncaa-survivor', season: '2026', name: 'NCAA Survivor 2026', color: '#dc2626' }
];

const DraftAccessSettings = ({ isSiteAdmin = false }) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const [accessData, setAccessData] = useState({});
  const [adminData, setAdminData] = useState({});
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null);
  const [selectedUser, setSelectedUser] = useState({});
  const [newUserEmail, setNewUserEmail] = useState({});
  const [selectedAdmin, setSelectedAdmin] = useState({});
  const [newAdminEmail, setNewAdminEmail] = useState({});
  const [inputMode, setInputMode] = useState({}); // 'dropdown' or 'freeform'
  const [adminInputMode, setAdminInputMode] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Check if already authenticated (stored in sessionStorage) or site admin
  useEffect(() => {
    if (isSiteAdmin) {
      setIsAuthenticated(true);
      loadData();
      return;
    }
    const authStatus = sessionStorage.getItem('draftAccessAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, [isSiteAdmin]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    if (password === DRAFT_ACCESS_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('draftAccessAuthenticated', 'true');
      loadData();
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load access data first
      const allAccess = await getAllDraftAccess();
      
      // Process access data and admin data
      const accessMap = {};
      const adminMap = {};
      ALL_LEAGUES.forEach(league => {
        accessMap[league.id] = [];
        adminMap[league.id] = [];
      });
      allAccess.forEach(access => {
        const key = `${access.league}-${access.season}`;
        accessMap[key] = access.userEmails || [];
        adminMap[key] = access.adminEmails || [];
      });
      setAccessData(accessMap);
      setAdminData(adminMap);
      
      // Try to load users (may fail if GraphQL endpoint doesn't support it)
      let users = [];
      let usersLoaded = false;
      try {
        users = await listAllUsers();
        usersLoaded = users && users.length > 0;
      } catch (err) {
        console.warn('Could not load users list:', err.message);
        // Not a fatal error - we can still use free-form mode
      }
      
      // Store users sorted by name
      setAllUsers(users.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)));
      
      // Initialize input modes - use dropdown if users loaded, otherwise freeform
      const modes = {};
      const adminModes = {};
      ALL_LEAGUES.forEach(league => {
        modes[league.id] = usersLoaded ? 'dropdown' : 'freeform';
        adminModes[league.id] = usersLoaded ? 'dropdown' : 'freeform';
      });
      setInputMode(modes);
      setAdminInputMode(adminModes);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load access data');
    } finally {
      setLoading(false);
    }
  };

  // Get available users for a specific league (not already assigned)
  const getAvailableUsers = (leagueId) => {
    const assignedEmails = (accessData[leagueId] || []).map(e => e.toLowerCase());
    return allUsers.filter(user => 
      user.email && !assignedEmails.includes(user.email.toLowerCase())
    );
  };

  const handleAddUserFromDropdown = async (leagueConfig) => {
    const email = selectedUser[leagueConfig.id];
    if (!email) return;
    
    await addUserToLeague(leagueConfig, email);
    setSelectedUser(prev => ({ ...prev, [leagueConfig.id]: '' }));
  };

  const handleAddUserFromFreeform = async (leagueConfig) => {
    const email = newUserEmail[leagueConfig.id]?.trim();
    if (!email) return;
    
    // Basic email validation
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    await addUserToLeague(leagueConfig, email);
    setNewUserEmail(prev => ({ ...prev, [leagueConfig.id]: '' }));
  };

  const addUserToLeague = async (leagueConfig, email) => {
    const currentUsers = accessData[leagueConfig.id] || [];
    if (currentUsers.some(e => e.toLowerCase() === email.toLowerCase())) {
      setError('User already has access to this draft');
      return;
    }
    
    try {
      setSaving(leagueConfig.id);
      setError(null);
      
      const updatedUsers = [...currentUsers, email];
      await setDraftAccess(leagueConfig.league, leagueConfig.season, updatedUsers);
      
      setAccessData(prev => ({
        ...prev,
        [leagueConfig.id]: updatedUsers
      }));
      
      setSuccess(`Added ${email} to ${leagueConfig.name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user');
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveUser = async (leagueConfig, emailToRemove) => {
    const currentUsers = accessData[leagueConfig.id] || [];
    
    try {
      setSaving(leagueConfig.id);
      setError(null);
      
      const updatedUsers = currentUsers.filter(
        email => email.toLowerCase() !== emailToRemove.toLowerCase()
      );
      await setDraftAccess(leagueConfig.league, leagueConfig.season, updatedUsers);
      
      setAccessData(prev => ({
        ...prev,
        [leagueConfig.id]: updatedUsers
      }));
      
      setSuccess(`Removed ${emailToRemove} from ${leagueConfig.name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Failed to remove user');
    } finally {
      setSaving(null);
    }
  };

  // --- Admin access handlers ---

  const getAvailableAdmins = (leagueId) => {
    const assignedEmails = (adminData[leagueId] || []).map(e => e.toLowerCase());
    return allUsers.filter(user =>
      user.email && !assignedEmails.includes(user.email.toLowerCase())
    );
  };

  const handleAddAdminFromDropdown = async (leagueConfig) => {
    const email = selectedAdmin[leagueConfig.id];
    if (!email) return;
    await addAdminToLeague(leagueConfig, email);
    setSelectedAdmin(prev => ({ ...prev, [leagueConfig.id]: '' }));
  };

  const handleAddAdminFromFreeform = async (leagueConfig) => {
    const email = newAdminEmail[leagueConfig.id]?.trim();
    if (!email) return;
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    await addAdminToLeague(leagueConfig, email);
    setNewAdminEmail(prev => ({ ...prev, [leagueConfig.id]: '' }));
  };

  const addAdminToLeague = async (leagueConfig, email) => {
    const currentAdmins = adminData[leagueConfig.id] || [];
    if (currentAdmins.some(e => e.toLowerCase() === email.toLowerCase())) {
      setError('User already has admin access to this draft');
      return;
    }

    try {
      setSaving(`admin-${leagueConfig.id}`);
      setError(null);

      const updatedAdmins = [...currentAdmins, email];
      await setDraftAdminAccess(leagueConfig.league, leagueConfig.season, updatedAdmins);

      setAdminData(prev => ({
        ...prev,
        [leagueConfig.id]: updatedAdmins
      }));

      setSuccess(`Added ${email} as admin for ${leagueConfig.name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error adding admin:', err);
      setError('Failed to add admin');
    } finally {
      setSaving(null);
    }
  };

  const handleRemoveAdmin = async (leagueConfig, emailToRemove) => {
    const currentAdmins = adminData[leagueConfig.id] || [];

    try {
      setSaving(`admin-${leagueConfig.id}`);
      setError(null);

      const updatedAdmins = currentAdmins.filter(
        email => email.toLowerCase() !== emailToRemove.toLowerCase()
      );
      await setDraftAdminAccess(leagueConfig.league, leagueConfig.season, updatedAdmins);

      setAdminData(prev => ({
        ...prev,
        [leagueConfig.id]: updatedAdmins
      }));

      setSuccess(`Removed ${emailToRemove} as admin from ${leagueConfig.name}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error removing admin:', err);
      setError('Failed to remove admin');
    } finally {
      setSaving(null);
    }
  };

  // Show password form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="draft-access-settings">
        <div className="password-gate">
          <div className="password-card">
            <div className="lock-icon">🔒</div>
            <h3>Protected Section</h3>
            <p>Enter password to access Draft Access settings</p>
            
            <form onSubmit={handlePasswordSubmit} className="password-form">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
              />
              
              {passwordError && (
                <div className="password-error">{passwordError}</div>
              )}
              
              <button type="submit" className="unlock-btn">
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="draft-access-settings">
        <div className="loading-state">Loading access settings...</div>
      </div>
    );
  }

  return (
    <div className="draft-access-settings">
      <div className="section-header">
        <h2>Draft Access Control</h2>
        <p className="section-description">
          Manage which users can access each draft event. Users without access will not see the draft on their home page.
          If no users are assigned, everyone can access the draft.
        </p>
      </div>

      {error && <div className="access-error">{error}</div>}
      {success && <div className="access-success">{success}</div>}

      <div className="draft-access-list">
        {ALL_LEAGUES.map(league => {
          const users = accessData[league.id] || [];
          const admins = adminData[league.id] || [];
          const isSaving = saving === league.id;
          const isAdminSaving = saving === `admin-${league.id}`;
          
          return (
            <div key={league.id} className="draft-access-card">
              <div className="draft-access-header">
                <div 
                  className="draft-color-indicator" 
                  style={{ backgroundColor: league.color }}
                />
                <h3>{league.name}</h3>
                <span className="user-count">
                  {users.length === 0 ? 'Open to all' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {/* --- Admin Access Section --- */}
              <div className="admin-access-section">
                <div className="admin-section-header">
                  <span className="admin-icon">🛡️</span>
                  <h4>Admin Access</h4>
                  <span className="admin-count">
                    {admins.length === 0 ? 'No admins' : `${admins.length} admin${admins.length !== 1 ? 's' : ''}`}
                  </span>
                </div>

                <div className="admin-list">
                  {admins.length === 0 ? (
                    <div className="no-users">No admins assigned</div>
                  ) : (
                    admins.map(email => (
                      <div key={email} className="user-chip admin-chip">
                        <span className="admin-badge-icon">🛡️</span>
                        <span className="user-email">{email}</span>
                        <button
                          className="remove-user-btn"
                          onClick={() => handleRemoveAdmin(league, email)}
                          disabled={isAdminSaving}
                          title="Remove admin"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="add-user-section">
                  {allUsers.length > 0 && (
                    <div className="input-mode-toggle">
                      <button
                        className={`mode-btn ${adminInputMode[league.id] === 'dropdown' ? 'active' : ''}`}
                        onClick={() => setAdminInputMode(prev => ({ ...prev, [league.id]: 'dropdown' }))}
                        disabled={isAdminSaving}
                      >
                        Select User
                      </button>
                      <button
                        className={`mode-btn ${adminInputMode[league.id] === 'freeform' ? 'active' : ''}`}
                        onClick={() => setAdminInputMode(prev => ({ ...prev, [league.id]: 'freeform' }))}
                        disabled={isAdminSaving}
                      >
                        Enter Email
                      </button>
                    </div>
                  )}

                  {adminInputMode[league.id] === 'dropdown' && allUsers.length > 0 ? (
                    <div className="add-user-form">
                      <select
                        value={selectedAdmin[league.id] || ''}
                        onChange={(e) => setSelectedAdmin(prev => ({
                          ...prev,
                          [league.id]: e.target.value
                        }))}
                        disabled={isAdminSaving}
                        className="user-select"
                      >
                        <option value="">Select a user...</option>
                        {getAvailableAdmins(league.id).map(user => (
                          <option key={user.email} value={user.email}>
                            {user.name || user.email} ({user.email})
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-user-btn admin-add-btn"
                        onClick={() => handleAddAdminFromDropdown(league)}
                        disabled={isAdminSaving || !selectedAdmin[league.id]}
                      >
                        {isAdminSaving ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  ) : (
                    <div className="add-user-form">
                      <input
                        type="email"
                        placeholder="Enter admin email..."
                        value={newAdminEmail[league.id] || ''}
                        onChange={(e) => setNewAdminEmail(prev => ({
                          ...prev,
                          [league.id]: e.target.value
                        }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddAdminFromFreeform(league);
                          }
                        }}
                        disabled={isAdminSaving}
                      />
                      <button
                        className="add-user-btn admin-add-btn"
                        onClick={() => handleAddAdminFromFreeform(league)}
                        disabled={isAdminSaving || !newAdminEmail[league.id]?.trim()}
                      >
                        {isAdminSaving ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}

                  {adminInputMode[league.id] === 'dropdown' && allUsers.length > 0 && getAvailableAdmins(league.id).length === 0 && (
                    <div className="no-available-users">
                      All registered users already have admin access. Use "Enter Email" to add new admins.
                    </div>
                  )}

                  {allUsers.length === 0 && (
                    <div className="no-available-users">
                      Enter admin email addresses to grant admin access.
                    </div>
                  )}
                </div>
              </div>

              {/* --- User Access Section --- */}
              <div className="user-access-section">
                <div className="user-section-header">
                  <span className="user-icon">👥</span>
                  <h4>User Access</h4>
                </div>

                <div className="user-list">
                  {users.length === 0 ? (
                    <div className="no-users">No restrictions - all users can access</div>
                  ) : (
                    users.map(email => (
                      <div key={email} className="user-chip">
                        <span className="user-email">{email}</span>
                        <button
                          className="remove-user-btn"
                          onClick={() => handleRemoveUser(league, email)}
                          disabled={isSaving}
                          title="Remove user"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="add-user-section">
                  {allUsers.length > 0 && (
                    <div className="input-mode-toggle">
                      <button
                        className={`mode-btn ${inputMode[league.id] === 'dropdown' ? 'active' : ''}`}
                        onClick={() => setInputMode(prev => ({ ...prev, [league.id]: 'dropdown' }))}
                        disabled={isSaving}
                      >
                        Select User
                      </button>
                      <button
                        className={`mode-btn ${inputMode[league.id] === 'freeform' ? 'active' : ''}`}
                        onClick={() => setInputMode(prev => ({ ...prev, [league.id]: 'freeform' }))}
                        disabled={isSaving}
                      >
                        Enter Email
                      </button>
                    </div>
                  )}
                  
                  {inputMode[league.id] === 'dropdown' && allUsers.length > 0 ? (
                    <div className="add-user-form">
                      <select
                        value={selectedUser[league.id] || ''}
                        onChange={(e) => setSelectedUser(prev => ({
                          ...prev,
                          [league.id]: e.target.value
                        }))}
                        disabled={isSaving}
                        className="user-select"
                      >
                        <option value="">Select a user...</option>
                        {getAvailableUsers(league.id).map(user => (
                          <option key={user.email} value={user.email}>
                            {user.name || user.email} ({user.email})
                          </option>
                        ))}
                      </select>
                      <button
                        className="add-user-btn"
                        onClick={() => handleAddUserFromDropdown(league)}
                        disabled={isSaving || !selectedUser[league.id]}
                      >
                        {isSaving ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  ) : (
                    <div className="add-user-form">
                      <input
                        type="email"
                        placeholder="Enter user email..."
                        value={newUserEmail[league.id] || ''}
                        onChange={(e) => setNewUserEmail(prev => ({
                          ...prev,
                          [league.id]: e.target.value
                        }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddUserFromFreeform(league);
                          }
                        }}
                        disabled={isSaving}
                      />
                      <button
                        className="add-user-btn"
                        onClick={() => handleAddUserFromFreeform(league)}
                        disabled={isSaving || !newUserEmail[league.id]?.trim()}
                      >
                        {isSaving ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  )}
                  
                  {inputMode[league.id] === 'dropdown' && allUsers.length > 0 && getAvailableUsers(league.id).length === 0 && (
                    <div className="no-available-users">
                      All registered users already have access. Use "Enter Email" to add new users.
                    </div>
                  )}
                  
                  {allUsers.length === 0 && (
                    <div className="no-available-users">
                      Enter user email addresses to grant access.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DraftAccessSettings;
