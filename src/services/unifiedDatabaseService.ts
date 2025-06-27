/**
 * Unified Database Service
 * 
 * Enhanced version of databaseService.ts that uses the unified cache manager
 * instead of direct localStorage usage. Provides user-scoped caching,
 * automatic invalidation, and better performance.
 */

import { supabase } from './supabase';
import { Activity, ItineraryDay } from '../types';
import { formatTimeRange } from '../utils/timeUtils';
import { safeParseDate } from '../utils/dateUtils';
import { cacheUtils, CacheEvent } from './cacheManager';

// Cache namespace constants
const CACHE_NAMESPACES = {
  ITINERARIES: 'user-itineraries',
  ACTIVITIES: 'user-activities',
  SUGGESTIONS: 'user-suggestions',
  SEARCHES: 'user-searches',
  FALLBACK_DATA: 'fallback-data'
} as const;

// Cache TTL constants (in milliseconds)
const CACHE_TTL = {
  ITINERARIES: 24 * 60 * 60 * 1000, // 24 hours
  ACTIVITIES: 6 * 60 * 60 * 1000,   // 6 hours
  SUGGESTIONS: 60 * 60 * 1000,      // 1 hour
  SEARCHES: 2 * 60 * 60 * 1000,     // 2 hours
  FALLBACK: 30 * 24 * 60 * 60 * 1000 // 30 days for fallback data
} as const;

// Initialize cache namespaces
const initializeCacheNamespaces = () => {
  // Register all cache namespaces with user-scoped configuration
  Object.values(CACHE_NAMESPACES).forEach(namespace => {
    cacheUtils.registerCache({
      namespace,
      ttl: CACHE_TTL.ITINERARIES, // Default TTL, can be overridden per operation
      maxSize: 100,
      persistence: true,
      userScoped: true
    });
  });

  // Register fallback cache as non-user-scoped for global fallback data
  cacheUtils.registerCache({
    namespace: CACHE_NAMESPACES.FALLBACK_DATA,
    ttl: CACHE_TTL.FALLBACK,
    maxSize: 50,
    persistence: true,
    userScoped: false
  });
};

// Initialize caches when module loads
initializeCacheNamespaces();

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    supabase
  );
};

/**
 * Generate cache key for itineraries list
 */
const getItinerariesCacheKey = (userId: string) => `list_${userId}`;

/**
 * Generate cache key for individual itinerary
 */
const getItineraryCacheKey = (itineraryId: string) => `item_${itineraryId}`;

/**
 * Generate cache key for activities
 */
const getActivitiesCacheKey = (itineraryId: string) => `activities_${itineraryId}`;

