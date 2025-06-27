/**
 * Unified Itinerary Hook
 * 
 * React hook that provides access to the unified itinerary service.
 * Replaces the complex ItineraryContext with a simpler, cache-integrated approach.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, ItineraryDay, SuggestionItem } from '../types';
import { UnifiedItineraryService, ItineraryData, ItinerarySaveOptions } from '../services/unifiedItineraryService';
import { cacheManager } from '../services/cacheManager';
import { useAuth } from '../contexts/AuthContext';
import { databaseService } from '../services/databaseService';

export interface UseUnifiedItineraryReturn {
  // Current state
  itineraryData: ItineraryData;
  suggestions: SuggestionItem[];
  isLoading: boolean;
  
  // Computed values
  itineraryDays: ItineraryDay[];
  sortedItineraryDays: ItineraryDay[];
  destination: string;
  startDate: string;
  endDate: string;
  currentItineraryId: string | null;
  currentItineraryTitle: string;
  
  // Day operations
  addDay: (day: ItineraryDay) => void;
  deleteDay: (dayNumber: number) => void;
  
  // Activity operations
  addActivity: (dayNumber: number, activity: Omit<Activity, 'id'>) => void;
  updateActivity: (dayNumber: number, activityId: string, updatedActivity: Partial<Activity>) => void;
  deleteActivity: (dayNumber: number, activityId: string) => void;
  
  // Suggestion operations
  addSuggestion: (suggestion: SuggestionItem) => void;
  removeSuggestion: (suggestionId: string) => void;
  acceptSuggestion: (suggestion: SuggestionItem, dayNumber: number) => void;
  rejectSuggestion: (suggestionId: string) => void;
  
  // Itinerary management
  setCurrentItineraryTitle: (title: string) => void;
  getCurrentItineraryTitle: () => string;
  clearItineraryDays: () => void;
  saveItinerary: (name: string) => Promise<string | null>;
  loadItinerary: (itineraryId: string) => Promise<void>;
  deleteItinerary: (itineraryId: string) => Promise<void>;
  getUserItineraries: () => Promise<any[]>;
  
  // Previous itinerary management
  savePreviousItinerary: () => void;
  restorePreviousItinerary: () => boolean;
  hasPreviousItinerary: () => boolean;
  
  // Utility functions
  setLoading: (loading: boolean) => void;
  finishItineraryCreation: () => void;
  forceRefresh: () => void;
  clearSessionStorage: () => void;
  
  // Analytics
  getAnalytics: () => any;
}

let itineraryServiceInstance: UnifiedItineraryService | null = null;

function getItineraryService(): UnifiedItineraryService {
  if (!itineraryServiceInstance) {
    itineraryServiceInstance = new UnifiedItineraryService(cacheManager);
  }
  return itineraryServiceInstance;
}

export function useUnifiedItinerary(): UseUnifiedItineraryReturn {
  const { user } = useAuth();
  const itineraryService = getItineraryService();
  
  // Local state for reactive updates
  const [itineraryData, setItineraryData] = useState<ItineraryData>(() => 
    itineraryService.getCurrentItinerary()
  );
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>(() => 
    itineraryService.getSuggestions()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Refresh data from service
  const refreshData = useCallback(() => {
    setItineraryData(itineraryService.getCurrentItinerary());
    setSuggestions(itineraryService.getSuggestions());
  }, [itineraryService]);

  // Force refresh trigger
  const forceRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // **FIX: Add useEffect to reload data when user authentication changes**
  useEffect(() => {
    const loadUserItinerary = async () => {
      if (!user?.id) {
        console.log('🔄 useUnifiedItinerary: No user authenticated, clearing data');
        refreshData();
        return;
      }

      console.log('🔄 useUnifiedItinerary: User authenticated, checking for current working itinerary');
      
      // **ENHANCED**: Check if we have a current working itinerary in cache/localStorage first
      const currentItinerary = itineraryService.getCurrentItinerary();
      const hasCurrentWorkingItinerary = currentItinerary.days.length > 0;
      
      // **NEW**: Check localStorage for working itinerary data that might have been auto-saved (user-scoped)
      const autoSaveKey = `currentWorkingItinerary_${user.id}`;
      const autoSavedData = localStorage.getItem(autoSaveKey);
      let hasAutoSavedData = false;
      let autoSaved = null;
      
      if (autoSavedData) {
        try {
          autoSaved = JSON.parse(autoSavedData);
          // Validate that the auto-saved data belongs to the current user
          hasAutoSavedData = autoSaved.days?.length > 0 && autoSaved.userId === user.id;
        } catch (error) {
          console.error('Error parsing auto-saved data:', error);
          localStorage.removeItem(autoSaveKey); // Remove corrupted data
        }
      }
      
      if (hasCurrentWorkingItinerary) {
        console.log('✅ useUnifiedItinerary: Using current working itinerary from cache');
        refreshData();
        return;
      }
      
      if (hasAutoSavedData && autoSaved) {
        console.log('✅ useUnifiedItinerary: Restoring auto-saved working itinerary for user:', user.id);
        try {
          // Restore the auto-saved working itinerary
          itineraryService.saveCurrentItinerary(autoSaved);
          refreshData();
          return;
        } catch (error) {
          console.error('Error restoring auto-saved itinerary:', error);
          // Remove corrupted data and continue to load from database
          localStorage.removeItem(autoSaveKey);
        }
      }

      // Only load from database if we don't have any working itinerary
      console.log('📥 useUnifiedItinerary: No working itinerary found, checking for saved itineraries');

      try {
        // Get user's saved itineraries
        const userItineraries = await databaseService.getUserItineraries(user.id);
        
        if (userItineraries && userItineraries.length > 0) {
          // Load the most recent itinerary
          const mostRecentItinerary = userItineraries[0]; // Already ordered by created_at desc
          console.log('📥 useUnifiedItinerary: Loading most recent saved itinerary:', mostRecentItinerary.name || mostRecentItinerary.title);
          
          await itineraryService.loadFromDatabase(mostRecentItinerary.id);
          refreshData();
        } else {
          console.log('📝 useUnifiedItinerary: No saved itineraries found, using empty itinerary');
          refreshData();
        }
      } catch (error) {
        console.error('❌ useUnifiedItinerary: Error loading user itineraries:', error);
        refreshData();
      }
    };

    loadUserItinerary();
  }, [user?.id, refreshData]);

  // **NEW**: Auto-save current working itinerary whenever it changes (user-scoped)
  useEffect(() => {
    if (itineraryData.days.length > 0 && user?.id) {
      // Auto-save to localStorage whenever itinerary changes (with user ID)
      const autoSaveData = {
        ...itineraryData,
        userId: user.id, // Include user ID for security
        lastAutoSaved: new Date().toISOString()
      };
      
      try {
        const autoSaveKey = `currentWorkingItinerary_${user.id}`;
        localStorage.setItem(autoSaveKey, JSON.stringify(autoSaveData));
        console.log('💾 Auto-saved current working itinerary to localStorage for user:', user.id);
      } catch (error) {
        console.error('Error auto-saving itinerary:', error);
      }
    } else if (!user?.id) {
      // Clear auto-save when no user
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith('currentWorkingItinerary_')) {
          localStorage.removeItem(key);
        }
      });
    }
  }, [itineraryData, user?.id]);

  // **NEW**: Clear auto-saved data when user logs out
  useEffect(() => {
    if (!user) {
      // User logged out, clear any auto-saved working itinerary for all users
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (key.startsWith('currentWorkingItinerary_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ Cleared all auto-saved data on logout');
    }
  }, [user]);

  // **NEW**: Clear auto-saved data when clearing itinerary
  const clearItineraryDays = useCallback(() => {
    itineraryService.clearCurrentItinerary();
    if (user?.id) {
      const autoSaveKey = `currentWorkingItinerary_${user.id}`;
      localStorage.removeItem(autoSaveKey);
      console.log('🗑️ Cleared auto-saved data with itinerary for user:', user.id);
    }
    refreshData();
  }, [itineraryService, refreshData, user?.id]);

  // Listen for cache events to update state
  useEffect(() => {
    const handleCacheUpdate = () => {
      refreshData();
    };

    cacheManager.addEventListener('ITINERARY_CHANGE' as any, handleCacheUpdate);
    
    // Return cleanup function - note: cache manager doesn't provide one yet
    // This prevents memory leaks
    return () => {
      // TODO: Implement removeEventListener in cache manager
      console.log('Cache event listener cleanup');
    };
  }, [refreshData]);

  // Refresh when refresh trigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshData();
    }
  }, [refreshTrigger, refreshData]);

  // Computed values
  const computedValues = useMemo(() => {
    const sortedDays = [...itineraryData.days].sort((a, b) => a.dayNumber - b.dayNumber);
    
    return {
      itineraryDays: itineraryData.days,
      sortedItineraryDays: sortedDays,
      destination: itineraryData.destination || '',
      startDate: itineraryData.startDate || new Date().toISOString().split('T')[0],
      endDate: itineraryData.endDate || new Date().toISOString().split('T')[0],
      currentItineraryId: itineraryData.id,
      currentItineraryTitle: itineraryData.title
    };
  }, [itineraryData]);

  // Day operations
  const addDay = useCallback((day: ItineraryDay) => {
    const updated = itineraryService.addDay(day);
    setItineraryData(updated);
  }, [itineraryService]);

  const deleteDay = useCallback((dayNumber: number) => {
    const updated = itineraryService.deleteDay(dayNumber);
    setItineraryData(updated);
  }, [itineraryService]);

  // Activity operations
  const addActivity = useCallback((dayNumber: number, activity: Omit<Activity, 'id'>) => {
    const updated = itineraryService.addActivity(dayNumber, activity);
    setItineraryData(updated);
  }, [itineraryService]);

  const updateActivity = useCallback((dayNumber: number, activityId: string, updatedActivity: Partial<Activity>) => {
    const updated = itineraryService.updateActivity(dayNumber, activityId, updatedActivity);
    setItineraryData(updated);
  }, [itineraryService]);

  const deleteActivity = useCallback((dayNumber: number, activityId: string) => {
    const updated = itineraryService.deleteActivity(dayNumber, activityId);
    setItineraryData(updated);
  }, [itineraryService]);

  // Suggestion operations
  const addSuggestion = useCallback((suggestion: SuggestionItem) => {
    itineraryService.addSuggestion(suggestion);
    setSuggestions(itineraryService.getSuggestions());
  }, [itineraryService]);

  const removeSuggestion = useCallback((suggestionId: string) => {
    itineraryService.removeSuggestion(suggestionId);
    setSuggestions(itineraryService.getSuggestions());
  }, [itineraryService]);

  const acceptSuggestion = useCallback((suggestion: SuggestionItem, dayNumber: number) => {
    // Convert suggestion to activity and add it
    const activity: Omit<Activity, 'id'> = {
      title: suggestion.title,
      description: suggestion.description,
      time: '', // SuggestionItem doesn't have time property
      location: suggestion.location || '',
      category: suggestion.category || 'other',
      duration: suggestion.duration || '60' // duration is string in both types
    };
    
    addActivity(dayNumber, activity);
    removeSuggestion(suggestion.id);
  }, [addActivity, removeSuggestion]);

  const rejectSuggestion = useCallback((suggestionId: string) => {
    removeSuggestion(suggestionId);
  }, [removeSuggestion]);

  // Itinerary management
  const setCurrentItineraryTitle = useCallback((title: string) => {
    const updated = itineraryService.updateItineraryMetadata({ title });
    setItineraryData(updated);
  }, [itineraryService]);

  const getCurrentItineraryTitle = useCallback(() => {
    return itineraryData.title;
  }, [itineraryData.title]);

  // Previous itinerary management (cache-based)
  const savePreviousItinerary = useCallback(() => {
    if (itineraryData.days.length > 0) {
      cacheManager.set('itinerary', 'previous', {
        ...itineraryData,
        title: 'Previous Itinerary'
      });
      console.log('💾 Previous itinerary saved to cache');
    }
  }, [itineraryData]);

  const restorePreviousItinerary = useCallback((): boolean => {
    try {
      const previous = cacheManager.get('itinerary', 'previous') as ItineraryData | null;
      
      if (!previous) {
        console.log('No previous itinerary found');
        return false;
      }
      
      itineraryService.saveCurrentItinerary(previous);
      refreshData();
      console.log('✅ Previous itinerary restored');
      return true;
    } catch (error) {
      console.error('Error restoring previous itinerary:', error);
      return false;
    }
  }, [itineraryService, refreshData]);

  const hasPreviousItinerary = useCallback((): boolean => {
    try {
      const previous = cacheManager.get('itinerary', 'previous');
      return previous !== null;
    } catch (error) {
      console.error('Error checking for previous itinerary:', error);
      return false;
    }
  }, []);

  // Utility functions
  const finishItineraryCreation = useCallback(() => {
    // This was used in the old context to clear a flag
    // In the new implementation, we don't need this complexity
    console.log('✅ Itinerary creation finished');
  }, []);

  const clearSessionStorage = useCallback(() => {
    itineraryService.clearCache();
    refreshData();
    console.log('🧹 Session storage cleared');
  }, [itineraryService, refreshData]);

  const getAnalytics = useCallback(() => {
    return itineraryService.getAnalytics();
  }, [itineraryService]);

  // **FIXED**: Define saveItinerary with auto-save cleanup
  const saveItinerary = useCallback(async (name: string): Promise<string | null> => {
    if (!user) {
      console.warn('Cannot save itinerary: user not authenticated');
      return null;
    }

    setIsLoading(true);
    try {
      const savedId = await itineraryService.saveToDatabase(user.id, { title: name });
      refreshData();
      
      if (savedId && user?.id) {
        // Clear auto-saved data since we've now saved to database
        const autoSaveKey = `currentWorkingItinerary_${user.id}`;
        localStorage.removeItem(autoSaveKey);
        console.log('🗑️ Cleared auto-saved data after manual save for user:', user.id);
      }
      
      return savedId;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, itineraryService, refreshData]);

  const loadItinerary = useCallback(async (itineraryId: string): Promise<void> => {
    setIsLoading(true);
    try {
      await itineraryService.loadFromDatabase(itineraryId);
      // Clear auto-saved data when loading a saved itinerary
      if (user?.id) {
        const autoSaveKey = `currentWorkingItinerary_${user.id}`;
        localStorage.removeItem(autoSaveKey);
        console.log('🗑️ Cleared auto-saved data after loading itinerary for user:', user.id);
      }
      refreshData();
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [itineraryService, refreshData, user?.id]);

  const deleteItinerary = useCallback(async (itineraryId: string): Promise<void> => {
    if (!user) {
      console.warn('Cannot delete itinerary: user not authenticated');
      return;
    }

    setIsLoading(true);
    try {
      await databaseService.deleteItinerary(itineraryId);
      
      // If we're deleting the current itinerary, clear it
      if (itineraryData.id === itineraryId) {
        itineraryService.clearCurrentItinerary();
        if (user?.id) {
          const autoSaveKey = `currentWorkingItinerary_${user.id}`;
          localStorage.removeItem(autoSaveKey);
          console.log('🗑️ Cleared auto-saved data after deleting current itinerary for user:', user.id);
        }
        refreshData();
      }
    } catch (error) {
      console.error('Error deleting itinerary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, itineraryData.id, itineraryService, refreshData]);

  const getUserItineraries = useCallback(async (): Promise<any[]> => {
    if (!user) {
      return [];
    }

    try {
      return await databaseService.getUserItineraries(user.id);
    } catch (error) {
      console.error('Error getting user itineraries:', error);
      return [];
    }
  }, [user]);

  // Return the API object - keep it simple to avoid hook dependency issues
  return {
    // Current state
    itineraryData,
    suggestions,
    isLoading,
    
    // Computed values
    ...computedValues,
    
    // Day operations
    addDay,
    deleteDay,
    
    // Activity operations
    addActivity,
    updateActivity,
    deleteActivity,
    
    // Suggestion operations
    addSuggestion,
    removeSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    
    // Itinerary management
    setCurrentItineraryTitle,
    getCurrentItineraryTitle,
    clearItineraryDays,
    saveItinerary,
    loadItinerary,
    deleteItinerary,
    getUserItineraries,
    
    // Previous itinerary management
    savePreviousItinerary,
    restorePreviousItinerary,
    hasPreviousItinerary,
    
    // Utility functions
    setLoading: setIsLoading,
    finishItineraryCreation,
    forceRefresh,
    clearSessionStorage,
    
    // Analytics
    getAnalytics
  };
}

/**
 * Simplified hooks for specific use cases
 */

