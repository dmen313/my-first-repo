import React from 'react';
import './Navigation.css';

const Navigation = ({ currentView, onBackToHome, leagueName, user, onSettingsClick, onLogout }) => {
  return (
    <nav className="navigation">
      <div className="nav-container">
        {currentView !== 'home' && (
          <div className="nav-league">
            <div className="nav-left">
              <button className="back-button" onClick={onBackToHome} title="Back to Home">
                🏠
              </button>
              <div className="league-title-section">
                {leagueName && leagueName.toLowerCase().includes('mlb') && (
                  <img src="/logos/mlb.svg" alt="MLB Logo" className="nav-league-logo" />
                )}
                {leagueName && leagueName.toLowerCase().includes('ncaa') && (
                  <img src="/logos/NCAA_logo.svg.png" alt="NCAA Logo" className="nav-league-logo" />
                )}
                <h2>{leagueName}</h2>
              </div>
            </div>
            {user && (
              <div className="nav-right">
                {onSettingsClick && (
                  <button className="settings-link" onClick={onSettingsClick} title="Settings">
                    ⚙️
                  </button>
                )}
                {onLogout && (
                  <button className="logout-button" onClick={onLogout} title="Sign Out">
                    Sign Out
                  </button>
                )}
                <div className="user-pill" title={user?.email || user?.username || ''}>
                  <div className="avatar" aria-hidden="true">
                    {user?.name
                      ? user.name
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0].toUpperCase())
                          .slice(0, 2)
                          .join('')
                      : user?.username
                      ? user.username.substring(0, 2).toUpperCase()
                      : '?'}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;