export const unifiedDatabaseService = {
  /**
   * Get all itineraries for a user with intelligent caching
   */
  async getUserItineraries(userId: string) {
    const cacheKey = getItinerariesCacheKey(userId);
    
    try {
      // Try to get from cache first
      const cachedData = cacheUtils.get(CACHE_NAMESPACES.ITINERARIES, cacheKey);
      if (cachedData) {
        console.log('📦 UnifiedDB: Cache hit for user itineraries:', userId);
        return cachedData;
      }

      console.log('📦 UnifiedDB: Cache miss for user itineraries, fetching:', userId);

      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Using cache fallback for itineraries.');
        
        // Use fallback cache for non-Supabase environments
        const fallbackKey = `fallback_itineraries_${userId}`;
        const fallbackData = cacheUtils.get(CACHE_NAMESPACES.FALLBACK_DATA, fallbackKey);
        
        if (fallbackData) {
          return fallbackData;
        }
        
        // Return empty array if no fallback data
        return [];
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const itineraries = data || [];
      
      // Cache the result
      cacheUtils.set(
        CACHE_NAMESPACES.ITINERARIES, 
        cacheKey, 
        itineraries, 
        CACHE_TTL.ITINERARIES
      );

      console.log('📦 UnifiedDB: Cached user itineraries:', userId, itineraries.length);
      return itineraries;

    } catch (error) {
      console.error('Error fetching user itineraries:', error);
      
      // Try fallback cache on error
      const fallbackKey = `fallback_itineraries_${userId}`;
      const fallbackData = cacheUtils.get(CACHE_NAMESPACES.FALLBACK_DATA, fallbackKey);
      
      if (fallbackData) {
        console.log('📦 UnifiedDB: Using fallback cache for itineraries');
        return fallbackData;
      }
      
      return [];
    }
  },

  /**
   * Get a specific itinerary by ID with caching
   */
  async getItinerary(itineraryId: string) {
    const cacheKey = getItineraryCacheKey(itineraryId);
    
    try {
      // Try cache first
      const cachedData = cacheUtils.get(CACHE_NAMESPACES.ITINERARIES, cacheKey);
      if (cachedData) {
        console.log('📦 UnifiedDB: Cache hit for itinerary:', itineraryId);
        return cachedData;
      }

      console.log('📦 UnifiedDB: Cache miss for itinerary, fetching:', itineraryId);

      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Using cache fallback for itinerary.');
        
        const fallbackKey = `fallback_itinerary_${itineraryId}`;
        const fallbackData = cacheUtils.get(CACHE_NAMESPACES.FALLBACK_DATA, fallbackKey);
        
        if (fallbackData) {
          return fallbackData;
        }
        
        throw new Error(`Itinerary with ID ${itineraryId} not found in cache`);
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', itineraryId)
        .single();

      if (error) throw error;

      // Cache the result
      cacheUtils.set(
        CACHE_NAMESPACES.ITINERARIES, 
        cacheKey, 
        data, 
        CACHE_TTL.ITINERARIES
      );

      console.log('📦 UnifiedDB: Cached itinerary:', itineraryId);
      return data;

    } catch (error) {
      console.error('Error fetching itinerary:', error);
      
      // Try fallback cache
      const fallbackKey = `fallback_itinerary_${itineraryId}`;
      const fallbackData = cacheUtils.get(CACHE_NAMESPACES.FALLBACK_DATA, fallbackKey);
      
      if (fallbackData) {
        console.log('📦 UnifiedDB: Using fallback cache for itinerary');
        return fallbackData;
      }
      
      throw error;
    }
  },

  /**
   * Create a new itinerary with cache invalidation
   */
  async createItinerary(userId: string, name: string, destination: string, startDate?: string, endDate?: string, days: ItineraryDay[] = []) {
    try {
      let itineraryData;

      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Using cache fallback for creation.');
        
        // Create in fallback cache
        itineraryData = {
          id: Math.random().toString(36).substring(2, 15),
          user_id: userId,
          name,
          destination,
          start_date: startDate,
          end_date: endDate,
          days,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Store in fallback cache
        const fallbackKey = `fallback_itinerary_${itineraryData.id}`;
        cacheUtils.set(
          CACHE_NAMESPACES.FALLBACK_DATA,
          fallbackKey,
          itineraryData,
          CACHE_TTL.FALLBACK
        );
        
      } else {
        // Create in Supabase
        const { data, error } = await supabase
          .from('itineraries')
          .insert({
            user_id: userId,
            name,
            destination,
            start_date: startDate,
            end_date: endDate,
            days,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        itineraryData = data;
        
        // If we have activities in the days, also store them in the activities table
        if (days && days.length > 0) {
          await this.saveActivitiesFromDays(data.id, days);
        }
      }

      // Cache the new itinerary
      cacheUtils.set(
        CACHE_NAMESPACES.ITINERARIES,
        getItineraryCacheKey(itineraryData.id),
        itineraryData,
        CACHE_TTL.ITINERARIES
      );

      // Invalidate the user's itineraries list cache
      const listCacheKey = getItinerariesCacheKey(userId);
      cacheUtils.delete(CACHE_NAMESPACES.ITINERARIES, listCacheKey);

      // Emit itinerary change event for coordinated invalidation
      cacheUtils.emitItineraryChange(itineraryData.id);

      console.log('📦 UnifiedDB: Created and cached new itinerary:', itineraryData.id);
      return itineraryData;

    } catch (error) {
      console.error('Error creating itinerary:', error);
      throw error;
    }
  },

  /**
   * Update an existing itinerary with cache invalidation
   */
  async updateItinerary(itineraryId: string, updates: { 
    name?: string; 
    destination?: string;
    start_date?: string; 
    end_date?: string;
    days?: ItineraryDay[] 
  }) {
    try {
      let updatedData;

      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Using cache fallback for update.');
        
        // Update in fallback cache
        const fallbackKey = `fallback_itinerary_${itineraryId}`;
        const existingData = cacheUtils.get(CACHE_NAMESPACES.FALLBACK_DATA, fallbackKey);
        
        if (!existingData) {
          throw new Error(`Itinerary with ID ${itineraryId} not found in cache`);
        }
        
        updatedData = {
          ...existingData,
          ...updates,
          updated_at: new Date().toISOString()
        };
        
        cacheUtils.set(
          CACHE_NAMESPACES.FALLBACK_DATA,
          fallbackKey,
          updatedData,
          CACHE_TTL.FALLBACK
        );
        
      } else {
        // Update in Supabase
        const { data, error } = await supabase
          .from('itineraries')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itineraryId)
          .select()
          .single();

        if (error) throw error;
        updatedData = data;
        
        // If days are updated, update activities as well
        if (updates.days) {
          // First delete existing activities for this itinerary
          await supabase
            .from('activities')
            .delete()
            .eq('itinerary_id', itineraryId);
            
          // Then add the new ones
          await this.saveActivitiesFromDays(itineraryId, updates.days);
        }
      }

      // Update cache
      cacheUtils.set(
        CACHE_NAMESPACES.ITINERARIES,
        getItineraryCacheKey(itineraryId),
        updatedData,
        CACHE_TTL.ITINERARIES
      );

      // Invalidate related caches
      const userListKey = getItinerariesCacheKey(updatedData.user_id);
      cacheUtils.delete(CACHE_NAMESPACES.ITINERARIES, userListKey);

      // Emit itinerary change event
      cacheUtils.emitItineraryChange(itineraryId);

      console.log('📦 UnifiedDB: Updated and cached itinerary:', itineraryId);
      return updatedData;

    } catch (error) {
      console.error('Error updating itinerary:', error);
      throw error;
    }
  },

  /**
   * Delete an itinerary with cache invalidation
   */
  async deleteItinerary(itineraryId: string) {
    try {
      // Get the itinerary first to know the user ID for cache invalidation
      const itinerary = await this.getItinerary(itineraryId);
      
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Removing from cache fallback.');
        
        // Remove from fallback cache
        const fallbackKey = `fallback_itinerary_${itineraryId}`;
        cacheUtils.delete(CACHE_NAMESPACES.FALLBACK_DATA, fallbackKey);
        
      } else {
        // Delete from Supabase (activities will be deleted automatically due to CASCADE)
        const { error } = await supabase
          .from('itineraries')
          .delete()
          .eq('id', itineraryId);

        if (error) throw error;
      }

      // Remove from all relevant caches
      cacheUtils.delete(CACHE_NAMESPACES.ITINERARIES, getItineraryCacheKey(itineraryId));
      cacheUtils.delete(CACHE_NAMESPACES.ACTIVITIES, getActivitiesCacheKey(itineraryId));
      
      if (itinerary?.user_id) {
        const userListKey = getItinerariesCacheKey(itinerary.user_id);
        cacheUtils.delete(CACHE_NAMESPACES.ITINERARIES, userListKey);
      }

      // Emit itinerary change event
      cacheUtils.emitItineraryChange(itineraryId);

      console.log('📦 UnifiedDB: Deleted itinerary from cache:', itineraryId);

    } catch (error) {
      console.error('Error deleting itinerary:', error);
      throw error;
    }
  },

  /**
   * Save activities from itinerary days to the activities table
   * @private
   */
  async saveActivitiesFromDays(itineraryId: string, days: ItineraryDay[]) {
    if (!isSupabaseConfigured()) {
      // Cache activities for fallback mode
      const activitiesData = days.flatMap(day => 
        day.activities.map(activity => ({
          itinerary_id: itineraryId,
          day_number: day.dayNumber,
          ...activity
        }))
      );
      
      cacheUtils.set(
        CACHE_NAMESPACES.ACTIVITIES,
        getActivitiesCacheKey(itineraryId),
        activitiesData,
        CACHE_TTL.ACTIVITIES
      );
      
      return;
    }

    try {
      // Prepare activities for insertion
      const activitiesToInsert = days.flatMap(day => {
        return day.activities.map(activity => ({
          itinerary_id: itineraryId,
          day_number: day.dayNumber,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          start_time: activity.parsedStartTime,
          end_time: activity.parsedEndTime,
          type: activity.type,
          image_url: activity.imageUrl,
          price_range: null,
          external_id: null,
          external_source: null
        }));
      });

      if (activitiesToInsert.length > 0) {
        const { error } = await supabase
          .from('activities')
          .insert(activitiesToInsert);
  
        if (error) throw error;
        
        // Cache the activities
        cacheUtils.set(
          CACHE_NAMESPACES.ACTIVITIES,
          getActivitiesCacheKey(itineraryId),
          activitiesToInsert,
          CACHE_TTL.ACTIVITIES
        );
      }
    } catch (error) {
      console.error('Error saving activities:', error);
      throw error;
    }
  },

  /**
   * Clear all user-specific cache data
   * Useful when user logs out or switches
   */
  async clearUserCache(userId: string) {
    console.log('📦 UnifiedDB: Clearing user cache for:', userId);
    
    // This will be handled automatically by the cache manager's user-scoped invalidation
    // But we can also manually clear specific data if needed
    cacheUtils.clear(CACHE_NAMESPACES.ITINERARIES);
    cacheUtils.clear(CACHE_NAMESPACES.ACTIVITIES);
    cacheUtils.clear(CACHE_NAMESPACES.SUGGESTIONS);
    cacheUtils.clear(CACHE_NAMESPACES.SEARCHES);
  },

  /**
   * Force refresh user itineraries (bypass cache)
   */
  async refreshUserItineraries(userId: string) {
    console.log('📦 UnifiedDB: Force refreshing user itineraries:', userId);
    
    // Clear cache first
    const cacheKey = getItinerariesCacheKey(userId);
    cacheUtils.delete(CACHE_NAMESPACES.ITINERARIES, cacheKey);
    
    // Then fetch fresh data
    return this.getUserItineraries(userId);
  },

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return {
      itineraries: cacheUtils.getAnalytics(CACHE_NAMESPACES.ITINERARIES),
      activities: cacheUtils.getAnalytics(CACHE_NAMESPACES.ACTIVITIES),
      suggestions: cacheUtils.getAnalytics(CACHE_NAMESPACES.SUGGESTIONS),
      searches: cacheUtils.getAnalytics(CACHE_NAMESPACES.SEARCHES),
      fallback: cacheUtils.getAnalytics(CACHE_NAMESPACES.FALLBACK_DATA)
    };
  }
};

export default unifiedDatabaseService; 