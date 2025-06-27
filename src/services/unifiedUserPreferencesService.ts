/**
 * Unified User Preferences Service
 * 
 * Enhanced version of userPreferencesService.ts that uses the unified cache manager
 * instead of direct localStorage usage. Provides user-scoped preference caching,
 * automatic Supabase sync, and better performance.
 */

import { UserPreferences } from '../components/TravelPlanner/EnhancedItineraryCreator';
import { supabase } from '../lib/supabase';
import { cacheUtils, CacheEvent } from './cacheManager';

// Cache namespace for user preferences
const CACHE_NAMESPACE = 'user-preferences';

// Cache TTL - preferences are important, so cache for a long time
const PREFERENCES_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Initialize cache namespace
const initializePreferencesCache = () => {
  cacheUtils.registerCache({
    namespace: CACHE_NAMESPACE,
    ttl: PREFERENCES_CACHE_TTL,
    maxSize: 100, // Should be plenty for user preferences
    persistence: true,
    userScoped: true // Preferences are user-scoped!
  });
};

// Initialize when module loads
initializePreferencesCache();

/**
 * Cache keys for different types of preference data
 */
const CACHE_KEYS = {
  MAIN_PREFERENCES: 'main_prefs',
  INFERRED_PREFERENCES: 'inferred_prefs',
  SYNC_STATUS: 'sync_status',
  LAST_UPDATED: 'last_updated',
  LOADING_RESULT: 'loading_result', // Cache the loading result to avoid repeated API calls
  LOADING_TIMESTAMP: 'loading_timestamp' // Track when we last loaded
} as const;

/**
 * Convert UserPreferences to Supabase format
 */
const toSupabaseFormat = (preferences: UserPreferences) => {
  return {
    travel_style: preferences.travelStyle,
    interests: preferences.interests.map(i => i.label),
    travel_group: preferences.travelGroup,
    budget: preferences.budget,
    transport_mode: preferences.transportMode,
    dietary_preferences: preferences.dietaryPreferences.map(p => p.label),
    pace: preferences.pace,
    preferences_json: JSON.stringify(preferences), // Store full object for future compatibility
    updated_at: new Date().toISOString()
  };
};

/**
 * Convert Supabase format to UserPreferences
 */
