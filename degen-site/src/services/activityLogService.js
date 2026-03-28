/**
 * Activity Log Service
 * Provides persistent log storage in DynamoDB for user actions
 */

class ActivityLogService {
  constructor() {
    this.maxLogs = 100; // Keep last 100 logs in memory cache
    this.logs = [];
    this.listeners = new Set();
    this.loading = false;
    this.lastFetchTime = 0;
    this.cacheTimeout = 5000; // Cache for 5 seconds before refetching
  }

  /**
   * Load logs from DynamoDB
   * @private
   */
  async _loadLogsFromDB() {
    if (this.loading) return this.logs;
    
    try {
      this.loading = true;
      const { getActivityLogs } = await import('./dynamoDBService');
      const dbLogs = await getActivityLogs(this.maxLogs);
      
      // Convert DynamoDB timestamps to Date objects
      this.logs = dbLogs.map(log => ({
        ...log,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(log.timestampNumber || Date.now())
      }));
      
      this.lastFetchTime = Date.now();
      return this.logs;
    } catch (error) {
      console.error('Error loading activity logs from DynamoDB:', error);
      return this.logs; // Return cached logs on error
    } finally {
      this.loading = false;
    }
  }

  /**
   * Refresh logs from database if cache is stale
   * @private
   */
  async _refreshIfNeeded() {
    const now = Date.now();
    if (now - this.lastFetchTime > this.cacheTimeout) {
      await this._loadLogsFromDB();
      // Notify listeners of updated logs
      this.listeners.forEach(listener => listener(this.logs));
    }
  }

  /**
   * Add a log entry
   * @param {string} action - The action performed (e.g., "Delete Last Pick", "Make Draft Pick")
   * @param {object} details - Additional details about the action
   * @param {string} details.message - Human-readable message
   * @param {object} details.data - Additional data about the action
   * @param {string} details.status - "success" | "error" | "info"
   */
  async log(action, details = {}) {
    try {
      const { createActivityLog } = await import('./dynamoDBService');
      
      const logEntry = await createActivityLog({
        action,
        message: details.message || action,
        data: details.data || {},
        status: details.status || 'info',
        user: details.user || 'System'
      });

      // Convert timestamp string to Date object for consistency
      const entryWithDate = {
        ...logEntry,
        timestamp: new Date(logEntry.timestamp)
      };

      // Add to local cache (at the beginning)
      this.logs.unshift(entryWithDate);
      
      // Keep only the last maxLogs entries in cache
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(0, this.maxLogs);
      }

      // Notify listeners
      this.listeners.forEach(listener => listener(this.logs));

      // Also log to console for debugging
      console.log(`📝 [Activity Log] ${action}:`, logEntry);

      return entryWithDate;
    } catch (error) {
      console.error('Error saving activity log to DynamoDB:', error);
      // Fallback to in-memory storage if DB fails
      const fallbackEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date(),
        action,
        message: details.message || action,
        data: details.data || {},
        status: details.status || 'info',
        user: details.user || 'System'
      };
      this.logs.unshift(fallbackEntry);
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(0, this.maxLogs);
      }
      this.listeners.forEach(listener => listener(this.logs));
      return fallbackEntry;
    }
  }

  /**
   * Get all logs (from cache or database)
   * @returns {Promise<Array>} Array of log entries
   */
  async getLogs() {
    // Load from DB if cache is empty or stale
    if (this.logs.length === 0 || Date.now() - this.lastFetchTime > this.cacheTimeout) {
      await this._loadLogsFromDB();
    }
    return [...this.logs];
  }

  /**
   * Clear all logs
   */
  async clearLogs() {
    try {
      const { clearActivityLogs } = await import('./dynamoDBService');
      await clearActivityLogs();
      
      this.logs = [];
      this.lastFetchTime = 0;
      this.listeners.forEach(listener => listener(this.logs));
    } catch (error) {
      console.error('Error clearing activity logs from DynamoDB:', error);
      // Fallback to clearing cache only
      this.logs = [];
      this.listeners.forEach(listener => listener(this.logs));
      throw error;
    }
  }

  /**
   * Subscribe to log updates
   * @param {Function} callback - Function to call when logs are updated
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    
    // Immediately call with current logs
    this.getLogs()
      .then(logs => callback(logs))
      .catch(err => {
        console.error('Error loading logs in subscribe:', err);
        callback([]);
      });
    
    // Set up polling to refresh logs periodically
    const pollInterval = setInterval(async () => {
      await this._refreshIfNeeded();
    }, 10000); // Poll every 10 seconds
    
    return () => {
      this.listeners.delete(callback);
      clearInterval(pollInterval);
    };
  }

  /**
   * Format timestamp for display
   * @param {Date|string} timestamp
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleString();
    }
  }
}

// Create a singleton instance
const activityLogService = new ActivityLogService();

export default activityLogService;

