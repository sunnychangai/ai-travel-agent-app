import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { Activity, ItineraryDay, SuggestionItem } from '../types';
import { getActivityIdSafely } from '../utils/activityUtils';
import { useAuth } from './AuthContext';
import { databaseService } from '../services/databaseService';

// Storage keys
const STORAGE_KEYS = {
  ITINERARY_DAYS: 'itinerary_days_session',
  CURRENT_ITINERARY_ID: 'current_itinerary_id_session',
  CURRENT_ITINERARY_TITLE: 'current_itinerary_title_session',
  PREVIOUS_ITINERARY: 'previous_itinerary_session'
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
  currentItineraryTitle: string;
  setCurrentItineraryTitle: (title: string) => void;
  getCurrentItineraryTitle: () => string;
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
  deleteItinerary: (itineraryId: string) => Promise<void>;
  clearSessionStorage: () => void;
  clearItineraryDays: () => void;
  savePreviousItinerary: () => void;
  restorePreviousItinerary: () => boolean;
  hasPreviousItinerary: () => boolean;
  forceRefresh: () => void;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

export const useItinerary = () => {
  const context = useContext(ItineraryContext);
  if (context === undefined) {
    throw new Error('useItinerary must be used within an ItineraryProvider');
  }
  return context;
};

interface ItineraryProviderProps {
  children: ReactNode;
  initialItinerary?: ItineraryDay[];
  initialSuggestions?: SuggestionItem[];
}

export const ItineraryProvider = ({ children, initialItinerary = [], initialSuggestions = [] }: ItineraryProviderProps) => {
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>(
    () => getSessionItem<ItineraryDay[]>(STORAGE_KEYS.ITINERARY_DAYS, initialItinerary)
  );
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>(initialSuggestions);
  const [isLoading, setIsLoading] = useState(false);
  const [currentItineraryId, setCurrentItineraryId] = useState<string | null>(
    () => getSessionItem<string | null>(STORAGE_KEYS.CURRENT_ITINERARY_ID, null)
  );
  const [currentItineraryTitle, setCurrentItineraryTitle] = useState<string>(
    () => getSessionItem<string>(STORAGE_KEYS.CURRENT_ITINERARY_TITLE, 'My Itinerary')
  );
  const { user } = useAuth();
  
  // Add a ref to prevent infinite refresh loops
  const isRefreshing = useRef(false);
  
  // Add a ref to track if we've loaded from localStorage
  const hasLoadedFromStorage = useRef(false);

  // Calculate derived destination, startDate, and endDate from itinerary days
  const [destination, setDestination] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Update date range and destination whenever itinerary days change
  useEffect(() => {
    if (itineraryDays.length > 0) {
      // Sort by day number to get correct order
      const sortedDays = [...itineraryDays].sort((a, b) => a.dayNumber - b.dayNumber);
      
      // Update start and end dates
      if (sortedDays[0]?.date) {
        setStartDate(sortedDays[0].date);
      }
      
      if (sortedDays[sortedDays.length - 1]?.date) {
        setEndDate(sortedDays[sortedDays.length - 1].date);
      }
      
      // Try to extract destination from first day activities
      if (!destination) {
        for (const day of itineraryDays) {
          for (const activity of day.activities) {
            if (activity.location) {
              // Extract destination from location
              const locationParts = activity.location.split(',');
              if (locationParts.length > 1) {
                setDestination(locationParts[1].trim());
                break;
              } else if (locationParts.length === 1) {
                setDestination(locationParts[0].trim());
                break;
              }
            }
          }
          if (destination) break;
        }
      }
    }
  }, [itineraryDays, destination]);

  // Initialize from sessionStorage if available
  useEffect(() => {
    // Only run this effect once on mount
    const stored = getSessionItem<ItineraryDay[]>(STORAGE_KEYS.ITINERARY_DAYS, initialItinerary);
    if (stored.length > 0) {
      setItineraryDays(stored);
    }
    setSuggestions(initialSuggestions);
    setCurrentItineraryId(getSessionItem<string | null>(STORAGE_KEYS.CURRENT_ITINERARY_ID, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only on mount

  // Update sessionStorage whenever itineraryDays changes
  useEffect(() => {
    setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, itineraryDays);
  }, [itineraryDays]);

  // Update sessionStorage whenever currentItineraryId changes
  useEffect(() => {
    setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, currentItineraryId);
  }, [currentItineraryId]);

  // Update sessionStorage whenever currentItineraryTitle changes
  useEffect(() => {
    setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_TITLE, currentItineraryTitle);
  }, [currentItineraryTitle]);

  // Load the most recent itinerary from localStorage on initialization if needed
  useEffect(() => {
    // Skip if we've already loaded or if we have data
    if (hasLoadedFromStorage.current || itineraryDays.length > 0 || currentItineraryId) {
      return;
    }
    
    // Mark as loaded to prevent future runs
    hasLoadedFromStorage.current = true;
    
    try {
      const mostRecentData = localStorage.getItem('mostRecentItinerary');
      
      if (mostRecentData) {
        const itineraryData = JSON.parse(mostRecentData);
        
        console.log('Found most recent itinerary in localStorage, loading:', itineraryData.title);
        
        // Set the data in our state
        setItineraryDays(itineraryData.days || []);
        setCurrentItineraryId(itineraryData.id);
        setCurrentItineraryTitle(itineraryData.title || 'My Itinerary');
        
        // Also update session storage
        setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, itineraryData.days || []);
        setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, itineraryData.id);
        setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_TITLE, itineraryData.title || 'My Itinerary');
      }
    } catch (error) {
      console.error('Error loading most recent itinerary:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once on mount

  // Memoize sorted itinerary days to prevent recalculations
  const sortedItineraryDays = useMemo(() => {
    return [...itineraryDays].sort((a, b) => a.dayNumber - b.dayNumber);
  }, [itineraryDays]);

  // Get start and end dates once
  const { startDate: memoizedStartDate, endDate: memoizedEndDate, destination: memoizedDestination } = useMemo(() => {
    // Default values
    let startDate = new Date().toISOString().split('T')[0];
    let endDate = startDate;
    let destination = '';

    if (sortedItineraryDays.length > 0) {
      startDate = sortedItineraryDays[0]?.date || startDate;
      endDate = sortedItineraryDays[sortedItineraryDays.length - 1]?.date || startDate;

      // Extract destination from activities
      const allActivities = itineraryDays.flatMap(day => day.activities);
      
      if (allActivities.length > 0) {
        const locationActivity = allActivities.find(a => a.location);
        if (locationActivity?.location) {
          const parts = locationActivity.location.split(',');
          destination = parts.length > 1 ? parts[1].trim() : locationActivity.location;
        }
      }
    }

    return { startDate, endDate, destination };
  }, [sortedItineraryDays, itineraryDays]);

  // Utility function to sort activities by time
  const sortActivitiesByTime = useCallback((activities: Activity[]) => {
    if (!activities || activities.length <= 1) {
      return activities;
    }
    
    // Sort activities by their time
    return [...activities].sort((a, b) => {
      // Convert time to minutes for comparison
      const getMinutes = (timeStr: string): number => {
        if (!timeStr) return 0;
        
        // Extract start time if it's a range
        const startTime = timeStr.split(" - ")[0];
        
        // Handle time formats like "1:00 PM" or "13:00"
        let hours = 0;
        let minutes = 0;
        
        if (startTime.includes("AM") || startTime.includes("PM")) {
          // Parse 12-hour format
          const match = startTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (match) {
            const [_, h, m, period] = match;
            hours = parseInt(h, 10);
            minutes = parseInt(m, 10);
            
            // Adjust hours for PM
            if (period.toUpperCase() === "PM" && hours < 12) {
              hours += 12;
            } else if (period.toUpperCase() === "AM" && hours === 12) {
              hours = 0;
            }
          }
        } else {
          // Parse 24-hour format
          const parts = startTime.split(":");
          if (parts.length === 2) {
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
          }
        }
        
        return hours * 60 + minutes;
      };
      
      const timeA = getMinutes(a.time);
      const timeB = getMinutes(b.time);
      return timeA - timeB;
    });
  }, []);

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
      
      // Create the new activity with a unique ID using the centralized utility function
      const newActivity: Activity = {
        ...activity,
        id: getActivityIdSafely(undefined),
      };
      
      // Add the activity to the day and sort by time
      const updatedActivities = [...newDays[dayIndex].activities, newActivity];
      const sortedActivities = sortActivitiesByTime(updatedActivities);
      
      // Update the day with sorted activities
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        activities: sortedActivities,
      };
      
      return newDays;
    });
  }, [sortActivitiesByTime]);

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
      
      // First update the specific activity
      const updatedActivities = [
        ...newDays[dayIndex].activities.slice(0, activityIndex),
        {
          ...newDays[dayIndex].activities[activityIndex],
          ...updatedActivity,
        },
        ...newDays[dayIndex].activities.slice(activityIndex + 1),
      ];
      
      // Sort the activities by time after updating
      const sortedActivities = sortActivitiesByTime(updatedActivities);
      
      // Update the day with sorted activities
      newDays[dayIndex] = {
        ...newDays[dayIndex],
        activities: sortedActivities,
      };
      
      return newDays;
    });
  }, [sortActivitiesByTime]);

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
  const addDay = useCallback((day: ItineraryDay) => {
    // Skip add if the day object is invalid
    if (!day || !day.dayNumber) {
      console.warn('Attempted to add invalid day to itinerary');
      return;
    }
    
    setItineraryDays(prevDays => {
      // Check if a day with this number already exists
      const existingDay = prevDays.find(d => d.dayNumber === day.dayNumber);
      
      if (existingDay) {
        // Check if it's actually different to avoid unnecessary re-renders
        const existingJson = JSON.stringify(existingDay);
        const newJson = JSON.stringify(day);
        
        if (existingJson === newJson) {
          // No change needed, return previous state
          return prevDays;
        }
        
        // Replace the existing day
        return prevDays.map(d => d.dayNumber === day.dayNumber ? day : d);
      } else {
        // Add the new day and ensure days are sorted by dayNumber
        const newDays = [...prevDays, day];
        return newDays.sort((a, b) => a.dayNumber - b.dayNumber);
      }
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

  // Force a refresh of the itinerary state
  const forceRefresh = useCallback(() => {
    // Skip if already refreshing to prevent update loops
    if (isRefreshing.current) {
      console.log('[ItineraryContext] Skipping refresh - already in progress');
      return;
    }
    
    console.log('[ItineraryContext] Forcing itinerary context refresh');
    
    // Set refreshing flag
    isRefreshing.current = true;
    
    // Debounce multiple refresh calls
    const currentTimestamp = Date.now();
    const lastRefreshKey = 'lastItineraryRefresh';
    const lastRefresh = parseInt(sessionStorage.getItem(lastRefreshKey) || '0');
    
    // If we refreshed recently (within last 2 seconds), skip this refresh
    if (currentTimestamp - lastRefresh < 2000) {
      console.log('[ItineraryContext] Skipping refresh - too soon after last refresh');
      setTimeout(() => {
        isRefreshing.current = false;
      }, 100);
      return;
    }
    
    // Update last refresh timestamp
    sessionStorage.setItem(lastRefreshKey, currentTimestamp.toString());
    
    // Make a copy of the current state to force a re-render
    setItineraryDays(prevDays => {
      // Using a small timeout to reset the flag
      setTimeout(() => {
        isRefreshing.current = false;
      }, 1000);
      
      return [...prevDays];
    });
  }, []);

  // Save the current itinerary to Supabase (if authenticated) or local storage
  const saveItinerary = useCallback(async (title: string = 'My Itinerary'): Promise<string | null> => {
    try {
      // Don't save empty itineraries
      if (itineraryDays.length === 0) {
        console.warn('Attempted to save empty itinerary');
        return null;
      }
      
      // Determine if this should be a new itinerary or update an existing one
      let itineraryId = currentItineraryId;
      let shouldCreateNew = false;
      
      // If we have a current ID, check if the itinerary has changed significantly
      if (currentItineraryId) {
        try {
          let existingItinerary = null;
          
          if (user) {
            // For authenticated users, check Supabase
            try {
              existingItinerary = await databaseService.getItinerary(currentItineraryId);
            } catch (error) {
              console.log('Itinerary not found in Supabase, will create new');
              shouldCreateNew = true;
            }
          } else {
            // For unauthenticated users, check localStorage
            const storageKey = 'itineraries';
            const savedItineraries = localStorage.getItem(storageKey);
            
            if (savedItineraries) {
              const itineraries = JSON.parse(savedItineraries);
              existingItinerary = itineraries.find((item: any) => item.id === currentItineraryId);
            }
          }
          
          if (existingItinerary) {
            // Check if destination or date range has changed significantly
            const existingDestination = existingItinerary.destination || '';
            const existingStartDate = existingItinerary.start_date || existingItinerary.startDate || '';
            const existingEndDate = existingItinerary.end_date || existingItinerary.endDate || '';
            
            const currentDestination = memoizedDestination || '';
            const currentStartDate = memoizedStartDate || '';
            const currentEndDate = memoizedEndDate || '';
            
            // Create new itinerary if destination changed or date range changed significantly
            const destinationChanged = existingDestination !== currentDestination && 
                                     currentDestination.length > 0 && 
                                     existingDestination.length > 0;
            
            const dateRangeChanged = (existingStartDate !== currentStartDate || existingEndDate !== currentEndDate) &&
                                   currentStartDate.length > 0 && 
                                   existingStartDate.length > 0;
            
            console.log('Checking if should create new itinerary:', {
              destinationChanged,
              dateRangeChanged,
              existingDestination,
              currentDestination,
              existingStartDate,
              currentStartDate,
              existingEndDate,
              currentEndDate
            });
            
            if (destinationChanged || dateRangeChanged) {
              shouldCreateNew = true;
              console.log('Creating new itinerary due to significant changes');
            }
          } else {
            // Current ID doesn't exist in storage, so create new
            shouldCreateNew = true;
          }
        } catch (error) {
          console.error('Error checking existing itinerary:', error);
          shouldCreateNew = true;
        }
      } else {
        // No current ID, create new
        shouldCreateNew = true;
      }
      
      // Generate new ID if needed
      if (shouldCreateNew) {
        itineraryId = getActivityIdSafely(undefined);
        console.log('Generated new itinerary ID:', itineraryId);
      }
      
      // Set as current itinerary
      setCurrentItineraryId(itineraryId);
      
      if (user) {
        // Save to Supabase for authenticated users
        try {
          if (shouldCreateNew) {
            console.log('Creating new itinerary in Supabase');
            const result = await databaseService.createItinerary(
              user.id,
              title,
              memoizedDestination || '',
              memoizedStartDate,
              memoizedEndDate,
              itineraryDays
            );
            itineraryId = result.id;
            setCurrentItineraryId(itineraryId);
            console.log('Created new itinerary in Supabase with ID:', itineraryId);
          } else {
            console.log('Updating existing itinerary in Supabase');
            await databaseService.updateItinerary(itineraryId!, {
              name: title,
              destination: memoizedDestination,
              start_date: memoizedStartDate,
              end_date: memoizedEndDate,
              days: itineraryDays
            });
            console.log('Updated existing itinerary in Supabase:', itineraryId);
          }
        } catch (error) {
          console.error('Error saving to Supabase:', error);
          throw error;
        }
      } else {
        // Save to localStorage for unauthenticated users
        const itineraryData = {
          id: itineraryId,
          title,
          destination: memoizedDestination,
          startDate: memoizedStartDate,
          endDate: memoizedEndDate,
          days: itineraryDays,
          createdAt: shouldCreateNew ? new Date().toISOString() : undefined,
          lastUpdated: new Date().toISOString()
        };
        
        // Preserve original creation date if updating existing itinerary
        if (!shouldCreateNew && currentItineraryId) {
          try {
            const storageKey = 'itineraries';
            const savedItineraries = localStorage.getItem(storageKey);
            
            if (savedItineraries) {
              const itineraries = JSON.parse(savedItineraries);
              const existingItinerary = itineraries.find((item: any) => item.id === currentItineraryId);
              
              if (existingItinerary && existingItinerary.createdAt) {
                itineraryData.createdAt = existingItinerary.createdAt;
              }
            }
          } catch (error) {
            console.error('Error preserving creation date:', error);
            itineraryData.createdAt = new Date().toISOString();
          }
        }
        
        // Ensure createdAt is always set
        if (!itineraryData.createdAt) {
          itineraryData.createdAt = new Date().toISOString();
        }
        
        const storageKey = 'itineraries';
        const savedItineraries = localStorage.getItem(storageKey);
        let itineraries = savedItineraries ? JSON.parse(savedItineraries) : [];
        
        // Update if exists, otherwise add new
        const existingIndex = itineraries.findIndex((item: any) => item.id === itineraryId);
        
        if (existingIndex >= 0) {
          itineraries[existingIndex] = itineraryData;
          console.log('Updated existing itinerary in localStorage:', itineraryId);
        } else {
          itineraries.push(itineraryData);
          console.log('Created new itinerary in localStorage:', itineraryId);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(itineraries));
        
        // Also save as most recent itinerary for quick access
        localStorage.setItem('mostRecentItinerary', JSON.stringify(itineraryData));
      }
      
      // Force a UI refresh after saving
      forceRefresh();
      
      return itineraryId;
    } catch (error) {
      console.error('Error saving itinerary:', error);
      return null;
    }
  }, [itineraryDays, currentItineraryId, user, memoizedStartDate, memoizedEndDate, memoizedDestination, forceRefresh]);

  // Load an itinerary from Supabase (if authenticated) or local storage
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
        // Also restore title if available in session storage
        const sessionTitle = getSessionItem<string>(STORAGE_KEYS.CURRENT_ITINERARY_TITLE, 'My Itinerary');
        setCurrentItineraryTitle(sessionTitle);
        
        // Force UI refresh after loading
        setTimeout(() => forceRefresh(), 100);
        return;
      }
      
      let itinerary = null;
      
      if (user) {
        // For authenticated users, load from Supabase
        try {
          itinerary = await databaseService.getItinerary(itineraryId);
          console.log('Loaded itinerary from Supabase:', itinerary);
        } catch (error) {
          console.error('Error loading from Supabase:', error);
          throw new Error(`Itinerary with ID ${itineraryId} not found in Supabase`);
        }
      } else {
        // For unauthenticated users, load from localStorage
        const storageKey = 'itineraries';
        const savedItineraries = localStorage.getItem(storageKey);
        
        if (savedItineraries) {
          const itineraries = JSON.parse(savedItineraries);
          itinerary = itineraries.find((item: any) => item.id === itineraryId);
        }
        
        if (!itinerary) {
          throw new Error(`Itinerary with ID ${itineraryId} not found in localStorage`);
        }
      }
      
      if (itinerary) {
        // Set itinerary data - handle both Supabase and localStorage formats
        const days = itinerary.days || [];
        const title = itinerary.name || itinerary.title || 'My Itinerary';
        
        setItineraryDays(days);
        setCurrentItineraryId(itineraryId);
        setCurrentItineraryTitle(title);
        
        // Update sessionStorage
        setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, days);
        setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, itineraryId);
        setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_TITLE, title);
        
        // Also save as most recent for localStorage users
        if (!user) {
          localStorage.setItem('mostRecentItinerary', JSON.stringify(itinerary));
        }
        
        // Force UI refresh after loading
        setTimeout(() => forceRefresh(), 100);
        return;
      }
      
      throw new Error(`Itinerary with ID ${itineraryId} not found`);
    } catch (error) {
      console.error('Error loading itinerary:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [user, forceRefresh]);

  // Get user's itineraries from Supabase (if authenticated) or localStorage
  const getUserItineraries = useCallback(async (): Promise<any[]> => {
    try {
      setIsLoading(true);
      
      // Simulate an API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (user) {
        // For authenticated users, load from Supabase
        try {
          const itineraries = await databaseService.getUserItineraries(user.id);
          console.log('Loaded itineraries from Supabase:', itineraries);
          
          // Transform Supabase format to match the expected format
          return itineraries.map((itinerary: any) => ({
            id: itinerary.id,
            title: itinerary.name,
            destination: itinerary.destination,
            startDate: itinerary.start_date,
            endDate: itinerary.end_date,
            days: itinerary.days,
            createdAt: itinerary.created_at,
            lastUpdated: itinerary.updated_at
          }));
        } catch (error) {
          console.error('Error loading itineraries from Supabase:', error);
          return [];
        }
      } else {
        // For unauthenticated users, load from localStorage
        const storageKey = 'itineraries';
        const savedItems = localStorage.getItem(storageKey);
        
        if (savedItems) {
          const parsedItems = JSON.parse(savedItems);
          // Sort by creation date, newest first
          parsedItems.sort((a: any, b: any) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return parsedItems;
        }
        
        return [];
      }
    } catch (error) {
      console.error('Error getting user itineraries:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Clear session storage
  const clearSessionStorage = useCallback(() => {
    try {
      console.log('[ItineraryContext] Starting clearSessionStorage process');
      
      // We'll only clear session storage but not the state immediately
      sessionStorage.removeItem(STORAGE_KEYS.ITINERARY_DAYS);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_ITINERARY_ID);
      sessionStorage.removeItem(STORAGE_KEYS.CURRENT_ITINERARY_TITLE);
      
      // Set current ID to null and reset title
      setCurrentItineraryId(null);
      setCurrentItineraryTitle('My Itinerary');
      
      console.log('[ItineraryContext] Session storage cleared');
    } catch (error) {
      console.error('Error clearing session storage:', error);
    }
  }, []);

  // Save current itinerary as previous itinerary before clearing
  const savePreviousItinerary = useCallback(() => {
    try {
      if (itineraryDays.length > 0) {
        // Save the current itinerary as the previous one
        const itineraryToSave = {
          days: itineraryDays,
          currentId: currentItineraryId,
          title: itineraryDays.length > 0 ? 'Previous Itinerary' : ''
        };
        setSessionItem(STORAGE_KEYS.PREVIOUS_ITINERARY, itineraryToSave);
        console.log('Previous itinerary saved to session storage');
      }
    } catch (error) {
      console.error('Error saving previous itinerary:', error);
    }
  }, [itineraryDays, currentItineraryId]);

  // Check if there's a previous itinerary available
  const hasPreviousItinerary = useCallback(() => {
    try {
      const previousItinerary = sessionStorage.getItem(STORAGE_KEYS.PREVIOUS_ITINERARY);
      return previousItinerary !== null && previousItinerary !== undefined;
    } catch (error) {
      console.error('Error checking for previous itinerary:', error);
      return false;
    }
  }, []);

  // Restore the previous itinerary
  const restorePreviousItinerary = useCallback(() => {
    try {
      const previousItineraryJson = sessionStorage.getItem(STORAGE_KEYS.PREVIOUS_ITINERARY);
      if (!previousItineraryJson) {
        console.log('No previous itinerary found');
        return false;
      }

      const previousItinerary = JSON.parse(previousItineraryJson);
      
      // Restore the itinerary days
      if (previousItinerary.days && Array.isArray(previousItinerary.days)) {
        setItineraryDays(previousItinerary.days);
        setCurrentItineraryId(previousItinerary.currentId || null);
        
        // Update session storage
        setSessionItem(STORAGE_KEYS.ITINERARY_DAYS, previousItinerary.days);
        setSessionItem(STORAGE_KEYS.CURRENT_ITINERARY_ID, previousItinerary.currentId);
        
        console.log('Previous itinerary restored');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error restoring previous itinerary:', error);
      return false;
    }
  }, []);

  // Clear itinerary days
  const clearItineraryDays = useCallback(() => {
    console.log('[ItineraryContext] Clearing all itinerary days from state');
    setItineraryDays([]);
    
    // Also ensure session storage is cleared
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ITINERARY_DAYS);
      console.log('[ItineraryContext] Cleared itinerary days from session storage');
    } catch (error) {
      console.error('Error clearing itinerary days from session storage:', error);
    }
  }, []);

  // Helper function to get current itinerary title
  const getCurrentItineraryTitle = useCallback(() => {
    return currentItineraryTitle || 'My Itinerary';
  }, [currentItineraryTitle]);

  // Delete an itinerary
  const deleteItinerary = useCallback(async (itineraryId: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      if (user) {
        // For authenticated users, delete from Supabase
        await databaseService.deleteItinerary(itineraryId);
      } else {
        // For unauthenticated users, delete from localStorage
        const storageKey = 'itineraries';
        const savedItineraries = localStorage.getItem(storageKey);
        
        if (savedItineraries) {
          const itineraries = JSON.parse(savedItineraries);
          const newItineraries = itineraries.filter((item: any) => item.id !== itineraryId);
          
          localStorage.setItem(storageKey, JSON.stringify(newItineraries));
        }
      }
      
      // Clear the itinerary state
      setItineraryDays([]);
      setCurrentItineraryId(null);
      setCurrentItineraryTitle('My Itinerary');
      
      // Clear session storage
      clearSessionStorage();
      
      // Force a UI refresh
      forceRefresh();
    } catch (error) {
      console.error('Error deleting itinerary:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, clearSessionStorage, forceRefresh]);

  return (
    <ItineraryContext.Provider
      value={{
        itineraryDays,
        suggestions,
        isLoading,
        currentItineraryId,
        currentItineraryTitle,
        setCurrentItineraryTitle,
        getCurrentItineraryTitle,
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
        deleteItinerary,
        clearSessionStorage,
        clearItineraryDays,
        savePreviousItinerary,
        restorePreviousItinerary,
        hasPreviousItinerary,
        forceRefresh
      }}
    >
      {children}
    </ItineraryContext.Provider>
  );
}; 