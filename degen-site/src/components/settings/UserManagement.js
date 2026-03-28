import React, { useState, useEffect } from 'react';
import { listAllUsers, updateUserDisplayName } from '../../services/cognitoUserService';
import { getUserProfile, saveUserProfile } from '../../services/dynamoDBService';
import './UserManagement.css';

// Note: In production, this should use proper role-based auth
const ADMIN_PASSWORD = 'asdf';

// Users with default post-draft access
const DEFAULT_POST_DRAFT_ACCESS_USERS = ['dev.menon@yahoo.com'];

const UserManagement = ({ onBack, embedded = false, isSiteAdmin = false }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editField, setEditField] = useState(null); // 'name', 'initials', or 'access'
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState('');

  // Check if already authenticated (stored in sessionStorage) or site admin
  useEffect(() => {
    if (isSiteAdmin) {
      setIsAuthenticated(true);
      loadUsers();
      return;
    }
    const authStatus = sessionStorage.getItem('userManagementAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      loadUsers();
    }
  }, [isSiteAdmin]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');

    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('userManagementAuthenticated', 'true');
      loadUsers();
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setSaveError('');
    try {
      const usersList = await listAllUsers();
      
      // Fetch profile data for each user from DynamoDB
      const usersWithProfiles = await Promise.all(
        usersList.map(async (user) => {
          try {
            const profile = await getUserProfile(user.username);
            const hasDefaultAccess = DEFAULT_POST_DRAFT_ACCESS_USERS.includes(user.email);
            return {
              ...user,
              displayInitials: profile?.displayInitials || '',
              postDraftAccess: profile?.postDraftAccess !== undefined 
                ? profile.postDraftAccess 
                : hasDefaultAccess
            };
          } catch (e) {
            const hasDefaultAccess = DEFAULT_POST_DRAFT_ACCESS_USERS.includes(user.email);
            return {
              ...user,
              displayInitials: '',
              postDraftAccess: hasDefaultAccess
            };
          }
        })
      );
      
      setUsers(usersWithProfiles.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      setSaveError(`Failed to load users: ${error.message}`);
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (user, field) => {
    setEditingUserId(user.username);
    setEditField(field);
    if (field === 'name') {
      setEditValue(user.name);
    } else if (field === 'initials') {
      setEditValue(user.displayInitials || '');
    }
    setSaveError('');
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditField(null);
    setEditValue('');
    setSaveError('');
  };

  const handleSaveEdit = async (username) => {
    if (editField === 'name' && !editValue.trim()) {
      setSaveError('Display name cannot be empty');
      return;
    }
    
    if (editField === 'initials' && editValue.length > 3) {
      setSaveError('Display initials must be 3 characters or less');
      return;
    }

    setLoading(true);
    setSaveError('');

    try {
      const user = users.find(u => u.username === username);
      
      if (editField === 'name') {
        await updateUserDisplayName(username, editValue.trim());
        
        // Update local state
        setUsers(users.map(u => 
          u.username === username 
            ? { ...u, name: editValue.trim() }
            : u
        ));
      } else if (editField === 'initials') {
        // Save to DynamoDB profile
        await saveUserProfile(username, {
          displayName: user.name,
          displayInitials: editValue.trim(),
          email: user.email,
          postDraftAccess: user.postDraftAccess
        });
        
        // Update local state
        setUsers(users.map(u => 
          u.username === username 
            ? { ...u, displayInitials: editValue.trim() }
            : u
        ));
      }
      
      setEditingUserId(null);
      setEditField(null);
      setEditValue('');
    } catch (error) {
      setSaveError(`Failed to update: ${error.message}`);
      console.error('Error updating user:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggleAccess = async (user) => {
    setLoading(true);
    setSaveError('');
    
    try {
      const newValue = !user.postDraftAccess;
      
      // Save to DynamoDB profile
      await saveUserProfile(user.username, {
        displayName: user.name,
        displayInitials: user.displayInitials || '',
        email: user.email,
        postDraftAccess: newValue
      });
      
      // Update local state
      setUsers(users.map(u => 
        u.username === user.username 
          ? { ...u, postDraftAccess: newValue }
          : u
      ));
    } catch (error) {
      setSaveError(`Failed to update access: ${error.message}`);
      console.error('Error updating access:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="user-management-section">
        {!embedded && (
          <div className="section-header">
            <button onClick={onBack} className="back-button">
              ← Back to Settings
            </button>
          </div>
        )}
        
        <div className="section-title">
          <h1>User Management</h1>
          <p>Manage user accounts and display names</p>
        </div>
        
        <div className="user-management-auth">
          <div className="auth-card">
            <div className="auth-icon">🔐</div>
            <h3>Admin Access Required</h3>
            <p>Enter the admin password to manage users</p>
            
            <form onSubmit={handlePasswordSubmit} className="auth-form">
              <div className="form-group">
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoFocus
                  required
                />
              </div>
              
              {passwordError && (
                <div className="error-message">{passwordError}</div>
              )}
              
              <button type="submit" className="submit-button">
                Unlock
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management-section">
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
            <h1>User Management</h1>
            <p>Manage user accounts and display names</p>
          </div>
          <button 
            onClick={loadUsers} 
            className="refresh-btn"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="alert alert-error">{saveError}</div>
      )}

      {loading && !users.length ? (
        <div className="loading-state">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <p>No users found</p>
        </div>
      ) : (
        <div className="users-grid">
          {users.map((user) => (
            <div key={user.username} className="user-card">
              <div className="user-card-header">
                <div className="user-avatar">
                  {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <span className="user-name">{user.name || user.username}</span>
                  <span className="user-email">{user.email || 'No email'}</span>
                </div>
                <span className={`user-status status-${user.status?.toLowerCase() || 'unknown'}`}>
                  {user.status || 'Unknown'}
                </span>
              </div>
              <div className="user-card-body">
                <div className="user-detail">
                  <span className="detail-label">Username</span>
                  <span className="detail-value username-value">{user.username}</span>
                </div>
                
                {/* Display Name */}
                <div className="user-detail">
                  <span className="detail-label">Display Name</span>
                  {editingUserId === user.username && editField === 'name' ? (
                    <div className="edit-inline">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(user.username);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                        className="edit-input"
                      />
                      <div className="edit-actions">
                        <button
                          onClick={() => handleSaveEdit(user.username)}
                          className="save-btn"
                          disabled={loading}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="cancel-btn"
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="detail-with-action">
                      <span className="detail-value">{user.name}</span>
                      <button
                        onClick={() => handleStartEdit(user, 'name')}
                        className="edit-btn"
                        disabled={loading || editingUserId !== null}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Display Initials */}
                <div className="user-detail">
                  <span className="detail-label">Display Initials</span>
                  {editingUserId === user.username && editField === 'initials' ? (
                    <div className="edit-inline">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => {
                          // Allow letters, numbers, and emojis, max 3 chars
                          const val = e.target.value;
                          if ([...val].length <= 3) {
                            setEditValue(val);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(user.username);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        placeholder="Max 3 chars"
                        autoFocus
                        className="edit-input initials-input"
                      />
                      <div className="edit-actions">
                        <button
                          onClick={() => handleSaveEdit(user.username)}
                          className="save-btn"
                          disabled={loading}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="cancel-btn"
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="detail-with-action">
                      <span className="detail-value">{user.displayInitials || '—'}</span>
                      <button
                        onClick={() => handleStartEdit(user, 'initials')}
                        className="edit-btn"
                        disabled={loading || editingUserId !== null}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Post-Draft Update Access */}
                <div className="user-detail">
                  <span className="detail-label">Post-Draft Access</span>
                  <div className="detail-with-action">
                    <span className={`access-badge ${user.postDraftAccess ? 'access-yes' : 'access-no'}`}>
                      {user.postDraftAccess ? 'Yes' : 'No'}
                    </span>
                    <button
                      onClick={() => handleToggleAccess(user)}
                      className="toggle-btn"
                      disabled={loading || editingUserId !== null}
                    >
                      {user.postDraftAccess ? 'Revoke' : 'Grant'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserManagement;

