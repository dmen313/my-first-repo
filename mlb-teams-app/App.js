import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMLBTeams();
  }, []);

  const fetchMLBTeams = async () => {
    try {
      setLoading(true);
      console.log('Fetching MLB teams...');
      
      // Using the MLB Stats API (public API)
      const response = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
      const data = await response.json();
      
      console.log('MLB API response:', data);
      
      if (data.teams) {
        console.log(`Found ${data.teams.length} teams`);
        setTeams(data.teams);
      } else {
        console.error('No teams found in response');
        setError('No teams data found');
      }
    } catch (error) {
      console.error('Error fetching MLB teams:', error);
      setError('Failed to fetch MLB teams data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="App">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          color: 'white'
        }}>
          <h2>Loading MLB Data...</h2>
          <p>Fetching real-time team statistics</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          color: 'white'
        }}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchMLBTeams} style={{
            background: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚾ MLB Teams Tracker</h1>
        <p>Real-time standings and team information</p>
      </header>
      
      <main className="teams-container">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2>MLB Teams ({teams.length})</h2>
          <button onClick={fetchMLBTeams} style={{
            background: '#28a745',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}>
            🔄 Refresh Data
          </button>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
          padding: '1rem'
        }}>
          {teams.map(team => (
            <div key={team.id} style={{
              background: 'white',
              padding: '1rem',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h3>{team.name}</h3>
              <p><strong>League:</strong> {team.league?.name || 'Unknown'}</p>
              <p><strong>Division:</strong> {team.division?.name || 'Unknown'}</p>
              <p><strong>Venue:</strong> {team.venue?.name || 'Unknown'}</p>
              <p><strong>City:</strong> {team.venue?.city || 'Unknown'}</p>
            </div>
          ))}
        </div>
        
        {teams.length === 0 && (
          <div style={{ textAlign: 'center', color: 'white', padding: '3rem' }}>
            <p>No teams found.</p>
          </div>
        )}
      </main>
      
      <footer className="App-footer">
        <p>Data provided by MLB Stats API • Last updated: {new Date().toLocaleString()}</p>
      </footer>
    </div>
  );
}

export default App;
