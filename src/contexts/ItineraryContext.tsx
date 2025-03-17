import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Activity, ItineraryDay, SuggestionItem } from '../types';

// Storage keys
const STORAGE_KEYS = {
  ITINERARY_DAYS: 'itinerary_days_session',
  CURRENT_ITINERARY_ID: 'current_itinerary_id_session'
};

// Simple utility function to generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Utility function to safely get items from sessionStorage
const getSessionItem = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error retrieving ${key} from sessionStorage:`, error);
    return defaultValue;
  }
};

// Utility function to safely set items in sessionStorage
const setSessionItem = (key: string, value: any): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to sessionStorage:`, error);
  }
};

interface ItineraryContextType {
  itineraryDays: ItineraryDay[];
  suggestions: SuggestionItem[];
  isLoading: boolean;
  currentItineraryId: string | null;
  addActivity: (dayNumber: number, activity: Omit<Activity, 'id'>) => void;
  updateActivity: (dayNumber: number, activityId: string, updatedActivity: Partial<Activity>) => void;
  deleteActivity: (dayNumber: number, activityId: string) => void;
  addDay: (day: ItineraryDay) => void;
  deleteDay: (dayNumber: number) => void;
  acceptSuggestion: (suggestion: SuggestionItem, dayNumber: number) => void;
  rejectSuggestion: (suggestionId: string) => void;
  setLoading: (loading: boolean) => void;
  saveItinerary: (name: string) => Promise<string | null>;
  loadItinerary: (itineraryId: string) => Promise<void>;
  getUserItineraries: () => Promise<any[]>;
  clearSessionStorage: () => void;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

interface ItineraryProviderProps {
  children: ReactNode;
  initialItinerary?: ItineraryDay[];
  initialSuggestions?: SuggestionItem[];
}

export const ItineraryProvider: React.FC<ItineraryProviderProps> = ({
  children,
  initialItinerary = [],
  initialSuggestions = [],
}) => {
  // Initialize state from sessionStorage if available, otherwise use props
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>(
    () => getSessionItem<ItineraryDay[]>(STORAGE_KEYS.ITINERARY_DAYS, initialItinerary)
  );
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>(initialSuggestions);
  const [isLoading, setIsLoading] = useState(false);
  const [currentItineraryId, setCurrentItineraryId] = useState<string | null>(
    () => getSessionItem<string | null>(STORAGE_KEYS.CURRENT_ITINERARY_ID, null)
  );

  // Update sessionStorage whenever itineraryDays changes
  useEffect(() => {
    setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, itineraryDays);
  }, [itineraryDays]);

