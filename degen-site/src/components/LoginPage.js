import React, { useState, useEffect } from 'react';
import './LoginPage.css';
import { signIn, getCurrentUser, initiateForgotPassword, confirmForgotPassword, completeNewPasswordChallenge } from '../services/authService';

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset' | 'newPassword'
  const [resetUsername, setResetUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cognitoUser, setCognitoUser] = useState(null); // For new password flow

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          onLoginSuccess(user);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [onLoginSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const result = await signIn(username, password);
      onLoginSuccess(result.user);
    } catch (err) {
      if (err.code === 'NewPasswordRequired') {
        // User needs to set a new password (first-time login with temp password)
        setCognitoUser(err.cognitoUser);
        setMode('newPassword');
        setSuccessMessage('Please set a new password to complete your account setup.');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
        console.error('Login error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const result = await completeNewPasswordChallenge(cognitoUser, newPassword);
      setSuccessMessage('Password set successfully!');
      onLoginSuccess(result.user);
    } catch (err) {
      setError(err.message || 'Failed to set new password.');
      console.error('New password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    const targetUsername = resetUsername || username;
    if (!targetUsername) {
      setError('Please enter your username or email.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await initiateForgotPassword(targetUsername.trim());
      setSuccessMessage(
        response?.data?.CodeDeliveryDetails?.Destination
          ? `Code sent to ${response.data.CodeDeliveryDetails.Destination}`
          : 'Verification code sent. Check your email.'
      );
      setResetUsername(targetUsername.trim());
      setMode('reset');
    } catch (err) {
      setError(err.message || 'Unable to send code. Please try again.');
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!verificationCode.trim()) {
      setError('Verification code is required.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await confirmForgotPassword(resetUsername.trim(), verificationCode.trim(), newPassword);
      setSuccessMessage('Password updated. You may now sign in.');
      setPassword('');
      setVerificationCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMode('login');
      if (!username) {
        setUsername(resetUsername.trim());
      }
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
      console.error('Confirm password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMode('login');
    setError('');
    setLoading(false);
    setSuccessMessage('');
    setVerificationCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    if (resetUsername) {
      setUsername(resetUsername);
    }
  };

  if (checkingAuth) {
    return (
      <div className="login-page">
        <div className="login-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <img 
          src="/logos/degen-logo-dark.png" 
          alt="Degen4" 
          className="login-logo"
        />
        <h1 className="login-title">Degen4</h1>

        {error && <div className="login-error">{error}</div>}
        {successMessage && <div className="login-success">{successMessage}</div>}

        {mode === 'login' && (
          <form onSubmit={handleSubmit} className="login-form">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (!resetUsername) setResetUsername(e.target.value);
              }}
              placeholder="Username or Email"
              required
              autoComplete="username"
              disabled={loading}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !username || !password}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              className="login-link"
              onClick={() => {
                setMode('forgot');
                setError('');
                setSuccessMessage('');
                setResetUsername(username);
              }}
              disabled={loading}
            >
              Forgot password?
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="login-form">
            <input
              type="text"
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              placeholder="Username or Email"
              required
              autoComplete="username"
              disabled={loading}
            />
            <button type="submit" disabled={loading || !resetUsername}>
              {loading ? 'Sending...' : 'Send Code'}
            </button>
            <button type="button" className="login-link" onClick={handleBackToLogin} disabled={loading}>
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleConfirmReset} className="login-form">
            <input
              type="text"
              value={resetUsername}
              onChange={(e) => setResetUsername(e.target.value)}
              placeholder="Username or Email"
              required
              autoComplete="username"
              disabled={loading}
            />
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Verification Code"
              required
              autoComplete="one-time-code"
              disabled={loading}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              required
              autoComplete="new-password"
              disabled={loading}
              minLength={8}
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm New Password"
              required
              autoComplete="new-password"
              disabled={loading}
              minLength={8}
            />
            <button
              type="submit"
              disabled={loading || !resetUsername || !verificationCode || !newPassword || !confirmNewPassword}
            >
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
            <div className="login-links-row">
              <button type="button" className="login-link" onClick={handleBackToLogin} disabled={loading}>
                Back to sign in
              </button>
              <button type="button" className="login-link" onClick={handleForgotPassword} disabled={loading}>
                Resend code
              </button>
            </div>
          </form>
        )}

        {mode === 'newPassword' && (
          <form onSubmit={handleNewPasswordSubmit} className="login-form">
            <p className="login-info">Welcome! Please set a new password to complete your account setup.</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              required
              autoComplete="new-password"
              disabled={loading}
              minLength={8}
            />
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Confirm New Password"
              required
              autoComplete="new-password"
              disabled={loading}
              minLength={8}
            />
            <button
              type="submit"
              disabled={loading || !newPassword || !confirmNewPassword}
            >
              {loading ? 'Setting Password...' : 'Set Password'}
            </button>
            <button
              type="button"
              className="login-link"
              onClick={() => {
                setMode('login');
                setNewPassword('');
                setConfirmNewPassword('');
                setCognitoUser(null);
                setError('');
                setSuccessMessage('');
              }}
              disabled={loading}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
