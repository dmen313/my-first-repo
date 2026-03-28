/**
 * Cognito User Management Service
 * Functions to list and update Cognito users via GraphQL API
 */

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

/**
 * List all users in the Cognito User Pool via GraphQL
 * @returns {Promise<Array>} Array of user objects with username, email, name, and status
 */
export const listAllUsers = async () => {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            listCognitoUsers {
              username
              email
              name
              status
              enabled
              createdAt
              lastModified
            }
          }
        `
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL endpoint returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data.listCognitoUsers || [];
  } catch (error) {
    console.error('Error listing Cognito users:', error);
    throw new Error(`Failed to list users: ${error.message}`);
  }
};

/**
 * Update a user's display name via GraphQL
 * @param {string} username - The username of the user to update
 * @param {string} displayName - The new display name
 * @returns {Promise<void>}
 */
export const listSiteAdmins = async () => {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            listSiteAdmins {
              username
              email
              name
              status
              enabled
            }
          }
        `
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL endpoint returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data.listSiteAdmins || [];
  } catch (error) {
    console.error('Error listing site admins:', error);
    throw new Error(`Failed to list site admins: ${error.message}`);
  }
};

export const addSiteAdmin = async (username) => {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation AddSiteAdmin($username: String!) {
            addSiteAdmin(username: $username)
          }
        `,
        variables: { username }
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL endpoint returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data.addSiteAdmin;
  } catch (error) {
    console.error('Error adding site admin:', error);
    throw new Error(`Failed to add site admin: ${error.message}`);
  }
};

export const removeSiteAdmin = async (username) => {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation RemoveSiteAdmin($username: String!) {
            removeSiteAdmin(username: $username)
          }
        `,
        variables: { username }
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL endpoint returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.errors) throw new Error(result.errors[0].message);
    return result.data.removeSiteAdmin;
  } catch (error) {
    console.error('Error removing site admin:', error);
    throw new Error(`Failed to remove site admin: ${error.message}`);
  }
};

export const updateUserDisplayName = async (username, displayName) => {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          mutation UpdateUserDisplayName($username: String!, $displayName: String!) {
            updateUserDisplayName(username: $username, displayName: $displayName) {
              username
              name
            }
          }
        `,
        variables: {
          username,
          displayName
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL endpoint returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data.updateUserDisplayName;
  } catch (error) {
    console.error('Error updating user display name:', error);
    throw new Error(`Failed to update display name: ${error.message}`);
  }
};

