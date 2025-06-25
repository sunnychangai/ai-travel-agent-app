import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { enhancedOpenAIService } from '../services/enhancedOpenAIService';
import { useItinerary } from '../contexts/ItineraryContext';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useUserPreferences as useContextPreferences } from '../contexts/UserPreferencesContext';
import { convertItineraryApiToContext, generateItineraryTitle } from '../utils/itineraryUtils';
import { extractJsonFromText, safeJsonParse } from '../utils/jsonUtils';
import UserPreferencesService from '../services/userPreferencesService';
import { supabase } from '../lib/supabase';

type AgentItineraryResult = {
  success: boolean;
  message: string;
  data?: any;
};

type UseAgentItineraryState = {
  isGenerating: boolean;
  isUpdating: boolean;
  lastAction: 'none' | 'generate' | 'update';
  error: string | null;
};

type UseAgentItineraryActions = {
  generateItinerary: (
    destination: string,
    startDate: string | Date,
    endDate: string | Date,
    preferencesOverride?: any
  ) => Promise<AgentItineraryResult>;
  updateItinerary: (
    userInput: string
  ) => Promise<AgentItineraryResult>;
  detectItineraryRequest: (
    userInput: string
  ) => Promise<{
    isItineraryRequest: boolean;
    extractedParams: any;
    isPreviousItineraryRequest: boolean;
  }>;
  detectUpdateRequest: (
    userInput: string
  ) => Promise<{
    isUpdateRequest: boolean;
    requestType: 'change_time' | 'add_activity' | 'remove_activity' | 'unknown';
    details: any;
  }>;
  shouldConfirmReplacement: (
    destination: string,
    startDate: string | Date,
    endDate: string | Date
  ) => boolean;
  updateUserPreferencesFromConversation: (
    userInput: string
  ) => Promise<void>;
  hasPreviousItinerary: () => boolean;
  restorePreviousItinerary: () => boolean;
  createEnhancedItinerary: (
    destination: string,
    startDate: string | Date,
    endDate: string | Date,
    interests: Array<{id: string; label: string}>,
    preferences: any
  ) => Promise<AgentItineraryResult>;
  cancelItineraryCreation: () => void;
  itineraryCreationStatus: 'idle' | 'loading' | 'starting' | 'success' | 'error';
  itineraryCreationProgress: number;
  itineraryCreationStep: string;
};

/**
 * Hook for handling AI-powered itinerary generation and management
 */
