import React, { useState, useEffect } from 'react';
import { ApolloProvider } from '@apollo/client';
import './App.css';
import Navigation from './components/Navigation';
import HomePage from './components/HomePage';
import TeamTable from './components/TeamTable';
import HeaderBar from './components/HeaderBar';
import SettingsPage from './components/SettingsPage';
import TeamOwners from './components/TeamOwners';
import AdminPage from './components/AdminPage';
import LoginPage from './components/LoginPage';
import { client } from './graphql/client';
import { getCurrentUser, signOut } from './services/authService';

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

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setCurrentView('home');
  };

  const handleLogout = async () => {
    try {
      await signOut();
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
      'mlb-2024': 'Major League Baseball 2024',
      'mlb-2025': 'Major League Baseball 2025',
      'nba-2024': 'National Basketball Association 2024',
      'nba-2025': 'National Basketball Association 2025',
      'nfl-2025': 'National Football League 2025',
      'ncaa-2025': 'NCAA Football 2025'
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

  return (
    <ApolloProvider client={client}>
      <div className="App">
        {currentView === 'home' && (
          <HeaderBar 
            user={user} 
            onNavigateSettings={handleSettingsClick} 
            onSettingsClick={handleSettingsClick}
            onLogout={handleLogout}
          />
        )}

        <Navigation 
          currentView={currentView}
          onBackToHome={handleBackToHome}
          leagueName={selectedLeague ? getLeagueName(selectedLeague) : ''}
          user={currentView === 'league' ? user : null}
          onSettingsClick={currentView === 'league' ? handleSettingsClick : null}
          onLogout={handleLogout}
        />
        
        {currentView === 'home' && (
          <HomePage onLeagueSelect={handleLeagueSelect} />
        )}

        {currentView === 'league' && (
          <div className="league-view">
            {(selectedLeague === 'mlb-2024' || selectedLeague === 'mlb-2025' || selectedLeague === 'nba-2024' || selectedLeague === 'nba-2025' || selectedLeague === 'nfl-2025' || selectedLeague === 'ncaa-2025') && (
              <>
                {console.log(`🏈 Rendering TeamTable with leagueId: ${selectedLeague}`)}
                <TeamTable leagueId={selectedLeague} />
              </>
            )}
            {selectedLeague !== 'mlb-2024' && selectedLeague !== 'mlb-2025' && selectedLeague !== 'nba-2024' && selectedLeague !== 'nba-2025' && selectedLeague !== 'nfl-2025' && selectedLeague !== 'ncaa-2025' && (
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
          />
        )}

        {currentView === 'team-owners' && (
          <div>
            <Navigation onBackToHome={handleBackToHome} />
            <TeamOwners />
          </div>
        )}

        {currentView === 'admin' && (
          <AdminPage onBackToHome={handleBackToHome} />
        )}
        </div>
      </ApolloProvider>
  );
}

export default App;
