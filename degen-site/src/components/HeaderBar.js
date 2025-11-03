import React from 'react';
import './HeaderBar.css';

const HeaderBar = ({ user, onSettingsClick, onNavigateSettings, onLogout }) => {
  const initials = user?.name
    ? user.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0].toUpperCase())
        .slice(0, 2)
        .join('')
    : user?.username
    ? user.username.substring(0, 2).toUpperCase()
    : '?';

  return (
    <div className="header-bar">
      <div className="header-left">
        <h2 className="site-title">Sports Hub</h2>
      </div>
      <div className="header-right">
        <button className="settings-link" onClick={onNavigateSettings || onSettingsClick} title="Settings">
          ⚙️
        </button>
        {onLogout && (
          <button className="logout-button" onClick={onLogout} title="Sign Out">
            Sign Out
          </button>
        )}
        <div className="user-pill" title={user?.email || user?.username || ''}>
          <div className="avatar" aria-hidden="true">{initials}</div>
        </div>
      </div>
    </div>
  );
};

export default HeaderBar;
