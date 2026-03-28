/**
 * React hooks for direct DynamoDB access
 * Replaces GraphQL hooks with direct DynamoDB calls
 */

import { useState, useEffect, useCallback } from 'react';
import * as dynamoDBService from '../services/dynamoDBService';

// Hook for fetching teams
export const useTeams = (league, season) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await dynamoDBService.getTeams(league, season);
        console.log(`📦 useDynamoDB.getTeams fetched ${data.length} teams for ${league}-${season}`);
        setTeams(data);
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    if (league && season) {
      fetchTeams();
    } else {
      setLoading(false);
    }
  }, [league, season]);

  const refetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dynamoDBService.getTeams(league, season);
      setTeams(data);
      return data;
    } catch (err) {
      console.error('Error refetching teams:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [league, season]);

  return { teams, loading, error, refetchTeams };
};

// Hook for fetching payout structure
export const usePayoutStructure = (league, season) => {
  const [payoutRows, setPayoutRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPayouts = async () => {
      if (!league || !season) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await dynamoDBService.getPayoutRows(league, season);
        setPayoutRows(data);
      } catch (err) {
        console.error('Error fetching payout rows:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayouts();
  }, [league, season]);

  const refetchPayoutRows = useCallback(async () => {
    if (!league || !season) return;

    setLoading(true);
    setError(null);
    try {
      const data = await dynamoDBService.getPayoutRows(league, season);
      setPayoutRows(data);
      return data;
    } catch (err) {
      console.error('Error refetching payout rows:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [league, season]);

  return { payoutRows, loading, error, refetchPayoutRows };
};

// Hook for fetching achievements
export const useAchievements = (league, season, teamId) => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAchievements = async () => {
      if (!league || !season) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await dynamoDBService.getAchievements(league, season, teamId);
        setAchievements(data);
      } catch (err) {
        console.error('Error fetching achievements:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAchievements();
  }, [league, season, teamId]);

  const refetchAchievements = useCallback(async () => {
    if (!league || !season) return;

    setLoading(true);
    setError(null);
    try {
      const data = await dynamoDBService.getAchievements(league, season, teamId);
      setAchievements(data);
      return data;
    } catch (err) {
      console.error('Error refetching achievements:', err);
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [league, season, teamId]);

  return { achievements, loading, error, refetchAchievements };
};

// Hook for fetching owners
export const useOwners = () => {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOwners = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await dynamoDBService.getOwners();
        setOwners(data);
      } catch (err) {
        console.error('Error fetching owners:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchOwners();
  }, []);

  return { owners, loading, error };
};

