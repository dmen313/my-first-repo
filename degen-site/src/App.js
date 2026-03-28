import React, { useState, useEffect } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import HomePage from './components/HomePage';
import TeamTable from './components/TeamTable';
import NCAADraftSection from './components/NCAADraftSection';
import NCAASurvivorSection from './components/NCAASurvivorSection';
import HeaderBar from './components/HeaderBar';
import SettingsPage from './components/SettingsPage';
import TeamOwners from './components/TeamOwners';
import AdminPage from './components/AdminPage';
import LoginPage from './components/LoginPage';
import VersionMarker from './components/VersionMarker';
import { getCurrentUser, signOut } from './services/authService';
import { clearDynamoDBClientCache, preInitializeDynamoDBClient, checkUserDraftAccess } from './services/dynamoDBService';
import { ApolloProvider } from '@apollo/client';
import { client } from './graphql/client';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing authentication on mount and validate session
  const validateAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (currentUser && currentUser.session && currentUser.session.isValid()) {
        console.log('[App] validateAuth – user:', { isSiteAdmin: currentUser?.isSiteAdmin, groups: currentUser?.groups, email: currentUser?.email });
        setUser(currentUser);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error('Error validating authentication:', error);
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      await validateAuth();
      setLoading(false);
    };

    checkAuth();

    // Set up periodic session validation (every 5 minutes)
    const authCheckInterval = setInterval(async () => {
      const isValid = await validateAuth();
      if (!isValid) {
        // Session expired, user will see login page
        setCurrentView('home');
        setSelectedLeague(null);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Also validate on window focus (user comes back to tab)
    const handleFocus = async () => {
      const isValid = await validateAuth();
      if (!isValid) {
        setCurrentView('home');
        setSelectedLeague(null);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(authCheckInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleLoginSuccess = async (userData) => {
    // After successful login, get the full user object with session
    // This ensures the user object is consistent with what validateAuth returns
    try {
      const fullUser = await getCurrentUser();
      
      // Clear and reinitialize DynamoDB client with new credentials
      clearDynamoDBClientCache();
      await preInitializeDynamoDBClient();
      
      const finalUser = fullUser || userData;
      console.log('[App] handleLoginSuccess – user:', { isSiteAdmin: finalUser?.isSiteAdmin, groups: finalUser?.groups, email: finalUser?.email });
      setUser(finalUser);
    } catch (error) {
      console.error('Error getting user after login:', error);
      console.log('[App] handleLoginSuccess fallback – userData:', { isSiteAdmin: userData?.isSiteAdmin, groups: userData?.groups, email: userData?.email });
      setUser(userData);
    }
    setCurrentView('home');
  };

  const handleLogout = async () => {
    try {
      await signOut();
      // Clear DynamoDB client cache on logout
      clearDynamoDBClientCache();
      setUser(null);
      setCurrentView('home');
      setSelectedLeague(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Protected route handler - validates auth before navigation
  const navigateWithAuth = async (view, ...args) => {
    const isValid = await validateAuth();
    if (!isValid) {
      // If not authenticated, stay on current view but user will see login
      return;
    }
    
    // Navigation handlers
    switch(view) {
      case 'league':
        setSelectedLeague(args[0]);
        setCurrentView('league');
        break;
      case 'home':
        setCurrentView('home');
        setSelectedLeague(null);
        break;
      case 'settings':
        setCurrentView('settings');
        break;
      case 'team-owners':
        setCurrentView('team-owners');
        break;
      case 'admin':
        setCurrentView('admin');
        break;
      default:
        setCurrentView(view);
    }
  };

  const handleLeagueSelect = async (leagueId) => {
    console.log(`🎯 League selected: ${leagueId}`);
    
    // Site admins bypass draft access checks
    if (!user?.isSiteAdmin) {
      const userEmail = user?.email || user?.attributes?.email || '';
      if (userEmail) {
        const parts = leagueId.split('-');
        const season = parts.pop();
        const league = parts.join('-');
        
        const hasAccess = await checkUserDraftAccess(userEmail, league, season);
        if (!hasAccess) {
          console.warn(`❌ User ${userEmail} does not have access to ${leagueId}`);
          alert('You do not have access to this draft.');
          return;
        }
      }
    }
    
    await navigateWithAuth('league', leagueId);
  };

  const handleBackToHome = async () => {
    await navigateWithAuth('home');
  };

  const handleSettingsClick = async () => {
    await navigateWithAuth('settings');
  };

  const handleTeamOwnersClick = async () => {
    await navigateWithAuth('team-owners');
  };

  const handleAdminClick = async () => {
    await navigateWithAuth('admin');
  };

  const getLeagueName = (leagueId) => {
    const leagueNames = {
      'mlb-2024': 'MLB 2024',
      'mlb-2025': 'MLB 2025',
      'nba-2024': 'NBA 2024',
      'nba-2025': 'NBA 2025',
      'nfl-2025': 'NFL 2025',
      'ncaa-2025': 'NCAA Football 2025',
      'ncaa-tourney-2025': 'NCAA Tournament 2025',
      'ncaa-tourney-2026': 'NCAA Tournament 2026',
      'ncaa-tourney-4-2026': 'NCAA Tournament 2026 (4-Player)'
    };
    return leagueNames[leagueId] || 'League';
  };

  

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="App">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated - ALL pages require auth
  if (!user) {
    return (
      <div className="App">
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Always wrap with ApolloProvider (even with no-op client) to satisfy hook requirements
  // The client is configured to work with direct DynamoDB when needed
  return (
    <ApolloProvider client={client}>
      <div className="App">
        <HeaderBar 
          user={user} 
          onNavigateSettings={handleSettingsClick} 
          onSettingsClick={handleSettingsClick}
          onLogout={handleLogout}
          onBackToHome={currentView === 'league' ? handleBackToHome : null}
          onHomeClick={handleBackToHome}
        />
        
        {currentView === 'home' && (
          <HomePage onLeagueSelect={handleLeagueSelect} user={user} />
        )}

        {currentView === 'league' && (
          <div className="league-view">
            {/* NCAA Survivor Pool */}
            {selectedLeague?.startsWith('ncaa-survivor-') && (
              <NCAASurvivorSection leagueId={selectedLeague} onBack={handleBackToHome} user={user} />
            )}
            {/* NCAA Tournament Bracket Draft */}
            {selectedLeague?.startsWith('ncaa-tourney-') && (
              <>
                {console.log(`🏀 Rendering NCAADraftSection with leagueId: ${selectedLeague}`)}
                <NCAADraftSection leagueId={selectedLeague} onBack={handleBackToHome} />
              </>
            )}
            {/* Regular Draft Leagues */}
            {(selectedLeague === 'mlb-2024' || selectedLeague === 'mlb-2025' || selectedLeague === 'nba-2024' || selectedLeague === 'nba-2025' || selectedLeague === 'nfl-2025' || selectedLeague === 'ncaa-2025' || selectedLeague === 'nhl-2025' || selectedLeague === 'nfl-mvp-2025') && (
              <>
                {console.log(`🏈 Rendering TeamTable with leagueId: ${selectedLeague}`)}
                <TeamTable leagueId={selectedLeague} />
              </>
            )}
            {/* Coming Soon for unrecognized leagues */}
            {selectedLeague && !selectedLeague.startsWith('ncaa-tourney-') && !selectedLeague.startsWith('ncaa-survivor-') && selectedLeague !== 'mlb-2024' && selectedLeague !== 'mlb-2025' && selectedLeague !== 'nba-2024' && selectedLeague !== 'nba-2025' && selectedLeague !== 'nfl-2025' && selectedLeague !== 'ncaa-2025' && selectedLeague !== 'nhl-2025' && selectedLeague !== 'nfl-mvp-2025' && (
              <div className="coming-soon">
                <h2>Coming Soon!</h2>
                <p>Team data for {getLeagueName(selectedLeague)} will be available soon.</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'settings' && (
          <SettingsPage 
            onTeamOwnersClick={handleTeamOwnersClick}
            onAdminClick={handleAdminClick}
            isSiteAdmin={user?.isSiteAdmin}
          />
        )}

        {currentView === 'team-owners' && (
          <div>
            <Navigation onBackToHome={handleBackToHome} />
            <TeamOwners />
          </div>
        )}

        {currentView === 'admin' && (
          <AdminPage 
            onBackToHome={handleBackToHome}
          />
        )}

        <VersionMarker />
      </div>
    </ApolloProvider>
  );
}

export default App;