  // Update sessionStorage whenever currentItineraryId changes
  useEffect(() => {
    setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, currentItineraryId);
  }, [currentItineraryId]);

  // Add an activity to a specific day
  const addActivity = useCallback((dayNumber: number, activity: Omit<Activity, 'id'>) => {
    setItineraryDays(prevDays => {
      // Check if the day exists
      const dayIndex = prevDays.findIndex(day => day.dayNumber === dayNumber);
      
      if (dayIndex === -1) {
        console.error(`Day ${dayNumber} not found`);
        return prevDays;
      }
      
      // Create a copy of the days array
      const newDays = [...prevDays];
      
      // Create the new activity with a unique ID
      const newActivity: Activity = {
        ...activity,
        id: generateId(),
      };
      
      // Add the activity to the day
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        activities: [...newDays[dayIndex].activities, newActivity],
      };
      
      return newDays;
    });
  }, []);

  // Update an existing activity
  const updateActivity = useCallback((dayNumber: number, activityId: string, updatedActivity: Partial<Activity>) => {
    setItineraryDays(prevDays => {
      const dayIndex = prevDays.findIndex(day => day.dayNumber === dayNumber);
      
      if (dayIndex === -1) {
        console.error(`Day ${dayNumber} not found`);
        return prevDays;
      }
      
      const activityIndex = prevDays[dayIndex].activities.findIndex(
        activity => activity.id === activityId
      );
      
      if (activityIndex === -1) {
        console.error(`Activity ${activityId} not found in day ${dayNumber}`);
        return prevDays;
      }
      
      const newDays = [...prevDays];
      
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        activities: [
          ...newDays[dayIndex].activities.slice(0, activityIndex),
          {
            ...newDays[dayIndex].activities[activityIndex],
            ...updatedActivity,
          },
          ...newDays[dayIndex].activities.slice(activityIndex + 1),
        ],
      };
      
      return newDays;
    });
  }, []);

  // Delete an activity
  const deleteActivity = useCallback((dayNumber: number, activityId: string) => {
    setItineraryDays(prevDays => {
      const dayIndex = prevDays.findIndex(day => day.dayNumber === dayNumber);
      
      if (dayIndex === -1) {
        console.error(`Day ${dayNumber} not found`);
        return prevDays;
      }
      
      const newDays = [...prevDays];
      
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        activities: newDays[dayIndex].activities.filter(
          activity => activity.id !== activityId
        ),
      };
      
      return newDays;
    });
  }, []);

  // Add a new day to the itinerary
  const addDay = (day: ItineraryDay) => {
    setItineraryDays(prevDays => {
      // Check if a day with this number already exists
      const existingDay = prevDays.find(d => d.dayNumber === day.dayNumber);
      if (existingDay) {
        // Replace the existing day
        return prevDays.map(d => d.dayNumber === day.dayNumber ? day : d);
      } else {
        // Add the new day
        return [...prevDays, day];
      }
    });
  };

  // Remove a day from the itinerary
  const deleteDay = useCallback((dayNumber: number) => {
    setItineraryDays(prevDays => 
      prevDays.filter(day => day.dayNumber !== dayNumber)
    );
  }, []);

  // Add a suggestion to a day
  const acceptSuggestion = useCallback((suggestion: SuggestionItem, dayNumber: number) => {
    // Convert suggestion to activity
    const newActivity: Omit<Activity, 'id'> = {
      title: suggestion.title,
      description: suggestion.description,
      location: suggestion.location,
      time: "12:00 PM", // Default time
      type: "Activity",
      imageUrl: suggestion.imageUrl,
    };
    
    // Add the new activity to the specified day
    addActivity(dayNumber, newActivity);
    
    // Remove the suggestion from the list
    setSuggestions(prevSuggestions => 
      prevSuggestions.filter(s => s.id !== suggestion.id)
    );
  }, [addActivity]);

  // Remove a suggestion
  const rejectSuggestion = useCallback((suggestionId: string) => {
    setSuggestions(prevSuggestions => 
      prevSuggestions.filter(suggestion => suggestion.id !== suggestionId)
    );
  }, []);

  // Save the current itinerary (mock implementation)
  const saveItinerary = useCallback(async (name: string): Promise<string | null> => {
    try {
      setIsLoading(true);
      
      // Simulate an API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate a new ID if one doesn't exist yet
      const itineraryId = currentItineraryId || generateId();
      setCurrentItineraryId(itineraryId);
      
      // Store in localStorage for persistence across browser sessions
      localStorage.setItem('savedItinerary', JSON.stringify({
        id: itineraryId,
        name,
        days: itineraryDays,
      }));
      
      // Also store in sessionStorage for current session
      setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, itineraryDays);
      setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, itineraryId);
      
      console.log(`Saved itinerary "${name}" with ID ${itineraryId}`);
      return itineraryId;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [itineraryDays, currentItineraryId]);

  // Load an itinerary (mock implementation)
  const loadItinerary = useCallback(async (itineraryId: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Simulate an API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // First check sessionStorage
      const sessionItineraryId = getSessionItem<string | null>(STORAGE_KEYS.CURRENT_ITINERARY_ID, null);
      const sessionDays = getSessionItem<ItineraryDay[]>(STORAGE_KEYS.ITINERARY_DAYS, []);
      
      // If the session has the requested itinerary, use it
      if (sessionItineraryId === itineraryId && sessionDays.length > 0) {
        setItineraryDays(sessionDays);
        setCurrentItineraryId(itineraryId);
        console.log('Loaded itinerary from session storage');
        return;
      }
      
      // Otherwise, try to load from localStorage
      const savedData = localStorage.getItem('savedItinerary');
      
      if (savedData) {
        const { id, days } = JSON.parse(savedData);
        if (id === itineraryId) {
          setItineraryDays(days);
          setCurrentItineraryId(itineraryId);
          
          // Update sessionStorage with the loaded data
          setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, days);
          setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, itineraryId);
          
          console.log('Loaded itinerary from local storage');
        }
      }
    } catch (error) {
      console.error('Error loading itinerary:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get user's itineraries (mock implementation)
  const getUserItineraries = useCallback(async (): Promise<any[]> => {
    try {
      setIsLoading(true);
      
      // Simulate an API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const itineraries = [];
      
      // Check sessionStorage first
      const sessionItineraryId = getSessionItem<string | null>(STORAGE_KEYS.CURRENT_ITINERARY_ID, null);
      const sessionDays = getSessionItem<ItineraryDay[]>(STORAGE_KEYS.ITINERARY_DAYS, []);
      
      if (sessionItineraryId && sessionDays.length > 0) {
        itineraries.push({
          id: sessionItineraryId,
          name: "Session Itinerary",
          days: sessionDays,
          source: 'session'
        });
      }
      
      // Then check localStorage
      const savedData = localStorage.getItem('savedItinerary');
      
      if (savedData) {
        const data = JSON.parse(savedData);
        
        // Only add if not already in the list
        if (!itineraries.some(item => item.id === data.id)) {
          itineraries.push({
            ...data,
            source: 'local'
          });
        }
      }
      
      return itineraries;
    } catch (error) {
      console.error('Error getting user itineraries:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear session storage
  const clearSessionStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ITINERARY_DAYS);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_ITINERARY_ID);
      console.log('Session storage cleared');
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }
  }, []);

  return (
    <ItineraryContext.Provider
      value={{
        itineraryDays,
        suggestions,
        isLoading,
        currentItineraryId,
        addActivity,
        updateActivity,
        deleteActivity,
        addDay,
        deleteDay,
        acceptSuggestion,
        rejectSuggestion,
        setLoading: setIsLoading,
        saveItinerary,
        loadItinerary,
        getUserItineraries,
        clearSessionStorage,
      }}
    >
      {children}
    </ItineraryContext.Provider>
  );
};

export const useItinerary = (): ItineraryContextType => {
  const context = useContext(ItineraryContext);
  
  if (context === undefined) {
    throw new Error('useItinerary must be used within an ItineraryProvider');
  }
  
  return context;
}; 