export function useAgentItinerary(): UseAgentItineraryState & UseAgentItineraryActions {
  const { user } = useAuth();
  const { 
    itineraryDays, 
    addDay, 
    updateActivity, 
    deleteActivity, 
    clearSessionStorage, 
    clearItineraryDays,
    saveItinerary,
    savePreviousItinerary,
    restorePreviousItinerary,
    hasPreviousItinerary,
    forceRefresh
  } = useItinerary();
  const { preferences: enhancedPreferences, updatePreferences } = useUserPreferences();
  const { preferences: contextPreferences } = useContextPreferences();
  const requestManager = useRef(new AbortController());
  
  const [state, setState] = useState<UseAgentItineraryState>({
    isGenerating: false,
    isUpdating: false,
    lastAction: 'none',
    error: null,
  });

  // Add state for itinerary creation progress
  const [itineraryCreationStatus, setItineraryCreationStatus] = useState<'idle' | 'loading' | 'starting' | 'success' | 'error'>('idle');
  const [itineraryCreationProgress, setItineraryCreationProgress] = useState(0);
  const [itineraryCreationStep, setItineraryCreationStep] = useState('');
  
  // Clean up request on unmount
  useEffect(() => {
    return () => {
      requestManager.current.abort();
    };
  }, []);
  
  // Helper function to convert onboarding preferences to enhanced format
  const convertOnboardingToEnhanced = useCallback((onboardingPrefs: any) => {
    if (!onboardingPrefs) return null;
    
    return {
      travelStyle: onboardingPrefs.travel_style?.[0] || onboardingPrefs.travelStyle || 'cultural',
      interests: (onboardingPrefs.activities || onboardingPrefs.interests || []).map((item: string) => ({
        id: item.toLowerCase().replace(/\s+/g, ''),
        label: item
      })),
      travelGroup: 'couple', // Default since onboarding doesn't capture this
      budget: onboardingPrefs.budget || 'mid-range',
      transportMode: 'walking', // Default since onboarding doesn't capture this
      dietaryPreferences: (onboardingPrefs.preferences || onboardingPrefs.dietary_restrictions || []).map((item: string) => ({
        id: item.toLowerCase().replace(/\s+/g, ''),
        label: item
      })),
      pace: 'moderate' as const, // Default since onboarding doesn't capture this
      lastUpdated: Date.now()
    };
  }, []);
  
  // Load and merge preferences from both systems
  const loadMergedPreferences = useCallback(async () => {
    try {
      if (!user) return null;
      
      // Load from both systems in parallel
      const [enhancedPrefs, onboardingPrefs] = await Promise.all([
        UserPreferencesService.loadPreferences(),
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single()
          .then(({ data, error }) => error ? null : data)
      ]);
      
      // If we have onboarding preferences but no enhanced preferences, convert and save
      if (onboardingPrefs && !enhancedPrefs) {
        const convertedPrefs = convertOnboardingToEnhanced(onboardingPrefs);
        if (convertedPrefs) {
          await UserPreferencesService.savePreferences(convertedPrefs);
          return convertedPrefs;
        }
      }
      
      // If we have enhanced preferences but they're older than onboarding preferences, update them
      if (enhancedPrefs && onboardingPrefs) {
        const onboardingUpdated = onboardingPrefs.updated_at && typeof onboardingPrefs.updated_at === 'string' 
          ? new Date(onboardingPrefs.updated_at).getTime() 
          : 0;
        const enhancedUpdated = enhancedPrefs.lastUpdated || 0;
        
        if (onboardingUpdated > enhancedUpdated) {
          const convertedPrefs = convertOnboardingToEnhanced(onboardingPrefs);
          if (convertedPrefs) {
            // Merge with existing enhanced preferences to preserve fields not in onboarding
            const mergedPrefs = {
              ...enhancedPrefs,
              ...convertedPrefs,
              lastUpdated: Date.now()
            };
            await UserPreferencesService.savePreferences(mergedPrefs);
            return mergedPrefs;
          }
        }
      }
      
      // Return enhanced preferences if available, otherwise convert onboarding preferences
      return enhancedPrefs || convertOnboardingToEnhanced(onboardingPrefs);
    } catch (error) {
      console.error('Error loading merged preferences:', error);
      return enhancedPreferences; // Fallback to current enhanced preferences
    }
  }, [user, enhancedPreferences, convertOnboardingToEnhanced]);
  
  // Memoize enhanced preferences by combining user preferences with overrides
  const getEnhancedPreferences = useCallback(async (preferencesOverride?: any) => {
    // Load the most up-to-date preferences
    const mergedPreferences = await loadMergedPreferences();
    
    return {
      ...(mergedPreferences || enhancedPreferences || {}),
      ...(preferencesOverride || {})
    };
  }, [enhancedPreferences, loadMergedPreferences]);
  
  // Memoize the current itinerary in API format for updates
  const currentItineraryForApi = useMemo(() => {
    if (!itineraryDays || itineraryDays.length === 0) {
      return null;
    }
    
    // Get the original destination to compare later
    const originalDestination = itineraryDays[0]?.activities[0]?.location?.split(',')[0] || 'Unknown';
    
    // Try to extract city name if it's a full address
    let cleanOriginalDestination = originalDestination;
    if (originalDestination.includes(',')) {
      const parts = originalDestination.split(',');
      if (parts.length >= 2) {
        cleanOriginalDestination = parts[1].trim();
      }
    }
    
    // Convert current itinerary to the format expected by the API
    return {
      destination: cleanOriginalDestination,
      startDate: itineraryDays[0]?.date,
      endDate: itineraryDays[itineraryDays.length - 1]?.date,
      itinerary: itineraryDays.map(day => ({
        day: `Day ${day.dayNumber}: ${day.date}`,
        activities: day.activities.map(activity => ({
          time: activity.time,
          type: activity.type || 'activity',
          name: activity.title,
          address: activity.location,
          description: activity.description,
        }))
      }))
    };
  }, [itineraryDays]);

  // Helper function to update progress
  const updateProgress = useCallback((progress: number, step: string) => {
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      setItineraryCreationProgress(progress);
      setItineraryCreationStep(step);
    });
  }, []);
  
  // Cancel itinerary creation
  const cancelItineraryCreation = useCallback(() => {
    requestManager.current.abort();
    requestManager.current = new AbortController();
    setItineraryCreationStatus('idle');
    setItineraryCreationProgress(0);
    setItineraryCreationStep('');
  }, []);

  // Enhanced itinerary creation with smooth progress updates
  const createEnhancedItinerary = useCallback(async (
    destination: string,
    startDate: string | Date,
    endDate: string | Date,
    interests: Array<{id: string; label: string}>,
    preferences: any
  ): Promise<AgentItineraryResult> => {
    try {
      // Reset state and show loading
      setItineraryCreationStatus('loading');
      setItineraryCreationProgress(0);
      setItineraryCreationStep('Preparing your itinerary...');
      
      // Abort any previous requests
      requestManager.current.abort();
      requestManager.current = new AbortController();
      
      // Simulate initial progress with smoother transitions
      await new Promise(resolve => setTimeout(resolve, 300));
      updateProgress(5, 'Analyzing your destination...');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      updateProgress(15, 'Finding the best attractions for you...');
      
      // Start the actual generation process
      const enhancedPreferences = {
        ...preferences,
        interests: interests.map(i => i.label),
        ...preferences
      };
      
      // Create a custom handler for progress updates
      const handleProgress = (progress: number, message: string) => {
        updateProgress(progress, message);
      };
      
      // Simulate more progress before API call
      await new Promise(resolve => setTimeout(resolve, 400));
      updateProgress(25, 'Creating your personalized itinerary...');
      
      // Call the API with progress updates
      let result;
      try {
        result = await enhancedOpenAIService.generateItinerary(
          destination,
          startDate,
          endDate,
          {
            ...enhancedPreferences,
            onProgress: handleProgress
          },
          { 
            signal: requestManager.current.signal
          }
        );
        
        if (!result) {
          throw new Error('Failed to generate itinerary - no data returned');
        }
      } catch (error: any) {
        // Handle abort errors gracefully
        if (error && (error.name === 'AbortError' || (error.message && (error as Error).message.includes('abort')))) {
          console.log('Itinerary generation was aborted');
          setItineraryCreationStatus('idle');
          return {
            success: false,
            message: 'Itinerary generation was canceled',
          };
        }
        throw error; // Re-throw other errors
      }
      
      // Save the current itinerary before clearing it
      if (itineraryDays.length > 0) {
        savePreviousItinerary();
      }
      
      // Clear session storage but don't clear state yet
      clearSessionStorage();
      
      // Make sure to completely clear existing days to prevent accumulation
      clearItineraryDays();
      
      // Small delay to ensure clearing is complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Convert and add the new itinerary
      updateProgress(85, 'Finalizing your itinerary...');
      
      const { days: formattedDays, title } = convertItineraryApiToContext(result);
      
      // Check if we have valid days to add
      if (!formattedDays || formattedDays.length === 0) {
        throw new Error('No itinerary days were generated');
      }
      
      // Sort days by day number
      const sortedDays = [...formattedDays].sort((a, b) => a.dayNumber - b.dayNumber);
      
      // First set our local state
      setState(prev => ({
        ...prev,
        lastAction: 'generate',
      }));
      
      // Wait a moment to ensure the state is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now add each day to the context
      console.log(`[useAgentItinerary] Adding ${sortedDays.length} new days to itinerary`);
      
      // Add days one by one to ensure they get created properly
      let daysAdded = 0;
      for (const day of sortedDays) {
        console.log(`[useAgentItinerary] Adding day ${day.dayNumber} to itinerary`);
        addDay(day);
        daysAdded++;
        
        // Small delay between adding days to prevent UI stuttering
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      console.log(`[useAgentItinerary] Added ${daysAdded} days to itinerary`);
      
      // Force a refresh after adding all days to ensure UI updates
      console.log('[useAgentItinerary] Initial refresh after adding days');
      forceRefresh();
      
      // Auto-save the itinerary only if we have days
      let itineraryId = null;
      updateProgress(95, 'Saving your itinerary...');
      
      // Wait a moment to ensure all days are properly added before saving
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (sortedDays.length > 0) {
        try {
          console.log('[useAgentItinerary] Saving itinerary with title:', title);
          itineraryId = await saveItinerary(title);
          console.log(`[useAgentItinerary] Automatically saved itinerary with title: "${title}", ID: ${itineraryId}`);
        } catch (saveError) {
          console.error('Failed to save itinerary:', saveError);
          // Continue without failing the whole process
        }
      }
      
      // Complete
      updateProgress(100, 'Your itinerary is ready!');
      setItineraryCreationStatus('success');
      
      // Ensure all components receive the updated itinerary
      // Force a UI refresh by updating the state after a short delay
      setTimeout(() => {
        // This will trigger a re-render in components using this hook
        setState(prev => ({ 
          ...prev,
          lastAction: 'generate',
          isGenerating: false,
          error: null
        }));
        
        // No need for additional refresh calls here - one is enough
      }, 100);
      
      // Return success
      return {
        success: true,
        message: 'Successfully created itinerary',
        data: {
          ...result,
          title
        },
      };
    } catch (error: any) {
      console.error('Error creating enhanced itinerary:', error);
      
      // Handle abort
      if (error.name === 'AbortError') {
        setItineraryCreationStatus('idle');
        return {
          success: false,
          message: 'Itinerary creation canceled',
        };
      }
      
      // Handle other errors
      setItineraryCreationStatus('error');
      setItineraryCreationStep((error as Error).message || 'Failed to create itinerary');
      
      return {
        success: false,
        message: (error as Error).message || 'Failed to create itinerary',
      };
    }
  }, [
    enhancedPreferences,
    itineraryDays,
    addDay,
    clearSessionStorage,
    savePreviousItinerary,
    saveItinerary,
    updateProgress,
    forceRefresh,
    clearItineraryDays
  ]);
  
  /**
   * Generate a complete itinerary based on user input
   */
  const generateItinerary = useCallback(async (
    destination: string,
    startDate: string | Date,
    endDate: string | Date,
    preferencesOverride?: any
  ): Promise<AgentItineraryResult> => {
    try {
      // Update state to indicate generation in progress
      setState(prev => ({
        ...prev,
        isGenerating: true,
        error: null,
      }));
      
      // Abort any in-flight requests
      requestManager.current.abort();
      requestManager.current = new AbortController();
      
      // Use memoized enhanced preferences
      const enhancedPreferencesResult = await getEnhancedPreferences(preferencesOverride);
      
      // Call the service to generate the itinerary
      const itineraryData = await enhancedOpenAIService.generateItinerary(
        destination,
        startDate,
        endDate,
        enhancedPreferencesResult,
        { signal: requestManager.current.signal }
      );
      
      // Save the current itinerary before clearing it
      if (itineraryDays.length > 0) {
        savePreviousItinerary();
      }
      
      // Clear existing itinerary - both session storage and state
      clearSessionStorage();
      
      // First clear the existing days before adding new ones
      // This is critical to prevent accumulation of days
      clearItineraryDays();
      
      // Wait a small time to ensure clearing is complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Convert the API data format to the format expected by ItineraryContext
      const { days: formattedDays, title } = convertItineraryApiToContext(itineraryData);
      
      // Sort days by day number to ensure proper order
      const sortedDays = [...formattedDays].sort((a, b) => a.dayNumber - b.dayNumber);
      
      // Add each day to the context
      sortedDays.forEach(day => {
        addDay(day);
      });
      
      // Auto-save the itinerary with the generated title
      const itineraryId = await saveItinerary(title);
      console.log(`Automatically saved itinerary with title: "${title}", ID: ${itineraryId}`);
      
      // Update state to indicate generation complete
      setState(prev => ({
        ...prev,
        isGenerating: false,
        lastAction: 'generate',
        error: null,
      }));
      
      return {
        success: true,
        message: 'Successfully generated itinerary',
        data: {
          ...itineraryData,
          title
        },
      };
    } catch (error: any) {
      // Handle errors
      if (error.name === 'AbortError') {
        console.log('Itinerary generation aborted');
        return {
          success: false,
          message: 'Generation aborted',
        };
      }
      
      console.error('Error generating itinerary:', error);
      
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error.message || 'Failed to generate itinerary',
      }));
      
      return {
        success: false,
        message: error.message || 'Failed to generate itinerary',
      };
    }
  }, [
    enhancedPreferences, 
    itineraryDays, 
    addDay, 
    clearSessionStorage, 
    savePreviousItinerary, 
    saveItinerary, 
    getEnhancedPreferences,
    clearItineraryDays
  ]);
  
  /**
   * Update an existing itinerary based on user input
   */
  const updateItinerary = useCallback(async (
    userInput: string
  ): Promise<AgentItineraryResult> => {
    try {
      // Make sure there's an itinerary to update
      if (!itineraryDays || itineraryDays.length === 0) {
        return {
          success: false,
          message: 'No itinerary to update. Please generate an itinerary first.'
        };
      }
      
      // Update state to indicate update in progress
      setState(prev => ({
        ...prev,
        isUpdating: true,
        error: null,
      }));
      
      // Use memoized current itinerary in API format
      const currentItinerary = currentItineraryForApi;
      
      if (!currentItinerary) {
        throw new Error('Failed to prepare current itinerary for update');
      }
      
      // Process the update
      const updatedItinerary = await enhancedOpenAIService.processItineraryUpdate(
        userInput,
        currentItinerary
      );
      
      // Save the current itinerary before clearing it
      savePreviousItinerary();

      // Clear the existing itinerary - both storage and state
      clearSessionStorage();
      clearItineraryDays();

      // Wait a small time to ensure clearing is complete
      await new Promise(resolve => setTimeout(resolve, 50));

      // Convert and add updated days
      const { days: formattedDays, title, destination: newDestination } = convertItineraryApiToContext(updatedItinerary);
      
      // Sort days by day number to ensure proper order
      const sortedDays = [...formattedDays].sort((a, b) => a.dayNumber - b.dayNumber);
      
      // Add each day to the context
      sortedDays.forEach(day => {
        addDay(day);
      });
      
      // Only generate a new title if the destination has changed significantly
      let finalTitle = title;
      if (currentItinerary.destination !== newDestination) {
        finalTitle = generateItineraryTitle(
          newDestination, 
          updatedItinerary.startDate, 
          updatedItinerary.endDate
        );
      }
      
      // Auto-save the updated itinerary
      const itineraryId = await saveItinerary(finalTitle);
      console.log(`Automatically saved updated itinerary with title: "${finalTitle}", ID: ${itineraryId}`);
      
      // Update state to indicate update complete
      setState(prev => ({
        ...prev,
        isUpdating: false,
        lastAction: 'update',
        error: null,
      }));
      
      return {
        success: true,
        message: 'Successfully updated itinerary',
        data: {
          ...updatedItinerary,
          title: finalTitle
        },
      };
    } catch (error: any) {
      console.error('Error updating itinerary:', error);
      
      setState(prev => ({
        ...prev,
        isUpdating: false,
        error: error.message || 'Failed to update itinerary',
      }));
      
      return {
        success: false,
        message: error.message || 'Failed to update itinerary',
      };
    }
  }, [
    itineraryDays,
    addDay,
    clearSessionStorage,
    savePreviousItinerary,
    saveItinerary,
    currentItineraryForApi,
    clearItineraryDays
  ]);
  
  /**
   * Detect if a user message is requesting an itinerary generation
   */
  const detectItineraryRequest = useCallback(async (
    userInput: string
  ): Promise<{
    isItineraryRequest: boolean;
    extractedParams: any;
    isPreviousItineraryRequest: boolean;
  }> => {
    try {
      // Check if this is a request for the previous itinerary
      const isPreviousItineraryRequest = /previous|last|restore|old|earlier|before|bring back|recover/i.test(userInput) &&
        /itinerary|plan|trip|travel/i.test(userInput);
      
      // If it's a previous itinerary request and we have one, return immediately
      if (isPreviousItineraryRequest && hasPreviousItinerary()) {
        return {
          isItineraryRequest: false,
          extractedParams: {},
          isPreviousItineraryRequest: true
        };
      }
      
      // Extract parameters using OpenAI
      const extractedParams = await enhancedOpenAIService.extractItineraryParameters(userInput);
      
      // Determine if this is an itinerary request
      // It's an itinerary request if it has a destination and either dates or duration
      const isItineraryRequest = Boolean(
        extractedParams.destination &&
        (extractedParams.startDate || extractedParams.endDate || extractedParams.duration)
      );
      
      return {
        isItineraryRequest,
        extractedParams,
        isPreviousItineraryRequest: false
      };
    } catch (error) {
      console.error('Error detecting itinerary request:', error);
      return {
        isItineraryRequest: false,
        extractedParams: {},
        isPreviousItineraryRequest: false
      };
    }
  }, []);
  
  /**
   * Detect if a user message is requesting an update to the itinerary
   */
  const detectUpdateRequest = useCallback(async (
    userInput: string
  ): Promise<{
    isUpdateRequest: boolean;
    requestType: 'change_time' | 'add_activity' | 'remove_activity' | 'unknown';
    details: any;
  }> => {
    try {
      // No itinerary to update
      if (!itineraryDays || itineraryDays.length === 0) {
        return {
          isUpdateRequest: false,
          requestType: 'unknown',
          details: {},
        };
      }
      
      // Prepare a prompt to analyze the user request
      const analyzePrompt = `
Analyze this user request and determine if it's asking to update a travel itinerary:
"${userInput}"

Return a JSON object with:
1. "isUpdateRequest": boolean - true if the request is about updating an itinerary
2. "requestType": one of ["change_time", "add_activity", "remove_activity", "unknown"] 
3. "details": an object with extracted details like:
   - "day": the day mentioned (e.g., "Day 1", "Thursday", etc.)
   - "activity": the activity mentioned (e.g., "dinner", "museum visit")
   - "newTime": if changing time, the new time (e.g., "8:00 PM")
   - "activityToAdd": if adding, details of the new activity
   - "activityToRemove": if removing, which activity to remove
`;

      // Call OpenAI to analyze the request
      const response = await enhancedOpenAIService.batchRequests([
        {
          prompt: analyzePrompt,
          model: 'gpt-3.5-turbo-1106',
          temperature: 0.3,
          parseResponse: (text) => JSON.parse(text),
        }
      ]);
      
      const analysis = response[0];
      
      return {
        isUpdateRequest: analysis.isUpdateRequest || false,
        requestType: analysis.requestType || 'unknown',
        details: analysis.details || {},
      };
    } catch (error) {
      console.error('Error detecting update request:', error);
      return {
        isUpdateRequest: false,
        requestType: 'unknown',
        details: {},
      };
    }
  }, [itineraryDays]);
  
  /**
   * Determine if user should be asked to confirm replacing the current itinerary
   */
  const shouldConfirmReplacement = useCallback((
    destination: string,
    startDate: string | Date,
    endDate: string | Date
  ): boolean => {
    // No existing itinerary, no need to confirm
    if (!itineraryDays || itineraryDays.length === 0) {
      return false;
    }
    
    return true;
  }, [itineraryDays]);
  
  /**
   * Update user preferences based on conversation
   */
  const updateUserPreferencesFromConversation = useCallback(async (
    userInput: string
  ): Promise<void> => {
    try {
      if (!user) return;
      
      // Extract preferences from the user input
      const extractedPreferences = await enhancedOpenAIService.extractUserPreferences(
        userInput,
        enhancedPreferences || {}
      );
      
      // Only update if we extracted meaningful preferences
      const hasExtracted = Object.keys(extractedPreferences).some(key => {
        const value = extractedPreferences[key];
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return Boolean(value);
      });
      
      if (hasExtracted) {
        // Update preferences in context
        updatePreferences(extractedPreferences);
        
        // Store inferred preferences for this user
        UserPreferencesService.saveInferredPreferences(user.id, extractedPreferences);
        
        // Also update in database if significant changes
        if (Object.keys(extractedPreferences).length > 2) {
          await UserPreferencesService.updateFromConversationInferences(
            user.id,
            extractedPreferences
          );
        }
      }
    } catch (error) {
      console.error('Error updating preferences from conversation:', error);
      // Don't throw - this is a background enhancement
    }
  }, [user, enhancedPreferences, updatePreferences]);
  
  return {
    ...state,
    generateItinerary,
    updateItinerary,
    detectItineraryRequest,
    detectUpdateRequest,
    shouldConfirmReplacement,
    updateUserPreferencesFromConversation,
    hasPreviousItinerary,
    restorePreviousItinerary,
    createEnhancedItinerary,
    cancelItineraryCreation,
    itineraryCreationStatus,
    itineraryCreationProgress,
    itineraryCreationStep,
  };
}