const fromSupabaseFormat = (dbData: any): UserPreferences | null => {
  // If we have the full JSON representation, use that for better compatibility
  if (dbData.preferences_json) {
    try {
      return JSON.parse(dbData.preferences_json);
    } catch (e) {
      console.error('Error parsing preferences JSON from Supabase:', e);
      // Fall through to manual conversion
    }
  }

  // Manual conversion as fallback
  try {
    return {
      travelStyle: dbData.travel_style || 'cultural',
      interests: Array.isArray(dbData.interests) 
        ? dbData.interests.map((label: string) => ({ id: label.toLowerCase().replace(/\s/g, ''), label }))
        : [],
      travelGroup: dbData.travel_group || 'couple',
      budget: dbData.budget || 'mid-range',
      transportMode: dbData.transport_mode || 'walking',
      dietaryPreferences: Array.isArray(dbData.dietary_preferences)
        ? dbData.dietary_preferences.map((label: string) => ({ id: label.toLowerCase().replace(/\s/g, ''), label }))
        : [],
      pace: dbData.pace || 'moderate',
      lastUpdated: new Date(dbData.updated_at).getTime() || Date.now()
    };
  } catch (error) {
    console.error('Error converting Supabase data to UserPreferences:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
const isUserAuthenticated = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return !!data.session?.user;
};

/**
 * Get current user ID
 */
const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
};

export const unifiedUserPreferencesService = {
  /**
   * Save user preferences with unified caching and Supabase sync
   */
  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      const updatedPreferences = {
        ...preferences,
        lastUpdated: Date.now()
      };

      // Always save to cache first for immediate access
      cacheUtils.set(
        CACHE_NAMESPACE,
        CACHE_KEYS.MAIN_PREFERENCES,
        updatedPreferences,
        PREFERENCES_CACHE_TTL
      );

      console.log('📦 UnifiedPrefs: Cached user preferences');

      // If user is authenticated, also save to Supabase
      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const { error } = await supabase
            .from('user_preferences')
            .upsert(
              { 
                user_id: userId,
                ...toSupabaseFormat(updatedPreferences)
              },
              { onConflict: 'user_id' }
            );

          if (error) {
            console.error('Error saving preferences to Supabase:', error);
            // Mark sync as failed
            cacheUtils.set(CACHE_NAMESPACE, CACHE_KEYS.SYNC_STATUS, 'failed');
          } else {
            console.log('📦 UnifiedPrefs: User preferences saved to Supabase successfully');
            // Mark sync as successful
            cacheUtils.set(CACHE_NAMESPACE, CACHE_KEYS.SYNC_STATUS, 'success');
          }
        } catch (supabaseError) {
          console.error('Supabase sync error:', supabaseError);
          cacheUtils.set(CACHE_NAMESPACE, CACHE_KEYS.SYNC_STATUS, 'failed');
        }
      }

      // Clear loading cache to ensure fresh data on next load
      this.clearLoadingCache();

      // Emit preferences update event
      cacheUtils.emitEvent(CacheEvent.PREFERENCES_UPDATE, { preferences: updatedPreferences });

    } catch (error) {
      console.error('Error saving user preferences:', error);
      throw error;
    }
  },

  /**
   * Load user preferences with enhanced caching and intelligent fallback
   */
  async loadPreferences(): Promise<UserPreferences | null> {
    try {
      // First check if we have a recently cached loading result
      const cachedResult = cacheUtils.get<UserPreferences>(CACHE_NAMESPACE, CACHE_KEYS.LOADING_RESULT);
      const lastLoadingTime = cacheUtils.get<number>(CACHE_NAMESPACE, CACHE_KEYS.LOADING_TIMESTAMP);
      
      // If we have a cached result less than 5 minutes old, use it
      const CACHE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
      if (cachedResult && lastLoadingTime && (Date.now() - lastLoadingTime) < CACHE_VALIDITY_MS) {
        console.log('📦 UnifiedPrefs: Using recent loading result from cache');
        return cachedResult;
      }
      
      // Get from main cache
      const cachedPreferences = cacheUtils.get<UserPreferences>(CACHE_NAMESPACE, CACHE_KEYS.MAIN_PREFERENCES);
      
      // Try to load from Supabase if user is authenticated
      const userId = await getCurrentUserId();
      
      let finalPreferences: UserPreferences | null = null;
      
      if (userId) {
        try {
          const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (data && !error) {
            // Convert from Supabase format
            const supabasePreferences = fromSupabaseFormat(data);
            
            if (supabasePreferences) {
              // Check if Supabase data is newer than cached data
              const supabaseUpdated = supabasePreferences.lastUpdated || 0;
              const cachedUpdated = cachedPreferences?.lastUpdated || 0;

              if (supabaseUpdated > cachedUpdated) {
                console.log('📦 UnifiedPrefs: Supabase data is newer, updating cache');
                
                // Update cache with newer Supabase data
                cacheUtils.set(
                  CACHE_NAMESPACE,
                  CACHE_KEYS.MAIN_PREFERENCES,
                  supabasePreferences,
                  PREFERENCES_CACHE_TTL
                );
                
                finalPreferences = supabasePreferences;
              } else if (cachedPreferences) {
                console.log('📦 UnifiedPrefs: Cache data is newer or equal, using cached version');
                finalPreferences = cachedPreferences;
              } else {
                console.log('📦 UnifiedPrefs: Using Supabase data (no cache)');
                
                // Cache the Supabase data
                cacheUtils.set(
                  CACHE_NAMESPACE,
                  CACHE_KEYS.MAIN_PREFERENCES,
                  supabasePreferences,
                  PREFERENCES_CACHE_TTL
                );
                
                finalPreferences = supabasePreferences;
              }
            }
          } else if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            console.error('Error loading preferences from Supabase:', error);
          }
        } catch (supabaseError) {
          console.error('Supabase load error:', supabaseError);
        }
      }

      // Return cached preferences if Supabase failed or user not authenticated
      if (!finalPreferences && cachedPreferences) {
        console.log('📦 UnifiedPrefs: Using cached preferences');
        finalPreferences = cachedPreferences;
      }

      // Cache the loading result to avoid repeated API calls
      cacheUtils.set(CACHE_NAMESPACE, CACHE_KEYS.LOADING_RESULT, finalPreferences, CACHE_VALIDITY_MS);
      cacheUtils.set(CACHE_NAMESPACE, CACHE_KEYS.LOADING_TIMESTAMP, Date.now(), CACHE_VALIDITY_MS);

      if (!finalPreferences) {
        console.log('📦 UnifiedPrefs: No preferences found');
      }

      return finalPreferences;

    } catch (error) {
      console.error('Error loading user preferences:', error);
      
      // In case of error, return cached result if available
      const cachedResult = cacheUtils.get<UserPreferences>(CACHE_NAMESPACE, CACHE_KEYS.LOADING_RESULT);
      if (cachedResult) {
        console.log('📦 UnifiedPrefs: Returning cached result due to loading error');
        return cachedResult;
      }
      
      return null;
    }
  },

  /**
   * Get preferences with smart caching - prefer cached results for performance
   */
  async getPreferencesWithFallback(defaultPrefs?: UserPreferences): Promise<UserPreferences> {
    try {
      const preferences = await this.loadPreferences();
      
      if (preferences) {
        return preferences;
      }
      
      // Return provided defaults or create sensible defaults
      return defaultPrefs || {
        travelStyle: 'cultural',
        interests: [],
        travelGroup: 'couple',
        budget: 'mid-range',
        transportMode: 'walking',
        dietaryPreferences: [],
        pace: 'moderate',
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Error getting preferences with fallback:', error);
      
      // Return defaults in case of any error
      return defaultPrefs || {
        travelStyle: 'cultural',
        interests: [],
        travelGroup: 'couple',
        budget: 'mid-range',
        transportMode: 'walking',
        dietaryPreferences: [],
        pace: 'moderate',
        lastUpdated: Date.now()
      };
    }
  },

  /**
   * Clear cached loading results (useful when preferences are updated)
   */
  clearLoadingCache(): void {
    try {
      cacheUtils.delete(CACHE_NAMESPACE, CACHE_KEYS.LOADING_RESULT);
      cacheUtils.delete(CACHE_NAMESPACE, CACHE_KEYS.LOADING_TIMESTAMP);
      console.log('📦 UnifiedPrefs: Cleared loading cache');
    } catch (error) {
      console.error('Error clearing loading cache:', error);
    }
  },

  /**
   * Update specific preferences without changing others
   */
  async updatePreferences(partialPreferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
    try {
      const currentPreferences = await this.loadPreferences();
      if (!currentPreferences) {
        console.log('📦 UnifiedPrefs: No existing preferences, creating new ones');
        // Create new preferences with defaults
        const newPreferences: UserPreferences = {
          travelStyle: 'cultural',
          interests: [],
          travelGroup: 'couple',
          budget: 'mid-range',
          transportMode: 'walking',
          dietaryPreferences: [],
          pace: 'moderate',
          lastUpdated: Date.now(),
          ...partialPreferences
        };
        
        await this.savePreferences(newPreferences);
        return newPreferences;
      }
      
      const updatedPreferences = {
        ...currentPreferences,
        ...partialPreferences,
        lastUpdated: Date.now()
      };
      
      await this.savePreferences(updatedPreferences);
      return updatedPreferences;
      
    } catch (error) {
      console.error('Error updating user preferences:', error);
      return null;
    }
  },

  /**
   * Clear all user preferences
   */
  async clearPreferences(): Promise<void> {
    try {
      // Clear from cache
      cacheUtils.delete(CACHE_NAMESPACE, CACHE_KEYS.MAIN_PREFERENCES);
      cacheUtils.delete(CACHE_NAMESPACE, CACHE_KEYS.INFERRED_PREFERENCES);
      cacheUtils.delete(CACHE_NAMESPACE, CACHE_KEYS.SYNC_STATUS);
      
      console.log('📦 UnifiedPrefs: Cleared preferences from cache');
      
      // Clear from Supabase if user is authenticated
      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const { error } = await supabase
            .from('user_preferences')
            .delete()
            .eq('user_id', userId);

          if (error) {
            console.error('Error clearing preferences from Supabase:', error);
          } else {
            console.log('📦 UnifiedPrefs: User preferences cleared from Supabase successfully');
          }
        } catch (supabaseError) {
          console.error('Supabase clear error:', supabaseError);
        }
      }

      // Emit preferences update event
      cacheUtils.emitEvent(CacheEvent.PREFERENCES_UPDATE, { preferences: null });

    } catch (error) {
      console.error('Error clearing user preferences:', error);
      throw error;
    }
  },

  /**
   * Check if user has saved preferences
   */
  async hasPreferences(): Promise<boolean> {
    try {
      // Check cache first for quick response
      const cachedPreferences = cacheUtils.get(CACHE_NAMESPACE, CACHE_KEYS.MAIN_PREFERENCES);
      if (cachedPreferences) {
        return true;
      }

      // Check Supabase if authenticated
      const userId = await getCurrentUserId();
      if (userId) {
        const { count, error } = await supabase
          .from('user_preferences')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        if (!error && count && count > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking for preferences:', error);
      return false;
    }
  },

  /**
   * Get the timestamp of when preferences were last updated
   */
  async getLastUpdated(): Promise<number | null> {
    const preferences = await this.loadPreferences();
    return preferences?.lastUpdated || null;
  },

  /**
   * Sync preferences after user login
   * Merges local cached preferences with Supabase data intelligently
   */
  async syncAfterLogin(): Promise<void> {
    try {
      console.log('📦 UnifiedPrefs: Starting post-login sync');

      const cachedPreferences = cacheUtils.get<UserPreferences>(CACHE_NAMESPACE, CACHE_KEYS.MAIN_PREFERENCES);
      
      if (cachedPreferences) {
        // Save cached preferences to Supabase (this will merge with existing data)
        await this.savePreferences(cachedPreferences);
        console.log('📦 UnifiedPrefs: Preferences synced to Supabase after login');
      }
      
      // Then load the latest data (which might include server-side changes)
      await this.loadPreferences();
      
    } catch (error) {
      console.error('Error syncing preferences after login:', error);
    }
  },

  /**
   * Get preferences synchronously from cache only
   */
  getPreferencesSync(): UserPreferences | null {
    try {
      return cacheUtils.get<UserPreferences>(CACHE_NAMESPACE, CACHE_KEYS.MAIN_PREFERENCES);
    } catch (error) {
      console.error('Error loading user preferences synchronously:', error);
      return null;
    }
  },

  /**
   * Save inferred preferences from conversation
   */
  saveInferredPreferences(preferences: any): void {
    try {
      cacheUtils.set(
        CACHE_NAMESPACE,
        CACHE_KEYS.INFERRED_PREFERENCES,
        {
          ...preferences,
          inferredAt: Date.now()
        },
        PREFERENCES_CACHE_TTL
      );
      
      console.log('📦 UnifiedPrefs: Saved inferred preferences');
    } catch (error) {
      console.error('Error saving inferred preferences:', error);
    }
  },

  /**
   * Get inferred preferences from conversation
   */
  getInferredPreferences(): { hasInferred: boolean, data: any } {
    try {
      const inferredData = cacheUtils.get(CACHE_NAMESPACE, CACHE_KEYS.INFERRED_PREFERENCES);
      
      if (inferredData) {
        return { hasInferred: true, data: inferredData };
      }
      
      return { hasInferred: false, data: {} };
    } catch (error) {
      console.error('Error getting inferred preferences:', error);
      return { hasInferred: false, data: {} };
    }
  },

  /**
   * Update preferences from conversation inferences
   */
  async updateFromConversationInferences(inferredPreferences: any): Promise<UserPreferences> {
    try {
      // First get current preferences
      const currentPreferences = await this.loadPreferences();
      
      // Prepare merged preferences
      const mergedPreferences: UserPreferences = {
        ...currentPreferences,
        // Only update fields that were inferred and not empty
        ...(inferredPreferences.travelStyle && { travelStyle: inferredPreferences.travelStyle }),
        
        // Handle array fields carefully, merging them without duplicates
        interests: [
          ...(currentPreferences?.interests || []),
          ...(inferredPreferences.interests?.map((interest: string) => ({
            id: interest.toLowerCase().replace(/\s/g, ''),
            label: interest
          })) || [])
        ].filter((item, index, self) => 
          // Remove duplicates by id
          index === self.findIndex(t => t.id === item.id)
        ),
        
        dietaryPreferences: [
          ...(currentPreferences?.dietaryPreferences || []),
          ...(inferredPreferences.dietaryPreferences?.map((pref: string) => ({
            id: pref.toLowerCase().replace(/\s/g, ''),
            label: pref
          })) || [])
        ].filter((item, index, self) => 
          index === self.findIndex(t => t.id === item.id)
        ),
        
        ...(inferredPreferences.budget && { budget: inferredPreferences.budget }),
        ...(inferredPreferences.travelGroup && { travelGroup: inferredPreferences.travelGroup }),
        ...(inferredPreferences.transportation && { transportMode: inferredPreferences.transportation }),
        ...(inferredPreferences.pace && { pace: inferredPreferences.pace })
      };
      
      // Save the merged preferences
      await this.savePreferences(mergedPreferences);
      
      // Also save the inferred data for reference
      this.saveInferredPreferences(inferredPreferences);
      
      return mergedPreferences;
    } catch (error) {
      console.error('Error updating preferences from conversation:', error);
      throw error;
    }
  },

  /**
   * Get sync status for debugging
   */
  getSyncStatus(): string | null {
    return cacheUtils.get(CACHE_NAMESPACE, CACHE_KEYS.SYNC_STATUS);
  },

  /**
   * Force refresh preferences from Supabase (bypass cache)
   */
  async refreshFromSupabase(): Promise<UserPreferences | null> {
    try {
      // Clear cache first
      cacheUtils.delete(CACHE_NAMESPACE, CACHE_KEYS.MAIN_PREFERENCES);
      
      // Then load fresh from Supabase
      return await this.loadPreferences();
    } catch (error) {
      console.error('Error refreshing preferences from Supabase:', error);
      return null;
    }
  },

  /**
   * Get cache analytics for debugging
   */
  getCacheStats() {
    return cacheUtils.getAnalytics(CACHE_NAMESPACE);
  },

  /**
   * Clear all user preference caches (useful for logout)
   */
  clearAllUserPreferences(): void {
    try {
      cacheUtils.clear(CACHE_NAMESPACE);
      console.log('📦 UnifiedPrefs: Cleared all user preference caches');
    } catch (error) {
      console.error('Error clearing all user preferences:', error);
    }
  }
};

export default unifiedUserPreferencesService; 