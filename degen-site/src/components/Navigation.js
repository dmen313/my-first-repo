import React from 'react';
import './Navigation.css';

const Navigation = ({ currentView, onBackToHome, leagueName }) => {
  // Only show navigation bar on non-home pages
  if (currentView === 'home') {
    return null;
  }

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-league">
          <div className="nav-left">
            <button className="back-button" onClick={onBackToHome} title="Back to Home">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div className="league-title-section">
              {leagueName && leagueName.toLowerCase().includes('mlb') && (
                <img src="/logos/mlb.svg" alt="MLB Logo" className="nav-league-logo" />
              )}
              {leagueName && leagueName.toLowerCase().includes('nba') && (
                <img src="/logos/nba.svg" alt="NBA Logo" className="nav-league-logo" />
              )}
              {leagueName && leagueName.toLowerCase().includes('nfl') && !leagueName.toLowerCase().includes('mvp') && (
                <img src="/logos/nfl.svg" alt="NFL Logo" className="nav-league-logo" />
              )}
              {leagueName && leagueName.toLowerCase().includes('ncaa') && (
                <img src="/logos/NCAA_logo.svg.png" alt="NCAA Logo" className="nav-league-logo" />
              )}
              {leagueName && leagueName.toLowerCase().includes('nhl') && (
                <img src="/logos/nhl.png" alt="NHL Logo" className="nav-league-logo" />
              )}
              <h2>{leagueName}</h2>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
