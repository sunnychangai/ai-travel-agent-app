import { useState, useCallback, useEffect, useRef } from 'react';
import { Activity } from '../types';
import { useItinerary } from '../contexts/ItineraryContext';
import { format, isValid, parseISO } from 'date-fns';
import { formatTimeRange, parseTimeString } from '../utils/timeUtils';
import { ensureActivityId, getActivityIdSafely, determineActivityType } from '../utils/activityUtils';
import { safeParseDate } from '../utils/dateUtils';

/**
 * Custom hook for managing activity operations in the itinerary
 * Centralizes add, edit, delete, and update functionality
 */
export const useActivityOperations = () => {
  const { 
    itineraryDays, 
    addActivity, 
    updateActivity, 
    deleteActivity, 
    addDay 
  } = useItinerary();
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  
  // Track if we need to create a new activity or edit an existing one
  const isNewActivityRef = useRef(false);
  
  // Reset modal state on hook initialization
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear the modal state when the page is about to unload
      sessionStorage.removeItem('currentActivity');
      sessionStorage.removeItem('editModalOpen');
    };

    // Check if there's any persisted state and clear it
    sessionStorage.removeItem('currentActivity');
    sessionStorage.removeItem('editModalOpen');
    
    // Reset the state
    setEditModalOpen(false);
    setCurrentActivity(null);
    
    // Add cleanup for page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  
  /**
   * Handle adding a new activity
   */
  const handleAddActivity = useCallback((dayNumber: number) => {
    console.log('[useActivityOperations] handleAddActivity called with dayNumber:', dayNumber);
    
    // Handle case when no days exist in itinerary
    if (itineraryDays.length === 0) {
      // Get today's date - for demo purposes, use March 17, 2025
      // IMPORTANT: In production, replace this with: const today = new Date();
      const today = new Date(2025, 2, 17); // Month is 0-indexed, so 2 = March
      
      // Format using date-fns for consistency and correctness
      const formattedDate = format(today, 'yyyy-MM-dd');
      
      // Use safeParseDate to validate the date with consistent error handling
      const validDate = safeParseDate(formattedDate);
      if (!validDate) {
        console.error("Generated invalid date:", formattedDate);
        return;
      }
      
      const newDay = {
        dayNumber: 1,
        date: formattedDate,
        activities: []
      };
      
      // Add the new day to the itinerary context
      try {
        // If addDay exists in the context, use it
        if (typeof addDay === 'function') {
          addDay(newDay);
        } else {
          console.error("addDay function not available");
          return;
        }
        
        // Use the new day
        dayNumber = 1;
      } catch (error) {
        console.error("Error creating new day:", error);
        return;
      }
    } else if (isNaN(dayNumber) || dayNumber <= 0) {
      // Handle "all" view case - default to first day if available
      dayNumber = itineraryDays[0].dayNumber;
    }
    
    // If we get here, either we have days or we just created one
    const day = itineraryDays.find((d) => d.dayNumber === dayNumber);
    
    // If day doesn't exist yet (because we just created it), use dummy data
    // Use fallback date for safety
    const defaultDate = new Date(2025, 2, 17); // Default to March 17, 2025
    let date: Date;
    
    if (day) {
      // Use safeParseDate with consistent error handling
      date = safeParseDate(day.date, undefined, defaultDate);
    } else {
      date = defaultDate;
    }
    
    // Default time in 12-hour format
    const defaultDisplayTime = "12:00 PM";
    
    // Use parseTimeString for consistent time handling
    const { parsedStartTime } = parseTimeString(defaultDisplayTime);
    
    // Mark that we're creating a new activity
    isNewActivityRef.current = true;
    console.log('[useActivityOperations] Setting isNewActivityRef.current =', isNewActivityRef.current);
    
    // Create an empty activity template for the modal
    setCurrentActivity({
      id: "", // Empty ID indicates this is a new activity
      title: "",
      description: "",
      location: "",
      time: defaultDisplayTime,
      type: "Activity", // Default type
      imageUrl: "",
      // Store the day date for reference
      dayDate: date,
      // Store the time in both display format and edit format
      displayStartTime: defaultDisplayTime,
      displayEndTime: "",
      parsedStartTime: parsedStartTime,
      parsedEndTime: "",
      // Store the day number for later use
      dayNumber: dayNumber
    });
    
    // Open the edit modal
    console.log('[useActivityOperations] Opening edit modal - setting editModalOpen = true');
    setEditModalOpen(true);
    
    return dayNumber;
  }, [itineraryDays, addDay]);

  /**
   * Handle editing an activity
   */
  const handleEditActivity = useCallback((dayNumber: number, activityId: string) => {
    const day = itineraryDays.find((d) => d.dayNumber === dayNumber);
    if (day) {
      const activity = day.activities.find((a) => a.id === activityId);
      if (activity) {
        // Mark that we're editing an existing activity
        isNewActivityRef.current = false;
        
        // Parse the date from the day with consistent error handling
        const date = safeParseDate(day.date, undefined, new Date());
        
        // Parse the time string to extract start and end times
        const { displayStartTime, displayEndTime, parsedStartTime, parsedEndTime } = parseTimeString(activity.time || '');
        
        setCurrentActivity({
          ...activity,
          // Ensure the activity has a type, defaulting to "Activity" if not specified
          type: activity.type || "Activity",
          // Store the day date for reference
          dayDate: date,
          // Store the time in both display format and edit format
          displayStartTime,
          displayEndTime,
          parsedStartTime,
          parsedEndTime
        });
        setEditModalOpen(true);
      }
    }
  }, [itineraryDays]);

  /**
   * Handle saving an activity (both new and edited)
   */
  const handleSaveActivity = useCallback((updatedActivity: Activity & { startTime?: string; endTime?: string; dayNumber?: number }, selectedDay: string) => {
    console.log('[useActivityOperations] handleSaveActivity called', { 
      updatedActivity, 
      selectedDay, 
      isNewActivity: isNewActivityRef.current,
      currentActivityId: currentActivity?.id
    });
    
    // Check if the activity has a date property and convert it to string format
    let activityDate = '';
    if (updatedActivity.dayDate instanceof Date) {
      activityDate = format(updatedActivity.dayDate, 'yyyy-MM-dd');
    }

    // Determine day number - use either the one from the activity, current parameter, or selectedDay
    let dayNumber = updatedActivity.dayNumber || currentActivity?.dayNumber || parseInt(selectedDay);

    // Format the time range
    let formattedTime = '';
    if ('startTime' in updatedActivity && typeof updatedActivity.startTime === 'string') {
      // Convert from input field format (24-hour) back to display format (12-hour AM/PM)
      const formatTime = (timeStr: string): string => {
        if (!timeStr) return '';
        // Match 24-hour time format (13:30)
        const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
          const [_, hoursStr, minutes] = match;
          const hours = parseInt(hoursStr, 10);
          // Convert to 12-hour format with AM/PM
          let period = hours >= 12 ? 'PM' : 'AM';
          let hours12 = hours % 12;
          if (hours12 === 0) hours12 = 12; // Convert 0 to 12 for 12 AM
          return `${hours12}:${minutes} ${period}`;
        }
        return timeStr; // Return as-is if not matching expected format
      };
      
      const formattedStartTime = formatTime(updatedActivity.startTime);
      const formattedEndTime = updatedActivity.endTime ? formatTime(updatedActivity.endTime) : '';
      
      // Create time string in format "1:00 PM" or "1:00 PM - 3:00 PM"
      formattedTime = formattedEndTime 
        ? `${formattedStartTime} - ${formattedEndTime}` 
        : formattedStartTime;
      
      console.log("Saving activity with formatted time:", formattedTime);
    } else if ('time' in updatedActivity) {
      formattedTime = updatedActivity.time || '';
    }
    
    // Use determineActivityType to set a more accurate type if the user didn't specify one
    let activityType = updatedActivity.type;
    if (!activityType || activityType === "Activity") {
      activityType = determineActivityType(updatedActivity.title, updatedActivity.description);
    }

    // Check if this is a new activity or existing one based on our ref
    if (!isNewActivityRef.current && currentActivity?.id) {
      console.log('[useActivityOperations] Updating existing activity');
      // Update existing activity
      updateActivity(dayNumber, currentActivity.id, {
        ...updatedActivity,
        time: formattedTime,
        type: activityType
      });
    } else {
      console.log('[useActivityOperations] Adding new activity - dayNumber:', dayNumber);
      // Add new activity
      // Check if we need to create a new day or update an existing day's date
      if (activityDate && itineraryDays.length > 0) {
        // Check if the activity date matches any existing day
        const existingDay = itineraryDays.find(day => day.date === activityDate);
        
        if (existingDay) {
          // If day exists, use its day number
          dayNumber = existingDay.dayNumber;
        } else {
          // If this is the first activity and the user changed the date
          if (itineraryDays.length === 1 && itineraryDays[0].activities.length === 0) {
            // Update the existing day's date instead of creating a new one
            const updatedDay = {
              ...itineraryDays[0],
              date: activityDate
            };
            
            // Update the day in the context
            if (typeof addDay === 'function') {
              addDay(updatedDay);
            }
            
            // Keep using day 1
            dayNumber = 1;
          } else {
            // Create a new day
            const newDayNumber = Math.max(...itineraryDays.map(d => d.dayNumber)) + 1;
            const newDay = {
              dayNumber: newDayNumber,
              date: activityDate,
              activities: []
            };
            
            // Add the new day
            if (typeof addDay === 'function') {
              addDay(newDay);
            }
            
            // Use the new day number
            dayNumber = newDayNumber;
          }
        }
      }
      
      // Generate a unique ID using our utility function
      const newActivityId = getActivityIdSafely(undefined);
      
      // Create the new activity object
      const newActivity = {
        ...updatedActivity,
        id: newActivityId,
        time: formattedTime,
        type: activityType
      };
      
      // Add the activity to the itinerary ONLY NOW after user has filled the form
      console.log('[useActivityOperations] Calling addActivity with dayNumber:', dayNumber);
      addActivity(dayNumber, newActivity);
    }
    
    // Reset the new activity flag
    isNewActivityRef.current = false;
    console.log('[useActivityOperations] Reset isNewActivityRef.current =', isNewActivityRef.current);
    
    // Close the modal after saving
    console.log('[useActivityOperations] Closing modal - setting editModalOpen = false');
    setEditModalOpen(false);
    setCurrentActivity(null);
    
    return true;
  }, [currentActivity, itineraryDays, addActivity, updateActivity, addDay]);

  /**
   * Handle deleting an activity
   */
  const handleDeleteActivity = useCallback((dayNumber: number, activityId: string) => {
    console.log('useActivityOperations: handleDeleteActivity called', { dayNumber, activityId });
    deleteActivity(dayNumber, activityId);
  }, [deleteActivity]);

  return {
    // State
    editModalOpen,
    setEditModalOpen,
    currentActivity,
    setCurrentActivity,
    
    // Operations
    handleAddActivity,
    handleEditActivity,
    handleSaveActivity,
    handleDeleteActivity,
    ensureActivityId
  };
};

export default useActivityOperations; 