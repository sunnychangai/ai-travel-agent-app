import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { enhancedOpenAIService } from '../services/enhancedOpenAIService';
import { useItinerary } from '../contexts/ItineraryContext';
import { useAuth } from '../contexts/AuthContext';
// Note: Using only unifiedUserPreferencesService for all preference operations
import { convertItineraryApiToContext, generateItineraryTitle } from '../utils/itineraryUtils';
import { extractJsonFromText, safeJsonParse } from '../utils/jsonUtils';
import { unifiedUserPreferencesService } from '../services/unifiedUserPreferencesService';
import { conversationFlowManager } from '../services/conversationFlowManager';
import { useDebounce } from './useDebounce';

// **STEP 3.3: UNIFIED STATUS MANAGEMENT**
// Standardized status enum matching component interface
type ItineraryCreationStatus = 'idle' | 'loading' | 'success' | 'error' | 'starting';

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
  itineraryCreationStatus: ItineraryCreationStatus;
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
    finishItineraryCreation,
    saveItinerary,
    savePreviousItinerary,
    restorePreviousItinerary,
    hasPreviousItinerary,
    forceRefresh
  } = useItinerary();
  const requestManager = useRef(new AbortController());
  
  // Cached preferences to avoid repeated loading
  const [cachedPreferences, setCachedPreferences] = useState<any>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  
  const [state, setState] = useState<UseAgentItineraryState>({
    isGenerating: false,
    isUpdating: false,
    lastAction: 'none',
    error: null,
  });

  // **STEP 3.3: ENHANCED STATUS MANAGEMENT**
  const [itineraryCreationStatus, setItineraryCreationStatus] = useState<ItineraryCreationStatus>('idle');
  const [itineraryCreationProgress, setItineraryCreationProgress] = useState(0);
  const [itineraryCreationStep, setItineraryCreationStep] = useState('');
  
  // **STEP 3.3: DEBOUNCED PROGRESS UPDATES**
  const [progressQueue, setProgressQueue] = useState<{progress: number; step: string} | null>(null);
  const debouncedProgress = useDebounce(progressQueue, 150); // 150ms debounce
  
  // **STEP 3.3: ERROR TIMEOUT MANAGEMENT**
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Apply debounced progress updates
  useEffect(() => {
    if (debouncedProgress) {
      setItineraryCreationProgress(debouncedProgress.progress);
      setItineraryCreationStep(debouncedProgress.step);
    }
  }, [debouncedProgress]);
  
  // **STEP 3.3: AUTO-CLEAR ERRORS AFTER TIMEOUT**
  useEffect(() => {
    if (itineraryCreationStatus === 'error' && itineraryCreationStep) {
      errorTimeoutRef.current = setTimeout(() => {
        if (itineraryCreationStatus === 'error') {
          console.log('[useAgentItinerary] Auto-clearing error after timeout');
          resetStatus();
        }
      }, 10000); // Auto-clear error after 10 seconds
    }
    
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        errorTimeoutRef.current = null;
      }
    };
  }, [itineraryCreationStatus, itineraryCreationStep]);
  
  // Clean up request on unmount
  useEffect(() => {
    return () => {
      requestManager.current.abort();
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);
  
  // **STEP 3.3: UNIFIED STATUS RESET**
  const resetStatus = useCallback(() => {
    console.log('[useAgentItinerary] Resetting all status and clearing errors');
    setItineraryCreationStatus('idle');
    setItineraryCreationProgress(0);
    setItineraryCreationStep('');
    setProgressQueue(null);
    setState(prev => ({
      ...prev,
      isGenerating: false,
      isUpdating: false,
      error: null,
    }));
    
    // Clear error timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
  }, []);
  
  // **STEP 3.3: UNIFIED STATUS SETTERS** 
  const setStatus = useCallback((status: ItineraryCreationStatus, message?: string) => {
    console.log(`[useAgentItinerary] Status change: ${itineraryCreationStatus} → ${status}${message ? ` (${message})` : ''}`);
    
    // Always clear error timeout when changing status
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      errorTimeoutRef.current = null;
    }
    
    setItineraryCreationStatus(status);
    
    // Update corresponding state flags
    if (status === 'loading') {
      setState(prev => ({ 
        ...prev, 
        isGenerating: true, 
        isUpdating: false,
        error: null // Clear errors when starting new operation
      }));
    } else if (status === 'success' || status === 'idle') {
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        isUpdating: false,
        error: null 
      }));
    } else if (status === 'error') {
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        isUpdating: false,
        error: message || 'An error occurred' 
      }));
    }
    
    if (message) {
      setItineraryCreationStep(message);
    }
  }, [itineraryCreationStatus]);
  
  // Default preferences to use when none are found
  const getDefaultPreferences = useCallback(() => ({
    travelStyle: 'cultural',
    interests: [],
    travelGroup: 'couple',
    budget: 'mid-range',
    transportMode: 'walking',
    dietaryPreferences: [],
    pace: 'moderate',
    lastUpdated: Date.now()
  }), []);
  
  // Simplified preference loading with caching and proper fallbacks
  const loadUserPreferences = useCallback(async (forceRefresh = false) => {
    // Return cached preferences if available and not forcing refresh
    if (cachedPreferences && !forceRefresh && !preferencesLoading) {
      console.log('📦 useAgentItinerary: Using cached preferences');
      return cachedPreferences;
    }
    
    // Prevent multiple simultaneous loading attempts
    if (preferencesLoading) {
      console.log('📦 useAgentItinerary: Preferences already loading, waiting...');
      // Wait for current loading to complete
      while (preferencesLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return cachedPreferences || getDefaultPreferences();
    }
    
    try {
      setPreferencesLoading(true);
      console.log('📦 useAgentItinerary: Loading user preferences from unified service');
      
      // Load preferences from unified service (handles all the complexity internally)
      const preferences = await unifiedUserPreferencesService.loadPreferences();
      
      if (preferences) {
        console.log('📦 useAgentItinerary: Successfully loaded user preferences');
        setCachedPreferences(preferences);
        return preferences;
      } else {
        console.log('📦 useAgentItinerary: No preferences found, using defaults');
        const defaultPrefs = getDefaultPreferences();
        setCachedPreferences(defaultPrefs);
        return defaultPrefs;
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
      const defaultPrefs = getDefaultPreferences();
      setCachedPreferences(defaultPrefs);
      return defaultPrefs;
    } finally {
      setPreferencesLoading(false);
    }
  }, [cachedPreferences, preferencesLoading, getDefaultPreferences]);
  
  // Clear cached preferences when user changes
  useEffect(() => {
    setCachedPreferences(null);
  }, [user?.id]);
  
  // Simple preference getter with override support
  const getEnhancedPreferences = useCallback(async (preferencesOverride?: any) => {
    const basePreferences = await loadUserPreferences();
    
    // Merge with any overrides provided
    return {
      ...basePreferences,
      ...(preferencesOverride || {})
    };
  }, [loadUserPreferences]);
  
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

  // **STEP 3.3: DEBOUNCED PROGRESS UPDATES**
  const updateProgress = useCallback((progress: number, step: string) => {
    console.log(`[useAgentItinerary] Progress update: ${progress}% - ${step}`);
    
    // Queue the progress update for debouncing
    setProgressQueue({ progress, step });
    
    // For immediate visual feedback on major milestones, update directly
    if (progress === 0 || progress === 100 || progress % 25 === 0) {
      setItineraryCreationProgress(progress);
      setItineraryCreationStep(step);
    }
  }, []);
  
  // **STEP 3.3: UNIFIED CANCELLATION**
  const cancelItineraryCreation = useCallback(() => {
    console.log('[useAgentItinerary] Cancelling itinerary creation');
    requestManager.current.abort();
    requestManager.current = new AbortController();
    
    // Use unified status reset
    resetStatus();
    finishItineraryCreation(); // Clear flag on cancel
  }, [finishItineraryCreation, resetStatus]);

  // Enhanced itinerary creation with smooth progress updates
  const createEnhancedItinerary = useCallback(async (
    destination: string,
    startDate: string | Date,
    endDate: string | Date,
    interests: Array<{id: string; label: string}>,
    preferences: any
  ): Promise<AgentItineraryResult> => {
    try {
      // **STEP 3.3: UNIFIED STATUS INITIALIZATION**
      console.log('[createEnhancedItinerary] Starting itinerary creation');
      
      // Abort any previous requests
      requestManager.current.abort();
      requestManager.current = new AbortController();
      
      // Use unified status management
      setStatus('loading', 'Preparing your itinerary...');
      updateProgress(0, 'Initializing...');
      
      // **STREAMLINED PROGRESS** - No artificial delays
      updateProgress(10, 'Configuring your preferences...');
      
      // Start the actual generation process
      const enhancedPreferences = {
        ...preferences,
        interests: interests.map(i => i.label),
        ...preferences
      };
      
      // Create a streamlined progress handler
      const handleProgress = (progress: number, message: string) => {
        // Map service progress (20-100) to UI progress (20-90)
        const mappedProgress = 20 + (progress - 20) * 0.7;
        updateProgress(Math.min(mappedProgress, 90), message);
      };
      
      // **SINGLE API CALL APPROACH** - No delays
      updateProgress(20, 'Generating your personalized itinerary...');
      
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
        // **STEP 3.3: UNIFIED ERROR HANDLING**
        if (error && (error.name === 'AbortError' || (error.message && (error as Error).message.includes('abort')))) {
          console.log('[createEnhancedItinerary] Itinerary generation was aborted');
          setStatus('idle', '');
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
      console.log('[createEnhancedItinerary] Clearing existing itinerary for destination:', destination);
      clearSessionStorage();
      
      // Make sure to completely clear existing days to prevent accumulation
      clearItineraryDays();
      
      // Clear conversation flow manager to start fresh
      try {
        conversationFlowManager.clearAllData();
        console.log('Cleared conversation flow manager for new enhanced itinerary');
        
        // **DESTINATION SYNC**: Start new session with correct destination
        conversationFlowManager.startSession(user?.id, destination);
        console.log('Started new conversation session with destination:', destination);
      } catch (error) {
        console.error('Error clearing conversation flow manager:', error);
      }
      
      // **SIMPLIFIED STATE MANAGEMENT** - Cleanup and setup
      updateProgress(92, 'Setting up your itinerary...');
      
      const { days: formattedDays, title } = convertItineraryApiToContext(result);
      
      // Check if we have valid days to add
      if (!formattedDays || formattedDays.length === 0) {
        throw new Error('No itinerary days were generated');
      }
      
      // Sort days by day number
      const sortedDays = [...formattedDays].sort((a, b) => a.dayNumber - b.dayNumber);
      
      // Set local state
      setState(prev => ({
        ...prev,
        lastAction: 'generate',
      }));
      
      // Add all days to the context efficiently
      updateProgress(95, 'Adding itinerary days...');
      console.log(`[useAgentItinerary] Adding ${sortedDays.length} new days to itinerary`);
      
      sortedDays.forEach(day => {
        addDay(day);
      });
      
      console.log(`[useAgentItinerary] Added ${sortedDays.length} days to itinerary`);
      
      // Force a refresh after adding all days to ensure UI updates
      forceRefresh();
      
      // Auto-save the itinerary
      updateProgress(98, 'Saving your itinerary...');
      
              if (sortedDays.length > 0) {
        try {
          console.log('[useAgentItinerary] Saving itinerary with title:', title);
          const itineraryId = await saveItinerary(title);
          console.log(`[useAgentItinerary] Automatically saved itinerary with title: "${title}", ID: ${itineraryId}`);
        } catch (saveError) {
          console.error('Failed to save itinerary:', saveError);
          // Continue without failing the whole process
        }
      }
      
      // **STEP 3.3: UNIFIED SUCCESS COMPLETION**
      updateProgress(100, 'Your itinerary is ready!');
      setStatus('success', 'Your itinerary is ready!');
      
      // Clear the creation flag to allow normal operations
      finishItineraryCreation();
      
      // Update last action
      setState(prev => ({ 
        ...prev,
        lastAction: 'generate'
      }));
      
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
      console.error('[createEnhancedItinerary] Error creating enhanced itinerary:', error);
      
      // **STEP 3.3: UNIFIED ERROR HANDLING**
      if (error.name === 'AbortError') {
        setStatus('idle', '');
        finishItineraryCreation();
        return {
          success: false,
          message: 'Itinerary creation canceled',
        };
      }
      
      // Handle other errors with unified status
      const errorMessage = (error as Error).message || 'Failed to create itinerary';
      setStatus('error', errorMessage);
      finishItineraryCreation();
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }, [
    itineraryDays,
    addDay,
    clearSessionStorage,
    savePreviousItinerary,
    saveItinerary,
    updateProgress,
    forceRefresh,
    clearItineraryDays,
    finishItineraryCreation,
    user?.id
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
      // **STEP 3.3: UNIFIED STATUS FOR GENERATION**
      console.log('[generateItinerary] Starting itinerary generation');
      setStatus('loading', 'Generating itinerary...');
      
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
      
      // Clear existing itinerary - both localStorage and state
      console.log('[generateItinerary] Clearing existing itinerary for destination:', destination);
      clearSessionStorage();
      
      // First clear the existing days before adding new ones
      // This is critical to prevent accumulation of days
      clearItineraryDays();
      
      // Clear conversation flow manager to start fresh
      try {
        conversationFlowManager.clearAllData();
        console.log('Cleared conversation flow manager for new itinerary');
        
        // **DESTINATION SYNC**: Start new session with correct destination
        conversationFlowManager.startSession(user?.id, destination);
        console.log('Started new conversation session with destination:', destination);
      } catch (error) {
        console.error('Error clearing conversation flow manager:', error);
      }
      
      // Note: We preserve chat messages to maintain conversation continuity
      // Users should be able to continue their conversation even after generating new itineraries
      
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
      
      // **STEP 3.3: UNIFIED SUCCESS FOR GENERATION**
      setStatus('success', 'Itinerary generated successfully!');
      setState(prev => ({
        ...prev,
        lastAction: 'generate',
      }));
      
      // Clear the creation flag to allow normal operations
      finishItineraryCreation();
      
      return {
        success: true,
        message: 'Successfully generated itinerary',
        data: {
          ...itineraryData,
          title
        },
      };
    } catch (error: any) {
      // **STEP 3.3: UNIFIED ERROR HANDLING FOR GENERATION**
      if (error.name === 'AbortError') {
        console.log('[generateItinerary] Generation aborted');
        setStatus('idle', '');
        finishItineraryCreation();
        return {
          success: false,
          message: 'Generation aborted',
        };
      }
      
      console.error('[generateItinerary] Error generating itinerary:', error);
      
      const errorMessage = error.message || 'Failed to generate itinerary';
      setStatus('error', errorMessage);
      finishItineraryCreation();
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }, [
    itineraryDays, 
    addDay, 
    clearSessionStorage, 
    savePreviousItinerary, 
    saveItinerary, 
    getEnhancedPreferences,
    clearItineraryDays,
    finishItineraryCreation,
    user?.id
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
      
      // **STEP 3.3: UNIFIED STATUS FOR UPDATE**
      console.log('[updateItinerary] Starting itinerary update');
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
      
      // **STEP 3.3: UNIFIED SUCCESS FOR UPDATE**
      setState(prev => ({
        ...prev,
        isUpdating: false,
        lastAction: 'update',
        error: null,
      }));
      
      // Clear the creation flag to allow normal operations
      finishItineraryCreation();
      
      return {
        success: true,
        message: 'Successfully updated itinerary',
        data: {
          ...updatedItinerary,
          title: finalTitle
        },
      };
    } catch (error: any) {
      console.error('[updateItinerary] Error updating itinerary:', error);
      
      // **STEP 3.3: UNIFIED ERROR HANDLING FOR UPDATE**
      const errorMessage = error.message || 'Failed to update itinerary';
      setState(prev => ({
        ...prev,
        isUpdating: false,
        error: errorMessage,
      }));
      
      finishItineraryCreation();
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }, [
    itineraryDays,
    addDay,
    clearSessionStorage,
    savePreviousItinerary,
    saveItinerary,
    currentItineraryForApi,
    clearItineraryDays,
    finishItineraryCreation
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
      
      // Get current preferences from unified service
      const currentPreferences = await loadUserPreferences();
      
      // Extract preferences from the user input
      const extractedPreferences = await enhancedOpenAIService.extractUserPreferences(
        userInput,
        currentPreferences || {}
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
        console.log('📦 useAgentItinerary: Updating preferences from conversation');
        
        // Store inferred preferences for this user
        unifiedUserPreferencesService.saveInferredPreferences(extractedPreferences);
        
        // Update preferences in unified service if significant changes
        if (Object.keys(extractedPreferences).length > 2) {
          await unifiedUserPreferencesService.updateFromConversationInferences(
            extractedPreferences
          );
          
          // Clear our cached preferences to force reload with new data
          setCachedPreferences(null);
        }
      }
    } catch (error) {
      console.error('Error updating preferences from conversation:', error);
      // Don't throw - this is a background enhancement
    }
  }, [user, loadUserPreferences, setCachedPreferences]);
  
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