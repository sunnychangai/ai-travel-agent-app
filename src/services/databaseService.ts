import { supabase } from './supabase';
import { Activity, ItineraryDay, SuggestionItem } from '../types';
import { formatTimeRange } from '../utils/timeUtils';
import { safeParseDate } from '../utils/dateUtils';

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL && 
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    supabase
  );
};

// ===== INPUT VALIDATION UTILITIES =====

/**
 * Validates UUID format (v4 pattern)
 */
const isValidUUID = (uuid: string): boolean => {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
};

/**
 * Validates user ID format
 */
const validateUserId = (userId: string): void => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a non-empty string');
  }
  if (userId.trim().length === 0) {
    throw new Error('User ID cannot be empty or whitespace only');
  }
  if (!isValidUUID(userId)) {
    throw new Error(`Invalid user ID format: ${userId}. Expected UUID format.`);
  }
};

/**
 * Validates itinerary ID format
 */
const validateItineraryId = (itineraryId: string): void => {
  if (!itineraryId || typeof itineraryId !== 'string') {
    throw new Error('Itinerary ID is required and must be a non-empty string');
  }
  if (itineraryId.trim().length === 0) {
    throw new Error('Itinerary ID cannot be empty or whitespace only');
  }
  if (!isValidUUID(itineraryId)) {
    throw new Error(`Invalid itinerary ID format: ${itineraryId}. Expected UUID format.`);
  }
};

/**
 * Validates activity ID format
 */
const validateActivityId = (activityId: string): void => {
  if (!activityId || typeof activityId !== 'string') {
    throw new Error('Activity ID is required and must be a non-empty string');
  }
  if (activityId.trim().length === 0) {
    throw new Error('Activity ID cannot be empty or whitespace only');
  }
  if (!isValidUUID(activityId)) {
    throw new Error(`Invalid activity ID format: ${activityId}. Expected UUID format.`);
  }
};

/**
 * Validates itinerary name/title
 */
const validateItineraryName = (name: string): void => {
  if (!name || typeof name !== 'string') {
    throw new Error('Itinerary name is required and must be a non-empty string');
  }
  if (name.trim().length === 0) {
    throw new Error('Itinerary name cannot be empty or whitespace only');
  }
  if (name.length > 200) {
    throw new Error('Itinerary name cannot exceed 200 characters');
  }
};

/**
 * Validates destination string
 */
const validateDestination = (destination: string): void => {
  if (destination && typeof destination !== 'string') {
    throw new Error('Destination must be a string');
  }
  if (destination && destination.length > 500) {
    throw new Error('Destination cannot exceed 500 characters');
  }
};

/**
 * Validates date string format
 */
