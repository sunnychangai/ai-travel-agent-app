/**
 * Unified Itinerary Service
 * 
 * Replaces complex localStorage logic in ItineraryContext with cache-integrated
 * itinerary management. Provides user-scoped persistence, automatic validation,
 * and coordinated invalidation with conversation context.
 */

import { Activity, ItineraryDay, SuggestionItem } from '../types';
import { CacheManager, CacheEvent } from './cacheManager';
import { databaseService } from './databaseService';

export interface ItineraryData {
  id: string | null;
  title: string;
  days: ItineraryDay[];
  destination?: string;
  startDate?: string;
  endDate?: string;
  createdAt: Date;
  lastUpdated: Date;
  version: number;
}

export interface ItinerarySaveOptions {
  title?: string;
  shouldCreateNew?: boolean;
  persistToDatabase?: boolean;
}

export interface ItineraryAnalytics {
  totalDays: number;
  totalActivities: number;
  destinations: string[];
  dateRange: { start: string; end: string };
  lastModified: Date;
}

export class UnifiedItineraryService {
  private cacheManager: CacheManager;
  private readonly cacheNamespace = 'itinerary';
  private readonly suggestionsNamespace = 'itinerary-suggestions';
  private readonly itineraryTtl = 7200000; // 2 hours

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;

    // Register cache namespaces
    this.cacheManager.registerCache({
      namespace: this.cacheNamespace,
      ttl: this.itineraryTtl,
      userScoped: true,
      persistence: true,
      maxSize: 10 // Maximum number of cached itineraries
    });

    this.cacheManager.registerCache({
      namespace: this.suggestionsNamespace,
      ttl: 600000, // 10 minutes for suggestions
      userScoped: true,
      persistence: false,
      maxSize: 5
    });

    // Register for destination change events to validate itinerary consistency
    this.cacheManager.addEventListener(CacheEvent.DESTINATION_CHANGE, (data: any) => {
      this.validateItineraryDestination(data.newDestination);
    });

