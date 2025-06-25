import { UserPreferences } from '../components/TravelPlanner/EnhancedItineraryCreator';
import { supabase } from '../lib/supabase';

// Local storage key for user preferences
const USER_PREFERENCES_KEY = 'travelApp.userPreferences';

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

/**
 * Service for managing user travel preferences
 */
export const UserPreferencesService = {
  /**
   * Save user preferences to storage (Supabase if logged in, localStorage otherwise)
   * @param preferences User preferences to save
   */
  async savePreferences(preferences: UserPreferences): Promise<void> {
    try {
      // Always save to local storage for immediate access
      localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify({
        ...preferences,
        lastUpdated: Date.now()
      }));
      
      // If user is authenticated, also save to Supabase
      const userId = await getCurrentUserId();
      if (userId) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            { 
              user_id: userId,
              ...toSupabaseFormat(preferences)
            },
            { onConflict: 'user_id' }
          );
          
        if (error) {
          console.error('Error saving preferences to Supabase:', error);
        } else {
          console.log('User preferences saved to Supabase successfully');
        }
      }
    } catch (error) {
      console.error('Error saving user preferences:', error);
    }
  },

  /**
   * Load user preferences (from Supabase if authenticated, localStorage otherwise)
   * @returns User preferences or null if not found
   */
  async loadPreferences(): Promise<UserPreferences | null> {
    try {
      // Try to load from Supabase first if user is authenticated
      const userId = await getCurrentUserId();
      
      if (userId) {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();
          
        if (data && !error) {
          // Convert from Supabase format and update local storage for offline access
          const preferences = fromSupabaseFormat(data);
          if (preferences) {
            localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
            return preferences;
          }
        } else if (error && error.code !== 'PGRST116') { // PGRST116 = not found, which is expected
          console.error('Error loading preferences from Supabase:', error);
        }
      }
      
      // Fall back to local storage if not found in Supabase or user is not authenticated
      const savedPreferences = localStorage.getItem(USER_PREFERENCES_KEY);
      if (!savedPreferences) {
        return null;
      }
      
      const preferences = JSON.parse(savedPreferences) as UserPreferences;
      
      // If we loaded from localStorage but user is authenticated, sync to Supabase
      if (preferences && userId) {
        this.savePreferences(preferences); // Sync to Supabase in background
      }
      
      return preferences;
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return null;
    }
  },

  /**
   * Update specific preferences without changing others
   * @param partialPreferences Partial preferences to update
   * @returns Updated preferences or null if error
   */
  async updatePreferences(partialPreferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
    try {
      const currentPreferences = await this.loadPreferences();
      if (!currentPreferences) {
        return null;
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
      // Clear from local storage
      localStorage.removeItem(USER_PREFERENCES_KEY);
      
      // Clear from Supabase if user is authenticated
      const userId = await getCurrentUserId();
      if (userId) {
        const { error } = await supabase
          .from('user_preferences')
          .delete()
          .eq('user_id', userId);
          
        if (error) {
          console.error('Error clearing preferences from Supabase:', error);
        } else {
          console.log('User preferences cleared from Supabase successfully');
        }
      }
    } catch (error) {
      console.error('Error clearing user preferences:', error);
    }
  },

  /**
   * Check if user has saved preferences
   * @returns True if preferences exist, false otherwise
   */
  async hasPreferences(): Promise<boolean> {
    // Check Supabase first if authenticated
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
    
    // Fall back to local storage
    return localStorage.getItem(USER_PREFERENCES_KEY) !== null;
  },
  
  /**
   * Get the timestamp of when preferences were last updated
   * @returns Timestamp or null if no preferences
   */
  async getLastUpdated(): Promise<number | null> {
    const preferences = await this.loadPreferences();
    return preferences?.lastUpdated || null;
  },
  
  /**
   * Sync preferences from local storage to Supabase after login
   * Call this when a user logs in
   */
  async syncAfterLogin(): Promise<void> {
    const localPreferences = localStorage.getItem(USER_PREFERENCES_KEY);
    if (localPreferences) {
      try {
        const preferences = JSON.parse(localPreferences) as UserPreferences;
        await this.savePreferences(preferences);
        console.log('Preferences synced to Supabase after login');
      } catch (error) {
        console.error('Error syncing preferences after login:', error);
      }
    }
  },
  
  /**
   * Get preferences synchronously from local storage only
   * Use this when you need preferences immediately without async wait
   */
  getPreferencesSync(): UserPreferences | null {
    try {
      const savedPreferences = localStorage.getItem(USER_PREFERENCES_KEY);
      if (!savedPreferences) {
        return null;
      }
      
      return JSON.parse(savedPreferences) as UserPreferences;
    } catch (error) {
      console.error('Error loading user preferences synchronously:', error);
      return null;
    }
  },

  /**
   * Update preferences from conversation inferences
   * @param userId User ID
   * @param inferredPreferences Preferences inferred from conversation
   * @returns Updated preferences
   */
  async updateFromConversationInferences(userId: string, inferredPreferences: any): Promise<UserPreferences> {
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
      
      // Save to database
      await this.savePreferences(mergedPreferences);
      
      // Also update local storage
      this.savePreferences(mergedPreferences);
      
      return mergedPreferences;
    } catch (error) {
      console.error('Error updating preferences from conversation:', error);
      throw error;
    }
  },
  
  /**
   * Get inferred preferences from conversation
   * @param userId User ID
   * @returns Object with inferred preferences flag and data
   */
  async getInferredPreferences(userId: string): Promise<{ hasInferred: boolean, data: any }> {
    try {
      const key = `${userId}_inferred_preferences`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        return { hasInferred: true, data: JSON.parse(stored) };
      }
      
      return { hasInferred: false, data: {} };
    } catch (error) {
      console.error('Error getting inferred preferences:', error);
      return { hasInferred: false, data: {} };
    }
  },
  
  /**
   * Save inferred preferences from conversation
   * @param userId User ID
   * @param preferences Inferred preferences
   */
  saveInferredPreferences(userId: string, preferences: any): void {
    try {
      const key = `${userId}_inferred_preferences`;
      localStorage.setItem(key, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving inferred preferences:', error);
    }
  }
};

export default UserPreferencesService; 