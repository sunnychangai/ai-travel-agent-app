import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Activity, ItineraryDay, SuggestionItem } from '../types';

// Simple utility function to generate a unique ID
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

interface ItineraryContextType {
  itineraryDays: ItineraryDay[];
  suggestions: SuggestionItem[];
  isLoading: boolean;
  currentItineraryId: string | null;
  addActivity: (dayNumber: number, activity: Omit<Activity, 'id'>) => void;
  updateActivity: (dayNumber: number, activityId: string, updatedActivity: Partial<Activity>) => void;
  deleteActivity: (dayNumber: number, activityId: string) => void;
  addDay: (date: string) => void;
  deleteDay: (dayNumber: number) => void;
  acceptSuggestion: (suggestion: SuggestionItem, dayNumber: number) => void;
  rejectSuggestion: (suggestionId: string) => void;
  setLoading: (loading: boolean) => void;
  saveItinerary: (name: string) => Promise<string | null>;
  loadItinerary: (itineraryId: string) => Promise<void>;
  getUserItineraries: () => Promise<any[]>;
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
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>(initialItinerary);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>(initialSuggestions);
  const [isLoading, setIsLoading] = useState(false);
  const [currentItineraryId, setCurrentItineraryId] = useState<string | null>(null);

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
  const addDay = useCallback((date: string) => {
    setItineraryDays(prevDays => {
      // Find the highest day number
      const maxDayNumber = prevDays.reduce(
        (max, day) => Math.max(max, day.dayNumber),
        0
      );
      
      // Check if this date already exists
      const dateExists = prevDays.some(day => day.date === date);
      
      if (dateExists) {
        console.log(`Day with date ${date} already exists`);
        return prevDays;
      }
      
      // Create a new day with the next day number
      const newDay: ItineraryDay = {
        date,
        dayNumber: maxDayNumber + 1,
        activities: [],
      };
      
      // Add the new day and sort by day number
      return [...prevDays, newDay].sort((a, b) => a.dayNumber - b.dayNumber);
    });
  }, []);

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
      
      const itineraryId = generateId();
      setCurrentItineraryId(itineraryId);
      
      // Store in localStorage for persistence
      localStorage.setItem('savedItinerary', JSON.stringify({
        id: itineraryId,
        name,
        days: itineraryDays,
      }));
      
      console.log(`Saved itinerary "${name}" with ID ${itineraryId}`);
      return itineraryId;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [itineraryDays]);

  // Load an itinerary (mock implementation)
  const loadItinerary = useCallback(async (itineraryId: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Simulate an API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get from localStorage
      const savedData = localStorage.getItem('savedItinerary');
      
      if (savedData) {
        const { days } = JSON.parse(savedData);
        setItineraryDays(days);
        setCurrentItineraryId(itineraryId);
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
      
      // Get from localStorage
      const savedData = localStorage.getItem('savedItinerary');
      
      if (savedData) {
        const data = JSON.parse(savedData);
        return [data];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting user itineraries:', error);
      return [];
    } finally {
      setIsLoading(false);
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