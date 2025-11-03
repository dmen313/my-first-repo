/**
 * Authentication service using AWS Cognito
 */

import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_MI78r8fcJ',
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID || '',
};

const userPool = poolData.ClientId ? new CognitoUserPool(poolData) : null;

/**
 * Sign in a user
 */
export const signIn = async (username, password) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito not configured. Please set REACT_APP_COGNITO_CLIENT_ID'));
      return;
    }

    const authenticationDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const accessToken = result.getAccessToken().getJwtToken();
        const idToken = result.getIdToken().getJwtToken();
        const refreshToken = result.getRefreshToken().getToken();
        
        // Get user attributes
        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            reject(err);
            return;
          }
          
          const userAttributes = {};
          attributes.forEach(attr => {
            userAttributes[attr.Name] = attr.Value;
          });
          
          resolve({
            accessToken,
            idToken,
            refreshToken,
            user: {
              username: username,
              email: userAttributes.email || username,
              name: userAttributes.name || userAttributes['custom:name'] || username,
              attributes: userAttributes,
            },
          });
        });
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        // Handle new password required
        reject(new Error('New password required. Please use changePassword function.'));
      },
    });
  });
};

/**
 * Sign out current user
 */
export const signOut = () => {
  if (!userPool) {
    return Promise.resolve();
  }
  
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
  
  // Clear local storage
  localStorage.removeItem('cognitoUser');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('idToken');
  
  return Promise.resolve();
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      resolve(null);
      return;
    }

    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        resolve(null);
        return;
      }

      cognitoUser.getUserAttributes((err, attributes) => {
        if (err) {
          reject(err);
          return;
        }

        const userAttributes = {};
        attributes.forEach(attr => {
          userAttributes[attr.Name] = attr.Value;
        });

        resolve({
          username: cognitoUser.getUsername(),
          email: userAttributes.email || cognitoUser.getUsername(),
          name: userAttributes.name || userAttributes['custom:name'] || cognitoUser.getUsername(),
          attributes: userAttributes,
          session: session,
        });
      });
    });
  });
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  try {
    const user = await getCurrentUser();
    return user !== null;
  } catch (error) {
    return false;
  }
};

/**
 * Get access token
 */
export const getAccessToken = async () => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito not configured'));
      return;
    }

    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      reject(new Error('No user logged in'));
      return;
    }

    cognitoUser.getSession((err, session) => {
      if (err || !session.isValid()) {
        reject(new Error('Session invalid'));
        return;
      }

      resolve(session.getAccessToken().getJwtToken());
    });
  });
};

