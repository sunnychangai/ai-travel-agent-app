import { supabase } from './supabase';
import { Activity, ItineraryDay, SuggestionItem } from '../types';

export const databaseService = {
  /**
   * Get all itineraries for a user
   */
  async getUserItineraries(userId: string) {
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user itineraries:', error);
      throw error;
    }
  },

  /**
   * Get a specific itinerary by ID
   */
  async getItinerary(itineraryId: string) {
    try {
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
   */
  async createItinerary(userId: string, name: string, destination: string, startDate?: string, endDate?: string, days: ItineraryDay[] = []) {
    try {
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
      
      return data;
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
    try {
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
    try {
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
          time: activity.start_time ? 
            `${new Date(activity.start_time).toLocaleTimeString()} - ${new Date(activity.end_time || activity.start_time).toLocaleTimeString()}` : 
            '',
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
      
      // If we have a start_date, calculate dates for each day
      if (itinerary.start_date) {
        const startDate = new Date(itinerary.start_date);
        days.forEach(day => {
          const dayDate = new Date(startDate);
          dayDate.setDate(startDate.getDate() + (day.dayNumber - 1));
          day.date = dayDate.toISOString().split('T')[0];
        });
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