const validateDateString = (dateString: string, fieldName: string): void => {
  if (!dateString) return; // Optional dates are allowed
  
  if (typeof dateString !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date string: ${dateString}`);
  }
};

/**
 * Validates itinerary days array
 */
const validateItineraryDays = (days: ItineraryDay[]): void => {
  if (!Array.isArray(days)) {
    throw new Error('Days must be an array');
  }
  
  if (days.length > 30) {
    throw new Error('Cannot have more than 30 days in an itinerary');
  }
  
  days.forEach((day, index) => {
    if (!day || typeof day !== 'object') {
      throw new Error(`Day ${index + 1} must be an object`);
    }
    
    if (typeof day.dayNumber !== 'number' || day.dayNumber < 1) {
      throw new Error(`Day ${index + 1} must have a valid dayNumber (positive integer)`);
    }
    
    if (!Array.isArray(day.activities)) {
      throw new Error(`Day ${index + 1} activities must be an array`);
    }
    
    if (day.activities.length > 20) {
      throw new Error(`Day ${index + 1} cannot have more than 20 activities`);
    }
    
    day.activities.forEach((activity, actIndex) => {
      if (!activity || typeof activity !== 'object') {
        throw new Error(`Day ${index + 1}, Activity ${actIndex + 1} must be an object`);
      }
      
      if (!activity.title || typeof activity.title !== 'string' || activity.title.trim().length === 0) {
        throw new Error(`Day ${index + 1}, Activity ${actIndex + 1} must have a non-empty title`);
      }
      
      if (activity.title.length > 200) {
        throw new Error(`Day ${index + 1}, Activity ${actIndex + 1} title cannot exceed 200 characters`);
      }
    });
  });
};

/**
 * Validates day number
 */
const validateDayNumber = (dayNumber: number): void => {
  if (typeof dayNumber !== 'number' || !Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 30) {
    throw new Error('Day number must be a positive integer between 1 and 30');
  }
};

/**
 * Validates activity object
 */
const validateActivity = (activity: Activity): void => {
  if (!activity || typeof activity !== 'object') {
    throw new Error('Activity must be an object');
  }
  
  if (!activity.title || typeof activity.title !== 'string' || activity.title.trim().length === 0) {
    throw new Error('Activity title is required and must be a non-empty string');
  }
  
  if (activity.title.length > 200) {
    throw new Error('Activity title cannot exceed 200 characters');
  }
  
  if (activity.description && typeof activity.description !== 'string') {
    throw new Error('Activity description must be a string');
  }
  
  if (activity.description && activity.description.length > 1000) {
    throw new Error('Activity description cannot exceed 1000 characters');
  }
  
  if (activity.location && typeof activity.location !== 'string') {
    throw new Error('Activity location must be a string');
  }
  
  if (activity.location && activity.location.length > 500) {
    throw new Error('Activity location cannot exceed 500 characters');
  }
};

export const databaseService = {
  /**
   * Get all itineraries for a user
   * @returns Array of itineraries with consistent field naming for the frontend
   */
  async getUserItineraries(userId: string) {
    // Validate input
    validateUserId(userId);
    console.log('✅ DatabaseService: getUserItineraries - User ID validation passed');
    
    try {
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Falling back to localStorage.');
        // Fallback to localStorage behavior
        const storageKey = 'itineraries';
        const savedItems = localStorage.getItem(storageKey);
        
        if (savedItems) {
          const parsedItems = JSON.parse(savedItems);
          // Filter by mock user and map field names consistently
          return parsedItems
            .filter((item: any) => item.user_id === userId || !item.user_id)
            .map((item: any) => ({
              id: item.id,
              title: item.name || item.title || 'My Itinerary',
              destination: item.destination || '',
              startDate: item.start_date || item.startDate || '',
              endDate: item.end_date || item.endDate || '',
              createdAt: item.created_at || item.createdAt || new Date().toISOString(),
              days: item.days || []
            }));
        }
        return [];
      }

      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map database field names to frontend-expected field names
      const mappedData = (data || []).map((item: any) => ({
        id: item.id,
        title: item.name || item.title || 'My Itinerary',
        destination: item.destination || '',
        startDate: item.start_date || '',
        endDate: item.end_date || '',
        createdAt: item.created_at || new Date().toISOString(),
        days: item.days || []
      }));
      
      console.log('📋 DatabaseService: Mapped user itineraries:', mappedData.length, 'items');
      return mappedData;
    } catch (error) {
      console.error('❌ DatabaseService: Error fetching user itineraries:', error);
      // Fallback to localStorage on any error
      const storageKey = 'itineraries';
      const savedItems = localStorage.getItem(storageKey);
      
      if (savedItems) {
        const parsedItems = JSON.parse(savedItems);
        return parsedItems
          .filter((item: any) => item.user_id === userId || !item.user_id)
          .map((item: any) => ({
            id: item.id,
            title: item.name || item.title || 'My Itinerary',
            destination: item.destination || '',
            startDate: item.start_date || item.startDate || '',
            endDate: item.end_date || item.endDate || '',
            createdAt: item.created_at || item.createdAt || new Date().toISOString(),
            days: item.days || []
          }));
      }
      return [];
    }
  },

  /**
   * Get a specific itinerary by ID
   */
  async getItinerary(itineraryId: string) {
    // Validate input
    validateItineraryId(itineraryId);
    console.log('✅ DatabaseService: getItinerary - Itinerary ID validation passed');
    
    try {
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Falling back to localStorage.');
        // Fallback to localStorage behavior
        const storageKey = 'itineraries';
        const savedItems = localStorage.getItem(storageKey);
        
        if (savedItems) {
          const parsedItems = JSON.parse(savedItems);
          const itinerary = parsedItems.find((item: any) => item.id === itineraryId);
          if (!itinerary) {
            throw new Error(`Itinerary with ID ${itineraryId} not found`);
          }
          return itinerary;
        }
        throw new Error(`Itinerary with ID ${itineraryId} not found`);
      }

      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', itineraryId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching itinerary:', error);
      throw error;
    }
  },

  /**
   * Create a new itinerary
   * @returns {Promise<string>} The ID of the created itinerary
   */
  async createItinerary(userId: string, name: string, destination: string, startDate?: string, endDate?: string, days: ItineraryDay[] = []): Promise<string> {
    // Validate inputs
    validateUserId(userId);
    validateItineraryName(name);
    validateDestination(destination);
    if (startDate) validateDateString(startDate, 'Start date');
    if (endDate) validateDateString(endDate, 'End date');
    validateItineraryDays(days);
    
    console.log('✅ DatabaseService: createItinerary - All input validation passed');
    
    try {
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Falling back to localStorage.');
        // Fallback to localStorage behavior
        const itineraryData = {
          id: Math.random().toString(36).substring(2, 15), // Generate a mock ID
          user_id: userId,
          name,
          destination,
          start_date: startDate,
          end_date: endDate,
          days,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        const storageKey = 'itineraries';
        const savedItems = localStorage.getItem(storageKey);
        const itineraries = savedItems ? JSON.parse(savedItems) : [];
        itineraries.push(itineraryData);
        localStorage.setItem(storageKey, JSON.stringify(itineraries));
        
        return itineraryData.id;
      }

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
      
      // If we have activities in the days, also store them in the activities table
      if (days && days.length > 0) {
        await this.saveActivitiesFromDays(data.id, days);
      }
      
      return data.id;
    } catch (error) {
      console.error('Error creating itinerary:', error);
      throw error;
    }
  },

  /**
   * Update an existing itinerary
   */
  async updateItinerary(itineraryId: string, updates: { 
    name?: string; 
    destination?: string;
    start_date?: string; 
    end_date?: string;
    days?: ItineraryDay[] 
  }) {
    // Validate inputs
    validateItineraryId(itineraryId);
    if (updates.name) validateItineraryName(updates.name);
    if (updates.destination) validateDestination(updates.destination);
    if (updates.start_date) validateDateString(updates.start_date, 'Start date');
    if (updates.end_date) validateDateString(updates.end_date, 'End date');
    if (updates.days) validateItineraryDays(updates.days);
    
    console.log('✅ DatabaseService: updateItinerary - All input validation passed');
    
    try {
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Falling back to localStorage.');
        // Fallback to localStorage behavior
        const storageKey = 'itineraries';
        const savedItems = localStorage.getItem(storageKey);
        
        if (savedItems) {
          const itineraries = JSON.parse(savedItems);
          const index = itineraries.findIndex((item: any) => item.id === itineraryId);
          
          if (index >= 0) {
            itineraries[index] = {
              ...itineraries[index],
              ...updates,
              updated_at: new Date().toISOString()
            };
            localStorage.setItem(storageKey, JSON.stringify(itineraries));
            return itineraries[index];
          }
        }
        throw new Error(`Itinerary with ID ${itineraryId} not found`);
      }

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
      
      return data;
    } catch (error) {
      console.error('Error updating itinerary:', error);
      throw error;
    }
  },

  /**
   * Delete an itinerary
   */
  async deleteItinerary(itineraryId: string) {
    // Validate input
    validateItineraryId(itineraryId);
    console.log('✅ DatabaseService: deleteItinerary - Itinerary ID validation passed');
    
    try {
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Falling back to localStorage.');
        // Fallback to localStorage behavior
        const storageKey = 'itineraries';
        const savedItems = localStorage.getItem(storageKey);
        
        if (savedItems) {
          const itineraries = JSON.parse(savedItems);
          const newItineraries = itineraries.filter((item: any) => item.id !== itineraryId);
          localStorage.setItem(storageKey, JSON.stringify(newItineraries));
        }
        return;
      }

      // Activities will be deleted automatically due to ON DELETE CASCADE
      const { error } = await supabase
        .from('itineraries')
        .delete()
        .eq('id', itineraryId);

      if (error) throw error;
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
    // Validate inputs
    validateItineraryId(itineraryId);
    validateItineraryDays(days);
    console.log('✅ DatabaseService: saveActivitiesFromDays - Input validation passed');
    
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
          price_range: null, // Not in current Activity model
          external_id: null, // Not in current Activity model
          external_source: null // Not in current Activity model
        }));
      });

      if (activitiesToInsert.length > 0) {
        const { error } = await supabase
          .from('activities')
          .insert(activitiesToInsert);
  
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving activities:', error);
      throw error;
    }
  },

  /**
   * Get activities for an itinerary from the activities table
   */
  async getActivities(itineraryId: string) {
    // Validate input
    validateItineraryId(itineraryId);
    console.log('✅ DatabaseService: getActivities - Itinerary ID validation passed');
    
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('itinerary_id', itineraryId)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching activities:', error);
      throw error;
    }
  },

  /**
   * Add a single activity to an itinerary
   */
  async addActivity(itineraryId: string, dayNumber: number, activity: Activity) {
    // Validate inputs
    validateItineraryId(itineraryId);
    validateDayNumber(dayNumber);
    validateActivity(activity);
    
    console.log('✅ DatabaseService: addActivity - All input validation passed');
    
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          itinerary_id: itineraryId,
          day_number: dayNumber,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          start_time: activity.parsedStartTime,
          end_time: activity.parsedEndTime,
          type: activity.type,
          image_url: activity.imageUrl
        })
        .select()
        .single();

      if (error) throw error;
      
      // Also update the days JSONB in the itinerary
      await this.updateItineraryDaysFromActivities(itineraryId);
      
      return data;
    } catch (error) {
      console.error('Error adding activity:', error);
      throw error;
    }
  },

  /**
   * Update an activity
   */
  async updateActivity(activityId: string, updates: Partial<Activity>) {
    // Validate inputs
    validateActivityId(activityId);
    
    // Validate partial activity updates
    if (updates.title !== undefined) {
      if (!updates.title || typeof updates.title !== 'string' || updates.title.trim().length === 0) {
        throw new Error('Activity title must be a non-empty string');
      }
      if (updates.title.length > 200) {
        throw new Error('Activity title cannot exceed 200 characters');
      }
    }
    
    if (updates.description !== undefined && updates.description !== null) {
      if (typeof updates.description !== 'string') {
        throw new Error('Activity description must be a string');
      }
      if (updates.description.length > 1000) {
        throw new Error('Activity description cannot exceed 1000 characters');
      }
    }
    
    if (updates.location !== undefined && updates.location !== null) {
      if (typeof updates.location !== 'string') {
        throw new Error('Activity location must be a string');
      }
      if (updates.location.length > 500) {
        throw new Error('Activity location cannot exceed 500 characters');
      }
    }
    
    console.log('✅ DatabaseService: updateActivity - All input validation passed');
    
    try {
      // First get the itinerary ID for this activity
      const { data: activityData, error: fetchError } = await supabase
        .from('activities')
        .select('itinerary_id')
        .eq('id', activityId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Update the activity
      const { data, error } = await supabase
        .from('activities')
        .update({
          title: updates.title,
          description: updates.description,
          location: updates.location,
          start_time: updates.parsedStartTime,
          end_time: updates.parsedEndTime,
          type: updates.type,
          image_url: updates.imageUrl
        })
        .eq('id', activityId)
        .select()
        .single();

      if (error) throw error;
      
      // Update the days JSONB in the itinerary
      await this.updateItineraryDaysFromActivities(activityData.itinerary_id);
      
      return data;
    } catch (error) {
      console.error('Error updating activity:', error);
      throw error;
    }
  },

  /**
   * Delete an activity
   */
  async deleteActivity(activityId: string) {
    // Validate input
    validateActivityId(activityId);
    console.log('✅ DatabaseService: deleteActivity - Activity ID validation passed');
    
    try {
      // First get the itinerary ID for this activity
      const { data: activityData, error: fetchError } = await supabase
        .from('activities')
        .select('itinerary_id')
        .eq('id', activityId)
        .single();
        
      if (fetchError) throw fetchError;
      
      // Delete the activity
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

      if (error) throw error;
      
      // Update the days JSONB in the itinerary
      await this.updateItineraryDaysFromActivities(activityData.itinerary_id);
    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  },

  /**
   * Update itinerary days JSONB from activities table
   * This keeps the days JSONB field in sync with the activities table
   * @private
   */
  async updateItineraryDaysFromActivities(itineraryId: string) {
    // Validate input
    validateItineraryId(itineraryId);
    console.log('✅ DatabaseService: updateItineraryDaysFromActivities - Itinerary ID validation passed');
    
    try {
      // Get all activities for this itinerary
      const { data: activities, error: fetchError } = await supabase
        .from('activities')
        .select('*')
        .eq('itinerary_id', itineraryId)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true });
        
      if (fetchError) throw fetchError;
      
      // Group activities by day
      const dayMap = new Map<number, Activity[]>();
      
      activities.forEach(activity => {
        const dayNum = activity.day_number;
        if (!dayMap.has(dayNum)) {
          dayMap.set(dayNum, []);
        }
        
        // Convert database activity to the application Activity type
        const appActivity: Activity = {
          id: activity.id,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          time: activity.time ? `${
            safeParseDate(activity.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})
          }${
            activity.end_time ? ` - ${safeParseDate(activity.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: true})}` : ''
          }` : '',
          type: activity.type,
          imageUrl: activity.image_url,
          dayNumber: activity.day_number,
          parsedStartTime: activity.start_time,
          parsedEndTime: activity.end_time
        };
        
        dayMap.get(dayNum)!.push(appActivity);
      });
      
      // Convert to ItineraryDay array
      const days: ItineraryDay[] = Array.from(dayMap.entries()).map(([dayNumber, activities]) => {
        // Get the date string for this day from the first activity
        // In a real implementation, you might want to get this from the itinerary's start_date
        return {
          dayNumber,
          date: '', // We'd need a reference to start_date to calculate this
          activities
        };
      });
      
      // Get the itinerary to access its start_date
      const { data: itinerary, error: itineraryError } = await supabase
        .from('itineraries')
        .select('start_date')
        .eq('id', itineraryId)
        .single();
        
      if (itineraryError) throw itineraryError;
      
      // Calculate dayCount from the maximum day number in activities
      const dayCount = Math.max(...Array.from(dayMap.keys()), 1);
      
      // If we have a start_date, calculate dates for each day
      if (itinerary.start_date) {
        const startDate = safeParseDate(itinerary.start_date);
        const itineraryDays = [];
        
        // Generate days from start date
        for (let i = 0; i < dayCount; i++) {
          const dayDate = safeParseDate(itinerary.start_date);
          dayDate.setDate(startDate.getDate() + i);
          itineraryDays.push({
            dayNumber: i + 1,
            date: dayDate.toISOString().split('T')[0],
            activities: []
          });
        }
      }
      
      // Update the itinerary with the new days JSONB
      const { error: updateError } = await supabase
        .from('itineraries')
        .update({
          days,
          updated_at: new Date().toISOString()
        })
        .eq('id', itineraryId);
        
      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating itinerary days from activities:', error);
      throw error;
    }
  },

  /**
   * Get travel suggestions from the database
   */
  async getSuggestions(location: string, limit = 10) {
    // Validate inputs
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      throw new Error('Location is required and must be a non-empty string');
    }
    
    if (location.length > 500) {
      throw new Error('Location cannot exceed 500 characters');
    }
    
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    
    console.log('✅ DatabaseService: getSuggestions - Input validation passed');
    
    try {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .ilike('location', `%${location}%`)
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      throw error;
    }
  },
  
  /**
   * Get destinations from the database
   */
  async getDestinations(query?: string, limit = 10) {
    // Validate inputs
    if (query !== undefined) {
      if (typeof query !== 'string') {
        throw new Error('Query must be a string');
      }
      
      if (query.length > 500) {
        throw new Error('Query cannot exceed 500 characters');
      }
    }
    
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    
    console.log('✅ DatabaseService: getDestinations - Input validation passed');
    
    try {
      let queryBuilder = supabase
        .from('destinations')
        .select('*')
        .order('name')
        .limit(limit);
        
      if (query) {
        queryBuilder = queryBuilder.ilike('name', `%${query}%`);
      }
        
      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching destinations:', error);
      throw error;
    }
  },
  
  /**
   * Save a search query for a user
   */
  async saveSearchQuery(userId: string, query: string, destination?: string) {
    // Validate inputs
    validateUserId(userId);
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Search query is required and must be a non-empty string');
    }
    
    if (query.length > 500) {
      throw new Error('Search query cannot exceed 500 characters');
    }
    
    if (destination) {
      validateDestination(destination);
    }
    
    console.log('✅ DatabaseService: saveSearchQuery - All input validation passed');
    
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: userId,
          query,
          destination,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving search query:', error);
      throw error;
    }
  },
  
  /**
   * Get saved searches for a user
   */
  async getSavedSearches(userId: string, limit = 10) {
    // Validate inputs
    validateUserId(userId);
    
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new Error('Limit must be a number between 1 and 100');
    }
    
    console.log('✅ DatabaseService: getSavedSearches - Input validation passed');
    
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      throw error;
    }
  },
  
  /**
   * Submit user feedback
   */
  async submitFeedback(userId: string | null, feedbackType: string, content: string, rating?: number) {
    // Validate inputs
    if (userId !== null) {
      validateUserId(userId);
    }
    
    if (!feedbackType || typeof feedbackType !== 'string' || feedbackType.trim().length === 0) {
      throw new Error('Feedback type is required and must be a non-empty string');
    }
    
    if (feedbackType.length > 100) {
      throw new Error('Feedback type cannot exceed 100 characters');
    }
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Feedback content is required and must be a non-empty string');
    }
    
    if (content.length > 2000) {
      throw new Error('Feedback content cannot exceed 2000 characters');
    }
    
    if (rating !== undefined) {
      if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new Error('Rating must be an integer between 1 and 5');
      }
    }
    
    console.log('✅ DatabaseService: submitFeedback - All input validation passed');
    
    try {
      const { data, error } = await supabase
        .from('feedback')
        .insert({
          user_id: userId,
          feedback_type: feedbackType,
          content,
          rating,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }
}; 