    // Register for conversation reset events to clear stale itineraries
    this.cacheManager.addEventListener(CacheEvent.CONVERSATION_RESET, () => {
      this.clearCache();
    });
  }

  /**
   * Initialize empty itinerary data
   */
  private initializeItineraryData(): ItineraryData {
    const now = new Date();
    return {
      id: null,
      title: 'My Itinerary',
      days: [],
      createdAt: now,
      lastUpdated: now,
      version: 1
    };
  }

  /**
   * Load current itinerary from cache
   */
  getCurrentItinerary(): ItineraryData {
    try {
      console.log('🔍 UnifiedItineraryService: Loading current itinerary from cache...');
      const cached = this.cacheManager.get(this.cacheNamespace, 'current') as ItineraryData | null;
      
      if (cached && this.isValidItinerary(cached)) {
        console.log('✅ UnifiedItineraryService: Found valid cached itinerary with', cached.days.length, 'days');
        console.log('🔍 UnifiedItineraryService: Cached itinerary ID:', {
          id: cached.id,
          idType: typeof cached.id,
          isString: typeof cached.id === 'string'
        });
        
        // Additional check for corrupted ID data
        if (cached.id !== null && cached.id !== undefined && typeof cached.id !== 'string') {
          console.warn('⚠️ UnifiedItineraryService: Detected corrupted ID in cache, clearing cache');
          this.clearCorruptedCache();
          return this.initializeItineraryData();
        }
        
        return this.restoreDates(cached);
      }
      
      console.log('📝 UnifiedItineraryService: No valid cached itinerary found, initializing empty itinerary');
      return this.initializeItineraryData();
    } catch (error) {
      console.error('❌ UnifiedItineraryService: Error loading current itinerary:', error);
      return this.initializeItineraryData();
    }
  }

  /**
   * Save current itinerary to cache
   */
  saveCurrentItinerary(itinerary: ItineraryData): void {
    try {
      // Validate ID before saving to prevent cache corruption
      if (itinerary.id !== null && itinerary.id !== undefined) {
        if (typeof itinerary.id !== 'string') {
          console.error('❌ UnifiedItineraryService: Attempting to save itinerary with non-string ID:', itinerary.id);
          throw new Error(`Cannot save itinerary with invalid ID type: ${typeof itinerary.id}`);
        }
        
        if (!this.isValidUUID(itinerary.id)) {
          console.error('❌ UnifiedItineraryService: Attempting to save itinerary with invalid UUID:', itinerary.id);
          throw new Error(`Cannot save itinerary with invalid UUID format: ${itinerary.id}`);
        }
      }
      
      itinerary.lastUpdated = new Date();
      this.cacheManager.set(this.cacheNamespace, 'current', itinerary);
      
      // Emit itinerary change event
      this.cacheManager.emitEvent(CacheEvent.ITINERARY_CHANGE, {
        itineraryId: itinerary.id,
        destination: itinerary.destination
      });
      
      console.log('💾 UnifiedItineraryService: Saved current itinerary with ID:', itinerary.id);
    } catch (error) {
      console.error('❌ UnifiedItineraryService: Error saving current itinerary:', error);
      throw error; // Re-throw to prevent saving corrupted data
    }
  }

  /**
   * Validate UUID format (basic UUID v4 pattern check)
   */
  private isValidUUID(uuid: string): boolean {
    if (!uuid || typeof uuid !== 'string') return false;
    
    // Basic UUID v4 pattern: 8-4-4-4-12 hexadecimal characters
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(uuid);
  }

  /**
   * Validate itinerary structure and age
   */
  private isValidItinerary(itinerary: any): boolean {
    if (!itinerary || typeof itinerary !== 'object') return false;
    
    // Check required fields
    const requiredFields = ['title', 'days', 'createdAt', 'version'];
    if (!requiredFields.every(field => field in itinerary)) return false;

    // Check if itinerary is too old (older than 7 days)
    const itineraryAge = Date.now() - new Date(itinerary.createdAt).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (itineraryAge > maxAge) return false;

    // Check version compatibility
    if (itinerary.version > 1) {
      console.warn('Itinerary version not supported:', itinerary.version);
      return false;
    }

    return true;
  }

  /**
   * Restore Date objects from cached data
   */
  private restoreDates(itinerary: any): ItineraryData {
    // Ensure ID is properly handled
    let cleanId: string | null = null;
    if (itinerary.id !== null && itinerary.id !== undefined) {
      if (typeof itinerary.id === 'string') {
        cleanId = itinerary.id;
      } else if (itinerary.id && typeof itinerary.id === 'object' && itinerary.id.toString) {
        console.warn('⚠️ UnifiedItineraryService: Cached ID is object, converting to string:', itinerary.id);
        cleanId = itinerary.id.toString();
      } else {
        console.error('❌ UnifiedItineraryService: Invalid cached ID format:', itinerary.id);
        cleanId = null; // Reset to null for invalid formats
      }
      
      // Validate UUID format if not null
      if (cleanId && !this.isValidUUID(cleanId)) {
        console.error('❌ UnifiedItineraryService: Invalid UUID in cached data:', cleanId);
        cleanId = null; // Reset to null for invalid UUIDs
      }
    }
    
    return {
      ...itinerary,
      id: cleanId,
      createdAt: new Date(itinerary.createdAt),
      lastUpdated: new Date(itinerary.lastUpdated),
      days: (itinerary.days || []).map((day: any) => ({
        ...day,
        activities: (day.activities || []).map((activity: any) => ({
          ...activity,
          createdAt: activity.createdAt ? new Date(activity.createdAt) : undefined
        }))
      }))
    };
  }

  /**
   * Update itinerary days with automatic saving
   */
  updateItineraryDays(days: ItineraryDay[]): ItineraryData {
    const current = this.getCurrentItinerary();
    const updated: ItineraryData = {
      ...current,
      days: days,
      destination: this.extractDestination(days),
      startDate: this.extractStartDate(days),
      endDate: this.extractEndDate(days)
    };
    
    this.saveCurrentItinerary(updated);
    return updated;
  }

  /**
   * Update itinerary metadata
   */
  updateItineraryMetadata(updates: Partial<Pick<ItineraryData, 'title' | 'id'>>): ItineraryData {
    // Validate ID if provided
    if (updates.id && !this.isValidUUID(updates.id)) {
      console.error('❌ UnifiedItineraryService: Invalid UUID format in metadata update:', updates.id);
      throw new Error(`Invalid UUID format: ${updates.id}`);
    }
    
    const current = this.getCurrentItinerary();
    const updated = { ...current, ...updates };
    this.saveCurrentItinerary(updated);
    
    if (updates.id) {
      console.log('🆔 UnifiedItineraryService: Updated itinerary metadata with ID:', updates.id);
    }
    
    return updated;
  }

  /**
   * Add activity to specific day
   */
  addActivity(dayNumber: number, activity: Omit<Activity, 'id'>): ItineraryData {
    const current = this.getCurrentItinerary();
    const activityWithId: Activity = {
      ...activity,
      id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const updatedDays = current.days.map(day => {
      if (day.dayNumber === dayNumber) {
        const updatedActivities = [...day.activities, activityWithId];
        return {
          ...day,
          activities: this.sortActivitiesByTime(updatedActivities)
        };
      }
      return day;
    });

    return this.updateItineraryDays(updatedDays);
  }

  /**
   * Update specific activity
   */
  updateActivity(dayNumber: number, activityId: string, updates: Partial<Activity>): ItineraryData {
    const current = this.getCurrentItinerary();
    
    const updatedDays = current.days.map(day => {
      if (day.dayNumber === dayNumber) {
        const updatedActivities = day.activities.map(activity => 
          activity.id === activityId ? { ...activity, ...updates } : activity
        );
        return {
          ...day,
          activities: this.sortActivitiesByTime(updatedActivities)
        };
      }
      return day;
    });

    return this.updateItineraryDays(updatedDays);
  }

  /**
   * Delete activity from specific day
   */
  deleteActivity(dayNumber: number, activityId: string): ItineraryData {
    const current = this.getCurrentItinerary();
    
    const updatedDays = current.days.map(day => {
      if (day.dayNumber === dayNumber) {
        return {
          ...day,
          activities: day.activities.filter(activity => activity.id !== activityId)
        };
      }
      return day;
    });

    return this.updateItineraryDays(updatedDays);
  }

  /**
   * Add new day to itinerary
   */
  addDay(day: ItineraryDay): ItineraryData {
    const current = this.getCurrentItinerary();
    const existingDayIndex = current.days.findIndex(d => d.dayNumber === day.dayNumber);
    
    let updatedDays: ItineraryDay[];
    if (existingDayIndex !== -1) {
      // Replace existing day
      updatedDays = [...current.days];
      updatedDays[existingDayIndex] = day;
    } else {
      // Add new day and sort
      updatedDays = [...current.days, day].sort((a, b) => a.dayNumber - b.dayNumber);
    }

    return this.updateItineraryDays(updatedDays);
  }

  /**
   * Delete day from itinerary
   */
  deleteDay(dayNumber: number): ItineraryData {
    const current = this.getCurrentItinerary();
    const updatedDays = current.days.filter(day => day.dayNumber !== dayNumber);
    return this.updateItineraryDays(updatedDays);
  }

  /**
   * Sort activities by time
   */
  private sortActivitiesByTime(activities: Activity[]): Activity[] {
    if (!activities || activities.length <= 1) return activities;
    
    return [...activities].sort((a, b) => {
      const getMinutes = (timeStr: string): number => {
        if (!timeStr) return 0;
        
        const startTime = timeStr.split(" - ")[0];
        let hours = 0;
        let minutes = 0;
        
        if (startTime.includes("AM") || startTime.includes("PM")) {
          const match = startTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            const [_, h, m, period] = match;
            hours = parseInt(h, 10);
            minutes = parseInt(m, 10);
            
            if (period.toUpperCase() === "PM" && hours < 12) {
              hours += 12;
            } else if (period.toUpperCase() === "AM" && hours === 12) {
              hours = 0;
            }
          }
        } else {
          const parts = startTime.split(":");
          if (parts.length === 2) {
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
          }
        }
        
        return hours * 60 + minutes;
      };
      
      const timeA = getMinutes(a.time || '');
      const timeB = getMinutes(b.time || '');
      return timeA - timeB;
    });
  }

  /**
   * Extract destination from itinerary days
   */
  private extractDestination(days: ItineraryDay[]): string {
    if (days.length === 0) return '';
    
    const allActivities = days.flatMap(day => day.activities);
    const locationActivity = allActivities.find(a => a.location);
    
    if (locationActivity?.location) {
      const parts = locationActivity.location.split(',');
      return parts.length > 1 ? parts[1].trim() : locationActivity.location;
    }
    
    return '';
  }

  /**
   * Extract start date from itinerary days
   */
  private extractStartDate(days: ItineraryDay[]): string {
    if (days.length === 0) return new Date().toISOString().split('T')[0];
    
    const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
    return sortedDays[0]?.date || new Date().toISOString().split('T')[0];
  }

  /**
   * Extract end date from itinerary days
   */
  private extractEndDate(days: ItineraryDay[]): string {
    if (days.length === 0) return new Date().toISOString().split('T')[0];
    
    const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
    return sortedDays[sortedDays.length - 1]?.date || new Date().toISOString().split('T')[0];
  }

  /**
   * Validate itinerary destination against conversation context
   */
  private validateItineraryDestination(conversationDestination?: string): void {
    if (!conversationDestination) return;
    
    const current = this.getCurrentItinerary();
    const itineraryDestination = current.destination;
    
    if (!itineraryDestination || current.days.length === 0) return;
    
    // Simple destination consistency check
    const normalizeDestination = (dest: string): string => {
      return dest.toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 2)
        .join(' ');
    };
    
    const normalizedItinerary = normalizeDestination(itineraryDestination);
    const normalizedConversation = normalizeDestination(conversationDestination);
    
    // Check for basic word overlap
    const itineraryWords = normalizedItinerary.split(' ');
    const conversationWords = normalizedConversation.split(' ');
    const hasOverlap = itineraryWords.some(word => 
      conversationWords.some(cWord => word.includes(cWord) || cWord.includes(word))
    );
    
    if (!hasOverlap) {
      console.log('🚨 UnifiedItineraryService: Destination mismatch detected, clearing itinerary');
      console.log(`📍 Conversation: "${conversationDestination}"`);
      console.log(`🗺️ Itinerary: "${itineraryDestination}"`);
      
      this.clearCurrentItinerary();
    }
  }

  /**
   * Clear current itinerary
   */
  clearCurrentItinerary(): void {
    const emptyItinerary = this.initializeItineraryData();
    this.saveCurrentItinerary(emptyItinerary);
    console.log('🧹 UnifiedItineraryService: Cleared current itinerary');
  }

  /**
   * Clear corrupted cache data and reinitialize
   */
  private clearCorruptedCache(): void {
    console.warn('🧹 UnifiedItineraryService: Clearing potentially corrupted cache data');
    this.cacheManager.clearNamespace(this.cacheNamespace);
    const emptyItinerary = this.initializeItineraryData();
    this.saveCurrentItinerary(emptyItinerary);
  }

  /**
   * Clear all itinerary cache
   */
  clearCache(): void {
    this.cacheManager.clearNamespace(this.cacheNamespace);
    this.cacheManager.clearNamespace(this.suggestionsNamespace);
    console.log('🧹 UnifiedItineraryService: Cleared all cache');
  }

  /**
   * Save itinerary to database (for authenticated users)
   * @param userId - The authenticated user's ID
   * @param options - Save options including title and whether to create new
   * @returns {Promise<string | null>} The ID of the saved itinerary, or null if failed
   */
  async saveToDatabase(userId: string, options: ItinerarySaveOptions = {}): Promise<string | null> {
    try {
      const current = this.getCurrentItinerary();
      
      if (current.days.length === 0) {
        console.warn('🚫 UnifiedItineraryService: Cannot save empty itinerary to database');
        return null;
      }
      
      const title = options.title || current.title;
      const shouldCreateNew = options.shouldCreateNew || !current.id;
      
      console.log(`💾 UnifiedItineraryService: Saving itinerary "${title}" (${shouldCreateNew ? 'CREATE' : 'UPDATE'})`);
      
      const itineraryData = {
        title,
        destination: current.destination || '',
        start_date: current.startDate || '',
        end_date: current.endDate || '',
        days: current.days
      };
      
      let savedId: string;
      
      if (shouldCreateNew || !current.id) {
        console.log('📝 UnifiedItineraryService: Creating new itinerary in database...');
        savedId = await databaseService.createItinerary(
          userId, 
          title, 
          current.destination || '', 
          current.startDate || '', 
          current.endDate || '', 
          current.days
        );
        
        // Validate that we received a valid UUID string
        if (!savedId || typeof savedId !== 'string') {
          throw new Error(`Invalid ID returned from createItinerary: ${savedId}`);
        }
        
        console.log('✅ UnifiedItineraryService: Created new itinerary with ID:', savedId);
      } else {
        console.log('📝 UnifiedItineraryService: Updating existing itinerary:', current.id);
        
        // Validate current ID is a valid string
        if (!current.id || typeof current.id !== 'string') {
          throw new Error(`Invalid current itinerary ID: ${current.id}`);
        }
        
        await databaseService.updateItinerary(current.id, itineraryData);
        savedId = current.id;
        
        console.log('✅ UnifiedItineraryService: Updated existing itinerary with ID:', savedId);
      }
      
      // Validate savedId before using it
      if (!this.isValidUUID(savedId)) {
        throw new Error(`Invalid UUID format for savedId: ${savedId}`);
      }
      
      // Update current itinerary with saved ID
      this.updateItineraryMetadata({ id: savedId, title });
      
      console.log('💾 UnifiedItineraryService: Successfully saved to database with ID:', savedId);
      return savedId;
    } catch (error) {
      console.error('❌ UnifiedItineraryService: Error saving itinerary to database:', error);
      return null;
    }
  }

  /**
   * Load itinerary from database
   */
  async loadFromDatabase(itineraryId: string): Promise<ItineraryData | null> {
    try {
      const dbItinerary = await databaseService.getItinerary(itineraryId);
      
      if (!dbItinerary) {
        console.warn('Itinerary not found in database:', itineraryId);
        return null;
      }
      
      console.log('🔍 UnifiedItineraryService: Raw data from database:', {
        id: dbItinerary.id,
        idType: typeof dbItinerary.id,
        isString: typeof dbItinerary.id === 'string'
      });
      
      // Ensure ID is always a string, handle object case
      let cleanId: string;
      if (typeof dbItinerary.id === 'string') {
        cleanId = dbItinerary.id;
      } else if (dbItinerary.id && typeof dbItinerary.id === 'object' && dbItinerary.id.toString) {
        console.warn('⚠️ UnifiedItineraryService: ID is object, converting to string:', dbItinerary.id);
        cleanId = dbItinerary.id.toString();
      } else {
        throw new Error(`Invalid itinerary ID format: ${dbItinerary.id} (type: ${typeof dbItinerary.id})`);
      }
      
      // Validate the cleaned ID is a proper UUID
      if (!this.isValidUUID(cleanId)) {
        throw new Error(`Invalid UUID format for itinerary ID: ${cleanId}`);
      }
      
      const itineraryData: ItineraryData = {
        id: cleanId,
        title: dbItinerary.name || dbItinerary.title || 'My Itinerary',
        days: dbItinerary.days || [],
        destination: dbItinerary.destination,
        startDate: dbItinerary.start_date || dbItinerary.startDate,
        endDate: dbItinerary.end_date || dbItinerary.endDate,
        createdAt: new Date(dbItinerary.created_at || dbItinerary.createdAt || Date.now()),
        lastUpdated: new Date(),
        version: 1
      };
      
      this.saveCurrentItinerary(itineraryData);
      console.log('📥 UnifiedItineraryService: Loaded from database with validated ID:', cleanId);
      
      return itineraryData;
    } catch (error) {
      console.error('❌ UnifiedItineraryService: Error loading itinerary from database:', error);
      return null;
    }
  }

  /**
   * Get itinerary analytics
   */
  getAnalytics(): ItineraryAnalytics {
    const current = this.getCurrentItinerary();
    const allActivities = current.days.flatMap(day => day.activities);
    
    // Extract unique destinations
    const destinations = Array.from(new Set(
      allActivities
        .map(activity => activity.location)
        .filter(Boolean)
        .map(location => location!.split(',')[1]?.trim() || location!)
    ));
    
    return {
      totalDays: current.days.length,
      totalActivities: allActivities.length,
      destinations,
      dateRange: {
        start: current.startDate || '',
        end: current.endDate || ''
      },
      lastModified: current.lastUpdated
    };
  }

  /**
   * Suggestions management
   */
  getSuggestions(): SuggestionItem[] {
    return this.cacheManager.get(this.suggestionsNamespace, 'current') || [];
  }

  setSuggestions(suggestions: SuggestionItem[]): void {
    this.cacheManager.set(this.suggestionsNamespace, 'current', suggestions);
  }

  addSuggestion(suggestion: SuggestionItem): void {
    const current = this.getSuggestions();
    this.setSuggestions([...current, suggestion]);
  }

  removeSuggestion(suggestionId: string): void {
    const current = this.getSuggestions();
    this.setSuggestions(current.filter(s => s.id !== suggestionId));
  }

  clearSuggestions(): void {
    this.setSuggestions([]);
  }
} 