/**
 * Hook for just itinerary data (read-only)
 */
export function useItineraryData() {
  const { itineraryData, ...computed } = useUnifiedItinerary();
  
  return {
    itineraryData,
    ...computed
  };
}

/**
 * Hook for just itinerary actions
 */
export function useItineraryActions() {
  const {
    // Extract only action methods
    addDay,
    deleteDay,
    addActivity,
    updateActivity,
    deleteActivity,
    addSuggestion,
    removeSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    setCurrentItineraryTitle,
    clearItineraryDays,
    saveItinerary,
    loadItinerary,
    deleteItinerary,
    getUserItineraries,
    savePreviousItinerary,
    restorePreviousItinerary,
    hasPreviousItinerary,
    setLoading,
    finishItineraryCreation,
    forceRefresh,
    clearSessionStorage
  } = useUnifiedItinerary();

  return {
    addDay,
    deleteDay,
    addActivity,
    updateActivity,
    deleteActivity,
    addSuggestion,
    removeSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    setCurrentItineraryTitle,
    clearItineraryDays,
    saveItinerary,
    loadItinerary,
    deleteItinerary,
    getUserItineraries,
    savePreviousItinerary,
    restorePreviousItinerary,
    hasPreviousItinerary,
    setLoading,
    finishItineraryCreation,
    forceRefresh,
    clearSessionStorage
  };
}

/**
 * Legacy hook for backward compatibility
 */
export function useItinerary() {
  return useUnifiedItinerary();
} 