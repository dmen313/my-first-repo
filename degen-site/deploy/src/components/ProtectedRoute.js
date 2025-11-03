import React, { useEffect, useState } from 'react';
import { getCurrentUser } from '../services/authService';
import LoginPage from './LoginPage';

/**
 * Protected Route Component
 * Wraps any component to ensure user is authenticated
 */
const ProtectedRoute = ({ children, onLoginSuccess }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser && currentUser.session && currentUser.session.isValid()) {
          setUser(currentUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('ProtectedRoute: Auth check failed', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Re-validate on focus (user comes back to tab)
    const handleFocus = () => {
      checkAuth();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <div>Verifying authentication...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={onLoginSuccess} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

