/**
 * Authentication service using AWS Cognito
 */

import { CognitoUserPool, CognitoUser, AuthenticationDetails, CognitoUserAttribute } from 'amazon-cognito-identity-js';

const SITE_ADMIN_GROUP = 'SiteAdmins';

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

        const idTokenPayload = result.getIdToken().decodePayload();
        const groups = idTokenPayload['cognito:groups'] || [];
        console.log('[Auth] signIn – idToken groups:', groups, 'isSiteAdmin:', groups.includes(SITE_ADMIN_GROUP));
        console.log('[Auth] signIn – full idToken claims keys:', Object.keys(idTokenPayload));
        
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
              groups,
              isSiteAdmin: groups.includes(SITE_ADMIN_GROUP),
            },
          });
        });
      },
      onFailure: (err) => {
        reject(err);
      },
      newPasswordRequired: (userAttributes, requiredAttributes) => {
        // Return the cognitoUser so the UI can complete the password change
        reject({
          code: 'NewPasswordRequired',
          message: 'New password required',
          cognitoUser: cognitoUser,
          userAttributes: userAttributes,
          requiredAttributes: requiredAttributes
        });
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

      const idTokenPayload = session.getIdToken().decodePayload();
      const groups = idTokenPayload['cognito:groups'] || [];
      console.log('[Auth] getCurrentUser – idToken groups:', groups, 'isSiteAdmin:', groups.includes(SITE_ADMIN_GROUP));
      console.log('[Auth] getCurrentUser – full idToken claims keys:', Object.keys(idTokenPayload));

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
          groups,
          isSiteAdmin: groups.includes(SITE_ADMIN_GROUP),
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

export const initiateForgotPassword = (username) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito not configured. Please set REACT_APP_COGNITO_CLIENT_ID'));
      return;
    }

    if (!username) {
      reject(new Error('Username or email is required'));
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    let resolved = false;

    cognitoUser.forgotPassword({
      onSuccess: (data) => {
        if (!resolved) {
          resolved = true;
          resolve({ step: 'CONFIRM', data });
        }
      },
      onFailure: (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      },
      inputVerificationCode: (data) => {
        if (!resolved) {
          resolved = true;
          resolve({ step: 'CODE_SENT', data });
        }
      },
    });
  });
};

export const confirmForgotPassword = (username, verificationCode, newPassword) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito not configured. Please set REACT_APP_COGNITO_CLIENT_ID'));
      return;
    }

    if (!username || !verificationCode || !newPassword) {
      reject(new Error('Username, verification code, and new password are required'));
      return;
    }

    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    cognitoUser.confirmPassword(verificationCode, newPassword, {
      onSuccess: () => resolve(true),
      onFailure: (err) => reject(err),
    });
  });
};

export const updateUserAttributes = (attributes = {}) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito not configured. Please set REACT_APP_COGNITO_CLIENT_ID'));
      return;
    }

    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      reject(new Error('No user logged in'));
      return;
    }

    cognitoUser.getSession((sessionErr) => {
      if (sessionErr) {
        reject(sessionErr);
        return;
      }

      const attributeList = Object.entries(attributes)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([Name, Value]) => new CognitoUserAttribute({ Name, Value }));

      if (attributeList.length === 0) {
        resolve(true);
        return;
      }

      cognitoUser.updateAttributes(attributeList, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  });
};

export const completeNewPasswordChallenge = (cognitoUser, newPassword, userAttributes = {}) => {
  return new Promise((resolve, reject) => {
    if (!cognitoUser) {
      reject(new Error('No user provided'));
      return;
    }

    cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, {
      onSuccess: (result) => {
        const idTokenPayload = result.getIdToken().decodePayload();
        const groups = idTokenPayload['cognito:groups'] || [];

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            reject(err);
            return;
          }

          const attrs = {};
          attributes.forEach(attr => {
            attrs[attr.Name] = attr.Value;
          });

          resolve({
            accessToken: result.getAccessToken().getJwtToken(),
            idToken: result.getIdToken().getJwtToken(),
            refreshToken: result.getRefreshToken().getToken(),
            user: {
              username: cognitoUser.getUsername(),
              email: attrs.email || cognitoUser.getUsername(),
              name: attrs.name || attrs['custom:name'] || cognitoUser.getUsername(),
              attributes: attrs,
              groups,
              isSiteAdmin: groups.includes(SITE_ADMIN_GROUP),
            },
          });
        });
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
};

export const changePassword = (oldPassword, newPassword) => {
  return new Promise((resolve, reject) => {
    if (!userPool) {
      reject(new Error('Cognito not configured. Please set REACT_APP_COGNITO_CLIENT_ID'));
      return;
    }

    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      reject(new Error('No user logged in'));
      return;
    }

    cognitoUser.getSession((sessionErr) => {
      if (sessionErr) {
        reject(sessionErr);
        return;
      }

      cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  });
};

