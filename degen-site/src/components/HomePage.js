import React, { useState, useEffect } from 'react';
import { getAllDraftStatuses, getAllDraftPicksBatch, getUserAccessibleDrafts } from '../services/dynamoDBService';
import './HomePage.css';

// League/season combinations to load
const LEAGUE_SEASONS = [
  { league: 'nfl', season: '2025' },
  { league: 'mlb', season: '2025' },
  { league: 'mlb', season: '2024' },
  { league: 'nba', season: '2025' },
  { league: 'nba', season: '2024' },
  { league: 'ncaa', season: '2025' },
  { league: 'nhl', season: '2025' },
  { league: 'nfl-mvp', season: '2025' },
  { league: 'ncaa-tourney', season: '2025' },
  { league: 'ncaa-tourney', season: '2026' },
  { league: 'ncaa-tourney-4', season: '2026' },
  { league: 'ncaa-survivor', season: '2026' }
];

const HomePage = ({ onLeagueSelect, user, onSettingsClick }) => {
  const currentYear = new Date().getFullYear();
  const [draftStatuses, setDraftStatuses] = useState({});
  const [draftPicksData, setDraftPicksData] = useState({});
  const [accessibleDrafts, setAccessibleDrafts] = useState(null); // null = show all, array = filter
  const [isLoading, setIsLoading] = useState(true);
  
  const loadDraftData = async () => {
    try {
      // Get user email for access filtering
      const userEmail = user?.email || user?.attributes?.email || user?.signInUserSession?.idToken?.payload?.email || '';
      
      console.log('HomePage: Loading draft data for user:', userEmail);
      
      // Load draft statuses, draft picks, and access data IN PARALLEL
      const [statuses, picksMap, accessList] = await Promise.all([
        getAllDraftStatuses(),
        getAllDraftPicksBatch(LEAGUE_SEASONS),
        userEmail ? getUserAccessibleDrafts(userEmail) : Promise.resolve([]) // Empty array = no access, not null
      ]);
      
      console.log('HomePage: Access list for user:', accessList);

      // Process draft statuses
      const statusMap = {};
      statuses.forEach(status => {
        const key = `${status.league}-${status.season}`;
        statusMap[key] = status.status;
      });
      setDraftStatuses(statusMap);

      // Process draft picks - find next pick for each league
      const processedPicksMap = {};
      LEAGUE_SEASONS.forEach(({ league, season }) => {
        const key = `${league}-${season}`;
        const picks = picksMap[key] || [];
        const nextPick = picks.find(pick => !pick.teamId) || null;
        processedPicksMap[key] = { picks, nextPick };
      });
      setDraftPicksData(processedPicksMap);
      
      // Site admins see all drafts; otherwise filter by access list
      setAccessibleDrafts(user?.isSiteAdmin ? null : accessList);
    } catch (err) {
      console.error('Error loading draft data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load draft data when component mounts or user changes
  useEffect(() => {
    loadDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const getDraftStatus = (league, season) => {
    const key = `${league}-${season}`;
    return draftStatuses[key] || null;
  };

  const getNextPickInfo = (league, season) => {
    const key = `${league}-${season}`;
    const data = draftPicksData[key];
    if (data && data.nextPick) {
      return data.nextPick;
    }
    return null;
  };
  
  const getYearClass = (year) => {
    const yearNum = parseInt(year);
    if (yearNum < currentYear) return 'year-past';
    if (yearNum === currentYear) return 'year-current';
    return 'year-future';
  };
  const sportsLeaguesBase = [
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
    },
    {
      id: 'nhl-2025',
      name: 'National Hockey League',
      abbreviation: 'NHL',
      year: '2025',
      description: 'Professional hockey league with 32 teams',
      color: '#0ea5e9',
      logo: '/logos/nhl.png'
    },
    {
      id: 'nfl-mvp-2025',
      name: 'NFL Awards',
      abbreviation: 'MVP',
      year: '2025',
      description: 'NFL MVP race with 32 player candidates',
      color: '#1d4ed8',
      logo: '/logos/nfl.png'
    },
    {
      id: 'ncaa-tourney-2025',
      name: 'NCAA Tournament',
      abbreviation: 'MARCH',
      year: '2025',
      description: 'March Madness bracket draft with 64 teams',
      color: '#7c3aed',
      logo: '/logos/NCAA_logo.svg.png'
    },
    {
      id: 'ncaa-tourney-2026',
      name: 'NCAA Tournament',
      abbreviation: 'MARCH',
      year: '2026',
      description: 'March Madness bracket draft with 64 teams (incl. play-in games)',
      color: '#7c3aed',
      logo: '/logos/NCAA_logo.svg.png'
    },
    {
      id: 'ncaa-tourney-4-2026',
      name: 'NCAA Tournament (4)',
      abbreviation: 'MARCH',
      year: '2026',
      description: 'March Madness bracket draft - 4 players',
      color: '#8b5cf6',
      logo: '/logos/NCAA_logo.svg.png'
    },
    {
      id: 'ncaa-survivor-2026',
      name: 'NCAA Survivor',
      abbreviation: 'SURV',
      year: '2026',
      description: 'NCAA Tournament Survivor Pool - $10 entry, last man standing',
      color: '#dc2626',
      logo: '/logos/NCAA_logo.svg.png'
    }
  ];

  // Filter and sort leagues by draft status priority
  const sportsLeagues = [...sportsLeaguesBase]
    .filter(league => {
      // If accessibleDrafts is null, show all (no access restrictions configured in system)
      if (accessibleDrafts === null) return true;
      // If accessibleDrafts is an array (even empty), filter by it
      // Empty array = user has no access to any drafts
      return accessibleDrafts.includes(league.id);
    })
    .sort((a, b) => {
      const [leagueA, seasonA] = a.id.split('-');
      const [leagueB, seasonB] = b.id.split('-');
      const statusA = getDraftStatus(leagueA, seasonA) || '';
      const statusB = getDraftStatus(leagueB, seasonB) || '';
      
      // Define priority order: Draft In Progress (0) > Draft Completed (1) > Payout Pending (2) > Payout Completed (3)
      const getPriority = (status) => {
        if (status === 'Draft In Progress') return 0;
        if (status === 'Draft Completed') return 1;
        if (status === 'Payout Pending') return 2;
        if (status === 'Payout Completed') return 3;
        return 4; // Unknown statuses go to the end
      };
      
      const priorityA = getPriority(statusA);
      const priorityB = getPriority(statusB);
      
      return priorityA - priorityB;
    });

  // Show loading state to prevent layout shift
  if (isLoading) {
    return (
      <div className="home-page">
        <div className="leagues-grid leagues-loading">
          {sportsLeaguesBase.map(league => (
            <div 
              key={league.id} 
              className="league-card league-card-loading"
              style={{ borderLeftColor: league.color }}
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
              <div className="draft-info-section">
                <div className="draft-status-badge-container">
                  <span className="draft-status-badge status-loading">Loading...</span>
                </div>
              </div>
              <div className="league-action">
                <span className="view-button">View Details →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="leagues-grid">
        {sportsLeagues.map(league => {
          const parts = league.id.split('-');
          const leagueId = parts[0];
          const seasonId = parts.slice(1).join('-');
          const status = getDraftStatus(leagueId, seasonId);
          const isPayoutCompleted = status === 'Payout Completed';
          
          return (
          <div 
            key={league.id} 
            className={`league-card ${isPayoutCompleted ? 'league-card-completed' : ''}`}
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
            
            {/* Draft Status and Next Pick */}
            {(() => {
              const parts = league.id.split('-');
              const leagueId = parts[0]; // 'mlb', 'nba', 'nfl', 'ncaa'
              const seasonId = parts.slice(1).join('-'); // '2024' or '2025'
              const status = getDraftStatus(leagueId, seasonId);
              const nextPick = getNextPickInfo(leagueId, seasonId);
              const hasNextPick = (status === 'Draft In Progress' || !status) && nextPick;

              // Only show if there's a status set or there's a next pick to show
              if (!status && !hasNextPick) {
                return null;
              }

              // Default to 'Draft In Progress' if status is not set but we have picks
              const displayStatus = status || 'Draft In Progress';

              return (
                <div className="draft-info-section">
                  <div className="draft-status-badge-container">
                    <span className={`draft-status-badge status-${displayStatus.toLowerCase().replace(/\s+/g, '-')}`}>
                      {displayStatus}
                    </span>
                  </div>
                  {hasNextPick && (
                    <div className={`next-pick-info next-pick-${nextPick.owner.toLowerCase()}`}>
                      <strong>Next Pick:</strong> {nextPick.owner} (Round {nextPick.round}, Pick #{nextPick.pickNumber})
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="league-action">
              <span className="view-button">View Details →</span>
            </div>
          </div>
          );
        })}
      </div>
      
      <div className="footer-info">
        <p>Click on any league card to explore team information, current records, and ownership details.</p>
      </div>
    </div>
  );
};

export default HomePage;
