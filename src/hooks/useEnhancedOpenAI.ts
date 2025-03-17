import { useState, useEffect, useCallback, useRef } from 'react';
import { enhancedOpenAIService } from '../services/enhancedOpenAIService';
import useApiWithAbort from './useApiWithAbort';

// Define proper types for the API response
interface Activity {
  id?: string;
  title: string;
  description?: string;
  location?: string;
  time?: string;
  category?: string;
  subcategory?: string;
  duration?: string;
  price?: string;
  notes?: string;
  imageUrl?: string;
  dayNumber?: number;
}

interface Day {
  dayNumber: number;
  date: string;
  activities: Activity[];
}

interface ItineraryResult {
  days: Day[];
  destination: string;
  startDate: string;
  endDate: string;
  // Add any other fields that might be in the result
}

interface ProgressState {
  status: 'idle' | 'starting' | 'loading' | 'success' | 'error';
  progress: number;
  step: string;
  error: Error | null;
}

interface GenerateItineraryOptions {
  destination: string;
  startDate: string;
  endDate: string;
  interests: string[];
  preferences: {
    travelStyle: string;
    travelGroup: string;
    budget: string;
    transportMode: string;
    dietaryPreferences: string[];
    pace: 'slow' | 'moderate' | 'fast';
  };
  onProgress?: (progress: number, step: string) => void;
}

/**
 * Function to get a default image based on activity type
 */
const getDefaultImage = (type?: string): string => {
  if (!type) return 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=600&q=80';
  
  switch (type.toLowerCase()) {
    case 'food':
    case 'restaurant':
      return 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80';
    case 'museum':
    case 'culture':
      return 'https://images.unsplash.com/photo-1566054757965-8b4543c39de4?w=600&q=80';
    case 'nature':
      return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80';
    case 'landmark':
      return 'https://images.unsplash.com/photo-1526609636232-269256208faf?w=600&q=80';
    case 'shopping':
      return 'https://images.unsplash.com/photo-1481437156560-3205f6a55735?w=600&q=80';
    case 'entertainment':
      return 'https://images.unsplash.com/photo-1603739903239-8b6e64c3b185?w=600&q=80';
    default:
      return 'https://images.unsplash.com/photo-1481277542470-605612bd2d61?w=600&q=80';
  }
};

/**
 * Custom hook for using enhanced OpenAI functionality with progress tracking
 */
