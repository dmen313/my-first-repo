import React from 'react';
import './HomePage.css';

const HomePage = ({ onLeagueSelect, user, onSettingsClick }) => {
  const currentYear = new Date().getFullYear();
  
  const getYearClass = (year) => {
    const yearNum = parseInt(year);
    if (yearNum < currentYear) return 'year-past';
    if (yearNum === currentYear) return 'year-current';
    return 'year-future';
  };
  const sportsLeagues = [
    {
      id: 'mlb-2024',
      name: 'Major League Baseball',
      abbreviation: 'MLB',
      year: '2024',
      description: 'Professional baseball league with 30 teams',
      color: '#1e3a8a',
      logo: '/logos/mlb_png.png'
    },
    {
      id: 'mlb-2025',
      name: 'Major League Baseball',
      abbreviation: 'MLB',
      year: '2025',
      description: 'Professional baseball league with 30 teams',
      color: '#1e3a8a',
      logo: '/logos/mlb_png.png'
    },
    {
      id: 'nba-2024',
      name: 'National Basketball Association',
      abbreviation: 'NBA',
      year: '2024',
      description: 'Professional basketball league with 30 teams',
      color: '#dc2626',
      logo: '/logos/nba.svg'
    },
    {
      id: 'nba-2025',
      name: 'National Basketball Association',
      abbreviation: 'NBA',
      year: '2025',
      description: 'Professional basketball league with 30 teams',
      color: '#dc2626',
      logo: '/logos/nba.svg'
    },
    {
      id: 'nfl-2025',
      name: 'National Football League',
      abbreviation: 'NFL',
      year: '2025',
      description: 'Professional football league with 32 teams',
      color: '#059669',
      logo: '/logos/nfl.png'
    },
    {
      id: 'ncaa-2025',
      name: 'NCAA Football',
      abbreviation: 'NCAA',
      year: '2025',
      description: 'College football with 12-team playoff format',
      color: '#7c2d12',
      logo: '/logos/NCAA_logo.svg.png'
    }
  ];

  return (
    <div className="home-page">
      <div className="leagues-grid">
        {sportsLeagues.map(league => (
          <div 
            key={league.id} 
            className="league-card"
            style={{ borderLeftColor: league.color }}
            onClick={() => onLeagueSelect(league.id)}
          >
            <div className="league-header-row">
              <div className="league-title">
                <img className="league-logo-inline" src={league.logo} alt={`${league.abbreviation} logo`} />
                <h2 className="league-name-inline">{league.name}</h2>
                <span className={`league-year-inline ${getYearClass(league.year)}`}>{league.year}</span>
              </div>
              <span className="league-chip" style={{ backgroundColor: league.color }}>
                {league.abbreviation}
              </span>
            </div>

            <p className="league-description">{league.description}</p>
            <div className="league-action">
              <span className="view-button">View Details →</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="footer-info">
        <p>Click on any league card to explore team information, current records, and ownership details.</p>
      </div>
    </div>
  );
};

export default HomePage;
