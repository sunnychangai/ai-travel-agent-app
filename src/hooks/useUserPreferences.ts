import { useState, useEffect, useCallback } from 'react';
import { unifiedUserPreferencesService } from '../services/unifiedUserPreferencesService';
import { UserPreferences } from '../components/TravelPlanner/EnhancedItineraryCreator';

/**
 * React hook to access and manage user preferences
 */
export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on initial render
  useEffect(() => {
    async function loadInitialPreferences() {
      try {
        setIsLoading(true);
        setError(null);
        
        // Start with sync version for immediate UI response
        const syncPrefs = unifiedUserPreferencesService.getPreferencesSync();
        if (syncPrefs) {
          setPreferences(syncPrefs);
        }
        
        // Then load the authoritative version (from Supabase if available)
        const prefs = await unifiedUserPreferencesService.loadPreferences();
        if (prefs) {
          setPreferences(prefs);
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setIsLoading(false);
      }
    }

    loadInitialPreferences();
  }, []);

  /**
   * Save updated preferences
   */
  const savePreferences = useCallback(async (newPreferences: UserPreferences) => {
    try {
      setIsLoading(true);
      setError(null);
      await unifiedUserPreferencesService.savePreferences(newPreferences);
      setPreferences(newPreferences);
      return true;
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Failed to save preferences');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update partial preferences
   */
  const updatePreferences = useCallback(async (partialPreferences: Partial<UserPreferences>) => {
    try {
      setIsLoading(true);
      setError(null);
      const updated = await unifiedUserPreferencesService.updatePreferences(partialPreferences);
      if (updated) {
        setPreferences(updated);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Failed to update preferences');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clear all preferences
   */
  const clearPreferences = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
              await unifiedUserPreferencesService.clearPreferences();
      setPreferences(null);
      return true;
    } catch (err) {
      console.error('Error clearing preferences:', err);
      setError('Failed to clear preferences');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sync preferences after login
   */
  const syncAfterLogin = useCallback(async () => {
    try {
      setIsLoading(true);
      await unifiedUserPreferencesService.syncAfterLogin();
      const prefs = await unifiedUserPreferencesService.loadPreferences();
      if (prefs) {
        setPreferences(prefs);
      }
    } catch (err) {
      console.error('Error syncing preferences after login:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    preferences,
    isLoading,
    error,
    savePreferences,
    updatePreferences,
    clearPreferences,
    syncAfterLogin,
    hasPreferences: !!preferences
  };
}

export default useUserPreferences; 