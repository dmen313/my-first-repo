import React, { useEffect, useState, useMemo } from 'react';
import { getCurrentUser, updateUserAttributes, changePassword } from '../../services/authService';
import { saveUserProfile, getUserProfile } from '../../services/dynamoDBService';
import '../SettingsPage.css';

const AccountSecurity = ({ embedded = false }) => {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayInitials, setDisplayInitials] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');

  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          setDisplayName(user.name || '');
          setEmail(user.email || '');
          setUserId(user.username || '');
          
          // Load display initials - try DynamoDB first, fall back to Cognito
          let initials = '';
          try {
            const dbProfile = await getUserProfile(user.username);
            if (dbProfile?.displayInitials) {
              initials = dbProfile.displayInitials;
            }
          } catch (e) {
            console.warn('Could not load profile from DynamoDB:', e);
          }
          
          // Fall back to Cognito custom attribute if not in DynamoDB
          if (!initials) {
            initials = user.attributes?.['custom:displayInitials'] || '';
          }
          
          setDisplayInitials(initials);
        }
      } catch (err) {
        setProfileError(err.message || 'Unable to load profile details.');
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUser();
  }, []);

  const initials = useMemo(() => {
    // Use custom display initials if set
    if (displayInitials) {
      return displayInitials;
    }
    // Otherwise derive from display name
    if (displayName) {
      return displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0].toUpperCase())
        .slice(0, 2)
        .join('');
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'DG';
  }, [displayInitials, displayName, email]);

  const handleDisplayInitialsChange = (e) => {
    // Allow letters, numbers, and emojis, max 3 characters
    const value = e.target.value;
    // Use Array.from to properly count emoji characters
    const chars = Array.from(value);
    if (chars.length <= 3) {
      setDisplayInitials(value);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!displayName.trim()) {
      setProfileError('Display name is required.');
      return;
    }

    // Validate display initials length (using Array.from for emoji support)
    if (displayInitials && Array.from(displayInitials).length > 3) {
      setProfileError('Display initials must be 3 characters or less.');
      return;
    }

    setUpdatingProfile(true);

    try {
      // Save to Cognito
      const attributesToUpdate = { 
        name: displayName.trim(),
        'custom:displayInitials': displayInitials.trim() || ''
      };
      await updateUserAttributes(attributesToUpdate);
      
      // Also save to DynamoDB for easy access across the app
      try {
        await saveUserProfile(userId, {
          displayName: displayName.trim(),
          displayInitials: displayInitials.trim() || '',
          email: email
        });
      } catch (dbError) {
        console.warn('Could not save profile to DynamoDB:', dbError);
        // Don't fail the whole operation if DynamoDB save fails
      }
      
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Unable to update profile.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const validatePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return false;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return false;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.');
      return false;
    }

    const complexityRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!complexityRegex.test(newPassword)) {
      setPasswordError('Include at least one letter and one number in the new password.');
      return false;
    }

    setPasswordError('');
    return true;
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (!validatePassword()) {
      return;
    }

    setUpdatingPassword(true);

    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Unable to update password. Please confirm your current password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="account-security-section">
      {embedded && (
        <div className="section-title">
          <h1>Account & Security</h1>
          <p>Manage your profile and password settings</p>
        </div>
      )}
      <div className="account-security-grid">
      <div className="account-card">
        <div className="account-card-header">
          <div className="account-avatar">{initials}</div>
          <div>
            <h3>Profile Details</h3>
            <p>Manage how your name appears across Degen Hub.</p>
          </div>
        </div>

        {profileError && <div className="account-error">{profileError}</div>}
        {profileSuccess && <div className="account-success">{profileSuccess}</div>}

        <form className="settings-form" onSubmit={handleProfileUpdate}>
          <div className="form-row">
            <label htmlFor="userId">User ID</label>
            <input
              id="userId"
              type="text"
              value={userId}
              disabled
              className="readonly-field"
            />
            <span className="input-hint">Your unique account identifier (read-only).</span>
          </div>

          <div className="form-row">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dana Menon"
              disabled={updatingProfile || loadingProfile}
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="displayInitials">Display Initials</label>
            <input
              id="displayInitials"
              type="text"
              value={displayInitials}
              onChange={handleDisplayInitialsChange}
              placeholder="e.g. DM or 🔥"
              disabled={updatingProfile || loadingProfile}
              className="initials-input"
            />
            <span className="input-hint">Max 3 characters. Letters, numbers, and emojis allowed.</span>
          </div>

          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              placeholder="Email managed via Cognito"
            />
            <span className="input-hint">Email updates handled by your league admin.</span>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={updatingProfile || loadingProfile}>
              {updatingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="account-card">
        <div className="account-card-header">
          <div className="account-icon">🔒</div>
          <div>
            <h3>Change Password</h3>
            <p>Update your password to keep your account secure.</p>
          </div>
        </div>

        {passwordError && <div className="account-error">{passwordError}</div>}
        {passwordSuccess && <div className="account-success">{passwordSuccess}</div>}

        <form className="settings-form" onSubmit={handlePasswordUpdate}>
          <div className="form-row">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              disabled={updatingPassword}
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              disabled={updatingPassword}
              required
              minLength={8}
            />
          </div>

          <div className="form-row">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              disabled={updatingPassword}
              required
              minLength={8}
            />
          </div>

          <div className="password-guidelines">
            <h4>Password guidelines</h4>
            <ul>
              <li>At least 8 characters</li>
              <li>Include at least one letter and one number</li>
              <li>Use a unique password you do not reuse elsewhere</li>
            </ul>
          </div>

          <div className="form-actions">
            <button type="submit" className="secondary-button" disabled={updatingPassword}>
              {updatingPassword ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};

export default AccountSecurity;