export function useEnhancedOpenAI() {
  const [progressState, setProgressState] = useState<ProgressState>({
    status: 'idle',
    progress: 0,
    step: '',
    error: null,
  });
  
  // Reference to track cancellation
  const cancelTokenRef = useRef(false);
  
  // Reset on unmount
  useEffect(() => {
    return () => {
      cancelTokenRef.current = true;
    };
  }, []);
  
  // Update progress helper
  const updateProgress = useCallback((progress: number, step: string) => {
    setProgressState(prev => ({
      ...prev,
      progress,
      step,
      status: 'loading',
    }));
  }, []);
  
  // Create abort signal 
  const createSignal = useCallback(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    
    return signal;
  }, []);
  
  // Cancel all requests
  const cancelRequests = useCallback(() => {
    cancelTokenRef.current = true;
    setProgressState({
      status: 'idle',
      progress: 0,
      step: '',
      error: null,
    });
  }, []);
  
  /**
   * Internal function to try generating an itinerary
   */
  const tryGenerateItinerary = useCallback(async (params, numberOfDays) => {
    // Phase 1: Start generation (30%)
    updateProgress(5, 'Planning your perfect trip...');
    if (params.onProgress) params.onProgress(5, 'Planning your perfect trip...');
    
    // Small delay for UI purposes
    await new Promise(resolve => setTimeout(resolve, 500));
    
    updateProgress(15, 'Finding the best attractions for you...');
    if (params.onProgress) params.onProgress(15, 'Finding the best attractions for you...');
    
    if (cancelTokenRef.current) return null;
    
    // Generate the itinerary
    const signal = createSignal();
    const result = await enhancedOpenAIService.generateCompleteItinerary(
      params.destination,
      params.startDate,
      params.endDate,
      params.interests,
      params.preferences,
      { signal }
    );
    
    updateProgress(70, 'Optimizing your daily schedule...');
    if (params.onProgress) params.onProgress(70, 'Optimizing your daily schedule...');
    
    if (cancelTokenRef.current) return null;
    
    // Phase 2: Enhance the activity descriptions (90%)
    const activities = result.days.flatMap(day => 
      day.activities.map(activity => ({
        id: activity.id,
        title: activity.title,
        description: activity.description || '',
      }))
    );
    
    updateProgress(80, 'Adding rich descriptions to activities...');
    if (params.onProgress) params.onProgress(80, 'Adding rich descriptions to activities...');
    
    const enhancedActivities = await enhancedOpenAIService.enhanceActivityDescriptions(
      activities,
      params.destination,
      { signal, batchSize: 5 }
    );
    
    if (cancelTokenRef.current) return null;
    
    // Phase 3: Categorize activities (95%)
    updateProgress(90, 'Categorizing activities...');
    if (params.onProgress) params.onProgress(90, 'Categorizing activities...');
    
    const categorizedActivities = await enhancedOpenAIService.categorizeActivities(
      enhancedActivities,
      { signal }
    );
    
    // Create a map for quick lookup
    const enhancedActivityMap = new Map();
    categorizedActivities.forEach(activity => {
      enhancedActivityMap.set(activity.id, activity);
    });
    
    // Update activities in the result
    const enhancedResult = {
      ...result,
      days: result.days.map(day => ({
        ...day,
        activities: day.activities.map(activity => {
          const enhanced = enhancedActivityMap.get(activity.id);
          if (enhanced) {
            return {
              ...activity,
              description: enhanced.description,
              category: enhanced.category,
              subcategory: enhanced.subcategory,
            };
          }
          return activity;
        }),
      })),
    };
    
    // Complete
    updateProgress(100, 'Your itinerary is ready!');
    if (params.onProgress) params.onProgress(100, 'Your itinerary is ready!');
    
    setProgressState({
      status: 'success',
      progress: 100,
      step: 'Complete',
      error: null,
    });
    
    return enhancedResult;
  }, [updateProgress, createSignal]);

  /**
   * Generate a detailed itinerary with the enhanced OpenAI service
   */
  const generateItinerary = useCallback(
    async (params: {
      destination: string;
      startDate: string;
      endDate: string;
      interests: string[];
      preferences: {
        travelStyle: string;
        travelGroup: string;
        budget: string;
        transportMode: string;
        dietaryPreferences: string[];
        pace: 'slow' | 'moderate' | 'fast';
      };
      onProgress?: (progress: number, step: string) => void;
    }) => {
      try {
        // Reset status
        setProgressState(prev => ({
          ...prev,
          status: 'starting',
          progress: 0,
          step: 'Initializing itinerary creation',
          error: null,
        }));
        cancelTokenRef.current = false;
        
        if (params.onProgress) {
          params.onProgress(0, 'Initializing itinerary creation');
        }
        
        console.log('Starting enhanced itinerary generation for:', params.destination);
        console.log('Itinerary dates:', params.startDate, 'to', params.endDate);

        // Validate required parameters
        if (!params.destination) {
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            step: 'Destination is required',
            error: new Error('Destination is required'),
          }));
          console.error('Cannot generate itinerary: Destination is required');
          return null;
        }

        if (!params.startDate || !params.endDate) {
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            step: 'Start and end dates are required',
            error: new Error('Start and end dates are required'),
          }));
          console.error('Cannot generate itinerary: Start and end dates are required');
          return null;
        }

        // Calculate the number of days for the trip
        const start = new Date(params.startDate);
        const end = new Date(params.endDate);
        
        // Check if dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            step: 'Invalid date format',
            error: new Error('Invalid date format'),
          }));
          console.error('Cannot generate itinerary: Invalid date format', { 
            startDate: params.startDate, 
            endDate: params.endDate,
            startTime: start.getTime(),
            endTime: end.getTime()
          });
          return null;
        }
        
        const numberOfDays = Math.ceil(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        
        console.log(`Trip length: ${numberOfDays} days`);
        
        if (numberOfDays <= 0) {
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            step: 'End date must be after start date',
            error: new Error('End date must be after start date'),
          }));
          console.error('Cannot generate itinerary: End date must be after start date');
          return null;
        }

        if (numberOfDays > 14) {
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            step: 'Itineraries cannot exceed 14 days',
            error: new Error('Itineraries cannot exceed 14 days'),
          }));
          console.error('Cannot generate itinerary: Trip too long', numberOfDays);
          return null;
        }
        
        // Only proceed if not canceled
        if (cancelTokenRef.current) {
          console.log('Itinerary generation was canceled');
          return null;
        }

        // Proceed with generation
        try {
          return await tryGenerateItinerary(params, numberOfDays);
        } catch (error) {
          console.error('Error in tryGenerateItinerary:', error);
          setProgressState(prev => ({
            ...prev,
            status: 'error',
            progress: 0,
            step: `Failed to generate itinerary: ${error.message || 'Unknown error'}`,
            error: error instanceof Error ? error : new Error(error.message || 'Unknown error'),
          }));
          
          if (params.onProgress) {
            params.onProgress(0, `Error: ${error.message || 'Failed to generate itinerary'}`);
          }
          
          return null;
        }
      } catch (error) {
        console.error('Error in generateItinerary:', error);
        setProgressState(prev => ({
          ...prev,
          status: 'error',
          progress: 0,
          step: error.message || 'Unknown error',
          error: error instanceof Error ? error : new Error(error.message || 'Unknown error'),
        }));
        return null;
      }
    },
    [tryGenerateItinerary]
  );
  
  return {
    generateItinerary,
    cancelRequests,
    status: progressState.status,
    progress: progressState.progress,
    step: progressState.step,
    error: progressState.error,
  };
}

export default useEnhancedOpenAI; 