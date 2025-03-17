import { useCallback } from 'react';
import { useItinerary } from '../contexts/ItineraryContext';
import { Activity, ItineraryDay } from '../types';
import React from 'react';
import { useEnhancedOpenAI } from './useEnhancedOpenAI';
import { UserPreferences } from '../components/TravelPlanner/EnhancedItineraryCreator';

/**
 * Custom hook to handle itinerary updates from the agent
 * This hook provides methods for the OpenAI agent to update the itinerary
 */
export function useAgentItinerary() {
  const {
    itineraryDays,
    addActivity,
    updateActivity,
    deleteActivity,
    addDay,
    deleteDay,
    saveItinerary,
  } = useItinerary();

  // Track if we're currently creating an itinerary to prevent duplicate operations
  const isCreatingItinerary = React.useRef(false);

  // Add the enhanced OpenAI service
  const enhancedOpenAI = useEnhancedOpenAI();

  /**
   * Get a default image based on activity type
   */
  const getDefaultImage = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'transportation':
        return 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=600&q=80';
      case 'accommodation':
        return 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80';
      case 'food':
        return 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80';
      case 'activity':
        return 'https://images.unsplash.com/photo-1526976668912-1a811878dd37?w=600&q=80';
      default:
        return 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80';
    }
  };

  /**
   * Create a mock itinerary for first-time users
   * @param destination The destination for the trip
   * @param startDate Start date in ISO format
   * @param endDate End date in ISO format
   * @param activities Array of activities to add to the itinerary
   */
  const createMockItinerary = useCallback(
    async (destination: string, startDate: string, endDate: string, activities: Activity[]) => {
      try {
        console.log('Starting itinerary creation for', destination, 'with', activities.length, 'activities');
        
        // Clear existing days
        const existingDays = [...itineraryDays];
        existingDays.forEach((day) => {
          deleteDay(day.dayNumber);
        });

        if (!startDate || !endDate) {
          console.error('Start and end dates are required');
          return { success: false, message: 'Start and end dates are required' };
        }

        // Validate date formats
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          console.error('Invalid date format. Expected YYYY-MM-DD but got:', { startDate, endDate });
          return { success: false, message: 'Invalid date format. Dates should be in YYYY-MM-DD format.' };
        }

        // Calculate the number of days
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          console.error('Invalid date values:', { startDate, endDate, startTime: start.getTime(), endTime: end.getTime() });
          return { success: false, message: 'Invalid date values. Please check your dates.' };
        }
        
        const dayCount = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        
        console.log('Calculated day count:', dayCount, 'for date range:', startDate, 'to', endDate);
        
        if (dayCount <= 0) {
          console.error('Invalid date range - end date is before start date');
          return { success: false, message: 'End date must be after start date' };
        }

        // Get all dates between start and end
        const dates: string[] = [];
        for (let i = 0; i < dayCount; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          dates.push(date.toISOString().split('T')[0]);
        }

        // Validate activities array
        if (!Array.isArray(activities)) {
          console.error('Activities is not an array:', activities);
          return { success: false, message: 'Activities must be an array' };
        }
        
        if (activities.length === 0) {
          console.warn('No activities provided, creating default activities');
        }

        // Add days to itinerary
        console.log('Adding days to itinerary:', dates);
        dates.forEach((date) => {
          addDay(date);
        });

        // Group activities by day
        interface DayActivities {
          [key: number]: Activity[];
        }
        
        try {
          const activitiesByDay: DayActivities = {};

          // Process and distribute activities
          activities.forEach((activity, index) => {
            try {
              if (!activity || typeof activity !== 'object') {
                console.error(`Invalid activity at index ${index}:`, activity);
                return;
              }
              
              // If activity has an invalid day number, assign it to a valid day
              let dayNumber = activity.dayNumber;
              
              // Ensure day number is within range
              if (typeof dayNumber !== 'number' || isNaN(dayNumber) || dayNumber < 1 || dayNumber > dayCount) {
                // Use a deterministic algorithm to distribute activities evenly
                dayNumber = (index % dayCount) + 1;
                console.log(`Reassigning activity "${activity.title}" from day ${activity.dayNumber || 'undefined'} to day ${dayNumber}`);
              }
              
              if (!activitiesByDay[dayNumber]) {
                activitiesByDay[dayNumber] = [];
              }
              
              // Create a copy with the potentially corrected day number
              const activityWithCorrectDay = {
                ...activity,
                dayNumber
              };
              
              activitiesByDay[dayNumber].push(activityWithCorrectDay);
            } catch (activityError) {
              console.error(`Error processing activity at index ${index}:`, activityError, activity);
            }
          });

          // Fix the Object.keys calls to use proper typing
          (Object.keys(activitiesByDay) as unknown as string[]).forEach(day => {
            const dayNum = parseInt(day);
            console.log(`Day ${day} has ${activitiesByDay[dayNum].length} activities`);
          });

          // Ensure all days have at least some activities
          for (let i = 1; i <= dayCount; i++) {
            if (!activitiesByDay[i] || activitiesByDay[i].length === 0) {
              console.log(`Day ${i} has no activities, attempting to redistribute`);
              
              // Find a day with the most activities
              let maxActivitiesDay = 0;
              let maxActivities = 0;
              
              (Object.keys(activitiesByDay) as unknown as string[]).forEach(day => {
                const dayNum = parseInt(day);
                if (activitiesByDay[dayNum] && activitiesByDay[dayNum].length > maxActivities) {
                  maxActivities = activitiesByDay[dayNum].length;
                  maxActivitiesDay = dayNum;
                }
              });
              
              // If we found a day with activities, move some to the empty day
              if (maxActivitiesDay > 0 && maxActivities > 1) {
                const activitiesToMove = Math.ceil(maxActivities / 3); // Move about 1/3 of activities
                const movedActivities = activitiesByDay[maxActivitiesDay].splice(0, activitiesToMove);
                
                // Update the day number for moved activities
                movedActivities.forEach(activity => {
                  activity.dayNumber = i;
                });
                
                activitiesByDay[i] = movedActivities;
                console.log(`Moved ${movedActivities.length} activities from day ${maxActivitiesDay} to day ${i}`);
              } else {
                // Create a default activity if we couldn't move any
                activitiesByDay[i] = [{
                  title: `Explore ${destination} - Day ${i}`,
                  description: `Spend the day exploring the highlights of ${destination} at your own pace.`,
                  location: `${destination} City Center`,
                  time: "10:00 AM",
                  type: "Activity",
                  dayNumber: i,
                  id: `default-activity-day-${i}`
                }];
                console.log(`Created default activity for day ${i}`);
              }
            }
          }

          // Sort activities by time within each day
          Object.keys(activitiesByDay).forEach(dayNumber => {
            try {
              activitiesByDay[Number(dayNumber)].sort((a, b) => {
                // Extract hours and minutes from time strings
                const getTimeValue = (timeStr: string) => {
                  try {
                    if (!timeStr) return 0;  // Default to earliest time if missing
                    
                    const timePart = timeStr.split(' - ')[0]; // Get start time if range
                    const timeMatch = timePart.match(/(\d+):(\d+)\s*(am|pm)?/i);
                    
                    if (!timeMatch) return 0;
                    
                    let hour = parseInt(timeMatch[1]);
                    const minute = parseInt(timeMatch[2]);
                    const period = timeMatch[3]?.toLowerCase();
                    
                    // Convert to 24-hour format if needed
                    if (period === 'pm' && hour < 12) {
                      hour += 12;
                    }
                    if (period === 'am' && hour === 12) {
                      hour = 0;
                    }
                    
                    return hour * 60 + minute;
                  } catch (timeError) {
                    console.error('Error parsing time:', timeStr, timeError);
                    return 0;
                  }
                };
                
                return getTimeValue(a.time) - getTimeValue(b.time);
              });
            } catch (sortError) {
              console.error(`Error sorting activities for day ${dayNumber}:`, sortError);
            }
          });

          // Add activities in order
          console.log('Adding activities by day:', Object.keys(activitiesByDay).length);
          
          // Create a mapping from day numbers to dates for easier lookup
          const dayNumberToDate = {};
          dates.forEach((date, index) => {
            dayNumberToDate[index + 1] = date;
          });
          
          // Add activities for each date/day
          dates.forEach((date, dateIndex) => {
            try {
              // Day numbers are 1-indexed
              const dayNumber = dateIndex + 1;
              const dayActivities = activitiesByDay[dayNumber] || [];
              
              console.log(`Adding ${dayActivities.length} activities to day ${dayNumber} (${date})`);
              
              dayActivities.forEach((activity, index) => {
                try {
                  console.log(`Adding activity ${index+1}:`, activity.title, 'to day', dayNumber);
                  
                  // Ensure activity has all required fields
                  const enhancedActivity = {
                    title: activity.title || `Activity ${index+1}`,
                    description: activity.description || '',
                    location: activity.location || '',
                    time: activity.time || '',
                    type: activity.type || 'Activity',
                    imageUrl: activity.imageUrl || getDefaultImage(activity.type)
                  };
                  
                  addActivity(dayNumber, enhancedActivity);
                } catch (activityError) {
                  console.error(`Error adding activity ${index} to day ${dayNumber}:`, activityError, activity);
                }
              });
            } catch (dateError) {
              console.error(`Error processing activities for date ${date}:`, dateError);
            }
          });

          // Save the itinerary
          console.log('Saving itinerary for destination:', destination);
          
          // Ensure we never save a null or empty destination name to prevent database constraints violation
          const safeDestinationName = destination || "Your Trip";
          saveItinerary(safeDestinationName);

          return { success: true, message: `Created a new itinerary for ${safeDestinationName}` };
        } catch (processingError) {
          console.error('Error processing activities:', processingError);
          return { success: false, message: `Error processing activities: ${processingError.message}` };
        }
      } catch (error) {
        console.error('Error in createMockItinerary:', error);
        return { success: false, message: `Error creating itinerary: ${error.message}` };
      }
    },
    [itineraryDays, addDay, addActivity, deleteDay, saveItinerary]
  );

  /**
   * Add a new activity to the itinerary
   */
  const addItineraryActivity = useCallback(
    (
      dayNumber: number,
      activity: {
        title: string;
        description: string;
        location: string;
        time: string;
        type: string;
        imageUrl?: string;
      }
    ) => {
      addActivity(dayNumber, {
        ...activity,
        imageUrl: activity.imageUrl || getDefaultImage(activity.type)
      });

      return {
        success: true,
        message: `Added ${activity.title} to day ${dayNumber}`
      };
    },
    [addActivity]
  );

  /**
   * Get the current itinerary
   */
  const getCurrentItinerary = useCallback(() => {
    return itineraryDays;
  }, [itineraryDays]);

  /**
   * Create an itinerary automatically using enhanced OpenAI features
   */
  const createEnhancedItinerary = useCallback(
    async (
      destination: string,
      startDate: string,
      endDate: string,
      interests: string[] | Array<{id: string; label: string}>,
      preferences: {
        travelStyle: string;
        travelGroup: string;
        budget: string;
        transportMode: string;
        dietaryPreferences: string[] | Array<{id: string; label: string}>;
        pace: 'slow' | 'moderate' | 'fast';
      },
      onProgress?: (progress: number, step: string) => void
    ) => {
      console.log('Creating enhanced itinerary for:', destination);
      
      // Prevent multiple simultaneous calls
      if (isCreatingItinerary.current) {
        console.log('Already creating an itinerary, skipping duplicate call');
        return { success: false, message: 'Itinerary creation already in progress' };
      }
      
      isCreatingItinerary.current = true;

      try {
        // Process interests to ensure we have strings for the API
        const interestLabels = Array.isArray(interests) 
          ? interests.map(interest => typeof interest === 'string' ? interest : interest.label)
          : [];

        // Process dietary preferences to ensure we have strings for the API
        const dietaryLabels = Array.isArray(preferences.dietaryPreferences)
          ? preferences.dietaryPreferences.map(pref => 
              typeof pref === 'string' ? pref : pref.label
            )
          : [];

        // Clear existing days if any
        console.log('Clearing existing days:', itineraryDays.length);
        const existingDays = [...itineraryDays];
        existingDays.forEach((day) => {
          console.log(`Deleting day ${day.dayNumber}`);
          deleteDay(day.dayNumber);
        });
        
        // Generate enhanced itinerary with OpenAI
        const enhancedItinerary = await enhancedOpenAI.generateItinerary({
          destination,
          startDate,
          endDate,
          interests: interestLabels,
          preferences: {
            travelStyle: preferences.travelStyle,
            travelGroup: preferences.travelGroup,
            budget: preferences.budget,
            transportMode: preferences.transportMode,
            dietaryPreferences: dietaryLabels,
            pace: preferences.pace,
          },
          onProgress,
        });
        
        if (!enhancedItinerary) {
          // Request was likely canceled
          isCreatingItinerary.current = false;
          return { success: false, message: 'Itinerary generation was canceled' };
        }
        
        // Process the days from the OpenAI response
        for (const day of enhancedItinerary.days) {
          // Add the day
          addDay(day.date);
          
          // Add all activities for this day
          for (const activity of day.activities) {
            // Create an activity with the required structure
            const newActivity = {
              title: activity.title,
              description: activity.description || '',
              location: activity.location || '',
              time: activity.time || '12:00 PM',
              type: activity.category || 'Activity',
              imageUrl: activity.imageUrl || getDefaultImage(activity.category),
              notes: activity.notes || '',
              // Add any new fields from the enhanced service
              subcategory: activity.subcategory || '',
              duration: activity.duration || '',
              price: activity.price || '',
            };
            
            console.log(`Adding activity to day ${day.dayNumber}:`, newActivity.title);
            addActivity(day.dayNumber, newActivity);
          }
        }
        
        // Save the itinerary with destination as name
        saveItinerary(destination);
        
        // Success!
        console.log('Successfully created enhanced itinerary');
        isCreatingItinerary.current = false;
        return { success: true, message: 'Itinerary created successfully' };
      } catch (error) {
        console.error('Error creating enhanced itinerary:', error);
        isCreatingItinerary.current = false;
        return { success: false, message: `Error: ${error.message}` };
      }
    },
    [itineraryDays, addDay, deleteDay, addActivity, enhancedOpenAI, saveItinerary]
  );
  
  /**
   * Cancel any ongoing itinerary creation
   */
  const cancelItineraryCreation = useCallback(() => {
    if (isCreatingItinerary.current) {
      enhancedOpenAI.cancelRequests();
      isCreatingItinerary.current = false;
    }
  }, [enhancedOpenAI]);

  return {
    createMockItinerary,
    addItineraryActivity,
    getCurrentItinerary,
    itineraryDays,
    createEnhancedItinerary,
    cancelItineraryCreation,
    itineraryCreationStatus: enhancedOpenAI.status,
    itineraryCreationProgress: enhancedOpenAI.progress,
    itineraryCreationStep: enhancedOpenAI.step,
  };
} 